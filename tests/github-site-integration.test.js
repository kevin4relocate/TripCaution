import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {releasedArticles} from '../src/github-release-index.js';

test('A released GitHub guide appears on article page, homepage, destination, caution, search and sitemap without D1',async()=>{
 const slug='example-github-published-guide';
 const meta={
  slug,title:'Vietnam Train Trip Booking Guide',country:'Vietnam',city:'Hanoi',
  category_id:'transport',category_name:'transport',
  excerpt:'Make an official booking and check your train ticket.',
  seo_title:'Vietnam Train Trip Booking Guide',seo_description:'A practical Vietnam train guide with official booking checks and return planning.',
  hero_image_url:'/media/editorial/'+slug+'.webp',
  hero_alt:'Illustration of train and passenger luggage',
  published_at:'2026-11-20T01:00:00.000Z',updated_at:'2026-11-20T01:00:00.000Z',
  status:'published',source_mode:'github-scheduled',review_approved:0,caution_level:'unassessed'
 };
 const article={...meta,id:'github-'+slug,
  content_markdown:'## Key takeaways\n- Confirm the station\n- Keep the ticket\n- Check the return\n\n## Confirm the station\nAsk the actual rail operator which station is printed on the ticket.\n\n## Check the return\nKeep a realistic connection plan.',
  sources_json:JSON.stringify([{title:'Official operator',publisher:'Rail operator',url:'https://example.org/rail'}]),
  tags_json:'[]',severity_scope:'',severity_rationale:''};
 let assetRequests=0;
 const env={SITE_URL:'https://tripcaution.example',EDITORIAL_CONTACT_EMAIL:'contact@tripcaution.example',
  EDITORIAL_CONTACT_VERIFIED:'true',ASSETS:{fetch:async req=>{
    assetRequests++;
    if(new URL(req.url).pathname==='/releases/articles/'+slug+'.json')
     return new Response(JSON.stringify(article),{status:200,headers:{'content-type':'application/json'}});
    return new Response('Not found',{status:404});
  }}};
 releasedArticles.push(meta);
 try{
  const paths=['/guides/'+slug,'/','/destinations/vietnam','/cautions/transport','/search?q=Train','/sitemap.xml'];
  const responses=await Promise.all(paths.map(p=>worker.fetch(new Request('https://tripcaution.example'+p),env)));
  const bodies=await Promise.all(responses.map(r=>r.text()));
  for(let i=0;i<paths.length;i++)assert.equal(responses[i].status,200,paths[i]+' returned '+responses[i].status+' '+bodies[i].slice(0,160));
  assert.match(bodies[0],/Vietnam Train Trip Booking Guide/);
  assert.match(bodies[0],/Sources &amp; verification|Sources & verification/);
  assert.match(bodies[0],/Not independently verified/);
  assert.match(bodies[0],/example-github-published-guide\.webp/);
  assert.match(bodies[1],new RegExp(slug));
  assert.match(bodies[2],new RegExp(slug));
  assert.match(bodies[3],new RegExp(slug));
  assert.match(bodies[4],new RegExp(slug));
  assert.match(bodies[5],new RegExp(slug));
  assert.equal(assetRequests,1,'Only article detail requests published JSON; lists rely on committed index');
 }finally {
  const i=releasedArticles.findIndex(x=>x.slug===slug);
  if(i>=0)releasedArticles.splice(i,1);
 }
});
