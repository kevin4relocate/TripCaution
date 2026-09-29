import unittest
from unittest.mock import patch
from automation import daily

class FakeResponse:
    headers={'Content-Type':'text/html'}
    def __init__(self,url,body):
        self.url=url
        self.body=body
    def __enter__(self):return self
    def __exit__(self,*_):return False
    def geturl(self):return self.url
    def read(self,_):return ('<html><main><p>'+self.body+'</p></main></html>').encode()

class FakeOpener:
    def open(self,request,timeout=12):
        url=request.full_url
        return FakeResponse(url,
            'The operator publishes current pickup instructions for arriving passengers.' if 'operator-a' in url else
            'This operator publishes payment and pickup instructions for passengers.')

def draft():
    a='https://operator-a.example.org/info'
    b='https://operator-b.example.net/guide'
    return {'research':{
        'sources':[{'url':a},{'url':b}],
        'claim_evidence':[
            {'claim':'Check arrival directions','source_url':a,
             'evidence_excerpt':'The operator publishes current pickup instructions for arriving passengers.'},
            {'claim':'Check payment instructions','source_url':b,
             'evidence_excerpt':'This operator publishes payment and pickup instructions for passengers.'}
        ]
    }}

class AutoEvidencePreflightTests(unittest.TestCase):
    def test_fetches_each_citation_and_matches_literal_source_excerpts(self):
        obj=draft()
        with patch('socket.getaddrinfo',return_value=[(None,None,None,None,('1.1.1.1',443))]), \
             patch('urllib.request.build_opener',return_value=FakeOpener()):
            ok=daily.verify_claim_evidence(obj)
        self.assertTrue(ok)
        self.assertTrue(obj['research']['source_check_passed'])
        self.assertTrue(all(x['source_checked'] for x in obj['research']['claim_evidence']))
    def test_does_not_publish_mismatched_source_quotes(self):
        obj=draft()
        obj['research']['claim_evidence'][1]['evidence_excerpt']='This is an invented quotation absent from the source.'
        with patch('socket.getaddrinfo',return_value=[(None,None,None,None,('1.1.1.1',443))]), \
             patch('urllib.request.build_opener',return_value=FakeOpener()):
            ok=daily.verify_claim_evidence(obj)
        self.assertFalse(ok)
        self.assertNotIn('source_check_passed',obj['research'])
    def test_rejects_private_destinations_before_network_access(self):
        obj=draft()
        with patch('socket.getaddrinfo',return_value=[(None,None,None,None,('127.0.0.1',443))]), \
             patch('urllib.request.build_opener',return_value=FakeOpener()):
            self.assertFalse(daily.verify_claim_evidence(obj))

if __name__=='__main__':
    unittest.main()
