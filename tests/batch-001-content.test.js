import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const batch=JSON.parse(readFileSync(new URL('../content/batch-001/articles.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../content/batch-001/image-manifest.json',import.meta.url)));
test('100 unique review-only articles',()=>{
 assert.equal(batch.articles.length,100);
 assert.equal(new Set(batch.articles.map(a=>a.slug)).size,100);
 assert.ok(batch.articles.every(a=>a.editorial_status==='REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS' && a.sources.length>=2));
});
test('200 deterministic image slots and exact two-per-article pairing',()=>{
 const images=manifest.images,articles=batch.articles;
 assert.equal(images.length,200);
 assert.equal(new Set(images.map(i=>i.r2_key)).size,200);
 for(let i=0;i<images.length;i++){
  const x=images[i],a=articles[Math.floor(i/2)];
  assert.equal(x.number,i+1);
  assert.equal(x.article_number,Math.floor(i/2)+1);
  assert.equal(x.upload_filename,'Gen_'+String(i+1).padStart(3,'0')+'.webp');
  assert.equal(x.role,i%2?'inline':'hero');
  assert.equal(x.r2_key,'editorial/'+a.slug+(i%2?'-inline-01':'')+'.webp');
  assert.ok(x.caption && x.alt && x.prompt);
  if(i%2===1)assert.ok(a.content_markdown.includes(x.public_path));
  else assert.equal(a.hero_image_url,x.public_path);
 }
});
test('exactly one planned publishing slot per day',()=>{
 for(let i=0;i<batch.articles.length;i++)
  assert.equal(batch.articles[i].planned_publish_at,new Date(Date.UTC(2026,10,20,1)+86400000*i).toISOString());
});
