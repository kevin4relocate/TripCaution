import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
const origin='https://tripcaution.nghiep4tube.workers.dev';
const token='test-token-'+('n'.repeat(38));
const adminKey='test-admin-key-'+('x'.repeat(42));
function fakeDB(){
 const inserts=[];
 return {inserts,prepare(sql){
  let params=[];
  const q={
   bind(...values){params=values;return q;},
   async first(){return null;},
   async run(){if(sql.startsWith('INSERT INTO articles'))inserts.push(params);return {success:true};},
   async all(){return {results:[]};}
  };
  return q;
 },async batch(statements){for(const statement of statements)await statement.run();return statements.map(()=>({success:true}));}};
}
const article=category=>({
 title:'Sample guide for '+category,slug:'sample-guide-'+category,
 country:'Singapore',category,source_mode:'github-automation',
 excerpt:'A practical guide with research for first-time travelers.',
 content_markdown:'Practical travel guidance linked to two independent sources. '.repeat(6),
 research:{verified_at:'2026-09-28T02:00:00Z',sources:[
  {title:'Primary authority',url:'https://example.org/primary',publisher:'Authority'},
  {title:'Official transit authority',url:'https://example.org/transit',publisher:'Transit'}
 ]},
 publishing:{preferred_publish_at:'2026-10-10T08:00:00Z'}
});

for(const category of ['before-you-go','etiquette','transport']){
 test('bot ingest can never publish '+category+' despite evidence, timestamp and schedule',async()=>{
  const db=fakeDB();
  const env={DB:db,INGEST_TOKEN:token,ADMIN_LOGIN_KEY:adminKey};
  const result=await app.fetch(new Request(origin+'/api/ingest',{method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({articles:[article(category)]})
  }),env);
  assert.equal(result.status,207);
  const payload=await result.json();
  assert.equal(payload.results[0].status,'review');
  assert.equal(db.inserts.length,1);
  // Insert args: [id,title,slug,excerpt,content,country,city,category,tags,
  // sources,uncertainties,seo_title,seo_desc,image,prompt,alt,status,mode,
  // review_approved,verified_at,published_at,scheduled_at].
  assert.equal(db.inserts[0][16],'review');
  assert.equal(db.inserts[0][18],0);
  assert.equal(db.inserts[0][20],null);
  assert.equal(db.inserts[0][17],'github-automation');
 });
}

test('an ingest bearer token cannot enter the admin API or publish through admin action',async()=>{
 const env={DB:fakeDB(),INGEST_TOKEN:token,ADMIN_LOGIN_KEY:adminKey};
 for(const [path,method] of [['/api/admin/articles','GET'],['/api/admin/auto-schedule','POST']]){
  const result=await app.fetch(new Request(origin+path,{
   method,headers:{Authorization:'Bearer '+token,Origin:origin},
   ...(method==='POST'?{body:'{}'}:{})
  }),env);
  assert.equal(result.status,401);
 }
});

test('robots directive always uses configured canonical production hostname',async()=>{
 for(const host of ['https://tripcaution.nghiep4tube.workers.dev','https://www.example.org']){
  const response=await app.fetch(new Request(host+'/robots.txt'),{SITE_URL:host});
  assert.equal(response.status,200);
  const text=await response.text();
  assert.ok(text.includes('Sitemap: '+host+'/sitemap.xml'));
  assert.ok(text.includes('Disallow: /admin'));
  assert.ok(text.includes('Disallow: /api/'));
  assert.ok(!text.includes('https://tripcaution.com/sitemap.xml'));
 }
});

test('legal pages describe current site operations; public contact requires a real configured inbox',async()=>{
 const base={};
 for(const path of ['/about','/privacy','/contact']){
  const response=await app.fetch(new Request(origin+path),base);
  assert.equal(response.status,200);
  const html=await response.text();
  assert.ok(html.includes('TripCaution'));
  assert.ok(!html.includes('contact details we publish once'));
 }
 const noInbox=await (await app.fetch(new Request(origin+'/contact'),base)).text();
 assert.match(noInbox,/noindex/);
 const unverified=await (await app.fetch(new Request(origin+'/contact'),
  {EDITORIAL_CONTACT_EMAIL:'contact@not-yet-operational.example'})).text();
 assert.match(unverified,/name="robots" content="noindex/);
 assert.ok(!unverified.includes('mailto:contact@not-yet-operational.example'));
 const withInbox=await app.fetch(new Request(origin+'/contact'),
  {EDITORIAL_CONTACT_EMAIL:'editorial@example.org',EDITORIAL_CONTACT_VERIFIED:'true'});
 const html=await withInbox.text();
 assert.ok(html.includes('mailto:editorial@example.org'));
 assert.ok(!html.includes('name="robots" content="noindex'));
 const privacy=await (await app.fetch(new Request(origin+'/privacy'),base)).text();
 assert.match(privacy,/Google Fonts/);
 assert.match(privacy,/Cloudflare/);
});

test('hourly cron requires persisted human evidence and legacy batch scheduling is disabled',async()=>{
 let updateSql='',task;
 const db={prepare(sql){
   updateSql=sql;
   return {async run(){return {success:true};}};
 }};
 app.scheduled({}, {DB:db}, {waitUntil(p){task=p;}});
 await task;
 assert.match(updateSql,/review_approved=1/);
 assert.match(updateSql,/reviewed-and-scheduled/);
 assert.match(updateSql,/json_valid/);
 assert.match(updateSql,/evidence_note/);
 const env={DB:fakeDB(),ADMIN_LOGIN_KEY:adminKey};
 const {createAdminSession}=await import('../src/auth.js');
 const cookie=(await createAdminSession(env)).split(';')[0];
 const response=await app.fetch(new Request(origin+'/api/admin/auto-schedule',{
  method:'POST',headers:{Origin:origin,Cookie:cookie},body:'{}'
 }),env);
 assert.equal(response.status,403);
});
