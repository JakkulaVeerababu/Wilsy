import test from 'node:test';
import assert from 'node:assert/strict';
import {readTracker, writeTracker, snapshot, syncSaved, setStage, setNotes, removeItem, columns, toCsv, TRACKER_KEY} from '../js/tracker-core.js';
import {salaryRows, filterRows, sortRows, stats, distribution, facet, readFilters, filterQuery} from '../js/salary-core.js';
import {incomeTax, slabTax, takeHome, rupees} from '../js/take-home-core.js';
import {score, search, readRecent, rememberJob, RECENT_KEY, RECENT_LIMIT} from '../js/palette-core.js';
import {refCode, referralUrl, whatsappUrl} from '../js/features.js';
import {searchQuery, searchFromQuery} from '../js/data-client.js';
import {createSearchHandler} from '../scripts/search-handler.mjs';
import {fetchAllLiveJobs, jobSitemap, rolesByCompany} from '../scripts/live-jobs.mjs';
import {shareBar, searchIndex} from '../scripts/feature-pages.mjs';

const memory = (seed = {}) => { const data = {...seed}; return {getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, data}; };

test('Tracker storage drops invalid rows and unsafe links', () => {
  const storage = memory({[TRACKER_KEY]: JSON.stringify({items: {
    12: {stage: 'applied', title: ' Engineer ', company: 'Acme', path: '/jobs/12-engineer-acme', apply: 'https://acme.com/apply', history: {applied: '2026-11-01T00:00:00Z'}},
    13: {stage: 'nonsense', title: 'X', path: 'javascript:alert(1)', apply: 'http://acme.com'},
    'bad-id': {stage: 'saved', title: 'Y'},
  }})});
  const tracker = readTracker(storage);
  assert.deepEqual(Object.keys(tracker.items), ['12', '13']);
  assert.equal(tracker.items[12].title, 'Engineer');
  assert.equal(tracker.items[13].stage, 'saved');
  assert.equal(tracker.items[13].path, '');
  assert.equal(tracker.items[13].apply, '');
  assert.deepEqual(readTracker(memory({[TRACKER_KEY]: '{not json'})).items, {});
  writeTracker(storage, tracker);
  assert.equal(readTracker(storage).items[12].apply, 'https://acme.com/apply');
});

test('Tracker follows the saved list and keeps roles that moved on', () => {
  const details = new Map([['1', snapshot({title: 'A', company: 'Co', apply_url: 'https://co.com/a', city: 'Pune', country: 'India'}, {path: '/jobs/1-a-co'})], ['2', {title: 'B', company: 'Co'}]]);
  let t = syncSaved({items: {}}, ['1', '2'], details, '2026-11-01T00:00:00.000Z');
  assert.equal(columns(t)[0].items.length, 2);
  assert.equal(t.items[1].place, 'Pune, India');
  t = setStage(t, '1', 'applied', '2026-11-02T00:00:00.000Z');
  assert.equal(t.items[1].history.applied, '2026-11-02T00:00:00.000Z');
  assert.equal(setStage(t, '1', 'unknown'), t, 'unknown stages are ignored');
  t = syncSaved(t, [], new Map());
  assert.deepEqual(Object.keys(t.items), ['1'], 'an unsaved role at Saved leaves; an applied one stays');
  t = setNotes(t, '1', 'x'.repeat(3000));
  assert.equal(t.items[1].notes.length, 2000);
  assert.deepEqual(removeItem(t, '1').items, {});
});

test('Tracker spreadsheet quotes cells and blocks formulas', () => {
  const t = {items: {7: {id: '7', stage: 'offer', title: '=HYPERLINK("x")', company: 'Acme, Inc', place: '', pay: '', notes: 'line\nbreak', path: '/jobs/7-role', apply: '', history: {offer: '2026-11-03T10:00:00Z'}, updatedAt: '2026-11-03T10:00:00Z'}}};
  const csv = toCsv(t, 'https://www.wilsy.in');
  const [head, row] = csv.split('\r\n');
  assert.match(head, /^Stage,Role,Company/);
  assert.match(row, /^Offer,"'=HYPERLINK\(""x""\)","Acme, Inc"/);
  assert.match(csv, /2026-11-03/);
  assert.match(csv, /https:\/\/www\.wilsy\.in\/jobs\/7-role/);
  assert.match(csv, /"line\nbreak",,,,,$/, 'the next-step and contact columns come after the notes');
});

