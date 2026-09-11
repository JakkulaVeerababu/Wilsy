import {PAGE_SIZE,initialState,stateSearch,findCompanies,pageSlice,safeHref,escapeHtml as esc} from './directory-core.js';

const $ = s => document.querySelector(s);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const link = (url) => esc(safeHref(url));
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n * 83.5);
const range = s => s.min===s.max ? money(s.min) : `${money(s.min)} – ${money(s.max)}`;
const tierNames = ['₹1.6Cr+','₹1.2Cr–1.6Cr','₹83L–1.2Cr','Below ₹83L'];
const tierBadge = n => `<span class="tier-badge tier-${n}">Tier ${n}</span>`;
const logo = (c,eager=false) => `<div class="company-logo"><img src="${link(c.logo)}" alt="${esc(c.name)} logo" width="48" height="48" loading="${eager?'eager':'lazy'}" decoding="async"></div>`;
let companies = [], state = initialState(location.search), data;

function updateAddress(){const q=stateSearch(state);history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash);}
function bindImageFallbacks(root){root.querySelectorAll('.company-logo img').forEach(img=>img.addEventListener('error',()=>{const text=document.createElement('span');text.className='logo-fallback';text.textContent=img.alt.replace(/ logo$/,'').slice(0,2).toUpperCase();text.setAttribute('aria-label',img.alt+' unavailable');img.replaceWith(text);},{once:true}));}
function renderTiers(){
  $('#tier-cards').innerHTML = [1,2,3,4].map(n=>`<button class="tier-card ${state.tier===n?'active':''}" type="button" data-tier="${n}" aria-pressed="${state.tier===n}"><span class="tier-card-top"><span class="tier-glyph level-${n}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="tier-card-title">Tier ${n}</span><span class="tier-card-count">${companies.filter(c=>c.tier===n).length} companies</span></span><span class="tier-card-bottom"><strong>${tierNames[n-1]}</strong><span>/ year</span>${icon('arrow')}</span></button>`).join('');
}
function initializeFilters(){
  const renderGroup=(field,id,values)=>{$(id).innerHTML=values.map(value=>`<label class="check-label"><input type="checkbox" data-filter="${field}" value="${esc(value)}"><span>${esc(value)}</span><span>${companies.filter(c=>c[field==='stages'?'stage':'sector']===value).length}</span></label>`).join('');};
  renderGroup('stages','#stage-filters',['Established','Growth','Startup']);
  renderGroup('sectors','#sector-filters',[...new Set(companies.map(c=>c.sector))].sort());
  $('#role').innerHTML='<option value="">All roles</option>'+[...new Set(companies.map(c=>c.role))].sort().map(role=>`<option>${esc(role)}</option>`).join('');
}
function synchronizeControls(){
  $('#search').value=state.query; $('#sort').value=state.sort; $('#region').value=state.region; $('#role').value=state.role; $('#remote').checked=state.remote;
  document.querySelectorAll('[data-filter]').forEach(el=>{el.checked=state[el.dataset.filter].includes(el.value);});
  for(const view of ['grid','list']){const el=$(`#${view}-view`);el.classList.toggle('selected',view===state.view);el.setAttribute('aria-pressed',view===state.view);}
}
function renderChips(){
  const chips=[];
  if(state.query) chips.push(['query',state.query,`Search: ${state.query}`]);
  if(state.tier) chips.push(['tier',String(state.tier),`Tier ${state.tier}`]);
  for(const group of ['sectors','stages'])state[group].forEach(v=>chips.push([group,v,v]));
  for(const group of ['region','role'])if(state[group])chips.push([group,state[group],state[group]]);
  if(state.remote)chips.push(['remote','1','Remote role listed']);
  $('#active-filters').innerHTML=chips.map(([type,value,label])=>`<button type="button" class="filter-chip" data-remove="${type}" data-value="${esc(value)}" aria-label="Remove ${esc(label)} filter">${esc(label)} ${icon('close')}</button>`).join('');
}
function card(c,i){
  const location=c.regions.find(r=>!['Remote','Partly Remote','Fully Remote','America / Canada'].includes(r))||c.location.split(';')[0];
  const tag2=c.remote?'Remote role listed':(c.tags[0]||c.role);
  return `<article class="company-card"><div class="card-body"><div class="company-card-top">${logo(c,i<3)}${tierBadge(c.tier)}</div><h3 class="company-title"><button type="button" data-company="${esc(c.id)}">${esc(c.name)}</button></h3><p class="card-sector">${esc(c.sector)}</p><p class="company-description">${esc(c.description)}</p><div class="card-tags"><span>${esc(c.stage)}</span><span>${esc(tag2)}</span></div><div class="card-pay"><p class="card-pay-label">${esc(c.payKind)} · example role</p><p class="card-pay-amount">${range(c.salary)}<span>/ yr</span></p><p class="card-role" title="${esc(c.sample.title)}">${esc(c.sample.title)}</p></div><button class="card-details-link" type="button" data-company="${esc(c.id)}">Salary details & source</button></div><div class="card-footer"><span class="card-location" title="${esc(c.location)}">${icon('pin')}<span>${esc(location)}</span></span><a class="careers-link" href="${link(c.careers)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${esc(c.name)} ${esc(c.careersHost)}" title="${esc(c.careersHost)}">${c.careersHost==='Company jobs on YC'?'YC careers':'Careers'} ${icon('arrow')}</a></div></article>`;
}
function renderPagination(total,pages){
  if(!total){$('#pagination').innerHTML='';return;}
  const nums=[...new Set([1,state.page-1,state.page,state.page+1,pages])].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
  let buttons='';let last=0;
  for(const n of nums){if(last&&n-last>1)buttons+='<span aria-hidden="true">…</span>';buttons+=`<button type="button" data-page="${n}" aria-label="Page ${n}" ${n===state.page?'aria-current="page"':''}>${n}</button>`;last=n;}
  $('#pagination').innerHTML=`<span class="pagination-info">Page ${state.page} of ${pages} · ${total.toLocaleString()} companies</span><div class="page-buttons"><button type="button" class="prev" data-page="${state.page-1}" aria-label="Previous page" ${state.page===1?'disabled':''}>${icon('chevron')}</button>${buttons}<button type="button" data-page="${state.page+1}" aria-label="Next page" ${state.page===pages?'disabled':''}>${icon('chevron')}</button></div>`;
}
function render(){
  const found=findCompanies(companies,state), paged=pageSlice(found,state.page);state.page=paged.page;
  $('#results-count').innerHTML=found.length?`Showing <strong>${(state.page-1)*PAGE_SIZE+1}–${Math.min(state.page*PAGE_SIZE,found.length)}</strong> of <strong>${found.length.toLocaleString()}</strong> companies`:'No matching companies';
  const grid=$('#company-grid');grid.classList.toggle('list-view',state.view==='list');grid.setAttribute('aria-busy','false');
  grid.innerHTML=paged.items.length?paged.items.map(card).join(''):`<div class="empty-state">${icon('search')}<h3>A different search might be the one.</h3><p>Try another company name or remove a filter.</p><button type="button" data-reset>Clear all filters</button></div>`;
  bindImageFallbacks(grid);renderPagination(found.length,paged.pages);renderChips();renderTiers();synchronizeControls();updateAddress();
}
function openDialog(dialog){if(dialog.open)return;dialog.showModal();document.body.classList.add('dialog-open');}
function showCompany(id){
  const c=companies.find(c=>c.id===id);if(!c)return;
  const s=c.sample;
  const facts=[['Role location',s.location],['Experience',s.experience],['Equity',s.equity],['Bonus / sign-on',s.bonus],['Company stage',c.stage],['Snapshot date',c.checkedAt]];
  $('#company-detail').innerHTML=`<div class="detail-header">${logo(c,true)}<div class="detail-title-row"><h2 id="detail-title">${esc(c.name)}</h2>${tierBadge(c.tier)}</div><p>${esc(c.description)}</p><div class="detail-meta"><span>${icon('building')}${esc(c.sector)}</span><span>${icon('pin')}${esc(c.location)}</span></div></div><div class="detail-content"><div class="detail-pay-head"><span>${esc(c.payKind.toUpperCase())} · INR / YEAR</span><a href="${link(s.source)}" target="_blank" rel="noopener noreferrer">View pay source ↗</a></div><p class="detail-pay-number">${range(c.salary)}<span>/ year</span></p><p class="sample-role">${esc(s.title)}</p><dl class="detail-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p class="detail-note">This published range applies to the example role above. It is not a company-wide average or a total compensation estimate. Confirm current availability, pay, and location requirements with the employer.</p><div class="detail-actions"><a class="primary-button" href="${link(c.careers)}" target="_blank" rel="noopener noreferrer">${c.careersHost==='Company jobs on YC'?'Company jobs on YC':'Visit company careers'} ${icon('arrow')}</a><a class="secondary-link" href="${link(c.website)}" target="_blank" rel="noopener noreferrer">Company website ↗</a></div>${c.jobs.length>1?`<section class="related-jobs"><h3>More published salary examples</h3>${c.jobs.filter(j=>j.source!==s.source).map(j=>`<a class="job-row" href="${link(j.source)}" target="_blank" rel="noopener noreferrer"><strong>${esc(j.title)} ↗</strong><span>${range(j.salary)} / yr · ${esc(j.location)}</span></a>`).join('')}</section>`:''}</div>`;
  bindImageFallbacks($('#company-detail'));openDialog($('#company-dialog'));
}
function reset(){state={...initialState(),view:state.view};render();}

