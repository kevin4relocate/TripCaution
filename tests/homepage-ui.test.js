import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import app from '../src/index.js';

test('homepage uses safety intelligence brief without claiming a live alert feed',async()=>{
  const response=await app.fetch(new Request('https://example.test/'),{
    SITE_URL:'https://example.test',
    ASSETS:{fetch:async()=>new Response('Not found',{status:404})}
  });
  assert.equal(response.status,200);
  const page=await response.text();
  assert.match(page,/TRAVEL SAFETY INTELLIGENCE/);
  assert.match(page,/Travel smart/);
  assert.match(page,/Stay safe/);
  assert.match(page,/class="safety-brief"/);
  assert.match(page,/INDEPENDENT · SOURCE-LINKED GUIDES/);
  assert.match(page,/href="\/safety-theme\.css"/);
  assert.doesNotMatch(page,/LIVE EMERGENCY ALERTS/);
  assert.doesNotMatch(page,/illustrations\/travel-journal\.svg/);
  assert.match(page,/class="section featured-section"/);
  assert.match(page,/id="destinations"/);
  assert.doesNotMatch(page,/class="value-bar"/);
  assert.doesNotMatch(page,/class="shell prefooter"/);
});

test('homepage puts fresh published guides before the condensed destination explorer',async()=>{
 const latest=[
  {title:'New airport transfer',slug:'new-airport-transfer',country:'Thailand',city:'Bangkok',category_name:'Transport',excerpt:'Practical tips',published_at:'2026-09-29'},
  {title:'Your first train ride',slug:'your-first-train-ride',country:'Singapore',category_name:'Transit',excerpt:'Rail guidance'},
  {title:'Taxi travel in Vietnam',slug:'taxi-vietnam',country:'Vietnam',category_name:'Transit',excerpt:'Travel advice'}
 ];
 const database={prepare(sql){
  if(sql.includes('FROM articles a LEFT JOIN'))return {all:async()=>({results:latest})};
  if(sql.includes('GROUP BY country'))return {all:async()=>({results:[{country:'Singapore',total:1},{country:'Thailand',total:1},{country:'Vietnam',total:1}]})};
  if(sql.includes('GROUP BY category_id'))return {all:async()=>({results:[{category_id:'transport',total:3}]})};
  if(sql.includes('COUNT(*) count'))return {first:async()=>({count:3})};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await app.fetch(new Request('https://example.test/'),{
   SITE_URL:'https://example.test',DB:database,ASSETS:{fetch:async()=>new Response('not found',{status:404})}
 });
 const page=await result.text();
 assert.equal(result.status,200);
 assert.ok(page.indexOf('class="caution-topics-home"')<page.indexOf('id="latest"'));
 assert.ok(page.indexOf('id="latest"')<page.indexOf('id="destinations"'));
 assert.ok(page.indexOf('New airport transfer')<page.indexOf('Your first train ride'));
 assert.match(page,/class="featured-layout/);
 assert.match(page,/class="guide-card guide-card-lead\b/);
 assert.match(page,/guide-card-side/);
 assert.doesNotMatch(page,/Verified Sep|Verified \+|Last reviewed:/);
 assert.match(page,/Research planned/);
 assert.match(page,/Southeast Asia guide hub/);
 assert.match(page,/Thailand/);
 assert.doesNotMatch(page,/continent-directory/);
});

test('homepage adapts gracefully before the first guide has been published',async()=>{
 const response=await app.fetch(new Request('https://example.test/'),{
   SITE_URL:'https://example.test',ASSETS:{fetch:async()=>new Response('not found',{status:404})}
 });
 const page=await response.text();
 assert.equal(response.status,200);
 assert.match(page,/Our first field notes are on the way/);
 assert.match(page,/Browse the full A–Z destination list/);
 assert.doesNotMatch(page,/guide-card-lead/);
});

test('full directory starts with all 11 regional countries, labelling unpublished destinations',async()=>{
 const response=await app.fetch(new Request('https://example.test/destinations'),{
  SITE_URL:'https://example.test',ASSETS:{fetch:async()=>new Response('not found',{status:404})}
 });
 const page=await response.text();
 assert.equal(response.status,200);
 const region=page.slice(page.indexOf('class="continent-directory"'));
 const asia=region.indexOf('id="continent-asia"');
 assert.ok(asia>=0);
 const expected=['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar',
  'Philippines','Singapore','Thailand','Timor-Leste','Vietnam'];
 const positions=expected.map(name=>region.indexOf('class="destination-name">'+name+'</span>'));
 assert.ok(positions.every(pos=>pos>asia));
 assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert.match(page,/Research planned/);
 assert.match(page,/Southeast Asia guide hub/);
 assert.doesNotMatch(page,/<a[^>]+href="\/destinations\/cambodia"/);
 assert.match(page,/id="continent-europe"/);
 assert.match(page,/class="destination-name">Kenya<\/span>/);
 assert.doesNotMatch(page,/href="\/destinations\/kenya"/);
});
test('responsive design includes compact layouts and reduced vertical spacing',()=>{
  const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/\.home-hero \.hero-inner\s*\{[^}]*min-height:31[0-9]px/s);
  assert.match(css,/\.destination-tile\s*\{[^}]*min-height:50px/s);
  assert.match(css,/@media\(max-width:600px\)/);
});


test('published country links are active and research-only countries remain unlinked',async()=>{
 const database={prepare(sql){
  if(sql.includes('GROUP BY country'))return {all:async()=>({results:[{country:'Singapore',total:2},{country:'Thailand',total:1}]})};
  throw Error('Unexpected directory query '+sql);
 }};
 const result=await app.fetch(new Request('https://example.test/destinations'),{
  SITE_URL:'https://example.test',DB:database,ASSETS:{fetch:async()=>new Response('not found',{status:404})}
 });
 const page=await result.text();
 assert.equal(result.status,200);
 assert.ok(page.includes('href="/destinations/singapore"'));
 assert.ok(page.includes('2 guides'));
 assert.ok(page.includes('href="/destinations/thailand"'));
 assert.ok(!page.includes('href="/destinations/cambodia"'));
 assert.ok(page.includes('Research planned'));
});

test('full destination directory is indexed in sitemap',async()=>{
 const db={prepare(){return {all:async()=>({results:[]})};}};
 const result=await app.fetch(new Request('https://example.test/sitemap.xml'),{
  SITE_URL:'https://example.test',DB:db,ASSETS:{fetch:async()=>new Response('not found',{status:404})}
 });
 assert.equal(result.status,200);
 assert.ok((await result.text()).includes('<loc>https://example.test/destinations</loc>'));
});
