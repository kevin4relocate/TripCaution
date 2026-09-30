/* Full TripCaution launch audit.
   Public-only and non-destructive. It scans every guide in production sitemap,
   validates the expected 11-country / 110-guide launch inventory, and checks
   the deterministic hero + inline WebP objects used by every article. */
import {writeFileSync} from 'node:fs';

const origin=(process.env.SITE_URL||'https://tripcaution.nghiep4tube.workers.dev').replace(/\/$/,'');
const expectedGuideCount=Number(process.env.EXPECTED_GUIDE_COUNT||110);
const expectedPerCountry=Number(process.env.EXPECTED_GUIDES_PER_COUNTRY||10);
const requestTimeout=Number(process.env.AUDIT_TIMEOUT_MS||20000);
const concurrency=Math.max(1,Math.min(12,Number(process.env.AUDIT_CONCURRENCY||6)));
const countries=[
 ['Brunei','brunei'],['Cambodia','cambodia'],['Indonesia','indonesia'],['Laos','laos'],
 ['Malaysia','malaysia'],['Myanmar','myanmar'],['Philippines','philippines'],
 ['Singapore','singapore'],['Thailand','thailand'],['Timor-Leste','timor-leste'],['Vietnam','vietnam']
];
const expectedCountries=new Set(countries.map(([name])=>name));
const problems=[],warnings=[],guideResults=[],imageResults=[];

