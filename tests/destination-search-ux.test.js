import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';

const env={SITE_URL:'https://example.test',ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};

test('search labels unpublished destinations as planned rather than linking to empty pages',async()=>{
  const response=await app.fetch(new Request('https://example.test/search?q=Vietnam'),env);
  assert.equal(response.status,200);
  const page=await response.text();
  assert.match(page,/Vietnam/);
  assert.match(page,/Research planned/);
  assert.doesNotMatch(page,/href="\/destinations\/vietnam"/);
});

test('Bangkok search avoids an empty city page until its guide is published',async()=>{
 const response=await app.fetch(new Request('https://example.test/search?q=Bangkok'),env);
 assert.equal(response.status,200);
 assert.match(await response.text(),/No published guides match/);
});

test('partial query suggests countries instead of misleading zero results',async()=>{
 const response=await app.fetch(new Request('https://example.test/search?q=cam'),env);
 const text=await response.text();
 assert.equal(response.status,200);
 assert.match(text,/Matching destinations/);
 assert.match(text,/Cambodia/);
 assert.doesNotMatch(text,/0 results/);
});

test('empty destination is not indexed while guides are pending',async()=>{
 const response=await app.fetch(new Request('https://example.test/destinations/vietnam'),env);
 assert.equal(response.status,200);
 assert.match(await response.text(),/<meta name="robots" content="noindex,follow">/);
});

test('top navigation avoids redundant Explore link',async()=>{
 const response=await app.fetch(new Request('https://example.test/'),env);
 const page=await response.text();
 assert.match(page,/Main navigation"><a href="\/destinations">Destinations/);
 assert.doesNotMatch(page,/<nav aria-label="Main navigation"><a href="\/">Explore/);
});
