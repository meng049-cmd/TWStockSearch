import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('industry_builder', Path(__file__).resolve().parents[1] / 'scripts/build_industry_flows.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class FinancingUnits(unittest.TestCase):
    def test_financing_lots_are_converted_to_shares_before_valuation(self):
        self.assertEqual(builder.flow_shares('financing', 2) * 50, 100000)
        self.assertEqual(builder.flow_shares('foreign', 2) * 50, 100)
        self.assertEqual(builder.flow_shares('financing', -3), -3000)

    def test_balance_change_preserves_zero_missing_and_actual_previous_balance(self):
        self.assertEqual(builder.financing_change({'marginChange': 0}), 0)
        self.assertEqual(builder.financing_change({'marginBalance': 50, 'marginPrevious': 80}), -30)
        self.assertEqual(builder.financing_change({'marginChange': 5, 'marginBalance': 50, 'marginPrevious': 80}), 5)
        self.assertIsNone(builder.financing_change({'marginBalance': 50}))
        self.assertIsNone(builder.financing_change({}))
