import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const key='test-owner-key-'+('T'.repeat(48));
const token='test-ingest-token-'+('Z'.repeat(44));
const raw={
 title:'Safer transport tips',slug:'same-live-guide',country:'Singapore',category:'transport',
 content_markdown:'Detailed transport guidance supported by sources and editorial notes. '.repeat(10),
 excerpt:'Travel transportation revision',sources:[{title:'Operator',publisher:'Government',url:'https://example.org/transport'}],
 research:{verified_at:'2026-09-28T00:00:00Z'}
};
function fakeDB(){
 const changes=[];
 return {changes,prepare(sql){
  let args=[];
  const q={
   bind(...values){args=values;return q;},
   async first(){
    if(sql.startsWith('SELECT id,status FROM articles WHERE slug=?'))return {id:'a0000000-0000-4000-a000-000000000001',status:'published'};
    return null;
   },
   async run(){changes.push({sql,args});return {success:true};},
   async all(){return {results:[]};}
  };
  return q;
 },async batch(statements){for(const statement of statements)await statement.run();return statements.map(()=>({success:true}));}};
}
async function ownerEnv(){const e={ADMIN_LOGIN_KEY:key,INGEST_TOKEN:token,DB:fakeDB()};return [e,(await createAdminSession(e)).split(';')[0]];}
test('manual revision refuses to overwrite live records without explicit acknowledgment',async()=>{
 const [e,cookie]=await ownerEnv();
 const response=await app.fetch(new Request(origin+'/api/admin/import',{
   method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({articles:[raw],update_matching:true})
 }),e);
 assert.equal(response.status,422);
 assert.equal(e.DB.changes.length,0);
});
test('approved revision pulls existing article back into private Review and keeps its original ID',async()=>{
 const [e,cookie]=await ownerEnv();
 const response=await app.fetch(new Request(origin+'/api/admin/import',{
   method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({articles:[raw],update_matching:true,confirm_unpublish:true})
 }),e);
 assert.equal(response.status,207);
 const out=await response.json();
 assert.equal(out.results[0].status,'review');
 assert.equal(out.results[0].updated,true);
 assert.equal(out.results[0].id,'a0000000-0000-4000-a000-000000000001');
 const sql=e.DB.changes.find(v=>v.sql.includes('UPDATE articles SET'));
 assert.ok(sql?.sql.includes("status='review'"));
 assert.ok(!sql?.sql.includes('published_at=NULL'), 'Revision must retain the original publication timestamp for truthful SEO history');
 assert.ok(sql?.sql.includes('scheduled_at=NULL'));
 assert.ok(sql?.sql.includes('review_approved=0'));
 assert.ok(e.DB.changes.some(v=>v.sql.includes('INSERT INTO audit_logs')));
});
test('ingest bot cannot use editorial revision or access admin import',async()=>{
 const [e]=await ownerEnv();
 const bot=await app.fetch(new Request(origin+'/api/ingest',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({articles:[raw],update_matching:true,confirm_unpublish:true})
 }),e);
 assert.equal(bot.status,403);
 assert.equal(e.DB.changes.length,0);
 const forbidden=await app.fetch(new Request(origin+'/api/admin/import',{
   method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({articles:[raw],update_matching:true,confirm_unpublish:true})
 }),e);
 assert.equal(forbidden.status,401);
 assert.equal(e.DB.changes.length,0);
});
