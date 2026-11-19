import test from 'node:test';
import assert from 'node:assert/strict';
import {renderArticleMarkdown, editorialQuickTakes} from '../src/article-content.js';

test('safe internal guide, country, topic and same-page deep links',()=>{
 const {html}=renderArticleMarkdown('See [guide](/guides/a-real-guide), [country](/destinations/thailand), [topic](/cautions/transport), [section](#packing-plan).');
 assert.match(html,/href="\/guides\/a-real-guide"/);
 assert.match(html,/href="\/destinations\/thailand"/);
 assert.match(html,/href="\/cautions\/transport"/);
 assert.match(html,/href="#packing-plan"/);
 assert.doesNotMatch(html,/nofollow/);
});
test('unsafe links and HTML cannot be injected',()=>{
 const {html}=renderArticleMarkdown('Try [no](javascript:alert) [no2](/guides/../../admin) <script>alert(1)</script> [source](https://www.gov.uk/foreign-travel-advice).');
 assert.doesNotMatch(html,/href="javascript:/);
 assert.doesNotMatch(html,/href="\/guides\/\.\./);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/target="_blank" rel="noopener noreferrer nofollow"/);
});
test('rendered H2 and H3 have stable anchors',()=>{
 const {html,headings}=renderArticleMarkdown('## Confirm the departure pier\n\nContent\n\n### Check baggage\n\n## Confirm the departure pier');
 assert.equal(headings.length,3);
 assert.equal(headings[0].id,'confirm-the-departure-pier');
 assert.equal(headings[2].id,'confirm-the-departure-pier-2');
 assert.match(html,/class="heading-anchor" href="#confirm-the-departure-pier-2"/);
});
test('image and following editorial caption form one figure',()=>{
 const sample='![Traveler preparing](/media/editorial/example-inline-01.webp)\n\n> Illustration caption: Checking the correct pickup point. AI-generated editorial illustration.';
 const {html}=renderArticleMarkdown(sample);
 assert.match(html,/<figure class="article-inline-image">/);
 assert.match(html,/<figcaption>Checking the correct pickup point/);
 assert.doesNotMatch(html,/<blockquote>/);
});
test('unsupported media embeds are not rendered',()=>{
 const {html}=renderArticleMarkdown('![bad](/media/private/hidden.webp)\n\ntext');
 assert.doesNotMatch(html,/<img/);
});
test('key takeaways remain available in sidebar',()=>{
 const takes=editorialQuickTakes('## Key takeaways\n- Carry water.\n- Use the correct entrance.\n\n## Next\nSomething');
 assert.deepEqual(takes,['Carry water.','Use the correct entrance.']);
});
