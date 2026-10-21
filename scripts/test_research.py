import unittest
from sync_research import parse_net, parse_margin, parse_futures, official_date

class ResearchDataTests(unittest.TestCase):
    def test_net_and_gross_are_distinct(self):
        fields=['證券代號','外陸資買進股數(不含外資自營商)','外陸資買賣超股數(不含外資自營商)','外資自營商買賣超股數','投信買賣超股數','自營商買賣超股數']
        parsed=parse_net({'fields':fields,'data':[['2330','9000','1,500','-200','-300','0'],['1326','9000','--','0','100','20']]})
        self.assertEqual(parsed['2330'],{'foreignNet':1300,'trustNet':-300,'dealerNet':0})
        self.assertIsNone(parsed['1326']['foreignNet'])

    def test_margin_uses_first_balance_pair_and_keeps_lot_units(self):
        fields=['代號','名稱','買進','賣出','現金償還','前日餘額','今日餘額','次一營業日限額','買進','賣出','現券償還','前日餘額','今日餘額']
        parsed=parse_margin({'fields':fields,'data':[['2330','台積電','0','0','0','1,000','980','9000','0','0','0','100','300']]})
        self.assertEqual(parsed['2330']['marginChange'],-20)

    def test_futures_separate_contracts_and_sessions(self):
        base={'Date':'20261020','Contract':'TX','ContractMonth(Week)':'202611','TradingSession':'一般','Open':'100','High':'102','Low':'99','Last':'101','Volume':'200','OpenInterest':'300'}
        rows=[base,{**base,'TradingSession':'盤後'},{**base,'ContractMonth(Week)':'202612'},{**base,'Last':'--'}]
        result=parse_futures(rows,{},'now')
        self.assertEqual(len(result),3)
        self.assertEqual(result['future:TX:202611:一般']['rows'][0]['volume'],200)
        self.assertIsNone(result['future:TX:202611:一般']['rows'][0]['margin'])
        self.assertEqual(official_date('115/10/20'),'2026-10-20')

if __name__=='__main__':
    unittest.main()