const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const unique=a=>[...new Set(a)];
function fail(scope,message){problems.push({scope,message});}
function warn(scope,message){warnings.push({scope,message});}
async function getAbsolute(url,{method='GET'}={}){
 const response=await fetch(url,{
  method,redirect:'follow',
  headers:{'User-Agent':'TripCaution-Full-Launch-Audit/1.0'},
  signal:AbortSignal.timeout(requestTimeout)
 });
 return response;
}
async function get(path){
 const response=await getAbsolute(origin+path);
 return {response,body:await response.text()};
}
async function mapLimit(items,limit,worker){
 let next=0;
 const out=new Array(items.length);
 const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
  while(true){
   const i=next++;
   if(i>=items.length)return;
   try{out[i]=await worker(items[i],i);}
   catch(error){out[i]={error:String(error?.message||error)};}
  }
 });
 await Promise.all(runners);
 return out;
}
function attr(tag,name){
 const match=tag.match(new RegExp("\\b"+name+"=[\\\"']([^\\\"']*)[\\\"']","i"));
 return match?decode(match[1]).trim():'';
}
function firstMeta(body,selector,value){
 const tags=[...body.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
 for(const tag of tags){
  if(attr(tag,selector)===value)return attr(tag,'content');
 }
 return '';
}
function canonical(body){
 const match=body.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)||
  body.match(/<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i);
 return match?attr(match[0],'href'):'';
}
function parseJsonLd(body){
 const blocks=[...body.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
 const parsed=[];
 for(const block of blocks){
  try{parsed.push(JSON.parse(block[1]));}catch{}
 }
 return parsed;
}
function schemaNodes(blocks){
 const nodes=[];
 for(const block of blocks){
  if(Array.isArray(block?.['@graph']))nodes.push(...block['@graph']);
  else if(block&&typeof block==='object')nodes.push(block);
 }
 return nodes;
}
function sitemapEntries(xml){
 const entries=[];
 for(const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)){
  const inner=match[1],loc=decode(inner.match(/<loc>([^<]+)<\/loc>/)?.[1]||'');
  const lastmod=decode(inner.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]||'');
  if(loc)entries.push({loc,lastmod});
 }
 return entries;
}
function articleImages(body){
 const heroTag=body.match(/<figure class=["']hero-image["']>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/figure>/i)?.[0]||'';
 const heroImg=heroTag.match(/<img\b[^>]*>/i)?.[0]||'';
 const inlineFigures=[...body.matchAll(/<figure class=["']article-inline-image["']>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/figure>/gi)]
  .map(x=>x[0].match(/<img\b[^>]*>/i)?.[0]||'').filter(Boolean);
 return {
  hero:heroImg?{src:attr(heroImg,'src'),alt:attr(heroImg,'alt')}:null,
  inline:inlineFigures.map(tag=>({src:attr(tag,'src'),alt:attr(tag,'alt')}))
 };
}
function sourceLinks(body){
 const section=body.match(/<section class=["']sources["']>[\s\S]*?<\/section>/i)?.[0]||'';
 return [...section.matchAll(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>/gi)].map(x=>decode(x[1]));
}
function guideSlug(url){
 try{return decodeURIComponent(new URL(url).pathname.replace(/^\/guides\//,''));}catch{return '';}
}
function countryFromSchema(nodes){
 const crumbs=nodes.find(n=>n?.['@type']==='BreadcrumbList');
 const row=crumbs?.itemListElement?.find?.(item=>Number(item?.position)===2);
 return String(row?.name||'').trim();
}
async function checkImage(item){
 const row={guide:item.guide,kind:item.kind,url:item.url,ok:false,status:null,contentType:'',webpSignature:false};
 try{
  const response=await getAbsolute(item.url);
  row.status=response.status;
  row.contentType=response.headers.get('content-type')||'';
  if(response.status!==200)throw Error('HTTP '+response.status);
  if(!/^image\/webp\b/i.test(row.contentType))throw Error('Expected image/webp, got '+(row.contentType||'(missing content-type)'));
  const reader=response.body?.getReader();
  if(!reader)throw Error('Image response has no body');
  const {value}=await reader.read();
  await reader.cancel();
  const bytes=value||new Uint8Array();
  row.webpSignature=bytes.length>=12 &&
   String.fromCharCode(...bytes.slice(0,4))==='RIFF' &&
   String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!row.webpSignature)throw Error('Invalid WebP signature');
  row.ok=true;
 }catch(error){row.error=String(error?.message||error);}
 return row;
}

console.log('TripCaution full launch audit');
console.log('Origin:',origin);
console.log('Expected:',expectedGuideCount,'guides ·',countries.length,'countries ·',expectedPerCountry,'guides/country');

let sitemap='';
try{
 const result=await get('/sitemap.xml');
 ensure(result.response.status===200,'sitemap.xml returned HTTP '+result.response.status);
 sitemap=result.body;
}catch(error){
 fail('sitemap',String(error.message||error));
}
const entries=sitemapEntries(sitemap);
const guideEntries=entries.filter(row=>row.loc.startsWith(origin+'/guides/'));
const guideURLs=guideEntries.map(row=>row.loc);
const uniqueGuideURLs=unique(guideURLs);
if(guideURLs.length!==uniqueGuideURLs.length)fail('sitemap','Duplicate guide URLs in sitemap');
if(uniqueGuideURLs.length!==expectedGuideCount)
 fail('inventory','Expected '+expectedGuideCount+' public guides, found '+uniqueGuideURLs.length);
for(const entry of guideEntries)if(!entry.lastmod)fail('sitemap',guideSlug(entry.loc)+': missing <lastmod>');
for(const [country,slug] of countries){
 if(!sitemap.includes('<loc>'+origin+'/destinations/'+slug+'</loc>'))
  fail('destinations',country+': destination page missing from sitemap');
}

console.log('Scanning',uniqueGuideURLs.length,'guide pages with concurrency',concurrency,'...');
const inspected=await mapLimit(uniqueGuideURLs,concurrency,async url=>{
 const path=new URL(url).pathname,slug=guideSlug(url);
 const row={url,slug,ok:false,country:null,hero:null,inline:[],sourceCount:0,checks:[]};
 try{
  const {response,body}=await get(path);
  ensure(response.status===200,'HTTP '+response.status);
  ensure(!/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(body),'Public guide is noindex');
  ensure(!body.includes('PRIVATE PREVIEW'),'Private preview marker leaked');
  ensure(!body.includes('Editorial sources are pending publication.'),'Sources are pending publication');
  ensure(canonical(body)===url,'Canonical mismatch: '+canonical(body));
  const title=body.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim()||'';
  ensure(title.length>=12,'Missing/short <title>');
  const description=firstMeta(body,'name','description');
  ensure(description.length>=70,'Missing/short meta description');
  ensure(firstMeta(body,'property','og:type')==='article','og:type is not article');
  ensure(firstMeta(body,'property','og:url')===url,'og:url mismatch');
  ensure(firstMeta(body,'property','article:published_time'),'article:published_time missing');
  ensure(body.includes('id="main-content"'),'main-content target missing');
  ensure(body.includes('data-article-toc'),'Article TOC missing');

  const nodes=schemaNodes(parseJsonLd(body));
  const article=nodes.find(n=>n?.['@type']==='Article');
  const breadcrumbs=nodes.find(n=>n?.['@type']==='BreadcrumbList');
  ensure(article,'Article JSON-LD missing');
  ensure(breadcrumbs,'BreadcrumbList JSON-LD missing');
  ensure(article?.headline?.trim(),'Article schema headline missing');
  ensure(article?.description?.trim(),'Article schema description missing');
  ensure(article?.mainEntityOfPage?.['@id']===url,'Article schema mainEntityOfPage mismatch');
  row.country=countryFromSchema(nodes);
  ensure(expectedCountries.has(row.country),'Unexpected/missing country in Breadcrumb schema: '+row.country);

  const images=articleImages(body);
  ensure(images.hero,'Hero image missing');
  ensure(images.inline.length===1,'Expected exactly 1 inline image, found '+images.inline.length);
  row.hero=images.hero;
  row.inline=images.inline;
  ensure(images.hero.alt.length>=8,'Hero alt text missing/too short');
  ensure(images.inline[0].alt.length>=8,'Inline alt text missing/too short');
  const expectedHero='/media/editorial/'+slug+'.webp';
  const expectedInline='/media/editorial/'+slug+'-inline-01.webp';
  ensure(images.hero.src===expectedHero,'Hero path mismatch: '+images.hero.src+' != '+expectedHero);
  ensure(images.inline[0].src===expectedInline,'Inline path mismatch: '+images.inline[0].src+' != '+expectedInline);
  const absoluteHero=origin+expectedHero;
  ensure(firstMeta(body,'property','og:image')===absoluteHero,'og:image does not match hero');
  ensure(Array.isArray(article.image)&&article.image.includes(absoluteHero),'Article schema image does not match hero');

  const sources=sourceLinks(body);
  row.sourceCount=sources.length;
  ensure(sources.length>=2,'Expected at least 2 HTTPS sources, found '+sources.length);
  ensure(unique(sources).length>=2,'Sources are not distinct');

  const internalGuideLinks=[...body.matchAll(/href=["'](\/guides\/[^"'#?]+)["']/g)].map(x=>origin+x[1]);
  for(const linked of internalGuideLinks)
   ensure(uniqueGuideURLs.includes(linked),'Internal related-guide link not present in sitemap: '+linked);

  row.ok=true;
 }catch(error){row.error=String(error?.message||error);}
 return row;
});
guideResults.push(...inspected);

for(const row of guideResults)if(!row.ok)fail('guide:'+row.slug,row.error||'Unknown guide failure');

const counts=Object.fromEntries(countries.map(([name])=>[name,0]));
for(const row of guideResults)if(row.country in counts)counts[row.country]++;
for(const [country] of countries){
 if(counts[country]!==expectedPerCountry)
  fail('country-distribution',country+': expected '+expectedPerCountry+', found '+counts[country]);
}

const imageQueue=[];
for(const row of guideResults){
 if(!row.hero||row.inline.length!==1)continue;
 imageQueue.push({guide:row.slug,kind:'hero',url:origin+row.hero.src});
 imageQueue.push({guide:row.slug,kind:'inline',url:origin+row.inline[0].src});
}
const imageURLs=imageQueue.map(x=>x.url);
if(unique(imageURLs).length!==imageURLs.length)fail('images','Duplicate hero/inline image URLs detected');
const expectedImageCount=uniqueGuideURLs.length*2;
if(imageQueue.length!==expectedImageCount)
 fail('images','Expected '+expectedImageCount+' article images, discovered '+imageQueue.length);

console.log('Checking',imageQueue.length,'WebP objects...');
const imageChecks=await mapLimit(imageQueue,concurrency,checkImage);
imageResults.push(...imageChecks);
for(const row of imageResults)if(!row.ok)fail('image:'+row.guide+':'+row.kind,row.url+' — '+(row.error||'failed'));

if(uniqueGuideURLs.length===expectedGuideCount && Object.values(counts).every(n=>n===expectedPerCountry))
 console.log('Inventory distribution matches launch target.');

const summary={
 origin,
 github_source_sha:process.env.GITHUB_SHA||null,
 executed_at:new Date().toISOString(),
 expected:{guides:expectedGuideCount,countries:countries.length,guides_per_country:expectedPerCountry,images:expectedGuideCount*2},
 actual:{
  sitemap_guides:uniqueGuideURLs.length,
  country_counts:counts,
  guides_passed:guideResults.filter(x=>x.ok).length,
  guides_failed:guideResults.filter(x=>!x.ok).length,
  images_discovered:imageQueue.length,
  images_passed:imageResults.filter(x=>x.ok).length,
  images_failed:imageResults.filter(x=>!x.ok).length
 },
 problems,warnings,
 guides:guideResults,
 images:imageResults,
 decision:problems.length?'NO_GO':'FULL_LAUNCH_AUDIT_PASS'
};
writeFileSync('tripcaution-full-launch-audit.json',JSON.stringify(summary,null,2));

console.log('\nFULL LAUNCH AUDIT');
console.log('Guides:',summary.actual.guides_passed+'/'+uniqueGuideURLs.length,'pass');
console.log('Images:',summary.actual.images_passed+'/'+imageQueue.length,'pass');
for(const [country,count] of Object.entries(counts))console.log('COUNTRY',country,count+'/'+expectedPerCountry);
for(const item of warnings)console.log('WARNING',item.scope,item.message);
for(const item of problems)console.log('FAIL',item.scope,item.message);
console.log('DECISION',summary.decision);
if(problems.length)process.exitCode=1;
