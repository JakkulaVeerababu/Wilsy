import {searchJobs,jobFacets} from './data-client.js';
import {PAGE_SIZE,filterValue,filterKeys,readState,stateQuery,apiFilters,applyUrl,label,dateLabel,postingLabel,jobSalary,readSaved} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {usdTextToInr} from './pay-format.js';
import {site} from './site-config.js';
import {sourceText,copyPageLink,isEditing,savedNotice} from './ui-helpers.js';
import {SEARCH_KEY,readSearches,searchQuery,searchName,addSearch,toggleComparison} from './job-workspace-core.js';
import {renderJobCard,jobTags} from './job-card.js';

const $=s=>document.querySelector(s), dialog=$('#job-detail');
let state=readState(location.search),saved=[],companies=[],fx,rows=[],total=0,controller,requestId=0,lastFetch=0,detailRequest=0;
let searches=[],comparison=[],density='comfortable';
const initial=JSON.parse($('#jobs-initial-data').textContent);
fx=initial.fx;companies=initial.companies;
if(!stateQuery({...state,id:''})){rows=initial.jobs;total=initial.total;}
try{saved=readSaved(localStorage);}catch{}
try{searches=readSearches(localStorage);density=localStorage.getItem('wilsy-job-density')==='compact'?'compact':'comfortable';}catch{}
const feedback=text=>{$('#job-feedback').textContent=text;};
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const companyProfile=j=>companies.find(c=>c.id===j.company_slug)||companies.find(c=>normalized(c.name)===normalized(j.company));
function logo(j){const c=companyProfile(j);return c?.logo?`<span class="job-logo" aria-hidden="true"><img src="${e(c.logo)}" alt="" loading="lazy" decoding="async"></span>`:'';}
function bindLogos(root){root.querySelectorAll('.job-logo img').forEach(img=>img.addEventListener('error',()=>{img.parentNode.remove();},{once:true}));}
const place=j=>j.location||[j.city,j.state_region,j.country].filter(Boolean).join(', ')||'Location not specified';
const text=value=>value==null||value===''?'Not specified':String(value);
const bool=value=>value===true?'Stated by source':value===false?'Not offered (source record)':'Not specified';
const tags=jobTags;
function saveButton(j){const selected=saved.includes(String(j.id));return `<button class="job-save" type="button" data-save="${j.id}" aria-label="${selected?'Unsave':'Save'} ${e(j.title)} at ${e(j.company)}" aria-pressed="${selected}">${selected?'Saved':'Save'}</button>`;}
function card(j){
  return renderJobCard(j,{companies,fx,saved,comparison,interactive:true,compare:true});
}
function address(push=false){const q=stateQuery(state),url=location.pathname+(q?'?'+q:'');if(location.pathname+location.search!==url)history[push?'pushState':'replaceState'](null,'',url);}
function controls({preserveDraft=false}={}){
  if(!preserveDraft)$('#job-search').value=state.q;$('#job-sort').value=state.sort;
  for(const k of filterKeys){const el=$('#filter-'+k);if(el){if(el.type==='checkbox')el.checked=state[k]==='yes';else{if(state[k]&&el.tagName==='SELECT'&&![...el.options].some(o=>o.value===state[k]))el.add(new Option(label(state[k]),state[k]));el.value=state[k];}}}
  $('#filter-minimum').disabled=!state.period;
  document.querySelectorAll('[data-quick]').forEach(b=>b.setAttribute('aria-pressed',state[b.dataset.quick]===b.dataset.value));
  $('#saved-toggle').setAttribute('aria-pressed',state.saved);$('#saved-count').textContent=saved.length;
  $('#saved-toggle').hidden=!saved.length&&!state.saved;
  const active=filterKeys.filter(k=>state[k]&&k!=='sort');
  $('#job-active-filters').innerHTML=active.map(k=>`<button type="button" data-remove="${k}" aria-label="Remove ${e(k)} filter">${e(({q:'Search',minimum:'Minimum pay',time:'Posted',stage:'Career stage',mode:'Workplace',salary:'Salary disclosed',visa:'Visa sponsorship'})[k]||label(k))}: ${e(filterValue(k,state[k]))} ×</button>`).join('')+(state.saved?'<button type="button" data-remove="saved">Saved jobs ×</button>':'')+(active.length||state.saved?'<button type="button" data-clear>Clear all</button>':'');
  searchControls();
}
const workspaceMessage=message=>{$('#workspace-status').textContent=message;};
function searchControls(){
  const query=searchQuery(state),exists=searches.includes(query);
  $('#save-search').disabled=!query||exists;$('#save-search').textContent=exists?'Search saved':'Save this search';
  $('#searches-count').textContent=String(searches.length);
  $('#searches-count').hidden=!searches.length;
  $('#saved-search-list').innerHTML=searches.length?searches.map((q,i)=>`<div class="saved-search-item"><button type="button" data-reopen-search="${i}"><strong>${e(searchName(q))}</strong><span>View current matches</span></button><button type="button" data-delete-search="${i}" aria-label="Remove saved search: ${e(searchName(q))}">Remove</button></div>`).join(''):'<p class="saved-search-empty">Your next search, one click away. Choose a keyword or filter, then select “Save this search”.</p>';
}
function persistSearches(next){
  try{localStorage.setItem(SEARCH_KEY,JSON.stringify(next));searches=next;searchControls();return true;}
  catch{workspaceMessage('This browser is blocking storage. You can copy the search link instead.');return false;}
}
function displayDensity(value){
  density=value==='compact'?'compact':'comfortable';
  $('#job-results').classList.toggle('is-compact',density==='compact');
  document.querySelectorAll('[data-density]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.density===density)));
}
function comparisonControls(){
  $('#compare-tray').hidden=!comparison.length;document.body.classList.toggle('has-comparison',comparison.length>0);
  $('#compare-count').textContent=`${comparison.length} of 3 roles selected`;
  $('#compare-open').disabled=comparison.length<2;
  $('#compare-tray-items').innerHTML=comparison.map(j=>`<button type="button" data-compare="${j.id}" aria-label="Remove ${e(j.title)} at ${e(j.company)} from comparison"><span>${e(j.company)}</span><strong>${e(j.title)}</strong><span aria-hidden="true">×</span></button>`).join('');
  document.querySelectorAll('.job-compare').forEach(button=>{const active=comparison.some(j=>String(j.id)===button.dataset.compare);button.setAttribute('aria-pressed',String(active));button.textContent=active?'Selected':'Compare';});
}
function compareRole(id){
  const job=comparison.find(j=>String(j.id)===id)||rows.find(j=>String(j.id)===id);if(!job)return;
  const result=toggleComparison(comparison,job);
  if(result.error){$('#compare-status').textContent=result.error;workspaceMessage(result.error);return;}
  comparison=result.jobs;comparisonControls();$('#compare-status').textContent=`${comparison.length} roles selected. ${comparison.length<2?'Select one more role to compare.':'Ready to compare.'}`;
  if($('#compare-dialog').open){if(comparison.length<2)$('#compare-dialog').close();else{openComparison();$('#compare-close').focus();}}
}
function openComparison(){
  if(comparison.length<2)return;
  const facts=[['Compensation',j=>jobSalary(j,fx).primary],['Pay basis',j=>jobSalary(j,fx).secondary||'Not specified'],['Location',place],['Workplace',j=>label(j.work_mode)],['Job type',j=>label(j.job_type)],['Experience',j=>j.experience_text||(j.experience_min!=null?`${j.experience_min}${j.experience_max!=null?'–'+j.experience_max:'+'} years`:'Not specified')],['Seniority',j=>label(j.seniority_level)],['Skills',j=>[...new Set([...(j.skills||[]),...(j.tech_stack||[])])].slice(0,12).join(' · ')||'Not specified'],['Visa sponsorship',j=>bool(j.visa_sponsorship)],['Relocation',j=>bool(j.relocation_assistance)],['Posting / discovery',postingLabel],['Last recorded check',j=>dateLabel(j.last_verified_at||j.verified_at)]];
  $('#compare-table').innerHTML=`<caption class="sr-only">Compare ${comparison.length} selected job opportunities</caption><thead><tr><th scope="col">The details</th>${comparison.map(j=>`<th scope="col"><span>${e(j.company)}</span><strong>${e(j.title)}</strong>${applyUrl(j.apply_url)?`<a href="${e(applyUrl(j.apply_url))}" target="_blank" rel="noopener noreferrer" aria-label="Apply for ${e(j.title)} at ${e(j.company)}">Apply with employer</a>`:''}<button type="button" data-compare="${j.id}" aria-label="Remove ${e(j.title)} at ${e(j.company)} from comparison">Remove role</button></th>`).join('')}</tr></thead><tbody>${facts.map(([name,value])=>`<tr><th scope="row">${name}</th>${comparison.map(j=>`<td>${e(value(j))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  if(!$('#compare-dialog').open)$('#compare-dialog').showModal();
}
$('#save-search').addEventListener('click',()=>{const result=addSearch(searches,state);if(result.error){workspaceMessage(result.error);return;}if(persistSearches(result.searches))workspaceMessage('Search saved on this browser. Reopen it from Saved searches.');});
$('#share-search').addEventListener('click',async()=>{
  const query=stateQuery({...state,id:'',page:1,saved:false}),url=location.origin+location.pathname+(query?'?'+query:'');
  try{await navigator.clipboard.writeText(url);workspaceMessage('Search link copied. It opens these filters with current results.');}catch{workspaceMessage('Copy the page address from your browser to share this search.');}
});
$('#compare-open').addEventListener('click',openComparison);
$('#compare-clear').addEventListener('click',()=>{comparison=[];comparisonControls();$('#job-results-heading').focus({preventScroll:true});});
$('#compare-close').addEventListener('click',()=>$('#compare-dialog').close());
$('#compare-dialog').addEventListener('close',()=>($('#compare-open').disabled?$('#compare-clear'):$('#compare-open')).focus({preventScroll:true}));
displayDensity(density);searchControls();
function render(){
  $('#job-results').setAttribute('aria-busy','false');$('#job-count').textContent=`${total.toLocaleString()} ${state.saved?'saved ':''}opportunit${total===1?'y':'ies'}`;
  if(!rows.length){$('#job-results').innerHTML=`<div class="jobs-empty"><h3>${state.saved?'Your next move is worth saving.':'Let’s open up the possibilities.'}</h3><p>${state.saved?'Save roles with the Save button. Only currently published saved jobs are shown.':state.time?'No current listings match these employer posting dates and filters. Roles with unknown posting dates are excluded.':'No current jobs match this combination. Try a broader role, location, or fewer filters.'}</p><button type="button" data-clear>Explore all jobs</button></div>`;}
  else $('#job-results').innerHTML=rows.map(card).join('');
  bindLogos($('#job-results'));
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  $('#job-pagination').innerHTML=total?`<span>${(state.page-1)*PAGE_SIZE+1}–${Math.min(state.page*PAGE_SIZE,total)} of ${total.toLocaleString()}</span><div><button type="button" data-page="${state.page-1}" ${state.page===1?'disabled':''}>Previous</button><button type="button" data-page="${state.page+1}" ${state.page>=pages?'disabled':''}>Next</button></div>`:'';
}
async function refreshFacets(){
  try{const f=await jobFacets();$('#stat-total').textContent=f.total.toLocaleString();$('#stat-companies').textContent=f.companies_count.toLocaleString();$('#stat-remote').textContent=f.remote_count.toLocaleString();
    for(const [key,values] of [['company',f.companies],['country',f.countries.filter(v=>v!=='Multiple')],['skill',f.skills],['seniority',f.seniority]]){const el=$('#filter-'+key);el.innerHTML=`<option value="">All ${key==='company'?'companies':key==='country'?'countries':key==='skill'?'skills':'levels'}</option>`;for(const value of values)el.add(new Option(key==='seniority'?label(value):value,value));}
    controls({preserveDraft:true});
  }catch{feedback('Collection totals could not be refreshed. Job search can still be retried below.');}
}
async function load({facets=false,background=false}={}){
  const keepResults=background&&rows.length>0;
  const current=++requestId;controller?.abort();controller=new AbortController();
  controls({preserveDraft:background});$('#job-results').setAttribute('aria-busy','true');$('#job-connection').textContent='Refreshing current listings…';
  if(!keepResults){$('#job-results').innerHTML='<div class="job-skeleton" aria-hidden="true"></div><div class="job-skeleton" aria-hidden="true"></div><span class="sr-only">Loading matching roles</span>';$('#job-count').textContent='Job results';$('#job-pagination').innerHTML='';}
  try{const result=await searchJobs(apiFilters(state,saved,fx),(state.page-1)*PAGE_SIZE,controller.signal);if(current!==requestId)return;
    const changed=JSON.stringify(rows)!==JSON.stringify(result.jobs)||total!==result.total;rows=result.jobs;total=result.total;lastFetch=Date.now();
    if(state.page>1&&!rows.length&&total>0){state.page=Math.ceil(total/PAGE_SIZE);address();return load();}
    if(!keepResults||changed)render();else $('#job-results').setAttribute('aria-busy','false');$('#job-connection').textContent=`Listings updated ${dateLabel(result.as_of)}${state.sort==='posted'?' · Unknown posting dates appear last.':''}`;
  }catch(error){if(current!==requestId)return;if(keepResults){$('#job-results').setAttribute('aria-busy','false');$('#job-connection').innerHTML='Couldn’t refresh. Showing the previous results. <button type="button" data-retry>Retry live search</button>';return;}rows=[];$('#job-results').setAttribute('aria-busy','false');$('#job-count').textContent='Unable to load jobs';$('#job-connection').textContent='The live connection is temporarily unavailable.';$('#job-results').innerHTML='<div class="jobs-empty"><h3>Let’s reconnect.</h3><p>Your filters and saved jobs are safe. Retry the live search or explore the company directory while the connection returns.</p><button type="button" data-retry>Try again</button><p><a href="/companies">Browse company career links</a></p></div>';}
  if(facets)await refreshFacets();
}
function change(update){Object.assign(state,update,{page:1,id:''});feedback('');workspaceMessage('');address(true);load();}
function reset(){state=readState();address(true);feedback('');workspaceMessage('');load();}
function save(id){
  const next=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];
  if(next.length>500){feedback('You can save up to 500 roles on this device. Remove a saved role to add another.');return;}
  try{localStorage.setItem('wilsy-saved-jobs',JSON.stringify(next));saved=next;}catch{feedback('This browser is blocking local storage. Enable site storage to save jobs on this device.');return;}
  savedNotice(saved.includes(id)?'Job saved on this device.':'Job removed from saved.',location.pathname+'?saved=1');
  controls({preserveDraft:true});document.querySelectorAll(`[data-save="${id}"]`).forEach(b=>{const active=saved.includes(id);b.setAttribute('aria-pressed',active);b.textContent=active?'Saved':'Save';b.setAttribute('aria-label',active?'Unsave job':'Save job');});
  if(state.saved)load();
}
const detailPair=(name,value)=>`<div><dt>${e(name)}</dt><dd>${e(text(value))}</dd></div>`;
const section=(title,value)=>value?`<section class="job-detail-section"><h3>${e(title)}</h3><p>${e(value)}</p></section>`:'';
function detail(j){
  const pay=jobSalary(j,fx),profile=companyProfile(j),url=applyUrl(j.apply_url),source=applyUrl(j.source_url);
  const compensation=value=>j.salary_currency==='USD'?usdTextToInr(value,fx.rate):value;
  const locations=[place(j),...(j.locations||[]).map(l=>l.location||[l.city,l.state,l.country].filter(Boolean).join(', '))];
  return `<div class="job-detail-inner"><div class="job-detail-top">${logo(j)}<div><p class="job-detail-kicker">${e(j.company)} · ${e(j.source_name||label(j.ats_platform))}</p>${profile?`<a class="job-inline-link" href="/companies/${encodeURIComponent(profile.id)}">Explore company profile</a>`:''}</div>${saveButton(j)}</div><h2 id="job-detail-title">${e(j.title)}</h2><div class="job-card-tags">${tags(j)}</div><div class="job-detail-actions"><a href="${e(url)}" target="_blank" rel="noopener noreferrer">Apply on recruiting site</a><button type="button" id="copy-job">Copy link</button></div><p class="jobs-date-note">You’ll leave WILSY to apply. Confirm availability and requirements on the employer’s listing.</p><dl class="job-detail-data">${detailPair('Compensation',pay.primary)}${detailPair('Pay basis',pay.secondary||'See source')}${detailPair('Experience',j.experience_text||(j.experience_min!=null?`${j.experience_min}${j.experience_max!=null?'–'+j.experience_max:'+'} years`:null))}${detailPair('Seniority',j.seniority_level?label(j.seniority_level):null)}${detailPair('Department / team',[j.department,j.team].filter(Boolean).join(' / '))}${detailPair('Role family',j.role_family?label(j.role_family):j.category_name)}${detailPair('Visa sponsorship',bool(j.visa_sponsorship))}${detailPair('Relocation',bool(j.relocation_assistance))}</dl>${pay.note?`<p class="jobs-date-note">${e(pay.note)}. This is a currency conversion, not an Indian salary offer. <a href="/methodology#conversion">Methodology</a></p>`:''}${section('About the opportunity',sourceText(j.description)||'See the employer’s listing for the complete role description.')}${section('Skills & technology',[...new Set([...(j.skills||[]),...(j.tech_stack||[])])].join(' · '))}${section('Eligibility & education',[j.eligibility,j.education,j.graduation_years?.length?'Graduation years: '+j.graduation_years.join(', '):null].filter(Boolean).join('\n'))}${section('Locations',[...new Set(locations)].filter(Boolean).join('\n'))}${section('Remote eligibility',j.remote_regions?.join(', '))}${section('Compensation details',[compensation(j.salary_text),compensation(j.compensation_notes),j.equity_text?'Equity: '+compensation(j.equity_text):null,j.bonus_text?'Bonus: '+compensation(j.bonus_text):null].filter(Boolean).join('\n'))}<section class="job-detail-source"><h3>Source & freshness</h3><p><strong>Employer posting date:</strong> ${e(dateLabel(j.posted_at,{time:!['date_only','date','unknown'].includes(j.posted_at_precision)}))}${j.posted_at?' · '+e(j.posted_at_source||j.source_name||'Source')+' · '+e(label(j.posted_at_precision)):'. WILSY does not substitute discovery time.'}</p><p><strong>First found:</strong> ${e(dateLabel(j.first_seen_at||j.discovered_at))}</p><p><strong>Last recorded check:</strong> ${e(dateLabel(j.last_verified_at||j.verified_at))}</p><p><strong>Application deadline:</strong> ${e(dateLabel(j.deadline_at))}</p><p><strong>Company verification:</strong> ${j.is_company_verified?'Marked verified in source record':'Not recorded; confirm the employer on the recruiting site'}</p><p><strong>Job / requisition ID:</strong> ${e(j.requisition_id||j.external_job_id||'Not provided')}</p>${source?`<p><a href="${e(source)}" target="_blank" rel="noopener noreferrer">View source listing</a></p>`:''}<p><a href="mailto:${site.email}?subject=${encodeURIComponent('Job correction: '+j.id+' '+j.title)}">Report an outdated or incorrect listing</a></p></section></div>`;
}
async function openJob(id,{push=true}={}){
  const token=++detailRequest;state.id=String(id);address(push);
  const cached=rows.find(job=>String(job.id)===String(id));
  $('#job-detail-body').innerHTML='<div class="job-detail-inner"><h2 id="job-detail-title">Loading job details…</h2><p>Checking the current listing.</p></div>';if(!dialog.open)dialog.showModal();
  try{const result=await searchJobs({id:String(id)},0);if(token!==detailRequest||!dialog.open)return;const job=result.jobs[0];
    if(!job){$('#job-detail-body').innerHTML='<div class="job-detail-inner"><h2 id="job-detail-title">This role is no longer available.</h2><p>It may have closed or expired. Explore the current listings for another opportunity.</p></div>';return;}
    $('#job-detail-body').innerHTML=detail(job);bindLogos(dialog);dialog.scrollTop=0;
  }catch{
    if(token!==detailRequest||!dialog.open)return;
    if(cached){
      $('#job-detail-body').innerHTML=detail(cached);
      $('#job-detail-body .job-detail-actions').insertAdjacentHTML('afterend',`<div class="job-detail-notice" role="status"><p>Couldn’t refresh this listing. Showing the details already loaded. Confirm availability on the employer’s site.</p><button type="button" data-job="${e(id)}">Retry details</button></div>`);
      bindLogos(dialog);dialog.scrollTop=0;return;
    }
    $('#job-detail-body').innerHTML=`<div class="job-detail-inner"><h2 id="job-detail-title">Couldn’t load this role.</h2><p>Please retry the current source connection.</p><button type="button" data-job="${e(id)}">Retry details</button></div>`;
  }
}
$('#job-search-form').addEventListener('submit',event=>{event.preventDefault();change({q:$('#job-search').value.trim()});});
$('#job-filter-form').addEventListener('submit',e=>e.preventDefault());
$('#job-filter-form').addEventListener('change',event=>{const el=event.target;if(!filterKeys.includes(el.name))return;const value=el.type==='checkbox'?(el.checked?'yes':''):el.value;change({[el.name]:value,...(el.name==='period'?{minimum:''}:{})});});
$('#job-sort').addEventListener('change',event=>change({sort:event.target.value}));
$('#job-refresh').addEventListener('click',()=>{feedback('');load({facets:true});});
$('#saved-toggle').addEventListener('click',()=>change({saved:!state.saved}));
const filterDialog=$('#jobs-filter-dialog'),filterPanel=$('#jobs-filters'),filterHome=filterPanel.parentNode;
function closeFilters(){if(filterDialog.open)filterDialog.close();}
$('#job-filter-toggle').addEventListener('click',()=>{
  filterDialog.append(filterPanel);filterPanel.classList.add('open');filterDialog.showModal();
  document.body.classList.add('filters-open');$('#job-filter-toggle').setAttribute('aria-expanded','true');$('#job-filter-close').focus();
});
filterDialog.addEventListener('close',()=>{filterHome.prepend(filterPanel);filterPanel.classList.remove('open');document.body.classList.remove('filters-open');$('#job-filter-toggle').setAttribute('aria-expanded','false');$('#job-filter-toggle').focus({preventScroll:true});});
filterDialog.addEventListener('click',event=>{if(event.target===filterDialog)closeFilters();});
$('#job-filter-close').addEventListener('click',closeFilters);
$('#job-filter-apply').addEventListener('click',()=>{closeFilters();$('#job-results-heading').focus();$('#job-results-heading').scrollIntoView({block:'start'});});
matchMedia('(max-width:760px)').addEventListener('change',event=>{if(!event.matches)closeFilters();});
$('#job-detail-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{++detailRequest;const closedId=state.id;state.id='';address();(document.querySelector(`[data-job="${closedId}"]`)||$('#job-results-heading')).focus({preventScroll:true});});
document.addEventListener('click',event=>{
  const compare=event.target.closest('[data-compare]');if(compare){compareRole(compare.dataset.compare);return;}
  const view=event.target.closest('[data-density]');if(view){displayDensity(view.dataset.density);try{localStorage.setItem('wilsy-job-density',density);}catch{}return;}
  const reopen=event.target.closest('[data-reopen-search]');if(reopen){const query=searches[Number(reopen.dataset.reopenSearch)];if(!query)return;state=readState('?'+query);$('#saved-searches').open=false;workspaceMessage('Saved search restored. Showing current matches.');address(true);load();$('#job-results-heading').focus({preventScroll:true});return;}
  const removeSearch=event.target.closest('[data-delete-search]');if(removeSearch){if(persistSearches(searches.filter((_,i)=>i!==Number(removeSearch.dataset.deleteSearch)))){workspaceMessage('Saved search removed.');$('#saved-searches summary').focus();}return;}
  const saveEl=event.target.closest('[data-save]');if(saveEl){save(saveEl.dataset.save);return;}
  const job=event.target.closest('[data-job]');if(job){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();openJob(job.dataset.job);return;}
  const quick=event.target.closest('[data-quick]');if(quick){const key=quick.dataset.quick,value=quick.dataset.value;change({[key]:state[key]===value?(key==='sort'?'found':''):value});return;}
  const remove=event.target.closest('[data-remove]');if(remove){change({[remove.dataset.remove]:remove.dataset.remove==='saved'?false:''});return;}
  if(event.target.closest('[data-clear]')){reset();return;}
  if(event.target.closest('[data-retry]')){load({facets:true});return;}
  const page=event.target.closest('[data-page]');if(page&&!page.disabled){state.page=Number(page.dataset.page);state.id='';address(true);load();$('#job-results-heading').focus();$('#job-results-heading').scrollIntoView({block:'start'});return;}
  const copy=event.target.closest('#copy-job');if(copy)copyPageLink(copy,location.href,navigator.clipboard);
});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!document.querySelector('dialog[open]')&&!isEditing(document.activeElement)){event.preventDefault();$('#job-search').focus();}if(event.key==='Escape')$('#saved-searches').open=false;});
window.addEventListener('popstate',()=>{state=readState(location.search);if(!state.id&&dialog.open)dialog.close();load();if(state.id)openJob(state.id,{push:false});});
window.addEventListener('storage',event=>{if(event.key==='wilsy-saved-jobs'){try{saved=readSaved(localStorage);}catch{}controls();if(state.saved)load();else if(rows.length)render();}});
window.addEventListener('storage',event=>{if(event.key===SEARCH_KEY){try{searches=readSearches(localStorage);searchControls();}catch{}}});
document.addEventListener('click',event=>{if(!event.target.closest('.saved-searches'))$('#saved-searches').open=false;});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('dialog[open]')&&!isEditing(document.activeElement)&&Date.now()-lastFetch>300000)load({facets:true,background:true});});
setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]')&&!isEditing(document.activeElement))load({facets:true,background:true});},300000);

async function start(){
  controls();
  if(rows.length)render();
  // The server-rendered snapshot is useful offline; never discard it for an asset failure.
  fetch('/data/company-index.json').then(r=>r.ok?r.json():companies).then(index=>{companies=index;}).catch(()=>{});
  await Promise.all([load({background:rows.length>0}),refreshFacets()]);
  if(state.id)openJob(state.id,{push:false});
}
start();
