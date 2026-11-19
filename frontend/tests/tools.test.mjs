import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {checkScam, imitates, addresses, easyMoney, shortDomain, EXAMPLE, SIGNS} from '../js/scam-core.js';
import {readTracker, syncSaved, setStage, removeItem, toCsv, trackJob, addCustom, setNext, upcoming, isCustom, fromShare, companyFromUrl, TRACKER_KEY, TRACKER_LIMIT} from '../js/tracker-core.js';
import {eventIcs, eventGoogleUrl, eventActions} from '../js/calendar-core.js';
import {hikeResult, hikeFor, hikeTable, inWords} from '../js/hike-core.js';
import {serviceSpan, countedYears, gratuity, gratuityResult, GRATUITY_CAP} from '../js/gratuity-core.js';
import {takeHome} from '../js/take-home-core.js';
import {SKILLS, skillSlug} from '../js/skills-core.js';
import {jobPath} from '../js/jobs-core.js';
import {skillStats, skillBody, skillsIndexBody, SKILL_MIN} from '../scripts/skill-pages.mjs';
import {trendsBody} from '../scripts/trends.mjs';
import {TOOLS, toolsBody, scamBody, trackerBody, embedSnippet, bookmarklet, searchIndex} from '../scripts/feature-pages.mjs';
import {header} from '../scripts/page-shell.mjs';
import {createSearchHandler} from '../scripts/search-handler.mjs';

const memory = (seed = {}) => { const data = {...seed}; return {getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, data}; };
const ids = text => checkScam(text).flags.map(f => f.id);

test('Scam check: the example message trips the strong signs, worst first', () => {
  const r = checkScam(EXAMPLE);
  assert.equal(r.level, 'high');
  assert.deepEqual(r.flags.filter(f => f.level === 'high').map(f => f.id), ['fee', 'brand-email']);
  for(const id of ['chat', 'guarantee', 'selected', 'urgent', 'too-good']) assert.ok(r.flags.some(f => f.id === id), id);
  assert.ok(r.flags.findIndex(f => f.level === 'medium') > r.flags.findLastIndex(f => f.level === 'high'));
  assert.ok(r.flags.every(f => f.found && f.found.length <= 160));
  assert.deepEqual(checkScam('   '), {flags: [], level: null});
});

test('Scam check: ordinary job descriptions stay clear', () => {
  assert.equal(checkScam('We are hiring a Backend Engineer in Bengaluru to build UPI and card payment APIs and review product requirements. We will pay ₹30,00,000 per year. No interview fee. Interviews use Zoom with screen sharing. Please provide your address with pin code. Apply at https://stripe.com/jobs/listing/1 and see https://bucket.s3.amazonaws.com/brief.pdf').level, 'none');
  assert.equal(checkScam('Work from home customer support. Salary ₹40,000 per month. Send your CV to careers@freshworks.com. Immediate joiners preferred.').level, 'none');
  assert.equal(checkScam('Your TCS NQT result is out. Log in at https://learning.tcsion.com. TCS Talent Acquisition, careers@tcs.com').level, 'none');
  assert.equal(checkScam('We will never ask you to share an OTP. There is no registration fee and no security deposit. Do not install AnyDesk for anyone.').level, 'none');
});

test('Scam check: fees, tasks, secrets, crypto, remote apps and lookalike addresses', () => {
  assert.deepEqual(ids('No experience needed, just pay ₹500 registration fee today.'), ['fee']);
  assert.ok(ids('Pay to ravi.k@okaxis to confirm').includes('fee'), 'a UPI ID');
  assert.ok(ids('Earn ₹150 per like. After 3 tasks do a prepaid task: recharge ₹1000 to unlock commission.').includes('task'));
  assert.ok(ids('Please share the OTP you receive and your UPI PIN.').includes('secrets'));
  assert.ok(ids('Invest just ₹5,000 and buy USDT through our partner.').includes('invest'));
  assert.ok(ids('Install AnyDesk so our team can help you.').includes('remote'));
  assert.ok(ids('Download salary.apk to start').includes('remote'));
  assert.ok(ids('Selected for TCS. Download your offer at https://tcs-careers-hr.in/offer').includes('lookalike'));
  assert.ok(ids('Infosys HR team: write to infosys.recruit@gmail.com').includes('brand-email'));
  assert.deepEqual(ids('We use Google Cloud. Email founder@gmail.com'), ['personal-email'], 'naming a brand is not claiming to be it');
  assert.ok(ids('Details: bit.ly/3abcd').includes('short-link'));
});

