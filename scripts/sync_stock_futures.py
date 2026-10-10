"""Fetch TAIFEX stock-futures underlyings. Validated against the official SSFLists schema."""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://openapi.taifex.com.tw/v1/SSFLists'
ORDINARY_TYPES = {'上市普通股標的證券', '上櫃普通股標的證券'}

def parse_codes(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty or unexpected official stock-futures response')
    codes = set()
    for row in rows:
        if not isinstance(row, dict) or any(field not in row for field in ['StockCode','Type','Contract']):
            raise ValueError('Official SSFLists schema changed; preserve previous list')
        code, kind = str(row['StockCode']).strip(), str(row['Type']).strip()
        if kind == '上市ETF標的證券':
            continue
        # Official debt ETF rows currently have an empty Type and six-character codes.
        if kind == '' and code.startswith('0') and len(code) == 6 and code[:-1].isdigit() and code[-1] == 'B':
            continue
        if kind not in ORDINARY_TYPES or len(code) != 4 or not code.isdigit():
            raise ValueError('Unsupported underlying type/code; preserve previous list')
        codes.add(code)
    if not codes:
        raise ValueError('No ordinary stock underlyings in official response')
    return sorted(codes)

def main(force=False):
    path = ROOT/'data/stock-futures.json'
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    previous = json.loads(path.read_text()) if path.exists() else {}
    if previous.get('status') == 'ok' and previous.get('source') == SOURCE and not force:
        checked = dt.datetime.fromisoformat(previous['checkedAt'])
        if checked.tzinfo and checked <= now and int(checked.timestamp())//14400 == int(now.timestamp())//14400:
            print('Stock-futures list reused within four-hour window')
            return
    request = urllib.request.Request(SOURCE, headers={'User-Agent':'TWStockSearch/1.0','Accept':'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        codes = parse_codes(json.load(response))
    result = {'status':'ok','source':SOURCE,'checkedAt':now.isoformat(),'refreshEveryHours':4,'codes':codes}
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, separators=(',',':')))
    os.replace(temp,path)
    print(f'Synced {len(codes)} stock-futures underlying codes')

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--force', action='store_true')
    main(parser.parse_args().force or os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch')
