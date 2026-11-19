import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (batch, filename='articles.json') => JSON.parse(
 readFileSync(new URL('../content/batch-'+batch+'/'+filename, import.meta.url), 'utf8')
);
const batches=['001','002','003'];
const articles=batches.flatMap(b=>read(b).articles);

test('300 drafts have distinct specific SEO descriptions and excerpts',()=>{
 assert.equal(articles.length,300);
 assert.equal(new Set(articles.map(a=>a.seo_description)).size,300);
 assert.equal(new Set(articles.map(a=>a.excerpt)).size,300);
 for(const a of articles){
  assert.ok(a.seo_description.length>=50 && a.seo_description.length<=160,a.slug);
  assert.ok(!a.seo_description.includes('Essential checks, practical alternatives'),a.slug);
  assert.ok(a.excerpt.startsWith('In '),a.slug);
  assert.ok(!a.excerpt.includes('null,')&&!a.excerpt.includes('undefined'),a.slug);
  assert.equal(a.editorial_status,'REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS');
 }
});
test('First batch no longer uses duplicated generic opening',()=>{
 for(const a of read('001').articles){
  assert.ok(!a.content_markdown.includes('begins with a practical problem rather than a dramatic warning'),a.slug);
  assert.ok(a.content_markdown.includes('## Key takeaways'),a.slug);
 }
});
test('300 original image slots and scheduled day spacing remain intact',()=>{
 assert.equal(new Set(articles.map(a=>a.slug)).size,300);
 for(const batch of batches){
  const drafts=read(batch).articles,images=read(batch,'image-manifest.json').images;
  assert.equal(images.length,200);
  for(let i=0;i<100;i++){
   const a=drafts[i],hero=images[2*i],inline=images[2*i+1];
   assert.equal(a.hero_image_url,hero.public_path,a.slug);
   assert.equal(a.hero_prompt,hero.prompt,a.slug);
   assert.equal(a.hero_alt,hero.alt,a.slug);
   assert.equal(a.image_metadata.inline_caption,inline.caption,a.slug);
   assert.ok(a.content_markdown.includes(']('+inline.public_path+')'),a.slug);
   assert.equal((a.content_markdown.match(/^!\\[/gm)||[]).length,1,a.slug);
  }
 }
 assert.equal(articles[0].planned_publish_at,'2026-11-20T01:00:00.000Z');
 for(let i=1;i<articles.length;i++)
  assert.equal(Date.parse(articles[i].planned_publish_at)-Date.parse(articles[i-1].planned_publish_at),86400000,articles[i].slug);
});
test('Four early airport guides link to topical authority information',()=>{
 const pairs=new Map([
  ['getting-from-brunei-international-airport-to-bandar-seri-begawan','travel.state.gov'],
  ['choosing-a-phnom-penh-arrival-transfer-without-confusion','techoairport.com.kh'],
  ['finding-your-correct-bali-airport-ride-pickup','bali-airport.com'],
  ['arriving-in-vientiane-how-to-check-your-transfer','wattayairportljats.com.la']
 ]);
 for(const [slug,host] of pairs){
  const a=articles.find(a=>a.slug===slug);
  assert.ok(a,slug);
  assert.ok(a.sources.some(s=>new URL(s.url).hostname.includes(host)),slug);
  assert.ok(a.sources.some(s=>s.url.includes(host)&&a.content_markdown.includes(']('+s.url+')')),slug);
 }
});
