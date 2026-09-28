import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {renderArticleMarkdown,editorialQuickTakes} from '../src/article-content.js';
import {isoDate,rasterImage,articleStructuredData,jsonLdTag,sitemapXML} from '../src/seo.js';
import {createAdminSession} from '../src/auth.js';

const origin='https://tripcaution.test';
const article={
 id:'a0000000-0000-4000-a000-000000000001',slug:'metro-start',
 title:'Singapore train & tram guide',country:'Singapore',city:'Singapore',
 category_id:'transport',category_name:'Transport Cautions',status:'published',
 excerpt:'Transit information from real sources and current operator guidance.',
 seo_description:'Singapore transit information from official operators.',
 sources_json:'[{"title":"Official operator","url":"https://example.org/operator","publisher":"Transport operator"}]',
 content_markdown:[
  '## Key takeaways','- Check current fares with the official operator.',
  '- Use the same eligible card when entering and exiting.',
  '## Payment and connections','Compare tickets using **official** sources.',
  '### Check fare conditions','See [operator](https://example.org/faq?x=1&y=2).',
  '## Payment and connections','Repeat heading with a different section.'
 ].join('\n'),
 hero_image_url:'https://tripcaution.test/editorial.svg',
 published_at:'2026-09-26 14:00:00',updated_at:'2026-09-28 04:15:00'
};
function guideDB(){
 const related=[
  {id:'a0000000-0000-4000-a000-000000000002',slug:'other-public',title:'Another Singapore guide',
   country:'Singapore',category_name:'Travel',category_id:'transport',status:'published',excerpt:'Next guide'}
 ];
 const statements=[];
 return {statements,prepare(sql){
  statements.push(sql);
  let bound=[];
  const q={
   bind(...args){bound=args;return q;},
   async first(){
    if(sql.includes("FROM articles a LEFT JOIN")&&sql.includes("a.slug=?"))return bound[0]===article.slug?article:null;
    if(sql.includes("FROM articles a LEFT JOIN")&&sql.includes("a.id=?"))return bound[0]===article.id?article:null;
    return null;
   },
   async all(){return {results:sql.includes("a.id!=?")?related:[]};}
  };
  return q;
 }};
}
test('markdown renders stable unique heading anchors, HTTPS links and never trusts HTML',()=>{
 const input='## Same title\n### Under this\n## Same title\n\n<img src=x onerror=alert(1)>\n\nSee [operator](https://operator.example/a?x=1&y=2), not [evil](javascript:alert(1)).';
 const view=renderArticleMarkdown(input);
 assert.deepEqual(view.headings.map(h=>h.id),['same-title','under-this','same-title-2']);
 assert.match(view.html,/id="same-title-2"/);
 assert.match(view.html,/href="https:\/\/operator\.example\/a\?x=1&amp;y=2"/);
 assert.doesNotMatch(view.html,/<img src=/);
 assert.doesNotMatch(view.html,/href="javascript:/);
});
test('quick takeaways appear only when the editor writes a dedicated section',()=>{
 assert.deepEqual(editorialQuickTakes('## Payment\n- A claim\n- Another claim'),[]);
 assert.deepEqual(editorialQuickTakes('## Key takeaways\n- Verify fare details.\n- Read official operator rules.\n## More'),[
  'Verify fare details.','Read official operator rules.'
 ]);
 assert.deepEqual(editorialQuickTakes('## Key takeaways\n- Only one\n## More'),[]);
});
test('structured Article and Breadcrumb JSON-LD only includes truthful dates and raster images',()=>{
 const doc=articleStructuredData(origin,{...article,hero_image_url:'https://tripcaution.test/cover.png',
  sources:[{url:'https://operator.example/official'}]});
 const [story,crumbs]=doc['@graph'];
 assert.equal(story['@type'],'Article');
 assert.equal(story.datePublished,'2026-09-26T14:00:00.000Z');
 assert.equal(story.dateModified,'2026-09-28T04:15:00.000Z');
 assert.equal(story.image[0],'https://tripcaution.test/cover.png');
 assert.equal(story.citation[0],'https://operator.example/official');
 assert.equal(crumbs['@type'],'BreadcrumbList');
 assert.equal(crumbs.itemListElement.length,3);
 assert.equal(isoDate('not a real date'),null);
 assert.equal(rasterImage('https://example.org/cover.svg'),null);
 assert.equal(rasterImage('javascript:alert(1)'),null);
 const safe=jsonLdTag(articleStructuredData(origin,{...article,title:'</script><img onerror=alert(1)>',sources:[]}));
 assert.ok(!safe.includes('</script><img'));
 assert.ok(safe.includes('\\u003c'));
 const json=JSON.parse(safe.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,''));
 assert.equal(json['@graph'][0].headline,'</script><img onerror=alert(1)>');
});
test('public guide adds contents, optional editorial takeaways, related public links and schema',async()=>{
 const db=guideDB(),response=await worker.fetch(new Request(origin+'/guides/metro-start'),{SITE_URL:origin,DB:db});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/name="twitter:card" content="summary"/); // SVG deliberately not advertised as OG preview
 assert.match(html,/property="og:type" content="article"/);
 assert.match(html,/type="application\/ld\+json"/);
 assert.match(html,/data-article-toc open/);
 assert.match(html,/aria-label="On this page"/);
 assert.match(html,/href="#payment-and-connections-2"/);
 assert.match(html,/class="aside-card editorial-takeaways"/);
 assert.match(html,/Another Singapore guide/);
 assert.match(html,/href="\/guides\/other-public"/);
 assert.match(html,/id="main-content"/);
 assert.match(html,/class="skip-link"/);
 assert.ok(db.statements.some(sql=>sql.includes("a.status='published'")&&sql.includes('a.id!=?')));
 assert.doesNotMatch(html,/property="og:image"/);
});
test('private preview is noindex and has no public Article schema or related guide lookup',async()=>{
 const db=guideDB(),secret='review-preview-'+('z'.repeat(50)),env={SITE_URL:origin,DB:db,ADMIN_LOGIN_KEY:secret};
 const cookie=(await createAdminSession(env)).split(';')[0];
 const response=await worker.fetch(new Request(origin+'/admin/preview/'+article.id,{headers:{Cookie:cookie}}),env);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.doesNotMatch(html,/type="application\/ld\+json"/);
 assert.doesNotMatch(html,/rel="canonical"/);
 assert.match(html,/PRIVATE PREVIEW/);
 assert.ok(!db.statements.some(sql=>sql.includes('a.id!=?')));
});
test('sitemap uses real public timestamps, includes verified Contact only and no draft URLs',()=>{
 const xml=sitemapXML(origin,[{slug:'live',updated_at:'2026-09-28 05:10:00'},
  {slug:'invalid-time',updated_at:'not a date'}],[{country:'Singapore'}],false);
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/guides\/live<\/loc><lastmod>2026-09-28T05:10:00\.000Z<\/lastmod>/);
 assert.match(xml,/<loc>https:\/\/tripcaution\.test\/privacy<\/loc>/);
 assert.doesNotMatch(xml,/\/contact<\/loc>/);
 assert.doesNotMatch(xml,/not a date/);
 assert.match(sitemapXML(origin,[],[],true),/\/contact<\/loc>/);
});
test('search only redirects to destinations actually represented by public articles',async()=>{
 const db={prepare(sql){
  let args=[];
  const q={bind(...items){args=items;return q;},async all(){
   if(sql.includes('SELECT DISTINCT country'))return {results:[{country:'Singapore'}]};
   if(sql.includes("AND (title LIKE"))return {results:[]};
   throw Error('Unexpected search SQL '+sql);
  }};
  return q;
 }};
 const ready=await worker.fetch(new Request(origin+'/search?q=Singapore'),{SITE_URL:origin,DB:db});
 assert.equal(ready.status,302);
 assert.equal(ready.headers.get('Location'),origin+'/destinations/singapore');
 const planned=await worker.fetch(new Request(origin+'/search?q=Vietnam'),{SITE_URL:origin,DB:db});
 assert.equal(planned.status,200);
 const body=await planned.text();
 assert.match(body,/Research planned/);
 assert.doesNotMatch(body,/href="\/destinations\/vietnam"/);
 const wild=await worker.fetch(new Request(origin+'/search?q=%25'),{SITE_URL:origin,DB:db});
 assert.equal(wild.status,200);
});
test('front-end exposes keyboard and phone-friendly article navigation',()=>{
 const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
 const client=readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
 assert.match(css,/\.skip-link:focus/);
 assert.match(css,/\.article-toc>summary:focus-visible|\.article-toc li a:focus-visible/);
 assert.match(client,/matchMedia\('\(max-width: 780px\)'\)/);
});
