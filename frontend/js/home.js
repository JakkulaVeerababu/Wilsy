import {searchJobs,jobFacets} from './data-client.js';
import {escapeHtml as esc} from './directory-core.js';
import {readState,stateQuery,readSaved,filterKeys} from './jobs-core.js';
import {renderJobCard} from './job-card.js';
import {isEditing,savedNotice,savedPlace,announceSaved} from './ui-helpers.js';
import {track,filterSummary} from './analytics.js';

// Preserve old root search/detail links after moving the workspace to /jobs.
const query = new URLSearchParams(location.search);
if([...filterKeys,'job','page','saved'].some(key=>query.has(key))) {
  location.replace('/jobs?'+stateQuery(readState(location.search))+location.hash);
} else {
  initHome();
}

function initHome() {
  const $ = s=>document.querySelector(s), initial=JSON.parse($('#home-initial-data').textContent);
  let rows=initial.jobs,companies=[],saved=[],lastUpdate=0,tab='all',tabFilters={},tabRequest=0;
  const tabCache=new Map([['all',{jobs:initial.jobs}]]);
  try{saved=readSaved(localStorage);}catch{}
  function updateSaved() {
    document.querySelectorAll('[data-save]').forEach(button=>{
      const active=saved.includes(button.dataset.save);
      button.hidden=false;button.textContent=active?'Saved':'Save';button.setAttribute('aria-pressed',String(active));
    });
    $('.home-saved-link').hidden=!saved.length;
  }
  const render = ()=>{$('#home-job-results').innerHTML=rows.slice(0,6).map(job=>renderJobCard(job,{companies,fx:initial.fx,saved,interactive:true})).join('');updateSaved();};
  const showTabCount=(key,total)=>{const el=document.querySelector(`[data-job-tab="${key}"] [data-tab-count]`);if(el&&Number.isFinite(Number(total)))el.textContent=Number(total).toLocaleString('en-IN');};
  async function refresh(force=false) {
    if(!force&&(document.hidden||isEditing(document.activeElement)||$('#home-job-results').contains(document.activeElement)))return;
    lastUpdate=Date.now();
    const id=++tabRequest,key=tab,grid=$('#home-job-results');
    grid.setAttribute('aria-busy','true');
    const [result]=await Promise.allSettled([searchJobs(tabFilters)]);
    if(id!==tabRequest)return;
    grid.setAttribute('aria-busy','false');grid.classList.remove('is-loading');
    if(result.status==='fulfilled'&&Array.isArray(result.value.jobs)){
      tabCache.set(key,result.value);showTabCount(key,result.value.total);
      rows=result.value.jobs.slice(0,6);render();
      $('#home-jobs-status').textContent=rows.length?'Live collection refreshed. Confirm availability with the employer.':'No roles match this shortcut right now. Try another, or browse every job.';
    } else $('#home-jobs-status').textContent='Live refresh unavailable. Showing the dated snapshot; check availability on the employer’s site.';
  }
  // Shortcut tabs above the fresh roles: a cached result shows at once, then the live search replaces it.
  $('.home-job-tabs')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-job-tab]');if(!button||button.getAttribute('aria-pressed')==='true')return;
    document.querySelectorAll('[data-job-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    tab=button.dataset.jobTab;tabFilters=Object.fromEntries(new URLSearchParams(button.dataset.query));
    $('#home-jobs-all').href='/jobs'+(button.dataset.query?'?'+button.dataset.query:'');
    const cached=tabCache.get(tab);
    if(cached){rows=cached.jobs.slice(0,6);render();}else $('#home-job-results').classList.add('is-loading');
    $('#home-jobs-status').textContent='Loading roles…';
    refresh(true);
  });
  mountLogoMarquee();
  mountScrollLight();
  mountRailNav();
  mountStats();
  const suggest=mountSuggest(()=>companies);
  updateSaved();
  // The form loads /jobs, so the event is queued and sent from there.
  $('#job-search-form').addEventListener('submit',()=>{suggest.remember($('#job-search').value);track('search',{page:'home',filters:filterSummary({country:$('#job-location').value})},{beforeNavigate:true});});
  // Live counts for the hero, every country with roles, and names for the search suggestions.
  jobFacets().then(facets=>{
    setStat('total',facets.total);setStat('companies_count',facets.companies_count);setStat('remote_count',facets.remote_count);
    addCountries(facets.countries);suggest.setFacets(facets);
  }).catch(()=>{});
  $('#home-job-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-save]');if(!button)return;
    const id=button.dataset.save,next=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];
    if(next.length>500){$('#home-jobs-status').textContent='Remove a saved role before adding more than 500.';return;}
    try{localStorage.setItem('wilsy-saved-jobs',JSON.stringify(next));saved=next;updateSaved();announceSaved();savedNotice(saved.includes(id)?`Role saved ${savedPlace()}.`:'Role removed from saved.','/jobs?saved=1');if(saved.includes(id))track('job_save',{page:'home'});}
    catch{$('#home-jobs-status').textContent='This browser is blocking storage. Open the role and bookmark its link instead.';}
  });
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!isEditing(document.activeElement)){event.preventDefault();$('#job-search').focus();}});
  window.addEventListener('storage',event=>{if(event.key==='wilsy-saved-jobs'){try{saved=readSaved(localStorage);}catch{}updateSaved();}});
  fetch('/data/company-index.json').then(r=>r.ok?r.json():[]).then(index=>{companies=index;return refresh();}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastUpdate>300000)refresh();});
  setInterval(refresh,300000);
}

