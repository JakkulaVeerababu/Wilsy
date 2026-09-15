import {searchJobs,jobFacets} from './data-client.js';
import {PAGE_SIZE,filterValue,filterKeys,readState,stateQuery,apiFilters,applyUrl,label,dateLabel,postingLabel,jobSalary,readSaved} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {usdTextToInr} from './pay-format.js';
import {site} from './site-config.js';
import {sourceText,copyPageLink,isEditing,savedNotice} from './ui-helpers.js';

const $=s=>document.querySelector(s), dialog=$('#job-detail');
let state=readState(location.search),saved=[],companies=[],fx,rows=[],total=0,controller,requestId=0,lastFetch=0,detailRequest=0;
try{saved=readSaved(localStorage);}catch{}
const feedback=text=>{$('#job-feedback').textContent=text;};
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const companyProfile=j=>companies.find(c=>c.id===j.company_slug)||companies.find(c=>normalized(c.name)===normalized(j.company));
function logo(j){const c=companyProfile(j);if(c?.logo)return `<span class="job-logo" aria-hidden="true"><img src="${e(c.logo)}" alt="" loading="lazy" decoding="async"></span>`;const domain=`${normalized(j.company)}.com`;return `<span class="job-logo" aria-hidden="true"><img src="https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${e(domain)}&size=128" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></span>`;}
function bindLogos(root){root.querySelectorAll('.job-logo img').forEach(img=>img.addEventListener('error',()=>{img.parentNode.remove();},{once:true}));}
const place=j=>j.location||[j.city,j.state_region,j.country].filter(Boolean).join(', ')||'Location not specified';
const text=value=>value==null||value===''?'Not specified':String(value);
const bool=value=>value===true?'Stated by source':value===false?'Not offered (source record)':'Not specified';
const description=j=>String(j.description||'Full role details on the employer’s site.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function tags(j){
  const known=value=>value&&!['unspecified','unknown','not specified'].includes(String(value).trim().toLowerCase());
  const values=[place(j),known(j.work_mode)?label(j.work_mode):null,known(j.job_type)?label(j.job_type):null,j.is_new_grad?'New grad':j.is_fresher?'Fresher':null];
  const seen=new Set();
  return values.filter(value=>{if(!value)return false;const key=value.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).map(value=>`<span ${value.toLowerCase()==='remote'?'class="remote-tag"':''}>${e(value)}</span>`).join('');
}
function saveButton(j){const selected=saved.includes(String(j.id));return `<button class="job-save" type="button" data-save="${j.id}" aria-label="${selected?'Unsave':'Save'} ${e(j.title)} at ${e(j.company)}" aria-pressed="${selected}">${selected?'Saved':'Save'}</button>`;}
function card(j){const pay=jobSalary(j,fx);return `<article class="job-result-card"><div class="job-card-heading"><div class="job-card-copy"><p class="job-company-line">${logo(j)}<span class="job-employer-name">${e(j.company)}</span>${j.is_company_verified?'<span class="job-company-badge">Employer verified</span>':''}</p><h3 class="job-card-title"><button type="button" data-job="${j.id}">${e(j.title)}</button></h3></div>${saveButton(j)}</div><div class="job-card-tags">${tags(j)}</div><p class="job-card-description">${e(description(j))}</p><div class="job-card-bottom"><div class="job-card-pay${pay.primary==='Salary not disclosed'?' is-undisclosed':''}"><strong>${e(pay.primary)}</strong>${pay.secondary?`<span>${e(pay.secondary)}</span>`:''}<span>${e([j.ats_platform?label(j.ats_platform):j.source_name||'Source linked',j.category_name||(j.role_family&&j.role_family!=='unspecified'?label(j.role_family):'')].filter(Boolean).join(' · '))}</span></div><div><p class="job-card-time">${e(postingLabel(j))}</p><div class="job-card-links"><button type="button" data-job="${j.id}">View details</button><a class="job-apply-link" href="${e(applyUrl(j.apply_url))}" target="_blank" rel="noopener noreferrer" aria-label="Apply for ${e(j.title)} at ${e(j.company)}">Apply</a></div></div></div></article>`;}
function address(push=false){const q=stateQuery(state),url=location.pathname+(q?'?'+q:'');if(location.pathname+location.search!==url)history[push?'pushState':'replaceState'](null,'',url);}
function controls({preserveDraft=false}={}){
  if(!preserveDraft)$('#job-search').value=state.q;$('#job-sort').value=state.sort;
  for(const k of filterKeys){const el=$('#filter-'+k);if(el){if(el.type==='checkbox')el.checked=state[k]==='yes';else{if(state[k]&&el.tagName==='SELECT'&&![...el.options].some(o=>o.value===state[k]))el.add(new Option(label(state[k]),state[k]));el.value=state[k];}}}
  $('#filter-minimum').disabled=!state.period;
  document.querySelectorAll('[data-quick]').forEach(b=>b.setAttribute('aria-pressed',state[b.dataset.quick]===b.dataset.value));
  $('#saved-toggle').setAttribute('aria-pressed',state.saved);$('#saved-count').textContent=saved.length;
  const active=filterKeys.filter(k=>state[k]&&k!=='sort');
  $('#job-active-filters').innerHTML=active.map(k=>`<button type="button" data-remove="${k}" aria-label="Remove ${e(k)} filter">${e(({q:'Search',minimum:'Minimum pay',time:'Posted',stage:'Career stage',mode:'Workplace',salary:'Salary disclosed',visa:'Visa sponsorship'})[k]||label(k))}: ${e(filterValue(k,state[k]))} ×</button>`).join('')+(state.saved?'<button type="button" data-remove="saved">Saved jobs ×</button>':'');
}
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
  if(!keepResults){$('#job-results').innerHTML='<div class="job-skeleton"></div><div class="job-skeleton"></div><div class="job-skeleton"></div>';$('#job-pagination').innerHTML='';}
  try{const result=await searchJobs(apiFilters(state,saved,fx),(state.page-1)*PAGE_SIZE,controller.signal);if(current!==requestId)return;
    const changed=JSON.stringify(rows)!==JSON.stringify(result.jobs)||total!==result.total;rows=result.jobs;total=result.total;lastFetch=Date.now();
    if(state.page>1&&!rows.length&&total>0){state.page=Math.ceil(total/PAGE_SIZE);address();return load();}
    if(!keepResults||changed)render();else $('#job-results').setAttribute('aria-busy','false');$('#job-connection').textContent=`Listings updated ${dateLabel(result.as_of)}${state.sort==='posted'?' · Unknown posting dates appear last.':''}`;
  }catch(error){if(current!==requestId)return;if(keepResults){$('#job-results').setAttribute('aria-busy','false');$('#job-connection').innerHTML='Couldn’t refresh. Showing the previous results. <button type="button" data-retry>Retry live search</button>';return;}rows=[];$('#job-results').setAttribute('aria-busy','false');$('#job-count').textContent='Unable to load jobs';$('#job-connection').textContent='The live connection is temporarily unavailable.';$('#job-results').innerHTML='<div class="jobs-empty"><h3>Let’s reconnect.</h3><p>Your filters and saved jobs are safe. Retry the live search or explore the company directory while the connection returns.</p><button type="button" data-retry>Try again</button><p><a href="/companies">Browse company career links</a></p></div>';}
  if(facets)await refreshFacets();
}
function change(update){Object.assign(state,update,{page:1,id:''});feedback('');address(true);load();}
function reset(){state=readState();address(true);feedback('');load();}
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
$('#job-filter-toggle').addEventListener('click',()=>{const open=$('#jobs-filters').classList.toggle('open');$('#job-filter-toggle').setAttribute('aria-expanded',open);if(open)$('#filter-role').focus();});
$('#job-filter-apply').addEventListener('click',()=>{$('#jobs-filters').classList.remove('open');$('#job-filter-toggle').setAttribute('aria-expanded','false');$('#job-results-heading').focus();$('#job-results-heading').scrollIntoView({block:'start'});});
$('#job-detail-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{++detailRequest;const closedId=state.id;state.id='';address();(document.querySelector(`[data-job="${closedId}"]`)||$('#job-results-heading')).focus({preventScroll:true});});
document.addEventListener('click',event=>{
  const saveEl=event.target.closest('[data-save]');if(saveEl){save(saveEl.dataset.save);return;}
  const job=event.target.closest('[data-job]');if(job){openJob(job.dataset.job);return;}
  const quick=event.target.closest('[data-quick]');if(quick){const key=quick.dataset.quick,value=quick.dataset.value;change({[key]:state[key]===value?(key==='sort'?'found':''):value});return;}
  const remove=event.target.closest('[data-remove]');if(remove){change({[remove.dataset.remove]:remove.dataset.remove==='saved'?false:''});return;}
  if(event.target.closest('[data-clear]')){reset();return;}
  if(event.target.closest('[data-retry]')){load({facets:true});return;}
  const page=event.target.closest('[data-page]');if(page&&!page.disabled){state.page=Number(page.dataset.page);state.id='';address(true);load();$('#job-results-heading').focus();$('#job-results-heading').scrollIntoView({block:'start'});return;}
  const copy=event.target.closest('#copy-job');if(copy)copyPageLink(copy,location.href,navigator.clipboard);
});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#job-search').focus();}});
window.addEventListener('popstate',()=>{state=readState(location.search);if(!state.id&&dialog.open)dialog.close();load();if(state.id)openJob(state.id,{push:false});});
window.addEventListener('storage',event=>{if(event.key==='wilsy-saved-jobs'){try{saved=readSaved(localStorage);}catch{}controls();if(state.saved)load();else if(rows.length)render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!dialog.open&&!isEditing(document.activeElement)&&Date.now()-lastFetch>300000)load({facets:true,background:true});});
setInterval(()=>{if(!document.hidden&&!dialog.open&&!isEditing(document.activeElement))load({facets:true,background:true});},300000);

async function start(){
  try{const [rate,index]=await Promise.all([fetch('/data/exchange-rate.json'),fetch('/data/company-index.json')]);if(!rate.ok||!index.ok)throw new Error('Site assets unavailable');fx=await rate.json();companies=await index.json();await Promise.all([load(),refreshFacets()]);if(state.id)openJob(state.id,{push:false});}
  catch{$('#job-results').setAttribute('aria-busy','false');$('#job-count').textContent='Site data unavailable';$('#job-connection').textContent='Reload the page to try again.';$('#job-results').innerHTML='<div class="jobs-empty"><h3>Please reload WILSY.</h3><p>The page assets could not be loaded. Check your connection and try again.</p><a href="/">Reload jobs</a></div>';}
}
start();
