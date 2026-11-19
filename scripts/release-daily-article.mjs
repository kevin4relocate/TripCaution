#!/usr/bin/env node
// GitHub Actions release: exactly one due, previously unpublished guide per day.
// No R2 upload and no D1 writes. Cloudflare builds the committed static asset.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const batches=['001','002','003','004'];
const repo=process.cwd();
const read=path=>JSON.parse(readFileSync(join(repo,path),'utf8'));
const logPath=join(repo,'content/github-release-log.json');
const modulePath=join(repo,'src/github-release-index.js');
const releasesDir=join(repo,'public/releases/articles');
const publicOrigin=(process.env.TRIPCAUTION_PUBLIC_URL||'https://tripcaution.nghiep4tube.workers.dev').replace(/\/$/,'');
const pattern=/^\/media\/editorial\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;
const dayVN=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
function allDrafts(){
 return batches.flatMap(b=>read('content/batch-'+b+'/articles.json').articles)
  .sort((a,b)=>Date.parse(a.planned_publish_at)-Date.parse(b.planned_publish_at));
}
export function nextDailyRelease(drafts,released,now=new Date()){
 const used=new Set(released.map(x=>x.slug));
 if(new Set(drafts.map(x=>x.slug)).size!==drafts.length)throw Error('Duplicate draft slug');
 if(new Set(drafts.map(x=>x.planned_publish_at)).size!==drafts.length)throw Error('Duplicate planned dates');
 if(drafts.some(x=>!Number.isFinite(Date.parse(x.planned_publish_at))))throw Error('Invalid scheduled date');
 if(released.some(x=>dayVN(x.released_at||x.published_at)===dayVN(now)))return null;
 const next=drafts.find(x=>!used.has(x.slug));
 if(!next||Date.parse(next.planned_publish_at)>+new Date(now))return null;
 return next;
}
function validate(draft,log){
 if(!draft.sources?.length||!draft.content_markdown?.includes('## Key takeaways'))throw Error('Missing content or source links');
 const inline='/media/editorial/'+draft.slug+'-inline-01.webp';
 const hero='/media/editorial/'+draft.slug+'.webp';
 if(draft.hero_image_url!==hero||!draft.content_markdown.includes(']('+inline+')'))throw Error('Image path mismatch: '+draft.slug);
 if(!pattern.test(hero)||!pattern.test(inline))throw Error('Unsafe image path');
 if(log.releases.some(x=>x.slug===draft.slug))throw Error('Already published: '+draft.slug);
 const paths=[hero,inline];
 return paths;
}
async function assertNotAlreadyLive(slug){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const url=publicOrigin+'/guides/'+encodeURIComponent(slug);
  const response=await fetch(url,{signal:controller.signal});
  await response.body?.cancel();
  if(response.status===200)throw Error('A public guide already uses this slug: '+slug);
  if(response.status!==404)throw Error('Cannot confirm this slug is absent from the live site: HTTP '+response.status);
 }finally{clearTimeout(timer);}
}
async function verifyR2(paths){
 for(const path of paths){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try {
   const response=await fetch(publicOrigin+path,{signal:controller.signal,headers:{'accept':'image/webp'}});
   if(response.status!==200||!/^image\/webp/i.test(response.headers.get('content-type')||''))
    throw Error('R2 media missing or invalid: '+path+' (HTTP '+response.status+')');
   const bytes=new Uint8Array(await response.arrayBuffer());
   const word=(i,n)=>String.fromCharCode(...bytes.slice(i,i+n));
   if(bytes.length<12||word(0,4)!=='RIFF'||word(8,4)!=='WEBP')throw Error('Invalid WebP media: '+path);
  }finally {clearTimeout(timer);}
 }
}
function publishedRecord(draft,now){
 const when=new Date(now).toISOString();
 return {...draft,id:'github-'+draft.slug,
  category_id:draft.category,category_name:draft.category.replaceAll('-',' '),
  status:'published',source_mode:'github-scheduled',review_approved:0,
  caution_level:'unassessed',severity_scope:'',severity_rationale:'',
  published_at:when,updated_at:when,verified_at:null,
  tags_json:JSON.stringify(draft.tags||[]),sources_json:JSON.stringify(draft.sources||[])};
}
function indexRecord(a){
 const keep=['slug','title','country','city','category_id','category_name','excerpt','seo_title','seo_description','hero_image_url','hero_alt',
  'published_at','updated_at','status','source_mode','review_approved','caution_level'];
 return Object.fromEntries(keep.map(k=>[k,a[k]??null]));
}
export async function releaseOne({dryRun=false,now=new Date()}={}){
 const drafts=allDrafts(),log=read('content/github-release-log.json');
 if(drafts.length!==400)throw Error('Expected exactly 400 drafts');
 if(!Array.isArray(log.releases))throw Error('Invalid release log');
 if(new Set(log.releases.map(x=>x.slug)).size!==log.releases.length)throw Error('Release log has duplicate slugs');
 if(log.releases.some(x=>!drafts.some(a=>a.slug===x.slug)))throw Error('Release log contains unknown slug');
 const next=nextDailyRelease(drafts,log.releases,now);
 if(!next){console.log('NO_RELEASE_DUE '+new Date(now).toISOString());return null;}
 const media=validate(next,log);
 console.log('NEXT_RELEASE '+JSON.stringify({slug:next.slug,date:next.planned_publish_at,images:media}));
 if(dryRun)return {slug:next.slug,media,dryRun:true};
 await verifyR2(media);
 await assertNotAlreadyLive(next.slug);
 const article=publishedRecord(next,now);
 const index=indexRecord(article);
 const target=join(releasesDir,article.slug+'.json');
 if(existsSync(target))throw Error('Released asset already exists: '+target);
 log.releases.push({...index,released_at:new Date(now).toISOString()});
 mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,JSON.stringify(article)+'\n');
 writeFileSync(logPath,JSON.stringify(log,null,2)+'\n');
 writeFileSync(modulePath,
  '// Generated by scripts/release-daily-article.mjs; only committed releases are public.\nexport const releasedArticles='+JSON.stringify(log.releases.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='released_at'))))+';\n');
 console.log('RELEASED '+article.slug+' '+article.published_at);
 return {slug:article.slug,media};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=new Set(process.argv.slice(2));
 const nowArg=process.env.TRIPCAUTION_RELEASE_NOW;
 if(nowArg&&!args.has('--dry-run'))throw Error('Date override allowed only in dry-run mode');
 await releaseOne({dryRun:args.has('--dry-run'),now:nowArg?new Date(nowArg):new Date()});
}
