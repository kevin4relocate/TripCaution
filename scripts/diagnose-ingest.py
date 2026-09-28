"""Safe preflight for GitHub-to-Cloudflare 403 diagnosis.
Print only response status, Cloudflare Ray and content type. No request
authorization headers, tokens, response bodies or client IP addresses.
"""
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse

site=os.environ.get("TRIPCAUTION_API_URL", "").strip().rstrip("/")
token=os.environ.get("TRIPCAUTION_INGEST_TOKEN", "").strip()
if not site.startswith("https://") or not token:
    raise SystemExit("Site URL or ingest token missing; no network probes attempted")

def probe(label, path, authenticated=False, browser_ua=False):
    headers={"Accept": "application/json" if path.startswith("/api") else "text/html"}
    if authenticated:
        headers["Authorization"]="Bearer "+token
    if browser_ua:
        headers["User-Agent"]="Mozilla/5.0 (compatible; TripCaution-API-Connectivity-Check/1.0)"
    req=urllib.request.Request(site+path,headers=headers,method="GET")
    try:
        with urllib.request.urlopen(req,timeout=12) as r:
            status=r.status
            hs=r.headers
    except urllib.error.HTTPError as err:
        status,hs=err.code,err.headers
    except Exception as err:
        print(label, "network error type:",type(err).__name__)
        return None
    print(label,"HTTP",status,
          "server:",str(hs.get("Server","unknown"))[:32],
          "content-type:",str(hs.get("Content-Type","unknown"))[:65],
          "cf-ray:",str(hs.get("CF-Ray","none"))[:80])
    return status

home=probe("public homepage","/")
anonymous=probe("anonymous ingest GET (expected 401)","/api/ingest/topics")
authorized=probe("authorized ingest GET (expected 200)","/api/ingest/topics",True)
browser=probe("browser-like anonymous ingest GET (expected 401)","/api/ingest/topics",False,True)
browser_authenticated=probe("browser-like authorized ingest GET (expected 200)","/api/ingest/topics",True,True)
if anonymous==403 and browser==401 and browser_authenticated==200:
    print("Diagnosis: default Python HTTP client is filtered; same-site authenticated request with declared application UA reaches TripCaution.")
elif anonymous==403 and browser==401 and browser_authenticated==401:
    print("Diagnosis: declared client reaches API but supplied ingest token is rejected. Verify both token values match.")
elif anonymous==403 and browser==401 and browser_authenticated==403:
    print("Diagnosis: declared client reaches public API but authorization request is blocked. Investigate Cloudflare filtering of Authorization requests.")
elif home==403 and anonymous==403:
    print("Diagnosis: default GitHub Python client filtered upstream; test declared UA with and without authorization before changing access policy.")
elif anonymous==401 and authorized==401:
    print("Diagnosis: ingress reaches app, but token is invalid; confirm both configured secret values match.")
elif anonymous==401 and authorized==403:
    print("Diagnosis: auth header or authenticated caller may be blocked upstream; inspect Cloudflare access/security.")
elif authorized==200:
    print("Diagnosis: authenticated fetch works in preflight; examine differences between subsequent requests.")
else:
    print("Diagnosis inconclusive; use CF-Ray IDs and status combinations. No secrets have been printed.")
