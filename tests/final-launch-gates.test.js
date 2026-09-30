import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const full=readFileSync(new URL('../.github/workflows/full-launch-audit.yml',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');
const audit=readFileSync(new URL('../scripts/full-launch-audit.mjs',import.meta.url),'utf8');

test('public launch gates rerun after production-facing code changes',()=>{
 for(const workflow of [full,smoke]){
  assert.match(workflow,/'src\/\*\*'/);
  assert.match(workflow,/'public\/\*\*'/);
  assert.match(workflow,/'wrangler\.jsonc'/);
 }
});

test('full launch audit keeps exact public source URLs in evidence',()=>{
 assert.match(audit,/sourceCount:0,sources:\[\]/);
 assert.match(audit,/row\.sources=sources/);
 assert.match(audit,/row\.sourceCount=sources\.length/);
});
