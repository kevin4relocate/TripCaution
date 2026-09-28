import json
import unittest
from unittest.mock import patch
from automation import daily

class SafeWorkerUserAgentTests(unittest.TestCase):
 def test_our_worker_get_uses_declared_client_and_keeps_bearer(self):
  captured=[]
  class Fake:
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self):return b'{"titles":[],"upcoming":0}'
  def fake_open(req,timeout):
   captured.append(req)
   return Fake()
  with patch.object(daily,"SITE","https://tripcaution.example"),patch(
   "urllib.request.urlopen",side_effect=fake_open):
   result=daily.request_json("https://tripcaution.example/api/ingest/topics",
                             headers={"Authorization":"Bearer private-do-not-print"})
  self.assertEqual(result["titles"],[])
  self.assertIn("TripCaution-API-Connectivity-Check",captured[0].get_header("User-agent"))
  self.assertEqual(captured[0].get_header("Authorization"),"Bearer private-do-not-print")

 def test_external_research_provider_does_not_inherit_worker_user_agent(self):
  requests=[]
  class Fake:
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self):return b'{"candidates":[]}'
  def fake_open(req,timeout):
   requests.append(req)
   return Fake()
  with patch.object(daily,"SITE","https://tripcaution.example"),patch(
    "urllib.request.urlopen",side_effect=fake_open):
   daily.request_json("https://generativelanguage.googleapis.com/v1beta/test",
                      {"contents":[]})
  self.assertNotIn("User-agent",requests[0].headers)

if __name__=="__main__":
 unittest.main()
