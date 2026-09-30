import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {imagePrompt,needsThumbnail,enqueueThumbnail,renderThumbnail,processThumbnailQueue,thumbnailEnabled} from '../src/thumbnails.js';

const key='k'.repeat(48);
const article={id:'11111111-1111-4111-8111-111111111111',title:'Airport taxi pickup checks',country:'Vietnam',category_id:'transport',
 hero_prompt:'An orderly terminal pickup lane, warm morning sunlight, small suitcase.',hero_image_url:null};
const pixel=new Uint8Array(24);
pixel.set([255,216,255],0);
const base64=Buffer.from(pixel).toString('base64');
test('custom source-grounded article prompt receives consistent caution identity',()=>{
 const prompt=imagePrompt(article);
 assert.match(prompt,/Vietnam/);assert.match(prompt,/terminal pickup lane/);
 assert.match(prompt,/watercolor/);assert.match(prompt,/navy/);
 assert.equal(needsThumbnail(article),true);
 assert.equal(needsThumbnail({...article,hero_image_url:'https://tripcaution.test/existing.webp'}),false);
});
test('image is fetched from Gemini and stored as JPEG using non-guessable R2 URL',async()=>{
 const puts=[],requests=[];
 const env={SITE_URL:'https://tripcaution.test',GEMINI_API_KEY:key,MEDIA:{async put(...args){puts.push(args);}}};
 const fake=async(url,options)=>{requests.push({url,options});return {ok:true,async json(){return {steps:[{type:'model_output',content:[{type:'image',data:base64,mime_type:'image/jpeg'}]}]};}};};
 const url=await renderThumbnail(env,article,{request:fake});
 assert.match(url,/^https:\/\/tripcaution\.test\/media\/editorial\/[a-f0-9-]+\.jpg$/);
 assert.equal(puts.length,1);assert.equal(puts[0][2].httpMetadata.contentType,'image/jpeg');
 const req=JSON.parse(requests[0].options.body);
 assert.equal(req.model,'gemini-3.1-flash-image');
 assert.deepEqual(req.response_format,{type:'image',mime_type:'image/jpeg',aspect_ratio:'16:9',image_size:'1K'});
 assert.match(req.input,/Airport taxi pickup checks/);
 assert.match(requests[0].url,/generativelanguage\.googleapis\.com\/v1beta\/interactions$/);
 assert.equal(requests[0].options.headers['x-goog-api-key'],key);
 assert.ok(!requests[0].options.body.includes(key));
});
test('existing thumbnails are never enqueued even on manual retry',async()=>{
 const env={DB:{prepare(){return {bind(){return this;},async first(){return {...article,hero_image_url:'https://tripcaution.test/existing.webp'};}}}}};
 assert.equal((await enqueueThumbnail(env,article.id,{force:true})).state,'not_needed');
});
test('unconfigured image pipeline exits without incurring API cost',async()=>{
 assert.equal(thumbnailEnabled({THUMBNAIL_AUTOGEN_ENABLED:'true',GEMINI_API_KEY:key}),false);
 assert.deepEqual(await processThumbnailQueue({THUMBNAIL_AUTOGEN_ENABLED:'false'}),{state:'disabled',processed:0});
});
test('queued image remains queued once and claim updates article URL',async()=>{
 const queries=[],env={THUMBNAIL_AUTOGEN_ENABLED:'true',GEMINI_API_KEY:key,MEDIA:{},DB:{
  prepare(sql){let args=[];const q={bind(...x){args=x;return q;},async all(){return {results:[{...article,article_id:article.id,attempts:0}]};},
   async run(){queries.push({sql,args});return {meta:{changes:1}};}};return q;},
  async batch(actions){for(const q of actions)await q.run();}
 }};
 const r=await processThumbnailQueue(env,{render:async()=> 'https://tripcaution.test/media/editorial/generated.webp',limit:1});
 assert.equal(r.processed,1);
 assert.ok(queries.some(q=>q.sql.includes('UPDATE articles SET hero_image_url')));
 assert.ok(queries.some(q=>q.sql.includes("state='ready'")));
});
test('provider failure retries without exposing API credentials',async()=>{
 const queries=[],env={THUMBNAIL_AUTOGEN_ENABLED:'true',GEMINI_API_KEY:key,MEDIA:{},
  DB:{prepare(sql){let args=[];const q={bind(...x){args=x;return q;},async all(){return {results:[{...article,article_id:article.id,attempts:0}]};},
    async run(){queries.push({sql,args});return {meta:{changes:1}};}};return q;}}};
 const r=await processThumbnailQueue(env,{render:async()=>{throw Error('Temporary provider outage');}});
 assert.equal(r.processed,1);
 const retry=queries.find(q=>q.sql.includes('next_attempt_at=CASE'));
 assert.equal(retry.args[0],'retry');
 assert.ok(!JSON.stringify(queries).includes(key));
});


test('in-app thumbnail generation is disabled while external image workflow remains',()=>{
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
 assert.ok(worker.includes("In-app AI image generation is disabled"));
 assert.ok(worker.includes("pathname.startsWith('/api/admin/thumbnails')"));
 assert.ok(!html.includes('id="generate-thumbnail-btn"'));
 assert.ok(!html.includes('id="import-thumbnails"'));
 assert.ok(!html.includes('Check thumbnail queue'));
 assert.ok(!admin.includes('/api/admin/thumbnails'));
 assert.ok(html.includes('External illustration prompt'));
 assert.ok(html.includes('Upload article images'));
});
