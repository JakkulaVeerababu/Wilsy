// Live list for the Competitions, Workshops & events, Free courses and Coding contests pages.
// <main data-kind> picks the section.
import {searchOpportunities,opportunityFacets} from './data-client.js';
import {KINDS,SUBTYPES,EVENT_SUBTYPES,COURSE_TOPICS,readOpportunityState,opportunityQuery,opportunityFilters,subtypeLabel,closingLabel,durationLabel,contestStatus,dayKey,contestIcs} from './opportunity-core.js';
import {escapeHtml as e} from './directory-core.js';
import {dateLabel,label,applyUrl} from './jobs-core.js';
import {site} from './site-config.js';
import {monogram,sourceText,copyPageLink,isEditing} from './ui-helpers.js';

const $=selector=>document.querySelector(selector);
const kind=(k=>Object.hasOwn(KINDS,k)?k:'competition')(document.querySelector('main[data-kind]')?.dataset.kind);
const config=KINDS[kind],dialog=$('#opp-detail');
let state=readOpportunityState(kind,location.search),items=[],total=0,collectionTotal=null,controller,request=0,detailRequest=0,lastRefresh=0;

const address=(push=false)=>{const query=opportunityQuery(kind,state),url=config.path+(query?'?'+query:'');if(location.pathname+location.search!==url)history[push?'pushState':'replaceState'](null,'',url);};
const shortText=value=>String(value||'').replace(/\s+/g,' ').trim();
const tags=values=>[...new Set(values.filter(Boolean))].map(value=>`<span>${e(value)}</span>`).join('');
const where=item=>item.participation_mode==='online'?'Online':[item.city,item.country].filter(Boolean).join(', ')||(item.participation_mode?label(item.participation_mode):'Format not specified');
const prize=item=>item.prize_amount>0?{amount:item.prize_text||`₹${Number(item.prize_amount).toLocaleString('en-IN')}`,note:'Cash prizes, as published'}:{amount:'Prize not stated in cash',note:'Certificates or other awards may apply; see the listing'};
const logo=item=>(m=>`<span class="event-logo event-mono mono mono-${m.tone}" aria-hidden="true">${e(m.letters)}</span>`)(monogram(item.organizer||item.title));
// Contest times read in the visitor's own time zone, with the zone named.
const time=value=>new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
const dayTitle=value=>new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date(value));
const team=item=>{const min=item.team_size_min,max=item.team_size_max;if(min==null&&max==null)return null;if(min===1&&max===1)return 'Solo';if(min===max)return `Teams of ${min}`;return `${min??1}–${max??'any'} people`;};

