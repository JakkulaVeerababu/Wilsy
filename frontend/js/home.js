import {searchJobs,jobFacets} from './data-client.js';
import {readState,stateQuery,readSaved,filterKeys} from './jobs-core.js';
import {renderJobCard} from './job-card.js';
import {isEditing,savedNotice,savedPlace,announceSaved} from './ui-helpers.js';

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
    el.textContent=end.toLocaleString('en-IN');
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
      // The totals are live now, so the summary carries today's date (India time).
      const now=new Date(),today=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(now);
      document.querySelectorAll('[data-snapshot-date]').forEach(el=>{el.textContent=today;el.dateTime=now.toISOString();});
    }
  }
  mountRailNav();
  updateSaved();
  $('#home-job-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-save]');if(!button)return;
    const id=button.dataset.save,next=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];
    if(next.length>500){$('#home-jobs-status').textContent='Remove a saved role before adding more than 500.';return;}
    try{localStorage.setItem('wilsy-saved-jobs',JSON.stringify(next));saved=next;updateSaved();announceSaved();savedNotice(saved.includes(id)?`Role saved ${savedPlace()}.`:'Role removed from saved.','/jobs?saved=1');}
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
