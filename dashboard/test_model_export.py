import tempfile
import unittest
from pathlib import Path
import build_dashboard

class ModelExportTest(unittest.TestCase):
    def test_export_retains_model_scope_and_uncertainty(self):
        # Dropping uncertainty or using odds ratios as probabilities breaks this contract.
        self.assertTrue(hasattr(build_dashboard, 'load_model_results'), 'Saved model export is not implemented')
        results=build_dashboard.load_model_results(Path(__file__).resolve().parent.parent)
        self.assertEqual(len(results['probabilities']),4)
        reading=next(r for r in results['probabilities'] if r['subject']=='Reading' and r['fall_group']=='Fall Below')
        self.assertAlmostEqual(reading['probability'],.7076379818)
        self.assertLess(reading['ci_low'],reading['probability'])
        self.assertGreater(reading['ci_high'],reading['probability'])
        adjusted=next(r for r in results['attendance'] if r['subject']=='Reading' and r['model']=='Model 2')
        self.assertAlmostEqual(adjusted['estimate'],-.1992410321)
        self.assertEqual(results['samples'][0]['fall_below_rows'],1690)
        self.assertEqual(results['years'],[2024,2025,2026])
        self.assertEqual(results['absence_increment_pp'],5)
    def test_missing_exports_do_not_silently_show_stale_models(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(hasattr(build_dashboard, 'load_model_results'), 'Saved model export is not implemented')
            with self.assertRaises(FileNotFoundError):build_dashboard.load_model_results(Path(d))

if __name__=='__main__':unittest.main()
