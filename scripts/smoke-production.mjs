/* Sprint 0 release-gate rerun. Public-only: no login keys or editorial data are sent.
   Run with SITE_URL=https://your-production-origin node scripts/smoke-production.mjs
   Failing cases represent launch blockers until diagnosed. */
import {writeFileSync} from 'node:fs';
const origin=(process.env.SITE_URL||'https://tripcaution.nghiep4tube.workers.dev').replace(/\/$/,'');
const results=[];
function result(name,ok,details=''){results.push({name,result:ok?'PASS':'FAIL',details});}
async function get(path,{redirect='follow'}={}){
 const response=await fetch(origin+path,{
  redirect,headers:{'User-Agent':'TripCaution-public-smoke/1.0'},
  signal:AbortSignal.timeout(15000)
 });
 return {response,body:await response.text()};
}
async function run(name,fn){
 try{await fn();}catch(err){result(name,false,String(err.message).slice(0,220));}
}
function check(condition,description){if(!condition)throw Error(description);}
await run('Database health',async()=>{
 const {response,body}=await get('/health');
 check(response.status===200 && JSON.parse(body).database==='ready','Expected /health=200, D1 ready; got '+response.status);
 result('Database health',true);
});
await run('Homepage and canonical',async()=>{
 const {response,body}=await get('/');
 check(response.status===200 && body.includes('Field notes for'),'Homepage missing or old build');
 check(body.includes('rel="canonical" href="'+origin+'/"'),'Homepage canonical does not use production host');
 result('Homepage and canonical',true);
});
await run('Destination index',async()=>{
 const {response,body}=await get('/destinations');
 check(response.status===200&&body.includes('Research planned'),'Destinations index not available');
 result('Destination index',true);
});
await run('Three published articles',async()=>{
 const names=['/guides/vietnam-first-taxi-ride-seven-checks','/guides/bangkok-heavy-rain-airport-transfer-plan',
 '/guides/singapore-mrt-payment-foreign-bank-cards'];
 for(const path of names){
  const {response,body}=await get(path);
  check(response.status===200&&body.includes('Sources & verification'),path+' not published/readable');
  check(body.includes('rel="canonical" href="'+origin+path+'"'),path+' canonical differs');
 }
 result('Three published articles',true,'All 3 live articles and canonicals are reachable');
});
await run('Robots host matches sitemap',async()=>{
 const {response,body}=await get('/robots.txt');
 check(response.status===200&&body.includes('Sitemap: '+origin+'/sitemap.xml'),'Robots sitemap host mismatch');
 check(body.includes('Disallow: /admin')&&body.includes('Disallow: /api/'),'Missing private-route robots directives');
 result('Robots host matches sitemap',true);
});
await run('Sitemap and published guides',async()=>{
 const {response,body}=await get('/sitemap.xml');
 check(response.status===200&&body.includes('<loc>'+origin+'/destinations</loc>'),'Sitemap missing destination index');
 check(body.includes('<loc>'+origin+'/guides/vietnam-first-taxi-ride-seven-checks</loc>'),'Live guides missing');
 result('Sitemap and published guides',true);
});
await run('Public policy and working contact configured',async()=>{
 for(const path of ['/about','/privacy','/contact']){
  const {response,body}=await get(path);
  check(response.status===200&&body.includes('TRIPCAUTION / INFORMATION'),path+' missing');
  if(path==='/privacy')check(body.includes('Cloudflare')&&body.includes('Google Fonts'),'Privacy disclosure incomplete');
  if(path==='/contact'){
   check(/href="mailto:[^"]+/.test(body),'Public editorial contact is NOT configured');
   check(!body.includes('name="robots" content="noindex'),'Contact still in pre-launch mode');
  }
 }
 result('Public policy and working contact configured',true,'Receipt must also be tested manually');
});
await run('Search and not-found handling',async()=>{
 const search=await get('/search?q=transit');
 check(search.response.status===200,'Search unavailable');
 const missing=await get('/definitely-not-a-page-tripcatch');
 check(missing.response.status===404,'Missing route not 404');
 result('Search and not-found handling',true);
});
await run('Admin redirect and unauthorized API',async()=>{
 const admin=await get('/admin',{redirect:'manual'});
 check(admin.response.status===302 && admin.response.headers.get('location')===origin+'/sign-in','Private admin redirect is incorrect; check leftover Cloudflare Access app');
 const unauthorized=await get('/api/admin/articles');
 check(unauthorized.response.status===401,'Admin API exposed or misconfigured; expected 401');
 const preview=await get('/admin/preview/a0000000-0000-4000-a000-000000000001',{redirect:'manual'});
 check(preview.response.status===302,'Unknown draft preview must require a signed session');
 result('Admin redirect and unauthorized API',true);
});
await run('Private login UI',async()=>{
 const {response,body}=await get('/sign-in');
 check(response.status===200&&body.includes('admin-key'),'Private sign-in page unavailable or key not configured');
 result('Private login UI',true);
});
const pass=results.filter(r=>r.result==='PASS').length,failed=results.filter(r=>r.result==='FAIL');
const report={origin,when:new Date().toISOString(),pass,total:results.length,failed:failed.length,results,
 manual_checks:['Open and use admin login/logout in real browser','Verify email correction request is received',
 'Check Safari on iPhone and Chrome on Android','Confirm Cloudflare production commit SHA and D1 backup/rollback rehearsal']};
writeFileSync('sprint0-production-smoke.json',JSON.stringify(report,null,2));
console.log('\nTripCaution production smoke:',pass+'/'+results.length,'PASS');
for(const r of results)console.log(r.result,r.name,r.details);
if(failed.length)process.exitCode=1;
