import unittest
from unittest.mock import patch
from automation import daily

class SourceBreadthTests(unittest.TestCase):
 def test_timor_leste_curated_pool_includes_original_local_authority(self):
  from pathlib import Path
  import json
  directory=json.loads((Path(daily.__file__).parent/"sources.json").read_text())
  refs=directory["Timor-Leste"]
  self.assertEqual(len(refs),3)
  self.assertIn("https://timorleste.tl/plan-your-trip",refs)
  self.assertEqual(len(refs),len(set(refs)))

 def test_three_readable_sites_count_separately_without_auto_attaching_claims(self):
  class FakeResponse:
   status=200
   headers={"Content-Type":"text/html"}
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self,n):
    return ("<main><h1>Original official page</h1><p>"+
            "Visitor guidance with detailed arrival information. "*18+
            "</p></main>").encode()
  with patch("urllib.request.urlopen",return_value=FakeResponse()):
   text, refs=daily.curated_research("Timor-Leste")
  self.assertEqual(len(refs),3)
  self.assertIn("Timor-Leste Ministry of Tourism and Environment",
                [r["publisher"] for r in refs])
  self.assertIn("https://timorleste.tl/plan-your-trip",text)
  # Availability of three documents is NOT proof any two corroborate
  # a specific claim. The article-level manual evidence gate remains.
 
if __name__=="__main__":
 unittest.main()
