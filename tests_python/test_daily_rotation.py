import unittest
from automation.daily import TOPICS, choose_first_pass_topic

class RegionalRotationTests(unittest.TestCase):
    def test_all_eleven_are_present_exactly_once(self):
        countries=[t[0] for t in TOPICS]
        self.assertEqual(len(countries),11)
        self.assertEqual(len(set(countries)),11)
        for country in ('Myanmar','Laos','Cambodia','Philippines','Timor-Leste'):
            self.assertIn(country,countries)

    def test_missing_country_comes_before_repeating_existing(self):
        existing=[{'country':'Vietnam','title':'Old Vietnam guide'},
                  {'country':'Singapore','title':'Old Singapore guide'},
                  {'country':'Thailand','title':'Old Thailand guide'}]
        for day in range(1,30):
            selected=choose_first_pass_topic(TOPICS,existing,day)
            self.assertNotIn(selected[0],('Vietnam','Singapore','Thailand'))

    def test_case_and_whitespace_normalization(self):
        existing=[{'country':row[0].upper()+' '} for row in TOPICS[:-1]]
        self.assertEqual(choose_first_pass_topic(TOPICS,existing,2)[0],'Vietnam')

    def test_stop_after_every_country_has_one_non_deleted_entry(self):
        existing=[{'country':row[0],'status':'review'} for row in TOPICS]
        self.assertIsNone(choose_first_pass_topic(TOPICS,existing,1))

    def test_skipped_missing_countries_remain_in_rotation(self):
        existing=[{'country':row[0]} for row in TOPICS if row[0] not in ('Laos','Myanmar')]
        values={choose_first_pass_topic(TOPICS,existing,day)[0] for day in range(1,12)}
        self.assertEqual(values,{'Laos','Myanmar'})

if __name__=='__main__':
    unittest.main()
