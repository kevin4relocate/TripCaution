import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {STARTER_DESTINATIONS,SOUTHEAST_ASIA_COUNTRIES,isSoutheastAsia,groupDestinationsByContinent} from '../src/destinations.js';
import {sitemapXML} from '../src/seo.js';

const origin='https://tripcaution.test';
const list=['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar',
 'Philippines','Singapore','Thailand','Timor-Leste','Vietnam'];
const sg={id:'a0000000-0000-4000-a000-000000000001',title:'An approved Singapore guide',
 country:'Singapore',city:'',slug:'singapore-approved',excerpt:'A useful travel guide.',
 category_id:'transport',category_name:'Transport',status:'published',
 published_at:'2026-09-26 10:00:00',updated_at:'2026-09-27 10:00:00'};
const japan={...sg,id:'a0000000-0000-4000-a000-000000000002',
 title:'Previously published Japan guide',country:'Japan',slug:'japan-live'};
function db(countryRows=[],latest=[]){
 return {queries:[],prepare(sql){
  const owner=this;
  owner.queries.push(sql);
  const query={
   bind(){return query;},
   async first(){return {count:latest.length};},
   async all(){
    if(sql.includes('SELECT slug,updated_at'))return {results:latest.map(a=>({
     slug:a.slug,updated_at:a.updated_at,published_at:a.published_at
    }))};
    if(sql.includes('SELECT DISTINCT country'))return {results:countryRows.map(r=>({country:r.country}))};
    if(sql.includes('SELECT DISTINCT category_id'))return {results:latest.map(a=>({category_id:a.category_id}))};
    if(sql.includes('GROUP BY category_id'))return {results:[{category_id:'transport',total:latest.length}]};
    if(sql.includes('GROUP BY country'))return {results:countryRows};
    if(sql.includes('a.country IN') && sql.includes('FROM articles a LEFT JOIN')){
     return {results:latest.filter(a=>isSoutheastAsia(a.country))};
    }
    if(sql.includes('FROM articles a LEFT JOIN'))return {results:latest};
    throw new Error('Unexpected SQL '+sql);
   }
  };
  return query;
 }};
}
test('all eleven Southeast Asian countries are the complete initial editorial catalogue',()=>{
 assert.deepEqual(SOUTHEAST_ASIA_COUNTRIES,list);
 assert.deepEqual(STARTER_DESTINATIONS,list);
 assert.deepEqual(groupDestinationsByContinent(STARTER_DESTINATIONS).map(g=>g.continent),['Asia']);
 assert.ok(isSoutheastAsia('  MYANMAR  '));
 assert.ok(isSoutheastAsia('Philippines'));
 assert.ok(isSoutheastAsia('Timor-Leste'));
 assert.equal(isSoutheastAsia('Japan'),false);
});
test('home page shows exactly eleven regional tiles without pretending planned articles are published',async()=>{
 const result=await worker.fetch(new Request(origin),{SITE_URL:origin});
 assert.equal(result.status,200);
 const page=await result.text();
 assert.equal((page.match(/class="sea-country sea-country-pending"/g)||[]).length,11);
 for(const country of list)assert.ok(page.includes('<strong>'+country+'</strong>'));
 assert.doesNotMatch(page,/href="\/destinations\/myanmar"/);
 assert.doesNotMatch(page,/href="\/destinations\/timor-leste"/);
 assert.match(page,/Southeast Asia guide hub/);
});
test('regional hub is noindex until a Southeast Asian country has a live article',async()=>{
 const data=db([{country:'Japan',total:1}],[japan]);
 const result=await worker.fetch(new Request(origin+'/southeast-asia'),{SITE_URL:origin,DB:data});
 assert.equal(result.status,200);
 const page=await result.text();
 assert.match(page,/<meta name="robots" content="noindex,follow">/);
 assert.equal((page.match(/class="sea-country sea-country-pending"/g)||[]).length,11);
 assert.doesNotMatch(page,/href="\/destinations\/japan"/);
 assert.doesNotMatch(page,/href="\/destinations\/myanmar"/);
});
test('regional hub links only destinations with public articles; unrelated published guides remain in global directory',async()=>{
 const data=db([{country:'Singapore',total:1},{country:'Japan',total:1}],[sg,japan]);
 const hub=await worker.fetch(new Request(origin+'/southeast-asia'),{SITE_URL:origin,DB:data});
 const html=await hub.text();
 assert.equal(hub.status,200);
 assert.doesNotMatch(html,/<meta name="robots" content="noindex/);
 assert.match(html,/href="\/destinations\/singapore"/);
 assert.match(html,/href="\/guides\/singapore-approved"/);
 assert.doesNotMatch(html,/href="\/destinations\/myanmar"/);
 assert.doesNotMatch(html,/href="\/guides\/japan-live"/);
 const directory=await worker.fetch(new Request(origin+'/destinations'),{SITE_URL:origin,DB:data});
 assert.match(await directory.text(),/href="\/destinations\/japan"/);
});
test('homepage priority SQL sorts Southeast Asian guides before existing content from other regions',async()=>{
 const data=db([{country:'Singapore',total:1},{country:'Japan',total:1}],[sg,japan]);
 const response=await worker.fetch(new Request(origin),{SITE_URL:origin,DB:data});
 assert.equal(response.status,200);
 assert.ok(data.queries.some(q=>q.includes('ORDER BY CASE WHEN a.country IN')&&q.includes("'Myanmar'")&&q.includes("'Timor-Leste'")));
 const page=await response.text();
 assert.equal((page.match(/class="sea-country /g)||[]).length,11);
 assert.match(page,/href="\/destinations\/singapore"/);
 assert.doesNotMatch(page,/href="\/destinations\/myanmar"/);
});
test('sitemap only lists regional hub when at least one SEA guide is publicly published',async()=>{
 const onlyJapan=db([{country:'Japan',total:1}],[japan]);
 const first=await worker.fetch(new Request(origin+'/sitemap.xml'),{SITE_URL:origin,DB:onlyJapan});
 assert.doesNotMatch(await first.text(),/<loc>https:\/\/tripcaution\.test\/southeast-asia<\/loc>/);
 const regional=db([{country:'Japan',total:1},{country:'Singapore',total:1}],[sg,japan]);
 const second=await worker.fetch(new Request(origin+'/sitemap.xml'),{SITE_URL:origin,DB:regional});
 const xml=await second.text();
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/southeast-asia<\/loc>/);
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/destinations\/singapore<\/loc>/);
 assert.doesNotMatch(xml,/\/destinations\/myanmar<\/loc>/);
 assert.match(sitemapXML(origin,[],[],false,true),/\/southeast-asia<\/loc>/);
});
test('research sources and daily automation only target the eleven-country SEA programme',()=>{
 const sources=JSON.parse(readFileSync(new URL('../automation/sources.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(sources).sort(),[...list].sort());
 for(const [country,urls] of Object.entries(sources)){
  assert.equal(urls.length,2,country+' needs two initial government-source URLs');
  assert.ok(urls.every(url=>url.startsWith('https://')),country+' source URL');
 }
 const daily=readFileSync(new URL('../automation/daily.py',import.meta.url),'utf8');
 const region=daily.slice(daily.indexOf('TOPICS = ['),daily.indexOf('\n\ndef request_json('));
 const countries=[...region.matchAll(/^\s*\("([^"]+)",/gm)].map(match=>match[1]);
 assert.deepEqual(countries.sort(),[...list].sort());
 assert.match(daily,/do not produce a general tourism itinerary/);
});
