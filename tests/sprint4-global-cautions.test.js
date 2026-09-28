import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
import {CATEGORIES,normalizeArticle} from '../src/content.js';
import {CAUTION_GROUPS,cautionGroupForArticle} from '../src/cautions.js';
import {sitemapXML} from '../src/seo.js';

const origin='https://tripcaution.test';
test('worldwide taxonomy retains existing articles and distinguishes payment systems',()=>{
 assert.equal(CAUTION_GROUPS.length,6);
 for(const group of CAUTION_GROUPS)assert.ok(CATEGORIES.includes(group.id));
 assert.equal(cautionGroupForArticle('tourist-traps').id,'scams-theft');
 assert.equal(cautionGroupForArticle('transport').id,'transport-difficulties');
 assert.equal(cautionGroupForArticle('etiquette').id,'laws-customs');
 assert.equal(cautionGroupForArticle('food').id,'travel-essentials');
 assert.equal(cautionGroupForArticle('payments-money').id,'payments-money');
 const raw={title:'Card acceptance differs by merchant',country:'Japan',
  category:'payments-money',content_markdown:'Practical, source-backed guidance. '.repeat(10)};
 assert.equal(normalizeArticle(raw).category_id,'payments-money');
 assert.equal(normalizeArticle({...raw,category:'before-you-go'}).category_id,'before-you-go');
});
test('published-only global landing has six caution groups and plain unpopulated cards',async()=>{
 const env={SITE_URL:origin,DB:{prepare(sql){
   return {async all(){
    if(sql.includes('GROUP BY category_id'))return {results:[{category_id:'transport',total:2},{category_id:'payments-money',total:1}]};
    return {results:[]};
   }};
 }}};
 const res=await worker.fetch(new Request(origin+'/cautions'),env);
 assert.equal(res.status,200);
 const body=await res.text();
 assert.match(body,/Global Travel Cautions|GLOBAL TRAVEL CAUTIONS/);
 assert.match(body,/href="\/cautions\/payments-money"/);
 assert.match(body,/href="\/cautions\/transport-difficulties"/);
 assert.doesNotMatch(body,/href="\/cautions\/safety-health"/);
 assert.match(body,/Research planned/);
 assert.doesNotMatch(body,/name="robots" content="noindex/);
});
test('unpopulated topic remains noindex and unpublished article never appears in its result',async()=>{
 const queries=[];
 const env={SITE_URL:origin,DB:{prepare(sql){
  queries.push(sql);
  return {bind(){return this;},async all(){return {results:[]};}};
 }}};
 const res=await worker.fetch(new Request(origin+'/cautions/payments-money'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/name="robots" content="noindex/);
 assert.match(html,/Research in progress/);
 assert.ok(queries.some(sql=>sql.includes("a.status='published'")&&sql.includes('a.category_id IN')));
 const missing=await worker.fetch(new Request(origin+'/cautions/nonexistent'),env);
 assert.equal(missing.status,404);
});
test('indexed topic results are world-wide and source-linked only to published articles',async()=>{
 const rows=[{id:'a0000000-0000-4000-a000-000000000004',title:'Card acceptance by establishment',slug:'card-acceptance',country:'Canada',status:'published',category_id:'payments-money',excerpt:'Where to confirm before you pay.'}];
 let args=[];
 const env={SITE_URL:origin,DB:{prepare(sql){const stmt={bind(...x){args=x;return stmt;},async all(){return {results:rows};}};return stmt;}}};
 const response=await worker.fetch(new Request(origin+'/cautions/payments-money'),env);
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/Card acceptance by establishment/);
 assert.match(html,/href="\/guides\/card-acceptance"/);
 assert.deepEqual(args,['payments-money']);
 assert.doesNotMatch(html,/name="robots" content="noindex/);
});
test('sitemap never fabricates empty risk topics; only published categories are indexable',()=>{
 const xml=sitemapXML(origin,[],[],false,false,['payments-money','transport-difficulties']);
 assert.match(xml,/<loc>https:\/\/tripcaution.test\/cautions<\/loc>/);
 assert.match(xml,/<loc>https:\/\/tripcaution.test\/cautions\/payments-money<\/loc>/);
 assert.doesNotMatch(xml,/safety-health/);
 assert.doesNotMatch(sitemapXML(origin,[],[]),/\/cautions/);
});
test('public category navigation does not leak private editorial routes',async()=>{
 const env={SITE_URL:origin,DB:{prepare(sql){
  return {async all(){return {results:[]};},async first(){return {count:0};}};
 }}};
 const res=await worker.fetch(new Request(origin+'/'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/href="\/cautions"/);
 assert.match(html,/PRACTICAL CAUTIONS FOR TRAVELERS/);
 assert.doesNotMatch(html,/href="\/cautions\/scams-theft"/);
});
test('migration is additive and preserves editorial review controls',()=>{
 const migration=readFileSync(new URL('../migrations/0002_global_caution_taxonomy.sql',import.meta.url),'utf8');
 assert.match(migration,/INSERT OR IGNORE INTO categories/);
 assert.doesNotMatch(migration,/(UPDATE|DELETE|DROP)\s+(articles|categories)/i);
 const index=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(index,/a.status='published'/);
 assert.match(index,/Only signed-in editor can revise existing articles/);
});
