import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from sync_stock_futures import parse_codes
from update_data import parse_prices
from sync_research import parse_margin
from sync_market import update_market_review
import datetime as dt
class SourceTests(unittest.TestCase):
    def test_official_futures_underlyings_cover_both_exchanges(self):
        rows=[{'StockCode':'2330','Type':'上市普通股標的證券','Contract':'CD'},
              {'StockCode':'6488','Type':'上櫃普通股標的證券','Contract':'AB'},
              {'StockCode':'0050','Type':'上市ETF標的證券','Contract':'XX'}]
        self.assertEqual(parse_codes(rows),['2330','6488'])
        with self.assertRaises(ValueError):
            parse_codes([{'StockCode':'1234','Type':'未知','Contract':'ZZ'}])
    def test_new_price_day_refreshes_flows_despite_recent_check(self):
        import json
        import tempfile
        from unittest.mock import patch
        import sync_research
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'data/history').mkdir(parents=True)
            row = {'date':'2026-11-11', 'close':100}
            (root/'data/stocks.json').write_text(json.dumps({'stocks':[{'code':'2330','history':[row]}]}))
            history = root/'data/history/2330.json'
            history.write_text(json.dumps({'history':[row]}))
            (root/'data/research-status.json').write_text(json.dumps({'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'end':'2026-11-10'}))
            with patch.object(sync_research, 'ROOT', root), patch.object(sys, 'argv', ['sync_research.py']), patch.object(sync_research, 'request', return_value={}), patch.object(sync_research, 'parse_net', return_value={'2330':{'foreignNet':200}}), patch.object(sync_research, 'parse_margin', return_value={'2330':{'marginChange':10}}):
                sync_research.main()
            updated = json.loads(history.read_text())['history'][0]
            self.assertEqual(updated['foreignNet'],200)
            self.assertEqual(updated['marginChange'],10)

    def test_price_schema(self):
        obj={'tables':[{'fields':['證券代號','證券名稱','收盤價'],'data':[['2330','台積電','1,000.00']]}]}
        self.assertEqual(parse_prices(obj)['2330'],('台積電',1000))
    def test_market_source_failure_has_explicit_empty_data(self):
        from unittest.mock import patch
        with patch('urllib.request.urlopen',side_effect=OSError('offline')):
            result=update_market_review()
        self.assertEqual(len(result['datasets']),2)
        self.assertTrue(all(not item['rows'] and item.get('error') for item in result['datasets']))
if __name__=='__main__': unittest.main()
