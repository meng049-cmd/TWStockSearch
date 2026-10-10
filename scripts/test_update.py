import unittest
from update_data import parse_prices, parse_buys

class ParserTests(unittest.TestCase):
    def test_new_prices(self):
        self.assertEqual(parse_prices({'tables':[{'fields':['證券代號','證券名稱','收盤價'], 'data':[['2330','台積電','1,000.00'],['9999','暫停','--']]}]}),{'2330':('台積電',1000)})
    def test_legacy_prices(self):
        self.assertEqual(parse_prices({'fields9':['證券代號','證券名稱','收盤價'],'data9':[['2330','台積電','100']]}),{'2330':('台積電',100)})
    def test_gross_buys(self):
        response={'fields':['證券代號','外陸資買進股數(不含外資自營商)','投信買進股數','投信買賣超股數'],'data':[['2330','1,000','500','-100']]}
        self.assertEqual(parse_buys(response)['2330'],{'foreignBuy':1000,'trustBuy':500})
    def test_schema_fail(self):
        with self.assertRaises(RuntimeError):
            parse_prices({'tables':[]})

if __name__ == '__main__':
    unittest.main()
