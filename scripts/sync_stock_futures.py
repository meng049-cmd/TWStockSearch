"""Fetch TAIFEX stock-futures underlyings. Official response validation is pending network access."""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://openapi.taifex.com.tw/v1/SingleStockFuturesTradingInfo'
CODE_FIELDS = ('UnderlyingSecurityCode', 'StockCode', 'SecurityCode', '標的證券代號', '證券代號', '股票代號', '股票代碼', '標的證券代碼')

def parse_codes(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty or unexpected official stock-futures response')
    codes = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Unexpected official stock-futures row')
        values = {str(row[key]).strip() for key in CODE_FIELDS if key in row}
        if len(values) != 1:
            raise ValueError('Unrecognized or ambiguous underlying security code fields')
        code = values.pop()
        if len(code) != 4 or not code.isdigit():
            raise ValueError('Unsupported underlying code format; preserve previous list')
        codes.add(code)
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
