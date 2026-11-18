import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/safety-theme.css',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
test('homepage builds a caution identity with real dark/amber hierarchy',()=>{
 assert.match(css,/\.home-hero\s*\{\s*background:radial-gradient\(/);
 assert.match(css,/\.caution-topics-home\s*\{\s*background:#15283c/);
 assert.match(css,/\.caution-topics-home \.caution-topic\s*\{\s*background:#253c52/);
 assert.match(css,/\.home-hero h1\{color:#fff\}/);
 assert.match(css,/\.home-hero \.hero-description\{color:#d1deeb\}/);
 assert.match(css,/\.article-top,\.destination-hero\s*\{/);
 assert.match(css,/#ffb020/);
 assert.match(css,/\.impact-panel\.impact-critical\{border-left-color:#d93636/);
});
test('public documents load the caution override stylesheet after the legacy stylesheet',()=>{
 const first=worker.indexOf('href="/styles.css"');
 const second=worker.indexOf('href="/safety-theme.css"');
 assert.ok(first!==-1&&second>first);
});
test('mobile caution components stay compact and dark without hiding content',()=>{
 assert.match(css,/@media\(max-width:620px\)\{\s*\.caution-topics-home/);
 assert.match(css,/\.caution-topics-home \.caution-topic strong\{color:#fff\}/);
});

test('published caution categories use stable semantic accent colors',()=>{
 const expected=[
  ['scams-theft','#b44d3a'],
  ['payments-money','#c5962b'],
  ['transport','#d47c24'],
  ['laws-customs','#74617f'],
  ['safety-health','#a64040'],
  ['travel-essentials','#3e7772']
 ];
 for(const [slug,color] of expected){
  assert.match(css,new RegExp('\\.category-'+slug+',\\.topic-'+slug+'\\{--category-accent:'+color));
 }
 assert.match(css,/\.guide-card \.visual-tag\[class\*="category-"\]/);
 assert.match(css,/\.caution-topics-home \.caution-topic:not\(\.caution-pending\)\[class\*="topic-"\]/);
 assert.match(css,/\.caution-directory \.caution-topic:not\(\.caution-pending\)\[class\*="topic-"\]/);
});
test('reader-facing cards receive semantic category classes',()=>{
 assert.match(worker,/categoryClass=topic\?' category-'\+topic\.slug:' category-general'/);
 assert.match(worker,/visual-tag\$\{categoryClass\}/);
 assert.match(worker,/caution-topic topic-'\+topic\.slug/);
});
