import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const batch=JSON.parse(readFileSync(new URL('../content/batch-002/articles.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../content/batch-002/image-manifest.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('../content/batch-001/articles.json',import.meta.url),'utf8'));
const rows=manifest.images,articles=batch.articles;

test('Batch 002 has 100 distinct evergreen review-only guides with no Batch 001 slug duplication',()=>{
 assert.equal(articles.length,100);
 assert.equal(new Set(articles.map(a=>a.slug)).size,100);
 const oldSlugs=new Set(old.articles.map(a=>a.slug));
 assert.ok(articles.every(a=>!oldSlugs.has(a.slug) && a.evergreen===true));
 assert.ok(articles.every(a=>a.editorial_status==='REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS'));
 assert.ok(articles.every(a=>a.sources.length>=2 && a.content_markdown.length>=2500));
});
test('Batch 002 uses Gen_001 through Gen_200 in a distinct folder without touching Batch 001',()=>{
 assert.equal(rows.length,200);
 assert.equal(new Set(rows.map(x=>x.r2_key)).size,200);
 assert.ok(rows.every(x=>x.source_path.startsWith('Images/Batch-002/')));
 for(let i=0;i<rows.length;i++){
  const r=rows[i],a=articles[Math.floor(i/2)];
  assert.equal(r.number,i+1);
  assert.equal(r.article_number,Math.floor(i/2)+1);
  assert.equal(r.upload_filename,'Gen_'+String(i+1).padStart(3,'0')+'.webp');
  assert.equal(r.role,i%2?'inline':'hero');
  assert.equal(r.r2_key,'editorial/'+a.slug+(i%2?'-inline-01':'')+'.webp');
  assert.equal(r.public_path,'/media/'+r.r2_key);
  assert.ok(r.alt && r.caption && r.prompt);
  assert.equal(r.watermark,'tripcaution.com');
  assert.ok(r.prompt.includes('"tripcaution.com"'));
  assert.ok(r.prompt.includes('gouache and ink-wash'));
  assert.ok(r.prompt.length<=1600);
  if(i%2)assert.ok(a.content_markdown.includes(r.public_path));
  else assert.equal(a.hero_prompt,r.prompt);
 }
});
test('Batch 002 image CSV is exactly synchronized with its JSON manifest',()=>{
 const fields=['number','article_number','upload_filename','source_path','target_filename','r2_key','public_path','role','country','title','alt','caption','watermark','prompt'];
 const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const csv=fields.join(',')+'\n'+rows.map(x=>fields.map(k=>q(x[k])).join(',')).join('\n')+'\n';
 assert.equal(readFileSync(new URL('../content/batch-002/image-manifest.csv',import.meta.url),'utf8'),csv);
});
test('Batch 002 planned dates follow Batch 001 with one slot per day',()=>{
 for(let i=0;i<articles.length;i++){
  assert.equal(articles[i].planned_publish_at,new Date(Date.UTC(2027,1,28,1)+86400000*i).toISOString());
 }
 assert.equal(new Date(old.articles.at(-1).planned_publish_at).getTime()+86400000,new Date(articles[0].planned_publish_at).getTime());
});
