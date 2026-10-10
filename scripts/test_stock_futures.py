import unittest
from sync_stock_futures import parse_codes

def row(code, kind='上市普通股標的證券', contract='CDF'):
    return {'StockCode':code,'Type':kind,'Contract':contract}

class FuturesParserTests(unittest.TestCase):
    def test_standard_mini_deduplicated_and_otc_included(self):
        self.assertEqual(parse_codes([row('2330'),row('2330',contract='QFF'),row('6488','上櫃普通股標的證券')]),['2330','6488'])
    def test_etfs_excluded_including_official_blank_type_debt_etf(self):
        self.assertEqual(parse_codes([row('2330'),row('0050','上市ETF標的證券'),row('00679B','')]),['2330'])
    def test_missing_empty_invalid_and_unknown_stock_type_rejected(self):
        for data in [[],{},[{'Contract':'CDF'}],[row('2330','')],[row('1000.0')],[row('2330','新種類')],[row('0050','上市ETF標的證券')]]:
            with self.subTest(data=data), self.assertRaises(ValueError):parse_codes(data)

if __name__=='__main__':unittest.main()
