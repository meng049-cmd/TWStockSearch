import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from update_data import publish_histories, number

class HistoryTests(unittest.TestCase):
    def test_separate_full_history_from_homepage(self):
        rows=[{'date':(dt.date(2021,1,1)+dt.timedelta(days=i)).isoformat(),'close':100+i} for i in range(50)]
        with tempfile.TemporaryDirectory() as directory:
            summaries=publish_histories({'2330':{'code':'2330','name':'test','history':rows}},Path(directory))
            full=json.loads((Path(directory)/'2330.json').read_text())
            self.assertEqual(full['history'],rows)
            self.assertEqual(summaries[0]['history'],rows[-30:])
            self.assertEqual(summaries[0]['historyStart'],rows[0]['date'])
            self.assertEqual(summaries[0]['historyEnd'],rows[-1]['date'])
            self.assertEqual(summaries[0]['historyUrl'],'data/history/2330.json')
    def test_invalid_path_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):publish_histories({'../x':{'history':[]}},Path(directory))
    def test_nonfinite_not_price(self):
        self.assertIsNone(number('NaN'));self.assertIsNone(number('Infinity'))

if __name__=='__main__':unittest.main()
