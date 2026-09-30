import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const articleContent=readFileSync(new URL('../src/article-content.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const safety=readFileSync(new URL('../public/safety-theme.css',import.meta.url),'utf8');

test('mobile pages avoid render-blocking Google Fonts import',()=>{
 assert.doesNotMatch(css,/^@import url\('https:\/\/fonts\.googleapis\.com/m);
 assert.match(worker,/media="\(min-width: 801px\)" href="https:\/\/fonts\.googleapis\.com/);
 assert.match(worker,/rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
});

test('article hero is discovered early and reserves 16:9 space',()=>{
 assert.match(worker,/rel="preload" as="image"[^>]+fetchpriority="high"/);
 assert.match(worker,/hero-image"><img loading="eager" fetchpriority="high" width="1600" height="900"/);
 assert.match(css,/\.hero-image img\{[^}]*aspect-ratio:16\/9;object-fit:cover/);
});

test('below-fold article and card images are low priority and explicitly sized',()=>{
 assert.match(worker,/loading="lazy" decoding="async" fetchpriority="low" width="640" height="360"/);
 assert.match(articleContent,/loading="lazy" decoding="async" fetchpriority="low" width="1600" height="900"/);
 assert.match(css,/\.article-inline-image img\{[^}]*aspect-ratio:16\/9;object-fit:cover/);
});

test('reader-facing labels and low-contrast text were hardened',()=>{
 assert.match(worker,/aria-label="Read guide: \$\{esc\(a\.title\)\}"/);
 assert.match(worker,/aria-label="Read \$\{esc\(a\.title\)\} — \$\{category\}"/);
 assert.match(css,/\.hero-image figcaption\{color:#56665b/);
 assert.match(css,/\.sources li small\{display:block;color:#58685d/);
 assert.match(safety,/\.caution-directory \.caution-topic:not\(\.caution-pending\)\[class\*="topic-"\] small\{\s*color:#405249/);
});