// Arrow buttons for the featured-company rail; they appear only when the rail actually scrolls.
function mountRailNav() {
  const rail=document.querySelector('.home-featured-rail'),nav=document.querySelector('.home-rail-nav');
  if(!rail||!nav)return;
  const [prev,next]=nav.querySelectorAll('button');
  const sync=()=>{const max=rail.scrollWidth-rail.clientWidth;nav.hidden=max<8;prev.disabled=rail.scrollLeft<8;next.disabled=rail.scrollLeft>max-8;};
  nav.addEventListener('click',event=>{const button=event.target.closest('[data-rail]');if(button)rail.scrollBy({left:Number(button.dataset.rail)*rail.clientWidth*.8,behavior:'smooth'});});
  rail.addEventListener('scroll',sync,{passive:true});addEventListener('resize',sync);sync();
}

// The employer logo loop: a pause button (remembered on this device), no motion while offscreen,
// and keyboard focus that never lands on a logo the loop has carried out of view.
function mountLogoMarquee() {
  const root=document.querySelector('[data-logo-marquee]');
  if(!root)return;
  const viewport=root.querySelector('.home-logo-viewport'),track=root.querySelector('.home-logo-track'),toggle=root.querySelector('.home-logo-toggle');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const setPaused=paused=>{
    root.classList.toggle('is-paused',paused);
    const label=paused?'Play the logo animation':'Pause the logo animation';
    toggle.setAttribute('aria-label',label);toggle.title=label;
  };
  try{setPaused(localStorage.getItem('wilsy-logo-motion')==='paused');}catch{}
  const syncMotion=()=>{toggle.hidden=reduce.matches;};
  syncMotion();reduce.addEventListener?.('change',syncMotion);
  root.classList.add('is-live');
  toggle.addEventListener('click',()=>{
    const paused=!root.classList.contains('is-paused');
    setPaused(paused);
    try{if(paused)localStorage.setItem('wilsy-logo-motion','paused');else localStorage.removeItem('wilsy-logo-motion');}catch{}
  });
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{for(const entry of entries)root.classList.toggle('is-offscreen',!entry.isIntersecting);}).observe(root);
  // Keyboard focus turns the loop's position into a scroll offset (nothing moves on screen), then centres each
  // focused logo, clear of the faded edges; when focus leaves, the loop resumes from the same spot.
  // Mouse clicks leave the loop alone.
  const keyboard=el=>{try{return el.matches(':focus-visible');}catch{return true;}};
  track.addEventListener('focusin',event=>{
    if(reduce.matches||!keyboard(event.target))return;
    if(!root.classList.contains('is-manual')){
      const x=new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      root.classList.add('is-manual');
      viewport.scrollLeft=-x;
    }
    event.target.scrollIntoView({block:'nearest',inline:'center'});
  });
  // Leaving the logos (to the pause button too) hands the position back to the loop, so Play works at once.
  track.addEventListener('focusout',event=>{
    if(!root.classList.contains('is-manual')||track.contains(event.relatedTarget))return;
    // One row is a third of the track (layout width, so page zoom or transforms do not skew it).
    const width=parseFloat(getComputedStyle(track).width)/3,duration=parseFloat(getComputedStyle(track).animationDuration)||0;
    const offset=width?viewport.scrollLeft%width:0;
    track.style.animationDelay=width&&duration?`${-(offset/width)*duration}s`:'';
    viewport.scrollLeft=0;
    root.classList.remove('is-manual');
  });
}

