import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(file)=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
const drafts=read('../content/batch-004/articles.json').articles;
const plan=read('../content/batch-004/editorial-plan.json').topics;
const manifest=read('../content/batch-004/image-manifest.json');
const images=manifest.images;
const prior=['001','002','003'].flatMap(b=>read('../content/batch-'+b+'/articles.json').articles);
const slug=s=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

test('Batch 004: 100 full-length drafts cover ten countries and have independent SEO metadata',()=>{
 assert.equal(drafts.length,100);
 assert.equal(plan.length,100);
 assert.equal(new Set(drafts.map(x=>x.slug)).size,100);
 assert.equal(new Set(drafts.map(x=>x.seo_description)).size,100);
 assert.equal(new Set(drafts.map(x=>x.excerpt)).size,100);
 assert.deepEqual([...new Set(plan.map(x=>x.country))],['Brunei','Cambodia','Indonesia','Laos','Malaysia','Philippines','Singapore','Thailand','Timor-Leste','Vietnam']);
 for(const country of new Set(plan.map(x=>x.country)))assert.equal(plan.filter(x=>x.country===country).length,10);
 const previous=new Set(prior.map(x=>x.slug));
 for(let i=0;i<100;i++){
  const a=drafts[i],p=plan[i];
  assert.equal(a.title,p.title);
  assert.equal(a.slug,slug(p.title));
  assert.ok(!previous.has(a.slug),a.slug);
  assert.equal(a.editorial_status,'REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS');
  assert.equal(a.editorial_standard_version,4);
  assert.equal(a.evergreen,true);
  assert.equal(a.research.verified_at,null);
  assert.equal(a.sources.length,2);
  assert.ok(a.content_markdown.includes(p.unique_scenario),a.slug);
  assert.ok(a.content_markdown.includes(p.decision_detail),a.slug);
  assert.equal((a.content_markdown.match(/^## /gm)||[]).length,10,a.slug);
  for(const c of p.checks)assert.ok(a.content_markdown.includes(c),a.slug);
  const wordCount=a.content_markdown.trim().split(/\s+/).length;
  assert.ok(wordCount>=830&&wordCount<=950,a.slug+' word count '+wordCount);
  assert.ok(a.seo_description.length>=50&&a.seo_description.length<=160,a.slug);
  assert.ok(a.content_markdown.includes('](/destinations/'+slug(a.country)+')'),a.slug);
  assert.ok(a.content_markdown.includes('](#sources-and-verification)'),a.slug);
 }
});

test('Batch 004: exactly 200 watermarked image slots align with WebP paths and article copy',()=>{
 assert.equal(manifest.source_folder,'Images/Batch-004');
 assert.equal(manifest.watermark,'tripcaution.com');
 assert.equal(images.length,200);
 assert.equal(new Set(images.map(x=>x.r2_key)).size,200);
 const otherKeys=new Set(['001','002','003'].flatMap(b=>read('../content/batch-'+b+'/image-manifest.json').images.map(x=>x.r2_key)));
 for(let i=0;i<images.length;i++){
  const x=images[i],a=drafts[Math.floor(i/2)],num=i+1;
  assert.equal(x.number,num);
  assert.equal(x.article_number,Math.floor(i/2)+1);
  assert.equal(x.upload_filename,'Gen_'+String(num).padStart(3,'0')+'.webp');
  assert.equal(x.source_path,'Images/Batch-004/'+x.upload_filename);
  assert.equal(x.role,i%2?'inline':'hero');
  assert.equal(x.r2_key,'editorial/'+a.slug+(i%2?'-inline-01':'')+'.webp');
  assert.equal(x.public_path,'/media/'+x.r2_key);
  assert.ok(!otherKeys.has(x.r2_key),x.r2_key);
  assert.ok(x.prompt.includes('"tripcaution.com"')&&x.prompt.includes('gouache and ink wash'),x.upload_filename);
  assert.ok(x.prompt.length<=1600,x.upload_filename);
  assert.ok(x.alt&&x.caption);
  if(i%2){
   assert.equal(a.image_metadata.inline_alt,x.alt);
   assert.equal(a.image_metadata.inline_caption,x.caption);
   assert.ok(a.content_markdown.includes(']('+x.public_path+')'));
  }else{
   assert.equal(a.hero_prompt,x.prompt);
   assert.equal(a.hero_alt,x.alt);
   assert.equal(a.image_metadata.hero_caption,x.caption);
   assert.equal(a.hero_image_url,x.public_path);
  }
 }
});

test('Batch 004: image CSV is a complete faithful export',()=>{
 const cols=['number','article_number','upload_filename','source_path','target_filename','r2_key','public_path','role','country','title','alt','caption','watermark','prompt'];
 const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const csv=cols.join(',')+'\n'+images.map(i=>cols.map(c=>q(i[c])).join(',')).join('\n')+'\n';
 assert.equal(readFileSync(new URL('../content/batch-004/image-manifest.csv',import.meta.url),'utf8'),csv);
});

test('Batch 004: schedule continues from Batch 003, one slot per Vietnam day',()=>{
 const all=[...prior,...drafts];
 assert.equal(all.length,400);
 assert.equal(new Set(all.map(a=>a.slug)).size,400);
 assert.equal(new Set(all.map(a=>a.planned_publish_at)).size,400);
 assert.equal(new Date(prior.at(-1).planned_publish_at).getTime()+86400000,Date.parse(drafts[0].planned_publish_at));
 for(let i=0;i<100;i++)assert.equal(drafts[i].planned_publish_at,new Date(Date.UTC(2027,8,16,1)+i*86400000).toISOString());
 assert.equal(drafts.at(-1).planned_publish_at,'2027-12-24T01:00:00.000Z');
});
test('Batch 004: GitHub Contents API-friendly JSON sizes',()=>{
 assert.ok(readFileSync(new URL('../content/batch-004/articles.json',import.meta.url)).length<1000000);
 assert.ok(readFileSync(new URL('../content/batch-004/image-manifest.json',import.meta.url)).length<1000000);
});
