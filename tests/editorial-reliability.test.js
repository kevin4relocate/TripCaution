import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeArticle} from '../src/content.js';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const id='a0000000-0000-4000-a000-000000000001';
const key='editorial-reliability-check-'+('R'.repeat(48));
const article=()=>({
 id,title:'Verified transport advisory',slug:'verified-transport-advisory',
 excerpt:'An article to check before publishing',country:'Singapore',
 category_id:'transport',content_markdown:'Practical verified guide. '.repeat(20),
 sources_json:'[{"title":"Official","url":"https://example.org"}]',
 uncertainties_json:'["Original open question"]',tags_json:'[]',
 seo_title:'',seo_description:'',hero_image_url:'',hero_prompt:'',hero_alt:'',
 verified_at:'2026-09-28T00:00:00Z',status:'review',review_approved:0
});
async function setup({fail=false}={}){
 const statements=[];let batches=0;
 const db={
  prepare(sql){
   let params=[];const q={
    bind(...values){params=values;return q;},
    async first(){if(sql.includes('SELECT * FROM articles WHERE id=?'))return article();return null;},
    async run(){statements.push({sql,params});return {success:true};}
   };return q;
  },
  async batch(batch){
   batches++;
   if(fail)throw Error('Simulated failed D1 audit transaction');
   for(const statement of batch)await statement.run();
   return batch.map(()=>({success:true}));
  }
 };
 const env={DB:db,ADMIN_LOGIN_KEY:key};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const patch=body=>worker.fetch(new Request(origin+'/api/admin/article/'+id,{
  method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 }),env);
 return {patch,statements,get batches(){return batches;}};
}
test('manual edit persists unresolved questions and an audit in one transaction',async()=>{
 const e=await setup();
 const reply=await e.patch({title:'Verified transport advisory',uncertainties:['Fare may change']});
 assert.equal(reply.status,200,await reply.text());
 assert.equal(e.batches,1);
 assert.equal(e.statements.length,2);
 const updated=e.statements.find(s=>s.sql.startsWith('UPDATE articles SET'));
 assert.match(updated.sql,/uncertainties_json=\?/);
 assert.ok(updated.params.includes('["Fare may change"]'));
 assert.ok(e.statements.some(s=>s.sql.startsWith('INSERT INTO audit_logs')));
});
test('manual edit fails closed when atomic audit transaction fails',async()=>{
 const e=await setup({fail:true});
 const reply=await e.patch({title:'Verified transport advisory'});
 assert.equal(reply.status,500);
 assert.equal(e.batches,1);
 assert.equal(e.statements.length,0);
});
test('normalization rejects unopenable supplied article IDs',()=>{
 const draft={title:'Transport advisory',country:'Singapore',
  content_markdown:'Practical reliable information. '.repeat(12),
  sources:[{title:'Official',url:'https://example.org'}]};
 assert.throws(()=>normalizeArticle({...draft,id:'bad-ID'}),/UUID/);
 assert.ok(normalizeArticle({...draft,id}).id===id);
});
test('editor renders source uncertainties without raw HTML and import chunks stay capped',()=>{
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 const workerSource=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');
 assert.match(html,/id="review-uncertainties"/);
 assert.match(html,/name="uncertainties"/);
 assert.match(js,/start\+=10/);
 assert.match(js,/escapeHTML\(\(typeof item==='string'/);
 assert.match(workerSource,/list.length>10/);
 assert.match(workflow,/path: sprint1-production-security\.json/);
 assert.match(workflow,/if-no-files-found: error/);
});
