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
