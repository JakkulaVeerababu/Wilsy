// Funnel events for Vercel Web Analytics (docs/analytics-events.md lists them).
// window.va is defined only on Vercel deployments, so everywhere else track() does nothing.
// Events never carry personal data: no emails, ids or typed text, only the short values below.
// Vercel Pro records 2 properties per event, so each event has at most 2.
export const EVENTS = ['search','job_open','apply_click','job_save','search_save','sign_in','alert_on','app_install','share','referral','tracker_move'];
const ROLES = ['software-engineering','backend','frontend','ai-ml','genai','data','devops-cloud','cybersecurity','ece-core','vlsi','embedded'];
const STAGES = ['internship','fresher','new-grad','apprenticeship'];
const MODES = ['remote','hybrid','onsite'];
const COUNTRIES = ['India','United States','United Kingdom','Canada','Germany','Singapore','Australia','Netherlands','Ireland','France','United Arab Emirates','Japan'];
const QUEUE_KEY = 'wilsy-pending-events';
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const pick = (value,allowed) => allowed.includes(value) ? slug(value) : 'other';

// "role:backend,stage:fresher,country:india,mode:remote" in a fixed order, or "none".
export function filterSummary(filters = {}) {
  const parts = [['role',ROLES],['stage',STAGES],['country',COUNTRIES],['mode',MODES]]
    .filter(([key]) => filters[key]).map(([key,allowed]) => `${key}:${pick(filters[key],allowed)}`);
  return parts.join(',') || 'none';
}
export const jobMode = job => MODES.includes(job?.work_mode) ? job.work_mode : 'unknown';

export function eventData(data = {}) {
  const clean = {};
  for(const [key,value] of Object.entries(data)) {
    if(Object.keys(clean).length === 2) break;
    if(typeof value === 'string') clean[key] = value.slice(0,120);
    else if(typeof value === 'number' || typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}
const send = (name,data) => { try{ globalThis.window?.va?.('event',{name,data}); }catch{} };

// beforeNavigate: the page is about to unload (a form that loads /jobs), so the event waits in
// sessionStorage and the next page sends it.
export function track(name, data = {}, {beforeNavigate = false} = {}) {
  if(!EVENTS.includes(name)) return;
  const clean = eventData(data);
  if(beforeNavigate) {
    try{
      const queue = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]');
      sessionStorage.setItem(QUEUE_KEY, JSON.stringify([...(Array.isArray(queue) ? queue : []), {name,data:clean}].slice(-5)));
      return;
    }catch{}
  }
  send(name, clean);
}

export function pageKind(pathname = '/') {
  if(pathname === '/') return 'home';
  if(pathname === '/jobs') return 'jobs';
  if(/^\/jobs\/\d+-/.test(pathname)) return 'job';
  if(pathname.startsWith('/jobs/')) return 'landing';
  if(pathname.startsWith('/companies')) return 'company';
  return 'other';
}
// Links that leave WILSY for the employer's application page, by where they sit.
export const APPLY_LINKS = [
  ['.job-result-card .job-apply-link','card'],
  ['.job-detail-actions a[target="_blank"]:not([data-share-whatsapp])','dialog'],
  ['.job-page-actions a[target="_blank"]:not([data-share-whatsapp])','job_page'],
  ['.compare-table a[target="_blank"]','compare'],
];
export function applySource(link) {
  if(!link?.matches || !/^https:\/\//.test(link.getAttribute('href') || '')) return '';
  return APPLY_LINKS.find(([selector]) => link.matches(selector))?.[1] || '';
}

if(globalThis.document) {
  try{
    const queue = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]');
    sessionStorage.removeItem(QUEUE_KEY);
    if(Array.isArray(queue)) for(const event of queue) if(EVENTS.includes(event?.name)) send(event.name, eventData(event.data));
  }catch{}
  // Middle-click opens a tab too, so auxclick counts as well as click.
  const onApply = event => {
    if(event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest?.('a[href]'), from = applySource(link);
    if(from) track('apply_click',{from,page:pageKind(location.pathname)});
  };
  document.addEventListener('click', onApply, true);
  document.addEventListener('auxclick', onApply, true);
}
