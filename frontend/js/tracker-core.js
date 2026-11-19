// Application tracker: saved roles move through Saved → Applied → Interviewing → Offer (or Closed).
// Pure functions over a plain object kept in this browser's storage (wilsy-tracker). Each item keeps a
// small copy of the role, so it stays on the board after the listing closes and leaves the public search.
// Besides WILSY jobs (numeric ids), the board holds roles added by hand from any other site ("c-" ids).

export const TRACKER_KEY = 'wilsy-tracker';
export const TRACKER_LIMIT = 500;
export const STAGES = [
  ['saved', 'Saved'],
  ['applied', 'Applied'],
  ['interviewing', 'Interviewing'],
  ['offer', 'Offer'],
  ['closed', 'Closed'],
];
const STAGE_IDS = STAGES.map(([id]) => id);
const NOTE_LIMIT = 2000;
const VIA = ['saved', 'job', 'custom'];
const text = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isoOrNull = value => Number.isFinite(Date.parse(value || '')) ? new Date(value).toISOString() : null;
const localPath = value => /^\/jobs\/\d+-[a-z0-9-]*$/.test(String(value || '')) ? value : '';
const httpsUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
/** WILSY job ids are numbers; roles added by hand get "c-" and a few letters and digits. */
export const isCustom = id => /^c-[a-z0-9]{4,24}$/.test(String(id));
const validId = id => /^\d+$/.test(id) || isCustom(id);
// The next step on an application (an interview, a test, a call), with its date and time.
const cleanNext = next => { const at = next && typeof next === 'object' ? isoOrNull(next.at) : null; return at ? {what: text(next.what, 80) || 'Interview', at} : null; };

function cleanItem(id, item) {
  if(!validId(id) || !item || typeof item !== 'object') return null;
  const stage = STAGE_IDS.includes(item.stage) ? item.stage : 'saved';
  const history = {};
  for(const key of STAGE_IDS) { const at = isoOrNull(item.history?.[key]); if(at) history[key] = at; }
  return {
    id, stage, title: text(item.title) || 'Untitled role', company: text(item.company, 120) || 'Unknown company',
    path: isCustom(id) ? '' : localPath(item.path), apply: httpsUrl(item.apply), place: text(item.place, 120), pay: text(item.pay, 120),
    notes: String(item.notes ?? '').slice(0, NOTE_LIMIT), addedAt: isoOrNull(item.addedAt), updatedAt: isoOrNull(item.updatedAt), history,
    via: isCustom(id) ? 'custom' : VIA.includes(item.via) ? item.via : 'saved', next: cleanNext(item.next),
  };
}

/** The tracker stored in this browser, cleaned; an empty board when nothing (or nothing valid) is stored. */
export function readTracker(storage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(TRACKER_KEY) || 'null'); } catch { raw = null; }
  const items = {};
  for(const [id, item] of Object.entries(raw?.items || {})) { const clean = cleanItem(id, item); if(clean) items[id] = clean; }
  return {version: 1, items};
}
export const writeTracker = (storage, tracker) => storage.setItem(TRACKER_KEY, JSON.stringify(tracker));

/** The parts of a live job the board keeps. jobPath and pay come from jobs-core so cards match the rest of the site. */
export function snapshot(job, {path = '', pay = ''} = {}) {
  const place = job.location || [job.city, job.state_region, job.country].filter(Boolean).join(', ');
  return {title: text(job.title), company: text(job.company, 120), path: localPath(path), apply: httpsUrl(job.apply_url), place: text(place, 120), pay: text(pay, 120)};
}

/**
 * Bring the board in line with the saved list. New saved roles join as "Saved" (when their details are
 * known); roles that joined by being saved leave when they are unsaved while still at "Saved". Roles that
 * moved on stay, saved or not, and so do roles marked as applied on a job page or added by hand.
 * Known roles refresh their copy, so titles and pay follow the listing while it is live.
 */