test('Scam check: government exam fees are a note, not a scam flag', () => {
  const r = checkScam('Staff Selection Commission. Application fee: ₹100. Candidates must pay Rs 100 as application fee online at ssc.gov.in.');
  assert.equal(r.level, 'some');
  assert.deepEqual(r.flags.map(f => f.id), ['exam-fee']);
});

test('Scam check: addresses, lookalikes and easy money', () => {
  assert.equal(shortDomain('careers.tcs.com'), 'tcs.com');
  assert.equal(shortDomain('jobs.tcs-hiring.co.in'), 'tcs-hiring.co.in');
  assert.equal(imitates('careers.tcs.com'), null);
  assert.equal(imitates('jetcsolutions.com'), null, 'short names match whole words only');
  assert.equal(imitates('tcscareers.in')?.name, 'TCS');
  assert.equal(imitates('amazon.co.uk'), null);
  assert.equal(imitates('google-careers.in')?.name, 'Google');
  assert.equal(imitates('gmail.com'), null);
  assert.deepEqual(addresses('mail hr.team@gmail.com or www.wipro-hr.com.').map(a => [a.kind, a.domain]), [['email', 'gmail.com'], ['link', 'wipro-hr.com']]);
  assert.match(easyMoney('Part time work for students: earn ₹800 per day on your phone'), /₹800 per day/);
  assert.equal(easyMoney('Part time: earn ₹300 per day'), '', 'below the daily floor');
  assert.equal(easyMoney('Salary ₹60,000 per month'), '', 'no easy-work wording');
  assert.ok(SIGNS.length >= 12 && SIGNS.every(s => s.title && s.why));
});

test('Tracker: roles from other sites, kept apart from the saved list', () => {
  const now = '2026-11-20T10:00:00.000Z';
  let {tracker, id, error} = addCustom({version: 1, items: {}}, {title: ' Data Analyst ', company: 'Acme', apply: 'https://jobs.lever.co/acme/1', place: 'Pune', notes: 'via referral'}, {now, id: 'c-abc123'});
  assert.equal(error, undefined);
  assert.equal(id, 'c-abc123');
  assert.ok(isCustom(id) && !isCustom('123'));
  assert.deepEqual({...tracker.items[id], history: undefined}, {id, stage: 'applied', title: 'Data Analyst', company: 'Acme', path: '', apply: 'https://jobs.lever.co/acme/1', place: 'Pune', pay: '', notes: 'via referral', addedAt: now, updatedAt: now, history: undefined, via: 'custom', next: null});
  assert.equal(addCustom(tracker, {title: '', company: ''}).error, 'Add the role or the company.');
  assert.match(addCustom(tracker, {title: 'X'}, {id: 'bad id'}).error, /Couldn’t add/);
  const full = {version: 1, items: Object.fromEntries(Array.from({length: TRACKER_LIMIT}, (_, i) => [String(i + 1), {id: String(i + 1)}]))};
  assert.match(addCustom(full, {title: 'X'}).error, /holds up to/);
  // Custom roles and roles marked as applied survive a sync, even back at Saved.
  tracker = setStage(tracker, id, 'saved', now);
  tracker = trackJob(tracker, {id: '77', title: 'SDE', company: 'Co', path: '/jobs/77-sde-co', apply: 'https://co.com/77'}, 'applied', now);
  tracker = setStage(tracker, '77', 'saved', now);
  tracker = syncSaved(tracker, [], new Map());
  assert.deepEqual(Object.keys(tracker.items).sort(), ['77', 'c-abc123']);
  // Stored and read back, a custom id survives cleaning; nonsense ids still don't.
  const storage = memory({[TRACKER_KEY]: JSON.stringify({items: {...tracker.items, 'c-!!': {title: 'x'}, 'c-ab': {title: 'too short'}}})});
  assert.deepEqual(Object.keys(readTracker(storage).items).sort(), ['77', 'c-abc123']);
  assert.equal(readTracker(storage).items['c-abc123'].path, '');
  assert.deepEqual(removeItem(tracker, id).items[id], undefined);
});

test('Tracker: "Mark as applied" moves forward only', () => {
  const job = {id: '9', title: 'SDE', company: 'Co', path: '/jobs/9-sde-co', apply: 'https://co.com/9', place: 'Remote', pay: '₹12L'};
  let t = trackJob({version: 1, items: {}}, job, 'applied', '2026-11-01T00:00:00.000Z');
  assert.equal(t.items[9].stage, 'applied');
  assert.equal(t.items[9].via, 'job');
  assert.equal(t.items[9].history.applied, '2026-11-01T00:00:00.000Z');
  t = setStage(t, '9', 'interviewing');
  assert.equal(trackJob(t, job, 'applied'), t, 'never moves a role back');
  assert.equal(trackJob(t, {id: 'c-x'}, 'applied'), t, 'only WILSY job ids');
  const saved = syncSaved({version: 1, items: {}}, ['5'], new Map([['5', {title: 'A', company: 'B'}]]), '2026-11-01T00:00:00.000Z');
  assert.equal(trackJob(saved, {id: '5'}, 'applied', '2026-11-02T00:00:00.000Z').items[5].stage, 'applied', 'a saved role moves to Applied');
});