const companies = [
  {id: 'a', name: 'Alpha', sector: 'AI', stage: 'Startup', salary: {min: 100000, max: 200000}, sample: {role: 'Engineering', title: 'ML Engineer', remote: true}},
  {id: 'b', name: 'Beta', sector: 'Fintech', stage: 'Growth', salary: {min: 50000, max: 70000}, sample: {role: 'Design'}},
  {id: 'c', name: 'Gamma', sector: 'AI', stage: 'Established', salary: {min: 300000, max: 500000}, sample: {role: 'Legal'}},
  {id: 'd', name: 'No pay', sector: 'AI', stage: 'Startup'},
];

test('Salary rows convert to rupees and filter, sort and summarise', () => {
  const rows = salaryRows(companies, 100);
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0].min, rows[0].max, rows[0].mid], [1e7, 2e7, 1.5e7]);
  assert.deepEqual(sortRows(rows).map(r => r.id), ['c', 'a', 'b']);
  assert.deepEqual(sortRows(rows, 'low').map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(filterRows(rows, {q: 'ml'}).map(r => r.id), ['a']);
  assert.deepEqual(filterRows(rows, {remote: '1'}).map(r => r.id), ['a']);
  assert.deepEqual(filterRows(rows, {role: 'Other'}).map(r => r.id), ['c']);
  const s = stats(rows);
  assert.deepEqual([s.count, s.median, s.max], [3, 1.5e7, 4e7]);
  assert.equal(distribution(rows).reduce((n, b) => n + b.count, 0), rows.length);
  assert.deepEqual(facet(rows, 'stage').map(([v]) => v), ['Startup', 'Growth', 'Established']);
  assert.deepEqual(stats([]), {count: 0, median: null, p25: null, p75: null, max: null});
});

test('Salary filters survive the address bar', () => {
  const filters = {q: 'data', role: 'Engineering', sector: '', stage: 'Growth', remote: '1', sort: 'name'};
  assert.deepEqual(readFilters('?' + filterQuery(filters)), filters);
  assert.equal(readFilters('?sort=evil').sort, 'pay');
});

test('Income tax follows the FY 2026-27 new regime', () => {
  assert.equal(slabTax(400000), 0);
  assert.equal(incomeTax(1200000), 0, 'rebate up to ₹12 lakh');
  assert.equal(incomeTax(1210000), 10400, 'marginal relief just above ₹12 lakh');
  assert.equal(incomeTax(1600000), 124800);
  assert.equal(incomeTax(2400000), 312000);
  assert.equal(incomeTax(5100000), 1227200, 'surcharge with marginal relief above ₹50 lakh');
});

test('In-hand pay from CTC', () => {
  const r = takeHome({ctc: 1200000});
  assert.equal(r.monthly, 85395);
  assert.equal(r.gross + r.employerPf + r.gratuity, 1200000);
  assert.ok(takeHome({ctc: 1200000, pf: 'capped'}).monthly > r.monthly);
  assert.ok(takeHome({ctc: 1200000, variable: 200000}).monthly < r.monthly);
  assert.equal(takeHome({ctc: -5}).annual, 0);
  assert.equal(rupees(1234567), '₹12,34,567');
});

test('Quick search ranks names before keywords and keeps groups apart', () => {
  const index = [
    {t: 'Stripe', u: '/companies/stripe', k: 'fintech payments', g: 'company'},
    {t: 'Salary explorer', u: '/salaries', k: 'pay compensation', g: 'page'},
    {t: 'Paytm', u: '/companies/paytm', k: 'fintech', g: 'company'},
  ];
  assert.equal(score(index[0], 'stripe'), 100);
  assert.equal(score(index[1], 'sal'), 80);
  assert.equal(score(index[0], 'payments'), 20);
  assert.equal(score(index[0], 'zzz'), 0);
  const found = search(index, 'pay');
  assert.deepEqual(found.company.map(e => e.t), ['Paytm', 'Stripe']);
  assert.deepEqual(found.page.map(e => e.t), ['Salary explorer']);
});

