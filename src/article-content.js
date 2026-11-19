// Strict, deliberately limited markdown for user-supplied editorial writing.
// Escapes all HTML; external links require HTTPS. Approved internal routes and
// same-page anchors are allowed. No raw HTML or arbitrary media embeds.
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sectionSlug=text=>String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'section';
const safeEditorialImagePath=value=>{
 const raw=String(value||'').trim();
 return /^\/media\/editorial\/[a-z0-9][a-z0-9-]{0,140}\.(?:webp|png|jpe?g)$/i.test(raw)?raw:null;
};
function safeEditorialHref(raw){
 const href=String(raw||'').replaceAll('&amp;','&');
 if(/^#[a-z0-9][a-z0-9-]{0,100}$/.test(href))return {url:href,external:false};
 if(/^\/(?:guides\/[a-z0-9][a-z0-9-]{0,104}|destinations\/[a-z0-9][a-z0-9-]{0,104}|cautions(?:\/[a-z0-9][a-z0-9-]{0,104})?)(?:#[a-z0-9][a-z0-9-]{0,100})?$/.test(href))return {url:href,external:false};
 try{
  const url=new URL(href);
  return url.protocol==='https:'?{url:url.href,external:true}:null;
 }catch{return null;}
}
function inline(text){
 const escaped=escapeHTML(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
 return escaped.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,(_all,label,url)=>{
  const resolved=safeEditorialHref(url);
  if(!resolved)return label;
  return '<a href="'+escapeHTML(resolved.url)+'"'+(resolved.external?' target="_blank" rel="noopener noreferrer nofollow"':'')+'>'+label+'</a>';
 });
}
export function renderArticleMarkdown(markdown){
 const lines=String(markdown||'').split(/\r?\n/),chunks=[],headings=[],used=new Map();
 let list=false;
 const closeList=()=>{if(list){chunks.push('</ul>');list=false;}};
 for(let position=0;position<lines.length;position++){
  const line=lines[position];
  const image=line.match(/^!\[([^\]]*)\]\((\/media\/editorial\/[^\s)]+)\)\s*$/);
  if(image){
   closeList();
   const src=safeEditorialImagePath(image[2]);
   if(src){
    const alt=escapeHTML(image[1].trim()||'Editorial travel illustration');
    // Treat the immediately following editorial caption as a true figure caption.
    let next=position+1;
    while(next<lines.length&&next<=position+3&&!lines[next].trim())next++;
    const caption=next<lines.length&&next<=position+3
     ?lines[next].match(/^>\s*Illustration caption:\s*(.+)$/i):null;
    chunks.push('<figure class="article-inline-image"><img loading="lazy" decoding="async" fetchpriority="low" width="1600" height="900" src="'+escapeHTML(src)+'" alt="'+alt+'">'+
     (caption?'<figcaption>'+inline(caption[1])+'</figcaption>':'')+'</figure>');
    if(caption)position=next;
    continue;
   }
  }
  if(/^\s*[-*] /.test(line)){
   if(!list){list=true;chunks.push('<ul>');}
   chunks.push('<li>'+inline(line.replace(/^\s*[-*] /,''))+'</li>');
   continue;
  }
  closeList();
  const heading=line.match(/^#{1,3} (.+)$/);
  if(heading){
   const level=heading[0].startsWith('###')?3:2;
   // Slug IDs are unique for repeated headings and HTML-escaped before use.
   const label=heading[1].replace(/\*\*/g,'').replace(/\[([^\]]+)\]\(https:\/\/[^\s)]+\)/g,'$1');
   const base=sectionSlug(label),times=(used.get(base)||0)+1;
   used.set(base,times);
   const id=times===1?base:base+'-'+times;
   headings.push({id,label:label.trim(),level});
   chunks.push('<h'+level+' id="'+escapeHTML(id)+'">'+inline(heading[1])+
    ' <a class="heading-anchor" href="#'+escapeHTML(id)+'" aria-label="Link to section: '+escapeHTML(label.trim())+'"><span aria-hidden="true">#</span></a></h'+level+'>');
  }else if(/^> /.test(line)){
   chunks.push('<blockquote>'+inline(line.slice(2))+'</blockquote>');
  }else if(line.trim())chunks.push('<p>'+inline(line.trim())+'</p>');
 }
 closeList();
 return {html:chunks.join(''),headings};
}
// Only show manually written quick-take bullets under an explicit dedicated heading.
// Never auto-summarize other article claims and present them as editor-vetted takeaways.
export function editorialQuickTakes(markdown){
 const lines=String(markdown||'').split(/\r?\n/),items=[];
 let found=false;
 for(const line of lines){
  if(/^#{1,3} /i.test(line)){
   if(found)break;
   if(/^#{1,3} (?:key takeaways|quick take|the quick take)\s*$/i.test(line.trim()))found=true;
   continue;
  }
  if(!found)continue;
  const item=line.match(/^\s*[-*] (.+)$/);
  if(item&&item[1].trim())items.push(item[1].trim().slice(0,260));
  if(items.length===5)break;
 }
 return items.length>=2?items:[];
}
export const escapeEditorial=escapeHTML;
