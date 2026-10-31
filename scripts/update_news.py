#!/usr/bin/env python3
"""Fetch headline-only market news RSS into a GitHub Pages snapshot."""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "news.json"
TZ_TAIPEI = dt.timezone(dt.timedelta(hours=8))
MAX_AGE = dt.timedelta(days=14)


def google_feed(query: str, locale: str = "en-US", region: str = "US", edition: str = "US:en") -> str:
    params = urllib.parse.urlencode({"q": query, "hl": locale, "gl": region, "ceid": edition})
    return "https://news.google.com/rss/search?" + params


FEEDS = [
    {"id": "tw-industries", "category": "sectors", "name": "台股個股新聞", "url": google_feed("台股 個股 企業 when:7d", "zh-TW", "TW", "TW:zh-Hant")},
    {"id": "world-finance", "category": "global", "name": "國際股市中文新聞", "url": google_feed("國際股市 美股 歐股 日股 when:7d", "zh-TW", "TW", "TW:zh-Hant")},
    {"id": "economic-data", "category": "economy", "name": "最新財經新聞", "url": google_feed("最新 財經 經濟 金融 when:7d", "zh-TW", "TW", "TW:zh-Hant")},
]



class _TextOnly(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def clean_text(value: str | None) -> str:
    parser = _TextOnly()
    parser.feed(value or "")
    return re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()


def _child_text(node: ET.Element, names: tuple[str, ...]) -> str:
    for child in list(node):
        tag = child.tag.rsplit("}", 1)[-1].lower()
        if tag in names and child.text:
            return clean_text(child.text)
    return ""


def _item_date(node: ET.Element) -> dt.datetime | None:
    raw = _child_text(node, ("pubdate", "published", "updated", "date"))
    if not raw:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)
        except ValueError:
            return None


def parse_feed(xml_bytes: bytes, feed: dict, now: dt.datetime | None = None) -> list[dict]:
    """Extract only headline metadata and publisher links; discard feed descriptions."""
    now = now or dt.datetime.now(dt.timezone.utc)
    root = ET.fromstring(xml_bytes)
    items = root.findall(".//item")
    if not items:
        items = root.findall(".//{*}entry")
    results = []
    for item in items:
        title = _child_text(item, ("title",))
        if not title:
            continue
        link = _child_text(item, ("link",))
        if not link:
            for child in list(item):
                if child.tag.rsplit("}", 1)[-1].lower() == "link":
                    link = child.attrib.get("href", "")
                    if child.attrib.get("rel", "alternate") == "alternate":
                        break
        if not link:
            continue
        published = _item_date(item)
        if published and now.astimezone(dt.timezone.utc) - published > MAX_AGE:
            continue
        source = feed.get("source") or _child_text(item, ("source", "creator", "author")) or feed["name"]
        source_url = feed.get("sourceUrl", "")
        for child in list(item):
            if child.tag.rsplit("}", 1)[-1].lower() == "source":
                source_url = child.attrib.get("url", source_url)
        key = re.sub(r"\W+", " ", title.lower()).strip() + "|" + (published.date().isoformat() if published else "")
        results.append({
            "id": hashlib.sha1(key.encode("utf-8")).hexdigest()[:16],
            "title": title[:300],
            "url": link,
            "source": source[:100],
            "sourceUrl": source_url,
            "publishedAt": published.isoformat().replace("+00:00", "Z") if published else None,
            "category": feed["category"],
            "feedId": feed["id"],
        })
    return results


_IMPACT_GROUPS = [
    (3, ("戰爭", "war", "military conflict", "台海", "taiwan strait", "制裁", "sanction", "關稅", "tariff", "出口管制", "export control", "晶片禁令", "chip ban")),
    (2, ("聯準會", "federal reserve", "fomc", "fed rate", "fed holds", "fed cuts", "利率決策", "rate decision", "央行", "central bank", "cpi", "pce", "通膨", "inflation", "非農", "nonfarm payroll", "payroll", "就業數據", "employment report", "employment situation", "unemployment", "jobless claims", "consumer prices", "producer prices", "personal income", "gdp", "原油", "oil price", "oil shock", "金融危機", "bank crisis")),
    (1, ("公債殖利率", "treasury yield", "債券殖利率", "bond yield", "匯率", "currency", "美元", "dollar", "信用風險", "credit risk", "ai server", "半導體", "semiconductor")),
]


