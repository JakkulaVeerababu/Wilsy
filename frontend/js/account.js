import {createAuth,SESSION_KEY} from './auth-client.js';
import {syncAccount,setAlert,forgetAccount,getWeekly,setWeekly} from './account-sync.js';
import {searchName} from './job-workspace-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// Optional accounts: the header button, sign-in dialog and background sync of saved lists.
const auth=createAuth();
const state={view:'email',email:'',code:'',message:'',busy:false,counts:null,alerts:{},weekly:null,syncError:'',providers:null};
let dialog,host,inline=false,button,pending=null,again=false,debounce; // host: the dialog, or the /sign-in page's panel
const shown=()=>inline||!!dialog?.open;
const METHOD_KEY='wilsy-sign-in-method'; // remembers a Google or GitHub sign-in across the redirect, for analytics

function plural(n,word){return `${n} ${word}${n===1?'':'s'}`;}
function label(){if(button)button.textContent=auth.session()?'Account':'Sign in';}

const OAUTH_NAMES={google:'Google',github:'GitHub'};
// The providers' own marks, as their brand guidelines ask for sign-in buttons.
const LOGOS={
  google:'<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
  github:'<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'};
// Google and GitHub sit side by side when both are on; one switched-on provider gets the full width.
function oauthButtons() {
  const on=Object.keys(OAUTH_NAMES).filter(p=>state.providers?.[p]);
  if(!on.length)return '';
  return `<div class="account-or"><span>or</span></div><div class="account-oauth${on.length>1?' is-pair':''}">${on.map(p=>`<button class="account-provider" type="button" data-provider="${p}" aria-label="Continue with ${OAUTH_NAMES[p]}"${state.busy?' disabled':''}>${LOGOS[p]}<span>${on.length>1?OAUTH_NAMES[p]:'Continue with '+OAUTH_NAMES[p]}</span></button>`).join('')}</div>`;
}
// The left half of the signed-out card on wide screens: what an account is for.
const brandPanel=`<aside class="account-brand"><p class="account-brand-mark">wilsy<span>.in</span></p>
  <div><p class="account-brand-title">Every job you save, on every device.</p>
  <ul class="account-brand-list"><li>Saved jobs, hackathons and searches stay in sync</li><li>Job alerts for the searches you save</li><li>Free, with no password to remember</li></ul></div></aside>`;
function emailView() {
  return `<p>Sync saved jobs, hackathons and searches across your devices and choose job alerts. No password needed.</p>
    <form class="account-form" data-form="email" novalidate><label for="account-email">Email address</label>
      <input id="account-email" name="email" type="email" autocomplete="email" inputmode="email" required value="${e(state.email)}">
      <button class="account-primary" type="submit"${state.busy?' disabled':''}>${state.busy?'Sending…':'Email me a sign-in code'}</button></form>
    ${oauthButtons()}
    <p class="account-note">Anything you saved on this device is added to your account. <a href="/privacy#accounts">How accounts work</a></p>`;
}
function codeView() {
  return `<p>We emailed a sign-in code to <strong>${e(state.email)}</strong>. Enter it below, or open the link in that email on this device.</p>
    <form class="account-form" data-form="code" novalidate><label for="account-code">Sign-in code</label>
      <input id="account-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required value="${e(state.code)}">
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
    ${queries.length?`<ul class="account-alerts">${alertRows}</ul><p class="account-note">Choose how often to hear about new roles for each saved search. Emails go out around 9 a.m. India time, only when a search has new roles. Choose No alerts, or use the unsubscribe link in any alert email, to stop them.</p>`
      :`<p class="account-note">Save a search on <a href="/jobs">Find jobs</a> to choose alerts for it.</p>`}
    <h3>Weekly email</h3>
    <label class="account-weekly"><input type="checkbox" data-weekly${state.weekly?' checked':''}${state.weekly==null?' disabled':''}> <span>Send me the weekly WILSY email: new internships and fresher jobs in India, once a week.</span></label>
    <button class="account-secondary" type="button" data-signout>Sign out</button>
    <p class="account-note">Signing out removes your saved items from this browser. They stay in your account.</p>`;
}
function render() {
  if(!host)return;
  const signedIn=!!auth.session();
  if(signedIn)state.view='account';else if(state.view==='account')state.view='email';
  const title=signedIn?'Your account':state.view==='code'?'Check your email':'Keep your shortlist everywhere';
  // Re-rendering replaces the dialog's markup, so keep the focused field and caret across it:
  // background updates (Google check, sync, tab switches) must not wipe what someone is typing.
  const active=host.contains(document.activeElement)?document.activeElement:null;
  const keep=active?.id?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  const tag=inline?'h1':'h2';
  host.innerHTML=`<div class="account-shell${signedIn?'':' has-brand'}">${signedIn?'':brandPanel}<div class="account-panel"><div class="account-head"><div><p class="eyebrow">WILSY ACCOUNT</p><${tag} id="account-title">${title}</${tag}></div>
    ${inline?'':'<button class="account-close" type="button" data-close>Close</button>'}</div>
    ${state.view==='account'?accountView():state.view==='code'?codeView():emailView()}
    <p class="account-message" role="status" aria-live="polite">${e(state.message)}</p></div></div>`;
  const field=keep&&document.getElementById(keep.id);
  if(field&&host.contains(field)){field.focus();try{if(keep.start!=null)field.setSelectionRange(keep.start,keep.end);}catch{}}
  label();
}
// On the /sign-in page the field is focused without scrolling, so the heading stays in view on phones.
function focusFirst(){host?.querySelector('input, select, [data-signout]')?.focus({preventScroll:inline});}
async function open(message='') {
  state.message=message;render();
  if(!inline&&!dialog.open)dialog.showModal();
  focusFirst();
  if(state.providers===null&&!auth.session())auth.providers().then(p=>{state.providers=p;if(Object.values(p).some(Boolean)&&shown()&&state.view==='email')render();}).catch(()=>{state.providers={};});
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
      state.weekly=await getWeekly(token).catch(()=>state.weekly);
      for(const key of result.changed)window.dispatchEvent(new StorageEvent('storage',{key}));
    }while(again);
  })().catch(()=>{state.syncError='Some changes have not synced yet. WILSY will retry automatically.';})
    .finally(()=>{pending=null;if(shown())render();label();});
  return pending;
}

