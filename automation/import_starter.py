"""
Manually submit the verified starter guides to Cloudflare D1 via the Worker ingestion API.
All manual_import guides must arrive as REVIEW and need admin approval.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = os.getenv("TRIPCAUTION_API_URL", "").rstrip("/")
TOKEN = os.getenv("TRIPCAUTION_INGEST_TOKEN", "")

def main():
    if not ENDPOINT.startswith("https://") or not TOKEN:
        print("Configure TRIPCAUTION_API_URL and TRIPCAUTION_INGEST_TOKEN first.",file=sys.stderr)
        return 2
    package = json.loads((ROOT / "content" / "starter-guides.json").read_text(encoding="utf-8"))
    if package.get("site") != "TripCaution" or not package.get("articles"):
        print("Starter import data failed structure check.",file=sys.stderr)
        return 2
    for article in package["articles"]:
        if article.get("publishing",{}).get("mode") != "manual_import":
            print("Refusing non-manual article in starter import.",file=sys.stderr)
            return 2
        if len(article.get("research",{}).get("sources",[])) < 2:
            print("Insufficient source references.",file=sys.stderr)
            return 2
    body = json.dumps({"articles": package["articles"]}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT + "/api/ingest", data=body, method="POST",
        headers={"Content-Type":"application/json","Authorization":"Bearer "+TOKEN})
    try:
        with urllib.request.urlopen(req,timeout=35) as response:
            result=json.load(response)
    except urllib.error.HTTPError as exc:
        # Do not log URL or bearer token
        if exc.code == 503:
            print("TripCaution ingestion token or D1 database is not configured.",file=sys.stderr)
        else:
            print("Import request failed with HTTP",exc.code,file=sys.stderr)
        return 1
    rows=result.get("results",[])
    if len(rows)!=len(package["articles"]):
        print("Unexpected ingestion response.",file=sys.stderr)
        return 1
    for row in rows:
        print(row.get("title") or "<unknown>", ":", row.get("status") if row.get("ok") else row.get("error"))
        if row.get("ok") and row.get("status")!="review":
            print("SAFETY FAILURE: Manual import unexpectedly bypassed review.",file=sys.stderr)
            return 1
    failed=[r for r in rows if not r.get("ok")]
    if failed:
        print("Please review failed entries (duplicate slugs are not re-imported).",file=sys.stderr)
        return 1
    print("Starter guides imported as REVIEW. Approve publication individually in /admin.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
