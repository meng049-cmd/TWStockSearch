"""Refresh the public OTC name/code directory; preserve the prior snapshot on failure."""
import csv
import datetime as dt
import io
import json
import os
from pathlib import Path
import re
import urllib.request
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://raw.githubusercontent.com/mlouielu/twstock/dev/twstock/codes/tpex_equities.csv'
def main():
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent':'TWStockSearch/4.0'}), timeout=30) as response:
            rows = list(csv.DictReader(io.StringIO(response.read().decode('utf-8-sig'))))
        stocks = [{'code':r['code'], 'name':r['name'], 'exchange':'TPEX'} for r in rows
                  if re.fullmatch(r'\d{4}', r.get('code','')) and r.get('name')]
        if len(stocks) < 500 or len({s['code'] for s in stocks}) != len(stocks):
            raise ValueError('Unexpected OTC catalog; refusing to replace valid directory')
        path = ROOT/'assets/otc-symbols.json'
        value = {'source':URL, 'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
                 'notice':'代號目錄不代表行情保證；近期掛牌可能尚未涵蓋。', 'stocks':stocks}
        temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',',':')));os.replace(temp,path)
        print(f'Synchronized {len(stocks)} OTC symbols')
    except Exception as exc:
        print(f'OTC directory update failed; prior directory retained: {exc}')
if __name__ == '__main__':
    main()
