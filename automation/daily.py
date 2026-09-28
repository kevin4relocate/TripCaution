"""
TripCaution free-tier-aware daily research automation.
Requires search-grounded Gemini quota for the configured model.
Defaults to fail closed: no fabricated links, no automatic publication of higher-risk content.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
import urllib.error
import urllib.request
import urllib.parse
from datetime import datetime, timezone
if __package__:
    from .coverage import COUNTRIES, BRIEFS, FIRST_PASS, COUNTRY_NOTES, choose_slot, coverage_summary
else:
    from coverage import COUNTRIES, BRIEFS, FIRST_PASS, COUNTRY_NOTES, choose_slot, coverage_summary

API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite"
RESEARCH_MODE = os.getenv("TRIPCAUTION_RESEARCH_MODE") or "curated"
CONTENT_PHASE = int(os.getenv("TRIPCAUTION_CONTENT_PHASE") or "1")
MAX_REVIEW_BACKLOG = 6 # Never flood the owner with unchecked AI research
SITE = os.getenv("TRIPCAUTION_API_URL", "").rstrip("/")
TOKEN = os.getenv("TRIPCAUTION_INGEST_TOKEN", "")

# One distinct country/topic per rotation; all 11 Southeast Asian countries
# are included before expansion. Ingestion never bypasses owner review.
TOPICS = [
    ("Brunei", "before-you-go", "What a first-time visitor should verify about airport arrival, transport and official entry guidance for their own passport"),
    ("Cambodia", "transport", "Official arrival and onward ground-transport questions at Phnom Penh or Siem Reap, including current airport information"),
    ("Indonesia", "before-you-go", "Before departing for Indonesia: city-specific arrival, local transport and official visitor requirements"),
    ("Laos", "transport", "How to check official transport options and booking conditions for arriving in Vientiane"),
    ("Malaysia", "transport", "What to confirm about Kuala Lumpur airport ground transfers, tickets and official service updates"),
    ("Myanmar", "before-you-go", "How travelers should interpret dated official warnings and consular assistance limitations; do not create tourism itineraries"),
    ("Philippines", "before-you-go", "How first-time visitors can locate authoritative official arrival notices and carrier-specific airport transfer information"),
    ("Singapore", "transport", "Which official operator pages answer first-time airport and contactless transit payment questions"),
    ("Thailand", "transport", "How to verify Bangkok airport ground-transport pickup points and published fare rules with official operators"),
    ("Timor-Leste", "before-you-go", "Planning with authoritative official arrival, transport and insurance advice; qualify all passport-specific statements"),
    ("Vietnam", "transport", "First airport pickup in Vietnam: terminal-specific official pickup notices and fare-check steps")
]

def choose_first_pass_topic(topics, existing_rows, day_of_year):
    """Research countries lacking ANY existing non-deleted article before revisiting others.

    Creating drafts is not publication. After all 11 countries have at least
    one queued/reviewed/live article, stop and let the owner approve coverage.
    The server's topics endpoint excludes Deleted rows.
    """
    present = {
        str(row.get("country") or "").strip().casefold()
        for row in existing_rows
        if isinstance(row, dict) and str(row.get("country") or "").strip()
    }
    missing = [topic for topic in topics if topic[0].casefold() not in present]
    if not missing:
        return None
    return missing[(int(day_of_year) - 1) % len(missing)]

def request_json(url, payload=None, headers=None, timeout=110):
    data=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(url,data=data,headers=headers or {"Content-Type":"application/json"},method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req,timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as err:
        # Log only safe troubleshooting metadata: never print the authorization
        # header, request payload, response body or Gemini key-bearing URL.
        stage = ("TripCaution API " + urllib.parse.urlparse(url).path
                 if url.startswith(SITE + "/") else "research provider")
        print("Request failed:", stage, "HTTP", err.code,
              "server:", str(err.headers.get("Server", "unknown"))[:50],
              "content-type:", str(err.headers.get("Content-Type", "unknown"))[:65],
              "cf-ray:", str(err.headers.get("CF-Ray", "none"))[:75],
              file=sys.stderr)
        raise

def api_request(prompt, grounding=False):
    tools={"tools":[{"google_search":{}}]} if grounding else {}
    body={"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.35},**tools}
    data=request_json("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent?key="+API_KEY,body)
    candidate=data.get("candidates",[{}])[0]
    text="".join(p.get("text","") for p in candidate.get("content",{}).get("parts",[]) if "text" in p)
    chunks=candidate.get("groundingMetadata",{}).get("groundingChunks",[])
    refs=[{"title":c["web"].get("title","Source"),"url":c["web"].get("uri",""),"publisher":c["web"].get("title","Source")}
          for c in chunks if c.get("web",{}).get("uri","").startswith("https://")]
    # Google grounding links may be redirects; article-level source checks are still required.
    return text,refs

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
        self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","noscript","svg"):
            self.skip+=1
        if tag in ("h1","h2","h3","p","li"):
            self.parts.append("\n")
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript","svg") and self.skip:
            self.skip-=1
    def handle_data(self,data):
        if not self.skip:
            self.parts.append(data)

def curated_research(country):
    directory=json.loads((Path(__file__).parent/"sources.json").read_text())
    urls=directory.get(country,[])
    collected=[]
    source_refs=[]
    for url in urls:
        try:
            req=urllib.request.Request(url,headers={
                "User-Agent":"TripCaution editorial reference research (+https://tripcaution.com/about)",
                "Accept":"text/html"})
            with urllib.request.urlopen(req,timeout=18) as res:
                if "text/html" not in res.headers.get("Content-Type",""):
                    raise ValueError("Source did not return HTML")
                page=res.read(500_000).decode("utf-8",errors="replace")
            main=re.search(r"<main\b[^>]*>(.*?)</main>",page,flags=re.I|re.S)
            extract=TextExtractor();extract.feed(main.group(1) if main else page)
            content=re.sub(r"\s+"," "," ".join(extract.parts)).strip()[:11500]
            if len(content)<550:
                print("Official source had insufficient readable content:",url)
                continue
            collected.append("SOURCE "+url+"\n"+content)
            publisher="UK Foreign, Commonwealth & Development Office" if "gov.uk" in url else "Government of Canada"
            source_refs.append({"title":country+" travel advice","publisher":publisher,"url":url,"published_at":None})
        except Exception as e:
            print("Could not read curated source",url,type(e).__name__)
    return "\n\n".join(collected),source_refs

def read_json(text):
    clean=re.sub(r"^\s*```(?:json)?|```\s*$","",text.strip(),flags=re.IGNORECASE).strip()
    try:return json.loads(clean)
    except json.JSONDecodeError:
        start=clean.find("{");end=clean.rfind("}")
        if start<0 or end<=start:raise
        return json.loads(clean[start:end+1])

def main():
    if not all([API_KEY,SITE,TOKEN]):
        print("Missing GitHub secrets or variables; no content generated.",file=sys.stderr);sys.exit(2)
    if not SITE.startswith("https://"):
        raise ValueError("TRIPCAUTION_API_URL must use HTTPS")
    existing=request_json(SITE+"/api/ingest/topics",None,{"Authorization":"Bearer "+TOKEN},timeout=25)
    if existing.get("upcoming",0)>=2:
        print("Upcoming owner-scheduled articles fill the near-term queue; skip.")
        return
    existing_rows=existing.get("titles",[])
    open_review=sum(row.get("status") in ("review", "draft") for row in existing_rows)
    if open_review >= MAX_REVIEW_BACKLOG:
        print("Owner review backlog:",open_review,"; skip creating further unverified drafts.")
        return
    old_titles=[row.get("title","") for row in existing_rows]
    now=datetime.now(timezone.utc)
    if CONTENT_PHASE not in (1,2):
        raise ValueError("TRIPCAUTION_CONTENT_PHASE must be 1 or 2")
    selected=choose_slot(existing_rows,CONTENT_PHASE,now.timetuple().tm_yday)
    if selected is None:
        print("Sprint 6 phase",CONTENT_PHASE,"has no open research slots.")
        print("This counts drafts as work in progress; it is NOT a verified publication milestone.")
        return
    country,(slot,category,idea)=selected
    print("Sprint 6 editorial research",country,"slot",slot,"phase",CONTENT_PHASE)
    print("Queue coverage",coverage_summary(existing_rows,CONTENT_PHASE))
    if country=="Myanmar":
        idea+=" For Myanmar prioritize region-specific dated official advisories, consular access constraints and current change-sensitive limitations; never write a tourist itinerary."
    idea+=" Research lead (not an established fact): "+COUNTRY_NOTES[country]
    research_prompt=f"""Research in English for TripCaution: {idea}.