test('Tracker: next steps, the coming-up list and the spreadsheet', () => {
  const now = Date.parse('2026-11-20T06:00:00Z');
  let t = addCustom({version: 1, items: {}}, {title: 'PM', company: 'Acme'}, {id: 'c-pm0001'}).tracker;
  t = addCustom(t, {title: 'SDE', company: 'Beta', stage: 'closed'}, {id: 'c-sde001'}).tracker;
  t = setNext(t, 'c-pm0001', {what: '', at: '2026-11-23T09:30:00Z'});
  assert.deepEqual(t.items['c-pm0001'].next, {what: 'Interview', at: '2026-11-23T09:30:00.000Z'});
  t = setNext(t, 'c-sde001', {what: 'Call', at: '2026-11-21T09:30:00Z'});
  assert.deepEqual(upcoming(t, now).map(i => i.id), ['c-pm0001'], 'closed roles are left out');
  assert.deepEqual(upcoming(t, Date.parse('2026-12-20T00:00:00Z')), [], 'past steps drop off');
  assert.equal(setNext(t, 'c-pm0001', {what: 'x', at: 'not a date'}).items['c-pm0001'].next, null);
  const [head, row] = toCsv(t, 'https://www.wilsy.in', {timeZone: 'Asia/Kolkata'}).split('\r\n');
  assert.match(head, /,Notes,Next step,Next step on$/);
  assert.match(row, /,Interview,2026-11-23 15:00$/);
});

test('Tracker: shared links fill in the role, company and link', () => {
  assert.deepEqual(fromShare({title: 'Acme hiring Data Analyst in Pune, Maharashtra | LinkedIn', url: 'https://www.linkedin.com/jobs/view/1'}),
    {title: 'Data Analyst', company: 'Acme', place: 'Pune, Maharashtra', apply: 'https://www.linkedin.com/jobs/view/1'});
  assert.deepEqual(fromShare({title: 'Job Application for Software Engineer at Stripe', url: 'https://job-boards.greenhouse.io/stripe/jobs/1'}),
    {title: 'Software Engineer', company: 'Stripe', place: '', apply: 'https://job-boards.greenhouse.io/stripe/jobs/1'});
  assert.deepEqual(fromShare({title: 'Acme - Backend Engineer', url: 'https://jobs.lever.co/acme/1'}).company, 'Acme');
  assert.deepEqual(fromShare({text: 'Check this role https://jobs.ashbyhq.com/open-ai-labs/123'}), {title: 'Check this role', company: 'Open Ai Labs', place: '', apply: 'https://jobs.ashbyhq.com/open-ai-labs/123'});
  assert.equal(fromShare({url: 'http://insecure.example/job'}).apply, '');
  assert.equal(companyFromUrl('https://acme.wd5.myworkdayjobs.com/en-US/careers/job/1'), 'Acme');
  assert.equal(companyFromUrl('not a url'), '');
});

test('Calendar: timed reminders for interviews', () => {
  const item = {id: 'c-pm0001', title: 'Interview: PM at Acme', start: '2026-11-23T09:30:00Z', url: 'https://acme.com/job', note: 'Round 1'};
  const ics = eventIcs(item, Date.parse('2026-11-20T00:00:00Z'));
  assert.match(ics, /DTSTART:20261123T093000Z\r\nDTEND:20261123T103000Z/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /TRIGGER:-PT1H/);
  assert.match(ics, /UID:event-c-pm0001-20261123T093000Z@wilsy\.in/);
  assert.equal(eventIcs({...item, start: 'soon'}), null);
  assert.match(eventGoogleUrl({...item, minutes: 30}), /dates=20261123T093000Z%2F20261123T100000Z/);
  const html = eventActions(item);
  assert.match(html, /data-ics="[^"]*&quot;start&quot;:&quot;2026-11-23T09:30:00.000Z&quot;/);
  assert.equal(eventActions({title: 'x'}), '');
});