test('Recently viewed jobs: newest first, no duplicates, only job pages', () => {
  const storage = memory();
  for(let i = 1; i <= RECENT_LIMIT + 2; i++) rememberJob(storage, {id: i, title: 'Role ' + i, company: 'Co', path: `/jobs/${i}-role-co`});
  rememberJob(storage, {id: 3, title: 'Role 3', company: 'Co', path: '/jobs/3-role-co'});
  rememberJob(storage, {id: 99, title: 'Bad', company: 'Co', path: 'https://evil.example/jobs/99'});
  const list = readRecent(storage);
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0].id, '3');
  assert.equal(list.filter(j => j.id === '3').length, 1);
  assert.ok(!list.some(j => j.id === '99'));
  assert.deepEqual(readRecent(memory({[RECENT_KEY]: 'oops'})), []);
});

test('Referral codes and WhatsApp links', () => {
  assert.equal(refCode(' IITB-07 '), 'iitb-07');
  assert.equal(refCode('-bad'), '');
  assert.equal(refCode('a'), '');
  assert.equal(refCode('x'.repeat(25)), '');
  assert.equal(referralUrl('iitb-07'), 'https://www.wilsy.in/?ref=iitb-07');
  assert.equal(referralUrl('<script>'), '');
  assert.equal(whatsappUrl('Engineer at Acme:', 'https://www.wilsy.in/jobs/1-x'), 'https://wa.me/?text=Engineer%20at%20Acme%3A%20https%3A%2F%2Fwww.wilsy.in%2Fjobs%2F1-x');
  const bar = shareBar('https://www.wilsy.in/jobs/1-x', 'A "quoted" <role>');
  assert.match(bar, /utm_source%3Dwhatsapp/);
  assert.doesNotMatch(bar, /<role>/);
});

test('Cached search accepts public filters only and shares one cache key per search', () => {
  assert.equal(searchQuery({role: 'data', q: 'python', mode: ''}), 'q=python&role=data');
  assert.equal(searchQuery({q: 'python', role: 'data'}), searchQuery({role: 'data', q: 'python'}));
  assert.equal(searchQuery({}, 40), 'offset=40');
  assert.equal(searchQuery({}), '');
  assert.equal(searchQuery({saved: ['1']}), null, 'saved lists skip the shared cache');
  assert.equal(searchQuery({unknown: 'x'}), null);
  assert.equal(searchQuery({q: 'x'.repeat(201)}), null);
  assert.equal(searchQuery({}, -1), null);
  assert.deepEqual(searchFromQuery(new URLSearchParams('q=python&offset=20&inr_rate=95.5')), {filters: {q: 'python', inr_rate: '95.5'}, offset: 20});
  assert.equal(searchFromQuery(new URLSearchParams('saved=1')), null);
  assert.equal(searchFromQuery(new URLSearchParams('q=a&q=b')), null);
  assert.equal(searchFromQuery(new URLSearchParams('offset=99999')), null);
});

test('Search endpoint caches good answers at the edge and never caches errors', async () => {
  const calls = [];
  const ok = createSearchHandler({request: async (path, options) => { calls.push([path, options.body]); return {jobs: [{id: 1}], total: 1}; }});
  const good = await ok(new Request('https://www.wilsy.in/api/search?q=python&offset=20'));
  assert.equal(good.status, 200);
  assert.match(good.headers.get('cache-control'), /s-maxage=60/);
  assert.deepEqual(calls[0], ['rpc/wilsy_search_jobs', {filters: {q: 'python'}, page_size: 20, page_offset: 20}]);
  assert.deepEqual(await good.json(), {jobs: [{id: 1}], total: 1});
  const bad = await ok(new Request('https://www.wilsy.in/api/search?saved=1'));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
  const down = createSearchHandler({request: async () => { throw new Error('down'); }});
  const failed = await down(new Request('https://www.wilsy.in/api/search'));
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
});

