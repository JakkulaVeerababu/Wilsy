// Application tracker: saved roles move through Saved → Applied → Interviewing → Offer (or Closed).
// Pure functions over a plain object kept in this browser's storage (wilsy-tracker). Each item keeps a
// small copy of the role, so it stays on the board after the listing closes and leaves the public search.

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
const text = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isoOrNull = value => Number.isFinite(Date.parse(value || '')) ? new Date(value).toISOString() : null;
const localPath = value => /^\/jobs\/\d+-[a-z0-9-]*$/.test(String(value || '')) ? value : '';
const httpsUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };

function cleanItem(id, item) {
  if(!/^\d+$/.test(id) || !item || typeof item !== 'object') return null;
  const stage = STAGE_IDS.includes(item.stage) ? item.stage : 'saved';
  const history = {};
  for(const key of STAGE_IDS) { const at = isoOrNull(item.history?.[key]); if(at) history[key] = at; }
  return {
    id, stage, title: text(item.title) || 'Untitled role', company: text(item.company, 120) || 'Unknown company',
    path: localPath(item.path), apply: httpsUrl(item.apply), place: text(item.place, 120), pay: text(item.pay, 120),
    notes: String(item.notes ?? '').slice(0, NOTE_LIMIT), addedAt: isoOrNull(item.addedAt), updatedAt: isoOrNull(item.updatedAt), history,
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
 * known); roles still at "Saved" leave when they are unsaved. Roles that moved on stay, saved or not.
 * Known roles refresh their copy, so titles and pay follow the listing while it is live.
 */
export function syncSaved(tracker, savedIds, details = new Map(), now = new Date().toISOString()) {
  const items = {...tracker.items}, saved = new Set(savedIds.map(String));
  for(const [id, item] of Object.entries(items)) if(item.stage === 'saved' && !saved.has(id)) delete items[id];
  for(const id of saved) {
    const fresh = details.get(id);
    if(items[id] && fresh) items[id] = {...items[id], ...fresh};
    else if(!items[id] && fresh && Object.keys(items).length < TRACKER_LIMIT)
      items[id] = {id, stage: 'saved', notes: '', addedAt: now, updatedAt: now, history: {saved: now}, ...fresh};
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

/** Items per stage, most recently changed first. */
export function columns(tracker) {
  const list = Object.values(tracker.items).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return STAGES.map(([id, name]) => ({id, name, items: list.filter(item => item.stage === id)}));
}

// Spreadsheet apps run cells that start with = + - @ as formulas; a leading apostrophe keeps them as text.
const cell = value => { let v = String(value ?? ''); if(/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const day = value => value ? value.slice(0, 10) : '';
export function toCsv(tracker, origin = 'https://www.wilsy.in') {
  const head = ['Stage', 'Role', 'Company', 'Location', 'Pay', 'Saved on', 'Applied on', 'Interviewing since', 'Offer on', 'Closed on', 'WILSY page', 'Apply link', 'Notes'];
  const rows = columns(tracker).flatMap(col => col.items.map(item => [col.name, item.title, item.company, item.place, item.pay,
    day(item.history.saved || item.addedAt), day(item.history.applied), day(item.history.interviewing), day(item.history.offer), day(item.history.closed),
    item.path ? origin + item.path : '', item.apply, item.notes]));
  return [head, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
