/* Sprint 1: public-only, non-destructive production + security smoke.
   Does not use owner credentials, send emails or mutate production records.
   The report separates automated PASS from owner-confirmed launch gates. */
import {writeFileSync} from 'node:fs';

const origin=(process.env.SITE_URL||'https://tripcaution.nghiep4tube.workers.dev').replace(/\/$/,'');
const results=[],warnings=[],manualGates=[
 'Verify the deployed Cloudflare Worker SHA equals the intended tested GitHub commit',
 'Use the real owner account to test sign-in, sign-out, expiry, review, publish and restore',
 'Export D1 and demonstrate restoring the export to a SEPARATE staging database',
 'Confirm the published contact address actually receives and replies to email',
 'Test the real site on an iPhone Safari and Android Chrome before broad launch'
];
function record(name,ok,details=''){results.push({name,status:ok?'PASS':'FAIL',details});}
function ensure(value,message){if(!value)throw new Error(message);}
async function run(name,fn){try{await fn();record(name,true);}catch(e){record(name,false,String(e.message).slice(0,230));}}
async function get(path,{redirect='follow'}={}){
 const response=await fetch(origin+path,{
  redirect,headers:{'User-Agent':'TripCaution-Sprint1-public-audit/1.0'},
  signal:AbortSignal.timeout(15000)
 });
 return {response,body:await response.text()};
}
async function attemptUnauthenticatedWrite(path){
 return fetch(origin+path,{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:'{}',redirect:'manual',signal:AbortSignal.timeout(15000)
 });
}
await run('D1 database responds to health probe',async()=>{
 const {response,body}=await get('/health');
 ensure(response.status===200 && JSON.parse(body).database==='ready','D1 health is not ready: HTTP '+response.status);
});
await run('Homepage uses expected canonical, content and safe response type',async()=>{
 const {response,body}=await get('/');
 ensure(response.status===200&&body.includes('Field notes for'),'Homepage missing or old build');
 ensure(body.includes('rel="canonical" href="'+origin+'/"'),'Homepage canonical host mismatch');
 ensure((response.headers.get('x-content-type-options')||'').toLowerCase()==='nosniff','Missing nosniff on HTML');
 ensure(response.headers.get('x-frame-options')==='DENY','Public HTML missing anti-frame header');
 ensure((response.headers.get('content-security-policy')||'').includes("script-src 'self'"),'Public HTML missing restrictive script policy');
 ensure((response.headers.get('content-security-policy')||'').includes("frame-ancestors 'none'"),'Public HTML missing frame-ancestors');
 ensure(!body.includes('onclick="navigator.clipboard'),'Old unsafe inline share script still deployed');
});
await run('Critical first-party assets are deployed',async()=>{
 const css=await get('/styles.css');
 ensure(css.response.status===200&&css.body.includes('.shell'),'Public stylesheet missing or stale');
 const site=await get('/site.js');
 ensure(site.response.status===200&&site.body.includes('data-copy-guide'),'CSP-compatible first-party script missing');
 const dashboard=await get('/admin.js');
 ensure(dashboard.response.status===200&&dashboard.body.includes('function renderArticles'),'Admin script missing or stale');
});
await run('Destination directory is published without a dead-end index',async()=>{
 const {response,body}=await get('/destinations');
 ensure(response.status===200&&body.includes('Research planned'),'Destination directory missing or incomplete');
});
await run('Southeast Asia-first hub honestly represents all eleven destinations',async()=>{
 const home=await get('/');
 ensure(home.response.status===200&&home.body.includes('Southeast Asia guide hub'),'Regional homepage priority missing');
 const {response,body}=await get('/southeast-asia');
 ensure(response.status===200,'Regional hub failed to load');
 const names=['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines',
  'Singapore','Thailand','Timor-Leste','Vietnam'];
 for(const name of names)ensure(body.includes('<strong>'+name+'</strong>'),'Missing regional destination: '+name);
 const cards=[...body.matchAll(/<(a|div) class="sea-country sea-country-(ready|pending)"([^>]*)>([\s\S]*?)<\/\1>/g)];
 ensure(cards.length===11,'Regional hub must display exactly eleven honestly labelled country cards');
 for(const card of cards){
  const name=card[4].match(/<strong>([^<]+)<\/strong>/)?.[1];
  ensure(names.includes(name),'Unexpected regional destination card: '+name);
  if(card[2]==='pending')
   ensure(card[1]==='div'&&!card[3].includes('href=')&&card[4].includes('Research planned'),
    'Unpublished regional country must not be an active link: '+name);
  else ensure(card[1]==='a'&&card[3].includes('href="/destinations/'),
    'Published regional country must have a working destination link: '+name);
 }
 const sitemap=await get('/sitemap.xml');
 ensure(sitemap.response.status===200,'Sitemap unavailable');
 const listed=sitemap.body.includes('<loc>'+origin+'/southeast-asia</loc>');
 const noindex=body.includes('name="robots" content="noindex');
 ensure(listed!==noindex,'Regional hub must be indexed only when real regional articles are published');
});
let publicGuideCount=0;
let regionalCoverage={published:[],awaiting:[]};
await run('Sitemap and ACTUALLY published articles (no hard-coded draft assumptions)',async()=>{
 const {response,body}=await get('/sitemap.xml');
 ensure(response.status===200&&body.includes('<loc>'+origin+'/destinations</loc>'),'Sitemap missing or wrong host');
 const allGuideURLs=[...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(hit=>hit[1])
  .filter(url=>url.startsWith(origin+'/guides/'));
 // Count ALL sitemap guides, but retrieve only a small public sample to
 // avoid unnecessarily hammering the production site during an audit.
 publicGuideCount=allGuideURLs.length;
 const countries=[['Brunei','brunei'],['Cambodia','cambodia'],['Indonesia','indonesia'],
  ['Laos','laos'],['Malaysia','malaysia'],['Myanmar','myanmar'],
  ['Philippines','philippines'],['Singapore','singapore'],['Thailand','thailand'],
  ['Timor-Leste','timor-leste'],['Vietnam','vietnam']];
 regionalCoverage={
  published:countries.filter(([name,slug])=>body.includes('<loc>'+origin+'/destinations/'+slug+'</loc>')).map(([name])=>name),
  awaiting:countries.filter(([name,slug])=>!body.includes('<loc>'+origin+'/destinations/'+slug+'</loc>')).map(([name])=>name)
 };
 const paths=allGuideURLs.slice(0,5);
 ensure(paths.length>0,'No published articles in sitemap: finish article review before launch');
 for(const url of paths){
  const path=url.slice(origin.length),result=await get(path);
  ensure(result.response.status===200,'Published guide failed: '+path);
  ensure(result.body.includes('Sources & verification'),'Sources missing: '+path);
  ensure(result.body.includes('rel="canonical" href="'+url+'"'),'Canonical mismatch: '+path);
  ensure(!result.body.includes('PRIVATE PREVIEW'),'Private preview marker leaked into public article');
 }
 if(paths.length<3)warnings.push('Fewer than three published articles were visible: ensure the planned starter articles are genuinely reviewed before soft launch');
});
await run('Published-guide Article schema, on-page outline and sitemap lastmod',async()=>{
 const map=await get('/sitemap.xml');
 ensure(map.response.status===200,'Cannot inspect sitemap');
 const match=[...map.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(item=>item[1])
  .find(url=>url.startsWith(origin+'/guides/'));
 ensure(match,'No published guide to inspect');
 const {response,body}=await get(match.slice(origin.length));
 ensure(response.status===200,'Published guide unavailable');
 ensure(body.includes('property="og:type" content="article"'),'Article OpenGraph type is missing');
 const tag=body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 ensure(tag,'Structured article data missing');
 const schema=JSON.parse(tag[1]);
 ensure(schema['@graph']?.some(item=>item['@type']==='Article'),'Article JSON-LD node missing');
 ensure(schema['@graph']?.some(item=>item['@type']==='BreadcrumbList'),'BreadcrumbList node missing');
 ensure(body.includes('data-article-toc'),'Public guide table of contents not rendered');
 ensure(body.includes('id="main-content"'),'Main content keyboard target missing');
 ensure(!body.includes('PRIVATE PREVIEW'),'Preview content leaked into published page');
 ensure(/<lastmod>\d{4}-\d{2}-\d{2}T/.test(map.body),'Public guide update date missing from sitemap');
});
await run('Missing public page remains HTTP 404 and noindex',async()=>{
 const {response,body}=await get('/this-guide-must-not-exist-'+Date.now());
 ensure(response.status===404,'Missing page does not return 404');
 ensure(body.includes('name="robots" content="noindex'),'404 is missing noindex directive');
 ensure((response.headers.get('x-robots-tag')||'').includes('noindex'),'404 is missing X-Robots-Tag');
});
await run('Robots sitemap host and private-path directives',async()=>{
 const {response,body}=await get('/robots.txt');
 ensure(response.status===200&&body.includes('Sitemap: '+origin+'/sitemap.xml'),'Robots points to the wrong sitemap host');
 ensure(body.includes('Disallow: /admin')&&body.includes('Disallow: /api/')&&body.includes('Disallow: /sign-in'),
 'Robots must identify private/non-indexable routes');
});
await run('Legal pages exist; contact address visibility is NOT proof of delivery',async()=>{
 for(const path of ['/about','/privacy','/contact']){
  const {response,body}=await get(path);
  ensure(response.status===200&&body.includes('TRIPCAUTION / INFORMATION'),path+' missing');
  if(path==='/privacy')ensure(body.includes('Cloudflare')&&body.includes('Google Fonts'),'Privacy content missing disclosed processors');
  if(path==='/contact'){
   const hasAddress=/href="mailto:[^"]+/.test(body);
   if(!hasAddress)warnings.push('No public editorial contact address configured');
   else warnings.push('Public contact address exists, but email delivery has NOT been verified');
  }
 }
});
await run('Public search and 404 behave correctly',async()=>{
 const search=await get('/search?q=transport');
 ensure(search.response.status===200&&search.body.includes('Search TripCaution'),'Search unavailable');
 const missing=await get('/sprint1-should-not-exist-'+Date.now());
 ensure(missing.response.status===404,'Unknown public route must return HTTP 404');
});
await run('Invalid public media paths are rejected safely',async()=>{
 const {response}=await get('/media/not-an-editorial-image.js');
 ensure(response.status===404,'Unexpected public media response for malformed image key');
});
await run('Anonymous visitor cannot open owner UI or private previews',async()=>{
 const admin=await get('/admin',{redirect:'manual'});
 ensure(admin.response.status===302&&admin.response.headers.get('location')===origin+'/sign-in','Admin does not enforce sign-in');
 ensure((admin.response.headers.get('cache-control')||'').includes('no-store'),'Admin redirect is cacheable and can cause stale login loops');
 const preview=await get('/admin/preview/a0000000-0000-4000-a000-000000000001',{redirect:'manual'});
 ensure(preview.response.status===302&&preview.response.headers.get('location')===origin+'/sign-in','Draft preview does not enforce sign-in');
});
await run('Unauthenticated administration and ingestion are rejected',async()=>{
 const articles=await get('/api/admin/articles');
 ensure(articles.response.status===401,'Admin records accessible without login');
 for(const path of ['/api/admin/bulk','/api/admin/purge','/api/admin/media','/api/ingest']){
  const response=await attemptUnauthenticatedWrite(path);
  if(path==='/api/ingest'&&response.status===503){
   // Deliberately unconfigured ingestion is fail-closed: bots are disabled.
   warnings.push('INGEST_TOKEN is not configured in production; automation cannot import, but anonymous access remains blocked');
  }else ensure(response.status===401,'Anonymous write must be rejected: '+path+' returned '+response.status);
 }
});
await run('Sign-in uses no-store, anti-frame protection and strict browser script policy',async()=>{
 const {response,body}=await get('/sign-in');
 ensure(response.status===200&&body.includes('admin-key'),'Owner sign-in page missing');
 ensure((response.headers.get('cache-control')||'').includes('no-store'),'Sign-in must not be cached');
 ensure((response.headers.get('x-frame-options')||'').toUpperCase()==='DENY','Sign-in missing anti-frame protection');
 ensure((response.headers.get('content-security-policy')||'').includes("script-src 'self'"),'Sign-in lacks a restrictive CSP');
 ensure(!body.includes('ADMIN_LOGIN_KEY'),'Server-only secret name should not be embedded in public login HTML');
});
const pass=results.filter(x=>x.status==='PASS').length,failed=results.filter(x=>x.status==='FAIL').length;
const report={origin,github_source_sha:process.env.GITHUB_SHA||null,cloudflare_deployment_sha:'NOT_VERIFIED_BY_THIS_SCRIPT',executed_at:new Date().toISOString(),pass,failed,total:results.length,
 publicGuideCount,regionalCoverage,results,warnings,manualGates,
 decision:failed?'AUTOMATED_CHECKS_FAILED':'AUTOMATED_CHECKS_PASS__MANUAL_GATES_OPEN',
 note:'Automated checks intentionally exclude owner-only Cloudflare settings, inbox receipt and any database mutations.'};
writeFileSync('sprint1-production-security.json',JSON.stringify(report,null,2));
console.log('\nTripCaution release smoke (including Sprint 2):',pass+'/'+results.length,'PASS');
for(const r of results)console.log(r.status,r.name,r.details);
console.log('EDITORIAL COVERAGE Southeast Asia',regionalCoverage.published.length+'/11 countries with published guide(s)');
console.log('EDITORIAL COVERAGE published:',regionalCoverage.published.join(', ')||'(none)');
console.log('EDITORIAL COVERAGE awaiting:',regionalCoverage.awaiting.join(', ')||'(none)');
for(const w of warnings)console.log('WARNING',w);
for(const g of manualGates)console.log('MANUAL GATE',g);
if(failed)process.exitCode=1;