Previously drafted, reviewed, published or scheduled article titles (DO NOT REPEAT):
{json.dumps(old_titles[:180],ensure_ascii=False)[:6500]}
This brief is about ONLY {country}, category {category}, distinct research slot {slot}. Do not change its exact topic or invent extra warnings. Focus on the 11-country editorial queue, not a worldwide generic article. UK and Canadian official travel advice is nationality-specific for entry and visas: NEVER imply it is universal. For Myanmar, prioritize dated, region-specific official warnings and consular limitations; do not produce a general tourism itinerary.
Find relevant, current and specific evidence that directly answers this slot's question; if fewer than two independent trustworthy original sources support a material problem, return INSUFFICIENT EVIDENCE. Report only evidence actually present in the fetched source extracts or search grounding. Clearly note each source's publisher, actual URL, publication date
and specific scope. Do not invent claims or sources. Do not make safety, legal, health or crime assertions
from a lone example. If reliable evidence is insufficient for the particular proposed claim, state INSUFFICIENT EVIDENCE. Do not conflate two generic national advisory URLs with independent corroboration for a specific scam, payment failure or safety incident.
Never assert a personal visit or create allegations about identifiable businesses."""
    if RESEARCH_MODE == "curated":
        # No paid search API required: inspect only current text fetched from government source URLs.
        evidence,grounded=curated_research(country)
        if len(grounded)<2:
            print("Fewer than two readable official sources; skip; do not hallucinate.")
            return
        research_prompt+="\\nUse ONLY the following fresh official page extracts; report any limitations.\\n"+evidence[:26000]
        researched,_=api_request(research_prompt,grounding=False)
    elif RESEARCH_MODE == "grounded":
        # Available only when your specific model and key support Google Search Grounding.
        researched,grounded=api_request(research_prompt,grounding=True)
    else:
        raise ValueError("TRIPCAUTION_RESEARCH_MODE must be 'curated' or 'grounded'")
    if len(grounded)<2 or "INSUFFICIENT EVIDENCE" in researched.upper():
        print("Research evidence was insufficient; skipping publication.");return
    source_text=json.dumps(grounded,ensure_ascii=False)
    drafting_prompt=f"""You are TripCaution's travel editor. Use ONLY supported findings in this research
