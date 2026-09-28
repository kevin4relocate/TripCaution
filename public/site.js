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
