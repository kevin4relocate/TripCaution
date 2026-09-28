
import {
  isLoginConfigured, requireSameOrigin, checkLoginKey,
  createAdminSession, clearAdminSession, hasAdminSession,
  requireKeySession, checkLoginThrottle, recordLoginFailure
} from './auth.js';
import { normalizeArticle, STATUSES, CATEGORIES, isValidSchedule, slugify } from './content.js';
import { STARTER_DESTINATIONS, groupDestinationsByContinent } from './destinations.js';

const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe = (url) => { try {const u=new URL(url);return u.protocol==='https:'?u.href:null;} catch{return null;} };
const safeParse = (value, fallback=[]) => {try {return JSON.parse(value);}catch{return fallback;}};
const link = (href,text,cls='') => '<a href="'+esc(href)+'" class="'+cls+'">'+esc(text)+'</a>';
const siteURL = env => (env.SITE_URL||'https://tripcaution.com').replace(/\/$/,'');
const nav = '<a href="/destinations">Destinations</a><a href="/#latest">Field notes</a><a href="/about">About</a>';
function layout(env, title, body, meta={}) {
 const description=meta.description||'Evidence-led travel precautions and practical guides. Know before you go.';
 const url=siteURL(env)+(meta.path||'/');
 const image=safe(meta.image);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${esc(title)} | TripCaution</title><meta name="description" content="${esc(description)}">${meta.noindex?'<meta name="robots" content="'+(meta.preview?'noindex,nofollow,noarchive':'noindex,follow')+'">':''}
 ${meta.preview?'':'<link rel="canonical" href="'+esc(url)+'">'}<meta property="og:title" content="${esc(title)} | TripCaution">
 <meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website">
 ${image?'<meta property="og:image" content="'+esc(image)+'">':''}
 <link rel="stylesheet" href="/styles.css"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
 </head><body${meta.preview?' class="private-preview"':''}><header class="header"><div class="shell nav-wrap"><a class="brand" href="/" aria-label="TripCaution homepage"><span class="brand-mark">!</span>TRIP<span>CAUTION</span></a>
 <nav aria-label="Main navigation">${nav}</nav><a href="/#destinations" class="header-cta">Explore <span>↗</span></a></div></header>
 ${body}<footer><div class="shell footer-grid"><div><div class="footer-brand">TRIP<span>CAUTION</span><span class="tiny-star"> ✳</span></div>
 <p>Know before you go. Independent travel information with linked sources. Not an emergency alert service.</p></div>
 <div><strong>EXPLORE</strong><a href="/destinations">Destinations</a><a href="/#latest">Latest guides</a></div>
 <div><strong>INFORMATION</strong><a href="/about">About & editorial policy</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a></div>
 </div><div class="shell foot-bottom"><span>© ${new Date().getUTCFullYear()} TripCaution</span><span>Travel prepared. Travel curious.</span></div></footer></body></html>`;
}
function html(content,status=200,headers={}) {return new Response(content,{status,headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff',...headers}});}
const utc = str => str?new Date(str).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'Not yet verified';
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
async function homepage(env){
 let latest=[],countryRows=[],count=0;
 if(env.DB) {
  const [a,c,n] = await Promise.all([
   env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' AND a.published_at<=datetime('now') ORDER BY a.published_at DESC LIMIT 9").all(),
   env.DB.prepare("SELECT country,COUNT(*) total FROM articles WHERE status='published' AND published_at<=datetime('now') GROUP BY country ORDER BY country COLLATE NOCASE ASC LIMIT 250").all(),
   env.DB.prepare("SELECT COUNT(*) count FROM articles WHERE status='published' AND published_at<=datetime('now')").first()
  ]);
  latest=a.results;countryRows=c.results;count=n?.count||0;
 }
 const publishedCountries=countryRows.filter(row=>row.country && Number(row.total)>0);
 const feature=latest.slice(0,3);
 const additional=latest.slice(3,9);
 const readyHints=publishedCountries.slice(0,3);
 const body=`<main>
 <section class="hero home-hero"><div class="shell hero-inner"><div class="hero-content">
   <div class="hero-label"><span class="label-line"></span> THE INDEPENDENT TRAVEL FIELD GUIDE <span class="hero-label-star">✳</span></div>
   <h1>Go somewhere new.<br><em>Know what to avoid.</em></h1>
   <p class="hero-description">Curious about a place? Discover practical travel checks and source-backed guidance — before you pack.</p>
   <form class="destination-search" action="/search" method="get">
     <label class="sr-only" for="q">Search destinations and guides</label><span class="search-icon" aria-hidden="true">⌕</span>
     <input id="q" type="search" name="q" placeholder="Country, city or topic..." required maxlength="80">
     <button type="submit">Find a guide <span aria-hidden="true">↗</span></button>
   </form>
   <div class="search-hints"><span>${readyHints.length?'READ ABOUT':'EXPLORE'}</span>${readyHints.length?readyHints.map(row=>link('/destinations/'+slugify(row.country),row.country)).join(''):link('/destinations','All destinations')}</div>
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
   <div class="section-heading"><div><div class="eyebrow">02 — EXPLORE BY DESTINATION</div>
     <h2>Where to <em>next?</em></h2>
     <p>Start with a destination that already has published guides.</p></div>
     <a class="section-action" href="/destinations">View all destinations <span aria-hidden="true">↗</span></a>
   </div>
   ${publishedCountries.length?
     '<div class="ready-destinations">'+publishedCountries.slice(0,8).map(row=>
      '<a class="ready-destination" href="/destinations/'+slugify(row.country)+'"><strong>'+esc(row.country)+'</strong><span>'+row.total+' '+(row.total===1?'guide':'guides')+' <span aria-hidden="true">↗</span></span></a>'
     ).join('')+'</div>':
     '<p class="destination-pending-note">The destination library is growing; browse the planned places below.</p>'}
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
async function destinationIndexPage(env){
 const rows=env.DB?(await env.DB.prepare("SELECT country,COUNT(*) total FROM articles WHERE status='published' AND published_at<=datetime('now') GROUP BY country ORDER BY country COLLATE NOCASE ASC LIMIT 250").all()).results:[];
 const countByCountry=new Map(rows.map(row=>[row.country.toLocaleLowerCase('en'),Number(row.total)]));
 const groups=groupDestinationsByContinent([...STARTER_DESTINATIONS,...rows.map(row=>row.country)]);
 const body=`<main>
 <section class="destination-hero"><div class="shell"><a href="/" class="backlink">← Back to the latest guides</a>
   <div class="eyebrow">TRIPCAUTION / FULL DESTINATION INDEX</div>
   <h1>Everywhere we're <em>exploring.</em></h1>
   <p>Places with published guides are ready to read. The rest are on our research list.</p>
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
 if(!country)return html(layout(env,'Destination not found','<main class="shell simple"><h1>We could not find that destination.</h1><a href="/">Explore destinations ↗</a></main>'),404);
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
function renderInline(s){
 let out=esc(s);
 out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
 out=out.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,(_full,label,url)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer nofollow">'+label+'</a>');
 return out;
}
function markdown(md) {
 const lines=String(md||'').split(/\r?\n/), chunks=[]; let list=false;
 for(const line of lines){
  if(/^\s*[-*] /.test(line)){if(!list){chunks.push('<ul>');list=true;}chunks.push('<li>'+renderInline(line.replace(/^\s*[-*] /,''))+'</li>');continue;}
  if(list){chunks.push('</ul>');list=false;}
  if(/^### /.test(line))chunks.push('<h3>'+renderInline(line.slice(4))+'</h3>');
  else if(/^## /.test(line))chunks.push('<h2>'+renderInline(line.slice(3))+'</h2>');
  else if(/^# /.test(line))chunks.push('<h2>'+renderInline(line.slice(2))+'</h2>');
  else if(/^> /.test(line))chunks.push('<blockquote>'+renderInline(line.slice(2))+'</blockquote>');
  else if(line.trim())chunks.push('<p>'+renderInline(line.trim())+'</p>');
 }
 if(list)chunks.push('</ul>');
 return chunks.join('');
}
function renderGuideArticle(env,a,preview=false,reviewedAt=null){
 const sources=safeParse(a.sources_json).filter(s=>safe(s.url));
 const publicDate=a.published_at?'Published: '+esc(utc(a.published_at)):'Editorial preview';
 const reviewDate=reviewedAt?'Last reviewed: '+esc(utc(reviewedAt)):null;
 const reviewMeta=reviewDate?'<span class="article-reviewed">'+reviewDate+'</span>':'';
 const researchNote=a.verified_at?'Research reference date: '+esc(utc(a.verified_at))+'. Recheck time-sensitive details using the linked sources.':'This guide has no recorded research reference date.';
 const body=`<main><div class="article-top"><div class="shell article-head"><a href="/destinations/${slugify(a.country)}" class="backlink">← ${esc(a.country)} guides</a><div class="eyebrow">${esc(a.country.toUpperCase())}${a.city?' / '+esc(a.city.toUpperCase()):''} / ${esc((a.category_name||'GUIDE').toUpperCase())}</div><h1>${esc(a.title)}</h1><p class="article-deck">${esc(a.excerpt)}</p>
 <div class="article-meta"><span>TRIPCAUTION EDITORIAL</span><span>${publicDate}</span>${reviewMeta}<span>${sources.length} SOURCES</span></div></div></div>
 <div class="shell article-wrap"><article class="article-content">${safe(a.hero_image_url)?'<figure class="hero-image"><img src="'+esc(a.hero_image_url)+'" alt="'+esc(a.hero_alt||'Editorial illustration')+'"><figcaption>AI-generated editorial illustration; not a photograph or evidence of an incident.</figcaption></figure>':''}
 <div class="article-notice"><strong>✳ A note on our approach</strong><p>TripCaution shares researched precautions, not personal eyewitness accounts. Conditions change; confirm important guidance with official authorities before traveling.</p></div>
 <div class="prose">${markdown(a.content_markdown)}</div><section class="sources"><h2>Sources & verification</h2><p>Always consult the source directly for the latest information.</p>${sources.length?'<ol>'+sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer nofollow">'+esc(s.title)+'</a><small>'+esc(s.publisher||'Source')+(s.published_at?' · '+esc(s.published_at):'')+'</small></li>').join('')+'</ol>':'<p>Editorial sources are pending publication.</p>'}
 <p class="verified research-date-note">${reviewedAt?'<strong>Last editorial review: '+esc(utc(reviewedAt))+'.</strong> ':''}${researchNote}</p></section></article>
 <aside class="article-aside"><div class="aside-card"><span>THE QUICK TAKE</span><h3>Keep exploring.<br><em>Stay informed.</em></h3><p>Travel is better when you know what to expect.</p><a href="/destinations/${slugify(a.country)}">More in ${esc(a.country)} ↗</a></div><div class="aside-share">SHARE THIS GUIDE <button type="button" onclick="navigator.clipboard.writeText(location.href).then(()=>this.textContent='Copied!')">Copy link ↗</button></div></aside></div></main>`;
 const previewBanner=preview?`<aside class="editorial-preview-banner" role="note"><div class="shell editorial-preview-inner"><div><strong>PRIVATE PREVIEW · ${a.status==='published'?'CURRENTLY LIVE':'NOT PUBLISHED'}</strong><p>This is the last SAVED version, shown in the public article layout. Verify all claims, source links, dates and images before approval. This URL only works when signed in.</p></div><a href="/admin?edit=${encodeURIComponent(a.id)}">← Back to editor</a></div></aside>`:'';
 const page=layout(env,a.seo_title||a.title,previewBanner+body,{path:'/guides/'+a.slug,description:a.seo_description||a.excerpt,image:a.hero_image_url,noindex:preview,preview});
 return html(page,200,preview?{'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer','x-frame-options':'DENY'}:{'cache-control':'public, max-age=60'});
}
async function latestEditorialReview(env,id){
 if(!env.DB)return null;
 const audit=(await env.DB.prepare("SELECT created_at FROM audit_logs WHERE article_id=? AND action IN ('reviewed-and-published','reviewed-and-scheduled') ORDER BY created_at DESC LIMIT 1").bind(id).first());
 return audit?.created_at||null;
}
async function guidePage(env,slug){
 const a=env.DB?await env.DB.prepare("SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.slug=? AND a.status='published' AND a.published_at<=datetime('now') LIMIT 1").bind(slug).first():null;
 if(!a)return html(layout(env,'Guide unavailable','<main class="shell simple"><h1>Guide not found.</h1><a href="/">Browse destinations ↗</a></main>'),404);
 return renderGuideArticle(env,a,false,await latestEditorialReview(env,a.id));
}
async function previewGuidePage(request,env,id){
 if(!isLoginConfigured(env))return html('<h1>Admin login is not configured.</h1>',503,{'cache-control':'no-store'});
 if(!await hasAdminSession(request,env))return Response.redirect(new URL('/sign-in',request.url),302);
 if(!env.DB)return html('<h1>Database unavailable.</h1>',503,{'cache-control':'no-store'});
 const a=await env.DB.prepare('SELECT a.*,c.name category_name FROM articles a LEFT JOIN categories c ON c.id=a.category_id WHERE a.id=? LIMIT 1').bind(id).first();
 if(!a || a.status==='deleted')return html('<h1>Preview unavailable.</h1>',404,{'cache-control':'private, no-store','x-robots-tag':'noindex'});
 return renderGuideArticle(env,a,true,await latestEditorialReview(env,a.id));
}
function editorialEmail(env) {
 const email=String(env.EDITORIAL_CONTACT_EMAIL||'').trim();
 return /^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(email)?email:null;
}
function staticPage(env,type){
 const email=editorialEmail(env);
 const contact=email?'<a class="editorial-email" href="mailto:'+esc(email)+'?subject=TripCaution%20correction">'+esc(email)+'</a>':
   '<strong class="contact-not-ready">The editorial inbox has not been configured yet. This site is completing pre-launch setup.</strong>';
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
 return html(layout(env,title,'<main class="shell simple editorial-policy"><div class="eyebrow">TRIPCAUTION / INFORMATION</div><h1>'+esc(title)+'</h1>'+body+'<a class="backlink" href="/">← Back home</a></main>',{path:'/'+type,noindex:type==='contact'&&!email}),200,{'cache-control':'public,max-age=300'});
}
async function searchPage(env,url){
 const q=String(url.searchParams.get('q')||'').slice(0,80).trim();
 const known=[...STARTER_DESTINATIONS,'Bangkok'];
 const exact=known.find(x=>x.toLocaleLowerCase('en')===q.toLocaleLowerCase('en'));
 if(exact) return Response.redirect(url.origin+'/destinations/'+slugify(exact),302);
 const matches=q?known.filter(x=>x.toLocaleLowerCase('en').includes(q.toLocaleLowerCase('en'))):[];
 const rows=q&&env.DB?(await env.DB.prepare("SELECT * FROM articles WHERE status='published' AND published_at<=datetime('now') AND (title LIKE ? OR country LIKE ? OR city LIKE ?) ORDER BY published_at DESC LIMIT 30").bind(...Array(3).fill('%'+q+'%')).all()).results:[];
 const destinations=matches.length?`<section class="search-destinations"><h2>Matching destinations</h2><div class="destination-grid">${matches.map(x=>`<a class="destination-tile" href="/destinations/${slugify(x)}"><span class="destination-name">${esc(x)}</span><span class="destination-arrow" aria-hidden="true">↗</span></a>`).join('')}</div></section>`:'';
 const details=rows.length?`<p>${rows.length} published ${rows.length===1?'guide':'guides'}</p><div class="guide-grid">${rows.map(a=>articleCard(a)).join('')}</div>`:`<p>${q?'No published guides found for that query yet. Try one of the destinations above.':'Enter a country, city or topic to start searching.'}</p>`;
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
 await env.DB.prepare(`INSERT INTO articles(id,title,slug,excerpt,content_markdown,country,city,category_id,tags_json,sources_json,uncertainties_json,seo_title,seo_description,hero_image_url,hero_prompt,hero_alt,status,source_mode,review_approved,verified_at,published_at,scheduled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 .bind(a.id,a.title,a.slug,a.excerpt,a.content_markdown,a.country,a.city,a.category_id,a.tags_json,a.sources_json,a.uncertainties_json,a.seo_title,a.seo_description,a.hero_image_url,a.hero_prompt,a.hero_alt,status,a.source_mode,0,a.verified_at,published,a.scheduled_at).run();
 await audit(env,actor,'created:'+status,a.id);
 return {id:a.id,title:a.title,slug:a.slug,status};
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
  const rows=await env.DB.prepare("SELECT id,title,slug,country,city,category_id,status,source_mode,verified_at,scheduled_at,published_at,updated_at FROM articles ORDER BY created_at DESC LIMIT 300").all();
  return json({articles:rows.results});
 }
 if(method==='GET' && pathname==='/api/admin/categories'){
  return json({categories:(await env.DB.prepare('SELECT * FROM categories ORDER BY name').all()).results});
 }
 if(method==='GET' && pathname.startsWith('/api/admin/article/')){
  const a=await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(pathname.split('/').pop()).first();
  return a?json({article:a}):json({error:'Not found'},404);
 }
 if(method==='POST' && pathname==='/api/admin/auto-schedule'){
  // Legacy batch route: only previously reviewed and approved records may enter the schedule.
  const eligible=(await env.DB.prepare("SELECT id,category_id,sources_json,verified_at,scheduled_at FROM articles WHERE status='review' AND review_approved=1 AND category_id IN ('before-you-go','etiquette') ORDER BY created_at ASC LIMIT 30").all()).results
   .filter(a=>safeParse(a.sources_json).length>=2 && Boolean(a.verified_at));
  const existing=(await env.DB.prepare("SELECT scheduled_at FROM articles WHERE status='scheduled'").all()).results;
  const occupied=new Set(existing.filter(x=>x.scheduled_at).map(x=>x.scheduled_at.slice(0,10)));
  let cursor=new Date();cursor.setUTCDate(cursor.getUTCDate()+1);cursor.setUTCHours(2,0,0,0);
  const results=[];
  for(const article of eligible) {
   // Prefer an imported publication date when available and unoccupied, otherwise next open daily slot.
   let date=article.scheduled_at&&isValidSchedule(article.scheduled_at)&&Date.parse(article.scheduled_at)>Date.now()
     ?new Date(article.scheduled_at):new Date(cursor);
   if(occupied.has(date.toISOString().slice(0,10)))date=new Date(cursor);
   while(occupied.has(date.toISOString().slice(0,10))){date.setUTCDate(date.getUTCDate()+1);date.setUTCHours(2,0,0,0);}
   const iso=date.toISOString();
   await env.DB.prepare("UPDATE articles SET status='scheduled',review_approved=1,scheduled_at=?,updated_at=datetime('now') WHERE id=? AND status='review'").bind(iso,article.id).run();
   occupied.add(iso.slice(0,10));results.push({id:article.id,scheduled_at:iso});
   await audit(env,actor,'bulk-approved-and-scheduled',article.id);
  }
  return json({scheduled:results,skipped_sensitive_or_insufficient_evidence:true});
 }
 if(method==='GET' && pathname==='/api/admin/overview'){
  const status=(await env.DB.prepare("SELECT status,COUNT(*) count FROM articles GROUP BY status").all()).results;
  const auditLogs=(await env.DB.prepare("SELECT action,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8").all()).results;
  return json({status,auditLogs});
 }
 if(method==='POST' && (pathname==='/api/ingest'||pathname==='/api/admin/import')){
  const body=await request.json();
  const list=Array.isArray(body.articles)?body.articles:[body];
  if(list.length<1||list.length>30)return json({error:'Import requires 1–30 articles'},400);
  const results=[];
  for(const entry of list){try{results.push({ok:true,...await insertArticle(env,entry,actor)});}catch(e){results.push({ok:false,error:e.message,title:entry?.title||''});}}
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
   if(!['publish','schedule','hide','archive','delete','restore','review'].includes(action))return json({error:'Unknown action'},400);
   const target={publish:'published',schedule:'scheduled',hide:'hidden',archive:'archived',delete:'deleted',restore:'draft',review:'review'}[action];
   if(['publish','schedule'].includes(action)){
    // There is no automated bypass. A human editor must explicitly confirm
    // all four checks and supply a brief source-claim review record.
    const checks=body.review_checklist||{};
    const expected=['layout','evidence','freshness','fairness'];
    const note=typeof body.review_note==='string'?body.review_note.trim():'';
    if(body.review_confirmed!==true || !expected.every(key=>checks[key]===true) ||
       note.length<30 || note.length>1500 || ![7,30,90].includes(body.review_window_days))
      return json({error:'Complete all review checks, add a 30–1500 character evidence note and select a review interval'},422);
    if(safeParse(old.sources_json).length<1 || !old.verified_at)
      return json({error:'Research reference timestamp and evidence sources are required'},422);
    if(action==='schedule' && (!isValidSchedule(body.scheduled_at)||Date.parse(body.scheduled_at)<Date.now()))
      return json({error:'Provide a future ISO 8601 scheduled_at with timezone'},422);
   }
   await env.DB.prepare("UPDATE articles SET status=?,review_approved=?,scheduled_at=?,published_at=CASE WHEN ?='published' THEN datetime('now') ELSE published_at END,updated_at=datetime('now') WHERE id=?")
    .bind(target,['publish','schedule'].includes(action)?1:old.review_approved,target==='scheduled'?body.scheduled_at:null,target,id).run();
   const auditAction=body.review_confirmed===true && action==='publish'?'reviewed-and-published':
    body.review_confirmed===true && action==='schedule'?'reviewed-and-scheduled':action;
   const reviewDetails=['publish','schedule'].includes(action)?
    JSON.stringify({checklist:body.review_checklist,evidence_note:body.review_note.trim(),
      review_window_days:body.review_window_days,editor_reviewed_at:new Date().toISOString(),
      next_review_due_at:new Date(Date.now()+body.review_window_days*86400000).toISOString()}):'';
   await audit(env,actor,auditAction,id,reviewDetails);return json({ok:true,status:target});
  }
  const merged={
   ...old,...body,seo_title:body.seo_title??old.seo_title,seo_description:body.seo_description??old.seo_description,
   sources:body.sources??safeParse(old.sources_json),tags:body.tags??safeParse(old.tags_json),
   research:{verified_at:body.verified_at??old.verified_at,uncertainties:safeParse(old.uncertainties_json)}
  };
  const a=normalizeArticle(merged);
  await env.DB.prepare(`UPDATE articles SET title=?,slug=?,excerpt=?,content_markdown=?,country=?,city=?,category_id=?,tags_json=?,sources_json=?,seo_title=?,seo_description=?,hero_image_url=?,hero_prompt=?,hero_alt=?,verified_at=?,updated_at=datetime('now'),review_approved=0,scheduled_at=CASE WHEN status IN ('published','scheduled') THEN NULL ELSE scheduled_at END,status=CASE WHEN status IN ('published','scheduled') THEN 'review' ELSE status END WHERE id=?`)
  .bind(a.title,a.slug,a.excerpt,a.content_markdown,a.country,a.city,a.category_id,a.tags_json,a.sources_json,a.seo_title,a.seo_description,a.hero_image_url,a.hero_prompt,a.hero_alt,a.verified_at,id).run();
  await audit(env,actor,'edited',id);return json({ok:true});
 }
 if(pathname==='/api/admin/media' && method==='POST'){
  if(!env.MEDIA)return json({error:'R2 not configured; follow README to enable uploads'},503);
  const type=request.headers.get('content-type')||'';
  if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Upload JPEG, PNG or WebP only'},415);
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>5*1024*1024)return json({error:'Image exceeds 5 MB'},413);
  const signature=new Uint8Array(bytes.slice(0,12));
  const valid=type==='image/png'&&signature[0]===137&&signature[1]===80
   ||type==='image/jpeg'&&signature[0]===255&&signature[1]===216
   ||type==='image/webp'&&String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP';
  if(!valid)return json({error:'Image bytes do not match content type'},415);
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];
  const key='editorial/'+crypto.randomUUID()+'.'+ext;
  await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type}});
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
 await env.DB.prepare("UPDATE articles SET status='published',published_at=datetime('now'),updated_at=datetime('now') WHERE status='scheduled' AND review_approved=1 AND julianday(scheduled_at)<=julianday('now') AND verified_at IS NOT NULL AND json_array_length(sources_json)>0").run();
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try {
   // This public entry point is outside the legacy Cloudflare Access /admin* path.
   if(path==='/sign-in.html')return Response.redirect(new URL('/sign-in',url),302);
   if(path==='/sign-in' && request.method==='GET'){
    if(!isLoginConfigured(env))return html('<h1>Admin login is not set up.</h1><p>Set the ADMIN_LOGIN_KEY secret in Cloudflare Worker settings before signing in.</p>',503,{'cache-control':'no-store'});
    if(await hasAdminSession(request,env))return Response.redirect(new URL('/admin',url),302);
    const asset=await env.ASSETS.fetch(new Request(new URL('/sign-in.html',url),request));
    const headers=new Headers(asset.headers);
    headers.set('cache-control','private, no-store');
    headers.set('referrer-policy','no-referrer');
    headers.set('x-frame-options','DENY');
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
    if(!await hasAdminSession(request,env))return Response.redirect(new URL('/sign-in',url),302);
    const asset=await env.ASSETS.fetch(new Request(new URL('/admin.html',url),request));
    const headers=new Headers(asset.headers);
    headers.set('cache-control','private, no-store');
    headers.set('referrer-policy','no-referrer');
    headers.set('x-frame-options','DENY');
    return new Response(asset.body,{status:asset.status,headers});
   }
   if(path.startsWith('/api/'))return await api(request,env,url);
   if(path.startsWith('/media/'))return await media(env,path.slice(7));
   if(path==='/')return await homepage(env);
   if(path==='/about'||path==='/privacy'||path==='/contact')return staticPage(env,path.slice(1));
   if(path==='/search')return await searchPage(env,url);
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
    const rows=env.DB?(await env.DB.prepare("SELECT slug,updated_at FROM articles WHERE status='published' AND published_at<=datetime('now') LIMIT 40000").all()).results:[];
    const urls=['/','/about','/destinations',...rows.map(x=>'/guides/'+encodeURIComponent(x.slug))];
    const countries=env.DB?(await env.DB.prepare("SELECT DISTINCT country FROM articles WHERE status='published'").all()).results:[];
    urls.push(...countries.map(x=>'/destinations/'+slugify(x.country)));
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(p=>'<url><loc>'+esc(siteURL(env)+p)+'</loc></url>').join('')+'</urlset>',{headers:{'content-type':'application/xml;charset=utf-8'}});
   }
   const asset=await env.ASSETS.fetch(request);
   if(asset.status!==404)return asset;
   return html(layout(env,'Not found','<main class="shell simple"><h1>We took a wrong turn.</h1><p>This page is not available.</p><a href="/">← Back home</a></main>'),404);
  }catch(e){
   const status=e.status||500;
   if(path.startsWith('/api/'))return json({error:status<500?e.message:'Server error'},status);
   if(path.startsWith('/admin'))return new Response(status===503?'Configure ADMIN_LOGIN_KEY before opening /admin.':'Unauthorized',{status,headers:{'cache-control':'no-store'}});
   console.error(e);
   return html(layout(env,'Something went wrong','<main class="shell simple"><h1>Temporary detour</h1><p>We could not load this page. Try again shortly.</p><a href="/">Back home ↗</a></main>'),500);
  }
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(publishDue(env));}
};
