import unittest
from sync_stock_futures import parse_codes

class FuturesParserTests(unittest.TestCase):
    def test_deduplicates_contracts_by_underlying(self):
        self.assertEqual(parse_codes([{'UnderlyingSecurityCode':'2330'},{'UnderlyingSecurityCode':'2330'},{'UnderlyingSecurityCode':'2317'}]),['2317','2330'])
    def test_explicit_chinese_underlying_field(self):
        self.assertEqual(parse_codes([{'標的證券代號':'2330'}]),['2330'])
    def test_missing_empty_invalid_and_ambiguous_source_rejected(self):
        for data in [[],{},[{'Contract':'CDF'}],[{'StockCode':'2330','SecurityCode':'2317'}],[{'StockCode':'1000.0'}]]:
            with self.subTest(data=data), self.assertRaises(ValueError):parse_codes(data)

if __name__=='__main__':unittest.main()
