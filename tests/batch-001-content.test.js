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

test('all 200 reference-style prompts are synchronized across article, manifest and CSV',()=>{
 const style='Moody editorial travel-safety illustration in the TripCaution reference style:';
 const csv=readFileSync(new URL('../content/batch-001/image-manifest.csv',import.meta.url),'utf8');
 const names=['number','article_number','upload_filename','target_filename','r2_key','public_path','role','country','title','alt','caption','prompt'];
 const encode=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const reconstructed=names.join(',')+'\n'+manifest.images.map(row=>names.map(name=>encode(row[name])).join(',')).join('\n')+'\n';
 assert.equal(csv,reconstructed);
 for(let i=0;i<100;i++){
  const a=batch.articles[i],hero=manifest.images[i*2],inline=manifest.images[i*2+1];
  assert.ok(a.hero_prompt.startsWith(style));
  assert.equal(a.hero_prompt,hero.prompt);
  assert.ok(inline.prompt.startsWith(style));
  assert.match(hero.prompt,/angular navy\/red chevrons/);
  assert.match(inline.prompt,/INLINE \/ SUPPORTING SCENE/);
  assert.ok(!/watercolor/i.test(hero.prompt+inline.prompt));
  assert.equal(a.hero_alt,hero.alt);
  assert.equal(a.image_metadata.inline_alt,inline.alt);
  assert.ok(hero.caption && inline.caption);
 }
});

test('prompts stay self-contained under 1600 characters and articles.json stays GitHub-readable',()=>{
 const raw=readFileSync(new URL('../content/batch-001/articles.json',import.meta.url));
 assert.ok(raw.length<1000000,'JSON file must remain below the GitHub 1 MB contents API threshold');
 for(const x of manifest.images){
  assert.ok(x.prompt.length<=1600, 'Image '+x.number+' prompt too long');
  assert.ok(x.prompt.includes('gouache and ink-wash'), 'Style missing');
 }
});
