import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {
  COOKIE_NAME, isLoginConfigured, createAdminSession, hasAdminSession,
  clearAdminSession, checkLoginKey
} from '../src/auth.js';

const origin='https://tripcaution.test';
const key='test-only-random-looking-key-0123456789ABCDEF0123456789';
function fakeD1(){
  const failed=[];
  return {
    failed,
    prepare(sql){
      let bound=[];
      const query={
        bind(...args){bound=args;return query;},
        async first(){
          if(sql.includes("FROM audit_logs")&&sql.includes("admin_login_failed")){
            return {count:failed.filter(v=>v.actor===bound[0]).length};
          }
          if(sql.includes('COUNT(*) count FROM articles'))return {count:0};
          return null;
        },
        async run(){
          if(sql.includes("INSERT INTO audit_logs"))failed.push({actor:bound[1]});
          return {success:true};
        },
        async all(){return {results:[]};}
      };
      return query;
    }
  };
}
function env(secret=key){
 return {DB:fakeD1(),ADMIN_LOGIN_KEY:secret,ASSETS:{fetch:async()=>{
   return new Response('<h1>Editorial workspace</h1>',{headers:{'content-type':'text/html'}});
 }}};
}
const request=(path,opts={})=>new Request(origin+path,opts);
const login=(secret,opts={})=>request('/api/auth/login',{
 method:'POST',
 headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.8',...(opts.headers||{})},
 body:JSON.stringify({key:secret})
});

test('ADMIN_LOGIN_KEY is mandatory and never hard-coded or sent in the login HTML',async()=>{
 const e=env(undefined);
 delete e.ADMIN_LOGIN_KEY;
 assert.equal(isLoginConfigured(e),false);
 const page=await worker.fetch(request('/sign-in'),e);
 assert.equal(page.status,503);
 const denied=await worker.fetch(request('/admin'),e);
 assert.equal(denied.status,503);
 const wrongSecret=await worker.fetch(login(key),e);
 assert.equal(wrongSecret.status,503);
});

test('signed key session is never exposed on /admin or /api/admin before login',async()=>{
 const e=env();
 const denied=await worker.fetch(request('/admin'),e);
 assert.equal(denied.status,302);
 assert.equal(denied.headers.get('location'),origin+'/sign-in');
 assert.match(denied.headers.get('cache-control')||'',/no-store/);
 const adminDirect=await worker.fetch(request('/admin.html'),e);
 assert.equal(adminDirect.status,302);
 const data=await worker.fetch(request('/api/admin/articles'),e);
 assert.equal(data.status,401);
 assert.doesNotMatch(await data.text(),/article records/);
});

test('correct private key grants 12-hour secure cookie, not raw login key',async()=>{
 const e=env();
 const res=await worker.fetch(login(key),e);
 assert.equal(res.status,200);
 const setCookie=res.headers.get('set-cookie');
 assert.match(setCookie,new RegExp('^'+COOKIE_NAME+'=v1\\.'));
 assert.match(setCookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.match(setCookie,/Max-Age=43200/);
 assert.doesNotMatch(setCookie,new RegExp(key));
 assert.equal(await res.json().then(v=>v.ok),true);
 const cookie=setCookie.split(';')[0];
 const admin=await worker.fetch(request('/admin',{headers:{Cookie:cookie}}),e);
 assert.equal(admin.status,200);
 assert.match(await admin.text(),/Editorial workspace/);
 assert.equal(admin.headers.get('cache-control'),'private, no-store');
 const data=await worker.fetch(request('/api/admin/articles',{headers:{Cookie:cookie}}),e);
 assert.equal(data.status,200);
});

test('invalid key is throttled after six attempts from same IP',async()=>{
 const e=env();
 for(let i=0;i<6;i++){
  const response=await worker.fetch(login('totally-incorrect-key'),e);
  assert.equal(response.status,401);
 }
 const seventh=await worker.fetch(login(key),e);
 assert.equal(seventh.status,429);
 assert.equal(e.DB.failed.length,6);
 assert.ok(e.DB.failed.every(row=>!JSON.stringify(row).includes('203.0.113.8')));
});

test('cross-origin sign-in and cross-site administrator writes are denied',async()=>{
 const e=env();
 const bad=await worker.fetch(login(key,{headers:{Origin:'https://attacker.invalid'}}),e);
 assert.equal(bad.status,403);
 const setCookie=await createAdminSession(e),cookie=setCookie.split(';')[0];
 const post=await worker.fetch(request('/api/admin/auto-schedule',{
  method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.invalid'},body:'{}'
 }),e);
 assert.equal(post.status,403);
 assert.equal(e.DB.failed.length,0);
});

test('session signature is tamper resistant and changing the private key revokes sessions',async()=>{
 const e=env();
 const setCookie=await createAdminSession(e),cookie=setCookie.split(';')[0];
 assert.equal(await hasAdminSession(request('/admin',{headers:{Cookie:cookie}}),e),true);
 const dot=cookie.lastIndexOf('.');
 const tampered=cookie.slice(0,dot+1)+(cookie[dot+1]==='A'?'B':'A')+cookie.slice(dot+2);
 assert.equal(await hasAdminSession(request('/admin',{headers:{Cookie:tampered}}),e),false);
 const changed=env(key+'ROTATED');
 assert.equal(await hasAdminSession(request('/admin',{headers:{Cookie:cookie}}),changed),false);
 assert.equal(await checkLoginKey(key,changed),false);
});

test('logout expires the secure cookie without requesting the key again',async()=>{
 const e=env();
 const res=await worker.fetch(request('/api/auth/logout',{method:'POST',headers:{Origin:origin}}),e);
 assert.equal(res.status,200);
 assert.equal(res.headers.get('set-cookie'),clearAdminSession());
});

test('Cloudflare static assets must not redirect admin.html back to admin',async()=>{
 const {readFileSync}=await import('node:fs');
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.assets.run_worker_first,true);
 assert.equal(config.assets.html_handling,'none',
  'default HTML handling redirects admin.html to admin and loops signed-in users');
});

test('the public website does not require the admin key',async()=>{
 const e=env();
 delete e.ADMIN_LOGIN_KEY;
 const home=await worker.fetch(request('/'),e);
 assert.equal(home.status,200);
 assert.match(await home.text(),/Go somewhere new/);
});
