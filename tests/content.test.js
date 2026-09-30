import test from 'node:test';
import assert from 'node:assert/strict';
import {slugify,normalizeURL,normalizeMediaURL,normalizeArticle,isValidSchedule} from '../src/content.js';
test('slug normalization',()=>assert.equal(slugify('Bangkok — Before You Go!'),'bangkok-before-you-go'));
test('reject unsafe sources',()=>assert.equal(normalizeURL('javascript:alert(1)'),null));
test('validate article',()=>{
 const a=normalizeArticle({title:'A travel guide',country:'Cambodia',content_markdown:'Practical guide. '.repeat(15),sources:[{title:'Authority',url:'https://example.org'}]});
 assert.equal(a.category_id,'before-you-go');
 assert.ok(a.sources_json.includes('example.org'));
});
test('schedule requires time zone',()=>{
 assert.equal(isValidSchedule('2026-10-01T03:00:00Z'),true);
 assert.equal(isValidSchedule('2026-10-01T03:00:00'),false);
});

test('accept deterministic relative editorial media path but reject unrelated relative paths',()=>{
 assert.equal(normalizeMediaURL('/media/editorial/hanoi-motorbike-taxi.webp'),'/media/editorial/hanoi-motorbike-taxi.webp');
 assert.equal(normalizeMediaURL('/uploads/hanoi.webp'),null);
 assert.equal(normalizeMediaURL('/media/editorial/../escape.webp'),null);
});
test('article import preserves deterministic relative hero image path',()=>{
 const a=normalizeArticle({
  title:'Hanoi motorbike taxi caution',country:'Vietnam',
  slug:'hanoi-motorbike-taxi-caution',
  content_markdown:'Practical caution. '.repeat(15),
  images:{hero_image_url:'/media/editorial/hanoi-motorbike-taxi-caution.webp',hero_prompt:'A specific caution illustration prompt.',alt_text:'Traveler checking a motorbike ride in Hanoi.'}
 });
 assert.equal(a.hero_image_url,'/media/editorial/hanoi-motorbike-taxi-caution.webp');
 assert.equal(a.hero_alt,'Traveler checking a motorbike ride in Hanoi.');
});
