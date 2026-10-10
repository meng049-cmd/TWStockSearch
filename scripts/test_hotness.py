import unittest
from hotness import rank_hotstocks, percentiles, rank_groups

class HotnessTests(unittest.TestCase):
    def make_stock(self, code, volume, amount):
        return {'code':code,'history':[{'date':f'2026-09-{i:02d}','volume':volume if i==25 else 100,'turnover':amount if i>20 else 1000} for i in range(1,26)]}

    def test_correct_baselines(self):
        stock=self.make_stock('A',300,2000)
        r=rank_hotstocks([stock],{'A':{'已發行普通股數或TDR原股發行股數':'1,000'}},'2026-09-25')['A']
        self.assertEqual(r['relativeVolume'],3)
        self.assertEqual(r['amountAcceleration'],100)
        self.assertEqual(r['turnoverRate'],30)
        self.assertEqual(r['score'],50)

    def test_ties(self):
        self.assertEqual(percentiles({'a':1,'b':1,'c':3}),{'a':25,'b':25,'c':100})

    def test_missing_not_zero(self):
        s=self.make_stock('A',300,2000);s['history'][5].pop('volume')
        r=rank_hotstocks([s],{'A':{'已發行普通股數或TDR原股發行股數':1000}},'2026-09-25')['A']
        self.assertIsNone(r['score']);self.assertIn('relativeVolume',r['missing'])

    def test_reference_calendar(self):
        a=self.make_stock('A',300,2000);b=self.make_stock('B',200,1500);a['history'].pop(4)
        records=rank_hotstocks([a,b],{c:{'已發行普通股數或TDR原股發行股數':1000} for c in ['A','B']},'2026-09-25')
        self.assertIsNone(records['A']['score']);self.assertIsNotNone(records['B']['score'])

    def test_group_missing_not_ranked(self):
        groups=[{'name':'A','turnover':100,'codes':['1']},{'name':'B','turnover':200,'codes':['2']}]
        out=rank_groups(groups,{'1':{'score':80},'2':{'score':None}})
        self.assertEqual(out[0]['name'],'A');self.assertIsNone(out[1]['heatScore'])

    def test_larger_inputs_raise_score(self):
        a=self.make_stock('A',300,2000);b=self.make_stock('B',100,1000)
        r=rank_hotstocks([a,b],{c:{'已發行普通股數或TDR原股發行股數':1000} for c in ['A','B']},'2026-09-25')
        self.assertEqual(r['A']['score'],100);self.assertEqual(r['B']['score'],0)

if __name__=='__main__':unittest.main()