test('Salary hike: in-hand pay before and after, and the hike for a target', () => {
  const r = hikeResult({current: 1200000, hike: 20});
  assert.equal(r.next, 1440000);
  assert.equal(r.before.monthly, takeHome({ctc: 1200000}).monthly);
  assert.equal(r.monthlyRise, takeHome({ctc: 1440000}).monthly - takeHome({ctc: 1200000}).monthly);
  assert.ok(r.inHandHike < 20, 'tax makes the in-hand hike smaller');
  assert.ok(r.kept > 0 && r.kept < 100);
  assert.equal(hikeResult({current: 1000000, offer: 1250000}).hike, 25);
  assert.equal(hikeResult({current: 0, hike: 10}).hike, null);
  const need = hikeFor(1200000, 100000);
  assert.ok(takeHome({ctc: need.ctc}).monthly >= 100000);
  assert.ok(takeHome({ctc: need.ctc - 5000}).monthly < 100000, 'close to the smallest CTC that works');
  assert.equal(hikeFor(1200000, 0), null);
  assert.equal(inWords(1440000), '₹14.4 lakh a year');
  assert.equal(inWords(25000000), '₹2.5 crore a year');
  assert.match(hikeTable(r), /Of every extra ₹100 of CTC/);
});

test('Gratuity: service, rounding, eligibility, the 50% wage rule and the cap', () => {
  assert.deepEqual(serviceSpan('2021-01-01', '2025-12-31'), {years: 5, months: 0, days: 0});
  assert.deepEqual(serviceSpan('2021-01-15', '2026-07-14'), {years: 5, months: 6, days: 0});
  assert.equal(countedYears(serviceSpan('2021-01-15', '2026-07-14')), 5, 'six months exactly is not "more than six"');
  assert.equal(countedYears(serviceSpan('2021-01-15', '2026-07-15')), 6);
  assert.equal(serviceSpan('2026-01-01', '2025-01-01'), null);
  const r = gratuity({wages: 52000, joined: '2018-04-01', left: '2025-10-31'});
  assert.equal(r.years, 8);
  assert.equal(r.amount, Math.round(52000 * 15 / 26 * 8));
  assert.ok(r.eligible);
  assert.equal(gratuity({wages: 52000, joined: '2023-01-01', left: '2025-06-30'}).eligible, false);
  assert.equal(gratuity({wages: 52000, joined: '2024-01-01', left: '2025-06-30', fixedTerm: true}).eligible, true, 'fixed-term: one year');
  const raised = gratuity({wages: 40000, total: 120000, joined: '2015-01-01', left: '2025-12-31'});
  assert.equal(raised.base, 60000);
  assert.ok(raised.raised);
  const big = gratuity({wages: 900000, joined: '2000-01-01', left: '2025-12-31'});
  assert.equal(big.amount, GRATUITY_CAP);
  assert.ok(big.capped);
  assert.match(gratuityResult(r), /₹52,000 × 15 ÷ 26 × 8 years/);
  assert.match(gratuityResult(gratuity({wages: 1})), /Enter the date you joined/);
});

const job = (id, over = {}) => ({id: String(id), title: 'Engineer ' + id, company: 'Acme', company_slug: 'acme', location: 'Bengaluru, India', city: 'Bengaluru', country: 'India', country_code: 'IN', work_mode: 'hybrid', first_seen_at: `2026-11-${String(10 + (id % 9)).padStart(2, '0')}T00:00:00Z`, family: 'Engineering', skills: ['Python', 'SQL'], entry: false, pay: true, indexable: true, ...over});