// Large statements light up word by word, in reading order, as they scroll into view: unlit words start
// when a block's top reaches the lower part of the screen and every word is lit by the time its bottom
// passes 60% of the screen height, so a block is fully readable before it reaches the middle.
// Words stay lit once lit. Without this script, or with reduced motion, every word is simply shown lit.
function mountScrollLight() {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce.matches||!('IntersectionObserver' in window))return;
  const blocks=[...document.querySelectorAll('[data-scroll-lit]')].map(el=>({el,words:[...el.querySelectorAll('.home-lw')],lit:0})).filter(b=>b.words.length);
  if(!blocks.length)return;
  const visible=new Set();
  // Runs on scroll directly: browsers send at most one scroll event per frame, and only on-screen blocks are measured.
  const update=()=>{
    if(!visible.size)return;
    const vh=innerHeight;
    for(const block of visible){
      const rect=block.el.getBoundingClientRect();
      const progress=Math.min(1,Math.max(0,(vh*.88-rect.top)/(rect.height+vh*.28)));
      const target=Math.round(progress*block.words.length);
      for(let i=block.lit;i<target;i++)block.words[i].classList.add('is-on');
      if(target>block.lit)block.lit=target;
      if(block.lit>=block.words.length)visible.delete(block);
    }
  };
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const block=blocks.find(b=>b.el===entry.target);
      if(entry.isIntersecting&&block.lit<block.words.length)visible.add(block);else visible.delete(block);
    }
    update();
  });
  for(const block of blocks){block.el.classList.add('is-lit-ready');observer.observe(block.el);}
  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',update);
  // If the reader switches reduced motion on, show everything lit at once.
  reduce.addEventListener?.('change',()=>{if(reduce.matches)for(const block of blocks)block.el.classList.remove('is-lit-ready');});
}

// ---------- Hero figures ----------
// The figures count up once when the page loads (not with reduced motion), then take live values.
const fmt=n=>Math.round(n).toLocaleString('en-IN');
function setStat(key,value){
  const el=document.querySelector(`[data-stat="${key}"]`),n=Number(value);
  if(!el||!Number.isFinite(n)||n<=0)return;
  el.dataset.value=String(n);
  if(!el.dataset.counting)el.textContent=fmt(n);
}
function mountStats(){
  const els=[...document.querySelectorAll('[data-stat]')];
  if(!els.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const start=performance.now(),duration=1200;
  let done=false;
  const finish=()=>{if(done)return;done=true;for(const el of els){delete el.dataset.counting;el.textContent=fmt(Number(el.dataset.value||0));}};
  for(const el of els){el.dataset.counting='1';el.textContent='0';}
  const step=now=>{
    if(done)return;
    const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);
    for(const el of els)el.textContent=fmt(Number(el.dataset.value||0)*ease);
    if(t<1)requestAnimationFrame(step);else finish();
  };
  requestAnimationFrame(step);
  // Background tabs may never run animation frames: the real figures still show.
  setTimeout(finish,duration+300);
}

