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
function fakeEnv({withMedia=true,failMedia=false}={}){
 const items=new Map([
  [ids[0],{id:ids[0],status:'deleted',slug:'indonesia-one',hero_image_url:'/media/editorial/indonesia-one.webp',content_markdown:'## A\n\n![Alt](/media/editorial/indonesia-one-inline-01.webp)'}],
  [ids[1],{id:ids[1],status:'deleted',slug:'indonesia-two',hero_image_url:'/media/editorial/indonesia-two.webp',content_markdown:'No inline image'}],
  [ids[2],{id:ids[2],status:'published',slug:'indonesia-live',hero_image_url:'/media/editorial/indonesia-live.webp',content_markdown:'Published'}]
 ]);
 let audit=[
  {article_id:ids[0],action:'created'},
  {article_id:ids[0],action:'review'},
  {article_id:ids[1],action:'created'},
  {article_id:ids[2],action:'published'}
 ];
 let batches=0;
 const mediaDeleted=[];
 const env={
  ADMIN_LOGIN_KEY:key,SITE_URL:origin,items,mediaDeleted,
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
       return {count:[...items.values()].filter(v=>v.status==='deleted').length};
      return null;
     },
     async all(){
      if(sql.startsWith('SELECT id,status,slug,hero_image_url,content_markdown FROM articles WHERE id IN ('))
       return {results:values.filter(id=>items.has(id)).map(id=>({...items.get(id)}))};
      if(sql.startsWith("SELECT id,status,slug,hero_image_url,content_markdown FROM articles WHERE status='deleted'"))
       return {results:[...items.values()].filter(v=>v.status==='deleted').map(v=>({...v}))};
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
      const removal=values.length?values.filter(id=>items.get(id)?.status==='deleted'):
       [...items.values()].filter(v=>v.status==='deleted').map(v=>v.id);
      audit=audit.filter(x=>!removal.includes(x.article_id));
     }else if(sql.startsWith('DELETE FROM articles')){
      const removal=values.length?values:
       [...items.values()].filter(v=>v.status==='deleted').map(v=>v.id);
      for(const id of removal)if(items.get(id)?.status==='deleted')items.delete(id);
     }else if(sql.startsWith('INSERT INTO audit_logs')){
      audit.push({article_id:values[3],action:values[2],details:values[4]});
     }else throw Error('Unexpected query '+sql);
    }
    return [{success:true},{success:true},{success:true}];
   }
  }
 };
 if(withMedia)env.MEDIA={
  async delete(input){
   if(failMedia)throw Error('R2 unavailable');
   const list=Array.isArray(input)?input:[input];
   mediaDeleted.push(...list);
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
 assert.equal(e.mediaDeleted.length,0);
 assert.equal(e.items.size,3);
});
test('selected purge removes deleted article, audit history, hero and inline R2 images',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 const response=await post(e,payload('selected',1,[ids[0]]),cookie);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,purged:1,mode:'selected',media_deleted:2});
 assert.deepEqual(new Set(e.mediaDeleted),new Set(['editorial/indonesia-one.webp','editorial/indonesia-one-inline-01.webp']));
 assert.equal(e.items.has(ids[0]),false);
 assert.equal(e.items.get(ids[1]).status,'deleted');
 assert.equal(e.items.get(ids[2]).status,'published');
 assert.ok(e.audit.some(x=>x.article_id===ids[1]));
 assert.ok(e.audit.some(x=>x.article_id===ids[2]));
 assert.ok(e.audit.every(x=>x.article_id!==ids[0]));
 const summary=e.audit.find(x=>x.action==='permanently-purged');
 assert.equal(JSON.parse(summary.details).media_deleted,2);
});
test('Empty Trash removes all deleted rows and all article-owned R2 media, but keeps published content',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 const count=await worker.fetch(new Request(origin+'/api/admin/trash-count',{headers:{Cookie:cookie}}),e);
 assert.equal((await count.json()).count,2);
 const response=await post(e,payload('trash',2),cookie);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,purged:2,mode:'trash',media_deleted:3});
 assert.deepEqual(new Set(e.mediaDeleted),new Set([
  'editorial/indonesia-one.webp',
  'editorial/indonesia-one-inline-01.webp',
  'editorial/indonesia-two.webp'
 ]));
 assert.equal(e.items.size,1);
 assert.equal(e.items.get(ids[2]).status,'published');
 assert.ok(e.audit.some(x=>x.article_id===ids[2]));
 assert.equal(e.audit.length,2);
 assert.equal((await post(e,payload('trash',0),cookie)).status,409);
});
test('permanent purge refuses to orphan images when R2 is missing or cleanup fails',async()=>{
 const noR2=fakeEnv({withMedia:false}),cookie1=await authenticated(noR2);
 const missing=await post(noR2,payload('selected',1,[ids[0]]),cookie1);
 assert.equal(missing.status,503);
 assert.equal(noR2.items.has(ids[0]),true);
 assert.equal(noR2.batches,0);

 const broken=fakeEnv({failMedia:true}),cookie2=await authenticated(broken);
 const failed=await post(broken,payload('selected',1,[ids[0]]),cookie2);
 assert.equal(failed.status,502);
 assert.equal(broken.items.has(ids[0]),true);
 assert.equal(broken.batches,0);
});
test('only Deleted-filter UI offers hard deletion and explains R2 cleanup',()=>{
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 assert.match(html,/id="bulk-purge"/);
 assert.match(html,/id="empty-trash"/);
 assert.match(js,/status==='deleted'/);
 assert.match(js,/PERMANENTLY DELETE/);
 assert.match(js,/api\/admin\/trash-count/);
 assert.match(js,/hero\/inline images from Cloudflare R2/);
 assert.match(js,/R2 image\(s\) removed/);
});
test('permanent purge rejects >50 bound article IDs per request',async()=>{
 const e=fakeEnv(),cookie=await authenticated(e);
 const over=Array.from({length:51},(_,i)=>'a0000000-0000-4000-a000-'+String(i+1).padStart(12,'0'));
 const response=await post(e,payload('selected',over.length,over),cookie);
 assert.equal(response.status,400);
 assert.match(await response.text(),/1–50/);
 assert.equal(e.batches,0);
});
