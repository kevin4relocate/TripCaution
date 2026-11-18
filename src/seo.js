// Shared SEO serialization. Schema is descriptive metadata for publicly
// published, human-approved content only; private previews never render it.
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&apos;'}[c]));
export const isoDate=value=>{
 if(!value)return null;
 const raw=String(value).trim();
 const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)?
  raw.replace(' ','T')+'Z':raw;
 const stamp=Date.parse(normalized);
 return Number.isFinite(stamp)?new Date(stamp).toISOString():null;
};
export const rasterImage=(value,origin='')=>{
 const raw=String(value||'').trim();
 if (/^\/media\/editorial\/[a-z0-9][a-z0-9-]{0,140}\.(?:webp|png|jpe?g)$/i.test(raw) && origin)
  return String(origin).replace(/\/$/,'')+raw;
 try{
  const link=new URL(raw);
  return link.protocol==='https:'&&/\.(png|jpe?g|webp|gif)$/i.test(link.pathname)?link.href:null;
 }catch{return null;}
};
export function articleStructuredData(site,a){
 const origin=String(site).replace(/\/$/,'');
 const url=origin+'/guides/'+encodeURIComponent(a.slug),country=origin+'/destinations/'+
  String(a.country||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const doc={
  '@type':'Article','@id':url+'#article',headline:a.title,
  description:a.seo_description||a.excerpt||'',
  inLanguage:'en',isAccessibleForFree:true,
  mainEntityOfPage:{'@type':'WebPage','@id':url},
  author:{'@type':'Organization',name:'TripCaution',url:origin},
  publisher:{'@type':'Organization',name:'TripCaution',url:origin}
 };
 const published=isoDate(a.published_at),modified=isoDate(a.updated_at)||published;
 if(published)doc.datePublished=published;
 if(modified)doc.dateModified=modified;
 const image=rasterImage(a.hero_image_url,origin);
 if(image)doc.image=[image];
 const refs=Array.isArray(a.sources)?a.sources:[];
 const citations=refs.map(s=>{try{const u=new URL(s?.url);return u.protocol==='https:'?u.href:null;}catch{return null;}}).filter(Boolean);
 if(citations.length)doc.citation=[...new Set(citations)].slice(0,25);
 return {'@context':'https://schema.org','@graph':[
  doc,
  {'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:[
   {'@type':'ListItem',position:1,name:'Home',item:origin+'/'},
   {'@type':'ListItem',position:2,name:a.country,item:country},
   {'@type':'ListItem',position:3,name:a.title,item:url}
  ]}
 ]};
}
export function jsonLdTag(value){
 // JSON-LD is a non-executing data block. Escape < and HTML-sensitive chars so
 // editor-supplied titles cannot break out of the script tag.
 const data=JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
  .replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return '<script type="application/ld+json">'+data+'</script>';
}
export function sitemapXML(origin,guides=[],countries=[],includeContact=false,includeSoutheastAsia=false,publishedCautionTopics=[]){
 const site=String(origin).replace(/\/$/,'');
 const urls=[{path:'/'},{path:'/about'},{path:'/privacy'},{path:'/destinations'}];
 if(includeContact)urls.push({path:'/contact'});
 if(includeSoutheastAsia)urls.push({path:'/southeast-asia'});
 if(publishedCautionTopics.length){
  urls.push({path:'/cautions'});
  for(const slug of publishedCautionTopics){if(/^[a-z0-9-]+$/.test(slug))urls.push({path:'/cautions/'+slug});}
 }
 for(const row of guides){
  const slug=String(row?.slug||'');
  if(!slug)continue;
  urls.push({path:'/guides/'+encodeURIComponent(slug),lastmod:isoDate(row.updated_at)||isoDate(row.published_at)});
 }
 const seen=new Set();
 for(const row of countries){
  const country=String(row?.country||'');
  const slug=country.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!slug||seen.has(slug))continue;
  seen.add(slug);
  urls.push({path:'/destinations/'+slug});
 }
 return '<?xml version="1.0" encoding="UTF-8"?>'+
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  urls.map(row=>'<url><loc>'+xml(site+row.path)+'</loc>'+
   (row.lastmod?'<lastmod>'+xml(row.lastmod)+'</lastmod>':'')+'</url>').join('')+
  '</urlset>';
}
