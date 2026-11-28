import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from sync_research import parse_margin
from sync_stock_metrics import date,num,quote_row,historical_quotes,daytrade_report,parse_otc_chip_report
class MetricsTests(unittest.TestCase):
 def test_dates_quotes_and_missing(self):
  self.assertEqual(date('1151030'),'2026-10-30');self.assertIsNone(num(''));self.assertEqual(num('0'),0)
  row={'Date':'1151030','SecuritiesCompanyCode':'6488','Open':'100','High':'110','Low':'99','Close':'105','TradingShares':'100,000','TransactionAmount':'10000000'}
  self.assertEqual(quote_row(row,'TPEX')['volume'],100000)
 def test_historical_date_mismatch_is_not_saved(self):
  with self.assertRaises(ValueError):historical_quotes({'stat':'ok','date':'20261030','tables':[]},'2026-10-01')
 def test_daytrade_counts_are_per_stock_not_whole_market(self):
  obj={'date':'20261030','tables':[{'fields':['證券代號','當日沖銷交易成交股數'],'data':[['2330','10,000']]}]}
  self.assertEqual(daytrade_report(obj,'2026-10-30')['2330']['dayTradeShares'],10000)
 def test_twse_margin_prefixed_fields(self):
  obj={'tables':[{'fields':['股票代號','股票名稱','融資買進','融資賣出','融資現金償還','融資前日餘額','融資今日餘額','融資限額'],'data':[['2330','台積電','1','2','0','100','120','1000']]}]}
  self.assertEqual(parse_margin(obj)['2330']['marginBalance'],120)
  self.assertEqual(parse_margin(obj)['2330']['marginChange'],20)
 def test_margin_balance_is_distinct_from_daily_change(self):
  obj={'tables':[{'fields':['代號','前資餘額(張)','資餘額'],'data':[['6488','100','120']]}]}
  result=parse_otc_chip_report(obj,'margin')['6488'];self.assertEqual(result['marginBalance'],120);self.assertEqual(result['marginChange'],20)
