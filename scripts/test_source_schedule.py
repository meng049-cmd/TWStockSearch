import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from sync_sources import company_snapshot

class SourceScheduleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'companies.json'
        self.now = dt.datetime(2026, 10, 10, 8, 30, tzinfo=dt.timezone(dt.timedelta(hours=8)))
        self.rows = [{'公司代號':'2330','產業別':'24','已發行普通股數或TDR原股發行股數':'1000','出表日期':'1151010'}]
    def seed(self):
        with patch('sync_sources.get', return_value=self.rows):
            company_snapshot(self.path, self.now)
    def test_hourly_reuses_snapshot_with_original_fetch_time(self):
        self.seed()
        with patch('sync_sources.get') as get:
            rows, checked = company_snapshot(self.path, self.now+dt.timedelta(hours=3))
        get.assert_not_called()
        self.assertEqual(rows, self.rows)
        self.assertEqual(checked, self.now.isoformat())
    def test_next_four_hour_window_refreshes(self):
        self.seed()
        next_window = self.now.replace(hour=12)
        with patch('sync_sources.get', return_value=self.rows) as get:
            _, checked = company_snapshot(self.path, next_window)
        get.assert_called_once()
        self.assertEqual(checked, next_window.isoformat())
    def test_manual_refresh_bypasses_cache(self):
        self.seed()
        with patch('sync_sources.get', return_value=self.rows) as get:
            company_snapshot(self.path, self.now+dt.timedelta(hours=1), force=True)
        get.assert_called_once()
    def test_failed_or_empty_refresh_keeps_previous_snapshot(self):
        self.seed()
        before = self.path.read_bytes()
        for response in [[], [{}]]:
            with patch('sync_sources.get', return_value=response), self.assertRaises(RuntimeError):
                company_snapshot(self.path, self.now+dt.timedelta(hours=4))
            self.assertEqual(self.path.read_bytes(), before)
        with patch('sync_sources.get', side_effect=RuntimeError('Unavailable')), self.assertRaises(RuntimeError):
            company_snapshot(self.path, self.now+dt.timedelta(hours=4))
        self.assertEqual(self.path.read_bytes(), before)

if __name__=='__main__':
    unittest.main()
