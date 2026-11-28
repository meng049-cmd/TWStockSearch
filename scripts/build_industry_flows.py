#!/usr/bin/env python3
"""Build daily industry level institutional net flow data for the browser charts."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METRICS = ROOT / "data" / "stock-metrics.json"
HISTORY_DIRS = (ROOT / "data" / "history", ROOT / "data" / "otc-history")
OUTPUT = ROOT / "data" / "industry-flows.json"

INDUSTRY_NAMES = {
    "01": "水泥工業", "02": "食品工業", "03": "塑膠工業", "04": "紡織纖維",
    "05": "電機機械", "06": "電器電纜", "08": "玻璃陶瓷", "09": "造紙工業",
    "10": "鋼鐵工業", "11": "橡膠工業", "12": "汽車工業", "14": "建材營造",
    "15": "航運業", "16": "觀光餐旅", "17": "金融保險", "18": "貿易百貨",
    "20": "其他電子業", "21": "化學工業", "22": "生技醫療", "23": "油電燃氣",
    "24": "半導體業", "25": "電腦及週邊設備業", "26": "光電業", "27": "通信網路業",
    "28": "電子零組件業", "29": "電子通路業", "30": "資訊服務業", "31": "其他電子業",
    "32": "文化創意業", "33": "農業科技業", "34": "電子商務業", "35": "綠能環保業",
    "36": "數位雲端", "37": "運動休閒", "38": "居家生活", "91": "存託憑證",
}
FLOW_FIELDS = {
    "foreign": "foreignNet",
    "trust": "trustNet",
    "dealer": "dealerNet",
    "financing": "marginChange",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result == result and abs(result) != float("inf") else None


def financing_change(row):
    change = number(row.get("marginChange"))
    if change is not None:
        return change
    balance, previous = number(row.get("marginBalance")), number(row.get("marginPrevious"))
    return balance - previous if balance is not None and previous is not None else None


def flow_shares(key, value):
    # Official financing balances and changes are lots; institutional net flows are shares.
    return value * 1000 if key == "financing" else value


def main() -> None:
    metric_rows = load_json(METRICS).get("stocks", [])
    industries = {}
    for stock in metric_rows:
        code = str(stock.get("code", "")).strip()
        industry = str(stock.get("industry", "")).strip()
        if code and industry:
            industries[code] = industry.zfill(2)

    sectors = defaultdict(lambda: {"codes": set(), "dates": defaultdict(lambda: {
        "sampleCount": 0,
        "foreignTotal": 0.0, "foreignCount": 0,
        "trustTotal": 0.0, "trustCount": 0,
        "dealerTotal": 0.0, "dealerCount": 0,
        "financingTotal": 0.0, "financingCount": 0,
    })})
    all_dates = set()
    seen_codes = set()

    for directory in HISTORY_DIRS:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            code = path.stem
            industry = industries.get(code)
            if not industry:
                continue
            try:
                history = load_json(path).get("history", [])
            except (OSError, json.JSONDecodeError):
                continue
            # Keep one bar per stock and date if a source file has a duplicate.
            by_date = {}
            for row in history:
                date = str(row.get("date", ""))
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                    by_date[date] = row
            if not by_date:
                continue
            sector = sectors[industry]
            sector["codes"].add(code)
            seen_codes.add(code)
            for date, row in by_date.items():
                record = sector["dates"][date]
                record["sampleCount"] += 1
                has_flow = False
                balance = number(row.get("marginBalance"))
                if balance is not None:
                    record["financingBalanceTotal"] = record.get("financingBalanceTotal", 0) + balance
                    record["financingBalanceCount"] = record.get("financingBalanceCount", 0) + 1
                for key, source_field in FLOW_FIELDS.items():
                    value = financing_change(row) if key == "financing" else number(row.get(source_field))
                    if value is not None:
                        shares = flow_shares(key, value)
                        record[key + "Total"] += shares / 1000
                        record[key + "Count"] += 1
                        price = number(row.get("close"))
                        if price is not None and price > 0:
                            record[key + "Amount"] = record.get(key + "Amount", 0) + shares * price
                            record[key + "AmountCount"] = record.get(key + "AmountCount", 0) + 1
                        has_flow = True
                if has_flow:
                    all_dates.add(date)

    result_sectors = []
    for code in sorted(sectors):
        sector = sectors[code]
        rows = []
        for date, record in sorted(sector["dates"].items()):
            if not any(record[key + "Count"] for key in FLOW_FIELDS):
                continue
            output = {"date": date, "sampleCount": record["sampleCount"]}
            balance_count = record.get("financingBalanceCount", 0)
            output["financingBalance"] = round(record["financingBalanceTotal"], 2) if balance_count else None
            output["financingBalanceCount"] = balance_count
            for key in FLOW_FIELDS:
                count = record[key + "Count"]
                output[key] = round(record[key + "Total"], 2) if count else None
                output[key + "Count"] = count
                amount_count = record.get(key + "AmountCount", 0)
                output[key + "Amount"] = round(record[key + "Amount"], 2) if amount_count else None
                output[key + "AmountCount"] = amount_count
            rows.append(output)
        result_sectors.append({
            "code": code,
            "name": INDUSTRY_NAMES.get(code, "產業 " + code),
            "stockCount": len(sector["codes"]),
            "rows": rows,
        })

    result = {
        "version": 1,
        "latestDate": max(all_dates) if all_dates else None,
        "dates": sorted(all_dates),
        "stockCount": len(seen_codes),
        "sectors": result_sectors,
        "method": "外資、投信、自營商原始淨額為股，financing為融資餘額增減張數，financingBalance為融資餘額張數。Amount逐股乘當日收盤價估算市值（元）；融資先將張乘1000換成股，非實際融資借款金額。混合來源可能重疊，為訊號合計。缺值不補零。",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Built {OUTPUT.relative_to(ROOT)}: {len(result_sectors)} industries, {len(all_dates)} dates, {len(seen_codes)} stocks")


if __name__ == "__main__":
    main()
