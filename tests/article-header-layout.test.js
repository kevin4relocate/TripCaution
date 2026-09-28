import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const server=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');

test('article header and article content use identical shell-based left alignment',()=>{
 assert.match(server,/<div class="article-top"><div class="shell article-head">/);
 assert.match(server,/<div class="shell article-wrap">/);
 const section=css.slice(css.indexOf('/* Article first-screen polish.'));
 assert.ok(section.includes('.article-top .article-head{max-width:none;}'),
   'Old 950px max-width centers article header separately from the article body');
 assert.ok(!section.includes('.article-top .article-head{max-width:950px;}'));
});

test('article header uses compact desktop typography and reduced vertical spacing',()=>{
 const section=css.slice(css.indexOf('/* Article first-screen polish.'));
 assert.match(section,/\.article-top\{padding:24px 0 26px;\}/);
 assert.match(section,/font-size:clamp\(37px,3\.5vw,51px\)/);
 assert.match(section,/\.article-top \.backlink\{margin-bottom:10px/);
 assert.match(section,/\.article-wrap\{padding-top:25px;\}/);
});

test('small-screen article heading stays compact and body stays aligned',()=>{
 const section=css.slice(css.indexOf('/* Article first-screen polish.'));
 assert.match(section,/@media\(max-width:780px\)/);
 assert.match(section,/@media\(max-width:600px\)/);
 assert.match(section,/font-size:clamp\(31px,8\.4vw,38px\)/);
 assert.match(section,/\.article-wrap\{padding-top:17px;\}/);
});
