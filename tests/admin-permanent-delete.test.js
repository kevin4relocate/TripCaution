import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
import {readFileSync} from 'node:fs';

const origin='https://tripcaution.test';
const key='test-permanent-delete-key-'+('L'.repeat(42));
const ids=[
 'a0000000-0000-4000-a000-000000000001',
 'a0000000-0000-4000-a000-000000000002',
 'a0000000-0000-4000-a000-000000000003'
];
function fakeEnv(){
 const items=new Map([[ids[0],'deleted'],[ids[1],'deleted'],[ids[2],'published']]);
 let audit=[
  {article_id:ids[0],action:'created'},
  {article_id:ids[0],action:'review'},
  {article_id:ids[1],action:'created'},
  {article_id:ids[2],action:'published'}
 ];
 let batches=0;
 const env={
  ADMIN_LOGIN_KEY:key,items,
  get audit(){return audit;},
  get batches(){return batches;},
  DB:{
   prepare(sql){
    let values=[];
    const stmt={
     sql,get values(){return values;},
     bind(...args){values=args;return stmt;},
     async first(){
      if(sql.includes('COUNT(*)')&&sql.includes("WHERE status='deleted'"))
       return {count:[...items.values()].filter(v=>v==='deleted').length};
      return null;
     },
     async all(){
      if(sql.startsWith('SELECT id,status FROM articles WHERE id IN ('))
       return {results:values.filter(id=>items.has(id)).map(id=>({id,status:items.get(id)}))};
      return {results:[]};
     }
    };
    return stmt;
   },
   async batch(statements){
    batches++;
    for(const statement of statements){
     const {sql,values}=statement;
     if(sql.startsWith('DELETE FROM audit_logs')){
      const removal=values.length?values.filter(id=>items.get(id)==='deleted'):
       [...items.entries()].filter(([,status])=>status==='deleted').map(([id])=>id);
      audit=audit.filter(x=>!removal.includes(x.article_id));
     }else if(sql.startsWith('DELETE FROM articles')){
      const removal=values.length?values:
       [...items.entries()].filter(([,status])=>status==='deleted').map(([id])=>id);
      for(const id of removal)if(items.get(id)==='deleted')items.delete(id);
     }else if(sql.startsWith('INSERT INTO audit_logs')){
      audit.push({article_id:values[3],action:values[2],details:values[4]});
     }else throw Error('Unexpected query '+sql);
    }
    return [{success:true},{success:true},{success:true}];
   }
  }
 };
 return env;
}
async function authenticated(e){
 return (await createAdminSession(e)).split(';')[0];
}
async function post(e,body,cookie,source=origin){
 return worker.fetch(new Request(origin+'/api/admin/purge',{
  method:'POST',
  headers:{Origin:source,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
  body:JSON.stringify(body)
 }),e);
}
const payload=(mode,confirm_count,idsList)=>({
 mode,confirmation:'PERMANENTLY DELETE',confirm_count,
 ...(idsList?{ids:idsList}:{})
});

test('permanent deletion is private and same-origin only',async()=>{
 const e=fakeEnv();
 assert.equal((await post(e,payload('trash',2))).status,401);
 const cookie=await authenticated(e);
 assert.equal((await post(e,payload('trash',2),cookie,'https://malicious.invalid')).status,403);
 assert.equal(e.batches,0);
 assert.equal(e.items.size,3);
});
test('permanent deletion requires exact phrase, correct count and valid mode',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 assert.equal((await post(e,{...payload('trash',2),confirmation:'delete'},cookie)).status,422);
 assert.equal((await post(e,payload('trash',1),cookie)).status,409);
 assert.equal((await post(e,{...payload('trash',2),ids:[ids[0]]},cookie)).status,400);
 assert.equal((await post(e,payload('wrong',2),cookie)).status,400);
 assert.equal(e.batches,0);
});
test('permanently selected deletion is all-or-nothing when a row is not already Deleted',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 assert.equal((await post(e,payload('selected',2,[ids[0],ids[2]]),cookie)).status,409);
 assert.equal(e.batches,0);
 assert.equal(e.items.size,3);
});
test('selected purge removes only deleted articles and their individual audit history',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 const response=await post(e,payload('selected',1,[ids[0]]),cookie);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,purged:1,mode:'selected',r2_unchanged:true});
 assert.equal(e.items.has(ids[0]),false);
 assert.equal(e.items.get(ids[1]),'deleted');
 assert.equal(e.items.get(ids[2]),'published');
 assert.ok(e.audit.some(x=>x.article_id===ids[1]));
 assert.ok(e.audit.some(x=>x.article_id===ids[2]));
 assert.ok(e.audit.every(x=>x.article_id!==ids[0]));
 const summary=e.audit.find(x=>x.action==='permanently-purged');
 assert.ok(summary);
 assert.equal(summary.article_id,null);
 assert.equal(JSON.parse(summary.details).count,1);
 assert.ok(!summary.details.includes(ids[0]));
});
test('Empty Trash uses entire server count and keeps published articles',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 const count=await worker.fetch(new Request(origin+'/api/admin/trash-count',{headers:{Cookie:cookie}}),e);
 assert.equal((await count.json()).count,2);
 const response=await post(e,payload('trash',2),cookie);
 assert.equal(response.status,200);
 assert.equal((await response.json()).purged,2);
 assert.equal(e.items.size,1);
 assert.equal(e.items.get(ids[2]),'published');
 assert.ok(e.audit.some(x=>x.article_id===ids[2]));
 assert.equal(e.audit.length,2); // published history + one aggregate purge event
 assert.equal((await post(e,payload('trash',0),cookie)).status,409);
});
test('only Deleted-filter UI offers hard deletion and confirms typing',()=>{
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 assert.match(html,/id="bulk-purge"/);
 assert.match(html,/id="empty-trash"/);
 assert.match(js,/status==='deleted'/);
 assert.match(js,/PERMANENTLY DELETE/);
 assert.match(js,/api\/admin\/trash-count/);
 assert.match(js,/Only articles already in Deleted/);
});
