
const $=id=>document.getElementById(id);
const state={articles:[],categories:[],selected:null};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},credentials:'same-origin'});
 const data=await response.json().catch(()=>({error:'Invalid server response'}));
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
 $('article-rows').innerHTML=rows.map(a=>'<tr><td><strong>'+escapeHTML(a.title)+'</strong><small>'+escapeHTML([a.city,a.country].filter(Boolean).join(', '))+'</small></td><td>'+escapeHTML(a.category_id)+'</td><td><span class="status '+escapeHTML(a.status)+'">'+escapeHTML(a.status)+'</span></td><td>'+escapeHTML(a.scheduled_at||a.published_at||'—')+'</td><td><button class="text-button edit-link" data-id="'+escapeHTML(a.id)+'">Edit ↗</button></td></tr>').join('')||'<tr><td colspan="5">No articles match this view.</td></tr>';
 document.querySelectorAll('.edit-link').forEach(btn=>btn.onclick=()=>loadArticle(btn.dataset.id));
}
function renderQueue(){
 const rows=state.articles.filter(a=>['review','scheduled','draft'].includes(a.status)).sort((a,b)=>(a.scheduled_at||'9999').localeCompare(b.scheduled_at||'9999'));
 $('queue').innerHTML=rows.map(a=>'<div><span class="status '+escapeHTML(a.status)+'">'+escapeHTML(a.status)+'</span> &nbsp; '+escapeHTML(a.scheduled_at||'Not scheduled')+' — <strong>'+escapeHTML(a.title)+'</strong><button class="text-button queue-btn" data-id="'+escapeHTML(a.id)+'">Review ↗</button></div>').join('')||'<p>Your queue is clear.</p>';
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
  $('schedule-date').value=a.scheduled_at?new Date(a.scheduled_at+'Z'.replace('ZZ','Z')).toISOString().slice(0,16):'';
  const preview=$('image-preview');preview.replaceChildren();
  if(a.hero_image_url){const img=new Image();img.src=a.hero_image_url;img.alt='Current editorial illustration';preview.append(img);}
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
refresh().catch(e=>{toast('Could not load dashboard: '+e.message,true);$('activities').textContent='Check Cloudflare Access and D1 setup.';});