export function syncSaved(tracker, savedIds, details = new Map(), now = new Date().toISOString()) {
  const items = {...tracker.items}, saved = new Set(savedIds.map(String));
  for(const [id, item] of Object.entries(items)) if(item.stage === 'saved' && !saved.has(id) && (item.via || 'saved') === 'saved') delete items[id];
  for(const id of saved) {
    const fresh = details.get(id);
    if(items[id] && fresh) items[id] = {...items[id], ...fresh};
    else if(!items[id] && fresh && Object.keys(items).length < TRACKER_LIMIT)
      items[id] = {id, stage: 'saved', via: 'saved', next: null, notes: '', addedAt: now, updatedAt: now, history: {saved: now}, ...fresh};
  }
  return {version: 1, items};
}

export function setStage(tracker, id, stage, now = new Date().toISOString()) {
  const item = tracker.items[id];
  if(!item || !STAGE_IDS.includes(stage) || item.stage === stage) return tracker;
  return {version: 1, items: {...tracker.items, [id]: {...item, stage, updatedAt: now, history: {...item.history, [stage]: item.history[stage] || now}}}};
}
export function setNotes(tracker, id, notes, now = new Date().toISOString()) {
  const item = tracker.items[id];
  if(!item) return tracker;
  return {version: 1, items: {...tracker.items, [id]: {...item, notes: String(notes ?? '').slice(0, NOTE_LIMIT), updatedAt: now}}};
}
export function removeItem(tracker, id) {
  const items = {...tracker.items}; delete items[id];
  return {version: 1, items};
}

/** "I applied": puts a WILSY job on the board at a stage (Applied by default), or moves it forward; never back. */
export function trackJob(tracker, job, stage = 'applied', now = new Date().toISOString()) {
  const id = String(job?.id ?? '');
  if(!/^\d+$/.test(id) || !STAGE_IDS.includes(stage)) return tracker;
  const item = tracker.items[id];
  if(item) return STAGE_IDS.indexOf(item.stage) >= STAGE_IDS.indexOf(stage) ? tracker : setStage(tracker, id, stage, now);
  if(Object.keys(tracker.items).length >= TRACKER_LIMIT) return tracker;
  return {version: 1, items: {...tracker.items, [id]: cleanItem(id, {...job, stage, via: 'job', addedAt: now, updatedAt: now, history: {[stage]: now}})}};
}

/** A role from any other site, added by hand. Returns the new board and the new id, or an error to show. */
export function addCustom(tracker, fields = {}, {now = new Date().toISOString(), id = 'c-' + Math.random().toString(36).slice(2, 12)} = {}) {
  const title = text(fields.title), company = text(fields.company, 120);
  if(!title && !company) return {tracker, id: null, error: 'Add the role or the company.'};
  if(Object.keys(tracker.items).length >= TRACKER_LIMIT) return {tracker, id: null, error: `The tracker holds up to ${TRACKER_LIMIT} roles. Remove a few closed ones first.`};
  if(!isCustom(id) || tracker.items[id]) return {tracker, id: null, error: 'Couldn’t add that role. Try again.'};
  const stage = STAGE_IDS.includes(fields.stage) ? fields.stage : 'applied';
  const item = cleanItem(id, {...fields, title, company, stage, addedAt: now, updatedAt: now, history: {[stage]: now}});
  return {tracker: {version: 1, items: {...tracker.items, [id]: item}}, id};
}

/** Set or clear (next = null) the next step on an application. */
export function setNext(tracker, id, next, now = new Date().toISOString()) {
  const item = tracker.items[id];
  if(!item) return tracker;
  return {version: 1, items: {...tracker.items, [id]: {...item, next: cleanNext(next), updatedAt: now}}};
}

/** Next steps from two hours ago to `days` ahead, soonest first. */
export function upcoming(tracker, now = Date.now(), days = 14) {
  return Object.values(tracker.items).filter(item => item.next && item.stage !== 'closed')
    .map(item => ({item, at: Date.parse(item.next.at)})).filter(({at}) => at >= now - 2 * 36e5 && at <= now + days * 864e5)
    .sort((a, b) => a.at - b.at).map(({item}) => item);
}

