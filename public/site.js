// Small, external first-party script. No inline event handlers on public pages.
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-copy-guide]');
 if(!button)return;
 try{
  await navigator.clipboard.writeText(window.location.href);
  button.textContent='Copied!';
  window.setTimeout(()=>{button.textContent='Copy link ↗';},2200);
 }catch{
  button.textContent='Copy unavailable';
  window.setTimeout(()=>{button.textContent='Copy link ↗';},2500);
 }
});

/* Table of contents is visible by default on desktop, compact on phones.
   Never overwrite a reader's explicit expanded/collapsed choice. */
const mobileTOC=window.matchMedia('(max-width: 780px)');
for(const toc of document.querySelectorAll('[data-article-toc]')){
 const adapt=()=>{if(!toc.dataset.userChanged)toc.open=!mobileTOC.matches;};
 adapt();
 toc.querySelector('summary')?.addEventListener('click',()=>{toc.dataset.userChanged='true';});
 mobileTOC.addEventListener?.('change',adapt);
}
