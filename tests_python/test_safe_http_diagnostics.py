import contextlib
import io
import unittest
import urllib.error
from unittest.mock import patch
from automation import daily

class SafeHTTPDiagnosticsTests(unittest.TestCase):
 def test_ingest_403_reports_cf_ray_but_not_bearer_token(self):
  fake=urllib.error.HTTPError(
   daily.SITE+"/api/ingest/topics" if daily.SITE else "https://test.example/api/ingest/topics",
   403,"Forbidden",
   {"Server":"cloudflare","CF-Ray":"example-ray","Content-Type":"text/html"},
   None)
  with patch.object(daily,"SITE","https://test.example"):
   with patch("urllib.request.urlopen",side_effect=fake):
    capture=io.StringIO()
    with contextlib.redirect_stderr(capture):
     with self.assertRaises(urllib.error.HTTPError):
      daily.request_json("https://test.example/api/ingest/topics",
                         headers={"Authorization":"Bearer never-print-this-key"})
    log=capture.getvalue()
    self.assertIn("TripCaution API /api/ingest/topics",log)
    self.assertIn("403",log)
    self.assertIn("example-ray",log)
    self.assertNotIn("never-print-this-key",log)
    self.assertNotIn("Bearer",log)

if __name__=="__main__":
 unittest.main()
