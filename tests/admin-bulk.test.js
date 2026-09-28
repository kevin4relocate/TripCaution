import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
import {readFileSync} from 'node:fs';
const origin='https://tripcaution.test';
const ownerKey='owner-test-login-secret-'+('Q'.repeat(42));
const ids=[
 'a0000000-0000-4000-a000-000000000001',
 'a0000000-0000-4000-a000-000000000002',
 'a0000000-0000-4000-a000-000000000003'
];
const make=(id,status='review',sources=true)=>({
 id,title:'Article '+id.slice(-1),status,
 sources_json:sources?'[{"title":"Official","url":"https://example.org/guidance"}]':'[]',
 verified_at:null,published_at:status==='published'?'2026-09-26 02:00:00':null,
 scheduled_at:null,review_approved:0
});
function createEnv(rows){
 const data=new Map(rows.map(row=>[row.id,{...row}]));
 const audits=[],commands=[];
 const db={
  prepare(sql){
   let params=[];
   const q={
    bind(...values){params=values;return q;},
    async first(){
     if(sql==='SELECT * FROM articles WHERE id=?')return data.get(params[0])||null;
     if(sql.includes("FROM audit_logs"))return null;
     return null;
    },
    async run(){
     commands.push({sql,params});
     if(sql.startsWith("UPDATE articles SET status=")){
      const [status,approved,at,,id]=params;
      const item=data.get(id);
      Object.assign(item,{status,review_approved:approved,scheduled_at:at});
      if(status==='published')item.published_at='2026-09-28 01:00:00';
     }else if(sql.startsWith('INSERT INTO audit_logs')){
      audits.push({actor:params[1],action:params[2],id:params[3],details:params[4]});
     }
     return {success:true};
    },
    async all(){return {results:[]};}
   };
   return q;
  },
  async batch(statements){
   for(const statement of statements)await statement.run();
   return statements.map(()=>({success:true}));
  }
 };
 return {data,audits,commands,DB:db,ADMIN_LOGIN_KEY:ownerKey};
}
async function ownerCookie(e){return (await createAdminSession(e)).split(';')[0];}
async function bulk(e,body,{cookie=null,originHeader=origin}={}){
 const headers={'Content-Type':'application/json',Origin:originHeader};
 if(cookie)headers.Cookie=cookie;
 return app.fetch(new Request(origin+'/api/admin/bulk',{method:'POST',headers,body:JSON.stringify(body)}),e);
}
function requestBody(action,selected=ids,extras={}){
 return {action,ids:selected,confirm_selection:true,confirm_count:selected.length,...extras};
}
test('bulk endpoint is private, same-origin only and requires explicit selection count',async()=>{
 const e=createEnv([make(ids[0])]);
 const body=requestBody('hide',[ids[0]]);
 assert.equal((await bulk(e,body)).status,401);
 const cookie=await ownerCookie(e);
 assert.equal((await bulk(e,body,{cookie,originHeader:'https://attacker.invalid'})).status,403);
 assert.equal((await bulk(e,{...body,confirm_count:20},{cookie})).status,422);
 assert.equal((await bulk(e,{...body,confirm_selection:false},{cookie})).status,422);
 assert.equal((await bulk(e,{...body,ids:[ids[0],ids[0]],confirm_count:2},{cookie})).status,400);
 assert.equal((await bulk(e,{...body,ids:Array(301).fill(ids[0]),confirm_count:301},{cookie})).status,400);
 assert.equal(e.commands.length,0);
});
test('publish selected articles only after owner confirms review, with partial-status summary',async()=>{
 const e=createEnv([make(ids[0]),make(ids[1],'published'),make(ids[2], 'review',false)]);
 const cookie=await ownerCookie(e);
 const chosen=requestBody('publish',ids);
 assert.equal((await bulk(e,chosen,{cookie})).status,422);
 assert.equal(e.commands.length,0);
 const result=await bulk(e,{...chosen,review_confirmed:true},{cookie});
 assert.equal(result.status,207);
 const payload=await result.json();
 assert.equal(payload.processed,1);
 assert.equal(payload.failed,2);
 assert.equal(e.data.get(ids[0]).status,'published');
 assert.equal(e.data.get(ids[1]).status,'published');
 assert.equal(e.data.get(ids[2]).status,'review');
 assert.equal(e.audits.length,1);
 assert.equal(e.audits[0].action,'owner-reviewed-and-published');
 const notes=JSON.parse(e.audits[0].details);
 assert.equal(notes.review_confirmed,true);
 assert.equal(notes.method,'bulk');
 assert.equal(notes.evidence_note_collected,false);
});
test('hide is private, delete is soft and restoration never silently republishes',async()=>{
 const e=createEnv([make(ids[0],'published'),make(ids[1],'review')]);
 const cookie=await ownerCookie(e);
 let reply=await bulk(e,requestBody('hide',[ids[0],ids[1]]),{cookie});
 assert.equal(reply.status,207);
 assert.equal((await reply.json()).processed,2);
 assert.equal(e.data.get(ids[0]).status,'hidden');
 assert.equal(e.data.get(ids[1]).status,'hidden');
 reply=await bulk(e,requestBody('delete',[ids[0],ids[1]]),{cookie});
 assert.equal((await reply.json()).processed,2);
 assert.equal(e.data.get(ids[0]).status,'deleted');
 reply=await bulk(e,requestBody('restore',[ids[0]]),{cookie});
 assert.equal((await reply.json()).processed,1);
 assert.equal(e.data.get(ids[0]).status,'draft');
 assert.equal(e.data.get(ids[0]).review_approved,0);
 assert.equal(e.data.get(ids[1]).status,'deleted');
});
test('bulk schedules successful articles at 24h intervals, skipping incompatible statuses',async()=>{
 const e=createEnv([make(ids[0]),make(ids[1],'published'),make(ids[2])]);
 const cookie=await ownerCookie(e);
 const base='2030-09-29T04:00:00.000Z';
 const body=requestBody('schedule',ids,{
  review_confirmed:true,scheduled_at:base,stagger_days:true
 });
 const reply=await bulk(e,body,{cookie});
 assert.equal(reply.status,207);
 const out=await reply.json();
 assert.equal(out.processed,2);
 assert.equal(out.failed,1);
 assert.equal(e.data.get(ids[0]).scheduled_at,base);
 assert.equal(e.data.get(ids[2]).scheduled_at,'2030-09-30T04:00:00.000Z');
 assert.equal(e.data.get(ids[1]).status,'published');
 assert.equal(e.audits.filter(x=>x.action==='owner-reviewed-and-scheduled').length,2);
});
test('scheduled owner-reviewed records remain eligible for hourly publication',async()=>{
 const e=createEnv([make(ids[0])]);const cookie=await ownerCookie(e);
 const response=await bulk(e,requestBody('schedule',[ids[0]],{
  review_confirmed:true,scheduled_at:'2030-09-29T04:00:00.000Z'
 }),{cookie});
 assert.equal((await response.json()).processed,1);
 const log=e.audits.find(x=>x.action==='owner-reviewed-and-scheduled');
 assert.ok(log);
 assert.equal(JSON.parse(log.details).review_confirmed,true);
 let scheduledSql='',job;
 const cronDb={prepare(sql){scheduledSql=sql;return {async run(){}};}};
 app.scheduled({}, {DB:cronDb},{waitUntil(p){job=p;}});
 await job;
 assert.match(scheduledSql,/owner-reviewed-and-scheduled/);
 assert.match(scheduledSql,/review_confirmed/);
});
test('quick review layout includes source-preview links and visible-only select-all',()=>{
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 assert.match(html,/id="select-all-visible"/);
 assert.match(html,/id="bulk-toolbar"/);
 assert.match(html,/id="schedule-stagger"/);
 assert.match(html,/id="review-source-links"/);
 assert.doesNotMatch(html,/data-review-check/);
 assert.doesNotMatch(html,/review-evidence-note-input/);
 assert.match(js,/function visibleArticles\(/);
 assert.match(js,/function selectedVisible\(/);
 assert.match(js,/confirm_count:count/);
 assert.match(js,/review_confirmed:\['publish','schedule'\]/);
 assert.match(js,/openSchedule\('bulk',selectedVisible\(\)/);
});
