import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';

const theme=readFileSync(new URL('../public/safety-theme.css',import.meta.url),'utf8');
const admin=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');

test('safety theme has navy, amber and reserved critical red',()=>{
 assert.match(theme,/--tc-navy:#101d2e/);
 assert.match(theme,/--tc-amber:#ffb020/);
 assert.match(theme,/--tc-red:#d93636/);
 assert.match(theme,/\.impact-pill\.impact-critical\{/);
 assert.match(theme,/\.impact-panel\.impact-critical\{/);
 assert.doesNotMatch(theme,/\.impact-pill\.impact-low\{[^}]*#d93636/);
});

test('responsive design and keyboard focus remain available',()=>{
 assert.match(theme,/@media\(max-width:780px\)/);
 assert.match(theme,/@media\(max-width:600px\)/);
 assert.match(theme,/focus-visible/);
 assert.match(theme,/prefers-reduced-motion:reduce/);
});

test('dashboard loads safety theme after admin styles without changing editorial workflow',()=>{
 const legacy=admin.indexOf('href="/admin.css"');
 const brand=admin.indexOf('href="/safety-theme.css"');
 assert.ok(legacy>=0&&brand>legacy);
 assert.match(admin,/id="review-publish-btn"/);
});

test('public homepage has honest research framing and a usable destination search',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),{
  SITE_URL:'https://example.test',
  ASSETS:{fetch:async()=>new Response('Not found',{status:404})}
 });
 assert.equal(response.status,200);
 const page=await response.text();
 assert.match(page,/source-linked cautions/);
 assert.match(page,/Find cautions/);
 assert.match(page,/name="q"/);
 assert.match(page,/Latest <em>travel cautions/);
 assert.doesNotMatch(page,/real.time alerts|live emergency alerts/i);
});
