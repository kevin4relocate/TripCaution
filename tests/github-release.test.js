import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextDailyRelease} from '../scripts/release-daily-article.mjs';
import {githubGuides,mergeGuides,githubTopicCounts} from '../src/github-articles.js';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const batches=['001','002','003','004'];
const drafts=batches.flatMap(b=>read('content/batch-'+b+'/articles.json').articles)
 .sort((a,b)=>Date.parse(a.planned_publish_at)-Date.parse(b.planned_publish_at));
const log=read('content/github-release-log.json');
test('Exactly 400 unique scheduled release slots remain in fixed one-day sequence',()=>{
 assert.equal(drafts.length,400);
 assert.equal(new Set(drafts.map(a=>a.slug)).size,400);
 assert.equal(new Set(drafts.map(a=>a.planned_publish_at)).size,400);
 assert.equal(drafts[0].planned_publish_at,'2026-11-20T01:00:00.000Z');
 assert.equal(drafts.at(-1).planned_publish_at,'2027-12-24T01:00:00.000Z');
 for(let i=1;i<400;i++)assert.equal(Date.parse(drafts[i].planned_publish_at)-Date.parse(drafts[i-1].planned_publish_at),86400000);
});
test('GitHub release is time-gated and never publishes before the assigned date',()=>{
 const before=new Date('2026-11-19T23:00:00+07:00');
 assert.equal(nextDailyRelease(drafts,[],before),null);
 const due=new Date('2026-11-20T08:01:00+07:00');
 assert.equal(nextDailyRelease(drafts,[],due)?.slug,drafts[0].slug);
});
test('A second run on the same Vietnam calendar day cannot release a second article',()=>{
 const issued=[{slug:drafts[0].slug,released_at:'2026-11-20T01:12:00.000Z',published_at:'2026-11-20T01:12:00.000Z'}];
 assert.equal(nextDailyRelease(drafts,issued,new Date('2026-11-20T12:00:00.000Z')),null);
 assert.equal(nextDailyRelease(drafts,issued,new Date('2026-11-21T01:30:00.000Z'))?.slug,drafts[1].slug);
});
test('Every release has exactly two deterministic WebP images per manifest',()=>{
 for(const b of batches){
  const manifest=read('content/batch-'+b+'/image-manifest.json').images;
  const articles=read('content/batch-'+b+'/articles.json').articles;
  assert.equal(manifest.length,200);
  for(let i=0;i<100;i++){
   const article=articles[i],hero=manifest[2*i],inline=manifest[2*i+1];
   assert.equal(article.hero_image_url,hero.public_path);
   assert.ok(article.content_markdown.includes(']('+inline.public_path+')'));
   assert.ok(/^\/media\/editorial\/.+\.webp$/.test(hero.public_path));
   assert.ok(/^\/media\/editorial\/.+-inline-01\.webp$/.test(inline.public_path));
  }
 }
});
test('Published GitHub index contains only committed releases, never draft article records',()=>{
 assert.equal(githubGuides().length,log.releases.length);
 assert.ok(githubGuides().every(a=>a.status==='published'));
 const samples=[
  {slug:'d1-old',title:'D1 existing guide',published_at:'2026-11-01T00:00:00Z'},
  {slug:'shared',title:'Existing D1 guide',published_at:'2026-11-03T00:00:00Z'}
 ];
 const fresh=[{slug:'shared',title:'Do not overwrite DB',published_at:'2026-11-19T00:00:00Z'},
  {slug:'github-new',title:'New GitHub guide',published_at:'2026-11-20T00:00:00Z'}];
 const merged=mergeGuides(samples,fresh);
 assert.equal(merged.length,3);
 assert.equal(merged.find(a=>a.slug==='shared')?.title,'Existing D1 guide');
 assert.equal(merged[0].slug,'github-new');
 assert.equal(githubTopicCounts() instanceof Map,true);
});
