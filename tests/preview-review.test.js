import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const key='preview-review-test-private-key-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const id='a0000000-0000-4000-a000-000000000001';
function article(){
 return {
  id,title:'Singapore Transport Payment Test',slug:'singapore-transport-payment-test',country:'Singapore',city:'Singapore',
  category_id:'transport',category_name:'Transport Cautions',excerpt:'Travel card guidance.',
  content_markdown:'## What to check\n\nConfirm fare charges and any card fees through the official operator before travel.',
  sources_json:JSON.stringify([{title:'Official transit authority',publisher:'Transit',url:'https://example.org/transit'}]),
  hero_image_url:null,hero_alt:'',seo_title:'Transit card tips',seo_description:'A transit article.',
  verified_at:'2026-09-28T00:00:00Z',status:'review',review_approved:0
 };
}
function env(a=article()){
 const updates=[];
 const db={prepare(sql){
  let bound=[];
  const query={
   bind(...values){bound=values;return query;},
   async first(){
    if(sql.includes('FROM articles') && sql.includes('WHERE a.id=?'))return bound[0]===a?.id?a:null;
    if(sql.includes('FROM articles') && sql.includes("a.slug=? AND a.status='published'"))return a?.status==='published'&&bound[0]===a.slug?a:null;
    if(sql.includes('FROM articles') && sql.includes('WHERE id=?'))return bound[0]===a?.id?a:null;
    return null;
   },
   async run(){updates.push({sql,values:bound});return {success:true};},
   async all(){return {results:[]};}
  };
  return query;
 }};
 return {ADMIN_LOGIN_KEY:key,DB:db,updates,ASSETS:{fetch:async()=>new Response('<h1>Private editor</h1>')}};
}
const get=(url,cookie)=>new Request(origin+url,{headers:cookie?{Cookie:cookie}:{}});
async function cookie(e){return (await createAdminSession(e)).split(';')[0];}

test('a review article has a private no-index exact-layout preview, not a public guide',async()=>{
 const e=env(),auth=await cookie(e);
 const res=await worker.fetch(get('/admin/preview/'+id,auth),e);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/PRIVATE PREVIEW/);
 assert.match(html,/Singapore Transport Payment Test/);
 assert.match(html,/Official transit authority/);
 assert.match(html,/Back to editor/);
 assert.match(html,/class="article-content"/);
 assert.match(html,/name="robots" content="noindex,nofollow,noarchive"/);
 assert.doesNotMatch(html,/rel="canonical"/);
 assert.equal(res.headers.get('cache-control'),'private, no-store');
 assert.equal(res.headers.get('referrer-policy'),'no-referrer');
 const publicView=await worker.fetch(get('/guides/singapore-transport-payment-test'),e);
 assert.equal(publicView.status,404);
});

test('previews require a signed session; unknown and deleted articles are not previewable',async()=>{
 const e=env();
 const unsigned=await worker.fetch(get('/admin/preview/'+id),e);
 assert.equal(unsigned.status,302);
 assert.equal(unsigned.headers.get('location'),origin+'/sign-in');
 const auth=await cookie(e);
 const missing=await worker.fetch(get('/admin/preview/a0000000-0000-4000-a000-000000000002',auth),e);
 assert.equal(missing.status,404);
 const deleted=env({...article(),status:'deleted'});
 const authDeleted=await cookie(deleted);
 const deletedResponse=await worker.fetch(get('/admin/preview/'+id,authDeleted),deleted);
 assert.equal(deletedResponse.status,404);
 const malformed=await worker.fetch(get('/admin/preview/bad',auth),e);
 assert.equal(malformed.status,404);
});

test('publication requires an explicit reviewer confirmation after saved draft review',async()=>{
 const e=env(),auth=await cookie(e);
 const patch=async body=>worker.fetch(new Request(origin+'/api/admin/article/'+id,{
  method:'PATCH',headers:{Cookie:auth,Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 }),e);
 const skipped=await patch({action:'publish'});
 assert.equal(skipped.status,422);
 assert.match(await skipped.text(),/reviewed the selected article/);
 assert.equal(e.updates.length,0);
 const approved=await patch({action:'publish',review_confirmed:true,review_method:'single'});
 assert.equal(approved.status,200);
 assert.equal((await approved.json()).status,'published');
 assert.ok(e.updates.some(u=>u.sql.includes('UPDATE articles SET status=')));
 const audit=e.updates.find(u=>u.sql.includes('INSERT INTO audit_logs'));
 assert.ok(audit);
 assert.equal(audit.values[2],'owner-reviewed-and-published');
 const details=JSON.parse(audit.values[4]);
 assert.equal(details.review_confirmed,true);
 assert.equal(details.method,'single');
 assert.equal(details.review_window_days,30);
 assert.equal(details.evidence_note_collected,false);
});

test('scheduling is also gated by reviewer confirmation and future valid time',async()=>{
 const e=env(),auth=await cookie(e);
 const res=await worker.fetch(new Request(origin+'/api/admin/article/'+id,{
  method:'PATCH',headers:{Cookie:auth,Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({action:'schedule',scheduled_at:'2030-09-30T12:00:00Z'})
 }),e);
 assert.equal(res.status,422);
 assert.equal(e.updates.length,0);
});

test('editor has direct publish and quick bulk controls without mandatory review steps',()=>{
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 assert.match(html,/id="editor-preview-link"/);
 assert.match(html,/id="review-publish-btn" disabled/);
 assert.match(html,/id="select-all-visible"/);
 for(const action of ['publish','hide','schedule','restore','delete'])
   assert.ok(html.includes('id="bulk-'+action+'"'));
 assert.ok(html.includes('id="schedule-dialog"'));
 assert.doesNotMatch(html,/STEP 2 · EDITORIAL CHECKLIST/);
 assert.doesNotMatch(html,/STEP 3 · CLAIM–SOURCE REVIEW RECORD/);
 assert.doesNotMatch(js,/data-review-check/);
 assert.match(js,/review_confirmed:true/);
});
test('research dates are not misrepresented as a human review before new manual approval',async()=>{
 const e=env({...article(),status:'published',published_at:'2026-09-28 03:00:00'});
 const result=await worker.fetch(get('/guides/singapore-transport-payment-test'),e);
 assert.equal(result.status,200);
 const page=await result.text();
 assert.match(page,/Published: Sep 28, 2026/);
 assert.match(page,/Research reference date: Sep 28, 2026/);
 assert.doesNotMatch(page,/Last reviewed:/);
 assert.doesNotMatch(page,/VERIFIED:/);
});

test('owner confirmation and at least one HTTPS source are required; written notes are optional',async()=>{
 const e=env(),auth=await cookie(e);
 async function tryPublish(body){
  return worker.fetch(new Request(origin+'/api/admin/article/'+id,{
   method:'PATCH',headers:{Cookie:auth,Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({action:'publish',...body})
  }),e);
 }
 assert.equal((await tryPublish({review_confirmed:false})).status,422);
 assert.equal((await tryPublish({})).status,422);
 const approved=await tryPublish({review_confirmed:true});
 assert.equal(approved.status,200);
 const empty=env({...article(),sources_json:'[]'});
 const emptyAuth=await cookie(empty);
 const denied=await worker.fetch(new Request(origin+'/api/admin/article/'+id,{
  method:'PATCH',headers:{Cookie:emptyAuth,Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({action:'publish',review_confirmed:true})
 }),empty);
 assert.equal(denied.status,422);
 assert.equal(empty.updates.length,0);
});
