
const $=id=>document.getElementById(id);
const state={articles:[],categories:[],selected:null,dirty:false,previewOpened:false};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},credentials:'same-origin'});
 const data=await response.json().catch(()=>({error:'Invalid server response'}));
 if(response.status===401){window.location.replace('/sign-in');throw Error('Please sign in again');}
 if(!response.ok && response.status!==207)throw Error(data.error||'Request failed');
 return data;
}
function toast(message,error=false){const el=$('toast');el.textContent=message;el.className=error?'error':'';el.style.display='block';clearTimeout(el.timer);el.timer=setTimeout(()=>el.style.display='none',6500);}
function show(view){
 document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==view);
 document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 if(view==='calendar')renderQueue();
 if(view==='articles')renderArticles();
 window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>show(el.dataset.view)));
async function refresh(){
 const [items,overview,cat]=await Promise.all([
  api('/api/admin/articles'),api('/api/admin/overview'),api('/api/admin/categories')]);
 state.articles=items.articles;state.categories=cat.categories;
 const counts=Object.fromEntries(overview.status.map(s=>[s.status,s.count]));
 $('stats').innerHTML=[['Published',counts.published||0],['Needs review',counts.review||0],['Scheduled',counts.scheduled||0],['Drafts',counts.draft||0]]
  .map(([name,count])=>'<div class="stat"><small>'+escapeHTML(name.toUpperCase())+'</small><b>'+count+'</b><span>Article records</span></div>').join('');
 $('activities').innerHTML=overview.auditLogs.length?overview.auditLogs.map(log=>'<div>'+escapeHTML(log.action)+' <small>'+escapeHTML(log.created_at)+'</small></div>').join(''):'<p>No activity yet.</p>';
 $('edit-category').innerHTML=state.categories.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.name)+'</option>').join('');
 renderArticles();renderQueue();
}
function renderArticles(){
 const q=$('article-search').value.toLowerCase(),filter=$('article-filter').value;
 const rows=state.articles.filter(a=>(!filter||a.status===filter)&&(!q||[a.title,a.country,a.city].join(' ').toLowerCase().includes(q)));
 $('article-rows').innerHTML=rows.map(a=>{
  const published=a.status==='published';
  const link=published?'/guides/'+encodeURIComponent(a.slug):'/admin/preview/'+encodeURIComponent(a.id);
  const linkText=published?'View live ↗':'Preview ↗';
  const editText=a.status==='review'?'Review →':'Edit →';
  const statusLabel=a.status==='review'?'AWAITING YOUR REVIEW':a.status.toUpperCase();
  return '<tr><td><strong>'+escapeHTML(a.title)+'</strong><small>'+escapeHTML([a.city,a.country].filter(Boolean).join(', '))+'</small></td><td>'+escapeHTML(a.category_id)+'</td><td><span class="status '+escapeHTML(a.status)+'" title="'+escapeHTML(statusLabel)+'">'+escapeHTML(statusLabel)+'</span></td><td>'+escapeHTML(a.scheduled_at||a.published_at||'—')+'</td><td><div class="row-actions"><a class="preview-row-link" href="'+escapeHTML(link)+'" target="_blank" rel="noopener noreferrer">'+linkText+'</a><button type="button" class="review-row-btn edit-link" data-id="'+escapeHTML(a.id)+'">'+editText+'</button></div></td></tr>';
 }).join('')||'<tr><td colspan="5">No articles match this view.</td></tr>';
 document.querySelectorAll('.edit-link').forEach(btn=>btn.onclick=()=>loadArticle(btn.dataset.id));
}
function renderQueue(){
 const rows=state.articles.filter(a=>['review','scheduled','draft'].includes(a.status)).sort((a,b)=>(a.scheduled_at||'9999').localeCompare(b.scheduled_at||'9999'));
 $('queue').innerHTML=rows.map(a=>'<div><span class="status '+escapeHTML(a.status)+'">'+escapeHTML(a.status)+'</span> &nbsp; '+escapeHTML(a.scheduled_at||'Not scheduled')+' — <strong>'+escapeHTML(a.title)+'</strong><span class="queue-actions"><a href="/admin/preview/'+encodeURIComponent(a.id)+'" target="_blank" rel="noopener noreferrer">Preview ↗</a><button type="button" class="text-button queue-btn" data-id="'+escapeHTML(a.id)+'">Review →</button></span></div>').join('')||'<p>Your queue is clear.</p>';
 document.querySelectorAll('.queue-btn').forEach(btn=>btn.onclick=()=>loadArticle(btn.dataset.id));
}
$('article-search').addEventListener('input',renderArticles);
$('article-filter').addEventListener('change',renderArticles);
$('json-file').addEventListener('change',async ev=>{
 const file=ev.target.files[0];if(file){if(file.size>2_000_000){toast('JSON file is too large',true);return;}$('json-input').value=await file.text();}
});
$('import-btn').onclick=async()=>{
 try{
  const data=JSON.parse($('json-input').value);
  const result=await api('/api/admin/import',{method:'POST',body:JSON.stringify(data)});
  const ok=result.results.filter(r=>r.ok).length;
  $('import-result').textContent=ok+' imported, '+(result.results.length-ok)+' errors';
  const errors=result.results.filter(r=>!r.ok);
  if(errors.length)toast(errors.map(e=>e.title+': '+e.error).join(' | ').slice(0,600),true);
  else toast(ok+' articles imported. Review before publication.');
  await refresh();
 }catch(e){toast(e.message,true);}
};
const reviewChecks=[...document.querySelectorAll('[data-review-check]')];
const editorForm=$('article-form');
function safeSourceUrl(raw){
 try{const u=new URL(raw);return u.protocol==='https:'?u.href:null;}catch{return null;}
}
function updateReviewGate(){
 const a=state.selected,done=reviewChecks.filter(input=>input.checked).length;
 $('review-progress').textContent=done+' of '+reviewChecks.length+' checks complete';
 const sources=a?JSON.parse(a.sources_json||'[]').filter(s=>safeSourceUrl(s.url)):[];
 const hasEvidence=sources.length>0 && Boolean(a?.verified_at);
 const eligible=a && !['published','deleted','archived'].includes(a.status);
 const ready=Boolean(eligible && hasEvidence && !state.dirty && state.previewOpened && done===reviewChecks.length);
 $('review-publish-btn').disabled=!ready;
 $('publish-btn').disabled=!ready;
 $('schedule-btn').disabled=!ready;
 $('review-publish-btn').hidden=!eligible;
 $('review-guidance').textContent=!a?'Choose an article to start.'
   :state.dirty?'Unsaved changes: save your edits, reopen the preview and review the updated article.'
   :!hasEvidence?'Before publishing, add at least one HTTPS evidence source and a verified date, then save.'
   :!state.previewOpened?'Step 1: open the saved preview in a new tab and check it carefully.'
   :done<reviewChecks.length?'Complete the checklist only after independently verifying the article.'
   :eligible?'Ready for your final decision. You can publish now or select a future date below.':'This article is not awaiting publication.';
}
function populateReviewEvidence(a){
 const sources=JSON.parse(a.sources_json||'[]').filter(s=>safeSourceUrl(s.url));
 $('review-source-links').innerHTML=sources.length?sources.map(s=>
   '<a class="review-source" href="'+escapeHTML(safeSourceUrl(s.url))+'" target="_blank" rel="noopener noreferrer nofollow">'+
   escapeHTML(s.title||s.url)+' <span aria-hidden="true">↗</span></a>').join('')
   :'<p class="review-evidence-missing">No evidence sources yet. Add sources below and save first.</p>';
 $('review-evidence-status').textContent=sources.length+' HTTPS source'+(sources.length===1?'':'s')+' saved. Open each one to verify its claims.';
 $('review-verified-note').textContent=a.verified_at?'Last marked verified: '+a.verified_at+' (recheck time-sensitive details).':'Missing verification date. Add a current UTC timestamp below.';
 $('editor-preview-link').href='/admin/preview/'+encodeURIComponent(a.id);
}
$('editor-preview-link').addEventListener('click',event=>{
 if(!state.selected){event.preventDefault();return;}
 if(state.dirty && !confirm('You have unsaved changes. Preview only shows the last saved version. Open it anyway?')){event.preventDefault();return;}
 state.previewOpened=true;updateReviewGate();
});
reviewChecks.forEach(input=>input.addEventListener('change',updateReviewGate));
editorForm.addEventListener('input',event=>{
 if(!state.selected || event.target.id==='schedule-date' || event.target.id==='image-file')return;
 state.dirty=true;state.previewOpened=false;reviewChecks.forEach(input=>input.checked=false);updateReviewGate();
});
editorForm.addEventListener('change',event=>{
 if(!state.selected || event.target.id==='schedule-date' || event.target.id==='image-file')return;
 state.dirty=true;state.previewOpened=false;reviewChecks.forEach(input=>input.checked=false);updateReviewGate();
});
$('review-publish-btn').onclick=()=>action('publish');
const fields=['title','slug','excerpt','country','city','content_markdown','verified_at','seo_title','seo_description','hero_image_url','hero_alt','hero_prompt'];
async function loadArticle(id){
 try{
  const {article:a}=await api('/api/admin/article/'+id);state.selected=a;
  const form=$('article-form');
  fields.forEach(key=>{const el=form.elements.namedItem(key);if(el)el.value=a[key]??'';});
  form.elements.namedItem('category').value=a.category_id;
  form.elements.namedItem('sources').value=JSON.stringify(JSON.parse(a.sources_json||'[]'),null,2);
  $('editor-heading').textContent=a.title;
  $('editor-subheading').textContent=[a.city,a.country].filter(Boolean).join(', ')+' · '+a.source_mode;
  $('editor-status').textContent='Current status: '+a.status;
  $('schedule-date').value=a.scheduled_at?new Date(Date.parse(a.scheduled_at) - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const preview=$('image-preview');preview.replaceChildren();
  if(a.hero_image_url){const img=new Image();img.src=a.hero_image_url;img.alt='Current editorial illustration';preview.append(img);}
  state.dirty=false;state.previewOpened=false;
  reviewChecks.forEach(input=>input.checked=false);
  populateReviewEvidence(a);updateReviewGate();
  show('editor');
 }catch(e){toast(e.message,true);}
}
$('article-form').onsubmit=async event=>{
 event.preventDefault();try{
  const form=event.currentTarget,body={};
  fields.forEach(key=>body[key]=form.elements.namedItem(key).value);
  body.category=form.elements.namedItem('category').value;
  body.sources=JSON.parse(form.elements.namedItem('sources').value||'[]');
  if(!Array.isArray(body.sources))throw Error('Sources must be a JSON array');
  await api('/api/admin/article/'+state.selected.id,{method:'PATCH',body:JSON.stringify(body)});
  toast('Saved. Previously published changes return to review to avoid silent changes.');
  await refresh();await loadArticle(state.selected.id);
 }catch(e){toast(e.message,true);}
};
async function action(name,extra={}){
 if(!state.selected)return;
 if(['publish','schedule'].includes(name)){
  updateReviewGate();
  if($('publish-btn').disabled){toast('Preview the saved article and complete all review checks before approving.',true);return;}
  extra={...extra,review_confirmed:true};
 }
 if(name==='delete' && !confirm('Soft-delete this article? You can restore it later.'))return;
 if(['publish','schedule'].includes(name) && !confirm('Have you checked the source links and accuracy of this article?'))return;
 try{
  const result=await api('/api/admin/article/'+state.selected.id,{method:'PATCH',body:JSON.stringify({action:name,...extra})});
  toast('Article is now '+result.status);
  await refresh();await loadArticle(state.selected.id);
 }catch(e){toast(e.message,true);}
}
$('publish-btn').onclick=()=>action('publish');
$('schedule-btn').onclick=()=>{
 const local=$('schedule-date').value;
 if(!local){toast('Pick a future publication date and time.',true);return;}
 const date=new Date(local);
 if(Number.isNaN(date.valueOf())||date<=new Date()){toast('Select a future date.',true);return;}
 action('schedule',{scheduled_at:date.toISOString()});
};
$('hide-btn').onclick=()=>action('hide');
$('delete-btn').onclick=()=>action('delete');
$('restore-btn').onclick=()=>action('restore');
$('upload-btn').onclick=async()=>{
 const file=$('image-file').files[0];if(!file){toast('Choose an image first.',true);return;}
 try{
  const response=await fetch('/api/admin/media',{method:'POST',body:file,headers:{'Content-Type':file.type}});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Upload failed');
  $('article-form').elements.namedItem('hero_image_url').value=result.url;
  const preview=$('image-preview');preview.replaceChildren();const img=new Image();img.src=result.url;img.alt='Uploaded image';preview.append(img);
  toast('Image uploaded. Save article changes to attach it.');
 }catch(e){toast(e.message,true);}
};
refresh().then(async()=>{
 const id=new URLSearchParams(window.location.search).get('edit');
 if(id && state.articles.some(a=>a.id===id))await loadArticle(id);
}).catch(e=>{toast('Could not load dashboard: '+e.message,true);$('activities').textContent='Check admin session and D1 setup.';});

const logoutButton=document.getElementById('logout-btn');
if(logoutButton)logoutButton.addEventListener('click',async()=>{
 logoutButton.disabled=true;
 try{
  const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
  if(!response.ok)throw Error('Sign-out request failed');
  window.location.replace('/sign-in');
 }catch{
  logoutButton.disabled=false;
  toast('Could not sign out. Please retry or close the browser window.',true);
 }
});
