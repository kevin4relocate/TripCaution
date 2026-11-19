// GitHub-scheduled published guides supplement the existing published D1 inventory.
// Never make unreleased drafts available through the public Worker routes.
import {releasedArticles} from './github-release-index.js';
import {CATEGORIES} from './content.js';
const validSlug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function githubGuides(){
 return releasedArticles.filter(a=>a?.status==='published'&&validSlug.test(a.slug));
}
export function githubGuide(slug){
 return githubGuides().find(a=>a.slug===slug)||null;
}
export function mergeGuides(d1Rows=[],githubRows=githubGuides(),max=Infinity){
 const merged=new Map();
 for(const a of d1Rows||[])if(a?.slug)merged.set(a.slug,a);
 for(const a of githubRows)if(a?.slug&&!merged.has(a.slug))merged.set(a.slug,a);
 return [...merged.values()].sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0)).slice(0,max);
}
export function githubByCountry(country){return githubGuides().filter(a=>a.country?.toLowerCase()===String(country||'').toLowerCase());}
export function githubTopicCounts(){
 const counts=new Map();
 for(const a of githubGuides())counts.set(a.category_id,(counts.get(a.category_id)||0)+1);
 return counts;
}
export async function githubArticle(env,slug){
 const meta=githubGuide(slug);
 if(!meta)return null;
 if(!env?.ASSETS)throw Error('Github article assets are not configured');
 const origin=env.SITE_URL||'https://tripcaution.nghiep4tube.workers.dev';
 const request=new Request(new URL('/releases/articles/'+encodeURIComponent(slug)+'.json',origin));
 const response=await env.ASSETS.fetch(request);
 if(!response.ok)throw Error('Published Github article asset missing: '+slug);
 const item=await response.json();
 if(item.slug!==slug||item.status!=='published'||!CATEGORIES.includes(item.category_id))
  throw Error('Published Github article metadata does not match index: '+slug);
 if(item.hero_image_url!==meta.hero_image_url||item.published_at!==meta.published_at)
  throw Error('Github article content/index mismatch: '+slug);
 return item;
}