document.addEventListener('click',event=>{
  const guide=event.target.closest('[data-guide]');if(guide){openDialog($('#guide-dialog'));return;}
  const close=event.target.closest('.dialog-close');if(close){close.closest('dialog').close();return;}
  const detail=event.target.closest('[data-company]');if(detail){showCompany(detail.dataset.company);return;}
  if(event.target.closest('[data-reset]')){reset();return;}
  const tier=event.target.closest('[data-tier]');if(tier){state.tier=state.tier===Number(tier.dataset.tier)?0:Number(tier.dataset.tier);state.page=1;render();$('#companies').scrollIntoView({block:'start',behavior:'smooth'});return;}
  const page=event.target.closest('[data-page]');if(page&&!page.disabled){state.page=Number(page.dataset.page);render();$('#companies').scrollIntoView({block:'start',behavior:'smooth'});return;}
  const chip=event.target.closest('[data-remove]');if(chip){const type=chip.dataset.remove,value=chip.dataset.value;if(Array.isArray(state[type]))state[type]=state[type].filter(v=>v!==value);else state[type]=type==='tier'?0:type==='remote'?false:'';state.page=1;render();}
});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
});
$('#search').addEventListener('input',e=>{state.query=e.target.value;state.page=1;render();});
$('#sort').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;render();});
for(const k of ['region','role'])$('#'+k).addEventListener('change',e=>{state[k]=e.target.value;state.page=1;render();});
$('#remote').addEventListener('change',e=>{state.remote=e.target.checked;state.page=1;render();});
$('#filters').addEventListener('change',e=>{if(!e.target.matches('[data-filter]'))return;const group=e.target.dataset.filter;state[group]=[...document.querySelectorAll(`[data-filter="${group}"]:checked`)].map(el=>el.value);state.page=1;render();});
$('#reset').addEventListener('click',reset);
for(const view of ['grid','list'])$('#'+view+'-view').addEventListener('click',()=>{state.view=view;render();});
$('#filter-toggle').addEventListener('click',()=>{const open=$('#filters').classList.toggle('open');$('#filter-toggle').setAttribute('aria-expanded',open);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus();}});
window.addEventListener('popstate',()=>{state=initialState(location.search);if(companies.length)render();});
async function load(){
  try{const response=await fetch('data/companies.json');if(!response.ok)throw new Error('Directory unavailable');data=await response.json();if(!Array.isArray(data.companies)||data.companies.length!==1000)throw new Error('Incomplete data');companies=data.companies;initializeFilters();render();}
  catch(error){$('#company-grid').setAttribute('aria-busy','false');$('#results-count').textContent='Directory unavailable';$('#company-grid').innerHTML=`<div class="empty-state">${icon('globe')}<h3>We couldn’t load the directory.</h3><p>Please check your connection and try again.</p><button type="button" id="retry">Try again</button></div>`;$('#retry').addEventListener('click',()=>{location.reload();});}
}
load();
