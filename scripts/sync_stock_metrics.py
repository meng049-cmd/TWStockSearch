"""Official TWSE/TPEx valuation, day-trading and financing data, plus OTC OHLC history."""
import concurrent.futures as cf
import datetime as dt
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from update_data import tables, request
from sync_research import parse_margin
ROOT=Path(__file__).resolve().parents[1]
TZ=dt.timezone(dt.timedelta(hours=8))
OTC='https://www.tpex.org.tw/openapi/v1/'
TW='https://openapi.twse.com.tw/v1/'

def num(value):
    try:
        if value is None or not str(value).strip(): return None
        result=float(str(value).replace(',','').replace('%','').strip())
        return result if math.isfinite(result) else None
    except (ValueError,TypeError): return None

def date(value):
    raw=re.sub(r'\D','',str(value))
    if len(raw) not in (7,8): raise ValueError('Missing/unrecognized official date')
    y=int(raw[:-4])+(1911 if len(raw)==7 else 0)
    return dt.date(y,int(raw[-4:-2]),int(raw[-2:])).isoformat()

def code(row):return str(row.get('Code',row.get('SecuritiesCompanyCode',row.get('公司代號','')))).strip()
def ordinary(value):return bool(re.fullmatch(r'[1-9]\d{3}',value))
def get(url):
    last=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'TWStockSearch/5.0','Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=35) as response: return json.load(response)
        except Exception as exc:
            last=exc
            if attempt<2: time.sleep(attempt+1)
    raise RuntimeError(str(last))
