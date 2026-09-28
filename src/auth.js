// TripCaution's single-editor authentication. Never ship the login secret to the browser.
// The session is HMAC-signed, HttpOnly, Secure, SameSite=Strict, and expires in 12 hours.
// This avoids storing user passwords or running a login/identity service.

export const COOKIE_NAME = 'tc_admin_session';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_PER_IP = 6;
const FAILURE_WINDOW = '-15 minutes';
const encoder = new TextEncoder();

function forbidden(message='Not authorized', status=403) {
 return Object.assign(new Error(message),{status});
}

export function isLoginConfigured(env) {
 return typeof env.ADMIN_LOGIN_KEY === 'string' && env.ADMIN_LOGIN_KEY.length >= 32;
}

function hex(bytes) {
 return Array.from(bytes, b=>b.toString(16).padStart(2,'0')).join('');
}
function b64url(bytes) {
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
function parseB64url(str) {
 if(!/^[A-Za-z0-9_-]+$/.test(str)) return null;
 try {
  const raw=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
 } catch {return null;}
}
function equalBytes(a,b) {
 // Both HMAC and SHA-256 produce fixed-length digests.
 if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.length!==b.length)return false;
 let difference=0;
 for(let i=0;i<a.length;i++)difference |= a[i]^b[i];
 return difference===0;
}
async function hmac(secret,message) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),'HMAC',{hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message)));
}
function keyOrThrow(env) {
 if(!isLoginConfigured(env))throw forbidden('Admin login key is not configured (minimum 32 characters)',503);
 return env.ADMIN_LOGIN_KEY;
}
export function requireSameOrigin(request) {
 const origin=request.headers.get('Origin');
 if(origin!==new URL(request.url).origin) throw forbidden('Same-origin request required');
 const fetchSite=request.headers.get('Sec-Fetch-Site');
 if(fetchSite && fetchSite!=='same-origin')throw forbidden('Cross-site request blocked');
}
export async function checkLoginKey(candidate,env) {
 const secret=keyOrThrow(env);
 // Never compare or log either raw key. Both inputs have fixed-length hashes.
 if(typeof candidate!=='string'||candidate.length===0||candidate.length>512)return false;
 const [a,b]=await Promise.all([
  crypto.subtle.digest('SHA-256',encoder.encode(candidate)),
  crypto.subtle.digest('SHA-256',encoder.encode(secret))
 ]);
 return equalBytes(new Uint8Array(a),new Uint8Array(b));
}
export async function createAdminSession(env) {
 const secret=keyOrThrow(env);
 const expires=Date.now()+SESSION_MS;
 const nonce=b64url(crypto.getRandomValues(new Uint8Array(24)));
 const signed='v1.'+expires+'.'+nonce;
 const signature=b64url(await hmac(secret,'session|'+signed));
 const session=signed+'.'+signature;
 return `${COOKIE_NAME}=${session}; Max-Age=43200; Path=/; Secure; HttpOnly; SameSite=Strict`;
}
export function clearAdminSession() {
 return `${COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
}
export async function hasAdminSession(request,env) {
 if(!isLoginConfigured(env))return false;
 const raw=request.headers.get('Cookie')||'';
 const entry=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE_NAME+'='));
 const session=entry?.slice(COOKIE_NAME.length+1);
 if(!session||session.length>300)return false;
 const pieces=session.split('.');
 if(pieces.length!==4 || pieces[0]!=='v1' || !/^\d{13}$/.test(pieces[1]) ||
    !/^[A-Za-z0-9_-]{30,60}$/.test(pieces[2]) || !/^[A-Za-z0-9_-]{40,50}$/.test(pieces[3]))return false;
 const expires=Number(pieces[1]);
 if(!Number.isSafeInteger(expires)||Date.now()>expires||expires>Date.now()+SESSION_MS+60000)return false;
 const signature=parseB64url(pieces[3]);
 if(!signature||signature.length!==32)return false;
 const signed=pieces.slice(0,3).join('.');
 const expected=await hmac(env.ADMIN_LOGIN_KEY,'session|'+signed);
 return equalBytes(expected,signature);
}
export async function requireKeySession(request,env) {
 keyOrThrow(env);
 if(!await hasAdminSession(request,env))throw forbidden('Admin sign-in required',401);
 return 'admin-key';
}
async function ipIdentity(request,env) {
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const tag=await hmac(keyOrThrow(env),'rate-limit-ip|'+ip);
 return 'admin-login-ip:'+hex(tag).slice(0,32);
}
export async function checkLoginThrottle(request,env) {
 // Fail closed if D1 is unavailable, because no rate limit can then be enforced.
 if(!env.DB)throw forbidden('Admin database is not configured',503);
 const actor=await ipIdentity(request,env);
 const row=await env.DB.prepare(
  "SELECT COUNT(*) count FROM audit_logs WHERE actor=? AND action='admin_login_failed' AND created_at>=datetime('now','-15 minutes')"
 ).bind(actor).first();
 if((row?.count||0)>=MAX_FAILED_PER_IP)throw forbidden('Too many attempts. Try again in 15 minutes.',429);
 return actor;
}
export async function recordLoginFailure(env,actor) {
 if(!env.DB)throw forbidden('Admin database is not configured',503);
 await env.DB.prepare(
  "INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?, 'admin_login_failed',NULL,'Incorrect admin key')"
 ).bind(crypto.randomUUID(),actor).run();
}
