import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAutoPublication} from '../src/auto-publish.js';
import {normalizeArticle} from '../src/content.js';
import worker from '../src/index.js';

const token='z'.repeat(48);
const url='https://tripcaution.test/api/ingest';
const content=([
 'A specific ground-transport planning question in Singapore.',
 'Check the exact operator page for current booking and pickup instructions.',
 'Different services may have different requirements for payment and pickup.',
 'Confirm your selected service and date before you leave for the airport.'
].join(' ')).repeat(14);
const raw=()=>({
 title:'Which official ground-transport instructions should visitors check?',
 slug:'singapore-transport-source-check-sample',country:'Singapore',category:'transport',
 excerpt:'A narrowly scoped operator-checking guide.',content_markdown:content,
 source_mode:'github-automation',auto_publish:true,
 research:{
  verified_at:'2026-09-29T00:00:00Z',source_check_passed:true,evidence_conflict:false,
  sources:[{title:'Operator A',publisher:'Operator A',url:'https://operator-a.example.org/info'},
           {title:'Operator B',publisher:'Operator B',url:'https://operator-b.example.net/guide'}],
  claim_evidence:[
   {claim:'Find operator A current booking guidance for this specific service',scope:'Singapore airport transfer by service A',evidence_excerpt:'The operator publishes current pickup instructions for arriving passengers.',source_url:'https://operator-a.example.org/info',source_checked:true},
   {claim:'Find operator B current payment guidance for this specific service',scope:'Singapore airport transfer by service B',evidence_excerpt:'This operator publishes payment and pickup instructions for passengers.',source_url:'https://operator-b.example.net/guide',source_checked:true}
  ],
  uncertainties:['Instructions may change; verify with the relevant service.']
 }
});
test('unattended article needs checked excerpts from independent cited hosts',()=>{
 const obj=raw();
 assert.equal(assessAutoPublication(normalizeArticle(obj),obj).eligible,true);
 const fake=raw();fake.research.source_check_passed=false;
 assert.equal(assessAutoPublication(normalizeArticle(fake),fake).eligible,false);
 const copied=raw();copied.research.sources[1].url='https://operator-a.example.org/other';
 copied.research.claim_evidence[1].source_url='https://operator-a.example.org/other';
 assert.equal(assessAutoPublication(normalizeArticle(copied),copied).eligible,false);
});
test('high-stakes categories and claims stay private despite apparently checked URLs',()=>{
 const scam=raw();scam.category='scams-theft';
 assert.equal(assessAutoPublication(normalizeArticle(scam),scam).eligible,false);
 const accusation=raw();accusation.content_markdown+=' Claims of fraud require human review.';
 assert.equal(assessAutoPublication(normalizeArticle(accusation),accusation).eligible,false);
 const myanmar=raw();myanmar.country='Myanmar';
 assert.equal(assessAutoPublication(normalizeArticle(myanmar),myanmar).eligible,false);
 const reddit=raw();
 reddit.research.sources[0].url='https://www.reddit.com/r/travel/comments/threadA/';
 reddit.research.sources[1].url='https://old.reddit.com/r/travel/comments/threadB/';
 reddit.research.claim_evidence[0].source_url=reddit.research.sources[0].url;
 reddit.research.claim_evidence[1].source_url=reddit.research.sources[1].url;
 assert.equal(assessAutoPublication(normalizeArticle(reddit),reddit).eligible,false);
});
function fakeDB(reserved=[]){
 const statements=[],db={
  prepare(sql){
   let values=[];const q={
    bind(...v){values=v;return q;},
    async first(){return null;},
    async all(){return {results:sql.includes('SELECT source FROM automation_runs')?reserved.map(source=>({source})):[]};},
    async run(){statements.push({sql,values});return {success:true,meta:{changes:1}};}
   };return q;
  },
  async batch(actions){return Promise.all(actions.map(action=>action.run()));}
 };
 return {DB:db,statements};
}
async function ingest(db,enabled=true){
 return worker.fetch(new Request(url,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({articles:[raw()]})
 }),{...db,INGEST_TOKEN:token,AUTO_PUBLISH_ENABLED:enabled?'true':'false'});
}
test('bot only publishes unreviewed within enabled daily quota; otherwise private Review',async()=>{
 const off=fakeDB();
 const resultOff=await ingest(off,false),offData=await resultOff.json();
 assert.equal(offData.results[0].status,'review');
 assert.ok(off.statements.some(s=>s.sql.startsWith('INSERT INTO articles')&&s.values[16]==='review'));
 const on=fakeDB();
 const resultOn=await ingest(on,true),onData=await resultOn.json();
 assert.equal(resultOn.status,207);
 assert.equal(onData.results[0].status,'published');
 assert.equal(onData.results[0].review_approved,0);
 assert.ok(on.statements.some(s=>/INSERT (?:OR IGNORE )?INTO automation_runs/.test(s.sql)));
 assert.ok(on.statements.some(s=>s.sql.includes('auto-published-unreviewed')));
 const full=fakeDB(['auto-publish-1','auto-publish-2','auto-publish-3']);
 const response=await ingest(full,true),data=await response.json();
 assert.equal(data.results[0].deferred,true);
 assert.ok(!full.statements.some(s=>s.sql.startsWith('INSERT INTO articles')));
});
