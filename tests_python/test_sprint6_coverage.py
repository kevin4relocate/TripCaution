import unittest
from collections import Counter
from automation.coverage import (
 COUNTRIES,BRIEFS,FIRST_PASS,TOPIC_COUNTS,choose_slot,slot_coverage,
 coverage_summary
)

class Sprint6EditorialCoverageTests(unittest.TestCase):
 def test_full_matrix_is_eighty_eight_distinct_research_questions(self):
  self.assertEqual(len(COUNTRIES),11)
  self.assertEqual(len(BRIEFS),8)
  self.assertEqual(len({b[0] for b in BRIEFS}),8)
  self.assertEqual(sum(TOPIC_COUNTS.values()),8)
  self.assertEqual(TOPIC_COUNTS['scams-theft'],2)
  self.assertEqual(TOPIC_COUNTS['transport'],2)
  self.assertEqual(len(FIRST_PASS)*len(COUNTRIES),33)
  self.assertEqual(len(BRIEFS)*len(COUNTRIES),88)

 def test_first_pass_covers_all_eleven_before_repeat(self):
  rows=[]
  countries=[]
  for day in range(40):
   selected=choose_slot(rows,1,day)
   self.assertIsNotNone(selected)
   country,(slot,category,brief)=selected
   self.assertIn(slot,FIRST_PASS)
   rows.append({'country':country,'title':country+slot,'category_id':category,
                'status':'review','tags':['sprint6:'+slot]})
   countries.append(country)
  self.assertEqual(len(set(countries[:11])),11)
  self.assertEqual(choose_slot(rows,1,44),None)

 def test_second_phase_is_separate_explicit_opt_in(self):
  first=[{'country':c,'category_id':cat,'status':'published',
          'tags':['sprint6:'+slot]}
         for c in COUNTRIES
         for slot,cat,_ in BRIEFS if slot in FIRST_PASS]
  self.assertIsNone(choose_slot(first,1,0))
  summary=coverage_summary(first,2)
  self.assertTrue(all(row['queued_or_live_slots']==3 and row['target']==8
                      for row in summary.values()))
  self.assertIsNotNone(choose_slot(first,2,0))
  self.assertRaises(ValueError,choose_slot,first,3,0)

 def test_deleted_and_hidden_rows_do_not_count_as_completed(self):
  rows=[
   {'country':'Laos','category_id':'transport','status':'deleted',
    'tags':['sprint6:transport-arrival']},
   {'country':'Laos','category_id':'scams-theft','status':'hidden',
    'tags':['sprint6:scams-common']},
   {'country':'Laos','category_id':'safety-health','status':'review',
    'tags':['sprint6:safety']}
  ]
  covered=slot_coverage(rows)
  self.assertEqual(covered['Laos'],{'safety'})

 def test_older_category_records_count_conservatively_without_rewriting(self):
  rows=[
   {'country':'Vietnam','category_id':'tourist-traps','status':'published'},
   {'country':'Vietnam','category_id':'transport','status':'published'},
   {'country':'Vietnam','category_id':'before-you-go','status':'review'},
   {'country':'Vietnam','category_id':'transport','status':'published'},
   {'country':'Vietnam','category_id':'transport','status':'published'}
  ]
  covered=slot_coverage(rows)['Vietnam']
  self.assertEqual(covered,{'scams-common','transport-arrival','transport-onward','essentials'})
  self.assertNotIn('safety',covered)

 def test_tagged_slot_does_not_double_count_legacy_category(self):
  rows=[
   {'country':'Singapore','category_id':'transport','status':'review',
    'tags_json':'["sprint6:transport-arrival"]'},
   {'country':'Singapore','category_id':'transport','status':'published'}
  ]
  self.assertEqual(slot_coverage(rows)['Singapore'],{'transport-arrival','transport-onward'})

 def test_unrecognized_country_and_malicious_tag_cannot_create_fake_coverage(self):
  rows=[
   {'country':'unknown','status':'published','category_id':'scams-theft',
    'tags':['sprint6:scams-common']},
   {'country':'Brunei','status':'review','category_id':'transport',
    'tags_json':'not json'},
   {'country':'Brunei','status':'review','category_id':'transport',
    'tags':['sprint6:invented-topic']}
  ]
  self.assertNotIn('invented-topic',slot_coverage(rows)['Brunei'])
  self.assertEqual(slot_coverage(rows)['Brunei'],{'transport-arrival'})

if __name__=='__main__':
 unittest.main()
