const form=document.getElementById('login-form');
const keyInput=document.getElementById('admin-key');
const feedback=document.getElementById('login-feedback');
const submit=document.getElementById('login-submit');
document.getElementById('toggle-key').addEventListener('click',event=>{
 const button=event.currentTarget;
 const visible=keyInput.type==='text';
 keyInput.type=visible?'password':'text';
 button.textContent=visible?'Show':'Hide';
 button.setAttribute('aria-pressed',String(!visible));
});
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const key=keyInput.value;
 if(key.length<32){feedback.textContent='Enter your full private key.';return;}
 submit.disabled=true;feedback.textContent='';
 try{
  const res=await fetch('/api/auth/login',{
   method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({key})
  });
  // Do not retain the secret in the input after use.
  keyInput.value='';
  const result=await res.json().catch(()=>({}));
  if(!res.ok){feedback.textContent=result.error||'Sign-in failed. Please try again.';return;}
  window.location.replace('/admin');
 }catch{feedback.textContent='Could not reach the server. Please retry.';}
 finally{submit.disabled=false;}
});
