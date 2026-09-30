import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
const origin='https://tripcaution.test';
const secret='media-security-test-login-'+('R'.repeat(45));
const article={
 id:'a0000000-0000-4000-a000-000000000001',
 slug:'timor-leste-crocodile-risk',
 status:'review',
 hero_image_url:'/media/editorial/timor-leste-crocodile-risk.webp',
 content_markdown:'## Where the risk occurs\n\n![Traveler staying back from a river mouth.](/media/editorial/timor-leste-crocodile-risk-inline-01.webp)'
};
function env(customArticle=article){
 const files=[],audits=[],objects=new Map();
 return {ADMIN_LOGIN_KEY:secret,files,audits,objects,SITE_URL:origin,
  MEDIA:{
   async put(key,buffer,settings){files.push({key,buffer,settings});objects.set(key,{body:buffer,httpMetadata:settings?.httpMetadata||{}});},
   async head(key){return objects.has(key)?{key}:null;},
   async get(key){return objects.get(key)||null;}
  },
  DB:{prepare(sql){
   let values=[];
   const stmt={
    bind(...args){values=args;return stmt;},
    async first(){
     if(sql.includes('FROM articles')&&sql.includes('WHERE slug=?'))
      return customArticle&&values[0]===customArticle.slug?customArticle:null;
     return null;
    },
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
function upload(bytes,headers,path='/api/admin/media'){
 return new Request(origin+path,{method:'POST',headers,body:bytes});
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const webp=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,0,0,0,0]);
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
test('bulk hero WebP uses exact article slug path and does not change article state',async()=>{
 const e=env(),headers=await authHeaders(e,'image/webp');
 headers['X-TripCaution-Filename']='timor-leste-crocodile-risk.webp';
 const response=await worker.fetch(upload(webp,headers,'/api/admin/media/article-image'),e);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.state,'uploaded');
 assert.equal(result.kind,'hero');
 assert.equal(result.path,'/media/editorial/timor-leste-crocodile-risk.webp');
 assert.equal(e.files[0].key,'editorial/timor-leste-crocodile-risk.webp');
 assert.equal(e.files[0].settings.httpMetadata.contentType,'image/webp');
 assert.equal(e.audits.length,1);
});
test('bulk inline WebP is accepted only when the imported Markdown references its exact path',async()=>{
 const e=env(),headers=await authHeaders(e,'image/webp');
 headers['X-TripCaution-Filename']='timor-leste-crocodile-risk-inline-01.webp';
 const response=await worker.fetch(upload(webp,headers,'/api/admin/media/article-image'),e);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.kind,'inline');
 assert.equal(e.files[0].key,'editorial/timor-leste-crocodile-risk-inline-01.webp');
 const missing=env({...article,content_markdown:'## No image here'});
 const missingHeaders=await authHeaders(missing,'image/webp');
 missingHeaders['X-TripCaution-Filename']='timor-leste-crocodile-risk-inline-01.webp';
 const denied=await worker.fetch(upload(webp,missingHeaders,'/api/admin/media/article-image'),missing);
 assert.equal(denied.status,409);
 assert.equal((await denied.json()).code,'path_mismatch');
 assert.equal(missing.files.length,0);
});
test('bulk uploader rejects unmatched and malformed filenames before writing R2',async()=>{
 const e=env(),headers=await authHeaders(e,'image/webp');
 headers['X-TripCaution-Filename']='unknown-article.webp';
 const unmatched=await worker.fetch(upload(webp,headers,'/api/admin/media/article-image'),e);
 assert.equal(unmatched.status,404);
 assert.equal((await unmatched.json()).code,'unmatched');
 const badHeaders=await authHeaders(e,'image/webp');
 badHeaders['X-TripCaution-Filename']='../../escape.webp';
 const malformed=await worker.fetch(upload(webp,badHeaders,'/api/admin/media/article-image'),e);
 assert.equal(malformed.status,422);
 assert.equal(e.files.length,0);
});
test('existing deterministic image is skipped unless overwrite is explicit',async()=>{
 const e=env(),headers=await authHeaders(e,'image/webp');
 headers['X-TripCaution-Filename']='timor-leste-crocodile-risk.webp';
 await e.MEDIA.put('editorial/timor-leste-crocodile-risk.webp',webp.buffer,{httpMetadata:{contentType:'image/webp'}});
 e.files.length=0;
 const skipped=await worker.fetch(upload(webp,headers,'/api/admin/media/article-image'),e);
 assert.equal(skipped.status,200);
 assert.equal((await skipped.json()).state,'skipped');
 assert.equal(e.files.length,0);
 headers['X-TripCaution-Overwrite']='true';
 const replaced=await worker.fetch(upload(webp,headers,'/api/admin/media/article-image'),e);
 assert.equal((await replaced.json()).state,'uploaded');
 assert.equal(e.files.length,1);
});
test('public media route serves deterministic WebP filenames',async()=>{
 const e=env();
 await e.MEDIA.put('editorial/timor-leste-crocodile-risk.webp',webp.buffer,{httpMetadata:{contentType:'image/webp'}});
 const response=await worker.fetch(new Request(origin+'/media/editorial/timor-leste-crocodile-risk.webp'),e);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-type'),'image/webp');
 assert.match(response.headers.get('cache-control'),/max-age=3600/);
});