function bind() {
  host.addEventListener('click',async event=>{
    const t=event.target;
    if(!inline&&(t===dialog||t.closest('[data-close]')))return dialog.close();
    if(t.closest('[data-restart]')){state.view='email';state.code='';state.message='';return render();}
    if(t.closest('[data-resend]'))return run(async()=>{await auth.sendEmail(state.email);state.code='';state.message='A new code is on its way.';});
    const provider=t.closest('[data-provider]')?.dataset.provider;
    if(provider)return run(async()=>{try{sessionStorage.setItem(METHOD_KEY,provider);}catch{}location.assign(await auth.providerUrl(provider));});
    if(t.closest('[data-signout]'))return run(async()=>{await auth.signOut();forgetAccount(localStorage);
      for(const key of ['wilsy-saved-jobs','wilsy-saved-hackathons','wilsy-saved-searches-v1'])window.dispatchEvent(new StorageEvent('storage',{key}));
      Object.assign(state,{view:'email',counts:null,alerts:{},weekly:null});state.message='Signed out.';});
  });
  host.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.target;
    if(form.dataset.form==='email'){state.email=form.email.value;return run(async()=>{state.email=await auth.sendEmail(state.email);state.view='code';});}
    if(form.dataset.form==='code')return run(async()=>{await auth.verifyCode(state.email,state.code=form.code.value);state.code='';track('sign_in',{method:'email_code'});state.message='Signed in. Your saved items are syncing.';await sync();});
  });
  // Keep typed values in state so any re-render shows them again.
  host.addEventListener('input',event=>{
    if(event.target.id==='account-email')state.email=event.target.value;
    else if(event.target.id==='account-code')state.code=event.target.value;
  });
  host.addEventListener('change',event=>{
    const box=event.target.closest('[data-weekly]');
    if(box){const previous=state.weekly,on=box.checked;state.weekly=on;
      auth.accessToken().then(token=>setWeekly(token,auth.session()?.user.id,on)).then(()=>{state.message=on?'Weekly email turned on.':'Weekly email turned off.';render();})
        .catch(()=>{state.weekly=previous;state.message='That setting did not save. Try again.';render();});
      return;}
    const select=event.target.closest('[data-alert]');if(!select)return;
    const query=select.dataset.alert,previous=state.alerts[query];state.alerts[query]=select.value;
    auth.accessToken().then(token=>setAlert(token,query,select.value)).then(()=>{if((previous||'off')==='off'&&select.value!=='off')track('alert_on',{frequency:select.value});state.message='Alert preference saved.';render();})
      .catch(()=>{state.alerts[query]=previous;state.message='That alert setting did not save. Try again.';render();});
  });
}

function init() {
  const toggle=document.querySelector('.main-nav #theme-toggle');
  if(!toggle)return;
  button=Object.assign(document.createElement('button'),{type:'button',className:'account-toggle'});
  button.setAttribute('aria-haspopup','dialog');
  toggle.before(button);
  // On /sign-in the card is part of the page; everywhere else it opens as a dialog.
  const page=document.getElementById('sign-in-app');
  if(page){host=page;inline=true;}
  else{
    host=dialog=Object.assign(document.createElement('dialog'),{className:'account-dialog'});
    dialog.setAttribute('aria-labelledby','account-title');
    document.body.append(dialog);
  }
  bind();render();
  if(inline)open();
  button.addEventListener('click',()=>{open();if(auth.session())sync();});
  // Any link marked data-account-open (e.g. "Create a free account") opens the same dialog.
  document.addEventListener('click',event=>{const link=event.target.closest('[data-account-open]');if(!link)return;event.preventDefault();open();if(auth.session())sync();});
  window.addEventListener('wilsy:saved',()=>{clearTimeout(debounce);debounce=setTimeout(sync,400);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();});
  window.addEventListener('online',()=>sync());
  window.addEventListener('storage',event=>{if(event.key===SESSION_KEY){render();if(auth.session())sync();}});
  auth.completeRedirect().then(session=>{
    if(session){let method='email_link';try{method=sessionStorage.getItem(METHOD_KEY)||method;sessionStorage.removeItem(METHOD_KEY);}catch{}track('sign_in',{method});open('Signed in. Your saved items are syncing.');}
    return sync();})
    .catch(error=>open(error.message));
}
init();
