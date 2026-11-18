import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditCautionPackage} from '../src/research-audit.js';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const key='research-preflight-test-'+('K'.repeat(48));
const base={
 title:'The exact service and payment problem',slug:'service-payment-problem',
 country:'Singapore',category:'payments-money',
 content_markdown:'Compare this exact payment method with the merchant source. '.repeat(5),
 research:{
  sources:[{title:'Merchant policy',publisher:'Merchant',url:'https://example.org/payment'}],
  claim_evidence:[{claim:'A specific card is not accepted at this merchant',source_url:'https://example.org/payment',scope:'This merchant and named card type only'}],
  uncertainties:['Check the merchant policy again before publishing.']
 }
};
test('research quality preflight preserves context and cannot auto-verify sources',()=>{
 const r=auditCautionPackage({articles:[base]});
 assert.equal(r.ok,true);
 assert.equal(r.count,1);
 assert.deepEqual(r.countries,['Singapore']);
 assert.ok(r.warnings.some(x=>x.includes('only one cited URL')));
 assert.ok(!r.warnings.some(x=>x.includes('no claim-to-source')));
});
test('batch preflight flags exact repeat titles by country even when slugs differ',()=>{
 const r=auditCautionPackage({articles:[base,{...base,slug:'another-slug'}]});
 assert.equal(r.ok,false);
 assert.match(r.problems.join(' '),/repeated title in the same country/);
 const duplicateSlug=auditCautionPackage({articles:[base,{...base,title:'Different topic'}]});
 assert.equal(duplicateSlug.ok,false);
 assert.match(duplicateSlug.problems.join(' '),/duplicate slug/);
});
test('unmapped claims, invalid HTTPS and imported danger labels receive warnings without automatic ratings',()=>{
 const r=auditCautionPackage({articles:[{...base,caution_level:'critical',
  research:{sources:[{url:'javascript:alert(1)'}],claim_evidence:[{claim:'An unverified serious problem',source_url:'https://elsewhere.test',scope:'the whole country'}]}}]});
 assert.equal(r.ok,true);
 const warning=r.warnings.join(' ');
 assert.match(warning,/invalid HTTPS/);
 assert.match(warning,/does not match a listed HTTPS source/);
 assert.match(warning,/imported impact labels are ignored/);
});
test('signed editor can inspect draft provenance without writing to D1',async()=>{
 let mutations=0;
 const env={ADMIN_LOGIN_KEY:key,DB:{prepare(){mutations++;throw Error('Read-only preflight must not query DB');}}};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const req=async auth=>worker.fetch(new Request(origin+'/api/admin/research-audit',{method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},
  body:JSON.stringify({articles:[base]})}),env);
 const response=await req(true);
 assert.equal(response.status,200);
 assert.equal((await response.json()).ok,true);
 assert.equal(mutations,0);
 const anonymous=await req(false);
 assert.equal(anonymous.status,401);
});
test('ingest rejects second same-country title under a different slug before mutating DB',async()=>{
 let writes=0;const token='research-import-token-'+('S'.repeat(44));
 const env={INGEST_TOKEN:token,DB:{prepare(sql){
  const q={bind(){return q;},async first(){
   if(sql.includes('lower(country)=lower(?)'))return {id:'a0000000-0000-4000-a000-000000000001',title:base.title};
   return null;
  },async run(){writes++;return {success:true};}};
  return q;
 },async batch(){writes++;return [];}}};
 const response=await worker.fetch(new Request(origin+'/api/ingest',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({articles:[base]})}),env);
 assert.equal(response.status,207);
 const data=await response.json();
 assert.equal(data.results[0].ok,false);
 assert.match(data.results[0].error,/Possible duplicate title/);
 assert.equal(writes,0);
});
test('CLI and editor expose a truthful preparation check',()=>{
 const admin=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const script=readFileSync(new URL('../scripts/audit-caution-drafts.mjs',import.meta.url),'utf8');
 assert.match(admin,/id="research-check-btn"/);
 assert.match(admin,/id="research-check-result"/);
 assert.match(script,/auditCautionPackage/);
 assert.match(script,/not a factual verification service|Source URLs and structured claims/);
});
