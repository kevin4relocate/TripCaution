import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
import {normalizeArticle} from '../src/content.js';
import {CAUTION_LEVELS,cautionLevel,severeCaution} from '../src/severity.js';

const origin='https://tripcaution.test';
const key='sprint5-severity-test-'+('V'.repeat(48));
const id='a0000000-0000-4000-a000-000000000001';
const rationale='The operator can refuse the described payment method, and a traveler without a verified fallback may be stranded at that particular venue.';
const scope='At this named venue with this visitor-issued card; not every merchant in the country.';
const article=(level='high')=>({
 id,title:'Specific payment or safety case',slug:'specific-payment-or-safety-case',
 country:'Singapore',city:'Singapore',category_id:'payments-money',
 category_name:'Payments & Money',status:'review',review_approved:0,
 excerpt:'A narrowly scoped researched caution',
 content_markdown:'## Specific situation\n\nResearch the operator and the exact traveler circumstances before using a level.\n\n## What to do\n\nCheck original sources and available alternatives.',
 sources_json:JSON.stringify([{title:'Direct operator',url:'https://example.org/operator',publisher:'Operator'}]),
 uncertainties_json:'[]',caution_level:level,severity_scope:scope,
 severity_rationale:rationale,hero_image_url:null,hero_alt:'',seo_title:'',
 seo_description:'',verified_at:'2026-09-28T00:00:00Z',
 published_at:'2026-09-28 02:00:00'
});
async function fixture(level='high'){
 let a=article(level);const updates=[],calls=[];
 const db={prepare(sql){
  let params=[];const stmt={
   bind(...items){params=items;return stmt;},
   async first(){
    calls.push({sql,params,kind:'first'});
    if(sql.includes('SELECT * FROM articles WHERE id=?'))return params[0]===id?a:null;
    if(sql.includes('a.slug=?')&&sql.includes("a.status='published'"))return a.status==='published'?a:null;
    if(sql.includes('WHERE a.id=?'))return a;
    return null;
   },
   async all(){calls.push({sql,params,kind:'all'});return {results:[]};},
   async run(){updates.push({sql,params});return {success:true};}
  };return stmt;
 },async batch(statements){
   for(const item of statements)await item.run();
   return statements.map(()=>({success:true}));
 }};
 const env={DB:db,ADMIN_LOGIN_KEY:key,SITE_URL:origin};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const patch=body=>worker.fetch(new Request(origin+'/api/admin/article/'+id,{
  method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)
 }),env);
 const bulk=body=>worker.fetch(new Request(origin+'/api/admin/bulk',{
  method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)
 }),env);
 return {patch,bulk,updates,calls,env,setArticle:v=>a=v};
}
test('levels classify impact of one event, not likelihood or country danger',()=>{
 assert.deepEqual(CAUTION_LEVELS.map(x=>x.id),['unassessed','low','moderate','high','critical']);
 assert.equal(cautionLevel('invalid').id,'unassessed');
 assert.equal(severeCaution('high'),true);
 assert.equal(severeCaution('moderate'),false);
 const draft=normalizeArticle({title:'A researched issue',country:'Singapore',
  content_markdown:'A description that requires original verification. '.repeat(9),
  caution_level:'critical',severity_scope:scope,severity_rationale:rationale});
 assert.equal(draft.caution_level,'critical');
 assert.equal(draft.severity_scope,scope);
});
test('high impact publication requires individual scope, evidence and explicit approval',async()=>{
 const f=await fixture();
 let res=await f.patch({action:'publish',review_confirmed:true});
 assert.equal(res.status,422);
 assert.match(await res.text(),/Explicitly confirm/);
 assert.equal(f.updates.length,0);
 res=await f.patch({action:'publish',review_confirmed:true,severity_confirmed:true,review_method:'single'});
 assert.equal(res.status,200);
 assert.equal(f.updates.length,2);
 const audit=f.updates.find(row=>row.sql.includes('INSERT INTO audit_logs'));
 assert.equal(JSON.parse(audit.params[4]).impact_level,'high');
 assert.equal(JSON.parse(audit.params[4]).review_window_days,7);
 assert.equal(JSON.parse(audit.params[4]).severity_confirmed,true);
});
test('unscoped or unexplained graded claims are blocked; legacy unassessed publication remains possible',async()=>{
 let f=await fixture('critical');
 f.setArticle({...article('critical'),severity_scope:'whole world',severity_rationale:'Unverified'});
 let res=await f.patch({action:'publish',review_confirmed:true,severity_confirmed:true});
 assert.equal(res.status,422);
 assert.match(await res.text(),/specific situation/);
 assert.equal(f.updates.length,0);
 f=await fixture('critical');
 res=await f.patch({action:'schedule',scheduled_at:'2035-09-30T12:00:00Z',review_confirmed:true,severity_confirmed:true});
 assert.equal(res.status,200);
 assert.equal(JSON.parse(f.updates.find(row=>row.sql.includes('INSERT INTO audit_logs')).params[4]).review_window_days,2);
 f=await fixture('unassessed');
 res=await f.patch({action:'publish',review_confirmed:true});
 assert.equal(res.status,200);
 assert.equal(f.updates.length,2);
});
test('bulk publish high or critical never bypasses individual review, even when confirmed',async()=>{
 const f=await fixture('critical');
 const res=await f.bulk({ids:[id],action:'publish',confirm_selection:true,confirm_count:1,
  review_confirmed:true,severity_confirmed:true});
 assert.equal(res.status,207);
 const data=await res.json();
 assert.equal(data.processed,0);
 assert.match(data.results[0].error,/individual review/);
 assert.equal(f.updates.length,0);
});
test('edit accepts a scoped level, persists it with audit; rejects invalid ratings',async()=>{
 const f=await fixture('unassessed');
 let res=await f.patch({title:'Specific payment or safety case',caution_level:'moderate',
  severity_scope:scope,severity_rationale:rationale});
 assert.equal(res.status,200,await res.text());
 assert.equal(f.updates.length,2);
 const update=f.updates.find(row=>row.sql.startsWith('UPDATE articles SET'));
 assert.match(update.sql,/severity_scope=\?,severity_rationale=\?/);
 assert.ok(update.params.includes('moderate'));
 assert.ok(update.params.includes(rationale));
 const other=await fixture('unassessed');
 res=await other.patch({caution_level:'emergency-unverified'});
 assert.equal(res.status,422);
 assert.equal(other.updates.length,0);
});
test('article panel describes narrow context and escapes user-supplied HTML',async()=>{
 const f=await fixture();
 f.setArticle({...article('critical'),status:'published',
  severity_scope:'Specific venue: <img src=x onerror=alert(1)>',
  severity_rationale:rationale+' <script>unsafe</script>'});
 const res=await worker.fetch(new Request(origin+'/guides/specific-payment-or-safety-case'),f.env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/Potential impact · Critical impact/);
 assert.match(html,/For this situation only/);
 assert.match(html,/not its likelihood/);
 assert.doesNotMatch(html,/<script>unsafe<\/script>/);
 assert.doesNotMatch(html,/<img src=x onerror=/);
});
test('old published guides do not acquire invented impact ratings',async()=>{
 const f=await fixture('unassessed');
 f.setArticle({...article('unassessed'),status:'published',
  severity_scope:'',severity_rationale:''});
 const res=await worker.fetch(new Request(origin+'/guides/specific-payment-or-safety-case'),f.env);
 assert.equal(res.status,200);
 assert.doesNotMatch(await res.text(),/class="impact-panel/);
});
test('AI import ignores any preassigned severity, creates a private review item',async()=>{
 const f=await fixture('unassessed');
 const received=[];
 f.env.INGEST_TOKEN='B'.repeat(48);
 f.env.DB.prepare=sql=>{
  let params=[];const stmt={bind(...items){params=items;return stmt;},
   async first(){return null;},
   async run(){received.push({sql,params});return {success:true};}};
  return stmt;
 };
 const payload={title:'Claim needing verification',country:'Singapore',category:'safety-health',
  content_markdown:'Unverified advice requiring primary sources and human review. '.repeat(5),
  caution_level:'critical',severity_scope:scope,severity_rationale:rationale,
  sources:[{title:'Source',url:'https://example.org'}]};
 const res=await worker.fetch(new Request(origin+'/api/ingest',{method:'POST',
  headers:{Authorization:'Bearer '+f.env.INGEST_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({articles:[payload]})}),f.env);
 assert.equal(res.status,207);
 const body=await res.json();
 assert.equal(body.results[0].status,'review');
 const insert=received.find(x=>x.sql.startsWith('INSERT INTO articles'));
 assert.deepEqual(insert.params.slice(-3),['unassessed','','']);
});
test('migration is additive and Admin includes a saved editor-only high impact confirmation',()=>{
 const sql=readFileSync(new URL('../migrations/0003_editorial_caution_levels.sql',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 for(const name of ['caution_level','severity_scope','severity_rationale'])assert.ok(sql.includes('ADD COLUMN '+name));
 assert.doesNotMatch(sql,/(DROP TABLE|UPDATE articles)/);
 for(const field of ['caution_level','severity_scope','severity_rationale'])assert.ok(html.includes('name="'+field+'"'));
 assert.match(html,/id="severity-confirm"/);
 assert.match(js,/severity_confirmed:/);
});
