import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=(n,path='articles.json')=>JSON.parse(readFileSync(new URL('../content/batch-'+n+'/'+path,import.meta.url),'utf8'));
const allowedTopic={'transport':'transport','travel-essentials':'travel-essentials','before-you-go':'travel-essentials','food':'travel-essentials','etiquette':'laws-customs','safety-health':'safety-health','payments-money':'payments-money','local-laws':'laws-customs'};
for(const batch of ['001','002','003']){
 test('Batch '+batch+': all 100 drafts have useful links, source anchors, SEO and immutable image mapping',()=>{
  const pkg=load(batch),images=load(batch,'image-manifest.json').images;
  assert.equal(pkg.articles.length,100);
  assert.equal(images.length,200);
  for(let i=0;i<100;i++){
   const a=pkg.articles[i],hero=images[2*i],inline=images[2*i+1];
   assert.equal(a.editorial_standard_version,3);
   assert.equal(a.editorial_status,'REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS');
   assert.equal(a.hero_image_url,hero.public_path);
   assert.equal(a.hero_prompt,hero.prompt);
   assert.equal(a.hero_alt,hero.alt);
   assert.ok(a.content_markdown.includes(']('+inline.public_path+')'));
   assert.ok(a.image_metadata.inline_caption===inline.caption);
   assert.equal((a.content_markdown.match(/^!\[/gm)||[]).length,1);
   assert.ok(a.seo_description.length>40&&a.seo_description.length<=160);
   assert.ok(!a.seo_title.endsWith(' | TripCaution'));
   assert.ok(a.sources.length>=2);
   assert.ok(a.content_markdown.includes('## Key takeaways'));
   assert.ok(a.content_markdown.includes('## Continue exploring '+a.country));
   assert.match(a.content_markdown,/\]\(\/destinations\/[a-z0-9-]+\)/);
   assert.ok(a.content_markdown.includes('](/cautions/'+(allowedTopic[a.category]||'travel-essentials')+')'));
   assert.ok(a.content_markdown.includes('](#sources-and-verification)'));
   assert.equal((a.content_markdown.match(/^(?:## )/gm)||[]).length,batch==='001'?8:10);
   assert.ok(a.content_markdown.split(/\s+/).length>=650);
   assert.ok(a.research.uncertainties.some(s=>s.includes('research starting points')));
  }
 });
}
test('Article titles, SEO image paths and publish date are distinct across 3 batches',()=>{
 const all=['001','002','003'].flatMap(b=>load(b).articles);
 assert.equal(all.length,300);
 assert.equal(new Set(all.map(x=>x.slug)).size,300);
 assert.equal(new Set(all.map(x=>x.hero_image_url)).size,300);
 for(let i=1;i<all.length;i++){
  assert.equal(new Date(all[i].planned_publish_at).getTime()-new Date(all[i-1].planned_publish_at).getTime(),86400000);
 }
});

test('V3: editorial content is article-specific and shared boilerplate does not dominate',()=>{
 const all=['001','002','003'].flatMap(b=>load(b).articles);
 const paragraphs=new Map(),introductions=new Set();
 for(const a of all){
  assert.equal(a.editorial_standard_version,3,a.slug);
  assert.equal(a.editorial_status,'REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS',a.slug);
  const first=a.content_markdown.split(/\n\n## Key takeaways/)[0];
  assert.ok(first.length>=100,'Topic-specific opening missing: '+a.slug);
  assert.ok(!introductions.has(first),'Repeated opening: '+a.slug);
  introductions.add(first);
  assert.ok(a.content_markdown.split(/\s+/).length>=780,'Article too thin: '+a.slug);
  assert.ok(!a.content_markdown.includes('The checks below identify decisions to verify with the responsible provider; they are not confirmation of live conditions.'),a.slug);
  for(const part of a.content_markdown.split(/\n\s*\n/)){
   const p=part.trim();
   if(p.length<=90||p.startsWith('#')||p.startsWith('- '))continue;
   paragraphs.set(p,(paragraphs.get(p)||0)+1);
  }
 }
 const veryFrequent=[...paragraphs].filter(([,n])=>n>=12);
 assert.deepEqual(veryFrequent.map(([p,n])=>({excerpt:p.slice(0,95),n})),[]);
 const notes=load('001','topic-notes.json').notes;
 assert.equal(notes.length,100);
 for(let i=0;i<100;i++){
  assert.equal(notes[i].slug,load('001').articles[i].slug);
  assert.ok(load('001').articles[i].content_markdown.includes(notes[i].note));
 }
});
