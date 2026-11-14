import {createAuth,SESSION_KEY} from './auth-client.js';
import {syncAccount,setAlert,forgetAccount} from './account-sync.js';
import {searchName} from './job-workspace-core.js';
import {escapeHtml as e} from './directory-core.js';

// Optional accounts: the header button, sign-in dialog and background sync of saved lists.
const auth=createAuth();
const state={view:'email',email:'',message:'',busy:false,counts:null,alerts:{},syncError:'',google:null};
let dialog,button,pending=null,again=false,debounce;

function plural(n,word){return `${n} ${word}${n===1?'':'s'}`;}
function label(){if(button)button.textContent=auth.session()?'Account':'Sign in';}

function emailView() {
  return `<p>Sync saved jobs, hackathons and searches across your devices and choose job alerts. No password needed.</p>
    <form class="account-form" data-form="email" novalidate><label for="account-email">Email address</label>
      <input id="account-email" name="email" type="email" autocomplete="email" inputmode="email" required value="${e(state.email)}">
      <button class="account-primary" type="submit"${state.busy?' disabled':''}>${state.busy?'Sending…':'Email me a sign-in code'}</button></form>
    ${state.google?'<div class="account-or"><span>or</span></div><button class="account-secondary" type="button" data-google>Continue with Google</button>':''}
    <p class="account-note">Anything you saved on this device is added to your account. <a href="/privacy#accounts">How accounts work</a></p>`;
}
function codeView() {
  return `<p>We emailed a sign-in code to <strong>${e(state.email)}</strong>. Enter it below, or open the link in that email on this device.</p>
    <form class="account-form" data-form="code" novalidate><label for="account-code">Sign-in code</label>
      <input id="account-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required>
      <button class="account-primary" type="submit"${state.busy?' disabled':''}>${state.busy?'Checking…':'Sign in'}</button></form>
    <div class="account-links"><button type="button" data-resend>Send a new code</button><button type="button" data-restart>Use a different email</button></div>`;
}
function accountView() {
  const s=auth.session(),c=state.counts,queries=Object.keys(state.alerts);
  const alertRows=queries.map(q=>`<li><span>${e(searchName(q))}</span><select data-alert="${e(q)}" aria-label="Alerts for ${e(searchName(q))}">
    ${['off','daily','weekly'].map(v=>`<option value="${v}"${state.alerts[q]===v?' selected':''}>${v==='off'?'No alerts':v==='daily'?'Daily':'Weekly'}</option>`).join('')}</select></li>`).join('');
  return `<p class="account-email">${e(s?.user.email||'')}</p>
    <dl class="account-counts">${c?`<div><dt>Saved jobs</dt><dd>${c.job}</dd></div><div><dt>Saved hackathons</dt><dd>${c.hackathon}</dd></div><div><dt>Saved searches</dt><dd>${c.search}</dd></div>`:'<div><dt>Syncing</dt><dd>…</dd></div>'}</dl>
    ${state.syncError?`<p class="account-warning">${e(state.syncError)}</p>`:''}
    <h3>Job alerts</h3>
    ${queries.length?`<ul class="account-alerts">${alertRows}</ul><p class="account-note">Choose how often to hear about new roles for each saved search. Alert emails begin once delivery is switched on for WILSY; your choices are kept until then.</p>`
      :`<p class="account-note">Save a search on <a href="/jobs">Find jobs</a> to choose alerts for it.</p>`}
    <button class="account-secondary" type="button" data-signout>Sign out</button>
    <p class="account-note">Signing out removes your saved items from this browser. They stay in your account.</p>`;
}
function render() {
  if(!dialog)return;
  const signedIn=!!auth.session();
  if(signedIn)state.view='account';else if(state.view==='account')state.view='email';
  const title=signedIn?'Your account':state.view==='code'?'Check your email':'Keep your shortlist everywhere';
  dialog.innerHTML=`<div class="account-panel"><div class="account-head"><div><p class="eyebrow">WILSY ACCOUNT</p><h2 id="account-title">${title}</h2></div>
    <button class="account-close" type="button" data-close>Close</button></div>
    ${state.view==='account'?accountView():state.view==='code'?codeView():emailView()}
    <p class="account-message" role="status" aria-live="polite">${e(state.message)}</p></div>`;
  label();
}
function focusFirst(){dialog?.querySelector('input, select, [data-signout]')?.focus();}
async function open(message='') {
  state.message=message;render();
  if(!dialog.open)dialog.showModal();
  focusFirst();
  if(state.google===null&&!auth.session())auth.providers().then(p=>{state.google=p.google;if(dialog.open&&state.view==='email')render();}).catch(()=>{state.google=false;});
}

