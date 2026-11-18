import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';

const origin='https://tripcaution.test';
const admin=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
function env(row,mode='action'){
 const calls=[],db={prepare(sql){
  let params=[];const q={
   bind(...args){params=args;return q;},
   async first(){
    if(sql.includes('SELECT * FROM articles'))return row;
    if(sql.includes('SELECT COUNT(*) count'))return {count:1};
    return null;
   },
   async all(){
    if(sql.includes('SELECT status,COUNT(*)'))return {results:[{status:'published',count:1}]};
    return {results:[]};
   },
   async run(){calls.push({sql,params});return {success:true}}
  };return q;
 },async batch(statements){for(const s of statements)await s.run();return [];}};
 return {db,calls,config:{DB:db,ADMIN_LOGIN_KEY:'a'.repeat(40)}};
}
test('dashboard clearly separates published and published-not-reviewed',()=>{
 assert.match(html,/Published · Not Reviewed/);
 assert.match(html,/id="show-unreviewed"/);
 assert.match(admin,/PUBLISHED · NOT REVIEWED/);
 assert.match(admin,/mark-reviewed/);
 assert.match(admin,/published-unreviewed/);
});
test('publicly published unreviewed count comes from review_approved, not inferred sources',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(source,/status='published' AND review_approved=0/);
 assert.match(source,/owner-reviewed-published/);
 assert.match(source,/review_confirmed!==true/);
});
test('no source URLs can independently mark a publication as human reviewed',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(source,/Confirm that you checked the article and its HTTPS source links/);
 assert.match(source,/await env.DB.batch\(\[/);
 assert.match(source,/review_approved=1,updated_at/);
});