and the linked collected source list to produce ONE specific practical caution article for the assigned research slot.
Do not introduce ungrounded facts. Do not claim first-hand experience.
Never name or accuse an individual restaurant/hotel without highly credible directly relevant independent documentation. Do not imply this is a real-time safety alert.
Never assign any danger rating, impact level or probability estimate. Explain applicability by exact place, operator, traveler circumstances and date when documented.
Write fluent, varied English with concrete value, not generic AI prose. Use Markdown body >= 350 words
only if evidence supports it; otherwise reply as an error.
Produce ONLY a JSON object with: title, slug, country, city (null when national), category,
tags (array), excerpt, content_markdown, seo {{title,description,keywords}},
research {{verified_at, sources (array of {{title,url,publisher,published_at}}), uncertainties (array)}},
images {{hero_prompt,hero_image_url:null,alt_text}}.
Category MUST be {category}, country MUST be {country}.
Hero prompt: hand-painted watercolor and soft gouache editorial travel illustration,
delicate paper grain, gentle muted palette, illustrative not photographic,
no recognizable real people, no text, horizontal 16:9.
Only include sources present in the provided list AND relevant to material claims. verified_at is AI research date, NOT evidence of editor verification.
If there is insufficient evidence for the slot's concrete problem, reply INSUFFICIENT EVIDENCE; NEVER pad a category with generic travel boilerplate.
RESEARCH:
{researched[:14500]}
SOURCE LIST:
{source_text[:11000]}
"""
    drafted,_=api_request(drafting_prompt)
    if 'INSUFFICIENT EVIDENCE' in drafted.upper():
        print('Draft lacked relevant verified material for this research slot; skip.')
        return
    obj=read_json(drafted)
    new_slug=re.sub(r"[^a-z0-9]+","-",obj.get("slug","").lower()).strip("-")
    old_slugs={
        re.sub(r"[^a-z0-9]+","-",str(row.get("slug") or "").lower()).strip("-")
        for row in existing_rows
    }
    same_country_titles={
        str(row.get("title") or "").strip().casefold()
        for row in existing_rows if str(row.get("country") or "").strip().casefold()==country.casefold()
    }
    if not new_slug or new_slug in old_slugs or str(obj.get("title") or "").strip().casefold() in same_country_titles:
        print("Draft duplicates an existing title; skip.")
        return
    if obj.get("category")!=category or obj.get("country")!=country:
        raise ValueError("Draft category/country mismatch")
    content=obj.get("content_markdown","")
    if len(content)<1800:print("Article below quality floor; skip.");return
    source_urls={x["url"] for x in grounded}
    cited=obj.get("research",{}).get("sources",[])
    cited=[s for s in cited if s.get("url") in source_urls]
    if len({s.get("url") for s in cited})<2:
        print("Too few supported sources. Saving nothing.");return
    obj["research"]["sources"]=cited
    obj["research"]["verified_at"]=now.isoformat()
    submitted_tags=obj.get("tags")
    obj["tags"]=[x for x in submitted_tags if isinstance(x,str)][:15] if isinstance(submitted_tags,list) else []
    obj["tags"].append("sprint6:"+slot)
    uncertainty_list=obj.get("research",{}).get("uncertainties")
    if not isinstance(uncertainty_list,list):
        uncertainty_list=[]
    uncertainty_list=[str(x)[:300] for x in uncertainty_list if isinstance(x,str)][:18]
    uncertainty_list.append("AI research and its linked source claims must be independently checked by the editor before publishing.")
    obj["research"]["uncertainties"]=uncertainty_list
    obj.pop("caution_level",None)
    obj.pop("severity_scope",None)
    obj.pop("severity_rationale",None)
    obj["source_mode"]="github-automation"
    # Editorial guard: do not auto-publish content that mentions a named accusation or emergency.
    suspicious=re.search(r"(?i)\b(fraud|criminal|arrest|outbreak|fatal|unsafe|emergency|visa requirements)\b",content)
    if suspicious:print("Sensitive topic found; remains in manual Review with its original category.")
    result=request_json(SITE+"/api/ingest",{"articles":[obj]},
        {"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"})
    print("Ingest result:",json.dumps(result)[:700])
    if any(not x.get("ok") for x in result.get("results",[])):sys.exit(1)

if __name__=="__main__":
    try:main()
    except urllib.error.HTTPError as err:
        # Never print response details or key-bearing URLs.
        print("External API HTTP error:",err.code,file=sys.stderr);sys.exit(1)
    except Exception as err:
        print(type(err).__name__+": "+str(err).split("?key=")[0],file=sys.stderr);sys.exit(1)
