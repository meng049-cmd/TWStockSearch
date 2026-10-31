"""Synchronize stock-specific official disclosures without market ranking code."""
import datetime as dt
import json
import os
import re
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap04_L'
def parse(rows, checked):
    result = []
    for row in rows:
        code, title = str(row.get('公司代號', '')).strip(), str(row.get('主旨', '')).strip()
        raw = re.sub(r'\D', '', str(row.get('發言日期', '')))
        if not re.fullmatch(r'\d{4,6}', code) or not title or len(raw) != 7:
            continue
        try:
            date = dt.date(int(raw[:3])+1911, int(raw[3:5]), int(raw[5:7])).isoformat()
            time = re.sub(r'\D', '', str(row.get('發言時間', ''))).zfill(6)
            published = date+'T'+time[:2]+':'+time[2:4]+':'+time[4:6]+'+08:00'
            dt.datetime.fromisoformat(published)
        except ValueError:
            continue
        result.append({'code': code, 'title': title, 'source': '公開資訊觀測站重大訊息',
                       'publishedAt': published, 'url': URL, 'checkedAt': checked})
    return result

def main():
    path = ROOT/'data/announcements.json'
    checked = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat()
    try:
        req = urllib.request.Request(URL, headers={'User-Agent': 'TWStockSearch/4.0'})
        with urllib.request.urlopen(req, timeout=35) as response:
            rows = json.load(response)
        if not isinstance(rows, list):
            raise ValueError('Invalid official disclosure response')
        items = parse(rows, checked)
        # Retain up to fourteen days so stocks without today's disclosures remain searchable.
        previous = json.loads(path.read_text()).get('items', []) if path.exists() else []
        cutoff = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=14)).isoformat()
        combined = {(x['code'], x['publishedAt'], x['title']): x for x in previous+items
                    if x.get('publishedAt', '') >= cutoff}
        value = {'checkedAt': checked, 'items': sorted(combined.values(), key=lambda x:x['publishedAt'], reverse=True)}
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
        os.replace(temp, path)
        print(f'Synchronized {len(items)} official disclosures')
    except Exception as exc:
        print(f'Disclosure update failed; previous snapshot retained: {exc}')
if __name__ == '__main__':
    main()
