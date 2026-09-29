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