/** Items per stage, most recently changed first. */
export function columns(tracker) {
  const list = Object.values(tracker.items).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return STAGES.map(([id, name]) => ({id, name, items: list.filter(item => item.stage === id)}));
}

// Spreadsheet apps run cells that start with = + - @ as formulas; a leading apostrophe keeps them as text.
const cell = value => { let v = String(value ?? ''); if(/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const day = value => value ? value.slice(0, 10) : '';
const when = (iso, timeZone) => iso ? new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(iso)).replace(', ', ' ') : '';
export function toCsv(tracker, origin = 'https://www.wilsy.in', {timeZone} = {}) {
  const head = ['Stage', 'Role', 'Company', 'Location', 'Pay', 'Saved on', 'Applied on', 'Interviewing since', 'Offer on', 'Closed on', 'WILSY page', 'Apply link', 'Notes', 'Next step', 'Next step on'];
  const rows = columns(tracker).flatMap(col => col.items.map(item => [col.name, item.title, item.company, item.place, item.pay,
    day(item.history.saved || item.addedAt), day(item.history.applied), day(item.history.interviewing), day(item.history.offer), day(item.history.closed),
    item.path ? origin + item.path : '', item.apply, item.notes, item.next?.what || '', when(item.next?.at, timeZone)]));
  return [head, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

// Jobs shared to the installed app or sent by the bookmarklet arrive as a page title, some text and a link.
const SITE_NAMES = 'linkedin|naukri(?:\\.com)?|indeed(?:\\.com)?|glassdoor|wellfound|angellist|instahyre|internshala|foundit|monster|cutshort|hirist|iimjobs|unstop|apna|shine(?:\\.com)?|workindia|greenhouse|lever|ashby|workday|smartrecruiters|workable|careers?|jobs?';
const SITE_SUFFIX = new RegExp(`\\s*[|\\-–—·]\\s*(?:${SITE_NAMES})\\s*$`, 'i');
const ATS = [
  [/^(?:boards|job-boards)\.greenhouse\.io$/, path => path[0]], [/^jobs\.lever\.co$/, path => path[0]], [/^jobs\.ashbyhq\.com$/, path => path[0]],
  [/^apply\.workable\.com$/, path => path[0]], [/^jobs\.smartrecruiters\.com$/, path => path[0]], [/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/, (path, m) => m[1]],
];
const humanize = slug => String(slug || '').replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase()).trim();
/** The employer an applicant-tracking link belongs to ("jobs.lever.co/acme/…" → "Acme"), or "". */
export function companyFromUrl(url) {
  try {
    const u = new URL(url), path = u.pathname.split('/').filter(Boolean);
    for(const [host, pick] of ATS) { const m = u.hostname.match(host); if(m) return humanize(decodeURIComponent(pick(path, m) || '')).slice(0, 120); }
  } catch {}
  return '';
}
/** Role, company and link from what the share sheet sends: {title, text, url}. Best effort; the form stays editable. */
export function fromShare({title = '', text: body = '', url = ''} = {}) {
  const apply = httpsUrl(url) || httpsUrl(String(body).match(/https:\/\/[^\s<>"]+/)?.[0] || '');
  let name = text(title) || text(String(body).replace(/https?:\/\/\S+/g, ''), 300);
  for(let i = 0; i < 3 && SITE_SUFFIX.test(name); i++) name = name.replace(SITE_SUFFIX, '');
  name = name.replace(/^(?:job\s+application\s+for|apply\s+(?:now\s+)?for|job:)\s+/i, '');
  let role = name, company = '', place = '';
  const hiring = name.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+(.+))?$/i);
  const at = name.match(/^(.+)\s+(?:at|@)\s+(.+)$/i);
  const parts = name.split(/\s+[|\-–—]\s+/);
  if(hiring) [, company, role, place = ''] = hiring;
  else if(at) [, role, company] = at;
  else if(parts.length === 2) [role, company] = /lever\.co\//.test(apply) ? [parts[1], parts[0]] : parts;
  return {title: text(role), company: text(company, 120) || companyFromUrl(apply), place: text(place, 120), apply};
}
