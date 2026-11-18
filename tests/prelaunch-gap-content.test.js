import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeArticle} from '../src/content.js';
const pack=JSON.parse(readFileSync(new URL('../content/prelaunch-seven-country-gap-pack.json',import.meta.url),'utf8'));
const starter=JSON.parse(readFileSync(new URL('../content/starter-guides.json',import.meta.url),'utf8'));
test('seven gap manuscripts cover exactly the countries missing from initial regional seed',()=>{
 const expected=['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines'];
 assert.deepEqual(pack.articles.map(a=>a.country).sort(),expected.sort());
 assert.equal(new Set(pack.articles.map(a=>a.slug)).size,7);
 const olderSlugs=new Set(starter.articles.map(a=>a.slug));
 for(const guide of pack.articles){
  assert.ok(!olderSlugs.has(guide.slug),guide.slug);
  assert.equal(guide.publishing.mode,'manual_import');
  assert.equal(guide.publishing.requested_status,'review_before_publication');
  assert.equal(guide.auto_publish,undefined);
  assert.ok(guide.content_markdown.split(/\s+/).length>=350);
  assert.ok(guide.research.sources.length>=2);
  assert.ok(guide.research.sources.every(s=>s.url.startsWith('https://')));
  const normalized=normalizeArticle(guide);
  assert.equal(normalized.country,guide.country);
  assert.equal(normalized.slug,guide.slug);
  assert.equal(normalized.caution_level,'unassessed');
 }
});
test('expanded homepage retrieves only genuinely published guides up to twelve',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(source,/a\.status='published' AND a\.published_at<=datetime\('now'\)/);
 assert.match(source,/a\.published_at DESC LIMIT 12/);
 assert.match(source,/latest\.slice\(3,12\)/);
});