function competitionCard(item){
  const close=closingLabel(item.registration_deadline_at),p=prize(item),link=applyUrl(item.official_url);
  return `<article class="hack-card"><div class="hack-card-top">${logo(item)}<span class="hack-phase">${e(subtypeLabel(item)||'Competition')}</span>${close?`<span class="hack-closing${close.soon?' is-soon':''}">${e(close.text)}</span>`:''}</div>${item.organizer?`<p class="hack-organizer">${e(item.organizer)}</p>`:''}<h3><button type="button" data-opp-item="${item.id}">${e(item.title)}</button></h3><p class="hack-card-description">${e(shortText(item.description)||'Open the listing for the complete brief.')}</p><div class="hack-tags">${tags([where(item),team(item),...(item.tags||[]).slice(0,2)])}</div><div class="hack-prize${item.prize_amount>0?'':' is-undisclosed'}"><span>PRIZES</span><strong>${e(p.amount)}</strong></div><dl class="hack-card-dates"><div><dt>Registration closes</dt><dd>${e(dateLabel(item.registration_deadline_at,{time:false}))}</dd></div><div><dt>Source</dt><dd>${e(item.source_name)}</dd></div></dl><div class="hack-card-footer"><button type="button" data-opp-item="${item.id}">See details</button>${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer" aria-label="Register for ${e(item.title)} on ${e(item.source_name)}">Register</a>`:''}</div></article>`;
}
// Workshops, webinars and conferences: free to attend, so the card shows when registration closes instead of prizes.
function eventCard(item){
  const close=closingLabel(item.registration_deadline_at),link=applyUrl(item.official_url);
  return `<article class="hack-card"><div class="hack-card-top">${logo(item)}<span class="hack-phase">${e(subtypeLabel(item)||'Event')}</span>${close?`<span class="hack-closing${close.soon?' is-soon':''}">${e(close.text)}</span>`:''}</div>${item.organizer?`<p class="hack-organizer">${e(item.organizer)}</p>`:''}<h3><button type="button" data-opp-item="${item.id}">${e(item.title)}</button></h3><p class="hack-card-description">${e(shortText(item.description)||'Open the listing for the full programme.')}</p><div class="hack-tags">${tags([where(item),'Free to attend',...(item.tags||[]).slice(0,2)])}</div><dl class="hack-card-dates"><div><dt>Registration closes</dt><dd>${e(dateLabel(item.registration_deadline_at,{time:false}))}</dd></div><div><dt>Source</dt><dd>${e(item.source_name)}</dd></div></dl><div class="hack-card-footer"><button type="button" data-opp-item="${item.id}">See details</button>${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer" aria-label="Register for ${e(item.title)} on ${e(item.source_name)}">Register</a>`:''}</div></article>`;
}
// Courses open on the provider's own site; WILSY lists the facts and links there.
function courseCard(item){
  const link=applyUrl(item.official_url),length=durationLabel(item.duration_minutes);
  return `<article class="hack-card course-card"><div class="hack-card-top">${logo(item)}<span class="hack-phase">${e(subtypeLabel(item)||'Course')}</span></div>${item.organizer?`<p class="hack-organizer">${e(item.organizer)}</p>`:''}<h3>${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer">${e(item.title)}</a>`:e(item.title)}</h3>${item.description?`<p class="hack-card-description">${e(shortText(item.description))}</p>`:''}<div class="hack-tags">${tags([...(item.tags||[]).slice(0,3),length?`About ${length}`:null])}</div><dl class="hack-card-dates"><div><dt>Cost</dt><dd>Free to learn</dd></div><div><dt>Source</dt><dd>${e(item.source_name)}</dd></div></dl><div class="hack-card-footer">${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${e(item.title)} on ${e(item.source_name)}">Open on ${e(item.source_name)}</a>`:''}</div></article>`;
}
function contestRow(item){
  const status=contestStatus(item),link=applyUrl(item.official_url),length=durationLabel(item.duration_minutes);
  return `<li class="contest-row"><time datetime="${e(item.starts_at)}">${e(time(item.starts_at))}</time><div><p class="contest-meta"><span class="contest-source">${e(item.source_name)}</span>${subtypeLabel(item)?`<span>${e(subtypeLabel(item))}</span>`:''}${status?`<span class="hack-closing${status.soon?' is-soon':''}">${e(status.text)}</span>`:''}</p><h3>${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer">${e(item.title)}</a>`:e(item.title)}</h3><p class="contest-facts">${[length?`Length ${length}`:null,item.rated_range?`Rated range ${item.rated_range}`:null].filter(Boolean).map(e).join(' · ')}</p></div><div class="contest-actions"><button type="button" data-opp-ics="${item.id}">Add to calendar</button>${link?`<a href="${e(link)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${e(item.title)} on ${e(item.source_name)}">Open</a>`:''}</div></li>`;
}
function contestDays(list){
  const days=new Map();for(const item of list){const k=dayKey(item.starts_at);if(!days.has(k))days.set(k,[]);days.get(k).push(item);}
  return [...days.values()].map(day=>`<section class="contest-day"><h3>${e(dayTitle(day[0].starts_at))}</h3><ol class="contest-list">${day.map(contestRow).join('')}</ol></section>`).join('');
}
function sync({preserveDraft=false}={}){
  if($('#opp-q')&&!preserveDraft)$('#opp-q').value=state.q||'';
  if($('#opp-sort'))$('#opp-sort').value=state.sort||'soon';
  for(const k of ['subtype','mode','source']){const select=$('#opp-'+k);if(select)select.value=state[k]||'';}
  document.querySelectorAll('[data-opp-quick]').forEach(b=>b.setAttribute('aria-pressed',state[b.dataset.oppQuick]===b.dataset.value));
  const names={q:'Search',subtype:kind==='course'?'Topic':'Type',mode:'Format',when:kind==='contest'?'Dates':'Closes',cash:'Cash prizes',source:kind==='course'?'Source':'Platform'};
  const values={week:kind==='contest'?'Next 7 days':'Within 7 days',yes:'Stated',offline:'In person',...SUBTYPES,...EVENT_SUBTYPES,...COURSE_TOPICS};
  $('#opp-chips').innerHTML=config.filterKeys.filter(k=>state[k]&&k!=='sort').map(k=>`<button type="button" data-opp-remove="${k}">${e(names[k])}: ${e(values[state[k]]||label(state[k]))} ×</button>`).join('');
}
function render(){
  $('#opp-results').setAttribute('aria-busy','false');
  $('#opp-count').textContent=`${total.toLocaleString('en-IN')} ${total===1?config.plural.slice(0,-1):config.plural}`;
  if(items.length)$('#opp-results').innerHTML=kind==='contest'?contestDays(items):items.map({event:eventCard,course:courseCard}[kind]||competitionCard).join('');
  else $('#opp-results').innerHTML=`<div class="hack-empty"><p class="eyebrow">${collectionTotal===0?'THE COLLECTION IS GETTING STARTED':'A DIFFERENT DIRECTION'}</p><h3>${collectionTotal===0?`The first ${config.plural} are on their way.`:'Let’s widen the search.'}</h3><p>${collectionTotal===0?`New ${config.plural} appear here within an hour of being listed at the source.`:`No ${config.plural} match these filters right now.`}</p>${collectionTotal===0?'<div><a class="primary-button" href="/hackathons">Explore hackathons</a></div>':'<div><button type="button" data-opp-reset>Clear filters</button></div>'}</div>`;
  $('#opp-results').classList.toggle('contest-calendar',kind==='contest'&&items.length>0);
  const pages=Math.ceil(total/config.pageSize);
  $('#opp-pagination').innerHTML=total>config.pageSize?`<span>${(state.page-1)*config.pageSize+1}–${Math.min(state.page*config.pageSize,total)} of ${total}</span><div><button type="button" data-opp-page="${state.page-1}" ${state.page===1?'disabled':''}>Previous</button><button type="button" data-opp-page="${state.page+1}" ${state.page>=pages?'disabled':''}>Next</button></div>`:'';
}
async function facets(){
  try{
    const data=await opportunityFacets(kind);collectionTotal=data.total;
    $('#opp-stat-total').textContent=data.total.toLocaleString('en-IN');
    const [a,b]={contest:[data.sources?.Codeforces,data.sources?.AtCoder],course:[data.sources?.['Microsoft Learn'],data.sources?.NPTEL],
      event:[data.online,data.subtypes?.workshop]}[kind]||[data.online,data.cash];
    $('#opp-stat-a').textContent=(a||0).toLocaleString('en-IN');
    $('#opp-stat-b').textContent=(b||0).toLocaleString('en-IN');
    if(!items.length&&lastRefresh)render();
  }catch{/* the list still works without the counts */}
}
async function load(refresh=false,background=false){
  const keep=background&&items.length>0,current=++request;controller?.abort();controller=new AbortController();
  sync({preserveDraft:background});$('#opp-results').setAttribute('aria-busy','true');
  if(!keep){$('#opp-results').innerHTML='<div class="hack-skeleton"></div><div class="hack-skeleton"></div><div class="hack-skeleton"></div>';$('#opp-pagination').innerHTML='';}
  try{
    const result=await searchOpportunities(opportunityFilters(kind,state),{pageSize:config.pageSize,offset:(state.page-1)*config.pageSize,signal:controller.signal});
    if(current!==request)return;
    items=result.items;total=result.total;lastRefresh=Date.now();
    if(state.page>1&&!items.length&&total){state.page=Math.ceil(total/config.pageSize);address();return load();}
    render();$('#opp-connection').textContent=`Live collection · Refreshed ${dateLabel(result.as_of)}`;
  }catch(error){
    if(current!==request)return;
    $('#opp-results').setAttribute('aria-busy','false');
    // 404: the collection's database functions aren't published yet, so the section is still starting.
    if(/\(404\)/.test(error?.message||'')){items=[];total=0;collectionTotal=0;render();$('#opp-connection').textContent='This section is getting started.';return;}
    if(keep){$('#opp-connection').innerHTML='Couldn’t refresh. Showing the previous results. <button type="button" data-opp-retry>Retry</button>';return;}
    items=[];$('#opp-count').textContent=`Unable to load ${config.plural}`;$('#opp-connection').textContent='The live connection is temporarily unavailable.';
    $('#opp-results').innerHTML=`<div class="hack-empty"><h3>Let’s reconnect.</h3><p>Your filters are kept. Try the live connection again.</p><button type="button" data-opp-retry>Try again</button></div>`;
  }
  if(refresh)facets();
}
function change(values){Object.assign(state,values,{page:1,id:''});address(true);load();}

const pair=(key,value)=>value?`<div><dt>${e(key)}</dt><dd>${e(value)}</dd></div>`:'';
const section=(title,value)=>value?`<section class="hack-detail-section"><h3>${e(title)}</h3><p>${e(sourceText(value))}</p></section>`:'';
function details(item){
  const link=applyUrl(item.official_url),p=prize(item);
  const event=kind==='event',Noun=config.noun[0].toUpperCase()+config.noun.slice(1);
  const pool=event?'<div class="hack-detail-pool"><span>Cost</span><strong>Free to attend</strong><p>Events that charge a fee are left out</p></div>':`<div class="hack-detail-pool"><span>Prizes</span><strong>${e(p.amount)}</strong><p>${e(p.note)}</p></div>`;
  return `<div class="hack-detail-inner">${logo(item)}<p class="eyebrow">${e(item.organizer||(event?'WILSY EVENTS':'WILSY COMPETITIONS'))}</p><h2 id="opp-detail-title">${e(item.title)}</h2><div class="hack-tags">${tags([subtypeLabel(item),where(item),event?null:team(item)])}</div><div class="hack-detail-actions">${link?`<a class="primary-button" href="${e(link)}" target="_blank" rel="noopener noreferrer">Register on ${e(item.source_name)}</a>`:''}<button type="button" id="opp-copy">Copy link</button></div>${pool}<dl class="hack-detail-facts">${pair('Registration opens',item.registration_opens_at&&dateLabel(item.registration_opens_at))}${pair('Registration closes',item.registration_deadline_at&&dateLabel(item.registration_deadline_at))}${pair('Ends',item.ends_at&&item.ends_at!==item.registration_deadline_at&&dateLabel(item.ends_at))}${pair('Team size',event?null:team(item))}${pair('Format',where(item))}</dl>${section(`About the ${config.noun}`,item.description)}${section('Who can take part',item.eligibility)}${section(event?'Topics':'Skills',(item.tags||[]).join(' · '))}<section class="hack-provenance"><h3>Source</h3><p><strong>Listed on:</strong> ${e(item.source_name)}</p><p><strong>Last checked:</strong> ${e(dateLabel(item.last_seen_at))}</p><p><strong>First found:</strong> ${e(dateLabel(item.first_seen_at))}</p><p>${event?'Read the full programme and register on the organizer’s listing. WILSY lists only events that are free to attend.':'Read the full rules and register on the organizer’s listing. WILSY lists only competitions that are free to enter.'}</p><p><a href="mailto:${site.email}?subject=${encodeURIComponent(`${Noun} correction: ${item.id} ${item.title}`)}">Report an outdated or incorrect listing</a></p></section></div>`;
}
async function openItem(id,{push=true}={}){
  if(!dialog)return;
  const current=++detailRequest;state.id=String(id);address(push);
  $('#opp-detail-body').innerHTML=`<div class="hack-detail-inner"><h2 id="opp-detail-title">Loading the ${config.noun}…</h2></div>`;
  if(!dialog.open)dialog.showModal();
  try{
    const result=await searchOpportunities({kind,id:String(id)},{pageSize:1});
    if(current!==detailRequest||!dialog.open)return;
    $('#opp-detail-body').innerHTML=result.items[0]?details(result.items[0]):`<div class="hack-detail-inner"><h2 id="opp-detail-title">This ${config.noun} is no longer open.</h2><p>Its registration may have closed. Explore the current list for another one.</p></div>`;
    dialog.scrollTop=0;
  }catch{
    if(current!==detailRequest||!dialog.open)return;
    $('#opp-detail-body').innerHTML=`<div class="hack-detail-inner"><h2 id="opp-detail-title">Couldn’t load this ${config.noun}.</h2><button type="button" data-opp-item="${e(id)}">Try again</button></div>`;
  }
}
function downloadIcs(id){
  const item=items.find(i=>String(i.id)===String(id)),ics=item&&contestIcs(item);if(!ics)return;
  const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'})),a=document.createElement('a');
  a.href=url;a.download=`${String(item.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'contest'}.ics`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('#opp-search-form')?.addEventListener('submit',event=>{event.preventDefault();change({q:$('#opp-q').value.trim()});});
$('#opp-filter-form')?.addEventListener('submit',event=>event.preventDefault());
$('#opp-filter-form')?.addEventListener('change',event=>{if(config.filterKeys.includes(event.target.name))change({[event.target.name]:event.target.value});});
$('#opp-sort')?.addEventListener('change',event=>change({sort:event.target.value}));
$('#opp-refresh').addEventListener('click',()=>load(true));
$('#opp-close')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',()=>{++detailRequest;const closed=state.id;state.id='';address();(document.querySelector(`[data-opp-item="${closed}"]`)||$('#opp-results-heading')).focus({preventScroll:true});});
document.addEventListener('click',event=>{
  const quick=event.target.closest('[data-opp-quick]');if(quick){const k=quick.dataset.oppQuick;change({[k]:state[k]===quick.dataset.value?'':quick.dataset.value});return;}
  const item=event.target.closest('[data-opp-item]');if(item){openItem(item.dataset.oppItem);return;}
  const ics=event.target.closest('[data-opp-ics]');if(ics){downloadIcs(ics.dataset.oppIcs);return;}
  const remove=event.target.closest('[data-opp-remove]');if(remove){change({[remove.dataset.oppRemove]:''});return;}
  if(event.target.closest('[data-opp-reset]')){state=readOpportunityState(kind);address(true);load();return;}
  if(event.target.closest('[data-opp-retry]')){load(true);return;}
  const page=event.target.closest('[data-opp-page]');if(page&&!page.disabled){state.page=Number(page.dataset.oppPage);state.id='';address(true);load();$('#opp-results-heading').focus();$('#opp-results-heading').scrollIntoView({block:'start'});return;}
  const copy=event.target.closest('#opp-copy');if(copy)copyPageLink(copy,location.href,navigator.clipboard);
});
window.addEventListener('popstate',()=>{state=readOpportunityState(kind,location.search);if(!state.id&&dialog?.open)dialog.close();load();if(state.id)openItem(state.id,{push:false});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!dialog?.open&&!isEditing(document.activeElement)&&Date.now()-lastRefresh>300000)load(true,true);});
setInterval(()=>{if(!document.hidden&&!dialog?.open&&!isEditing(document.activeElement))load(true,true);},300000);
await Promise.all([load(),facets()]);
if(state.id&&dialog)openItem(state.id,{push:false});
