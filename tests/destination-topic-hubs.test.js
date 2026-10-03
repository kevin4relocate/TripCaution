import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {groupDestinationGuides,destinationHubDescription} from '../src/destination-hubs.js';

const site='https://tripcaution.test';
const example=(id,category,slug,title)=>({
 id,category_id:category,slug,title,country:'Singapore',city:'Singapore',
 excerpt:'Guide to a specific published travel question.',status:'published',
 published_at:'2026-09-30 08:00:00',hero_image_url:null
});
const guides=[
 example('1','transport','singapore-trains','Checking Singapore train fares'),
 example('2','tourist-traps','singapore-scams','Checking Singapore tourist scams'),
 example('3','local-laws','singapore-rules','Checking Singapore local rules'),
 example('4','before-you-go','singapore-arrival','Checking a Singapore arrival requirement'),
 example('5','nonstandard','singapore-other','Checking an additional travel question')
];
const mockDB=rows=>({prepare(sql){
 let args=[];const q={bind(...values){args=values;return q;},async all(){
  if(sql.includes("lower(replace(a.country,' ','-'))=?"))
   return {results:args[0]==='singapore'?rows:[]};
  throw Error('Unexpected SQL '+sql);
 }};
 return q;
}});
test('published topics are grouped in a stable, no-duplicates order',()=>{
 const grouped=groupDestinationGuides(guides);
 assert.deepEqual(grouped.map(group=>group.slug),[
  'scams-theft','transport','laws-customs','travel-essentials','other'
 ]);
 assert.deepEqual(grouped.flatMap(group=>group.guides.map(guide=>guide.slug)).sort(),
  guides.map(guide=>guide.slug).sort());
 assert.deepEqual(groupDestinationGuides([]),[]);
 assert.match(destinationHubDescription('Singapore','Singapore',grouped,5),/for Singapore on/);
 assert.doesNotMatch(destinationHubDescription('Singapore','Singapore',grouped,5),/Singapore, Singapore/);
 assert.match(destinationHubDescription('Bangkok','Thailand',grouped,5),/Bangkok, Thailand/);
});

test('a published country hub offers real topic anchors and source-linked guide cards',async()=>{
 const response=await app.fetch(new Request(site+'/destinations/singapore'),{
  SITE_URL:site,DB:mockDB(guides)
 });
 assert.equal(response.status,200);
 const page=await response.text();
 assert.match(page,/rel="canonical" href="https:\/\/tripcaution\.test\/destinations\/singapore"/);
 assert.match(page,/Explore 5 source-linked travel guides for Singapore/);
 assert.doesNotMatch(page,/Singapore, Singapore/);
 assert.match(page,/aria-label="Jump to Singapore travel topics"/);
 for(const slug of ['scams-theft','transport','laws-customs','travel-essentials','other']){
  assert.match(page,new RegExp('href="#topic-'+slug+'"'));
  assert.match(page,new RegExp('id="topic-'+slug+'"'));
 }
 assert.match(page,/href="\/cautions\/transport"/);
 assert.doesNotMatch(page,/href="\/cautions\/other"/);
 assert.equal((page.match(/class="guide-card(?: |")/g)||[]).length,guides.length);
 const scam=page.indexOf('id="topic-scams-theft"');
 const train=page.indexOf('id="topic-transport"');
 assert.ok(scam>=0 && train>scam);
 assert.match(page,/Before traveling, verify important details with the linked original sources/);
});

test('a country with no public content remains noindex and has no fabricated topic links',async()=>{
 const result=await app.fetch(new Request(site+'/destinations/vietnam'),{SITE_URL:site});
 assert.equal(result.status,200);
 const html=await result.text();
 assert.match(html,/<meta name="robots" content="noindex,follow">/);
 assert.doesNotMatch(html,/class="destination-topic-nav"/);
 assert.doesNotMatch(html,/href="\/cautions\/transport"/);
 assert.match(html,/Research in progress/);
});
