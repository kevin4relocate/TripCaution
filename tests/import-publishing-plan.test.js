import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessImportPublishingPlan} from '../src/import-publishing.js';
import {createAdminSession} from '../src/auth.js';
import worker from '../src/index.js';

const url='https://tripcaution.test',secret='t'.repeat(48);
const time='2030-06-01T10:00:00+07:00';
function entry(status='review'){
 return {title:'Country-specific airport transfer instructions',slug:'airport-transfer-checks-import',
  country:'Singapore',category:'transport',excerpt:'Preparing for airport transfers.',
  content_markdown:'Confirm the exact station and terminal before booking. '.repeat(8),
  research:{sources:[{title:'Official airport site',publisher:'Airport',url:'https://airport.example.org'}]},
  publishing:{mode:'manual_import',requested_status:status,
   preferred_publish_at:status==='scheduled'||status==='schedule'?time:null}};
}
function mockDB(){
 const saved=[];
 const DB={prepare(sql){
  let args=[];const statement={bind(...v){args=v;return statement;},
   async first(){return null;},
   async run(){saved.push({sql,args});return {success:true,meta:{changes:1}};},
   async all(){return {results:[]}}};
  return statement;
 },async batch(actions){return Promise.all(actions.map(a=>a.run()))}};
 return {DB,saved};
}
async function importAsOwner(e,apply=true){
 const {DB,saved}=mockDB(),env={DB,ADMIN_LOGIN_KEY:secret};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const result=await worker.fetch(new Request(url+'/api/admin/import',{
  method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},
  body:JSON.stringify({articles:[e],apply_publishing_plan:apply,confirm_publishing_plan:apply})
 }),env);
 return {response:result,data:await result.json(),saved};
}
test('publishing instructions support published, scheduled, review and action aliases',()=>{
 assert.equal(assessImportPublishingPlan(entry('published')).status,'published');
 assert.equal(assessImportPublishingPlan(entry('publish')).status,'published');
 assert.equal(assessImportPublishingPlan(entry('schedule')).status,'scheduled');
 assert.equal(assessImportPublishingPlan(entry('scheduled')).scheduled_at,time);
 assert.equal(assessImportPublishingPlan(entry('review')).status,'review');
 const past=entry('scheduled');past.publishing.preferred_publish_at='2020-01-01T00:00:00Z';
 assert.equal(assessImportPublishingPlan(past).allowed,false);
});
test('an owner-imported published article becomes live without dashboard review',async()=>{
 const r=await importAsOwner(entry('published'));
 assert.equal(r.response.status,207);
 assert.equal(r.data.results[0].status,'published');
 const article=r.saved.find(s=>s.sql.startsWith('INSERT INTO articles'));
 assert.equal(article.args[16],'published');
 assert.equal(article.args[17],'owner-import');
 assert.equal(article.args[18],0);
 assert.ok(article.args[20]);
 assert.ok(r.saved.some(s=>s.args.includes('owner-import-published')));
});
test('scheduled import persists future timestamp and an authorization audit',async()=>{
 const r=await importAsOwner(entry('scheduled'));
 assert.equal(r.data.results[0].status,'scheduled');
 const article=r.saved.find(s=>s.sql.startsWith('INSERT INTO articles'));
 assert.equal(article.args[16],'scheduled');
 assert.equal(article.args[18],0);
 assert.equal(article.args[21],time);
 assert.ok(r.saved.some(s=>s.args.includes('owner-import-scheduled')));
 const workerSource=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(workerSource,/source_mode='owner-import'/);
 assert.match(workerSource,/ai.action='owner-import-scheduled'/);
});
test('review stays private; unchecked import does not obey the file live instruction',async()=>{
 const privateImport=await importAsOwner(entry('review'));
 assert.equal(privateImport.data.results[0].status,'review');
 const disabled=await importAsOwner(entry('published'),false);
 assert.equal(disabled.data.results[0].status,'review');
});
test('invalid scheduled date does not create a public or private article',async()=>{
 const broken=entry('scheduled');broken.publishing.preferred_publish_at='not-a-date';
 const r=await importAsOwner(broken);
 assert.equal(r.data.results[0].ok,false);
 assert.equal(r.saved.length,0);
});
test('unsigned, bot-token-only import cannot apply a publishing plan',async()=>{
 const env={INGEST_TOKEN:'x'.repeat(48),DB:mockDB().DB};
 const result=await worker.fetch(new Request(url+'/api/ingest',{
  method:'POST',headers:{Authorization:'Bearer '+env.INGEST_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({articles:[entry('published')],apply_publishing_plan:true,confirm_publishing_plan:true})
 }),env);
 assert.equal(result.status,403);
});
