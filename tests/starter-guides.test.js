import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import app from '../src/index.js';
import { CATEGORIES } from '../src/content.js';

const file = new URL('../content/starter-guides.json',import.meta.url);
const pack = JSON.parse(readFileSync(file,'utf8'));

test('three different destination guides ready for manual review',()=>{
  assert.equal(pack.schema_version,'1.0');
  assert.equal(pack.site,'TripCaution');
  assert.equal(pack.articles.length,3);
  assert.deepEqual(pack.articles.map(a=>a.country),['Vietnam','Thailand','Singapore']);
  assert.equal(new Set(pack.articles.map(a=>a.slug)).size,3);
  for(const a of pack.articles){
    assert.ok(CATEGORIES.includes(a.category));
    assert.equal(a.publishing.mode,'manual_import');
    assert.equal(a.publishing.requested_status,'schedule_after_approval');
    assert.ok(a.content_markdown.split(/\s+/).length>=650,a.slug+': insufficient editorial detail');
    assert.ok(a.research.sources.length>=2,a.slug+': missing source diversity');
    assert.ok(a.research.verified_at);
    assert.ok(a.seo.title&&a.seo.description);
    assert.ok(a.images.hero_prompt.length>150);
    assert.ok(!/\bI\s+(stayed|visited|witnessed|ate at)\b/i.test(a.content_markdown));
    for(const s of a.research.sources){
      const url=new URL(s.url);assert.equal(url.protocol,'https:');
      assert.ok(s.title&&s.publisher);
    }
    const img = new URL(a.images.hero_image_url);
    assert.equal(img.hostname,'tripcaution.nghiep4tube.workers.dev');
    const relative=decodeURI(img.pathname).replace(/^\//,'');
    assert.ok(existsSync(new URL('../public/'+relative,import.meta.url)),relative+' image is missing');
  }
});

test('manual-import article cannot bypass review by using bot ingestion',async()=>{
  const apiSecret='s'.repeat(48);
  const rows=[];
  const env={
    INGEST_TOKEN:apiSecret,
    DB:{
      prepare(sql){
        return {
          bind(...values){
            return {
              async first(){return null;},
              async run(){if(sql.startsWith('INSERT INTO articles'))rows.push(values);return {success:true};}
            };
          }
        };
      }
    }
  };
  const singapore=pack.articles.find(a=>a.country==='Singapore');
  const response=await app.fetch(new Request('https://example.test/api/ingest',{
    method:'POST',
    headers:{'Authorization':'Bearer '+apiSecret,'Content-Type':'application/json'},
    body:JSON.stringify({articles:[singapore]})
  }),env);
  assert.equal(response.status,207);
  const result=await response.json();
  assert.equal(result.results[0].ok,true);
  assert.equal(result.results[0].status,'review');
  assert.equal(rows.length,1);
});
