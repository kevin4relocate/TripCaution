import unittest
from unittest.mock import patch
from automation import daily

class PrelaunchResearchVolumeTests(unittest.TestCase):
    def test_default_three_distinct_research_attempts_even_before_auto_publish(self):
        with patch.object(daily,'DAILY_TARGET',3),patch.object(daily,'AUTO_PUBLISH',False), \
             patch.object(daily,'run_one',side_effect=[True,True,True]) as run:
            daily.main()
        self.assertEqual([x.args for x in run.call_args_list],[(0,),(1,),(2,)])
    def test_stops_when_source_evidence_or_queue_fails(self):
        with patch.object(daily,'DAILY_TARGET',3),patch.object(daily,'run_one',side_effect=[True,False]) as run:
            daily.main()
        self.assertEqual(run.call_count,2)

if __name__=='__main__':
    unittest.main()
