import importlib.util
from pathlib import Path
import unittest

import pandas as pd

HERE = Path(__file__).parent

class DashboardExportTest(unittest.TestCase):
    def test_export_links_pairs_to_context_without_student_identifiers(self):
        # Losing the student-year join or serializing source IDs breaks this contract.
        module_path = HERE / 'build_dashboard.py'
        self.assertTrue(module_path.exists(), 'Dashboard export is not implemented yet')
        spec = importlib.util.spec_from_file_location('build_dashboard', module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        context = pd.DataFrame([
            dict(student_id=98765,school_year=2026,school_id=101,school_name='Cedar Ridge Elementary',grade_level=0,
                 english_learner_flag=True,economically_disadvantaged_flag=False,special_education_flag=False,
                 enrolled_instructional_days=100,absent_days=5,entry_date='2025-09-01',exit_date='2026-06-01'),
            dict(student_id=98765,school_year=2025,school_id=101,school_name='Cedar Ridge Elementary',grade_level=0,
                 english_learner_flag=True,economically_disadvantaged_flag=False,special_education_flag=False,
                 enrolled_instructional_days=100,absent_days=10,entry_date='2024-09-01',exit_date='2025-06-01'),
        ])
        pairs = pd.DataFrame([dict(student_id=98765,school_year=2026,subject='Reading',fall_score=0,spring_score=20,
            fall_performance_level='Below Benchmark',spring_performance_level='At Benchmark',
            between_test_eligible_days=80,between_test_absent_days=3)])
        participation = pd.DataFrame([dict(student_id=98765,school_year=2026,subject='Reading',
            fall_opportunity=True,spring_opportunity=True)])
        payload = module.build_payload(context,pairs,participation)
        self.assertEqual(payload['pairs'][0][0],0)
        self.assertEqual(payload['pairs'][0][2:4],[0,20])
        self.assertEqual(payload['context'][0][1],payload['context'][1][1])
        self.assertNotIn('98765', str(payload))
        self.assertEqual(payload['pairs'][0][8:10],[1,1])

if __name__ == '__main__':
    unittest.main()
