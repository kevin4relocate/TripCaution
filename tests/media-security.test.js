import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
const origin='https://tripcaution.test';
const secret='media-security-test-login-'+('R'.repeat(45));
function env(){
 const files=[],audits=[];
 return {ADMIN_LOGIN_KEY:secret,files,audits,SITE_URL:origin,
  MEDIA:{async put(key,buffer,settings){files.push({key,buffer,settings});}},
  DB:{prepare(sql){
   let values=[];
   const stmt={
    bind(...args){values=args;return stmt;},
    async run(){if(sql.startsWith('INSERT INTO audit_logs'))audits.push(values);return {success:true};}
   };
   return stmt;
  }}
 };
}
async function authHeaders(e,type='image/png'){
 const cookie=(await createAdminSession(e)).split(';')[0];
 return {Origin:origin,Cookie:cookie,'Content-Type':type};
}
function upload(bytes,headers){
 return new Request(origin+'/api/admin/media',{method:'POST',headers,body:bytes});
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
test('anonymous and cross-origin media uploads never create objects',async()=>{
 const e=env();
 const guest=await worker.fetch(upload(png,{Origin:origin,'Content-Type':'image/png'}),e);
 assert.equal(guest.status,401);
 const foreign=await worker.fetch(upload(png,{...await authHeaders(e),Origin:'https://attacker.invalid'}),e);
 assert.equal(foreign.status,403);
 assert.equal(e.files.length,0);
});
test('media rejects unsupported types and spoofed signatures',async()=>{
 const e=env();
 const forged=await worker.fetch(upload(new Uint8Array([255,216,0,0,0,0,0,0,0,0,0,0]),await authHeaders(e,'image/jpeg')),e);
 assert.equal(forged.status,415);
 const svg=await worker.fetch(upload(new TextEncoder().encode('<svg onload="alert(1)"></svg>'),await authHeaders(e,'image/svg+xml')),e);
 assert.equal(svg.status,415);
 assert.equal(e.files.length,0);
});
test('an oversized upload is rejected before R2 receives data',async()=>{
 const e=env(),headers=await authHeaders(e);
 headers['Content-Length']=String(5*1024*1024+1);
 assert.equal((await worker.fetch(upload(png,headers),e)).status,413);
 assert.equal((await worker.fetch(upload(new Uint8Array(5*1024*1024+1),await authHeaders(e)),e)).status,413);
 assert.equal(e.files.length,0);
});
test('a signed same-origin PNG upload returns a random, sanitized URL',async()=>{
 const e=env(),response=await worker.fetch(upload(png,await authHeaders(e)),e);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.match(result.url,/^https:\/\/tripcaution\.test\/media\/editorial\/[a-f0-9-]{36}\.png$/);
 assert.equal(e.files.length,1);
 assert.equal(e.files[0].buffer.byteLength,png.byteLength);
 assert.equal(e.files[0].settings.httpMetadata.contentType,'image/png');
 assert.equal(e.audits.length,1);
});
