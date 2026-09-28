import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');

test('bulk actions show three everyday controls and group secondary/destructive options',()=>{
 const from=html.indexOf('<div class="bulk-toolbar"');
 const to=html.indexOf('<p class="bulk-notice">',from);
 const bar=html.slice(from,to);
 assert.ok(from>0&&to>from);
 const main=bar.slice(bar.indexOf('<div class="bulk-main-actions">'),bar.indexOf('<details id="bulk-more"'));
 for(const id of ['bulk-publish','bulk-hide','bulk-schedule'])assert.ok(main.includes('id="'+id+'"'));
 for(const id of ['bulk-restore','bulk-delete','bulk-purge','empty-trash']){
  assert.ok(bar.includes('id="'+id+'"'));
  assert.ok(!main.includes('id="'+id+'"'));
 }
 assert.ok(bar.includes('<details id="bulk-more"'));
 assert.ok(bar.includes('<summary>More'));
});

test('All articles has one draft preview entry point, inside Review/Edit',()=>{
 assert.match(html,/id="editor-preview-link"/);
 const from=js.indexOf('function renderArticles(){');
 const to=js.indexOf('function renderQueue(){',from);
 const list=js.slice(from,to);
 assert.ok(from>0&&to>from);
 assert.ok(list.includes('Review/Edit → Preview saved article'));
 assert.ok(!list.includes("'Preview ↗'"));
 assert.ok(list.includes('Review'));
 assert.ok(list.includes('Edit'));
 assert.ok(list.includes('View live ↗'));
 assert.ok(list.includes('class="row-quick"'));
 assert.ok(!list.includes('trackPreview'));
});

test('bulk toolbar has non-wrapping desktop controls, accessible More and mobile grouped layout',()=>{
 const from=css.indexOf('/* Compact content-library actions: no multi-row button pile.');
 assert.ok(from>0);
 const styles=css.slice(from);
 assert.match(styles,/#articles \.bulk-toolbar\{[\s\S]*?flex-wrap:nowrap/);
 assert.match(styles,/#articles \.bulk-more>summary:focus-visible/);
 assert.match(styles,/#articles \.bulk-more-menu button\[hidden\]\{display:none!important/);
 assert.match(styles,/@media\(max-width:720px\)/);
 assert.match(styles,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(styles,/#article-rows \.row-actions\{[\s\S]*?flex-wrap:nowrap/);
});
