/**
 * TripCaution generated thumbnail queue.
 *
 * Cloudflare Cron processes at most two jobs every 15 minutes. Image generation
 * is NEVER performed inline with a JSON import or a public page request.
 * This intentionally preserves owner-selected published / scheduled / review
 * statuses, even if the image service is slow or unavailable.
 */
const STYLE='TripCaution editorial travel safety illustration, carefully hand-painted watercolor and soft gouache on tactile paper, place-specific recognizable everyday travel context, midnight navy and muted amber accents, dignified informative field-guide artwork, calm factual scene, no recognizable real person, no company logos, no readable text, no fake incident photograph. Wide landscape composition 3:2, important subject centred for 16:9 website crop.';
const CATEGORY={
 transport:'Airport pickup, railway, ferry terminal or real local transport context.',
 'scams-theft':'An ordinary travel setting communicating prudent awareness without depicting an accusation or criminal event.',
 'payments-money':'Practical payments context with cash, cards, counter or ATM as relevant.',
 'local-laws':'Accurate visual environment for the described local rule, without falsely depicting enforcement.',
 'safety-health':'Calm travel preparation and environmental context, never disaster sensationalism.',
 'travel-essentials':'Useful everyday travel equipment in the named destination.',
 'before-you-go':'Travel preparation scene with map and transport objects.',
 etiquette:'Specific everyday cultural context in the relevant country.'
};
const API='https://generativelanguage.googleapis.com/v1beta/interactions';
const MAX_BYTES=5_000_000;
export function imagePrompt(article){
 const details=String(article?.hero_prompt||'').trim().slice(0,3000);
 const title=String(article?.title||'').slice(0,160);
 const country=String(article?.country||'').slice(0,90);
 return [STYLE,'Destination: '+country+'.','Article topic: '+title+'.',CATEGORY[article?.category_id]||'Relevant travel-preparation environment.',details].join(' ');
}
export function thumbnailEnabled(env){
 return env.THUMBNAIL_AUTOGEN_ENABLED==='true'&&Boolean(env.MEDIA)&&Boolean(env.GEMINI_API_KEY)&&Boolean(env.DB);
}
export function needsThumbnail(article){
 return !article?.hero_image_url&&String(article?.hero_prompt||'').trim().length>=20;
}
export async function enqueueThumbnail(env,id,{force=false}={}){
 if(!env.DB)return {state:'unavailable',reason:'D1 not configured'};
 const article=await env.DB.prepare('SELECT id,title,country,category_id,hero_prompt,hero_image_url FROM articles WHERE id=?')
  .bind(id).first();
 if(!article)return {state:'not_found'};
 if(!needsThumbnail(article))return {state:'not_needed'};
 if(!String(article.hero_prompt||'').trim())return {state:'missing_prompt'};
 if(!thumbnailEnabled(env))return {state:'disabled',reason:'Configure R2 MEDIA, OPENAI_API_KEY and THUMBNAIL_AUTOGEN_ENABLED=true'};
 const jobId=crypto.randomUUID();
 // A job is reused instead of re-billing repeated imports or duplicate clicks.
 const query=force?
  "INSERT INTO thumbnail_jobs(article_id,id,state,attempts,created_at,updated_at) VALUES(?,?,'queued',0,datetime('now'),datetime('now')) ON CONFLICT(article_id) DO UPDATE SET state='queued',attempts=0,last_error=NULL,lease_until=NULL,next_attempt_at=NULL,updated_at=datetime('now')":
  "INSERT OR IGNORE INTO thumbnail_jobs(article_id,id,state,attempts,created_at,updated_at) VALUES(?,?,'queued',0,datetime('now'),datetime('now'))";
 await env.DB.prepare(query).bind(id,jobId).run();
 return {state:'queued'};
}
export async function queueThumbnailOnImport(env,id){
 try{return await enqueueThumbnail(env,id);}
 catch(e){return {state:'unavailable',reason:'Image queue not ready; apply D1 migration and check R2 binding'};}
}
function decodeBase64Jpeg(input){
 if(typeof input!=='string'||input.length>9_000_000)throw Object.assign(new Error('Image response invalid or too large'),{retryable:false});
 const binary=atob(input);
 if(binary.length>MAX_BYTES)throw Object.assign(new Error('Generated image exceeds 5 MB'),{retryable:false});
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)
  throw Object.assign(new Error('Generated response was not JPEG'),{retryable:false});
 return bytes;
}
function imageBlock(payload){
 if(payload?.output_image?.data)return payload.output_image;
 for(const step of payload?.steps||[]){
  if(step?.type!=='model_output')continue;
  const found=(step.content||[]).find(part=>part?.type==='image'&&typeof part?.data==='string');
  if(found)return found;
 }
 return null;
}
export async function renderThumbnail(env,article,{request=fetch}={}){
 const model=env.THUMBNAIL_MODEL||'gemini-3.1-flash-image';
 const response=await request(API,{
  method:'POST',
  headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({
   model,
   input:imagePrompt(article),
   response_format:{type:'image',mime_type:'image/jpeg',aspect_ratio:'16:9',image_size:'1K'}
  }),
  signal:AbortSignal.timeout(160000)
 });
 if(!response.ok){
  // Never log the provider response body or secret. Retry only quota/server failures.
  throw Object.assign(new Error('Image provider HTTP '+response.status),{retryable:response.status===429||response.status>=500});
 }
 const payload=await response.json();
 const generated=imageBlock(payload);
 if(!generated?.data)throw Object.assign(new Error('Image provider returned no image'),{retryable:false});
 if(generated.mime_type&&generated.mime_type!=='image/jpeg')
  throw Object.assign(new Error('Image provider returned unexpected media type'),{retryable:false});
 const bytes=decodeBase64Jpeg(generated.data);
 const key='editorial/'+crypto.randomUUID()+'.jpg';
 await env.MEDIA.put(key,bytes.buffer,{httpMetadata:{contentType:'image/jpeg',cacheControl:'public,max-age=31536000,immutable'}});
 const base=String(env.SITE_URL||'').replace(/\/$/,'');
 return base+'/media/'+key;
}
export async function processThumbnailQueue(env,{render=renderThumbnail,limit=2}={}){
 if(!thumbnailEnabled(env))return {state:'disabled',processed:0};
 const rows=(await env.DB.prepare(
  "SELECT j.article_id,j.attempts,a.title,a.country,a.category_id,a.hero_prompt,a.hero_image_url FROM thumbnail_jobs j JOIN articles a ON a.id=j.article_id WHERE (j.state='queued' OR (j.state='retry' AND julianday(j.next_attempt_at)<=julianday('now')) OR (j.state='processing' AND julianday(j.lease_until)<=julianday('now'))) AND (a.hero_image_url IS NULL OR a.hero_image_url='') ORDER BY j.created_at LIMIT ?"
 ).bind(Math.max(1,Math.min(3,limit))).all()).results||[];
 let processed=0;
 for(const article of rows){
  const claim=await env.DB.prepare(
   "UPDATE thumbnail_jobs SET state='processing',attempts=attempts+1,lease_until=datetime('now','+12 minutes'),updated_at=datetime('now') WHERE article_id=? AND (state='queued' OR (state='retry' AND julianday(next_attempt_at)<=julianday('now')) OR (state='processing' AND julianday(lease_until)<=julianday('now')))"
  ).bind(article.article_id).run();
  if(Number(claim.meta?.changes||0)!==1)continue;
  processed++;
  try{
   const url=await render(env,{...article,id:article.article_id});
   // Honour a manually uploaded replacement added while the API was running:
   // only insert our URL when the article still has no image.
   await env.DB.batch([
    env.DB.prepare("UPDATE articles SET hero_image_url=?,updated_at=datetime('now') WHERE id=? AND (hero_image_url IS NULL OR hero_image_url='')").bind(url,article.article_id),
    env.DB.prepare("UPDATE thumbnail_jobs SET state='ready',lease_until=NULL,last_error=NULL,updated_at=datetime('now') WHERE article_id=?").bind(article.article_id),
    env.DB.prepare("INSERT INTO audit_logs(id,actor,action,article_id,details) VALUES(?,'image-automation','thumbnail-generated',?,?)")
     .bind(crypto.randomUUID(),article.article_id,JSON.stringify({format:'webp',model:env.THUMBNAIL_MODEL||'gemini-3.1-flash-image'}))
   ]);
  }catch(e){
   const attempts=Number(article.attempts||0)+1;
   const retryable=e?.retryable!==false&&attempts<3;
   const backoffHours=Math.min(8,Math.pow(2,attempts));
   await env.DB.prepare(
    "UPDATE thumbnail_jobs SET state=?,last_error=?,lease_until=NULL,next_attempt_at=CASE WHEN ?='retry' THEN datetime('now',?) ELSE NULL END,updated_at=datetime('now') WHERE article_id=?"
   ).bind(retryable?'retry':'failed',String(e?.message||'Generation failed').slice(0,160),
    retryable?'retry':'failed','+'+backoffHours+' hours',article.article_id).run();
  }
 }
 return {state:'ok',processed};
}
export async function thumbnailSummary(env){
 if(!env.DB)return {enabled:false,counts:{}};
 const rows=(await env.DB.prepare('SELECT state,COUNT(*) total FROM thumbnail_jobs GROUP BY state').all()).results||[];
 return {enabled:thumbnailEnabled(env),counts:Object.fromEntries(rows.map(x=>[x.state,Number(x.total)]))};
}