// Countries with live roles that the hero list does not already name go under "More countries".
function addCountries(list){
  const select=document.querySelector('#job-location');
  if(!select||!Array.isArray(list)||select.querySelector('optgroup'))return;
  const have=new Set([...select.options].map(o=>o.value));
  const more=list.filter(c=>typeof c==='string'&&/^[A-Z][A-Za-z .'-]{1,40}$/.test(c)&&!have.has(c)&&!/^(Multiple|Europe|European Union|North America|USA)$/.test(c));
  if(!more.length)return;
  const group=document.createElement('optgroup');group.label='More countries';
  for(const c of more){const o=document.createElement('option');o.value=o.textContent=c;group.append(o);}
  select.append(group);
}

// ---------- Search suggestions ----------
// Recent searches (this device only), popular roles, hiring companies and skills, filtered as you type.
// Arrow keys move, Enter opens, Escape closes. Nothing typed leaves the browser until the search runs.
const RECENT_KEY='wilsy-recent-searches';
const ROLES=['Software engineer','Backend engineer','Frontend engineer','Full stack developer','Data scientist','Data analyst','Machine learning engineer','DevOps engineer','Product manager','Product designer','Android developer','iOS developer','QA engineer','Security engineer','Site reliability engineer','Business analyst','Technical writer','Sales','Customer success','Marketing'];
function readRecent(){try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,6):[];}catch{return [];}}
function mountSuggest(getCompanies){
  const input=document.querySelector('#job-search'),box=document.querySelector('#home-suggest'),form=input.form;
  let facets={companies:[],skills:[]},options=[],active=-1,timer;
  const norm=v=>String(v||'').toLowerCase().trim();
  const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  function remember(value){
    const v=String(value||'').trim().slice(0,80);if(!v)return;
    try{localStorage.setItem(RECENT_KEY,JSON.stringify([v,...readRecent().filter(x=>norm(x)!==norm(v))].slice(0,6)));}catch{}
  }
  const go=option=>{
    if(option.href){remember(option.label);location.href=option.href;return;}
    input.value=option.label;close();
    if(form.requestSubmit)form.requestSubmit();else form.submit();
  };
  function build(){
    const q=norm(input.value),match=v=>!q||norm(v).includes(q),starts=v=>norm(v).startsWith(q);
    const rank=list=>q?[...list.filter(starts),...list.filter(v=>!starts(v))]:list;
    const recent=readRecent().filter(match).slice(0,q?3:5).map(label=>({kind:'recent',label,group:'Recent searches'}));
    const roles=rank(ROLES.filter(match)).slice(0,4).map(label=>({kind:'role',label,group:'Popular roles'}));
    const names=q?rank([...new Set([...facets.companies,...getCompanies().map(c=>c?.name).filter(Boolean)])].filter(match)).slice(0,4):[];
    const companies=names.map(label=>({kind:'company',label,group:'Companies',href:'/jobs?company='+encodeURIComponent(label)}));
    const skills=q?rank(facets.skills.filter(match)).slice(0,3).map(label=>({kind:'skill',label,group:'Skills',href:'/jobs?skill='+encodeURIComponent(label)})):[];
    options=[...recent,...roles,...companies,...skills];
    if(!options.length){close();return;}
    let group='';
    box.innerHTML=options.map((o,i)=>{
      const head=o.group!==group?`<p class="home-suggest-group" role="presentation">${esc(o.group)}${o.kind==='recent'&&!q?'<button type="button" data-clear-recent tabindex="-1">Clear</button>':''}</p>`:'';
      group=o.group;
      return `${head}<div class="home-suggest-option" role="option" id="home-suggest-${i}" data-index="${i}" aria-selected="false"><span class="home-suggest-kind" data-kind="${o.kind}" aria-hidden="true"></span><span>${esc(o.label)}</span>${o.href?'<small>'+(o.kind==='company'?'Company':'Skill')+'</small>':''}</div>`;
    }).join('');
    active=-1;box.hidden=false;input.setAttribute('aria-expanded','true');
  }
  const highlight=i=>{
    active=i;
    box.querySelectorAll('[role="option"]').forEach(el=>el.setAttribute('aria-selected',String(Number(el.dataset.index)===i)));
    if(i>=0){input.setAttribute('aria-activedescendant','home-suggest-'+i);box.querySelector('#home-suggest-'+i)?.scrollIntoView({block:'nearest'});}
    else input.removeAttribute('aria-activedescendant');
  };
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(build,80);});
  input.addEventListener('focus',build);
  input.addEventListener('blur',()=>setTimeout(close,150));
  document.addEventListener('pointerdown',event=>{if(!box.hidden&&!form.contains(event.target))close();});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(box.hidden){build();if(box.hidden)return;}
      event.preventDefault();
      const n=options.length;highlight(event.key==='ArrowDown'?(active+1)%n:(active<=0?n-1:active-1));
    } else if(event.key==='Enter'&&!box.hidden&&active>=0){event.preventDefault();go(options[active]);}
    else if(event.key==='Escape'&&!box.hidden){event.preventDefault();close();}
  });
  // mousedown keeps focus in the field, so the list stays open until the choice lands.
  box.addEventListener('mousedown',event=>{
    event.preventDefault();
    if(event.target.closest('[data-clear-recent]')){try{localStorage.removeItem(RECENT_KEY);}catch{}build();return;}
    const el=event.target.closest('[role="option"]');if(el)go(options[Number(el.dataset.index)]);
  });
  box.addEventListener('mousemove',event=>{const el=event.target.closest('[role="option"]');if(el&&Number(el.dataset.index)!==active)highlight(Number(el.dataset.index));});
  return {remember,setFacets:f=>{facets={companies:Array.isArray(f?.companies)?f.companies.filter(v=>typeof v==='string'):[],skills:Array.isArray(f?.skills)?[...new Set(f.skills.filter(v=>typeof v==='string'))]:[]};}};
}
