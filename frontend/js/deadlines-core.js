import {escapeHtml as e} from './directory-core.js';
import {calendarActions, deadlineDay} from './calendar-core.js';
import {site} from './site-config.js';

// The deadlines calendar: last dates from every section, soonest first. Government notices, scholarships
// and research internships come with the page, from WILSY's reviewed lists; hackathons and competitions load
// live. A yyyy-mm-dd deadline closes at the end of that day in India.

export const DEADLINE_KINDS = [['hackathon', 'Hackathons'], ['competition', 'Competitions'], ['government', 'Government jobs'], ['scholarship', 'Scholarships'], ['research', 'Research internships']];
const KIND_NAME = {hackathon: 'Hackathon', competition: 'Competition', government: 'Government job', scholarship: 'Scholarship', research: 'Research internship'};
export const BUCKETS = [['today', 'Closing today'], ['week', 'In the next 7 days'], ['month', 'In the next 30 days'], ['later', 'Later']];
/** How many of the soonest hackathons and competitions the page loads (about a week's worth), and how many
 *  rows a group shows before "Show all". */
export const LIVE_LIMIT = 48;
export const BUCKET_ROWS = 8;

const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);
/** When a deadline closes, as a timestamp; NaN when it has none. */
export function closesAt(value) {
  const text = String(value ?? '').trim();
  if(!text) return NaN;
  return Date.parse(isDay(text) ? text + 'T23:59:59+05:30' : text);
}

/** Deadlines from the reviewed data files: government notices, scholarships and research internships. */
export function staticDeadlines({government = [], scholarships = [], research = []} = {}) {
  const out = [];
  for(const job of government) if(job.deadline) out.push({id: 'government-' + job.id, kind: 'government', title: job.title, org: job.organization || '', deadline: job.deadline, url: '/government-jobs', source: job.officialNoticeUrl || job.sourceUrl || ''});
  for(const [kind, list, base] of [['scholarship', scholarships, '/scholarships/'], ['research', research, '/research-internships/']])
    for(const p of list) if(p.next?.closes) out.push({id: `${kind}-${p.slug}`, kind, title: p.name, org: p.organizer || '', deadline: p.next.closes, url: base + p.slug, source: p.url || ''});
  return out;
}

/** A hackathon or competition from the live search, or null without a registration deadline. */
export function liveDeadline(kind, item) {
  const deadline = item?.registration_deadline_at;
  if(!deadline || !item.title || item.id == null) return null;
  const url = kind === 'hackathon' ? `/hackathons?event=${encodeURIComponent(item.id)}` : `/competitions?item=${encodeURIComponent(item.id)}`;
  return {id: `${kind}-${item.id}`, kind, title: item.title, org: item.organizer || '', deadline, url, source: item.registration_url || item.official_url || item.source_url || ''};
}

/** Deadlines still open at `now`, soonest first, each once. */
export function upcoming(items, now = Date.now()) {
  const seen = new Set();
  return items.filter(item => {
    if(!item?.title || !(closesAt(item.deadline) >= now) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => closesAt(a.deadline) - closesAt(b.deadline) || a.title.localeCompare(b.title));
}

const IST = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'});
const days = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5);
/** Calendar days left in India: 0 on the last day, 1 the day before. */
export const daysLeft = (deadline, now = Date.now()) => days(IST.format(new Date(now)), deadlineDay(deadline));
export function bucketOf(deadline, now = Date.now()) {
  const left = daysLeft(deadline, now);
  return left <= 0 ? 'today' : left <= 7 ? 'week' : left <= 30 ? 'month' : 'later';
}
export const daysLeftLabel = left => left <= 0 ? 'Closes today' : left === 1 ? 'Closes tomorrow' : `${left} days left`;

const PARTS = new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
const TIME = new Intl.DateTimeFormat('en-IN', {hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'});
/** "by 5:00 pm" when a deadline closes before the end of its day in India. */
export function closingTime(deadline) {
  if(isDay(String(deadline))) return '';
  const time = closesAt(deadline);
  if(!Number.isFinite(time)) return '';
  const label = TIME.format(new Date(time)).toLowerCase();
  return /^(11:59|12:00)\s*pm$/.test(label) || /^12:00\s*am$/.test(label) ? '' : `by ${label} IST`;
}

export function deadlineRow(item, now = Date.now()) {
  const day = deadlineDay(item.deadline), left = daysLeft(item.deadline, now);
  const parts = Object.fromEntries(PARTS.formatToParts(new Date(day + 'T00:00:00Z')).map(p => [p.type, p.value]));
  const source = /^https:\/\//i.test(item.source) ? item.source : site.origin + item.url;
  const when = closingTime(item.deadline);
  return `<li class="dl-item is-${e(item.kind)}${left <= 2 ? ' is-urgent' : ''}">
    <p class="dl-date"><span>${e(parts.weekday)}</span><strong>${e(parts.day)}</strong><span>${e(parts.month)}</span></p>
    <div class="dl-main"><p class="dl-kind">${e(KIND_NAME[item.kind] || '')}</p><h3><a href="${e(item.url)}">${e(item.title)}</a></h3>${item.org ? `<p class="dl-org">${e(item.org)}</p>` : ''}
      ${calendarActions({id: item.id, title: `Last date: ${item.title}`, deadline: item.deadline, url: source, note: `${KIND_NAME[item.kind]} deadline from WILSY. Confirm on the official page.`})}</div>
    <p class="dl-left">${daysLeftLabel(left)}${when ? ` <span>${e(when)}</span>` : ''}</p></li>`;
}

/** The list, grouped by how soon each deadline closes. With `open` (a Set of group keys), a long group shows
 *  its first BUCKET_ROWS rows and a "Show all" button until its key is in the set. */
export function deadlineList(items, {now = Date.now(), empty = 'No open deadlines here right now.', open = null} = {}) {
  if(!items.length) return `<p class="match-empty">${e(empty)}</p>`;
  return BUCKETS.map(([key, title]) => {
    const rows = items.filter(item => bucketOf(item.deadline, now) === key);
    if(!rows.length) return '';
    const all = !open || open.has(key) || rows.length <= BUCKET_ROWS + 2;
    return `<section class="dl-bucket" aria-labelledby="dl-${key}"><h2 id="dl-${key}">${e(title)} <span>${rows.length}</span></h2><ol class="dl-list">${(all ? rows : rows.slice(0, BUCKET_ROWS)).map(item => deadlineRow(item, now)).join('')}</ol>${all ? '' : `<button type="button" class="secondary-button dl-show-all" data-dl-expand="${key}">Show all ${rows.length}</button>`}</section>`;
  }).join('');
}

/** Counts for the filter chips. */
export const kindCounts = items => Object.fromEntries(DEADLINE_KINDS.map(([kind]) => [kind, items.filter(item => item.kind === kind).length]));