async function run(task) {
  state.busy=true;state.message='';render();
  try{await task();}catch(error){state.message=error.message||'Something went wrong. Try again.';}
  finally{state.busy=false;render();focusFirst();}
}

export function sync() {
  if(pending){again=true;return pending;}
  pending=(async()=>{
    do{
      again=false;
      const s=auth.session();if(!s)return;
      const token=await auth.accessToken();if(!token)return;
      const result=await syncAccount({token,userId:s.user.id,storage:localStorage});
      Object.assign(state,{counts:result.counts,alerts:result.alerts,syncError:''});
      for(const key of result.changed)window.dispatchEvent(new StorageEvent('storage',{key}));
    }while(again);
  })().catch(()=>{state.syncError='Some changes have not synced yet. WILSY will retry automatically.';})
    .finally(()=>{pending=null;if(dialog?.open)render();label();});
  return pending;
}

function bind() {
  dialog.addEventListener('click',async event=>{
    const t=event.target;
    if(t===dialog||t.closest('[data-close]'))return dialog.close();
    if(t.closest('[data-restart]')){state.view='email';state.message='';return render();}
    if(t.closest('[data-resend]'))return run(async()=>{await auth.sendEmail(state.email);state.message='A new code is on its way.';});
    if(t.closest('[data-google]'))return run(async()=>{location.assign(await auth.googleUrl());});
    if(t.closest('[data-signout]'))return run(async()=>{await auth.signOut();forgetAccount(localStorage);
      for(const key of ['wilsy-saved-jobs','wilsy-saved-hackathons','wilsy-saved-searches-v1'])window.dispatchEvent(new StorageEvent('storage',{key}));
      Object.assign(state,{view:'email',counts:null,alerts:{}});state.message='Signed out.';});
  });
  dialog.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.target;
    if(form.dataset.form==='email'){state.email=form.email.value;return run(async()=>{state.email=await auth.sendEmail(state.email);state.view='code';});}
    if(form.dataset.form==='code')return run(async()=>{await auth.verifyCode(state.email,form.code.value);state.message='Signed in. Your saved items are syncing.';await sync();});
  });
  dialog.addEventListener('change',event=>{
    const select=event.target.closest('[data-alert]');if(!select)return;
    const query=select.dataset.alert,previous=state.alerts[query];state.alerts[query]=select.value;
    auth.accessToken().then(token=>setAlert(token,query,select.value)).then(()=>{state.message='Alert preference saved.';render();})
      .catch(()=>{state.alerts[query]=previous;state.message='That alert setting did not save. Try again.';render();});
  });
}

function init() {
  const toggle=document.querySelector('.main-nav #theme-toggle');
  if(!toggle)return;
  button=Object.assign(document.createElement('button'),{type:'button',className:'account-toggle'});
  button.setAttribute('aria-haspopup','dialog');
  toggle.before(button);
  dialog=Object.assign(document.createElement('dialog'),{className:'account-dialog'});
  dialog.setAttribute('aria-labelledby','account-title');
  document.body.append(dialog);
  bind();render();
  button.addEventListener('click',()=>{open();if(auth.session())sync();});
  // Any link marked data-account-open (e.g. "Create a free account") opens the same dialog.
  document.addEventListener('click',event=>{const link=event.target.closest('[data-account-open]');if(!link)return;event.preventDefault();open();if(auth.session())sync();});
  window.addEventListener('wilsy:saved',()=>{clearTimeout(debounce);debounce=setTimeout(sync,400);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();});
  window.addEventListener('online',()=>sync());
  window.addEventListener('storage',event=>{if(event.key===SESSION_KEY){render();if(auth.session())sync();}});
  auth.completeRedirect().then(session=>{if(session)open('Signed in. Your saved items are syncing.');return sync();})
    .catch(error=>open(error.message));
}
init();
