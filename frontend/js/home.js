import {searchJobs,jobFacets} from './data-client.js';
import {readState,stateQuery,readSaved,filterKeys} from './jobs-core.js';
import {renderJobCard} from './job-card.js';
import {isEditing,savedNotice} from './ui-helpers.js';

// Preserve old root search/detail links after moving the workspace to /jobs.
const query = new URLSearchParams(location.search);
if([...filterKeys,'job','page','saved'].some(key=>query.has(key))) {
  location.replace('/jobs?'+stateQuery(readState(location.search))+location.hash);
} else {
  initHome();
}

function initHome() {
  const $ = s=>document.querySelector(s), initial=JSON.parse($('#home-initial-data').textContent);
  let rows=initial.jobs,companies=[],saved=[],lastUpdate=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  try{saved=readSaved(localStorage);}catch{}
  function updateSaved() {
    document.querySelectorAll('[data-save]').forEach(button=>{
      const active=saved.includes(button.dataset.save);
      button.hidden=false;button.textContent=active?'Saved':'Save';button.setAttribute('aria-pressed',String(active));
    });
    $('.home-saved-link').hidden=!saved.length;
  }
  const render = ()=>{$('#home-job-results').innerHTML=rows.slice(0,6).map(job=>renderJobCard(job,{companies,fx:initial.fx,saved,interactive:true})).join('');updateSaved();};
  function setCount(selector,value) {
    const el=$(selector),end=Number(value);if(!Number.isSafeInteger(end)||end<0)return;
    const start=Number(el.textContent.replace(/\D/g,''));
    if(reduced.matches||start===end){el.textContent=end.toLocaleString('en-IN');return;}
    const began=performance.now();
    const tick=time=>{const p=Math.min(1,(time-began)/500);el.textContent=Math.round(start+(end-start)*p).toLocaleString('en-IN');if(p<1&&!reduced.matches)requestAnimationFrame(tick);else el.textContent=end.toLocaleString('en-IN');};
    requestAnimationFrame(tick);
  }
  async function refresh() {
    if(document.hidden||isEditing(document.activeElement)||$('#home-job-results').contains(document.activeElement))return;
    lastUpdate=Date.now();
    const [result,stats]=await Promise.allSettled([searchJobs({}),jobFacets()]);
    if(result.status==='fulfilled'&&Array.isArray(result.value.jobs)){
      rows=result.value.jobs.slice(0,6);render();
      $('#home-jobs-status').textContent=rows.length?'Live collection refreshed. Confirm availability with the employer.':'No published roles right now. Explore company career pages while the collection updates.';
    } else $('#home-jobs-status').textContent='Live refresh unavailable. Showing the dated snapshot; check availability on the employer’s site.';
    if(stats.status==='fulfilled'){
      setCount('#stat-total',stats.value.total);setCount('#stat-companies',stats.value.companies_count);setCount('#stat-remote',stats.value.remote_count);
      $('#home-snapshot-status').textContent='Live totals refreshed · Feed previews are a dated snapshot.';
    }
  }
  mountPathTabs();mountManifesto();mountReveal();
  updateSaved();
  $('#home-job-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-save]');if(!button)return;
    const id=button.dataset.save,next=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];
    if(next.length>500){$('#home-jobs-status').textContent='Remove a saved role before adding more than 500.';return;}
    try{localStorage.setItem('wilsy-saved-jobs',JSON.stringify(next));saved=next;updateSaved();savedNotice(saved.includes(id)?'Role saved on this device.':'Role removed from saved.','/jobs?saved=1');}
    catch{$('#home-jobs-status').textContent='This browser is blocking storage. Open the role and bookmark its link instead.';}
  });
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!isEditing(document.activeElement)){event.preventDefault();$('#job-search').focus();}});
  window.addEventListener('storage',event=>{if(event.key==='wilsy-saved-jobs'){try{saved=readSaved(localStorage);}catch{}updateSaved();}});
  fetch('/data/company-index.json').then(r=>r.ok?r.json():[]).then(index=>{companies=index;return refresh();}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastUpdate>300000)refresh();});
  setInterval(refresh,300000);
}

function mountPathTabs() {
  const section=document.querySelector('.home-paths'),list=section?.querySelector('[role=tablist]');
  if(!list)return;
  const tabs=[...list.querySelectorAll('[role=tab]')],panels=tabs.map(tab=>document.getElementById(tab.getAttribute('aria-controls')));
  const select=(index,focus)=>{
    tabs.forEach((tab,i)=>{const on=i===index;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;panels[i].hidden=!on;});
    if(focus)tabs[index].focus();
  };
  list.hidden=false;section.classList.add('has-tabs');select(0,false);
  tabs.forEach((tab,i)=>tab.addEventListener('click',()=>select(i,false)));
  list.addEventListener('keydown',event=>{
    const current=tabs.indexOf(document.activeElement);if(current<0)return;
    const next={ArrowRight:current+1,ArrowLeft:current-1,Home:0,End:tabs.length-1}[event.key];
    if(next===undefined)return;event.preventDefault();select((next+tabs.length)%tabs.length,true);
  });
}

// Manifesto segments light up as they cross the middle of the viewport.
function mountManifesto() {
  const segments=[...document.querySelectorAll('.m-seg')];
  if(!segments.length||!document.documentElement.classList.contains('js-motion'))return;
  const update=()=>{const line=innerHeight*.62;segments.forEach(seg=>seg.classList.toggle('is-lit',seg.getBoundingClientRect().top<line));};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
}

function mountReveal() {
  if(!document.documentElement.classList.contains('js-motion'))return;
  const targets=document.querySelectorAll('.home-console,.home-section-heading,.home-path-grid,.home-studio-copy,.home-studio-frame,.home-giant,.home-why-grid article,.home-guide-card,.home-dsa-banner,.home-final-cta,.home-featured-rail');
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-in');observer.unobserve(entry.target);}},{rootMargin:'0px 0px -6% 0px',threshold:.06});
  targets.forEach((el,i)=>{el.classList.add('reveal');el.style.transitionDelay=el.matches('.home-why-grid article,.home-guide-card')?`${(i%3)*80}ms`:'';observer.observe(el);});
}
