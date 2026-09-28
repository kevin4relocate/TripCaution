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
let publicGuideCount=0;
await run('Sitemap and ACTUALLY published articles (no hard-coded draft assumptions)',async()=>{
 const {response,body}=await get('/sitemap.xml');
 ensure(response.status===200&&body.includes('<loc>'+origin+'/destinations</loc>'),'Sitemap missing or wrong host');
 const paths=[...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(hit=>hit[1])
  .filter(url=>url.startsWith(origin+'/guides/')).slice(0,5);
 publicGuideCount=paths.length;
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
 publicGuideCount,results,warnings,manualGates,
 decision:failed?'AUTOMATED_CHECKS_FAILED':'AUTOMATED_CHECKS_PASS__MANUAL_GATES_OPEN',
 note:'Automated checks intentionally exclude owner-only Cloudflare settings, inbox receipt and any database mutations.'};
writeFileSync('sprint1-production-security.json',JSON.stringify(report,null,2));
console.log('\nTripCaution Sprint 1 production/security:',pass+'/'+results.length,'PASS');
for(const r of results)console.log(r.status,r.name,r.details);
for(const w of warnings)console.log('WARNING',w);
for(const g of manualGates)console.log('MANUAL GATE',g);
if(failed)process.exitCode=1;
