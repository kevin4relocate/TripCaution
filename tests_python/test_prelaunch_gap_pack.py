import json, unittest
from pathlib import Path
from automation.import_review_pack import validate_package, PACK, COUNTRIES

class GapPackTests(unittest.TestCase):
    def setUp(self):
        self.pack=json.loads(PACK.read_text(encoding="utf-8"))
    def test_exactly_seven_missing_countries_with_full_editorial_articles(self):
        rows=validate_package(self.pack)
        self.assertEqual({r["country"] for r in rows},COUNTRIES)
        for row in rows:
            self.assertGreaterEqual(len(row["content_markdown"].split()),350)
            self.assertTrue(all(s["url"].startswith("https://") for s in row["research"]["sources"]))
            self.assertEqual(row["publishing"]["requested_status"],"review_before_publication")
            self.assertNotIn("auto_publish",row)
    def test_seed_refuses_automatic_publication_and_duplicate_slugs(self):
        broken=json.loads(json.dumps(self.pack))
        broken["articles"][0]["auto_publish"]=True
        with self.assertRaises(ValueError):validate_package(broken)
        broken=json.loads(json.dumps(self.pack))
        broken["articles"][0]["slug"]=broken["articles"][1]["slug"]
        with self.assertRaises(ValueError):validate_package(broken)

if __name__=="__main__":
    unittest.main()
