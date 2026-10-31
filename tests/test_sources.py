import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from sync_announcements import parse
from update_data import parse_prices
from sync_research import parse_margin
from update_news import build_snapshot, FEEDS
import datetime as dt
class SourceTests(unittest.TestCase):
    def test_disclosure_identity_and_date(self):
        rows=[{'公司代號':'2330','主旨':'測試公告','發言日期':'1151029','發言時間':'093001'}]
        item=parse(rows,'checked')[0]
        self.assertEqual(item['code'],'2330')
        self.assertEqual(item['publishedAt'],'2026-10-29T09:30:01+08:00')
    def test_price_schema(self):
        obj={'tables':[{'fields':['證券代號','證券名稱','收盤價'],'data':[['2330','台積電','1,000.00']]}]}
        self.assertEqual(parse_prices(obj)['2330'],('台積電',1000))
    def test_chinese_feeds_and_failure_retention(self):
        self.assertTrue(all('zh-TW' in f['url'] for f in FEEDS))
        def fail(feed): raise OSError('offline')
        with self.assertRaises(RuntimeError):
            build_snapshot(fetcher=fail,previous={'categories':{'global':[]}})
if __name__=='__main__': unittest.main()
