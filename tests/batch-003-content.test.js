import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const batch=read('../content/batch-003/articles.json');
const manifest=read('../content/batch-003/image-manifest.json');
const plan=read('../content/batch-003/editorial-plan.json');
const b1=read('../content/batch-001/articles.json');
const b2=read('../content/batch-002/articles.json');
const articles=batch.articles, images=manifest.images;

test('100 evergreen draft guides are distinct from the first two batches',()=>{
 assert.equal(articles.length,100);
 assert.equal(plan.topics.length,100);
 assert.equal(new Set(articles.map(a=>a.slug)).size,100);
 const previous=new Set([...b1.articles,...b2.articles].map(x=>x.slug));
 assert.ok(articles.every(a=>!previous.has(a.slug) && a.evergreen===true));
 assert.ok(articles.every(a=>a.editorial_status==='REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS'));
 assert.ok(articles.every(a=>a.sources.length===2 && a.content_markdown.split(/\s+/).length>=780));
 assert.ok(articles.every(a=>a.editorial_status==='REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS' && a.research?.uncertainties?.length>=2));
});
test('200 image prompts, watermark, filenames and article roles align',()=>{
 assert.equal(images.length,200);
 assert.equal(manifest.source_folder,'Images/Batch-003');
 assert.equal(manifest.watermark,'tripcaution.com');
 assert.equal(new Set(images.map(i=>i.r2_key)).size,200);
 for(let i=0;i<images.length;i++){
  const x=images[i],a=articles[Math.floor(i/2)];
  assert.equal(x.number,i+1);
  assert.equal(x.article_number,Math.floor(i/2)+1);
  assert.equal(x.upload_filename,'Gen_'+String(i+1).padStart(3,'0')+'.webp');
  assert.equal(x.source_path,'Images/Batch-003/'+x.upload_filename);
  assert.equal(x.role,i%2?'inline':'hero');
  assert.equal(x.r2_key,'editorial/'+a.slug+(i%2?'-inline-01':'')+'.webp');
  assert.equal(x.public_path,'/media/'+x.r2_key);
  assert.equal(x.watermark,'tripcaution.com');
  assert.ok(x.prompt.includes('"tripcaution.com"') && x.prompt.includes('gouache and ink-wash'));
  assert.ok(x.prompt.length<=1600);
  assert.ok(x.alt && x.caption);
  if(i%2===1){
   assert.equal(a.image_metadata.inline_alt,x.alt);
   assert.equal(a.image_metadata.inline_caption,x.caption);
   assert.ok(a.content_markdown.includes(x.public_path));
  }else{
   assert.equal(a.hero_prompt,x.prompt);
   assert.equal(a.hero_alt,x.alt);
   assert.equal(a.image_metadata.hero_caption,x.caption);
  }
 }
});
test('CSV faithfully represents the entire 200-image JSON manifest',()=>{
 const cols=['number','article_number','upload_filename','source_path','target_filename','r2_key','public_path','role','country','title','alt','caption','watermark','prompt'];
 const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
 const csv=cols.join(',')+'\n'+images.map(x=>cols.map(k=>quote(x[k])).join(',')).join('\n')+'\n';
 assert.equal(readFileSync(new URL('../content/batch-003/image-manifest.csv',import.meta.url),'utf8'),csv);
});
test('planned slots follow Batch 002 with one article each day',()=>{
 assert.equal(new Date(b2.articles.at(-1).planned_publish_at).getTime()+86400000,new Date(articles[0].planned_publish_at).getTime());
 for(let i=0;i<articles.length;i++)
  assert.equal(articles[i].planned_publish_at,new Date(Date.UTC(2027,5,8,1)+86400000*i).toISOString());
});
test('GitHub contents API can read both Batch 003 JSON files',()=>{
 assert.ok(readFileSync(new URL('../content/batch-003/articles.json',import.meta.url)).length<1000000);
 assert.ok(readFileSync(new URL('../content/batch-003/image-manifest.json',import.meta.url)).length<1000000);
});
