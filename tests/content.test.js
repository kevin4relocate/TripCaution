import test from 'node:test';
import assert from 'node:assert/strict';
import {slugify,normalizeURL,normalizeArticle,canAutoPublish,isValidSchedule} from '../src/content.js';
test('slug normalization',()=>assert.equal(slugify('Bangkok — Before You Go!'),'bangkok-before-you-go'));
test('reject unsafe sources',()=>assert.equal(normalizeURL('javascript:alert(1)'),null));
test('validate article',()=>{
 const a=normalizeArticle({title:'A travel guide',country:'Cambodia',content_markdown:'Practical guide. '.repeat(15),sources:[{title:'Authority',url:'https://example.org'}]});
 assert.equal(a.category_id,'before-you-go');
 assert.equal(canAutoPublish(a),false);
});
test('schedule requires time zone',()=>{
 assert.equal(isValidSchedule('2026-10-01T03:00:00Z'),true);
 assert.equal(isValidSchedule('2026-10-01T03:00:00'),false);
});
