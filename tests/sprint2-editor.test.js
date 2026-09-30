import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
test('optional editor-authored takeaways have instructions without extra mandatory approval',()=>{
 assert.match(html,/## Key takeaways/);
 assert.match(html,/2–5 bullet points/);
 assert.doesNotMatch(html,/STEP 2 · EDITORIAL CHECKLIST|STEP 3 · CLAIM–SOURCE REVIEW RECORD/);
 assert.match(html,/id="review-publish-btn"/);
});
test('SEO preview tracks title, slug and description but never blocks owner action',()=>{
 for(const id of ['seo-preview-title','seo-preview-url','seo-preview-desc','seo-length'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/function refreshSEOPreview\(/);
 assert.match(js,/refreshSEOPreview\(\);/);
 assert.match(js,/location\.origin\+'\/guides\/'/);
 assert.match(html,/Search engines may rewrite titles and snippets/);
 assert.match(css,/\.seo-preview-title/);
});

test('import center supports up to 100 deterministic WebP article images',()=>{
 for(const id of ['bulk-image-files','bulk-image-upload-btn','bulk-image-progress','bulk-image-result'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/slug\.webp/);
 assert.match(html,/slug-inline-01\.webp/);
 assert.match(js,/files\.length>100/);
 assert.match(js,/X-TripCaution-Filename/);
 assert.match(js,/\/api\/admin\/media\/article-image/);
 assert.match(js,/Math\.min\(3,uploadRows\.length\)/);
});

test('bulk image conflicts require an explicit owner decision',()=>{
 for(const id of ['bulk-image-conflict-actions','bulk-image-skip-btn','bulk-image-overwrite-btn','bulk-image-cancel-btn'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/Nothing is skipped or overwritten until you choose what to do/);
 assert.match(js,/article-image\/preflight/);
 assert.match(js,/Existing filename conflicts/);
 assert.match(js,/uploadBulkImagePlan\('skip'\)/);
 assert.match(js,/uploadBulkImagePlan\('overwrite'\)/);
 assert.doesNotMatch(html,/Existing images are skipped by default/);
});

test('image generation controls are removed and matching slug corrections are automatic',()=>{
 for(const id of ['import-thumbnails','thumb-status-btn','thumb-backfill-btn','thumbnail-import-status','revision-mode','generate-thumbnail-btn','single-thumbnail-status'])
  assert.ok(!html.includes('id="'+id+'"'),id+' should be absent');
 assert.doesNotMatch(js,/\/api\/admin\/thumbnails/);
 assert.doesNotMatch(js,/revision-mode|import-thumbnails/);
 assert.match(html,/Matching slugs are always treated as corrections/);
 assert.match(html,/Matching slug/);
 assert.match(html,/External illustration prompt/);
});

test('clean bulk preflight transitions into the actual uploader',()=>{
 const needle="quickBusy=false;\n  bulkImageButton.disabled=false;\n  await uploadBulkImagePlan('skip');";
 assert.ok(js.includes(needle),'preflight must release its busy guard before starting upload');
});

test('import center uses a compact two-step responsive workflow',()=>{
 for(const className of ['import-workflow-grid','import-step','import-file-row','import-note'])
  assert.ok(html.includes(className),className);
 assert.match(html,/>1<\/span>/);
 assert.match(html,/>2<\/span>/);
 assert.match(css,/\.import-workflow-grid\{display:grid/);
 assert.match(css,/#json-input\{display:block;width:100%/);
 assert.match(css,/@media\(max-width:980px\)\{\.import-workflow-grid\{grid-template-columns:1fr\}/);
});
