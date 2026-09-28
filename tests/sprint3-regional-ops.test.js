import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const key='sprint3-editorial-test-'+('S'.repeat(48));
async function fixture(){
 const calls=[];
 const db={prepare(sql){
  let args=[];
  const stmt={
   bind(...values){args=values;return stmt;},
   async first(){
    calls.push({sql,args,kind:'first'});
    if(sql.includes('COUNT(*) count')&&sql.includes("status IN ('review'"))return {count:103};
    if(sql.includes('COUNT(*) count'))return {count:65};
    return null;
   },
   async all(){
    calls.push({sql,args,kind:'all'});
    if(sql.includes('GROUP BY country'))return {results:[{country:'Singapore',published:2,pipeline:1},{country:'Vietnam',published:0,pipeline:2}]};
    if(sql.includes('FROM articles WHERE status IN'))return {results:[{id:'queue-1',status:'review'}]};
    return {results:[{id:'article-1',title:'Example',status:'review'}]};
   }
  };
  return stmt;
 }};
 const env={DB:db,ADMIN_LOGIN_KEY:key};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const get=path=>worker.fetch(new Request(origin+path,{headers:{Cookie:cookie}}),env);
 return {get,calls};
}
test('admin articles are paged, bounded, searchable and status filtered on server',async()=>{
 const x=await fixture();
 const res=await x.get('/api/admin/articles?page=2&status=review&q=100%25');
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.page,2);
 assert.equal(data.pages,3);
 assert.equal(data.pageSize,30);
 assert.equal(data.total,65);
 const count=x.calls.find(call=>call.kind==='first'&&call.sql.includes('COUNT(*)'));
 const list=x.calls.find(call=>call.kind==='all'&&call.sql.includes('LIMIT ? OFFSET ?'));
 assert.match(count.sql,/status=\?/);
 assert.match(count.sql,/instr\(lower\(/);
 assert.deepEqual(count.args,['review','100%']);
 assert.deepEqual(list.args,['review','100%',30,30]);
 assert.doesNotMatch(list.sql,/LIKE/);
});
test('page validation fails closed and out of range pages clamp to last page',async()=>{
 const x=await fixture();
 for(const param of ['0','-1','1.2','NaN','10001']){
  const res=await x.get('/api/admin/articles?page='+param);
  assert.equal(res.status,400,param);
 }
 const last=await x.get('/api/admin/articles?page=100');
 assert.equal(last.status,200);
 assert.equal((await last.json()).page,3);
 const sql=x.calls.find(call=>call.kind==='all'&&call.sql.includes('LIMIT ? OFFSET ?'));
 assert.equal(sql.args.at(-1),60);
});
test('queue count cannot silently hide overflow and coverage is based on actual published status',async()=>{
 const x=await fixture();
 const queue=await(await x.get('/api/admin/queue')).json();
 assert.equal(queue.limited,true);
 assert.equal(queue.total,103);
 const coverage=await(await x.get('/api/admin/coverage')).json();
 assert.equal(coverage.totalCountries,11);
 assert.equal(coverage.publishedCountries,1);
 assert.equal(coverage.coverage.find(row=>row.country==='Singapore').published,2);
 assert.equal(coverage.coverage.find(row=>row.country==='Vietnam').pipeline,2);
 assert.equal(coverage.coverage.find(row=>row.country==='Cambodia').published,0);
 const sql=x.calls.find(call=>call.sql.includes('GROUP BY country'));
 assert.match(sql.sql,/published_at<=datetime/);
 assert.equal(sql.args.length,11);
});
test('Sprint 3 editor has genuine server pagination, separate queue and regional progress UI',()=>{
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 assert.match(js,/function loadArticlePage\(/);
 assert.match(js,/api\('\/api\/admin\/articles\?'\+query\)/);
 assert.match(js,/api\('\/api\/admin\/queue'\)/);
 assert.match(js,/api\('\/api\/admin\/coverage'\)/);
 for(const id of ['page-prev','page-next','page-info','region-progress','region-tiles','queue-limit-note'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
