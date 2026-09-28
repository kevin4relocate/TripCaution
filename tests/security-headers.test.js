import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
const origin='https://tripcaution.test';
const key='secure-pages-check-'+('X'.repeat(48));
const assets={fetch:async()=>new Response('<html><body>Admin asset</body></html>',{headers:{'content-type':'text/html'}})};
test('public pages have security response headers and only external first-party scripts',async()=>{
 const resp=await worker.fetch(new Request(origin+'/about'),{SITE_URL:origin,ASSETS:assets});
 assert.equal(resp.status,200);
 const headers=resp.headers,body=await resp.text();
 for(const part of ["script-src 'self'","frame-ancestors 'none'","object-src 'none'","form-action 'self'"])
  assert.ok(headers.get('content-security-policy').includes(part),part);
 assert.equal(headers.get('x-frame-options'),'DENY');
 assert.equal(headers.get('x-content-type-options'),'nosniff');
 assert.match(headers.get('permissions-policy'),/camera=\(\)/);
 assert.match(body,/<script src="\/site\.js" defer><\/script>/);
 assert.doesNotMatch(body,/on(?:click|load|error)=/);
});
test('owner dashboard is uncacheable, unframeable and CSP restricted',async()=>{
 const env={ADMIN_LOGIN_KEY:key,ASSETS:assets};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const resp=await worker.fetch(new Request(origin+'/admin',{headers:{Cookie:cookie}}),env);
 assert.equal(resp.status,200);
 assert.equal(resp.headers.get('x-frame-options'),'DENY');
 assert.match(resp.headers.get('content-security-policy'),/script-src 'self'/);
 assert.match(resp.headers.get('cache-control'),/no-store/);
 assert.equal(resp.headers.get('referrer-policy'),'no-referrer');
});
test('public guide share behavior is CSP-compatible and has no inline onclick',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
 assert.ok(source.includes('data-copy-guide>Copy link'));
 assert.ok(!source.includes('onclick="navigator.clipboard'));
 assert.match(ui,/navigator\.clipboard\.writeText/);
});

test('stored travel content and invalid dates cannot execute scripts or crash the public guide',async()=>{
 const article={
  id:'a0000000-0000-4000-a000-000000000001',
  slug:'untrusted-content',status:'published',
  title:'<svg onload=alert(1)>',country:'Singapore',city:'',
  excerpt:'Travel <img src=x onerror=alert(1)>',
  sources_json:JSON.stringify([{title:'Official <unsafe>',url:'https://official.example.org/'}]),
  content_markdown:'## <script>alert(1)</script>\n\nRead [reliable](https://official.example.org/) and [unsafe](javascript:alert(1)).',
  hero_image_url:'javascript:alert(1)',published_at:'not-a-date',verified_at:'invalid',
  seo_title:'Safe guide',seo_description:'A useful guide'
 };
 const env={SITE_URL:origin,DB:{prepare(sql){
  return {bind(){return this;},async first(){
   return sql.includes('FROM articles a LEFT JOIN')?article:null;
  },async all(){return {results:[]};}};
 }}};
 const response=await worker.fetch(new Request(origin+'/guides/untrusted-content'),env);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(!html.includes('<svg onload='));
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(!html.includes('src="javascript:'));
 assert.ok(html.includes('Date unavailable'));
});