def impact_score(item: dict) -> int:
    title = item.get("title", "").casefold()
    score = sum(weight for weight, words in _IMPACT_GROUPS if any(word.casefold() in title for word in words))
    if item.get("feedId") in {"bls-official", "bea-official", "fed-official"}:
        score += 1
    return min(score, 6)


def _dedupe(items: list[dict]) -> list[dict]:
    unique = {}
    for item in items:
        key = item.get("url") or item["id"]
        if key not in unique:
            item["impactScore"] = impact_score(item)
            item["impact"] = "高度關注" if item["impactScore"] >= 3 else "市場觀察"
            unique[key] = item
    return sorted(unique.values(), key=lambda x: x.get("publishedAt") or "", reverse=True)


def _load_previous() -> dict:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _fetch(feed: dict) -> bytes:
    req = urllib.request.Request(feed["url"], headers={"User-Agent": "TWStockSearch-NewsBot/1.0 (+https://github.com/meng049-cmd/TWStockSearch)"})
    with urllib.request.urlopen(req, timeout=18) as response:
        return response.read(3_000_000)


def build_snapshot(fetcher=_fetch, now: dt.datetime | None = None, previous: dict | None = None) -> dict:
    now = now or dt.datetime.now(TZ_TAIPEI)
    previous = previous or {}
    old_categories = previous.get("categories", {})
    fetched_by_feed: dict[str, list[dict]] = {}
    failed = []
    success_count = 0
    for feed in FEEDS:
        try:
            parsed = parse_feed(fetcher(feed), feed, now.astimezone(dt.timezone.utc))
            fetched_by_feed[feed["id"]] = parsed
            success_count += 1
        except Exception as exc:  # Individual public RSS feeds can fail without blocking the rest.
            failed.append({"id": feed["id"], "name": feed["name"], "error": str(exc)[:180]})

    if success_count == 0 and previous:
        raise RuntimeError("all configured news feeds failed; preserving the last published snapshot")

    categories: dict[str, list[dict]] = {key: [] for key in ("sectors", "global", "usMarkets", "economy", "major")}
    for feed in FEEDS:
        category = feed["category"]
        if category == "majorCandidates":
            continue
        if feed["id"] in fetched_by_feed:
            categories[category].extend(fetched_by_feed[feed["id"]])
        else:
            # Keep this feed's previous headlines until a request succeeds.
            categories[category].extend(x for x in old_categories.get(category, []) if x.get("feedId") == feed["id"])

    categories["sectors"] = _dedupe(categories["sectors"])[:24]
    categories["global"] = _dedupe(categories["global"])[:24]
    categories["usMarkets"] = _dedupe(categories["usMarkets"])[:24]
    categories["economy"] = _dedupe(categories["economy"])[:30]
    candidates = []
    candidates.extend(categories["global"])
    candidates.extend(categories["usMarkets"])
    candidates.extend(categories["economy"])
    candidates.extend(categories["sectors"])
    # The dedicated query is explicitly about cross-industry/global market events.
    candidates.extend(fetched_by_feed.get("global-watch", []))
    candidates.extend(x for x in old_categories.get("major", []) if x.get("feedId") == "global-watch" and "global-watch" in {f["id"] for f in FEEDS if f["id"] not in fetched_by_feed})
    major = _dedupe([x for x in candidates if x.get("impactScore", impact_score(x)) >= 2 or x.get("feedId") == "global-watch"])
    categories["major"] = major[:24]

    source_records = [{"id": f["id"], "name": f["name"], "ok": f["id"] in fetched_by_feed, "url": f["url"]} for f in FEEDS]
    return {
        "version": 1,
        "generatedAt": now.astimezone(TZ_TAIPEI).isoformat(timespec="seconds"),
        "refreshEveryMinutes": 60,
        "headlineOnly": True,
        "categories": categories,
        "sources": source_records,
        "staleFeeds": failed,
        "notice": "僅整理標題、來源、時間與原文連結；重大關注標籤依標題關鍵字篩選，請開啟原文核對。",
    }


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



def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    market_review = update_market_review()
    previous = _load_previous()
    try:
        snapshot = build_snapshot(previous=previous)
    except RuntimeError as exc:
        print(f"news update skipped: {exc}", file=sys.stderr)
        return 0
    snapshot["marketReview"] = market_review
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {key: len(value) for key, value in snapshot["categories"].items()}
    print(json.dumps({"updatedAt": snapshot["generatedAt"], "counts": counts, "staleFeeds": snapshot["staleFeeds"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
