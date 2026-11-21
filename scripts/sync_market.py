"""Synchronize official market data only. No news feeds are requested."""
import datetime as dt
import json
import os
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TZ_TAIPEI=dt.timezone(dt.timedelta(hours=8))
def update_market_review() -> dict:
    """Keep official index/chip responses separate, retaining their own dates."""
    datasets = []
    for name, endpoint in [
        ("加權指數歷史收盤", "indicesReport/MI_5MINS_HIST"),
        ("三大法人買賣金額（元）", "fund/BFI82U"),
    ]:
        url = "https://openapi.twse.com.tw/v1/" + endpoint
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "TWStockSearch/1.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                rows = json.load(response)
            if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
                raise ValueError("invalid official market response")
            datasets.append({"name": name, "url": url, "rows": rows})
        except Exception as exc:
            datasets.append({"name": name, "url": url, "rows": [], "error": str(exc)[:160]})
    return {"checkedAt": dt.datetime.now(TZ_TAIPEI).isoformat(), "datasets": datasets}



def main():
    path=ROOT/'data/market-review.json'
    value=update_market_review()
    # Preserve each last successful dataset if its official source is unavailable.
    previous=json.loads(path.read_text()) if path.exists() else {}
    for item in value['datasets']:
        if not item.get('rows'):
            cached=next((d for d in previous.get('datasets',[]) if d['name']==item['name']),None)
            if cached:
                item['rows']=cached.get('rows',[])
                item['retainedFrom']=cached.get('checkedAt') or previous.get('checkedAt')
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')));os.replace(temp,path)
if __name__=='__main__': main()
