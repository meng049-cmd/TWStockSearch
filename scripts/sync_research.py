"""Publish institutional net flows, margin changes and per-contract futures snapshots.

Uses public official sources. Personal notes and imports never enter this repository.
Failures preserve the last successful values and are recorded explicitly.
"""
import datetime as dt
import json
import math
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from update_data import request, tables, number

ROOT = Path(__file__).resolve().parents[1]


def atomic(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
    os.replace(temp, path)


def parse_net(obj):
    fields = obj['fields']
    labels = [re.sub(r'\s|[()（）]', '', f) for f in fields]
    def at(label):
        return labels.index(label)
    ci = next(i for i, f in enumerate(labels) if f in ('證券代號', '股票代號'))
    fi = at('外陸資買賣超股數不含外資自營商')
    fdi = at('外資自營商買賣超股數')
    ti, di = at('投信買賣超股數'), at('自營商買賣超股數')
    out = {}
    for row in obj['data']:
        foreign, foreign_dealer = number(row[fi]), number(row[fdi])
        out[str(row[ci]).strip()] = {
            'foreignNet': foreign + foreign_dealer if foreign is not None and foreign_dealer is not None else None,
            'trustNet': number(row[ti]), 'dealerNet': number(row[di])}
    return out


def parse_margin(obj):
    for fields, rows in tables(obj):
        if '代號' in fields and '前日餘額' in fields and '今日餘額' in fields:
            ci, prev, today = (fields.index(k) for k in ['代號', '前日餘額', '今日餘額'])
            if not 0 < prev < today < 8:
                raise ValueError('Official margin schema changed')
            out = {}
            for row in rows:
                a, b = number(row[prev]), number(row[today])
                if a is not None and b is not None:
                    out[str(row[ci]).strip()] = {'marginChange': b-a, 'marginBalance': b, 'marginPrevious': a}
            return out
    raise ValueError('Official margin table missing')


def official_date(value):
    s = re.sub(r'[/\-]', '', str(value))
    if not re.fullmatch(r'\d{7,8}', s):
        raise ValueError('Invalid official date')
    year = int(s[:-4]) + (1911 if len(s) == 7 else 0)
    return dt.date(year, int(s[-4:-2]), int(s[-2:])).isoformat()


def parse_futures(rows, metadata, at):
    names = {'TX': '臺股期貨', 'MTX': '小型臺指期貨', 'TMF': '微型臺指期貨', 'TE': '電子期貨', 'TF': '金融期貨'}
    items = {}
    for x in rows:
        code, contract, session = x.get('Contract', ''), x.get('ContractMonth(Week)', ''), x.get('TradingSession', '')
        if not re.fullmatch(r'[A-Z0-9]{2,10}', code) or not re.fullmatch(r'\d{6}(W\d)?', contract) or session not in ('一般', '盤後'):
            continue
        bar = {'date': official_date(x['Date']), **{k: number(x.get(f)) for k, f in [('open', 'Open'), ('high', 'High'), ('low', 'Low'), ('close', 'Last'), ('volume', 'Volume'), ('openInterest', 'OpenInterest')]}, 'foreign': None, 'trust': None, 'dealer': None, 'margin': None, 'source': 'TAIFEX official daily snapshot', 'updatedAt': at}
        if any(bar[k] is None for k in ('open', 'high', 'low', 'close', 'volume')) or min(bar[k] for k in ('open', 'high', 'low', 'close')) <= 0 or bar['volume'] < 0 or bar['high'] < max(bar['open'], bar['close'], bar['low']) or bar['low'] > min(bar['open'], bar['close']):
            continue
        meta = metadata.get(code, metadata.get(code+'F', {}))
        identity = f'future:{code}:{contract}:{session}'
        items[identity] = {'id': identity, 'kind': 'future', 'code': code, 'name': meta.get('name', names.get(code, code+' 期貨')), 'underlyingCode': meta.get('underlyingCode', ''), 'contract': contract, 'session': session, 'unit': '口', 'rows': [bar]}
    return items


def main():
    now = dt.datetime.now(dt.timezone.utc)
    at = now.isoformat()
    status_path = ROOT/'data/research-status.json'
    previous = json.loads(status_path.read_text()) if status_path.exists() else {}
    age = (now-dt.datetime.fromisoformat(previous['checkedAt'])).total_seconds() if previous.get('checkedAt') else math.inf
    if age < 3.5*3600 and os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch':
        print('Research snapshot checked less than four hours ago')
        return
    snapshot = json.loads((ROOT/'data/stocks.json').read_text())
    dates = sorted({h['date'] for s in snapshot['stocks'] for h in s['history']})[-130:]
    warnings = []
    def day(date):
        result = {}
        for name, route, extra, parser in [('法人', 'fund/T86', {'selectType': 'ALLBUT0999'}, parse_net), ('融資', 'exchangeReport/MI_MARGN', {'selectType': 'ALL'}, parse_margin)]:
            try:
                obj = request(route, dt.date.fromisoformat(date), extra)
                if obj is None:
                    raise ValueError('source has no data')
                for code, values in parser(obj).items():
                    result.setdefault(code, {}).update({k:v for k,v in values.items() if v is not None})
            except Exception as exc:
                warnings.append(f'{date} {name}：{exc}')
        print(f'Research source checked {date}: {len(result)} stocks', flush=True)
        return date, result
    with ThreadPoolExecutor(max_workers=3) as pool:
        daily = dict(pool.map(day, dates))
    changed = 0
    for stock in snapshot['stocks']:
        path = ROOT/'data/history'/(stock['code']+'.json')
        if not path.exists():
            continue
        value = json.loads(path.read_text())
        modified = False
        for r in value['history']:
            patch = daily.get(r['date'], {}).get(stock['code'], {})
            if patch and any(r.get(k) != v for k,v in patch.items()):
                r.update(patch)
                modified = True
        if modified:
            atomic(path, value)
            changed += 1
        by_date = {r['date']:r for r in value['history']}
        for r in stock['history']:
            if r['date'] in by_date:
                r.update(by_date[r['date']])
    snapshot['researchUpdatedAt'] = at
    atomic(ROOT/'data/stocks.json', snapshot)
    future_path = ROOT/'data/research-futures.json'
    saved = json.loads(future_path.read_text()) if future_path.exists() else {'items': []}
    try:
        req = urllib.request.Request('https://openapi.taifex.com.tw/v1/DailyMarketReportFut', headers={'Accept': 'application/json', 'User-Agent': 'TWStockSearch/3.0'})
        with urllib.request.urlopen(req, timeout=45) as response:
            rows = json.load(response)
        metadata = json.loads((ROOT/'scripts/futures-metadata.json').read_text())
        items = parse_futures(rows, metadata, at)
        if not items:
            raise ValueError('No valid official futures rows')
        for old in saved['items']:
            current = items.get(old['id'])
            if current:
                merged = {r['date']:r for r in old['rows']}
                merged.update({r['date']:r for r in current['rows']})
                current['rows'] = sorted(merged.values(), key=lambda r:r['date'])[-1600:]
            else:
                items[old['id']] = old
        saved = {'items': list(items.values()), 'checkedAt': at, 'errors': [], 'notice': '每個契約與時段分開累積日資料；更早歷史可匯入 CSV。期貨法人未接入，融資不適用。'}
    except Exception as exc:
        saved['errors'] = [f'期貨來源本次未更新，保留舊快照：{exc}']
        warnings.extend(saved['errors'])
    atomic(future_path, saved)
    atomic(status_path, {'checkedAt': at, 'start': dates[0] if dates else None, 'end': dates[-1] if dates else None, 'changedStocks': changed, 'targetTradingDays':130, 'warnings': warnings, 'foreignDefinition': '外陸資（不含外資自營商）淨買賣超＋外資自營商淨買賣超，單位股', 'marginDefinition': '融資今日餘額－融資前日餘額，單位張'})
    print(f'Research: {changed} histories updated; {len(warnings)} source warnings')


if __name__ == '__main__':
    main()
