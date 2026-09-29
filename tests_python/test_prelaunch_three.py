import unittest
from unittest.mock import patch
from automation import daily

class PrelaunchResearchVolumeTests(unittest.TestCase):
    def test_default_three_distinct_research_attempts_even_before_auto_publish(self):
        with patch.object(daily,'DAILY_TARGET',3),patch.object(daily,'AUTO_PUBLISH',False), \
             patch.object(daily,'run_one',side_effect=[True,True,True]) as run:
            daily.main()
        self.assertEqual([x.args for x in run.call_args_list],[(0,),(1,),(2,)])
    def test_weak_candidate_does_not_waste_the_daily_target(self):
        with patch.object(daily,'DAILY_TARGET',3),patch.object(daily,'MAX_DAILY_ATTEMPTS',6), \
             patch.object(daily,'run_one',side_effect=[True,False,True,False,True]) as run:
            daily.main()
        self.assertEqual(run.call_count,5)
        self.assertEqual([x.args for x in run.call_args_list],[(0,),(1,),(2,),(3,),(4,)])
    def test_attempt_budget_stops_repeated_failures(self):
        with patch.object(daily,'DAILY_TARGET',3),patch.object(daily,'MAX_DAILY_ATTEMPTS',4), \
             patch.object(daily,'run_one',return_value=False) as run:
            daily.main()
        self.assertEqual(run.call_count,4)

if __name__=='__main__':
    unittest.main()