def atomic(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')));os.replace(temp,path)
def load(path,default):
    return json.loads(path.read_text()) if path.exists() else default

def quote_row(row,exchange):
    if exchange=='TPEX': mapping={'open':'Open','high':'High','low':'Low','close':'Close','volume':'TradingShares','turnover':'TransactionAmount'}
    else: mapping={'open':'OpeningPrice','high':'HighestPrice','low':'LowestPrice','close':'ClosingPrice','volume':'TradeVolume','turnover':'TradeValue'}
    result={k:num(row.get(v)) for k,v in mapping.items()};result['date']=date(row['Date'])
    if not ordinary(code(row)) or any(result[k] is None for k in ['open','high','low','close','volume']):return None
    if min(result[k] for k in ['open','high','low','close'])<=0 or result['volume']<0 or result['high']<max(result['open'],result['close'],result['low']) or result['low']>min(result['open'],result['close']):return None
    return result

def historical_quotes(obj,expected):
    if str(obj.get('stat','')).lower()!='ok':return {}
    if date(obj.get('date'))!=expected:raise ValueError('TPEx historical date mismatch')
    out={}
    for fields,rows in tables(obj):
        if not all(x in fields for x in ['代號','收盤','開盤','最高','最低','成交股數']):continue
        for row in rows:
            d=dict(zip(fields,row));c=str(d['代號']).strip()
            if not ordinary(c):continue
            r=quote_row({'Date':expected,'SecuritiesCompanyCode':c,'Open':d['開盤'],'High':d['最高'],'Low':d['最低'],'Close':d['收盤'],'TradingShares':d['成交股數'],'TransactionAmount':d.get('成交金額(元)')},'TPEX')
            if r:out[c]=r
    return out

def daytrade_report(obj,expected):
    if date(obj.get('date'))!=expected:raise ValueError('Day-trade report date mismatch')
    out={}
    for fields,rows in tables(obj):
        if '證券代號' in fields and '當日沖銷交易成交股數' in fields:
            for row in rows:
                d=dict(zip(fields,row));c=str(d['證券代號']).strip();v=num(d['當日沖銷交易成交股數'])
                if ordinary(c) and v is not None:out[c]={'dayTradeShares':v,'dayTradeDate':expected}
    if not out:raise ValueError('No per-stock day-trade volume table')
    return out

def parse_otc_chip_report(obj,kind):
    out={}
    for fields,rows in tables(obj):
        if kind=='flows' and fields and len(fields)==24 and fields[0]=='代號' and fields[10]=='買賣超股數' and fields[13]=='買賣超股數' and fields[22]=='買賣超股數':
            for row in rows:
                c=str(row[0]).strip()
                if ordinary(c):out[c]={'foreignNet':num(row[10]),'trustNet':num(row[13]),'dealerNet':num(row[22])}
        elif kind=='margin' and fields and all(k in fields for k in ['代號','前資餘額(張)','資餘額']):
            for row in rows:
                d=dict(zip(fields,row));c=str(d['代號']).strip();a=num(d['前資餘額(張)']);b=num(d['資餘額'])
                if ordinary(c):out[c]={'marginBalance':b,'marginChange':b-a if a is not None and b is not None else None}
    return out

def main():
    now=dt.datetime.now(TZ).isoformat();metrics_path=ROOT/'data/stock-metrics.json'
    previous=load(metrics_path,{'stocks':[]});records={r['code']:r for r in previous.get('stocks',[])};sources=[];payloads={}
    endpoints={'tw_quotes':TW+'exchangeReport/STOCK_DAY_ALL','otc_quotes':OTC+'tpex_mainboard_daily_close_quotes','tw_pe':TW+'exchangeReport/BWIBBU_ALL','otc_pe':OTC+'tpex_mainboard_peratio_analysis','tw_profile':TW+'opendata/t187ap03_L','otc_profile':OTC+'mopsfin_t187ap03_O','otc_margin':OTC+'tpex_mainboard_margin_balance','otc_institution':OTC+'tpex_3insti_daily_trading'}
    def fetch(item):
        key,url=item
        try:
            rows=get(url)
            if not isinstance(rows,list) or not rows:raise ValueError('Official list empty or changed')
            return key,rows,{'name':key,'url':url,'checkedAt':now,'ok':True,'rows':len(rows)}
        except Exception as exc:return key,None,{'name':key,'url':url,'checkedAt':now,'ok':False,'error':str(exc)[:180]}
    for key,data,status in cf.ThreadPoolExecutor(max_workers=4).map(fetch,endpoints.items()):
        sources.append(status)
        if data is not None:payloads[key]=data
    otc_hist={};otc_names={}
    for exchange,prefix in [('TWSE','tw'),('TPEX','otc')]:
        for r in payloads.get(prefix+'_quotes',[]):
            c=code(r)
            try:q=quote_row(r,exchange)
            except (ValueError,KeyError):continue
            if not q:continue
            record=records.setdefault(c,{'code':c});record.update({'exchange':exchange,'name':str(r.get('Name',r.get('CompanyName',c))).strip(),'tradingDate':q['date'],'tradingShares':q['volume']})
            if exchange=='TPEX':otc_hist.setdefault(c,{})[q['date']]=q;otc_names[c]=record['name']
        for r in payloads.get(prefix+'_profile',[]):
            c=code(r)
            if not ordinary(c):continue
            record=records.setdefault(c,{'code':c,'exchange':exchange});sector=str(r.get('產業別',r.get('SecuritiesIndustryCode',''))).strip();record['industry']=sector.zfill(2) if sector.isdigit() else None
            record.setdefault('name',r.get('公司簡稱',r.get('CompanyAbbreviation',r.get('CompanyName',c))))
        for r in payloads.get(prefix+'_pe',[]):
            c=code(r)
            if not ordinary(c):continue
            try:day=date(r['Date'])
            except (KeyError,ValueError):continue
            records.setdefault(c,{'code':c,'exchange':exchange}).update({'pe':num(r.get('PEratio',r.get('PriceEarningRatio'))),'pb':num(r.get('PBratio',r.get('PriceBookRatio'))),'dividendYield':num(r.get('DividendYield',r.get('YieldRatio'))),'peDate':day,'peSource':endpoints[prefix+'_pe']})
    for r in payloads.get('otc_margin',[]):
        c=code(r)
        if not ordinary(c):continue
        try:day=date(r['Date'])
        except (KeyError,ValueError):continue
        balance=num(r.get('MarginPurchaseBalance'));prior=num(r.get('MarginPurchaseBalancePreviousDay'));change=balance-prior if balance is not None and prior is not None else None
        records.setdefault(c,{'code':c,'exchange':'TPEX'}).update({'marginBalance':balance,'marginChange':change,'marginDate':day})
        if c in otc_hist and day in otc_hist[c]:otc_hist[c][day].update({'marginBalance':balance,'marginChange':change})
    for r in payloads.get('otc_institution',[]):
        c=code(r)
        if c not in otc_hist:continue
        d={re.sub(r'\s','',k):v for k,v in r.items()}
        try:day=date(r['Date'])
        except (KeyError,ValueError):continue
        if day in otc_hist[c]:otc_hist[c][day].update({'foreignNet':num(d.get('ForeignInvestorsIncludeMainlandAreaInvestors-Difference')),'trustNet':num(d.get('SecuritiesInvestmentTrustCompanies-Difference')),'dealerNet':num(d.get('Dealers-Difference'))})
    # TWSE day trading requires the full dated report. Its open-data namesake only lists eligibility.
    tw_dates=sorted({r['tradingDate'] for r in records.values() if r.get('exchange')=='TWSE' and r.get('tradingDate')})
    if tw_dates:
        day=tw_dates[-1];parsed=dt.date.fromisoformat(day)
        for name,route,parser in [('tw_daytrade','exchangeReport/TWTB4U',lambda obj:daytrade_report(obj,day)),('tw_margin','exchangeReport/MI_MARGN',parse_margin)]:
            try:
                obj=request(route,parsed,{'selectType':'ALL'} if name=='tw_margin' else None)
                if obj is None:raise ValueError('No dated report')
                for c,values in parser(obj).items():
                    if c in records:
                        records[c].update(values)
                        if name=='tw_margin':records[c]['marginDate']=day
                sources.append({'name':name,'ok':True,'date':day,'url':'https://www.twse.com.tw/'+route})
            except Exception as exc:sources.append({'name':name,'ok':False,'date':day,'error':str(exc)[:180]})
    otc_dates=sorted({r['tradingDate'] for r in records.values() if r.get('exchange')=='TPEX' and r.get('tradingDate')})
    if otc_dates:
        day=otc_dates[-1];d=dt.date.fromisoformat(day);roc=f'{d.year-1911}/{d.month:02}/{d.day:02}'
        url='https://www.tpex.org.tw/web/stock/trading/intraday_stat/intraday_trading_stat_result.php?'+urllib.parse.urlencode({'l':'zh-tw','d':roc})
        try:
            for c,values in daytrade_report(get(url),day).items():
                if c in records:records[c].update(values)
            sources.append({'name':'otc_daytrade','ok':True,'date':day,'url':url})
        except Exception as exc:sources.append({'name':'otc_daytrade','ok':False,'date':day,'error':str(exc)[:180]})
    # Backfill date-verified all-market OTC quotes for real chart warm-up; no synthetic candles.
    existing=load(ROOT/'data/otc-stocks.json',{'stocks':[]});old_by_code={s['code']:s for s in existing['stocks']}
    latest=max((q['tradingDate'] for q in records.values() if q.get('exchange')=='TPEX' and q.get('tradingDate')),default=None)
    if latest:
        end=dt.date.fromisoformat(latest);coverage=existing.get('historyStart');days=120 if not coverage or coverage>(end-dt.timedelta(days=100)).isoformat() else 8
        dates=[end-dt.timedelta(days=i) for i in range(1,days) if (end-dt.timedelta(days=i)).weekday()<5]
        def history(day):
            url='https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?'+urllib.parse.urlencode({'date':day.strftime('%Y/%m/%d'),'id':'','response':'json'})
            try:return day.isoformat(),historical_quotes(get(url),day.isoformat())
            except Exception as exc:return day.isoformat(),{'_error':str(exc)[:100]}
        success=0;failures=[]
        with cf.ThreadPoolExecutor(max_workers=3) as pool:
            for day,by_code in pool.map(history,dates):
                if '_error' in by_code:failures.append(day);continue
                if by_code:success+=1
                for c,q in by_code.items():
                    if c in otc_hist:otc_hist[c].setdefault(day,q)
        sources.append({'name':'otc_history','ok':success>0,'tradingDays':success,'failedDates':failures,'url':'https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes'})
    if latest:
        # Recover recent institutional and financing history for multi-panel analysis.
        dates=[dt.date.fromisoformat(latest)-dt.timedelta(days=i) for i in range(25) if (dt.date.fromisoformat(latest)-dt.timedelta(days=i)).weekday()<5]
        def chips(day):
            patches={};issues=[]
            for kind,route in [('flows','insti/dailyTrade'),('margin','margin/balance')]:
                url='https://www.tpex.org.tw/www/zh-tw/'+route+'?'+urllib.parse.urlencode({'date':day.strftime('%Y/%m/%d'),'type':'Daily','response':'json'})
                try:
                    obj=get(url)
                    if str(obj.get('stat','')).lower()!='ok':continue
                    if date(obj.get('date'))!=day.isoformat():raise ValueError('Historical chip date mismatch')
                    parsed=parse_otc_chip_report(obj,kind)
                    for c,value in parsed.items():patches.setdefault(c,{}).update(value)
                except Exception as exc:issues.append(kind+':'+str(exc)[:80])
            return day.isoformat(),patches,issues
        chip_failed=[]
        with cf.ThreadPoolExecutor(max_workers=3) as pool:
            for day,patches,issues in pool.map(chips,dates):
                if issues:chip_failed.append({'date':day,'issues':issues})
                for c,patch in patches.items():
                    if c in otc_hist and day in otc_hist[c]:otc_hist[c][day].update(patch)
        sources.append({'name':'otc_chip_history','ok':not chip_failed,'failedDates':chip_failed,'url':'https://www.tpex.org.tw/'})
    published=[]
    for c in sorted(set(old_by_code)|set(otc_hist)):
        path=ROOT/'data/otc-history'/(c+'.json');old=load(path,{'history':[]});history={r['date']:r for r in old.get('history',[])}
        for day,q in otc_hist.get(c,{}).items():history[day]={**history.get(day,{}),**q}
        if not history:continue
        rows=sorted(history.values(),key=lambda x:x['date'])[-1600:];name=otc_names.get(c,old_by_code.get(c,{}).get('name',c))
        atomic(path,{'code':c,'name':name,'exchange':'TPEX','source':'櫃買中心官方行情與法人／融資快照','updatedAt':now,'history':rows})
        published.append({'code':c,'name':name,'exchange':'TPEX','historyUrl':'data/otc-history/'+c+'.json','historyStart':rows[0]['date'],'historyEnd':rows[-1]['date']})
    if published:atomic(ROOT/'data/otc-stocks.json',{'updatedAt':now,'stocks':published,'historyStart':min(s['historyStart'] for s in published),'sources':sources})
    atomic(metrics_path,{'updatedAt':now,'stocks':sorted(records.values(),key=lambda r:r['code']),'sources':sources,'method':'正本益比與同產業同日其他公司中位數比較；當沖成交股數除同日總成交股數；融資餘額單位張。'})
    print(json.dumps({'stocks':len(records),'otcStocks':len(published),'sourceFailures':[s for s in sources if not s['ok']]},ensure_ascii=False))
if __name__=='__main__':main()
