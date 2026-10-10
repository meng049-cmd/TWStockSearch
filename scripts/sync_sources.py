"""Separate four-hour company and hourly disclosure sync, without secrets or external packages."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.request
from hotness import WEIGHTS, rank_groups, rank_hotstocks

ROOT = Path(__file__).resolve().parents[1]
COMPANIES = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L'
ANNOUNCEMENTS = 'https://openapi.twse.com.tw/v1/opendata/t187ap04_L'
INDUSTRIES = dict(zip(
 ['01','02','03','04','05','06','08','09','10','11','12','14','15','16','17','18','20','21','22','23','24','25','26','27','28','29','30','31','35','36','37','38','91'],
 ['水泥','食品','塑膠','紡織纖維','電機機械','電器電纜','玻璃陶瓷','造紙','鋼鐵','橡膠','汽車','建材營造','航運','觀光餐旅','金融保險','貿易百貨','其他','化學','生技醫療','油電燃氣','半導體','電腦及週邊設備','光電','通信網路','電子零組件','電子通路','資訊服務','其他電子','綠能環保','數位雲端','運動休閒','居家生活','存託憑證']))

def get(url, is_json=True):
    req = urllib.request.Request(url, headers={'User-Agent':'TWStockSearch/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response) if is_json else response.read().decode('utf-8')

def roc_date(value):
    value = re.sub(r'\D','',str(value))
    if len(value) != 7:
        raise ValueError('Unrecognized official ROC date')
    return dt.date(int(value[:3])+1911,int(value[3:5]),int(value[5:7])).isoformat()

def company_snapshot(path, now, force=False):
    """Reuse the persisted snapshot within each four-hour UTC/Taipei window."""
    cached = None
    if path.exists():
        try:
            cached = json.loads(path.read_text())
            fetched = dt.datetime.fromisoformat(cached['checkedAt'])
            if (not force and fetched.tzinfo is not None and fetched <= now
                    and int(fetched.timestamp()) // 14400 == int(now.timestamp()) // 14400
                    and cached.get('url') == COMPANIES and cached.get('companies')):
                return cached['companies'], cached['checkedAt']
        except (ValueError, KeyError, TypeError):
            pass
    companies = get(COMPANIES)
    fields = ['公司代號', '產業別', '已發行普通股數或TDR原股發行股數', '出表日期']
    if not isinstance(companies, list) or not companies or any(
            not isinstance(row, dict) or any(field not in row for field in fields) for row in companies):
        raise RuntimeError('Official company schema changed; previous snapshot retained')
    companies = [{field: row[field] for field in fields} for row in companies]
    snapshot = {'url': COMPANIES, 'checkedAt': now.isoformat(), 'companies': companies}
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    os.replace(temp, path)
    return companies, snapshot['checkedAt']


def main(force_companies=False):
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    companies, company_checked = company_snapshot(ROOT/'data/company-profile.json', now,
        force=force_companies or os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch')
    notices = get(ANNOUNCEMENTS)
    checked = now.isoformat()
    path = ROOT/'data/themes.json'
    previous = json.loads(path.read_text()) if path.exists() else {}
    stocks = json.loads((ROOT/'data/stocks.json').read_text())['stocks']
    latest = max(h['date'] for stock in stocks for h in stock['history'])
    stocks = {s['code']:s for s in stocks if s['history'] and max(h['date'] for h in s['history'])==latest}
    company_map = {str(c['公司代號']).strip():c for c in companies}
    hotstocks = rank_hotstocks(list(stocks.values()), company_map, latest)
    groups = {}
    for code, stock in stocks.items():
        company = company_map.get(code)
        if not company:
            continue
        industry = str(company['產業別']).strip()
        name = INDUSTRIES.get(industry, '產業 '+industry)
        group = groups.setdefault(name, {'name':name,'codes':[],'turnover':0,'articles':[],
            'sources':[{'name':'證交所上市公司產業分類','url':COMPANIES},{'name':'證交所每日行情','url':'https://www.twse.com.tw/zh/trading/historical/mi-index.html'}]})
        group['codes'].append(code)
        bar = max(stock['history'],key=lambda h:h['date'])
        group['turnover'] += bar.get('turnover',0)
    articles = {a['id']:a for a in previous.get('articles',[]) if a.get('kind') == 'official' and a.get('id') and (a.get('publishedAt') or a.get('checkedAt',''))[:10] >= (now.date()-dt.timedelta(days=30)).isoformat()}
    for row in notices:
        code = str(row.get('公司代號','')).strip()
        title = row.get('主旨 ',row.get('主旨','')).strip()
        if not code or not title:
            continue
        date = roc_date(row['發言日期'])
        timestamp = str(row.get('發言時間','')).zfill(6)
        published = date+'T'+':'.join([timestamp[:2],timestamp[2:4],timestamp[4:6]])+'+08:00'
        identity = code+'|'+published+'|'+title
        articles[identity]={'id':identity,'code':code,'codes':[code],'title':title,'source':'公開資訊觀測站重大訊息',
            'publishedAt':published,'url':ANNOUNCEMENTS,'body':row.get('說明',''),'kind':'official','checkedAt':checked}
    sources=[{'name':'證交所上市公司資料','status':'ok','checkedAt':company_checked,'refreshEveryHours':4,'url':COMPANIES},
             {'name':'公開資訊觀測站重大訊息','status':'ok','checkedAt':checked,'refreshEveryHours':1,'url':ANNOUNCEMENTS}]
    values=list(articles.values())
    for group in groups.values():
        codes=set(group['codes'])
        group['articles']=[a for a in values if codes.intersection(a.get('codes',[]))]
        group['articles'].sort(key=lambda a:a.get('publishedAt') or a.get('checkedAt',''),reverse=True)
    result={'version':2,'updatedAt':checked,'quoteDate':latest,
            'method':'V2 盤後交易活躍度：族群分數＝成交金額百分位 50%＋前 5 檔可排名股票平均熱度 50%。非盤中資金速度或淨流入。',
            'ranking':{'weights':WEIGHTS,'eligibleCount':sum(r['score'] is not None for r in hotstocks.values()),
                       'universe':'最後交易日有行情及完整指標的上市公司；缺資料不排名；百分位每日重算，非獲利機率。'},
            'hotstocks':hotstocks,'groups':rank_groups(list(groups.values()),hotstocks),'articles':values,'sources':sources}
    v2_path = ROOT/'data/themes-v2.json'
    temp=v2_path.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));os.replace(temp,v2_path)
    legacy = {'updatedAt':checked,'quoteDate':latest,
              'method':'依最後交易日族群成交金額排序；族群採官方產業分類，不代表社群熱度。',
              'groups':sorted(({k:g[k] for k in ['name','codes','turnover','articles','sources']} for g in groups.values()),key=lambda g:g['turnover'],reverse=True),
              'articles':values,'sources':sources}
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(legacy,ensure_ascii=False,separators=(',',':')));os.replace(temp,path)
    print(f'Synced {len(groups)} industry groups and {len(values)} reference items; quote date {latest}')

if __name__=='__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-companies', action='store_true', help='Force refresh the four-hour company snapshot')
    main(parser.parse_args().refresh_companies)
