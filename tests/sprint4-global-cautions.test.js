import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {normalizeArticle} from '../src/content.js';
import {CAUTION_TOPICS,cautionTopic,cautionTopicForCategory} from '../src/cautions.js';
import {sitemapXML} from '../src/seo.js';

const origin='https://tripcaution.test';
function database(){
 const calls=[];
 const db={prepare(sql){
  let args=[];const q={
   bind(...values){args=values;return q;},
   async all(){
    calls.push({sql,args});
    if(sql.includes('SELECT DISTINCT category_id'))return {results:[{category_id:'transport'},{category_id:'payments-money'}]};
    if(sql.includes('SELECT category_id,COUNT(*)'))return {results:[{category_id:'transport',total:1},{category_id:'payments-money',total:1}]};
    if(sql.includes('SELECT DISTINCT country FROM articles')&&sql.includes('category_id IN'))return {results:args.includes('payments-money')?[{country:'Singapore'}]:[]};
    if(sql.includes('FROM articles a LEFT JOIN')&&sql.includes('a.category_id IN')){
     return {results:args.includes('payments-money')?[{
      id:'a0000000-0000-4000-a000-000000000001',title:'Check payment methods',slug:'check-payment-methods',
      country:'Singapore',category_id:'payments-money',status:'published',excerpt:'Situational payment cautions'
     }]:[]};
    }
    return {results:[]};
   }
  };return q;
 }};
 return {db,calls};
}
test('every old and new category maps once to a single global issue topic',()=>{
 const ids=CAUTION_TOPICS.flatMap(topic=>topic.ids);
 assert.equal(CAUTION_TOPICS.length,6);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['tourist-traps','things-to-avoid','food','before-you-go','payments-money','safety-health','scams-theft','travel-essentials']){
  assert.ok(cautionTopicForCategory(id),id);
 }
 assert.equal(cautionTopic('payments-money').title,'Payments & money');
 assert.equal(cautionTopic('unknown'),null);
});
test('new global issue categories normalize without rewriting older category IDs',()=>{
 const draft={title:'Payment method research',country:'Singapore',content_markdown:'Check all claims directly with the original payment operator. '.repeat(4),
  sources:[{title:'Original source',url:'https://example.org'}]};
 for(const category of ['payments-money','scams-theft','safety-health','travel-essentials']){
  assert.equal(normalizeArticle({...draft,category}).category_id,category);
 }
 assert.equal(normalizeArticle({...draft,category:'food'}).category_id,'food');
});
test('global caution index links to published issue topics but labels empty topics planned',async()=>{
 const {db}=database();
 const response=await worker.fetch(new Request(origin+'/cautions'),{DB:db,SITE_URL:origin});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/href="\/cautions\/payments-money"/);
 assert.match(html,/href="\/cautions\/transport"/);
 assert.doesNotMatch(html,/href="\/cautions\/safety-health"/);
 assert.match(html,/Research planned/);
 assert.match(html,/worldwide|every destination|everywhere/i);
});
test('topic pages filter by a verified published destination and reject arbitrary labels',async()=>{
 const {db,calls}=database();
 const response=await worker.fetch(new Request(origin+'/cautions/payments-money?country=Singapore'),{DB:db,SITE_URL:origin});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Check payment methods/);
 assert.match(html,/name="robots" content="noindex,follow"/);
 const articleQuery=calls.find(v=>v.sql.includes('FROM articles a LEFT JOIN'));
 assert.ok(articleQuery.sql.includes('a.status=\'published\''));
 assert.deepEqual(articleQuery.args,['payments-money','Singapore']);
 const suspicious=await worker.fetch(new Request(origin+'/cautions/payments-money?country=%3Cscript%3Ealert(1)%3C%2Fscript%3E'),{DB:db,SITE_URL:origin});
 assert.equal(suspicious.status,200);
 assert.doesNotMatch(await suspicious.text(),/<script>alert\(1\)<\/script>/);
 const unknown=await worker.fetch(new Request(origin+'/cautions/unknown'),{DB:db,SITE_URL:origin});
 assert.equal(unknown.status,404);
});
test('empty topic remains non-indexable until an article is actually published',async()=>{
 const {db}=database();
 const response=await worker.fetch(new Request(origin+'/cautions/scams-theft'),{DB:db,SITE_URL:origin});
 assert.equal(response.status,200);
 assert.match(await response.text(),/name="robots" content="noindex,follow"/);
});
test('global topic sitemap lists only supplied, legitimately published topic slugs',()=>{
 const xml=sitemapXML(origin,[],[],false,false,['payments-money']);
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/cautions<\/loc>/);
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/cautions\/payments-money<\/loc>/);
 assert.doesNotMatch(xml,/cautions\/scams-theft/);
 const legacy=sitemapXML(origin,[],[],false,false);
 assert.doesNotMatch(legacy,/\/cautions/);
});
test('additive database migration and owner editor guide are explicit',()=>{
 const migration=readFileSync(new URL('../migrations/0002_global_cautions.sql',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 assert.match(migration,/INSERT OR IGNORE INTO categories/);
 for(const id of ['payments-money','safety-health','scams-theft','travel-essentials'])
  assert.ok(migration.includes("'"+id+"'"),id);
 assert.match(editor,/destination- and situation-specific/);
});
