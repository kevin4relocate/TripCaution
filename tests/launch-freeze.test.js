import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/daily-content.yml',import.meta.url),'utf8');

test('launch freeze disables unattended Cloudflare auto publishing',()=>{
 assert.match(wrangler,/"AUTO_PUBLISH_ENABLED"\s*:\s*"false"/);
});

test('launch freeze prevents scheduled AI research from running',()=>{
 assert.match(workflow,/github\.event_name == 'workflow_dispatch'/);
 assert.match(workflow,/vars\.TRIPCAUTION_AUTOMATION_ENABLED == 'true'/);
 assert.match(workflow,/TRIPCAUTION_AUTO_PUBLISH_ENABLED:\s*'false'/);
 assert.doesNotMatch(workflow,/TRIPCAUTION_AUTO_PUBLISH_ENABLED:\s*\$\{\{[^\n]+\|\| 'true'/);
});
