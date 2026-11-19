#!/usr/bin/env node
// Read-only audit. Drafts are NOT approved. Optional --live reads public sitemap and pages.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const drafts=['001','002','003'].flatMap(b=>read('content/batch-'+b+'/articles.json').articles.map((a,i)=>({...a,_batch:b,_position:i+1})));
const reference=[...read('content/starter-guides.json').articles,...read('content/prelaunch-seven-country-gap-pack.json').articles].map(a=>({slug:a.slug,title:a.title,country:a.country,scope:'repo_reference'}));
const stop=new Set('a an the and or with to for in on of at from into via your before after how what when why without choosing choice choose plan planning making make keeping keep checking check around through travel traveling trip visitor visitors traveler travelers day days guide guides practical clear right first easy carefully responsibly using use best review questions more fewer'.split(' '));
const tokens=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
function similarity(a,b){
 const x=new Set(tokens(a)),y=new Set(tokens(b));let common=0;
 for(const t of x)if(y.has(t))common++;
 return x.size&&y.size?Math.round(2000*common/(x.size+y.size))/1000:0;
}
const authorities=[
 ['immigration and travel documents',/visa|arrival card|etravel|e-travel|passports?|border|restricted item|consular|documentation|entry permit/i,'Responsible immigration or consular authority','Applicable traveler, route, eligibility and issue date'],
 ['operator and transport',/airport|flight|airline|train|rail|mrt|bts|bus|coach|taxi|ride|transfer|ferry|pier|boat|transport/i,'Official transport operator, airport, port or local transport authority','Actual boarding point, ticket conditions and return service'],
 ['health and safety',/health|medical|medication|pharmacy|heat|air quality|beach|swim|snorkel|dive|hike|trek|volcano|life jacket/i,'Relevant health/public safety authority plus qualified guide','Current safety guidance, suitability, weather and emergency procedure'],
 ['payments and consumer terms',/cash|card|bank|payment|qr|refund|deposit|rental|bookings?|fees/i,'Named issuer, merchant, payment provider or consumer authority','Current fees, supported payment methods and cancellation terms'],
 ['culture and visitor access',/temple|mosque|monastery|photograph|etiquette|museum|heritage|wildlife|community|homestay|festival|market|craft/i,'Venue, heritage authority, host or community representative','Visitor boundaries, photography rules and permissions'],
 ['visitor/venue operations',/hotel|guesthouse|accommodation|tour|park|attraction|waterfall|workshop|visit|island/i,'Responsible venue, park or tourism operator','Actual opening, reservation, access and provider policies']
];
function plan(a){
 const entry=authorities.find(x=>x[1].test(a.title+' '+a.category))||['individual provider',null,'Responsible operator, venue or local authority','Actual terms, eligibility and fallbacks'];
 const checks=(a.content_markdown.match(/^## Key takeaways\s*\n((?:- .*\n){2,4})/m)?.[1]||'').trim().split('\n').map(s=>s.replace(/^- /,'').trim()).filter(Boolean).slice(0,3);
 return {domain:entry[0],responsiblePrimarySource:entry[2],claimToVerify:entry[3],specificChecks:checks,verificationStatus:'NOT_INDEPENDENTLY_VERIFIED'};
}
function priority(a){
 const s=a.title+' '+a.category+' '+a.country;
 if(/Myanmar|e-visa|visa|border|restricted|consular|medical|medication|pharmacy|evacuation|emergency/i.test(s))return 'P0';
 if(/ferry|boat|snorkel|dive|swim|volcano|trek|weather|storm|air quality|waterfall|rental scooter|mountain road|permit|law/i.test(s))return 'P1';
 return 'P2';
}
const host=u=>/^https:\/\/([^/]+)/.exec(String(u||''))?.[1]?.toLowerCase()||'invalid';
function sources(a){
 const items=a.sources||[],listed=items.filter(s=>!['www.gov.uk','travel.gc.ca'].includes(host(s.url)));
 const urls=[...a.content_markdown.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map(x=>x[1]);
 return {all:items.length,countryAdvisories:items.length-listed.length,nonCountryAdvisories:listed.map(x=>x.url),
  specialistCitationsInBody:listed.filter(x=>urls.includes(x.url)).length,bodyExternalLinks:urls.length,
  status:'GENERAL_ADVISORIES_NOT_CLAIM_LEVEL_EVIDENCE'};
}
function matches(a,group){
 return group.filter(x=>x.slug!==a.slug&&(!a.country||!x.country||a.country.toLowerCase()===x.country.toLowerCase()))
  .map(x=>({slug:x.slug,title:x.title,similarity:similarity(a.title,x.title),scope:x.scope||'draft'}))
  .filter(x=>x.similarity>=0.35).sort((x,y)=>y.similarity-x.similarity||x.slug.localeCompare(y.slug)).slice(0,4);
}
const rows=drafts.map(a=>({slug:a.slug,title:a.title,country:a.country,batch:a._batch,position:a._position,
 editorialStatus:a.editorial_status,risk:priority(a),sources:sources(a),research:plan(a),
 otherDraftCandidates:matches(a,drafts.map(b=>({...b,scope:'draft'}))),
 referenceCandidates:matches(a,reference),liveCandidates:[]}));
const summary={drafts:rows.length,distinctSlugs:new Set(rows.map(x=>x.slug)).size,
 sourceReferences:drafts.reduce((n,a)=>n+(a.sources||[]).length,0),
 uniqueSourceURLs:new Set(drafts.flatMap(a=>(a.sources||[]).map(x=>x.url))).size,
 governmentAdvisoryReferences:rows.reduce((n,x)=>n+x.sources.countryAdvisories,0),
 extraSourceReferences:rows.reduce((n,x)=>n+x.sources.nonCountryAdvisories.length,0),
 specialistCitationsInBody:rows.reduce((n,x)=>n+x.sources.specialistCitationsInBody,0),
 requiringTopicSpecificSourceCheck:rows.filter(x=>x.research.verificationStatus==='NOT_INDEPENDENTLY_VERIFIED').length,
 priorityCounts:Object.fromEntries(['P0','P1','P2'].map(p=>[p,rows.filter(x=>x.risk===p).length])),
 draftLexicalOverlapCandidates:rows.filter(x=>x.otherDraftCandidates.length).length,
 repoReferenceOverlapCandidates:rows.filter(x=>x.referenceCandidates.length).length,
 publicInventory:{status:'NOT_CHECKED',sitemapCount:null,parsedPages:0,error:null},
 warnings:['Similarity is token-based triage, not a semantic duplicate verdict',
  'Advisory URLs are NOT validation of named provider or rule claims',
  'Public sitemap does not list private D1 draft/deleted articles']
};
const origin=(process.env.SITE_URL||'https://tripcaution.nghiep4tube.workers.dev').replace(/\/$/,'');
async function get(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'TripCautionEditorialAudit/1.0'}});
 if(!response.ok)throw Error('HTTP '+response.status+' '+url);return await response.text();}finally{clearTimeout(timer)}
}
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'");
function pageTitle(html){
 const h=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||
  html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'';
 return decode(h.replace(/<[^>]*>/g,'').replace(/\s+\|\s+TripCaution.*$/,'').trim());
}
async function publicInventory(){
 const xml=await get(origin+'/sitemap.xml'),links=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));
 const urls=[...new Set(links.filter(link=>{try{const u=new URL(link);return u.origin===origin&&u.pathname.startsWith('/guides/');}catch{return false;}}))];
 if(!urls.length)throw Error('No public guide URLs in sitemap');
 const published=[],failed=[];let index=0;
 async function work(){while(index<urls.length){const url=urls[index++];try{
  const html=await get(url),title=pageTitle(html);
  if(!title||title.length<8)throw Error('Missing H1');
  published.push({slug:decodeURIComponent(new URL(url).pathname.split('/').pop()),title,url,scope:'published'});
 }catch(e){failed.push({url,error:String(e).slice(0,130)})}}}
 await Promise.all(Array.from({length:Math.min(6,urls.length)},()=>work()));
 return {urls,published,failed};
}
if(process.argv.includes('--live')){
 try{
  const published=await publicInventory();
  rows.forEach(row=>{row.liveCandidates=matches(row,published.published);});
  summary.publicInventory={status:published.failed.length?'PARTIAL':'SUCCESS',sitemapCount:published.urls.length,
   parsedPages:published.published.length,error:published.failed.length?published.failed.slice(0,4):null};
 }catch(e){summary.publicInventory={status:'UNAVAILABLE',sitemapCount:null,parsedPages:0,error:String(e)};}
}
const report={generatedAt:new Date().toISOString(),summary,articles:rows};
mkdirSync('audit-reports',{recursive:true});
writeFileSync(resolve('audit-reports/tripcaution-300-audit.json'),JSON.stringify(report,null,2)+'\n');
const lines=[
 '# TripCaution: 300-article source and duplicate audit',
 '',
 '**Read-only editorial triage. No draft is approved, published, merged or deleted by this script.**',
 '',
 '## Audit overview',
 '- 300 draft slugs: '+summary.distinctSlugs+' unique.',
 '- '+summary.sourceReferences+' source references from only '+summary.uniqueSourceURLs+' distinct URLs.',
 '- '+summary.governmentAdvisoryReferences+' country-level travel advisories and '+summary.extraSourceReferences+' extra specialist references.',
 '- Specialist links cited within draft body: '+summary.specialistCitationsInBody+'.',
 '- Research still required: '+summary.requiringTopicSpecificSourceCheck+' articles.',
 '- Editorial priority counts: '+JSON.stringify(summary.priorityCounts)+'.',
 '- Lexical same-country overlaps within the new drafts: '+summary.draftLexicalOverlapCandidates+' article candidates.',
 '- Lexical overlap against ten GitHub reference articles: '+summary.repoReferenceOverlapCandidates+' draft candidates.',
 '- Live public inventory status: '+summary.publicInventory.status+'; discovered: '+(summary.publicInventory.sitemapCount??'unavailable')+'; parsed: '+summary.publicInventory.parsedPages+'.',
 '',
 '## Important limits',
 '- A title token overlap is a candidate for human inspection, not an established semantic duplicate.',
 '- Sources were audited for provenance and topical suitability, NOT live claim-by-claim accuracy.',
 '- D1 unpublished/deleted inventory is unavailable via the public sitemap. Full D1 duplicate audit still needs a read-only D1 export.',
 '- All 300 articles retain REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS and must not be automatically imported or published.',
 '',
 '## High-similarity reference / published candidates',
 '| Draft | Closest known reference or live guide | Similarity |',
 '|---|---|---:|'
];
const notable=rows.flatMap(row=>[...row.referenceCandidates,...row.liveCandidates].filter(x=>x.similarity>=0.5).map(x=>({row,x})))
 .sort((a,b)=>b.x.similarity-a.x.similarity).slice(0,75);
for(const {row,x} of notable)lines.push('| '+row.title.replaceAll('|','/')+' | '+x.title.replaceAll('|','/')+' ('+x.scope+') | '+x.similarity.toFixed(2)+' |');
lines.push('','## Research queue for all 300 drafts','','| Batch / index | Article | Priority | Required primary source | Claim to verify |',
 '|---|---|---|---|---|');
for(const row of rows)lines.push('| '+row.batch+' / '+String(row.position).padStart(3,'0')+' | '+row.title.replaceAll('|','/')+
 ' | '+row.risk+' | '+row.research.responsiblePrimarySource+' | '+(row.research.specificChecks[0]||row.research.claimToVerify).replaceAll('|','/')+' |');
lines.push('','**Next step:** obtain a relevant primary-source URL and checked date for each article, compare both full texts for possible duplicate candidates, then independently approve each draft.');
writeFileSync(resolve('audit-reports/tripcaution-300-audit.md'),lines.join('\n')+'\n');
console.log('TRIPCAUTION_AUDIT_SUMMARY '+JSON.stringify(summary));
console.log('Audit reports written: audit-reports/tripcaution-300-audit.json and .md');
if(rows.length!==300||summary.distinctSlugs!==300)process.exitCode=1;
