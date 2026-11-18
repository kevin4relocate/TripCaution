"""Safely seed seven unique Southeast Asia destination guides as private REVIEW drafts.

This manual workflow NEVER publishes or upgrades an existing article.
It is idempotent: pre-existing slugs are skipped, not overwritten.
"""
import json, os, sys, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/"content"/"prelaunch-seven-country-gap-pack.json"
COUNTRIES={"Brunei","Cambodia","Indonesia","Laos","Malaysia","Myanmar","Philippines"}

def validate_package(pack):
    rows=pack.get("articles")
    if pack.get("site")!="TripCaution" or not isinstance(rows,list) or len(rows)!=7:
        raise ValueError("Exactly seven TripCaution review manuscripts required.")
    if {r.get("country") for r in rows}!=COUNTRIES:
        raise ValueError("Unexpected country inventory.")
    if len({r.get("slug") for r in rows})!=len(rows):
        raise ValueError("Duplicate slugs in seed pack.")
    for row in rows:
        if row.get("publishing",{}).get("mode")!="manual_import" or row.get("auto_publish") is True:
            raise ValueError("No auto-publish is permitted in manual gap pack.")
        if len(row.get("content_markdown","").split())<350:
            raise ValueError("Gap manuscripts require meaningful article depth.")
        sources=row.get("research",{}).get("sources",[])
        if len(sources)<2:
            raise ValueError("At least two source links are required.")
        if any(urlparse(s.get("url","")).scheme!="https" for s in sources):
            raise ValueError("All research references must be HTTPS.")
    return rows

def request(endpoint,token,method="GET",payload=None):
    body=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(endpoint,method=method,data=body,headers={
        "Content-Type":"application/json",
        "Authorization":"Bearer "+token,
        "User-Agent":"Mozilla/5.0 (compatible; TripCaution-Review-Pack/1.0)"
    })
    with urllib.request.urlopen(req,timeout=60) as response:
        return json.load(response)

def main():
    site=os.getenv("TRIPCAUTION_API_URL","").rstrip("/")
    token=os.getenv("TRIPCAUTION_INGEST_TOKEN","")
    if not site.startswith("https://") or len(token)<32:
        print("Production URL and secure ingest token required.",file=sys.stderr)
        return 2
    rows=validate_package(json.loads(PACK.read_text(encoding="utf-8")))
    # A read before the POST prevents known duplicates on repeated runs. The
    # ingestion API ALSO rejects any concurrent duplicate server-side.
    overview=request(site+"/api/ingest/topics",token)
    existing={item.get("slug") for item in overview.get("titles",[]) if item.get("slug")}
    pending=[row for row in rows if row["slug"] not in existing]
    print("Seven-country pack: already present",len(rows)-len(pending),"to import",len(pending))
    if not pending:
        print("Nothing new to import. Existing statuses are left unchanged.")
        return 0
    response=request(site+"/api/ingest",token,"POST",{"articles":pending})
    results=response.get("results",[])
    if len(results)!=len(pending):
        print("Unexpected partial import response; check Admin before retrying.",file=sys.stderr)
        return 1
    failed=[]
    for row in results:
        title=row.get("title","untitled")
        if not row.get("ok") or row.get("status")!="review":
            failed.append(title)
        print(title,":",row.get("status") if row.get("ok") else "failed")
    if failed:
        print("Import incomplete or unexpected status; no auto-publication occurred.",file=sys.stderr)
        return 1
    print("New manuscripts are in private REVIEW. Owner controls publication.")
    return 0

if __name__=="__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print("API request failed: HTTP",e.code,"(secrets omitted).",file=sys.stderr)
        sys.exit(1)
