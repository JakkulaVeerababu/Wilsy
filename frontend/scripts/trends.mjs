import {escapeHtml as e} from '../js/directory-core.js';
import {indiaCity} from '../js/skills-core.js';
import {shareBar} from './feature-pages.mjs';

// The public hiring-trends page, counted at deploy time from the live job pass. Every figure is a count
// of listings open in WILSY's collection on that day: what is hiring now, not the whole job market.

const DAY = 864e5;
const foundAt = job => Date.parse(job.first_seen_at || job.discovered_at || '');
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tally = values => {
  const counts = new Map();
  for(const value of values) if(value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
const inIndia = job => job.country_code === 'IN' || /\bindia\b/i.test(`${job.country || ''} ${job.location || ''}`) || !!indiaCity(`${job.location || ''} ${job.city || ''}`);
const MODES = [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site']];
const dayKey = time => new Date(time).toISOString().slice(0, 10);

/** Counts for the trends page from trimmed live-job rows (see live-jobs.mjs). */
export function hiringTrends(jobs, {companies = [], now = Date.now(), asOf = null, days = 14} = {}) {
  const total = jobs.length;
  const profiles = new Map(companies.flatMap(c => [[c.id, c], [normalized(c.name), c]]));
  const companyCounts = tally(jobs.map(j => String(j.company || '').trim()));
  const india = jobs.filter(inIndia);
  const recent = jobs.filter(j => foundAt(j) >= now - 7 * DAY).length;
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const perDay = new Map(Array.from({length: days}, (_, i) => [dayKey(today - (days - 1 - i) * DAY), 0]));
  for(const job of jobs) { const key = Number.isFinite(foundAt(job)) ? dayKey(foundAt(job)) : ''; if(perDay.has(key)) perDay.set(key, perDay.get(key) + 1); }
  const slugOf = new Map();
  for(const job of jobs) { const name = String(job.company || '').trim(); if(name && job.company_slug && !slugOf.has(name)) slugOf.set(name, job.company_slug); }
  return {
    asOf, total,
    companies: companyCounts.length,
    remote: jobs.filter(j => j.work_mode === 'remote').length,
    recent,
    pay: jobs.filter(j => j.pay).length,
    entry: jobs.filter(j => j.entry).length,
    india: india.length,
    perDay: [...perDay],
    // Largest first, with "Other" always last.
    families: tally(jobs.map(j => j.family || 'Other')).sort((a, b) => (a[0] === 'Other') - (b[0] === 'Other') || b[1] - a[1]),
    skills: tally(jobs.flatMap(j => j.skills || [])).slice(0, 15),
    topCompanies: companyCounts.slice(0, 12).map(([name, count]) => [name, count, (profiles.get(slugOf.get(name)) || profiles.get(normalized(name)))?.id || '']),
    cities: tally(india.map(j => indiaCity(`${j.location || ''} ${j.city || ''}`))).slice(0, 10),
    modes: [...MODES.map(([key, name]) => [name, jobs.filter(j => j.work_mode === key).length, key]), ['Not stated', jobs.filter(j => !MODES.some(([key]) => key === j.work_mode)).length, '']],
  };
}

const n = value => Number(value || 0).toLocaleString('en-IN');
const pct = (part, whole) => whole ? Math.round(part / whole * 100) + '%' : '0%';
const shortDay = key => new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(key + 'T00:00:00Z'));

// One series per chart, so no legend: the panel title names it, the count sits at each bar's end, and
// every bar has a tooltip. Labels link to the matching search.
function bars(rows, {total, link, unit = 'jobs'}) {
  const top = Math.max(1, ...rows.map(r => r[1]));
  return `<ol class="trend-bars">${rows.map(([name, count, extra]) => {
    const href = link(name, extra), tip = `${name}: ${n(count)} ${unit} (${pct(count, total)})`;
    return `<li title="${e(tip)}"><span class="trend-label">${href ? `<a href="${e(href)}">${e(name)}</a>` : e(name)}</span><span class="salary-bar-track"><span class="salary-bar" style="width:${count ? Math.max(1, count / top * 100).toFixed(1) : 0}%"></span></span><span class="trend-count">${n(count)}<small>${pct(count, total)}</small></span></li>`;
  }).join('')}</ol>`;
}
function columns(perDay) {
  const top = Math.max(1, ...perDay.map(([, c]) => c));
  return `<ol class="trend-days">${perDay.map(([key, count], i) => `<li title="${e(shortDay(key))}: ${n(count)} new roles"><span class="trend-day-bar" style="height:${count ? Math.max(2, count / top * 100).toFixed(1) : 0}%"><span class="sr-only">${e(shortDay(key))}: ${n(count)} new roles</span></span><span class="trend-day-label" aria-hidden="true">${(perDay.length - 1 - i) % 2 ? '' : e(shortDay(key))}</span></li>`).join('')}</ol>`;
}
const panel = (id, title, note, body, wide = false) => `<section class="salary-panel trend-panel${wide ? ' trend-wide' : ''}" aria-labelledby="${id}"><h2 id="${id}">${e(title)}</h2><p class="salary-note">${e(note)}</p>${body}</section>`;

export function trendsBody(t, {origin}) {
  const crumbs = '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Hiring trends</span></nav>';
  if(!t?.total) return `<main id="main-content" class="editorial-shell trends-shell">${crumbs}<div class="editorial-hero"><p class="eyebrow">HIRING TRENDS</p><h1>What’s hiring right now.</h1><p>These numbers are counted from every live job each time the site updates. This copy was built without the live job data, so there is nothing to show yet.</p></div><a class="primary-button" href="/jobs">Search live jobs</a></main>`;
  const updated = t.asOf ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'}).format(new Date(t.asOf)) + ' IST' : '';
  const q = value => '/jobs?q=' + encodeURIComponent(value);
  return `<main id="main-content" class="editorial-shell trends-shell">${crumbs}
  <div class="editorial-hero"><p class="eyebrow">HIRING TRENDS · LIVE DATA</p><h1>What’s hiring right now.</h1><p>Counted from the ${n(t.total)} live jobs WILSY tracks across ${n(t.companies)} employers${updated ? `, updated ${e(updated)}` : ''}.</p></div>
  <dl class="salary-stats trend-stats">
    <div><dt>Live jobs</dt><dd>${n(t.total)}</dd></div>
    <div><dt>Found in the last 7 days</dt><dd>${n(t.recent)}</dd></div>
    <div><dt>Remote roles</dt><dd>${pct(t.remote, t.total)}</dd></div>
    <div><dt>Pay published</dt><dd>${pct(t.pay, t.total)}</dd></div>
    <div><dt>Jobs in India</dt><dd>${n(t.india)}</dd></div>
    <div><dt>Internships and fresher roles</dt><dd>${n(t.entry)}</dd></div>
  </dl>
  <div class="trend-grid">
    ${panel('trend-days-title', 'New roles by day', 'Live roles by the day WILSY first found them (UTC). Roles that have already closed are not counted.', columns(t.perDay), true)}
    ${panel('trend-family-title', 'Jobs by family', 'Grouped from job titles.', bars(t.families, {total: t.total, link: () => ''}))}
    ${panel('trend-skill-title', 'Most-requested skills', 'Share of live jobs whose listing mentions the skill.', bars(t.skills, {total: t.total, link: name => q(name)}))}
    ${panel('trend-company-title', 'Companies hiring the most', 'Open roles per employer.', bars(t.topCompanies, {total: t.total, link: (name, id) => id ? '/companies/' + encodeURIComponent(id) : '/jobs?company=' + encodeURIComponent(name), unit: 'open roles'}))}
    ${panel('trend-city-title', 'Where in India', `Jobs in Indian cities, out of ${n(t.india)} jobs in India.`, t.cities.length ? bars(t.cities, {total: t.india, link: name => q(name.replace(' NCR', ''))}) : '<p class="salary-note">No city named yet.</p>')}
    ${panel('trend-mode-title', 'Remote, hybrid or on-site', 'As stated in each listing.', bars(t.modes, {total: t.total, link: (name, key) => key ? '/jobs?mode=' + key : ''}), true)}
  </div>
  <div class="trend-foot">${shareBar(origin + '/hiring-trends', 'What’s hiring right now, from live jobs on WILSY:', {label: 'Share these trends'})}<a class="secondary-button" href="/feed.xml">Follow new jobs by RSS</a></div>
  <p class="quiet-callout">These counts come from live listings WILSY collects from employer career sites, so they show what is open in our collection today, not the whole job market. A skill counts when a listing mentions it; families come from job titles; “Jobs in India” uses the country or an Indian city in the location. <a href="/methodology">How WILSY collects jobs</a></p>
</main>`;
}
