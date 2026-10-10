"""Fetch official TWSE daily prices and gross institutional buy shares.

No external packages. Atomically preserves the previous file on failures.
"""
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
import math

ROOT = Path(__file__).resolve().parents[1]

def request(path, date, extra=None):
    query = {'response': 'json', 'date': date.strftime('%Y%m%d'), **(extra or {})}
    endpoints = {'afterTrading/MI_INDEX': 'exchangeReport/MI_INDEX', 'fund/T86': 'fund/T86'}
    routes = [endpoints.get(path, path), 'rwd/zh/'+path]
    failure = None
    for route in routes:
        url = 'https://www.twse.com.tw/' + route + '?' + urllib.parse.urlencode(query)
        req = urllib.request.Request(url, headers={'User-Agent': 'TWStockSearch/1.0', 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                obj = json.load(response)
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in [308, 429, 500, 502, 503, 504]:
                raise
            failure = exc
            time.sleep(3)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            failure = exc
    else:
        raise RuntimeError(f'{path} {date}: both official routes failed; previous data retained') from failure
    status = obj.get('stat', '')
    if status != 'OK':
        if '沒有符合條件' in status:
            return None
        raise RuntimeError(f'{path} {date}: {status or "unknown response"}')
    if obj.get('date') != date.strftime('%Y%m%d'):
        raise RuntimeError(f'{path} {date}: official response date mismatch')
    return obj

def tables(obj):
    for t in obj.get('tables', []):
        if 'fields' in t and 'data' in t:
            yield t['fields'], t['data']
    if 'fields' in obj and 'data' in obj:
        yield obj['fields'], obj['data']
    for k in obj:
        if k.startswith('fields') and k != 'fields':
            yield obj[k], obj.get('data' + k[6:], [])

def number(value):
    try:
        parsed = float(str(value).replace(',', '').strip())
        return parsed if math.isfinite(parsed) else None
    except ValueError:
        return None

def parse_prices(obj):
    for fields, rows in tables(obj):
        if '證券代號' in fields and '收盤價' in fields and '證券名稱' in fields:
            ci, ni, pi = (fields.index(x) for x in ['證券代號', '證券名稱', '收盤價'])
            result = {}
            for row in rows:
                code = str(row[ci]).strip()
                price = number(row[pi])
                if len(code) == 4 and code.isdigit() and price and price > 0:
                    result[code] = (str(row[ni]).strip(), price)
            if not result:
                raise RuntimeError('Empty official price table')
            return result
    raise RuntimeError('Official price schema changed')

def parse_buys(obj):
    fields, rows = obj['fields'], obj['data']
    def index(predicate):
        found = [i for i, f in enumerate(fields) if predicate(f)]
        if len(found) != 1:
            raise RuntimeError('Official institutional schema changed')
        return found[0]
    ci = index(lambda f: f in ['證券代號', '股票代號'])
    fi = index(lambda f: '外陸資買進股數' in f and '不含' in f)
    ti = index(lambda f: f == '投信買進股數')
    result = {}
    for row in rows:
        f, t = number(row[fi]), number(row[ti])
        if f is not None and t is not None:
            result[str(row[ci]).strip()] = {'foreignBuy': f, 'trustBuy': t}
    return result

def parse_bars(obj):
    for fields, rows in tables(obj):
        if '證券代號' in fields and '收盤價' in fields:
            out = {}
            names = {'open': '開盤價', 'high': '最高價', 'low': '最低價', 'volume': '成交股數', 'turnover': '成交金額'}
            for row in rows:
                code = str(row[fields.index('證券代號')]).strip()
                if len(code) != 4 or not code.isdigit():
                    continue
                out[code] = {key: value for key, name in names.items() if name in fields
                             and (value := number(row[fields.index(name)])) is not None}
            return out
    raise RuntimeError('Official OHLC schema changed')

def publish_histories(stocks, history_dir):
    published = []
    for code, stock in sorted(stocks.items()):
        if not code.isdigit() or len(code) != 4:
            raise RuntimeError('Invalid official stock code')
        target = history_dir/(code+'.json')
        history = {'code':code,'history':stock['history'],'source':'TWSE official daily OHLC'}
        temp=target.with_suffix('.tmp');temp.write_text(json.dumps(history,ensure_ascii=False,separators=(',',':')));os.replace(temp,target)
        published.append({**stock,'history':stock['history'][-30:], 'historyUrl':'data/history/'+code+'.json',
                          'historyStart':stock['history'][0]['date'],'historyEnd':stock['history'][-1]['date']})
    return published


def main():
    path = ROOT / 'data/stocks.json'
    previous = json.loads(path.read_text())
    stocks = {s['code']: s for s in previous.get('stocks', [])} if previous.get('mode') != 'demo' else {}
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    history_dir = ROOT/'data/history'
    history_dir.mkdir(parents=True, exist_ok=True)
    missing_history = False
    for code, stock in stocks.items():
        history_path = history_dir/(code+'.json')
        if history_path.exists():
            saved = json.loads(history_path.read_text())
            records = {h['date']:h for h in saved['history']}
            records.update({h['date']:h for h in stock['history']})
            stock['history'] = sorted(records.values(), key=lambda h:h['date'])
        elif stock.get('historyUrl'):
            missing_history = True
    latest_known = max((h['date'] for s in stocks.values() for h in s['history']), default=today.isoformat())
    reference = dt.date.fromisoformat(latest_known)
    try:
        cutoff = reference.replace(year=reference.year-5)
    except ValueError:
        cutoff = reference.replace(year=reference.year-5, day=28)
    coverage = previous.get('historyCoverage', {})
    needs_history = missing_history or not coverage.get('start') or coverage['start'] > cutoff.isoformat()
    days = (today - cutoff).days+15 if needs_history else 8
    cache_dir = ROOT/'.cache/twse'
    cache_dir.mkdir(parents=True, exist_ok=True)
    completed = 0
    def fetch_day(date):
        cache = cache_dir/(date.isoformat()+'.json')
        if cache.exists() and date < today-dt.timedelta(days=8):
            cached = json.loads(cache.read_text())
            if cached.get('date') == date.isoformat() and 'prices' in cached:
                bars = {code: cached['bars'][code] for code in (cached['prices'] or {}) if code in cached['bars']}
                return date,cached['prices'],cached['buys'],bars
        for attempt in range(3):
            try:
                price_obj = request('afterTrading/MI_INDEX', date, {'type': 'ALL'})
                break
            except RuntimeError as exc:
                if 'both official routes failed' not in str(exc) or attempt == 2:
                    raise
                print(f'Transient official redirect for {date}; backing off before retry', flush=True)
                time.sleep(10*(attempt+1))
        time.sleep(.5)
        if price_obj is None:
            temp=cache.with_suffix('.tmp');temp.write_text(json.dumps({'date':date.isoformat(),'prices':None,'buys':{},'bars':{}}));os.replace(temp,cache)
            return date, None, {}, {}
        buys = {}
        if date >= today - dt.timedelta(days=25):
            buy_obj = request('fund/T86', date, {'selectType': 'ALLBUT0999'})
            time.sleep(.5)
            if buy_obj is None:
                raise RuntimeError(f'Institutional data not yet available for {date}; previous file retained')
            buys = parse_buys(buy_obj)
        prices,bars=parse_prices(price_obj),parse_bars(price_obj)
        temp=cache.with_suffix('.tmp');temp.write_text(json.dumps({'date':date.isoformat(),'prices':prices,'buys':buys,'bars':bars},ensure_ascii=False,separators=(',',':')));os.replace(temp,cache)
        print(f'Fetched {date}', flush=True)
        return date, prices, buys, bars
    dates = [today - dt.timedelta(days=i) for i in range(days - 1, -1, -1)
             if (today - dt.timedelta(days=i)).weekday() < 5]
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(fetch_day, dates))
    records_by_code = {code: {h['date']: h for h in stock['history']} for code, stock in stocks.items()}
    for date, prices, buys, bars in results:
        if prices is None:
            continue
        for code, (name, close) in prices.items():
            stock = stocks.setdefault(code, {'code': code, 'name': name, 'group': '', 'history': []})
            stock['name'] = name
            records = records_by_code.setdefault(code, {})
            records[date.isoformat()] = {**records.get(date.isoformat(), {}), 'date': date.isoformat(), 'close': close, **buys.get(code, {}), **bars.get(code, {})}
        completed += 1
    if not completed:
        raise RuntimeError('No official trading days retrieved; previous file retained')
    for code, stock in stocks.items():
        stock['history'] = sorted(records_by_code[code].values(), key=lambda h: h['date'])[-1600:]
    latest = max(h['date'] for s in stocks.values() for h in s['history'])
    published = publish_histories(stocks, history_dir)
    new_coverage = {'start':dates[0].isoformat(),'end':latest,'targetYears':5} if needs_history else {**coverage,'end':latest}
    result = {'mode': 'live', 'historyCoverage':new_coverage, 'updatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'notice': '證交所上市盤後資料；不含上櫃。外資買進股數不含外資自營商。官方公告另行同步；歷史 K 線依選取股票載入。',
              'stocks': published, 'groups': previous.get('groups', [])}
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    os.replace(temp, path)
    print(f'Updated {len(stocks)} stocks across {completed} trading dates')

if __name__ == '__main__':
    main()
