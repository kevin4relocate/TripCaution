import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import app from '../src/index.js';

test('homepage uses compact editorial journal instead of corporate step banner',async()=>{
  const response=await app.fetch(new Request('https://example.test/'),{
    SITE_URL:'https://example.test',
    ASSETS:{fetch:async()=>new Response('Not found',{status:404})}
  });
  assert.equal(response.status,200);
  const page=await response.text();
  assert.match(page,/THE INDEPENDENT TRAVEL FIELD GUIDE/);
  assert.match(page,/public\/illustrations\/travel-journal\.svg|\/illustrations\/travel-journal\.svg/);
  assert.match(page,/continent-directory/);
  assert.doesNotMatch(page,/class="value-bar"/);
  assert.doesNotMatch(page,/class="shell prefooter"/);
});

test('homepage country index is grouped and alphabetical without massive numbered tiles',async()=>{
  const response=await app.fetch(new Request('https://example.test/'),{
    SITE_URL:'https://example.test',
    ASSETS:{fetch:async()=>new Response('Not found',{status:404})}
  });
  const page=await response.text();
  const index=page.slice(page.indexOf('<div class="continent-directory">'));
  const asia=index.indexOf('id="continent-asia"');
  const europe=index.indexOf('id="continent-europe"');
  const usa=index.indexOf('id="continent-north-america"');
  assert.ok(asia!==-1&&europe>asia&&usa>europe);
  const section=index.slice(asia,europe);
  const names=['Cambodia','Indonesia','Japan','Laos','Malaysia','Singapore','Thailand','Vietnam'];
  const positions=names.map(x=>section.indexOf('class="destination-name">'+x+'</span>'));
  assert.ok(positions.every(x=>x>=0));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
  assert.doesNotMatch(index,/class="destination-number"/);
});

test('responsive design includes compact layouts and reduced vertical spacing',()=>{
  const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/\.hero-inner\s*\{[^}]*min-height:393px/s);
  assert.match(css,/\.destination-tile\s*\{[^}]*min-height:50px/s);
  assert.match(css,/@media\(max-width:600px\)/);
});
