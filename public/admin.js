
const $=id=>document.getElementById(id);
const state={articles:[],categories:[],selected:null,dirty:false};
const selectedIds=new Set();
let quickBusy=false;
let pendingSchedule=null;
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
 const reviewNeeded=(overview.reviewDue||[]).filter(row=>!row.next_review_due_at || Date.parse(row.next_review_due_at)<=Date.now());
 $('review-due').innerHTML=reviewNeeded.length?reviewNeeded.map(row=>{
  const when=row.next_review_due_at?'Review overdue since '+new Date(row.next_review_due_at).toLocaleDateString():'No recorded human review';
  return '<div class="due-row"><div><strong>'+escapeHTML(row.title)+'</strong><small>'+escapeHTML(when)+'</small></div><button class="due-reopen-btn" type="button" data-id="'+escapeHTML(row.id)+'">Reopen review →</button></div>';
 }).join(''):'<p class="due-clear">All published guides have an editorial review date within their selected window.</p>';
 document.querySelectorAll('.due-reopen-btn').forEach(button=>button.addEventListener('click',async()=>{
  if(!confirm('Withdraw this article from the public website and reopen it for source verification?'))return;
  try{
   await api('/api/admin/article/'+button.dataset.id,{method:'PATCH',body:JSON.stringify({action:'review'})});
   toast('Article withdrawn from public view and reopened for editorial review.');
   await refresh();await loadArticle(button.dataset.id);
  }catch(e){toast(e.message,true);}
 }));
 $('activities').innerHTML=overview.auditLogs.length?overview.auditLogs.map(log=>'<div>'+escapeHTML(log.action)+' <small>'+escapeHTML(log.created_at)+'</small></div>').join(''):'<p>No activity yet.</p>';
 $('edit-category').innerHTML=state.categories.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.name)+'</option>').join('');
 renderArticles();renderQueue();
}
function visibleArticles(){
 const q=$('article-search').value.trim().toLowerCase(),filter=$('article-filter').value;
 return state.articles.filter(a=>(!filter||a.status===filter)&&(!q||[a.title,a.country,a.city].join(' ').toLowerCase().includes(q)));
}
function selectedVisible(){
 return visibleArticles().filter(a=>selectedIds.has(a.id));
}
function updateBulkToolbar(){
 const visible=visibleArticles(),selected=selectedVisible();
 const all=$('select-all-visible');
 all.checked=visible.length>0&&selected.length===visible.length;
 all.indeterminate=selected.length>0&&selected.length<visible.length;
 all.disabled=visible.length===0||quickBusy;
 $('bulk-count').textContent=selected.length+' selected';
 const has=selected.length>0&&!quickBusy;
 for(const name of ['publish','hide','schedule','restore','delete'])$('bulk-'+name).disabled=!has;
 const selectedDeleted=has&&selected.every(a=>a.status==='deleted');
 $('bulk-purge').hidden=$('article-filter').value!=='deleted';
 $('bulk-purge').disabled=!selectedDeleted;
 $('empty-trash').hidden=$('article-filter').value!=='deleted'||Boolean($('article-search').value.trim());
 $('empty-trash').disabled=quickBusy;
 $('bulk-clear').disabled=!has;
}
function quickOptions(a){
 const ops=['<option value="">Quick action…</option>'];
 if(['review','draft','hidden','scheduled'].includes(a.status)){
  ops.push('<option value="publish">Publish now</option><option value="schedule">Schedule…</option>');
 }
 if(!['hidden','deleted','archived'].includes(a.status))ops.push('<option value="hide">Hide · private</option>');
 if(['hidden','archived','deleted'].includes(a.status))ops.push('<option value="restore">Restore draft</option>');
 if(['published','scheduled','draft','hidden'].includes(a.status))ops.push('<option value="review">Move to Review</option>');
 if(a.status!=='deleted')ops.push('<option value="delete">Delete · recoverable</option>');
 else ops.push('<option value="purge">Permanently delete…</option>');
 return ops.join('');
}
function renderArticles(){
 const rows=visibleArticles();
 $('article-rows').innerHTML=rows.map(a=>{
  const published=a.status==='published',deleted=a.status==='deleted';
  const link=published?'/guides/'+encodeURIComponent(a.slug):'/admin/preview/'+encodeURIComponent(a.id);
  const trackPreview=published||deleted?'':' data-preview-id="'+escapeHTML(a.id)+'" data-preview-update="'+escapeHTML(a.updated_at||'')+'"';
  const viewLink=deleted?'<span class="deleted-label">Deleted</span>':
   '<a class="preview-row-link" href="'+escapeHTML(link)+'" target="_blank" rel="noopener noreferrer"'+trackPreview+'>'+(published?'View live ↗':'Preview ↗')+'</a>';
  const statusLabel=a.status==='review'?'AWAITING REVIEW':a.status.toUpperCase();
  return '<tr><td class="select-col"><input type="checkbox" class="row-select" data-id="'+escapeHTML(a.id)+'" aria-label="Select '+escapeHTML(a.title)+'"'+(selectedIds.has(a.id)?' checked':'')+'></td>'+
   '<td><strong>'+escapeHTML(a.title)+'</strong><small>'+escapeHTML([a.city,a.country].filter(Boolean).join(', '))+'</small></td>'+
   '<td>'+escapeHTML(a.category_id)+'</td><td><span class="status '+escapeHTML(a.status)+'">'+escapeHTML(statusLabel)+'</span></td>'+
   '<td>'+escapeHTML(a.scheduled_at||a.published_at||'—')+'</td>'+
   '<td><div class="row-actions">'+viewLink+
   '<button type="button" class="review-row-btn edit-link" data-id="'+escapeHTML(a.id)+'">'+(a.status==='review'?'Review →':'Edit →')+'</button>'+
   '<select class="row-quick" data-id="'+escapeHTML(a.id)+'" aria-label="Quick actions for '+escapeHTML(a.title)+'">'+quickOptions(a)+'</select></div></td></tr>';
 }).join('')||'<tr><td colspan="6">No articles match this view.</td></tr>';
 document.querySelectorAll('#article-rows .edit-link').forEach(btn=>btn.onclick=()=>loadArticle(btn.dataset.id));
 document.querySelectorAll('#article-rows .row-select').forEach(el=>el.addEventListener('change',()=>{
  if(el.checked)selectedIds.add(el.dataset.id);else selectedIds.delete(el.dataset.id);
  updateBulkToolbar();
 }));
 document.querySelectorAll('#article-rows .row-quick').forEach(drop=>drop.addEventListener('change',()=>{
  const action=drop.value;drop.value='';
  if(action)quickRowAction(drop.dataset.id,action);
 }));
 updateBulkToolbar();
}
function renderQueue(){
 const rows=state.articles.filter(a=>['review','scheduled','draft'].includes(a.status)).sort((a,b)=>(a.scheduled_at||'9999').localeCompare(b.scheduled_at||'9999'));
 $('queue').innerHTML=rows.map(a=>'<div><span class="status '+escapeHTML(a.status)+'">'+escapeHTML(a.status)+'</span> &nbsp; '+escapeHTML(a.scheduled_at||'Not scheduled')+' — <strong>'+escapeHTML(a.title)+'</strong><span class="queue-actions"><a href="/admin/preview/'+encodeURIComponent(a.id)+'" data-preview-id="'+escapeHTML(a.id)+'" data-preview-update="'+escapeHTML(a.updated_at||'')+'" target="_blank" rel="noopener noreferrer">Preview ↗</a><button type="button" class="text-button queue-btn" data-id="'+escapeHTML(a.id)+'">Review →</button></span></div>').join('')||'<p>Your queue is clear.</p>';
 document.querySelectorAll('.queue-btn').forEach(btn=>btn.onclick=()=>loadArticle(btn.dataset.id));
 document.querySelectorAll('#queue [data-preview-id]').forEach(link=>link.addEventListener('click',()=>{
   sessionStorage.setItem('tc-preview:'+link.dataset.previewId,link.dataset.previewUpdate);
 }));
}
function clearSelection(){
 selectedIds.clear();renderArticles();
}
$('article-search').addEventListener('input',clearSelection);
$('article-filter').addEventListener('change',clearSelection);
$('select-all-visible').addEventListener('change',event=>{
 // Only select currently visible rows; never silently include filtered-out articles.
 const visible=visibleArticles();
 for(const a of visible){
  if(event.target.checked)selectedIds.add(a.id);
  else selectedIds.delete(a.id);
 }
 renderArticles();
});
$('bulk-clear').addEventListener('click',clearSelection);
$('json-file').addEventListener('change',async ev=>{
 const file=ev.target.files[0];if(file){if(file.size>2_000_000){toast('JSON file is too large',true);return;}$('json-input').value=await file.text();}
});
$('import-btn').onclick=async()=>{
 try{
  const data=JSON.parse($('json-input').value);
  const revision=$('revision-mode').checked;
  if(revision){
    if(!Array.isArray(data.articles)||!data.articles.length)throw Error('Revision mode requires a JSON package with articles.');
    if(!confirm('DID YOU BACK UP D1? Replacing matching articles will immediately remove them from the public website until reviewed again. Continue?'))return;
  }
  const request={...data,update_matching:revision,confirm_unpublish:revision};
  const result=await api('/api/admin/import',{method:'POST',body:JSON.stringify(request)});
  const ok=result.results.filter(r=>r.ok).length;
  $('import-result').textContent=ok+' imported, '+(result.results.length-ok)+' errors';
  const errors=result.results.filter(r=>!r.ok);
  if(errors.length)toast(errors.map(e=>e.title+': '+e.error).join(' | ').slice(0,600),true);
  else toast(ok+(revision?' corrected/new articles placed in Review. Re-approve individually.':' articles imported. Review before publication.'));
  await refresh();
 }catch(e){toast(e.message,true);}
};
const editorForm=$('article-form');
function safeSourceUrl(raw){
 try{const u=new URL(raw);return u.protocol==='https:'?u.href:null;}catch{return null;}
}
function hasSources(a){
 try{return JSON.parse(a?.sources_json||'[]').some(s=>safeSourceUrl(s?.url));}catch{return false;}
}
function updateReviewGate(){
 const a=state.selected;
 const eligible=a&&['review','draft','hidden','scheduled'].includes(a.status);
 const ready=Boolean(eligible&&!state.dirty&&hasSources(a)&&!quickBusy);
 $('review-publish-btn').hidden=!eligible;
 $('review-publish-btn').disabled=!ready;
 $('publish-btn').disabled=!ready;
 $('schedule-btn').disabled=!ready;
 $('hide-btn').disabled=!a||quickBusy||['hidden','deleted','archived'].includes(a.status);
 $('restore-btn').disabled=!a||quickBusy||!['hidden','deleted','archived'].includes(a.status);
 $('delete-btn').disabled=!a||quickBusy||a.status==='deleted';
 $('review-guidance').textContent=!a?'Select an article to review.':
  state.dirty?'Save your changes first. Preview always displays the last saved version.':
  !hasSources(a)?'Add at least one valid HTTPS source and save before publishing.':
  !eligible?'This article is already published or needs to be restored. You can still edit or hide it.':
  'Review the article and its source links. Publish only when you are satisfied, or leave it private.';
}
function populateReviewEvidence(a){
 let sources=[];
 try{sources=JSON.parse(a.sources_json||'[]').filter(s=>safeSourceUrl(s?.url));}catch{}
 $('review-source-links').innerHTML=sources.length?sources.map(s=>
   '<a class="review-source" href="'+escapeHTML(safeSourceUrl(s.url))+'" target="_blank" rel="noopener noreferrer nofollow">'+
   escapeHTML(s.title||s.url)+' <span aria-hidden="true">↗</span></a>').join(''):
   '<p class="review-evidence-missing">No valid HTTPS sources saved. Add a source below, then save.</p>';
 $('review-evidence-status').textContent=sources.length+' saved HTTPS source'+(sources.length===1?'':'s')+'. Open and check the relevant sources before publishing.';
 $('review-verified-note').textContent=a.verified_at?
   'Research reference: '+a.verified_at+'. This date may come from AI research; it is not independent editorial verification.':
   'No research reference date recorded. Verify time-sensitive information before publication.';
 $('editor-preview-link').href='/admin/preview/'+encodeURIComponent(a.id);
}
$('editor-preview-link').addEventListener('click',event=>{
 if(!state.selected){event.preventDefault();return;}
 if(state.dirty&&!confirm('Unsaved changes are not included in the preview. Open the last saved version?'))event.preventDefault();
});
function markDirty(event){
 if(!state.selected||event.target.id==='schedule-date'||event.target.id==='image-file')return;
 state.dirty=true;updateReviewGate();
}
editorForm.addEventListener('input',markDirty);
editorForm.addEventListener('change',markDirty);
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
  $('schedule-date').value=a.scheduled_at?
   new Date(Date.parse(a.scheduled_at)-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const preview=$('image-preview');preview.replaceChildren();
  if(a.hero_image_url){const img=new Image();img.src=a.hero_image_url;img.alt='Current editorial illustration';preview.append(img);}
  state.dirty=false;
  populateReviewEvidence(a);updateReviewGate();show('editor');
 }catch(e){toast(e.message,true);}
}
$('article-form').onsubmit=async event=>{
 event.preventDefault();
 try{
  const form=event.currentTarget,body={};
  fields.forEach(key=>body[key]=form.elements.namedItem(key).value);
  body.category=form.elements.namedItem('category').value;
  body.sources=JSON.parse(form.elements.namedItem('sources').value||'[]');
  if(!Array.isArray(body.sources))throw Error('Sources must be a JSON array');
  await api('/api/admin/article/'+state.selected.id,{method:'PATCH',body:JSON.stringify(body)});
  toast('Saved. Changes to live or scheduled articles return them to private Review.');
  await refresh();await loadArticle(state.selected.id);
 }catch(e){toast(e.message,true);}
};
async function action(name,extra={}){
 if(!state.selected||quickBusy)return;
 if(['publish','schedule'].includes(name)){
  updateReviewGate();
  if($('publish-btn').disabled){toast('Save changes and include a valid source before publishing.',true);return;}
  if(!confirm('Have you reviewed this article and its sources, and do you want to '+(name==='publish'?'publish it now':'schedule it')+'?'))return;
  extra={...extra,review_confirmed:true,review_method:'single'};
 }
 if(name==='delete'&&!confirm('Move this article to Deleted? Its text is retained and you can Restore draft later.'))return;
 if(name==='hide'&&state.selected.status==='published'&&!confirm('Hide this live article from the public website? It will remain in Admin.'))return;
 try{
  quickBusy=true;updateReviewGate();
  const result=await api('/api/admin/article/'+state.selected.id,{method:'PATCH',body:JSON.stringify({action:name,...extra})});
  toast('Article is now '+result.status+'.');
  await refresh();await loadArticle(state.selected.id);
 }catch(e){toast(e.message,true);}
 finally{quickBusy=false;updateReviewGate();updateBulkToolbar();}
}
async function quickRowAction(id,name){
 if(quickBusy)return;
 if(name==='purge'){await permanentlyPurge([id]);return;}
 if(name==='schedule'){openSchedule('row',[id]);return;}
 const a=state.articles.find(article=>article.id===id);
 if(!a)return;
 if(name==='publish'&&!confirm('Publish "'+a.title+'"? Confirm you have already reviewed it and its source links.'))return;
 if(name==='hide'&&a.status==='published'&&!confirm('Hide "'+a.title+'" from the public website? This does not delete it.'))return;
 if(name==='delete'&&!confirm('Move "'+a.title+'" to Deleted? It can be restored.'))return;
 try{
  quickBusy=true;updateBulkToolbar();
  const result=await api('/api/admin/article/'+id,{
   method:'PATCH',body:JSON.stringify({action:name,review_confirmed:name==='publish',review_method:'single'})
  });
  toast('"' + a.title + '" is now '+result.status+'.');
  selectedIds.delete(id);
  await refresh();
 }catch(e){toast(e.message,true);}
 finally{quickBusy=false;renderArticles();updateReviewGate();}
}
async function runBulk(name,scheduledAt=null,stagger=false){
 if(quickBusy)return;
 const list=selectedVisible();
 if(!list.length){toast('Select at least one article in All articles.',true);return;}
 const count=list.length,verb={publish:'publish',hide:'make private',schedule:'schedule',restore:'restore to draft',delete:'move to Deleted'}[name];
 const promptText=['publish','schedule'].includes(name)?
  'Confirm that you have reviewed all '+count+' selected articles and their sources. '+(name==='publish'?'They will become PUBLIC immediately.':'They will become PUBLIC on their scheduled dates.')+' Continue?':
  name==='delete'?'Move all '+count+' selected articles to Deleted? You can restore them later. Continue?':
  name==='hide'?'Make all '+count+' selected articles PRIVATE (not deleted)? Continue?':
  'Restore '+count+' selected articles to drafts? Continue?';
 if(!confirm(promptText))return;
 const body={
  action:name,ids:list.map(a=>a.id),confirm_selection:true,confirm_count:count,
  review_confirmed:['publish','schedule'].includes(name)
 };
 if(name==='schedule'){body.scheduled_at=scheduledAt;body.stagger_days=stagger;}
 try{
  quickBusy=true;updateBulkToolbar();
  const res=await api('/api/admin/bulk',{method:'POST',body:JSON.stringify(body)});
  for(const row of res.results)if(row.ok)selectedIds.delete(row.id);
  const errors=res.results.filter(row=>!row.ok);
  const summary=res.processed+' of '+count+' selected article'+(count===1?'':'s')+' processed ('+verb+').'+
   (errors.length?' '+errors.length+' skipped: '+errors.slice(0,4).map(r=>r.error).join('; '):'');
  $('bulk-result').textContent=summary;
  toast(summary,errors.length>0);
  await refresh();
 }catch(e){toast(e.message,true);}
 finally{quickBusy=false;renderArticles();updateReviewGate();}
}
async function permanentlyPurge(ids=null){
 if(quickBusy)return;
 const selected=ids?ids.map(id=>state.articles.find(a=>a.id===id)).filter(Boolean):null;
 if(selected&&(!selected.length||selected.some(a=>a.status!=='deleted'))){
  toast('Only articles already in Deleted can be permanently erased.',true);return;
 }
 if(!selected && ($('article-filter').value!=='deleted'||$('article-search').value.trim())){
  toast('Select the Deleted filter and clear search before emptying the entire trash.',true);return;
 }
 try{
  const mode=selected?'selected':'trash';
  // For "all trash", the authoritative count comes from the server, not the
  // currently loaded paginated/list-limited table.
  const count=selected?selected.length:Number((await api('/api/admin/trash-count')).count);
  if(!count){toast('Trash is already empty.');return;}
  const warning=(selected?'Permanently erase '+count+' selected deleted article(s)?':
   'EMPTY ALL TRASH: Permanently erase '+count+' deleted article(s), including any not loaded in this table?')+
   '\\n\\nThis removes the articles and their article-linked audit entries from D1. It cannot be undone through Admin. Save a D1 backup before continuing. Cloudflare R2 image objects are NOT deleted.'+
   '\\n\\nType PERMANENTLY DELETE to confirm:';
  if(window.prompt(warning)!=='PERMANENTLY DELETE'){
   toast('Permanent deletion canceled.');return;
  }
  quickBusy=true;updateBulkToolbar();
  const body={mode,confirmation:'PERMANENTLY DELETE',confirm_count:count};
  if(selected)body.ids=selected.map(a=>a.id);
  const result=await api('/api/admin/purge',{method:'POST',body:JSON.stringify(body)});
  if(selected)for(const a of selected)selectedIds.delete(a.id);
  else selectedIds.clear();
  toast(result.purged+' deleted article(s) permanently erased from D1. R2 images are unchanged.');
  $('bulk-result').textContent=result.purged+' permanently deleted. To remove image files, review R2 separately.';
  await refresh();
 }catch(e){toast(e.message,true);}
 finally{quickBusy=false;renderArticles();updateBulkToolbar();}
}
$('bulk-purge').addEventListener('click',()=>permanentlyPurge(selectedVisible().map(a=>a.id)));
$('empty-trash').addEventListener('click',()=>permanentlyPurge());
function openSchedule(mode,ids){
 if(quickBusy||!ids.length)return;
 if(mode==='editor'&&state.dirty){toast('Save your edits before scheduling.',true);return;}
 pendingSchedule={mode,ids};
 const single=ids.length===1;
 $('schedule-dialog-explainer').textContent=single?'Schedule one article.':'Schedule '+ids.length+' selected articles.';
 $('schedule-stagger-label').hidden=single;
 $('schedule-stagger').checked=!single;
 let fromEditor=mode==='editor'&&$('schedule-date').value;
 const next=fromEditor||new Date(Date.now()+2*3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('bulk-schedule-date').value=next;
 $('schedule-dialog').showModal();
 $('bulk-schedule-date').focus();
}
$('schedule-cancel').addEventListener('click',()=>$('schedule-dialog').close());
$('schedule-dialog').addEventListener('close',()=>{pendingSchedule=null;});
$('schedule-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!pendingSchedule)return;
 const at=new Date($('bulk-schedule-date').value);
 if(!Number.isFinite(at.valueOf())||at<=new Date()){toast('Choose a valid future local date/time.',true);return;}
 const stateSnapshot=pendingSchedule,utc=at.toISOString(),stagger=$('schedule-stagger').checked;
 $('schedule-dialog').close();
 if(stateSnapshot.mode==='bulk'){await runBulk('schedule',utc,stagger);return;}
 if(stateSnapshot.mode==='editor'){await action('schedule',{scheduled_at:utc});return;}
 const id=stateSnapshot.ids[0],a=state.articles.find(row=>row.id===id);
 if(!a)return;
 if(!confirm('Confirm you reviewed "'+a.title+'" and want to schedule it?'))return;
 try{
  quickBusy=true;updateBulkToolbar();
  const result=await api('/api/admin/article/'+id,{
   method:'PATCH',body:JSON.stringify({action:'schedule',scheduled_at:utc,review_confirmed:true,review_method:'single'})
  });
  toast('Scheduled "'+a.title+'".');
  selectedIds.delete(id);await refresh();
 }catch(e){toast(e.message,true);}
 finally{quickBusy=false;renderArticles();}
});
for(const name of ['publish','hide','restore','delete']){
 $('bulk-'+name).addEventListener('click',()=>runBulk(name));
}
$('bulk-schedule').addEventListener('click',()=>openSchedule('bulk',selectedVisible().map(a=>a.id)));
$('publish-btn').onclick=()=>action('publish');
$('schedule-btn').onclick=()=>openSchedule('editor',[state.selected?.id].filter(Boolean));
$('hide-btn').onclick=()=>action('hide');
$('delete-btn').onclick=()=>action('delete');
$('restore-btn').onclick=()=>action('restore');
$('upload-btn').onclick=async()=>{
 const file=$('image-file').files[0];if(!file){toast('Choose an image first.',true);return;}
 try{
  const response=await fetch('/api/admin/media',{method:'POST',body:file,headers:{'Content-Type':file.type}});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Upload failed');
  $('article-form').elements.namedItem('hero_image_url').value=result.url;
  state.dirty=true;updateReviewGate();
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
