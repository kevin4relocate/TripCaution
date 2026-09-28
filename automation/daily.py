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
from datetime import datetime, timezone

API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite"
RESEARCH_MODE = os.getenv("TRIPCAUTION_RESEARCH_MODE") or "curated"
SITE = os.getenv("TRIPCAUTION_API_URL", "").rstrip("/")
TOKEN = os.getenv("TRIPCAUTION_INGEST_TOKEN", "")

TOPICS = [
    ("Vietnam", "before-you-go", "Practical planning mistakes to avoid before visiting Vietnam"),
    ("Cambodia", "etiquette", "Respectful everyday customs travelers should check in Cambodia"),
    ("Laos", "before-you-go", "Planning a journey to Laos: transport and practical preparation"),
    ("Thailand", "etiquette", "Everyday etiquette questions for first-time Thailand visitors"),
    ("Singapore", "before-you-go", "Planning basics to double-check before visiting Singapore"),
    ("Japan", "etiquette", "Public space etiquette considerations for visiting Japan"),
    ("Indonesia", "before-you-go", "Common trip-planning oversights before visiting Indonesia")
]

def request_json(url, payload=None, headers=None, timeout=110):
    data=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(url,data=data,headers=headers or {"Content-Type":"application/json"},method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req,timeout=timeout) as resp:
        return json.loads(resp.read())

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
        print("Upcoming manually scheduled articles already fill the queue; skip to save API quota.")
        return
    old_titles=[row.get("title","") for row in existing.get("titles",[])]
    now=datetime.now(timezone.utc)
    # Daily rotating seed, filtered against existing content; never publish duplicates.
    country,category,idea=TOPICS[now.timetuple().tm_yday % len(TOPICS)]
    print("Researching category:",category,"destination:",country)
    research_prompt=f"""Research in English for TripCaution: {idea}.
Previously published or scheduled article titles (DO NOT REPEAT):
{json.dumps(old_titles[:180],ensure_ascii=False)[:6500]}
Choose a differentiated practical research angle appropriate to this destination.
Use fresh Google Search grounding. Provide five or more concrete, useful findings supported by official authorities
and reputable reporting where possible. Clearly note each source's publisher, actual URL, publication date
and specific scope. Do not invent claims or sources. Do not make safety, legal, health or crime assertions
from a lone example. If reliable evidence is insufficient, state INSUFFICIENT EVIDENCE.
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
    drafting_prompt=f"""You are TripCaution's travel editor. Use ONLY verified findings in this research
and the linked grounded source list to produce ONE evergreen travel-preparation or etiquette article.
Do not introduce ungrounded facts. Do not claim first-hand experience.
Never name or accuse an individual restaurant/hotel. Do not imply this is a real-time safety alert.
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
Only include sources present in the provided list. verified_at is current date ISO UTC.
RESEARCH:
{researched[:14500]}
SOURCE LIST:
{source_text[:11000]}
"""
    drafted,_=api_request(drafting_prompt)
    obj=read_json(drafted)
    new_slug=re.sub(r"[^a-z0-9]+","-",obj.get("slug","").lower()).strip("-")
    old_slugs={re.sub(r"[^a-z0-9]+","-",t.lower()).strip("-") for t in old_titles}
    if new_slug in old_slugs or obj.get("title","").lower() in [t.lower() for t in old_titles]:
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
    obj["source_mode"]="github-automation"
    # Editorial guard: do not auto-publish content that mentions a named accusation or emergency.
    suspicious=re.search(r"(?i)\b(fraud|criminal|arrest|outbreak|fatal|unsafe|emergency|visa requirements)\b",content)
    if suspicious:obj["category"]="things-to-avoid" # CMS routes this into manual review
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