const job = (id, extra = {}) => ({id, title: 'Engineer ' + id, company: 'Acme', company_slug: 'acme', status: 'published', posted_at: `2026-11-${String(10 + (id % 9)).padStart(2, '0')}T00:00:00Z`, description: 'Short', ...extra});

test('Live job pass pages through the public search and drops duplicates', async () => {
  const all = Array.from({length: 120}, (_, i) => job(i + 1));
  const offsets = [];
  const request = async (path, {body}) => { offsets.push(body.page_offset); return {jobs: [...all.slice(body.page_offset, body.page_offset + body.page_size), all[0]], total: all.length, as_of: 'now'}; };
  const result = await fetchAllLiveJobs({request, pageSize: 50, concurrency: 2});
  assert.equal(result.jobs.length, 120);
  assert.deepEqual(offsets.sort((a, b) => a - b), [0, 50, 100]);
  assert.ok(!('description' in result.jobs[0]), 'rows are trimmed');
  assert.equal(result.jobs[0].indexable, false, 'a short description is not worth its own page');
  await assert.rejects(fetchAllLiveJobs({request: async () => ({nope: true})}), /Invalid public job response/);
});

test('Job sitemap lists indexable pages not already in the main sitemap', () => {
  const jobs = [{...job(1), indexable: true}, {...job(2), indexable: true}, {...job(3), indexable: false}];
  const {count, xml} = jobSitemap(jobs, {origin: 'https://www.wilsy.in', exclude: new Set(['/jobs/2-engineer-2-acme'])});
  assert.equal(count, 1);
  assert.match(xml, /<loc>https:\/\/www\.wilsy\.in\/jobs\/1-engineer-1-acme<\/loc><lastmod>2026-11-11<\/lastmod>/);
  assert.match(xml, /^<\?xml/);
  const split = jobSitemap(Array.from({length: 5}, (_, i) => ({...job(i + 1), indexable: true})), {origin: 'https://www.wilsy.in', perFile: 2});
  assert.deepEqual(split.files.map(f => f.name), ['sitemap-jobs.xml', 'sitemap-jobs-2.xml', 'sitemap-jobs-3.xml']);
  assert.deepEqual(split.files.map(f => f.xml.match(/<url>/g).length), [2, 2, 1]);
  assert.equal(split.count, 5);
  assert.deepEqual(jobSitemap([], {origin: 'https://www.wilsy.in'}).files.map(f => f.name), ['sitemap-jobs.xml'], 'always one file');
});

test('Company roles match by slug, then by name, newest six first', () => {
  const jobs = [...Array.from({length: 8}, (_, i) => job(i + 1)), job(20, {company: 'Beta Labs', company_slug: null}), job(21, {company: 'Nobody', company_slug: 'nobody'})];
  const roles = rolesByCompany(jobs, [{id: 'acme', name: 'Acme'}, {id: 'beta', name: 'Beta Labs'}]);
  assert.equal(roles.get('acme').total, 8);
  assert.equal(roles.get('acme').jobs.length, 6);
  assert.equal(roles.get('acme').jobs[0].id, 8, 'newest first');
  assert.equal(roles.get('beta').total, 1);
  assert.ok(!roles.has('nobody'));
});

test('Quick-search index covers pages, companies and guides', () => {
  const index = searchIndex({companies: [{id: 'acme', name: 'Acme', sector: 'AI', tags: ['llm']}], guides: [{slug: 'resume', title: 'Resume guide', category: 'Applying'}], landing: [['/python-jobs', 'Python jobs']], curated: [['GSoC', '/open-source-programs/gsoc', 'Open source']]});
  assert.ok(index.some(e => e.u === '/tracker' && e.g === 'page'));
  assert.ok(index.some(e => e.u === '/companies/acme' && e.k.includes('llm')));
  assert.ok(index.some(e => e.u === '/guides/resume' && e.g === 'guide'));
  assert.ok(index.some(e => e.u === '/python-jobs'));
  assert.ok(index.some(e => e.u === '/open-source-programs/gsoc'));
  assert.ok(index.every(e => e.t && e.u.startsWith('/')));
});
