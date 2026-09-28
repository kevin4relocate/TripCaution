#!/usr/bin/env node
/* Static editorial-package hygiene gate: catches metadata and formatting errors,
   NOT factual inaccuracy. Only an editor may verify claims and publish content. */
import {readFileSync} from 'node:fs';
import {CATEGORIES,slugify} from '../src/content.js';
import {renderArticleMarkdown} from '../src/article-content.js';
const path=new URL('../content/starter-guides.json',import.meta.url);
const data=JSON.parse(readFileSync(path,'utf8')),articles=data.articles;
if(!Array.isArray(articles))throw Error('No article package found');
const slugs=new Set(),problems=[],warnings=[];
for(const article of articles){
 const id=article.slug||article.title||'untitled';
 if(!article.title||article.title.length>160)problems.push(id+': invalid title length');
 if(!id||id!==slugify(id)||slugs.has(id))problems.push(id+': duplicate or unsafe slug');
 slugs.add(id);
 if(!CATEGORIES.includes(article.category))problems.push(id+': unknown category');
 if(String(article.content_markdown||'').length<100)problems.push(id+': missing detailed body');
 const headers=renderArticleMarkdown(article.content_markdown).headings;
 if(headers.length<2)warnings.push(id+': article has fewer than two navigable headings');
 const desc=article.seo?.description||article.seo_description||'';
 if(desc.length<50||desc.length>300)warnings.push(id+': meta description may be missing or unusually long');
 const sources=article.research?.sources||article.sources||[];
 if(!Array.isArray(sources)||sources.length<2)warnings.push(id+': fewer than two cited sources — review evidence diversity');
 const urls=new Set();
 for(const source of sources){
  try{
   const u=new URL(source.url);
   if(u.protocol!=='https:')problems.push(id+': insecure evidence URL');
   if(urls.has(u.href))warnings.push(id+': duplicate source URL '+u.hostname);
   urls.add(u.href);
  }catch{problems.push(id+': invalid evidence URL');}
 }
 const hero=article.images?.hero_image_url||article.hero_image_url||'';
 if(hero&&/\.svg(?:$|\?)/.test(hero))warnings.push(id+': SVG illustration is not a reliable social-preview image; create a separate raster social card');
 if(article.research?.verified_at)warnings.push(id+': research.verified_at is NOT a documented human editorial review');
}
const verdict={package:'starter-guides.json',count:articles.length,valid:problems.length===0,problems,warnings,owner_action:'Review every factual claim and source manually; this script is not a fact checker.'};
console.log(JSON.stringify(verdict,null,2));
if(problems.length)process.exitCode=1;
