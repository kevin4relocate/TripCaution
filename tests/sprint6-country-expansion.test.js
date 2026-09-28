import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {createAdminSession} from '../src/auth.js';
import {COUNTRY_ARTICLE_TARGET,FIRST_PASS_TARGET,TOPIC_TARGETS,summarizeCountryTopicCounts} from '../src/coverage.js';
import {cautionTopicForCategory} from '../src/cautions.js';

const origin='https://tripcaution.test';
const ADMIN_LOGIN_KEY='sprint6-secret-'+('X'.repeat(48));
test('11 country capacity means 33 first-pass and 88 depth; not a country danger score',()=>{
 assert.equal(FIRST_PASS_TARGET*11,33);
 assert.equal(COUNTRY_ARTICLE_TARGET*11,88);
 assert.equal(TOPIC_TARGETS.reduce((n,t)=>n+t.target,0),8);
 assert.equal(new Set(TOPIC_TARGETS.map(t=>t.slug)).size,6);
});
test('legacy categories count toward the correct topic without inflating unreviewed publication',()=>{
 const rows=[
  {country:'Singapore',category_id:'transport',status:'published',count:2},
  {country:'Singapore',category_id:'tourist-traps',status:'review',count:1},
  {country:'Singapore',category_id:'payments-money',status:'scheduled',count:3},
  {country:'Vietnam',category_id:'safety-health',status:'published',count:1},
  {country:'Malaysia',category_id:'unknown',status:'published',count:100},
  {country:'Singapore',category_id:'safety-health',status:'deleted',count:33},
 ];
 const data=summarizeCountryTopicCounts(rows,['Singapore','Vietnam','Malaysia'],cautionTopicForCategory);
 assert.equal(data[0].published,2);
 assert.equal(data[0].pipeline,4);
 assert.equal(data[0].topics.find(t=>t.slug==='transport').published,2);
 assert.equal(data[0].topics.find(t=>t.slug==='scams-theft').pipeline,1);
 assert.equal(data[0].topics.find(t=>t.slug==='payments-money').pipeline,3);
 assert.equal(data[1].published,1);
 assert.equal(data[2].published,0);
});
test('new coverage matrix is private and tracks actual database rows rather than invented guides',async()=>{
 const calls=[];
 const db={prepare(sql){
  let bound=[];
  const st={
   bind(...items){bound=items;return st;},
   async all(){
    calls.push({sql,bound});
    if(sql.includes('GROUP BY country,category_id,status'))return {results:[
      {country:'Singapore',category_id:'transport',status:'published',count:2},
      {country:'Laos',category_id:'safety-health',status:'review',count:1}
    ]};
    if(sql.includes('GROUP BY country'))return {results:[
      {country:'Singapore',published:2,pipeline:0},{country:'Laos',published:0,pipeline:1}
    ]};
    return {results:[]};
   }
  };return st;
 }};
 const env={DB:db,ADMIN_LOGIN_KEY};
 const anonymous=await worker.fetch(new Request(origin+'/api/admin/coverage'),env);
 assert.equal(anonymous.status,302);
 const cookie=(await createAdminSession(env)).split(';')[0];
 const response=await worker.fetch(new Request(origin+'/api/admin/coverage',{headers:{Cookie:cookie}}),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.totalCountries,11);
 assert.equal(body.firstPassTarget,3);
 assert.equal(body.fullTarget,8);
 assert.equal(body.publishedCountries,1);
 assert.equal(body.topicCoverage.length,11);
 assert.equal(body.topicCoverage.find(c=>c.country==='Singapore').published,2);
 assert.equal(body.topicCoverage.find(c=>c.country==='Laos').pipeline,1);
 const SQL=calls.find(c=>c.sql.includes('GROUP BY country,category_id,status'));
 assert.equal(SQL.bound.length,11);
 assert.match(SQL.sql,/status IN \('published','review','draft','scheduled'\)/);
});
test('editor includes truthful country/topic targets; daily worker remains opt-in',()=>{
 const editor=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/daily-content.yml',import.meta.url),'utf8');
 const daily=readFileSync(new URL('../automation/daily.py',import.meta.url),'utf8');
 for(const id of ['sprint6-total','sprint6-matrix'])assert.match(editor,new RegExp('id="'+id+'"'));
 assert.match(js,/topicCoverage/);
 assert.match(workflow,/TRIPCAUTION_AUTOMATION_ENABLED == 'true'/);
 assert.match(workflow,/TRIPCAUTION_CONTENT_PHASE/);
 assert.match(daily,/MAX_REVIEW_BACKLOG/);
 assert.match(daily,/choose_slot/);
 assert.match(daily,/sprint6:/);
});