test('Skill pages: counts per skill with enough live jobs, newest jobs first', () => {
  const jobs = [...Array.from({length: 6}, (_, i) => job(i + 1)), job(7, {skills: ['Python', 'Go'], company: 'Beta', company_slug: 'beta', work_mode: 'remote', entry: true}), job(8, {skills: ['Rust']})];
  const stats = skillStats(jobs, {companies: [{id: 'acme-inc', name: 'Acme'}]});
  assert.deepEqual(stats.map(s => [s.name, s.total]), [['Python', 7], ['SQL', 6]], `only skills with ${SKILL_MIN}+ jobs`);
  const py = stats[0];
  assert.equal(py.slug, 'python');
  assert.equal(py.companies, 2);
  assert.deepEqual(py.topCompanies[0], ['Acme', 6, 'acme-inc']);
  assert.deepEqual(py.together.map(([name]) => name), ['SQL', 'Go']);
  assert.equal(py.jobs[0].id, '7', 'newest first');
  assert.equal(py.remote, 1);
  const html = skillBody(py, {origin: 'https://www.wilsy.in', asOf: '2026-11-19T00:00:00Z', names: new Set(['Python', 'SQL'])});
  assert.match(html, /<h1>Python jobs\.<\/h1>/);
  assert.match(html, /href="\/skills\/sql"/);
  assert.match(html, /href="\/jobs\?q=Go"/, 'skills without a page link to a search');
  assert.match(html, new RegExp(`href="${jobPath(jobs[6]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(skillsIndexBody(stats, {total: 8}), /href="\/skills\/python"/);
  assert.match(skillsIndexBody([], {}), /built without the live job data/);
  assert.match(trendsBody({total: 8, companies: 2, recent: 0, remote: 1, pay: 8, entry: 1, india: 8, perDay: [], families: [], skills: [['Python', 7], ['Rust', 1]], topCompanies: [], cities: [], modes: []}, {origin: '', skillPages: new Set(['Python'])}), /href="\/skills\/python"[\s\S]*href="\/jobs\?q=Rust"/);
});

test('Skill slugs are unique and safe in a web address', () => {
  const slugs = SKILLS.map(([name]) => skillSlug(name));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.every(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)));
  assert.deepEqual(['C++', 'C#', '.NET', 'Node.js', 'A/B testing', 'Power BI'].map(skillSlug), ['cpp', 'csharp', 'dotnet', 'nodejs', 'ab-testing', 'power-bi']);
});

test('Tools hub, header and quick search list every tool', () => {
  const hub = toolsBody();
  for(const [url] of TOOLS) assert.ok(hub.includes(`href="${url}"`), url);
  assert.match(header('scam-check'), /<a href="\/tools" class="active">Tools<\/a>/);
  assert.match(header('tools'), /<a href="\/tools" class="active" aria-current="page">Tools<\/a>/);
  assert.doesNotMatch(header('jobs'), /href="\/tools" class="active"/);
  const index = searchIndex({companies: [], skills: [['Python', 'python', 1200]]});
  for(const url of ['/scam-check', '/salary-hike-calculator', '/gratuity-calculator', '/tools', '/embed', '/skills/python']) assert.ok(index.some(i => i.u === url), url);
  assert.match(scamBody(), /cybercrime\.gov\.in/);
  assert.match(scamBody(), /Call 1930/);
});

test('The tracker page offers the add form, share target and a bookmarklet', async () => {
  const html = trackerBody({fx: {rate: 90, date: '2026-11-01'}});
  assert.match(html, /data-add-form/);
  assert.match(html, /<option value="applied" selected>Applied<\/option>/);
  assert.match(bookmarklet('https://www.wilsy.in'), /^javascript:\(function\(\)\{var u='https:\/\/www\.wilsy\.in\/tracker\?add=1&title='\+encodeURIComponent\(document\.title\)/);
  const manifest = JSON.parse(await fs.readFile(new URL('../assets/site.webmanifest', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.share_target, {action: '/tracker', method: 'GET', enctype: 'application/x-www-form-urlencoded', params: {title: 'title', text: 'text', url: 'url'}});
  assert.ok(manifest.shortcuts.some(s => s.url.startsWith('/tracker')));
});

test('Jobs widget: same job links as the site, safe DOM building, readable by any site', async () => {
  const source = await fs.readFile(new URL('../js/embed.js', import.meta.url), 'utf8');
  const widgetSlug = new Function(source.match(/function slugify\(value\) \{[\s\S]*?\n  \}/)[0] + '\nreturn slugify;')();
  const widgetPath = job => '/jobs/' + job.id + '-' + (widgetSlug(job.title + ' ' + job.company) || 'role');
  for(const title of ['Senior Engineer (Backend) – Payments São Paulo', 'C++ / CUDA Developer', '  ', 'A'.repeat(90)]) {
    const sample = {id: '42', title, company: 'Ünïcode Labs'};
    assert.equal(widgetPath(sample), jobPath(sample), title);
  }
  assert.doesNotMatch(source, /innerHTML\s*=\s*[^'"\s]/, 'job data never goes through innerHTML');
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage/);
  assert.equal(embedSnippet('https://www.wilsy.in', {stage: 'internship', limit: '5'}), '<div data-wilsy-jobs data-stage="internship" data-limit="5"><a href="https://www.wilsy.in/jobs">Jobs on WILSY</a></div>\n<script src="https://www.wilsy.in/embed.js" async></script>');
  const handle = createSearchHandler({request: async () => ({jobs: [], total: 0})});
  for(const url of ['https://www.wilsy.in/api/search?q=python', 'https://www.wilsy.in/api/search?nope=1']) {
    const response = await handle(new Request(url));
    assert.equal(response.headers.get('access-control-allow-origin'), '*', url);
  }
});
