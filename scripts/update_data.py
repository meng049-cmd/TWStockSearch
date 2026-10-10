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
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]

def request(path, date, extra=None):
    query = {'date': date.strftime('%Y%m%d'), 'response': 'json', **(extra or {})}
    endpoints = {'afterTrading/MI_INDEX': 'exchangeReport/MI_INDEX', 'fund/T86': 'fund/T86'}
    url = 'https://www.twse.com.tw/' + endpoints.get(path, path) + '?' + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'TWStockSearch/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=45) as response:
        try:
            obj = json.load(response)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise RuntimeError(f'{path} {date}: official server returned non-JSON content; previous data retained') from exc
    status = obj.get('stat', '')
    if status != 'OK':
        if '沒有符合條件' in status or '很抱歉' in status:
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
        return float(str(value).replace(',', '').strip())
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
                out[code] = {key: value for key, name in names.items() if name in fields
                             and (value := number(row[fields.index(name)])) is not None}
            return out
    raise RuntimeError('Official OHLC schema changed')

def main():
    path = ROOT / 'data/stocks.json'
    previous = json.loads(path.read_text())
    stocks = {s['code']: s for s in previous.get('stocks', [])} if previous.get('mode') != 'demo' else {}
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    cutoff = today - dt.timedelta(days=190)
    needs_history = not stocks or not any(
        h['date'] <= cutoff.isoformat() and all(h.get(k) is not None for k in ['open','high','low'])
        for stock in stocks.values() for h in stock['history'])
    days = 210 if needs_history else 8
    completed = 0
    def fetch_day(date):
        price_obj = request('afterTrading/MI_INDEX', date, {'type': 'ALLBUT0999'})
        time.sleep(1)
        if price_obj is None:
            return date, None, {}, {}
        buys = {}
        if date >= today - dt.timedelta(days=25):
            buy_obj = request('fund/T86', date, {'selectType': 'ALLBUT0999'})
            time.sleep(1)
            if buy_obj is None:
                raise RuntimeError(f'Institutional data not yet available for {date}; previous file retained')
            buys = parse_buys(buy_obj)
        print(f'Fetched {date}', flush=True)
        return date, parse_prices(price_obj), buys, parse_bars(price_obj)
    dates = [today - dt.timedelta(days=i) for i in range(days - 1, -1, -1)
             if (today - dt.timedelta(days=i)).weekday() < 5]
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(fetch_day, dates))
    for date, prices, buys, bars in results:
        if prices is None:
            continue
        for code, (name, close) in prices.items():
            stock = stocks.setdefault(code, {'code': code, 'name': name, 'group': '', 'history': []})
            stock['name'] = name
            records = {h['date']: h for h in stock['history']}
            records[date.isoformat()] = {**records.get(date.isoformat(), {}), 'date': date.isoformat(), 'close': close, **buys.get(code, {}), **bars.get(code, {})}
            stock['history'] = sorted(records.values(), key=lambda h: h['date'])[-260:]
        completed += 1
    if not completed:
        raise RuntimeError('No official trading days retrieved; previous file retained')
    result = {'mode': 'live', 'updatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'notice': '證交所上市盤後資料；不含上櫃。外資買進股數不含外資自營商。社群文章須人工核對匯入。',
              'stocks': sorted(stocks.values(), key=lambda s: s['code']), 'groups': previous.get('groups', [])}
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    os.replace(temp, path)
    print(f'Updated {len(stocks)} stocks across {completed} trading dates')

if __name__ == '__main__':
    main()
