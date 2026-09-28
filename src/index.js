
import {
  isLoginConfigured, requireSameOrigin, checkLoginKey,
  createAdminSession, clearAdminSession, hasAdminSession,
  requireKeySession, checkLoginThrottle, recordLoginFailure
} from './auth.js';
import { normalizeArticle, STATUSES, CATEGORIES, isValidSchedule, slugify } from './content.js';
import { STARTER_DESTINATIONS, SOUTHEAST_ASIA_COUNTRIES, isSoutheastAsia, groupDestinationsByContinent } from './destinations.js';
import { renderArticleMarkdown, editorialQuickTakes } from './article-content.js';
import { articleStructuredData, isoDate, rasterImage, jsonLdTag, sitemapXML } from './seo.js';

const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe = (url) => { try {const u=new URL(url);return u.protocol==='https:'?u.href:null;} catch{return null;} };
const safeParse = (value, fallback=[]) => {try {return JSON.parse(value);}catch{return fallback;}};
const link = (href,text,cls='') => '<a href="'+esc(href)+'" class="'+cls+'">'+esc(text)+'</a>';
const privateRedirect = target=>new Response(null,{
 status:302,headers:{Location:String(target),'cache-control':'private, no-store',
  'x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer'}
});
const siteURL = env => (env.SITE_URL||'https://tripcaution.com').replace(/\/$/,'');
const nav = '<a href="/southeast-asia">Southeast Asia</a><a href="/destinations">Destinations</a><a href="/#latest">Field notes</a><a href="/about">About</a>';
function layout(env, title, body, meta={}) {
 const description=meta.description||'Evidence-led travel precautions and practical guides. Know before you go.';
 const url=siteURL(env)+(meta.path||'/');
 const image=rasterImage(meta.image);
 const ogType=meta.ogType==='article'?'article':'website';
 const main=String(body).replace(/<main\b/,'<main id="main-content"');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${esc(title)} | TripCaution</title><meta name="description" content="${esc(description)}">${meta.noindex?'<meta name="robots" content="'+(meta.preview?'noindex,nofollow,noarchive':'noindex,follow')+'">':''}
 ${meta.preview?'':'<link rel="canonical" href="'+esc(url)+'">'}<meta property="og:title" content="${esc(title)} | TripCaution">
 <meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="${ogType}"><meta property="og:site_name" content="TripCaution">
 <meta name="twitter:card" content="${image?'summary_large_image':'summary'}">
 ${ogType==='article'&&meta.publishedAt?'<meta property="article:published_time" content="'+esc(meta.publishedAt)+'">':''}
 ${ogType==='article'&&meta.modifiedAt?'<meta property="article:modified_time" content="'+esc(meta.modifiedAt)+'">':''}
 ${ogType==='article'&&Number.isInteger(meta.sourceCount)&&meta.sourceCount>=0?'<meta name="tripcaution:source-count" content="'+meta.sourceCount+'">':''}
 ${image?'<meta property="og:image" content="'+esc(image)+'">':''}
 ${!meta.preview&&meta.schema?jsonLdTag(meta.schema):''}
 <link rel="stylesheet" href="/styles.css"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
 </head><body${meta.preview?' class="private-preview"':''}><a class="skip-link" href="#main-content">Skip to main content</a><header class="header"><div class="shell nav-wrap"><a class="brand" href="/" aria-label="TripCaution homepage"><span class="brand-mark">!</span>TRIP<span>CAUTION</span></a>
 <nav aria-label="Main navigation">${nav}</nav><a href="/#destinations" class="header-cta">Explore <span>↗</span></a></div></header>
 ${main}<footer><div class="shell footer-grid"><div><div class="footer-brand">TRIP<span>CAUTION</span><span class="tiny-star"> ✳</span></div>
 <p>Know before you go. Independent travel information with linked sources. Not an emergency alert service.</p></div>
 <div><strong>EXPLORE</strong><a href="/destinations">Destinations</a><a href="/#latest">Latest guides</a></div>
 <div><strong>INFORMATION</strong><a href="/about">About & editorial policy</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a></div>
 </div><div class="shell foot-bottom"><span>© ${new Date().getUTCFullYear()} TripCaution</span><span>Travel prepared. Travel curious.</span></div></footer><script src="/site.js" defer></script></body></html>`;
}
// Public and owner pages do not need arbitrary scripts, framing or device APIs.
// Update CSP deliberately when an ad or analytics provider is actually enabled.
const SITE_CSP=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'",
 "script-src 'self'","style-src 'self' https://fonts.googleapis.com",
 "font-src 'self' https://fonts.gstatic.com","img-src 'self' https: data:",
 "connect-src 'self'","form-action 'self'","upgrade-insecure-requests"].join('; ');
const SITE_PERMISSIONS='camera=(), microphone=(), geolocation=(), payment=()';
function html(content,status=200,headers={}) {
 return new Response(content,{status,headers:{
  'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff',
  'x-frame-options':'DENY','content-security-policy':SITE_CSP,
  'permissions-policy':SITE_PERMISSIONS,'referrer-policy':'strict-origin-when-cross-origin',...headers
 }});
}
function articleCard(a,variant='standard') {
 const path='/guides/'+encodeURIComponent(a.slug);
 const country=esc(a.country), category=esc(a.category_name||a.category_id?.replaceAll('-',' ')||'Guide');
 const cls=variant==='lead'?' guide-card-lead':variant==='side'?' guide-card-side':'';
 return `<article class="guide-card${cls}"><a class="card-visual" href="${path}" aria-label="Read ${esc(a.title)}">
 ${safe(a.hero_image_url)?'<img loading="lazy" src="'+esc(a.hero_image_url)+'" alt="'+esc(a.hero_alt||'Editorial travel illustration')+'">':'<div class="abstract-map"><span>✳</span><i></i></div>'}
 <span class="visual-tag">${category}</span></a><div class="card-body"><div class="eyebrow">${country}${a.city?' <span>·</span> '+esc(a.city):''}</div>
 <h3><a href="${path}">${esc(a.title)}</a></h3><p>${esc(a.excerpt||'A practical guide to help you plan more confidently.')}</p>
 <div class="card-bottom"><a class="card-read" href="${path}" aria-label="Read ${esc(a.title)}">Read guide <span aria-hidden="true">↗</span></a></div></div></article>`;
}
// An overview is helpful before all eleven countries have live guides.
// Pending countries are intentionally plain text cards, never dead-end links.
function southeastAsiaTiles(countryRows){
 const counts=new Map(countryRows.filter(row=>row?.country).map(row=>[
  String(row.country).toLocaleLowerCase('en'),Number(row.total)||0
 ]));
 return '<div class="sea-priority-grid">'+SOUTHEAST_ASIA_COUNTRIES.map(country=>{
  const ready=counts.get(country.toLocaleLowerCase('en'))||0;
  const inner='<strong>'+esc(country)+'</strong><span>'+
   (ready?ready+' published '+(ready===1?'guide':'guides')+' <span aria-hidden="true">↗</span>':'Research planned')+
   '</span>';
  return ready?'<a class="sea-country sea-country-ready" href="/destinations/'+slugify(country)+'">'+inner+'</a>':
   '<div class="sea-country sea-country-pending">'+inner+'</div>';
 }).join('')+'</div>';
}
async function homepage(env){
 let latest=[],countryRows=[],count=0;
 if(env.DB) {
  const [a,c,n] = await Promise.all([
   env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' AND a.published_at<=datetime('now') ORDER BY CASE WHEN a.country IN ("+SOUTHEAST_ASIA_COUNTRIES.map(country=>"'"+country+"'").join(',')+") THEN 0 ELSE 1 END,a.published_at DESC LIMIT 9").all(),
   env.DB.prepare("SELECT country,COUNT(*) total FROM articles WHERE status='published' AND published_at<=datetime('now') GROUP BY country ORDER BY country COLLATE NOCASE ASC LIMIT 250").all(),
   env.DB.prepare("SELECT COUNT(*) count FROM articles WHERE status='published' AND published_at<=datetime('now')").first()
  ]);
  latest=a.results;countryRows=c.results;count=n?.count||0;
 }
 const publishedCountries=countryRows.filter(row=>row.country && Number(row.total)>0);
 const feature=latest.slice(0,3);
 const additional=latest.slice(3,9);
 const readyHints=publishedCountries.filter(row=>isSoutheastAsia(row.country)).slice(0,3);
 const body=`<main>
 <section class="hero home-hero"><div class="shell hero-inner"><div class="hero-content">
   <div class="hero-label"><span class="label-line"></span> THE INDEPENDENT TRAVEL FIELD GUIDE <span class="hero-label-star">✳</span></div>
   <h1>Go somewhere new.<br><em>Know what to avoid.</em></h1>
   <p class="hero-description">Starting in Southeast Asia: discover practical travel checks and source-backed guidance — before you pack.</p>
   <form class="destination-search" action="/search" method="get">
     <label class="sr-only" for="q">Search destinations and guides</label><span class="search-icon" aria-hidden="true">⌕</span>
     <input id="q" type="search" name="q" placeholder="Country, city or topic..." required maxlength="80">
     <button type="submit">Find a guide <span aria-hidden="true">↗</span></button>
   </form>
   <div class="search-hints"><span>${readyHints.length?'READ ABOUT':'EXPLORE'}</span>${readyHints.length?readyHints.map(row=>link('/destinations/'+slugify(row.country),row.country)).join('') :link('/southeast-asia','Southeast Asia guide hub')}</div>
  </div>
  <div class="hero-visual" aria-hidden="true">
    <div class="paper-layer paper-layer-back"></div><div class="paper-layer paper-layer-mid"></div>
    <div class="postcard">
      <div class="postcard-top"><span>NOTES FROM THE ROAD</span><span>NO. 001 ↗</span></div>
      <img src="/illustrations/travel-journal.svg" width="720" height="440" alt="">
      <div class="postcard-bottom"><span>GO CURIOUS. STAY INFORMED.</span><span>✳</span></div>
    </div>
    <div class="postcard-sticker">BEFORE<br>YOU GO <span>↗</span></div>
  </div></div></section>
 <section class="section featured-section" id="latest"><div class="shell">
   <div class="section-heading"><div><div class="eyebrow">01 — START READING</div>
     <h2>Field notes for <em>curious travelers.</em></h2>
     <p>Practical advice with linked sources. Browse the latest published guides.</p></div>
     ${count?'<span class="guide-count">'+count+' PUBLISHED '+(count===1?'GUIDE':'GUIDES')+'</span>':''}
   </div>
   ${feature.length?`<div class="featured-layout ${feature.length===1?'featured-single':''}">
       ${articleCard(feature[0],'lead')}
       ${feature.length>1?'<div class="featured-side">'+feature.slice(1).map(a=>articleCard(a,'side')).join('')+'</div>':''}
     </div>`:
     '<div class="inline-empty"><span class="empty-icon" aria-hidden="true">✳</span><div><small>RESEARCH IN PROGRESS</small><h3>Our first field notes are on the way.</h3><p>Explore the destinations we are preparing, or search for a country.</p></div><a href="/destinations">Explore destinations ↗</a></div>'}
 </div></section>
 <section class="section shell home-destinations-section" id="destinations">
   <div class="section-heading"><div><div class="eyebrow">02 — SOUTHEAST ASIA FIRST</div>
     <h2>Explore all <em>11 countries.</em></h2>
     <p>Our first editorial focus is every Southeast Asian country. Choose a published guide; other destinations are clearly marked as research planned.</p></div>
     <a class="section-action" href="/southeast-asia">Southeast Asia guide hub <span aria-hidden="true">↗</span></a>
   </div>
   ${southeastAsiaTiles(countryRows)}
   <div class="home-destination-actions">
     <form action="/search" method="get" class="destination-inline-search">
       <label class="sr-only" for="country-search">Search guides and destinations</label>
       <input id="country-search" type="search" name="q" placeholder="Search a place or topic…" maxlength="80" required>
       <button type="submit">Search ↗</button>
     </form>
     <a href="/destinations" class="all-destinations-link">Browse the full A–Z destination list <span aria-hidden="true">↗</span></a>
   </div>
 </section>
 ${additional.length?`<section class="section alt-section more-notes-section"><div class="shell">
   <div class="section-heading"><div><div class="eyebrow">03 — MORE FIELD NOTES</div><h2>Keep <em>exploring.</em></h2></div>
     <a class="section-action" href="/destinations">Explore destinations <span aria-hidden="true">↗</span></a></div>
   <div class="guide-grid">${additional.map(a=>articleCard(a)).join('')}</div>
 </div></section>`:''}
 <div class="editorial-strip home-editorial-strip"><div class="shell editorial-strip-inner">
   <span class="strip-label">TRAVEL NOTES /</span><span>Real research. Practical takeaways. No made-up travel stories.</span>
   <a href="/about">Read our approach <span aria-hidden="true">↗</span></a>
 </div></div>
 <aside class="site-signoff"><div class="shell"><span>✳ A LITTLE PREPARATION GOES A LONG WAY.</span><a href="/about">Get to know TripCaution <span aria-hidden="true">↗</span></a></div></aside>
 </main>`;
 return html(layout(env,'Know before you go',body,{path:'/'}),200,{'cache-control':'public, max-age=60'});
}
async function southeastAsiaPage(env){
 const rows=env.DB?(await env.DB.prepare("SELECT country,COUNT(*) total FROM articles WHERE status='published' AND published_at<=datetime('now') GROUP BY country").all()).results:[];
 const regionalRows=rows.filter(row=>isSoutheastAsia(row.country)&&Number(row.total)>0);
 const publishedCount=regionalRows.reduce((sum,row)=>sum+Number(row.total),0);
 let articles=[];
 if(publishedCount && env.DB){
  const placeholders=SOUTHEAST_ASIA_COUNTRIES.map(()=>'?').join(',');
  articles=(await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' AND a.published_at<=datetime('now') AND a.country IN ("+placeholders+") ORDER BY a.published_at DESC LIMIT 6")
   .bind(...SOUTHEAST_ASIA_COUNTRIES).all()).results;
 }
 const body=`<main><section class="destination-hero sea-hub-hero"><div class="shell">
  <a class="backlink" href="/">← Back to TripCaution</a>
  <div class="eyebrow">REGIONAL GUIDE / ALL 11 COUNTRIES</div>
  <h1>Southeast Asia, <em>one country at a time.</em></h1>
  <p>Travel preparation rooted in source links, not invented local experiences. We're researching all 11 countries. Only published guides are linked below.</p>
  <span class="dest-count">${publishedCount} PUBLISHED ${publishedCount===1?'GUIDE':'GUIDES'} · 11 DESTINATIONS</span>
 </div></section>
 <section class="section shell sea-hub-list" aria-label="Southeast Asian destinations">
  <div class="section-heading"><div><div class="eyebrow">BROWSE THE REGION</div><h2>All eleven <em>destinations.</em></h2></div></div>
  ${southeastAsiaTiles(rows)}
  <p class="sea-hub-note">Research planned means that TripCaution has not yet published an independently reviewed guide for this destination. For urgent travel decisions, check your government's current official advice.</p>
 </section>
 ${articles.length?'<section class="section alt-section sea-hub-latest"><div class="shell"><div class="section-heading"><div><div class="eyebrow">NOW AVAILABLE</div><h2>Published <em>field notes.</em></h2></div></div><div class="guide-grid">'+articles.map(article=>articleCard(article)).join('')+'</div></div></section>':''}
 <section class="shell sea-hub-other"><a class="all-destinations-link" href="/destinations">Full A–Z destination index, including previously published guides elsewhere ↗</a></section></main>`;
 return html(layout(env,'Southeast Asia travel guides',body,{
  path:'/southeast-asia',noindex:publishedCount===0,
  description:'Explore practical travel preparation and published, source-linked TripCaution guides for all 11 Southeast Asian countries.'
 }),200,{'cache-control':'public, max-age=60'});
}
async function destinationIndexPage(env){
 const rows=env.DB?(await env.DB.prepare("SELECT country,COUNT(*) total FROM articles WHERE status='published' AND published_at<=datetime('now') GROUP BY country ORDER BY country COLLATE NOCASE ASC LIMIT 250").all()).results:[];
 const countByCountry=new Map(rows.map(row=>[row.country.toLocaleLowerCase('en'),Number(row.total)]));
 const groups=groupDestinationsByContinent([...STARTER_DESTINATIONS,...rows.map(row=>row.country)]);
 const body=`<main>
 <section class="destination-hero"><div class="shell"><a href="/" class="backlink">← Back to the latest guides</a>
   <div class="eyebrow">SOUTHEAST ASIA FIRST / FULL DESTINATION INDEX</div>
   <h1>All 11 Southeast Asian <em>countries first.</em></h1>
   <p>We are researching every country in Southeast Asia. Previously published guides elsewhere remain available, but our new editorial focus is this region.</p>
   <p><a class="all-destinations-link" href="/southeast-asia">Explore the Southeast Asia guide hub ↗</a></p>
   <form action="/search" method="get" class="destination-inline-search directory-search">
     <label for="directory-search" class="sr-only">Search destinations and guides</label>
     <input id="directory-search" name="q" type="search" maxlength="80" placeholder="Search a country or topic…" required>
     <button type="submit">Search ↗</button>
   </form>
 </div></section>
 <section class="section shell all-destination-section" aria-label="All destinations by continent">
   <nav class="continent-nav" aria-label="Jump to continent">
     ${groups.map(group=>'<a href="#continent-'+slugify(group.continent)+'">'+esc(group.continent)+' <small>'+group.countries.length+'</small></a>').join('')}
   </nav>
   <div class="continent-directory">
     ${groups.map(group=>`<section class="continent-section" aria-labelledby="continent-${slugify(group.continent)}">
       <div class="continent-heading"><h2 id="continent-${slugify(group.continent)}">${esc(group.continent)}</h2><span class="continent-count">${group.countries.length} ${group.countries.length===1?'DESTINATION':'DESTINATIONS'} / A–Z</span></div>
       <div class="destination-grid">${group.countries.map(country=>{
         const ready=countByCountry.get(country.toLocaleLowerCase('en'))||0;
         return ready?'<a class="destination-tile" href="/destinations/'+slugify(country)+'"><span class="destination-name">'+esc(country)+'</span><span class="directory-tile-meta">'+ready+' '+(ready===1?'guide':'guides')+' <span aria-hidden="true">↗</span></span></a>':
           '<div class="destination-tile destination-pending"><span class="destination-name">'+esc(country)+'</span><span class="directory-tile-meta">Research planned</span></div>';
       }).join('')}</div>
     </section>`).join('')}
   </div>
 </section></main>`;
 return html(layout(env,'All destinations',body,{path:'/destinations',description:'Browse TripCaution travel guides and discover the destinations under research.'}),200,{'cache-control':'public, max-age=60'});
}
async function destinationPage(env,slug){
 const all=env.DB?await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' AND a.published_at<=datetime('now') AND lower(replace(a.country,' ','-'))=? ORDER BY a.published_at DESC LIMIT 100").bind(slug).all():{results:[]};
 const common={'vietnam':'Vietnam','cambodia':'Cambodia','thailand':'Thailand','laos':'Laos','japan':'Japan','singapore':'Singapore','france':'France','indonesia':'Indonesia','malaysia':'Malaysia','italy':'Italy','spain':'Spain','united-states':'United States'};
 const cityMap={'bangkok':{name:'Bangkok',country:'Thailand'}};
 const city=cityMap[slug]||null;
 const country=common[slug]||city?.country||all.results[0]?.country;
 if(!country)return html(layout(env,'Destination not found','<main class="shell simple"><h1>We could not find that destination.</h1><a href="/">Explore destinations ↗</a></main>',{noindex:true}),404,{'cache-control':'no-store','x-robots-tag':'noindex'});
 let articles=all.results;
 if(city && env.DB) {
  articles=(await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' AND a.published_at<=datetime('now') AND lower(a.city)=? ORDER BY a.published_at DESC LIMIT 100").bind(city.name.toLowerCase()).all()).results;
 }
 const heading=city?.name||country;
 const body=`<main><div class="destination-hero"><div class="shell"><a class="backlink" href="/">← All destinations</a><div class="eyebrow">DESTINATION GUIDE / ${esc(country.toUpperCase())}${city?' / '+esc(city.name.toUpperCase()):''}</div><h1>${esc(heading)}<span class="title-star"> ✳</span></h1><p>What to know, what to double-check, and how to travel with more confidence.</p><span class="dest-count">${articles.length} RESEARCHED GUIDES</span></div></div><section class="section shell">
 ${articles.length?'<div class="guide-grid">'+articles.map(a=>articleCard(a)).join('')+'</div>':'<div class="empty-state"><span>✳</span><h3>Research in progress.</h3><p>We are building carefully sourced guides for this destination. No warnings are published until evidence is checked.</p></div>'}
 </section></main>`;
 return html(layout(env,heading+' travel precautions',body,{path:'/destinations/'+slug,description:'Travel precautions, cultural considerations and researched guides for '+heading+', '+country+'.',noindex:articles.length===0}));
}
function renderGuideArticle(env,a,preview=false,related=[]){
 const parsedSources=safeParse(a.sources_json);
 const sources=Array.isArray(parsedSources)?parsedSources.filter(source=>safe(source?.url)):[];
 const rendered=renderArticleMarkdown(a.content_markdown);
 const takes=editorialQuickTakes(a.content_markdown);
 const tocHTML=rendered.headings.length>=2?'<details class="article-toc" data-article-toc open><summary>In this guide <span aria-hidden="true">⌄</span></summary><nav aria-label="On this page"><ol>'+
  rendered.headings.map(h=>'<li class="toc-level-'+h.level+'"><a href="#'+esc(h.id)+'">'+esc(h.label)+'</a></li>').join('')+
  '</ol></nav></details>':'';
 const asideTakeaways=takes.length?
  '<div class="aside-card editorial-takeaways"><span>THE QUICK TAKE</span><ul>'+
  takes.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul><a href="/destinations/'+slugify(a.country)+'">More in '+esc(a.country)+' ↗</a></div>':
  '<div class="aside-card aside-explore"><span>EXPLORE MORE</span><h3>Plan your next move.</h3><p>For changing fares and rules, confirm the original sources.</p><a href="/destinations/'+slugify(a.country)+'">More in '+esc(a.country)+' ↗</a></div>';
 const relatedHTML=related.length?'<section class="related-guides" aria-labelledby="related-heading"><div class="shell"><div class="eyebrow">MORE FIELD NOTES</div><h2 id="related-heading">Continue exploring</h2><div class="guide-grid">'+related.map(row=>articleCard(row)).join('')+'</div></div></section>':'';
 // Publication timestamp and number of sources are retained in HTML metadata,
 // Article JSON-LD and the original source records; no visible top metadata bar.
 const body=`<main><div class="article-top"><div class="shell article-head"><a href="/destinations/${slugify(a.country)}" class="backlink">← ${esc(a.country)} guides</a><div class="eyebrow">${esc(a.country.toUpperCase())}${a.city?' / '+esc(a.city.toUpperCase()):''} / ${esc((a.category_name||'GUIDE').toUpperCase())}</div><h1>${esc(a.title)}</h1><p class="article-deck">${esc(a.excerpt)}</p></div></div>
 <div class="shell article-wrap"><article class="article-content">${safe(a.hero_image_url)?'<figure class="hero-image"><img src="'+esc(a.hero_image_url)+'" alt="'+esc(a.hero_alt||'Editorial illustration')+'"><figcaption>AI-generated editorial illustration; not a photograph or evidence of an incident.</figcaption></figure>':''}
 <div class="article-notice"><strong>✳ A note on our approach</strong><p>TripCaution shares researched precautions, not personal eyewitness accounts. Conditions change; confirm important guidance with official authorities before traveling.</p></div>
 ${tocHTML}<div class="prose">${rendered.html}</div><section class="sources"><h2>Sources & verification</h2><p>Always consult the source directly for the latest information.</p>${sources.length?'<ol>'+sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer nofollow">'+esc(s.title)+'</a><small>'+esc(s.publisher||'Source')+(s.published_at?' · '+esc(s.published_at):'')+'</small></li>').join('')+'</ol>':'<p>Editorial sources are pending publication.</p>'}
 </section></article>
 <aside class="article-aside">${asideTakeaways}<div class="aside-share">SHARE THIS GUIDE <button type="button" data-copy-guide>Copy link ↗</button></div></aside></div>${relatedHTML}</main>`;
 const previewBanner=preview?`<aside class="editorial-preview-banner" role="note"><div class="shell editorial-preview-inner"><div><strong>PRIVATE PREVIEW · ${a.status==='published'?'CURRENTLY LIVE':'NOT PUBLISHED'}</strong><p>This is the last SAVED version, shown in the public article layout. Verify all claims, source links, dates and images before approval. This URL only works when signed in.</p></div><a href="/admin?edit=${encodeURIComponent(a.id)}">← Back to editor</a></div></aside>`:'';
 const schema=preview?null:articleStructuredData(siteURL(env),{...a,sources});
 const page=layout(env,a.seo_title||a.title,previewBanner+body,{
  path:'/guides/'+encodeURIComponent(a.slug),
  description:a.seo_description||a.excerpt,image:a.hero_image_url,noindex:preview,preview,
  ogType:'article',publishedAt:isoDate(a.published_at),
  modifiedAt:isoDate(a.updated_at)||isoDate(a.published_at),sourceCount:sources.length,schema
 });
 return html(page,200,preview?{'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer','x-frame-options':'DENY'}:{'cache-control':'public, max-age=60'});
}
async function relatedPublishedGuides(env,a){
 if(!env.DB)return [];
 const rows=await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.id!=? AND a.status='published' AND a.published_at<=datetime('now') AND (a.country=? OR a.category_id=?) ORDER BY CASE WHEN a.country=? THEN 0 ELSE 1 END, a.published_at DESC LIMIT 3").bind(a.id,a.country,a.category_id,a.country).all();
 return rows.results||[];
}
async function guidePage(env,slug){
 const a=env.DB?await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.slug=? AND a.status='published' AND a.published_at<=datetime('now') LIMIT 1").bind(slug).first():null;
 if(!a)return html(layout(env,'Guide unavailable','<main class="shell simple"><h1>Guide not found.</h1><a href="/">Browse destinations ↗</a></main>',{noindex:true}),404,{'cache-control':'no-store','x-robots-tag':'noindex'});
 // Related links are limited to already-public guides. Never expose draft metadata.
 const related=await relatedPublishedGuides(env,a);
 return renderGuideArticle(env,a,false,related);
}
async function previewGuidePage(request,env,id){
 if(!isLoginConfigured(env))return html('<h1>Admin login is not configured.</h1>',503,{'cache-control':'no-store'});
 if(!await hasAdminSession(request,env))return privateRedirect(new URL('/sign-in',request.url));
 if(!env.DB)return html('<h1>Database unavailable.</h1>',503,{'cache-control':'no-store'});
 const a=await env.DB.prepare('SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.id=? LIMIT 1').bind(id).first();
 if(!a || a.status==='deleted')return html('<h1>Preview unavailable.</h1>',404,{'cache-control':'private, no-store','x-robots-tag':'noindex'});
 return renderGuideArticle(env,a,true,await relatedPublishedGuides(env,a));
}
function editorialEmail(env) {
 const email=String(env.EDITORIAL_CONTACT_EMAIL||'').trim();
 return /^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(email)?email:null;
}
function staticPage(env,type){
 const email=editorialEmail(env);
 // An email-shaped variable is not evidence that this mailbox exists.
 // Avoid publicly advertising a placeholder until the owner checks delivery.
 const emailReady=Boolean(email) && env.EDITORIAL_CONTACT_VERIFIED==='true';
 const contact=emailReady?'<a class="editorial-email" href="mailto:'+esc(email)+'?subject=TripCaution%20correction">'+esc(email)+'</a>':
   '<strong class="contact-not-ready">Our editorial contact inbox is being set up. Please check back later to submit a correction. For urgent travel concerns, contact the relevant authority directly.</strong>';
 const blocks={
   about:['About & editorial policy',`<p>TripCaution is an independent, research-led travel guide. Our articles describe practical travel questions and point readers to original sources. We do not claim personal visits, personal interviews or firsthand incident reports. We are not an emergency-alert service.</p>
     <h2>Our research process</h2><p>We prioritize official operators, local tourism authorities, government guidance and dated primary evidence. AI tools may assist with research and initial drafts; source lists and AI-generated timestamps are not proof that an editor has checked a claim. Every new article must be checked and approved by an editor before publishing.</p>
     <h2>Corrections and limitations</h2><p>Conditions, fees, routes and rules can change. Readers should confirm time-sensitive details with the responsible operator or authority. If we receive a well-supported correction, we may clarify, update or withdraw the affected content. Share the article URL, exact statement, supporting source and relevant dates with the editorial desk.</p><p><strong>Editorial contact:</strong> ${contact}</p>`],
   privacy:['Privacy notice',`<p>This notice describes the services currently enabled. TripCaution publishes travel information using Cloudflare Workers and D1, without public accounts. At present we do not run third-party advertising, sell user data or deliberately deploy marketing-analytics trackers. We will revise this notice before enabling new tracking or advertising.</p>
     <h2>Hosting and essential cookies</h2><p>Our hosting and security provider, Cloudflare, may process IP addresses, request details and technical security data to deliver and protect this website. The private editorial area uses a signed, essential session cookie that expires after 12 hours. It is Secure and HttpOnly, and not used for marketing.</p>
     <h2>Third-party fonts</h2><p>This site loads Google Fonts from an external service. Your browser may contact the font provider to retrieve typefaces, which can reveal technical connection data including your IP address. We do not receive a Google account identity through these font requests.</p>
     <h2>Editorial correspondence</h2><p>If you choose to email us, your email service and ours will process your message, email address and associated metadata. We use this information to investigate and answer your inquiry or correction. Correspondence is kept only as long as reasonably needed for handling the matter and editorial accountability and is then deleted. Please avoid sending sensitive personal information.</p>
     <h2>Privacy questions</h2><p>For privacy-related inquiries, please contact the editorial desk: ${contact}</p>`],
   contact:['Contact & corrections',`<p>Found a broken source, outdated travel fee or statement that needs clarification? Please send us a correction request. Corrections help keep our travel guidance useful and evidence-based.</p>
     <h2>How to request a correction</h2><p>Include the article URL, exact wording you question, original supporting source and relevant date. We investigate well-supported requests and may correct, clarify or withdraw the material. We cannot promise a response time or provide real-time travel advice.</p>
     <p class="contact-action"><strong>Editorial desk:</strong><br>${contact}</p>
     <p>In an emergency while traveling, contact local emergency services, your transport operator or your consulate rather than this editorial website.</p>`]
 };
 const [title,body]=blocks[type];
 return html(layout(env,title,'<main class="shell simple editorial-policy"><div class="eyebrow">TRIPCAUTION / INFORMATION</div><h1>'+esc(title)+'</h1>'+body+'<a class="backlink" href="/">← Back home</a></main>',{path:'/'+type,noindex:type==='contact'&&!emailReady}),200,{'cache-control':'public,max-age=300'});
}
async function searchPage(env,url){
 const q=String(url.searchParams.get('q')||'').slice(0,80).trim();
 const countryRows=env.DB?(await env.DB.prepare("SELECT DISTINCT country FROM articles WHERE status='published' AND published_at<=datetime('now')").all()).results:[];
 const ready=new Set(countryRows.map(row=>String(row.country).toLocaleLowerCase('en')));
 const countries=[...new Set([...STARTER_DESTINATIONS,...countryRows.map(row=>row.country)].filter(Boolean))];
 const exactCountry=countries.find(country=>country.toLocaleLowerCase('en')===q.toLocaleLowerCase('en'));
 // Don't send readers to an empty/noindex page just because research is planned.
 if(exactCountry&&ready.has(exactCountry.toLocaleLowerCase('en')))
  return Response.redirect(url.origin+'/destinations/'+slugify(exactCountry),302);
 const matches=q?countries.filter(country=>country.toLocaleLowerCase('en').includes(q.toLocaleLowerCase('en'))).slice(0,12):[];
 // ESCAPE literal LIKE wildcards; searching "%" must not reveal the entire index.
 const pattern='%'+q.replace(/[!%_]/g,char=>'!'+char)+'%';
 const rows=q&&env.DB?(await env.DB.prepare("SELECT * FROM articles WHERE status='published' AND published_at<=datetime('now') AND (title LIKE ? ESCAPE '!' OR country LIKE ? ESCAPE '!' OR city LIKE ? ESCAPE '!' OR excerpt LIKE ? ESCAPE '!') ORDER BY published_at DESC LIMIT 30").bind(...Array(4).fill(pattern)).all()).results:[];
 // City route currently exists for Bangkok only; add new city routes explicitly
 // alongside their destination resolver rather than creating dead-end links.
 if(q.toLocaleLowerCase('en')==='bangkok'&&rows.some(row=>String(row.city||'').toLocaleLowerCase('en')==='bangkok'))
  return Response.redirect(url.origin+'/destinations/bangkok',302);
 const destinations=matches.length?'<section class="search-destinations"><h2>Matching destinations</h2><div class="destination-grid">'+
  matches.map(country=>ready.has(country.toLocaleLowerCase('en'))?
   '<a class="destination-tile" href="/destinations/'+slugify(country)+'"><span class="destination-name">'+esc(country)+'</span><span class="directory-tile-meta">Published guides ↗</span></a>':
   '<div class="destination-tile destination-pending"><span class="destination-name">'+esc(country)+'</span><span class="directory-tile-meta">Research planned</span></div>'
  ).join('')+'</div></section>':'';
 const details=rows.length?'<p>'+rows.length+' published '+(rows.length===1?'guide':'guides')+'</p><div class="guide-grid">'+rows.map(row=>articleCard(row)).join('')+'</div>':
  '<p>'+(q?'No published guides match your search yet. Try another topic or browse our destinations.':'Enter a country, city or topic to start searching.')+'</p>';
 return html(layout(env,'Search',`<main class="shell simple search-results"><div class="eyebrow">DISCOVER</div><h1>Search TripCaution</h1><form action="/search" class="inline-search"><label for="search-query" class="sr-only">Search destinations and guides</label><input id="search-query" name="q" maxlength="80" placeholder="Country, city or topic" value="${esc(q)}"><button>Search ↗</button></form>${destinations}${details}</main>`,{path:'/search',noindex:true}),200,{'x-robots-tag':'noindex'});
}
// Single-editor key sessions replace the previous Cloudflare Access JWT dependency.
const requireAdmin=requireKeySession;
async function requireIngest(request,env){
 if(!env.INGEST_TOKEN || env.INGEST_TOKEN.length<32)throw Object.assign(new Error('Ingest token not configured'),{status:503});
 const provided=request.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(provided)),crypto.subtle.digest('SHA-256',enc.encode(env.INGEST_TOKEN))]);
 const a=new Uint8Array(x),b=new Uint8Array(y);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 if(diff || !provided)throw Object.assign(new Error('Not authorized'),{status:401});
 return 'github-automation';
}
async function audit(env,actor,action,id,details=''){
 await env.DB.prepare('INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,id,details).run();
}
async function insertArticle(env,raw,actor){
 const a=normalizeArticle(raw);
 const found=await env.DB.prepare("SELECT id,title FROM articles WHERE slug=?").bind(a.slug).first();
 if(found)throw Object.assign(new Error('Duplicate slug: '+a.slug),{status:409});
 // Sprint 0: source URLs and an AI research timestamp are NEVER approval.
 // Ingesting any article always creates a human-review draft, including low-risk categories.
 const status='review',published=null;
 const insert = env.DB.prepare(`INSERT INTO articles(id,title,slug,excerpt,content_markdown,country,city,category_id,tags_json,sources_json,uncertainties_json,seo_title,seo_description,hero_image_url,hero_prompt,hero_alt,status,source_mode,review_approved,verified_at,published_at,scheduled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 .bind(a.id,a.title,a.slug,a.excerpt,a.content_markdown,a.country,a.city,a.category_id,a.tags_json,a.sources_json,a.uncertainties_json,a.seo_title,a.seo_description,a.hero_image_url,a.hero_prompt,a.hero_alt,status,a.source_mode,0,a.verified_at,published,a.scheduled_at);
 const auditInsert=env.DB.prepare('INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)')
  .bind(crypto.randomUUID(),actor,'created:'+status,a.id,'');
 await env.DB.batch([insert,auditInsert]);
 return {id:a.id,title:a.title,slug:a.slug,status};
}
async function replaceArticleWithReviewDraft(env,raw,actor){
 if(actor==='github-automation')throw Object.assign(new Error('Admin login required'),{status:403});
 const a=normalizeArticle(raw);
 const old=await env.DB.prepare('SELECT id,status FROM articles WHERE slug=?').bind(a.slug).first();
 if(!old)return insertArticle(env,raw,actor);
 // Only the signed-in owner can explicitly revise an existing guide. The old
 // version is withdrawn while the new revision undergoes a fresh manual review.
 const revision=env.DB.prepare(`UPDATE articles SET title=?,excerpt=?,content_markdown=?,country=?,city=?,category_id=?,
   tags_json=?,sources_json=?,uncertainties_json=?,seo_title=?,seo_description=?,hero_image_url=?,hero_prompt=?,
   hero_alt=?,source_mode='editorial-revision',verified_at=?,review_approved=0,status='review',
   scheduled_at=NULL,updated_at=datetime('now') WHERE id=?`)
 .bind(a.title,a.excerpt,a.content_markdown,a.country,a.city,a.category_id,a.tags_json,
   a.sources_json,a.uncertainties_json,a.seo_title,a.seo_description,a.hero_image_url,
   a.hero_prompt,a.hero_alt,a.verified_at,old.id);
 const revisionAudit=env.DB.prepare('INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)')
  .bind(crypto.randomUUID(),actor,'revision-imported-to-review',old.id,JSON.stringify({old_status:old.status,slug:a.slug}));
 await env.DB.batch([revision,revisionAudit]);
 return {id:old.id,title:a.title,slug:a.slug,status:'review',updated:true};
}
const EDITOR_ACTIONS={
 publish:'published',schedule:'scheduled',hide:'hidden',archive:'archived',
 delete:'deleted',restore:'draft',review:'review'
};
function editorialActionAllowed(old,action){
 if(!old || !(action in EDITOR_ACTIONS))return false;
 const status=old.status;
 if(action==='publish')return ['review','draft','hidden','scheduled'].includes(status);
 if(action==='schedule')return ['review','draft','hidden','scheduled'].includes(status);
 if(action==='hide')return !['hidden','deleted','archived'].includes(status);
 if(action==='delete')return status!=='deleted';
 if(action==='restore')return ['deleted','hidden','archived'].includes(status);
 if(action==='review')return ['published','scheduled','hidden','draft'].includes(status);
 if(action==='archive')return !['archived','deleted'].includes(status);
 return false;
}
async function applyEditorialAction(env,old,action,body,actor){
 if(!(action in EDITOR_ACTIONS))throw Object.assign(new Error('Unknown action'),{status:400});
 if(!editorialActionAllowed(old,action))
  throw Object.assign(new Error('Action is not available for status '+old.status),{status:409});
 const target=EDITOR_ACTIONS[action];
 if(['publish','schedule'].includes(action)){
  if(body.review_confirmed!==true)
   throw Object.assign(new Error('Confirm that you have reviewed the selected article before publishing or scheduling'),{status:422});
  // Basic source gate remains. This is not a substitute for owner review.
  const sources=safeParse(old.sources_json);
  if(!Array.isArray(sources)||!sources.some(source=>safe(source?.url)))
   throw Object.assign(new Error('Add at least one valid HTTPS source before publishing'),{status:422});
  if(action==='schedule' && (!isValidSchedule(body.scheduled_at)||Date.parse(body.scheduled_at)<=Date.now()))
   throw Object.assign(new Error('Choose a future publication date and time with timezone'),{status:422});
 }
 // Soft delete and private hide never destroy an article's text or source links.
 // Any return from hidden/deleted/archived requires explicit owner action.
 const approve=['publish','schedule'].includes(action)?1:
  ['review','hide','archive','delete','restore'].includes(action)?0:old.review_approved;
 const reviewed=['publish','schedule'].includes(action);
 const auditAction=reviewed?'owner-reviewed-and-'+(action==='publish'?'published':'scheduled'):action;
 const details=reviewed?JSON.stringify({
  review_confirmed:true,method:body.review_method==='bulk'?'bulk':'single',
  source_count:safeParse(old.sources_json).length,
  editor_reviewed_at:new Date().toISOString(),review_window_days:30,
  next_review_due_at:new Date(Date.now()+30*86400000).toISOString(),
  evidence_note_collected:false
 }):'';
 // Atomic: when an audit write fails, publication and scheduling roll back too.
 const stateChange=env.DB.prepare("UPDATE articles SET status=?,review_approved=?,scheduled_at=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,datetime('now')) ELSE published_at END,updated_at=datetime('now') WHERE id=?")
  .bind(target,approve,target==='scheduled'?body.scheduled_at:null,target,old.id);
 const auditEvent=env.DB.prepare('INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)')
  .bind(crypto.randomUUID(),actor,auditAction,old.id,details);
 await env.DB.batch([stateChange,auditEvent]);
 return {id:old.id,title:old.title,status:target};
}
async function readImageWithinLimit(request,maxBytes){
 // Guard both advertised length and untrusted streaming/chunked bodies.
 const lengthHeader=request.headers.get('Content-Length');
 if(lengthHeader!==null){
  const length=Number(lengthHeader);
  if(!Number.isFinite(length)||length<0||length>maxBytes)
   throw Object.assign(new Error('Image exceeds 5 MB'),{status:413});
 }
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader(),chunks=[];
 let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){
    await reader.cancel();
    throw Object.assign(new Error('Image exceeds 5 MB'),{status:413});
   }
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
async function api(request,env,url,admin=false){
 if(!env.DB)throw Object.assign(new Error('D1 database missing'),{status:503});
 const pathname=url.pathname,method=request.method;
 let actor;
 if((pathname==='/api/ingest' && method==='POST') || (pathname==='/api/ingest/topics' && method==='GET'))actor=await requireIngest(request,env);
 else {
  if(!['GET','HEAD','OPTIONS'].includes(method))requireSameOrigin(request);
  actor=await requireAdmin(request,env);
}
 if(method==='GET' && pathname==='/api/ingest/topics'){
  // Bot-only overview prevents re-creating the same guide and avoids competing with manual scheduling.
  if(actor!=='github-automation')return json({error:'Bot token required'},403);
  const titles=(await env.DB.prepare("SELECT title,country,city,status FROM articles WHERE status!='deleted' ORDER BY created_at DESC LIMIT 400").all()).results;
  const upcoming=(await env.DB.prepare("SELECT COUNT(*) count FROM articles WHERE status='scheduled' AND julianday(scheduled_at) BETWEEN julianday('now') AND julianday('now','+2 days')").first()).count;
  return json({titles,upcoming});
 }
 if(method==='GET' && pathname==='/api/admin/articles'){
  const q=String(url.searchParams.get('q')||'').trim().slice(0,80);
  const status=url.searchParams.get('status')||'';
  if(status&&!STATUSES.includes(status))return json({error:'Invalid status'},400);
  const page=Number(url.searchParams.get('page')||'1');
  if(!Number.isSafeInteger(page)||page<1||page>10000)return json({error:'Invalid page'},400);
  const args=[],conditions=[];
  if(status){conditions.push('status=?');args.push(status);}
  if(q){conditions.push("instr(lower(title||' '||country||' '||coalesce(city,'')),lower(?))>0");args.push(q);}
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  const count=await env.DB.prepare('SELECT COUNT(*) count FROM articles'+where).bind(...args).first();
  const total=Number(count?.count||0),pageSize=30,pages=Math.max(1,Math.ceil(total/pageSize));
  const current=Math.min(page,pages);
  const rows=await env.DB.prepare('SELECT id,title,slug,country,city,category_id,status,source_mode,verified_at,scheduled_at,published_at,updated_at FROM articles'+where+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...args,pageSize,(current-1)*pageSize).all();
  return json({articles:rows.results||[],page:current,pages,pageSize,total});
 }
 if(method==='GET' && pathname==='/api/admin/queue'){
  const rows=await env.DB.prepare("SELECT id,title,slug,country,city,category_id,status,source_mode,verified_at,scheduled_at,published_at,updated_at FROM articles WHERE status IN ('review','scheduled','draft') ORDER BY CASE WHEN status='scheduled' THEN 0 ELSE 1 END,coalesce(scheduled_at,created_at) ASC,id ASC LIMIT 100").all();
  const result=await env.DB.prepare("SELECT COUNT(*) count FROM articles WHERE status IN ('review','scheduled','draft')").first();
  const total=Number(result?.count||0);
  return json({articles:rows.results||[],total,limited:total>100});
 }
 if(method==='GET' && pathname==='/api/admin/coverage'){
  const countries=SOUTHEAST_ASIA_COUNTRIES;
  const sql='SELECT country,SUM(CASE WHEN status=\'published\' AND published_at<=datetime(\'now\') THEN 1 ELSE 0 END) published,SUM(CASE WHEN status IN (\'draft\',\'review\',\'scheduled\') THEN 1 ELSE 0 END) pipeline FROM articles WHERE country IN ('+countries.map(()=>'?').join(',')+') AND status!=\'deleted\' GROUP BY country';
  const rows=await env.DB.prepare(sql).bind(...countries).all();
  const byCountry=new Map((rows.results||[]).map(row=>[row.country,row]));
  const coverage=countries.map(country=>({country,published:Number(byCountry.get(country)?.published||0),pipeline:Number(byCountry.get(country)?.pipeline||0)}));
  return json({coverage,publishedCountries:coverage.filter(row=>row.published>0).length,totalCountries:countries.length});
 }
 if(method==='GET' && pathname==='/api/admin/categories'){
  return json({categories:(await env.DB.prepare('SELECT * FROM categories ORDER BY name').all()).results});
 }
 if(method==='GET' && pathname.startsWith('/api/admin/article/')){
  const a=await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(pathname.split('/').pop()).first();
  return a?json({article:a}):json({error:'Not found'},404);
 }
 if(method==='POST' && pathname==='/api/admin/bulk'){
  // A deliberately selected set of articles; there is no "update every row" route.
  if(actor==='github-automation')return json({error:'Admin login required'},403);
  const body=await request.json();
  const allowed=['publish','hide','schedule','delete','restore','review'];
  if(!allowed.includes(body?.action))return json({error:'Unsupported bulk action'},400);
  if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>10||
    body.ids.some(id=>typeof id!=='string'||! /^[a-f0-9-]{36}$/.test(id))||
    new Set(body.ids).size!==body.ids.length)return json({error:'Select 1–10 unique article IDs per request; the editor processes larger selections in safe batches'},400);
  if(body.confirm_selection!==true||body.confirm_count!==body.ids.length)
   return json({error:'Explicit confirmation of the exact selected count is required'},422);
  if(['publish','schedule'].includes(body.action)&&body.review_confirmed!==true)
   return json({error:'Confirm that every selected article has been reviewed'},422);
  if(body.action==='schedule'&&(!isValidSchedule(body.scheduled_at)||Date.parse(body.scheduled_at)<=Date.now()))
   return json({error:'Choose a valid future UTC time before scheduling'},422);
  const results=[];
  let scheduledIndex=0;
  for(let i=0;i<body.ids.length;i++){
   const id=body.ids[i];
   try{
    const existing=await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(id).first();
    if(!existing){results.push({id,ok:false,error:'Article not found'});continue;}
    const at=body.action==='schedule'&&body.stagger_days===true?
      new Date(Date.parse(body.scheduled_at)+86400000*scheduledIndex).toISOString():body.scheduled_at;
    const item={...body,review_method:'bulk',scheduled_at:at};
    const completed=await applyEditorialAction(env,existing,body.action,item,actor);
    if(body.action==='schedule')scheduledIndex++;
    results.push({ok:true,...completed,scheduled_at:body.action==='schedule'?at:undefined});
   }catch(e){results.push({id,ok:false,error:e.status&&e.status<500?e.message:'Could not process article'});}
  }
  return json({results,processed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length},207);
 }
 if(method==='GET' && pathname==='/api/admin/trash-count'){
  const row=await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE status='deleted'").first();
  return json({count:Number(row?.count||0)});
 }
 if(method==='POST' && pathname==='/api/admin/purge'){
  // Owner-only irreversible deletion. This intentionally never accepts a bot token,
  // unchecked status, a broad status other than deleted, or a generic "purge all" flag.
  const body=await request.json();
  if(body?.confirmation!=='PERMANENTLY DELETE')
   return json({error:'Type PERMANENTLY DELETE to confirm irreversible deletion'},422);
  if(body?.mode!=='selected'&&body?.mode!=='trash')
   return json({error:'Unknown purge mode'},400);
  const selected=body.mode==='selected';
  if(selected&&(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>50||
    body.ids.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))||
    new Set(body.ids).size!==body.ids.length))
   return json({error:'Select 1–50 unique valid deleted article IDs per request'},400);
  if(body.mode==='trash'&&body.ids!==undefined)
   return json({error:'Empty trash never accepts an article ID list'},400);
  // Require a fresh server-confirmed count so "Empty Trash" cannot erase items
  // added after the owner opened the dialog.
  const list=selected?
   (await env.DB.prepare('SELECT id,status FROM articles WHERE id IN ('+body.ids.map(()=>'?').join(',')+')').bind(...body.ids).all()).results:
   null;
  if(selected&&(!Array.isArray(list)||list.length!==body.ids.length||list.some(row=>row.status!=='deleted')))
   return json({error:'Every selected article must already be in Deleted; refresh the list'},409);
  const count=selected?list.length:
   Number((await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE status='deleted'").first())?.count||0);
  if(count===0)return json({error:'Trash is empty; nothing to permanently delete'},409);
  if(!Number.isInteger(body.confirm_count)||body.confirm_count!==count)
   return json({error:'The number of deleted articles has changed. Refresh and confirm again'},409);
  // D1 batch executes a transaction; if the DELETE fails, old article records
  // and their associated audit history should remain together.
  const binds=selected?body.ids:[];
  const where=selected?'id IN ('+binds.map(()=>'?').join(',')+') AND status=\'deleted\'':"status='deleted'";
  const auditWhere=selected?'article_id IN ('+binds.map(()=>'?').join(',')+')':
   "article_id IN (SELECT id FROM articles WHERE status='deleted')";
  const cleanupAudit=env.DB.prepare('DELETE FROM audit_logs WHERE '+auditWhere);
  const cleanupArticles=env.DB.prepare('DELETE FROM articles WHERE '+where);
  const record=env.DB.prepare("INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)")
   .bind(crypto.randomUUID(),actor,'permanently-purged',null,
    JSON.stringify({mode:body.mode,count,occurred_at:new Date().toISOString()}));
  const statements=[selected?cleanupAudit.bind(...binds):cleanupAudit,
   selected?cleanupArticles.bind(...binds):cleanupArticles,record];
  await env.DB.batch(statements);
  return json({ok:true,purged:count,mode:body.mode,r2_unchanged:true});
 }
 if(method==='POST' && pathname==='/api/admin/auto-schedule'){
  // Sprint 0 launch freeze: no bulk publishing without a per-article evidence record.
  return json({error:'Bulk scheduling disabled. Review and schedule each article individually.'},403);
 }
 if(method==='GET' && pathname==='/api/admin/overview'){
  const status=(await env.DB.prepare("SELECT status,COUNT(*) count FROM articles GROUP BY status").all()).results;
  const auditLogs=(await env.DB.prepare("SELECT action,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8").all()).results;
  const reviewDue=(await env.DB.prepare(`SELECT a.id,a.title,
   (SELECT json_extract(l.details,'$.next_review_due_at') FROM audit_logs l
      WHERE l.article_id=a.id AND ((l.action IN ('reviewed-and-published','reviewed-and-scheduled')
        AND json_valid(l.details) AND length(json_extract(CASE WHEN json_valid(l.details) THEN l.details ELSE '{}' END,'$.evidence_note'))>=30)
       OR (l.action IN ('owner-reviewed-and-published','owner-reviewed-and-scheduled')
        AND json_valid(l.details) AND json_extract(CASE WHEN json_valid(l.details) THEN l.details ELSE '{}' END,'$.review_confirmed')=1))
      ORDER BY l.created_at DESC LIMIT 1) next_review_due_at
   FROM articles a WHERE a.status='published' ORDER BY a.created_at DESC LIMIT 100`).all()).results;
  return json({status,auditLogs,reviewDue});
 }
 if(method==='POST' && (pathname==='/api/ingest'||pathname==='/api/admin/import')){
  const body=await request.json();
  const list=Array.isArray(body.articles)?body.articles:[body];
  if(list.length<1||list.length>10)return json({error:'Import requires 1–10 articles per request; the editor safely splits larger imports'},400);
  const revisionMode=pathname==='/api/admin/import' && body.update_matching===true;
  if(body.update_matching===true&&!revisionMode)return json({error:'Only signed-in editor can revise existing articles'},403);
  if(revisionMode&&body.confirm_unpublish!==true)return json({error:'Explicit acknowledgment required: matching live articles return to Review'},422);
  const results=[];
  for(const entry of list){
   try{results.push({ok:true,...await (revisionMode?replaceArticleWithReviewDraft(env,entry,actor):insertArticle(env,entry,actor))});}
   catch(e){results.push({ok:false,error:e.message,title:entry?.title||''});}
  }
  return json({results},207);
 }
 if(method==='POST' && pathname==='/api/admin/article'){
  const body=await request.json();return json(await insertArticle(env,body,actor),201);
 }
 const match=pathname.match(/^\/api\/admin\/article\/([a-f0-9-]{36})$/);
 if(match && method==='PATCH'){
  const id=match[1],body=await request.json();
  const old=await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(id).first();
  if(!old)return json({error:'Article not found'},404);
  const action=body.action;
  if(action){
   if(actor==='github-automation')return json({error:'Admin session required'},403);
   try{return json({ok:true,...await applyEditorialAction(env,old,action,body,actor)});}
   catch(e){return json({error:e.message},e.status||500);}
  }
  const merged={
   ...old,...body,seo_title:body.seo_title??old.seo_title,seo_description:body.seo_description??old.seo_description,
   sources:body.sources??safeParse(old.sources_json),tags:body.tags??safeParse(old.tags_json),
   research:{verified_at:body.verified_at??old.verified_at,
    uncertainties:body.uncertainties??safeParse(old.uncertainties_json)}
  };
  const a=normalizeArticle(merged);
  const update=env.DB.prepare(`UPDATE articles SET title=?,slug=?,excerpt=?,content_markdown=?,country=?,city=?,category_id=?,tags_json=?,sources_json=?,uncertainties_json=?,seo_title=?,seo_description=?,hero_image_url=?,hero_prompt=?,hero_alt=?,verified_at=?,updated_at=datetime('now'),review_approved=0,scheduled_at=CASE WHEN status IN ('published','scheduled') THEN NULL ELSE scheduled_at END,status=CASE WHEN status IN ('published','scheduled') THEN 'review' ELSE status END WHERE id=?`)
   .bind(a.title,a.slug,a.excerpt,a.content_markdown,a.country,a.city,a.category_id,a.tags_json,a.sources_json,a.uncertainties_json,a.seo_title,a.seo_description,a.hero_image_url,a.hero_prompt,a.hero_alt,a.verified_at,id);
  const editAudit=env.DB.prepare('INSERT INTO audit_logs (id,actor,action,article_id,details) VALUES (?,?,?,?,?)')
   .bind(crypto.randomUUID(),actor,'edited',id,'');
  await env.DB.batch([update,editAudit]);
  return json({ok:true});
 }
 if(pathname==='/api/admin/media' && method==='POST'){
  if(!env.MEDIA)return json({error:'R2 not configured; follow README to enable uploads'},503);
  const type=request.headers.get('content-type')||'';
  if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Upload JPEG, PNG or WebP only'},415);
  const bytes=await readImageWithinLimit(request,5*1024*1024);
  const signature=bytes.slice(0,12);
  const valid=type==='image/png'&&[137,80,78,71,13,10,26,10].every((byte,index)=>signature[index]===byte)
   ||type==='image/jpeg'&&signature[0]===255&&signature[1]===216&&signature[2]===255
   ||type==='image/webp'&&String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP';
  if(!valid)return json({error:'Image bytes do not match content type'},415);
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];
  const key='editorial/'+crypto.randomUUID()+'.'+ext;
  await env.MEDIA.put(key,bytes.buffer,{httpMetadata:{contentType:type}});
  await audit(env,actor,'uploaded-image',null,key);
  return json({url:siteURL(env)+'/media/'+key});
 }
 return json({error:'API endpoint not found'},404);
}
async function media(env,key){
 if(!env.MEDIA)return new Response('Not found',{status:404});
 if(!/^editorial\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key))return new Response('Not found',{status:404});
 const asset=await env.MEDIA.get(key);
 if(!asset)return new Response('Not found',{status:404});
 return new Response(asset.body,{headers:{'content-type':asset.httpMetadata?.contentType||'image/webp','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}});
}
async function publishDue(env){
 if(!env.DB)return;
 // Publish only records manually approved and explicitly scheduled. Idempotent conditional update.
 await env.DB.prepare("UPDATE articles SET status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE status='scheduled' AND review_approved=1 AND julianday(scheduled_at)<=julianday('now') AND json_array_length(sources_json)>0 AND EXISTS (SELECT 1 FROM audit_logs l WHERE l.article_id=articles.id AND ((l.action='reviewed-and-scheduled' AND json_valid(l.details) AND length(json_extract(CASE WHEN json_valid(l.details) THEN l.details ELSE '{}' END,'$.evidence_note'))>=30) OR (l.action='owner-reviewed-and-scheduled' AND json_valid(l.details) AND json_extract(CASE WHEN json_valid(l.details) THEN l.details ELSE '{}' END,'$.review_confirmed')=1)))").run();
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try {
   // This public entry point is outside the legacy Cloudflare Access /admin* path.
   if(path==='/sign-in.html')return privateRedirect(new URL('/sign-in',url));
   if(path==='/sign-in' && request.method==='GET'){
    if(!isLoginConfigured(env))return html('<h1>Admin login is not set up.</h1><p>Set the ADMIN_LOGIN_KEY secret in Cloudflare Worker settings before signing in.</p>',503,{'cache-control':'no-store'});
    if(await hasAdminSession(request,env))return privateRedirect(new URL('/admin',url));
    const asset=await env.ASSETS.fetch(new Request(new URL('/sign-in.html',url),request));
    const headers=new Headers(asset.headers);
    headers.set('cache-control','private, no-store');
    headers.set('referrer-policy','no-referrer');
    headers.set('x-frame-options','DENY');
    headers.set('permissions-policy',SITE_PERMISSIONS);
    headers.set('content-security-policy',"default-src 'none'; base-uri 'none'; frame-ancestors 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; form-action 'self'");
    return new Response(asset.body,{status:asset.status,headers});
   }
   if(path==='/api/auth/login'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    requireSameOrigin(request);
    if(!isLoginConfigured(env))return json({error:'Admin login is not configured'},503);
    if(Number(request.headers.get('Content-Length')||0)>1024)return json({error:'Request too large'},413);
    const actor=await checkLoginThrottle(request,env);
    let payload;
    try {
      const raw=await request.text();
      if(raw.length>1024)return json({error:'Request too large'},413);
      payload=JSON.parse(raw);
    }catch{return json({error:'Invalid JSON body'},400);}
    if(!await checkLoginKey(payload?.key,env)){
      await recordLoginFailure(env,actor);
      return json({error:'Incorrect key'},401);
    }
    return new Response(JSON.stringify({ok:true}),{
      status:200,headers:{'content-type':'application/json; charset=utf-8','set-cookie':await createAdminSession(env),
        'cache-control':'no-store','x-content-type-options':'nosniff'}
    });
   }
   if(path==='/api/auth/logout'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    requireSameOrigin(request);
    return new Response(JSON.stringify({ok:true}),{
      status:200,headers:{'content-type':'application/json; charset=utf-8','set-cookie':clearAdminSession(),
       'cache-control':'no-store','x-content-type-options':'nosniff'}
    });
   }
   // Private previews require the same signed admin cookie as the dashboard.
   const previewMatch=path.match(/^\/admin\/preview\/([a-f0-9-]{36})$/);
   if(previewMatch){
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    return previewGuidePage(request,env,previewMatch[1]);
   }
   if(path.startsWith('/admin/preview/'))return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
   if(path==='/admin'||path==='/admin.html'||path.startsWith('/admin/')){
    if(!isLoginConfigured(env))return html('<h1>Admin login is not set up.</h1><p>Set the ADMIN_LOGIN_KEY secret in Cloudflare Worker settings before opening this page.</p>',503,{'cache-control':'no-store'});
    if(!await hasAdminSession(request,env))return privateRedirect(new URL('/sign-in',url));
    const asset=await env.ASSETS.fetch(new Request(new URL('/admin.html',url),request));
    const headers=new Headers(asset.headers);
    headers.set('cache-control','private, no-store');
    headers.set('referrer-policy','no-referrer');
    headers.set('x-frame-options','DENY');
    headers.set('content-security-policy',SITE_CSP);
    headers.set('permissions-policy',SITE_PERMISSIONS);
    return new Response(asset.body,{status:asset.status,headers});
   }
   if(path.startsWith('/api/'))return await api(request,env,url);
   if(path.startsWith('/media/'))return await media(env,path.slice(7));
   if(path==='/')return await homepage(env);
   if(path==='/about'||path==='/privacy'||path==='/contact')return staticPage(env,path.slice(1));
   if(path==='/search')return await searchPage(env,url);
   if(path==='/southeast-asia')return await southeastAsiaPage(env);
    if(path==='/destinations')return await destinationIndexPage(env);
   if(path.startsWith('/destinations/'))return await destinationPage(env,decodeURIComponent(path.split('/')[2]||''));
   if(path.startsWith('/guides/'))return await guidePage(env,decodeURIComponent(path.split('/')[2]||''));
   if(path==='/health'){
    if(!env.DB) return json({status:'not-ready',database:'unbound'},503);
    try {await env.DB.prepare("SELECT COUNT(*) total FROM articles").first();
      return json({status:'ok',database:'ready'});}
    catch {return json({status:'not-ready',database:'schema-missing'},503);}
   }
   if(path==='/robots.txt'){
    return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /sign-in\nDisallow: /api/\nSitemap: '+siteURL(env)+'/sitemap.xml\n',
      {headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'}});
   }
   if(path==='/sitemap.xml'){
    const rows=env.DB?(await env.DB.prepare("SELECT slug,updated_at,published_at FROM articles WHERE status='published' AND published_at<=datetime('now') LIMIT 40000").all()).results:[];
    const countries=env.DB?(await env.DB.prepare("SELECT DISTINCT country FROM articles WHERE status='published' AND published_at<=datetime('now')").all()).results:[];
    const hasContact=Boolean(editorialEmail(env))&&env.EDITORIAL_CONTACT_VERIFIED==='true';
    return new Response(sitemapXML(siteURL(env),rows,countries,hasContact,countries.some(row=>isSoutheastAsia(row.country))),{
     headers:{'content-type':'application/xml;charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}
    });
   }
   const asset=await env.ASSETS.fetch(request);
   if(asset.status!==404)return asset;
   return html(layout(env,'Not found','<main class="shell simple"><h1>We took a wrong turn.</h1><p>This page is not available.</p><a href="/">← Back home</a></main>',{noindex:true}),404,{'cache-control':'no-store','x-robots-tag':'noindex'});
  }catch(e){
   const status=e.status||500;
   if(path.startsWith('/api/'))return json({error:status<500?e.message:'Server error'},status);
   if(path.startsWith('/admin'))return new Response(status===503?'Configure ADMIN_LOGIN_KEY before opening /admin.':'Unauthorized',{status,headers:{'cache-control':'no-store'}});
   console.error(e);
   return html(layout(env,'Something went wrong','<main class="shell simple"><h1>Temporary detour</h1><p>We could not load this page. Try again shortly.</p><a href="/">Back home ↗</a></main>',{noindex:true}),500,{'cache-control':'no-store','x-robots-tag':'noindex'});
  }
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(publishDue(env));}
};
