import test from 'node:test';
import assert from 'node:assert/strict';
import {READERS} from '../boards.mjs';
import {oracleId, phenomId, phenomData, PHENOM_WORDS} from '../more-boards.mjs';

const fake = routes => async url => {
  for (const [pattern, body] of routes) if (pattern.test(url)) return typeof body === 'function' ? body(url) : body;
  const error = new Error(`no route ${url}`); error.status = 404; throw error;
};

test('oracleId reads host and site from a career-site URL', () => {
  assert.equal(oracleId('https://eiqg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs'), 'eiqg.fa.us2.oraclecloud.com/CX_1');
  assert.equal(oracleId('https://example.com/careers'), null);
  assert.equal(oracleId('not a url'), null);
});

test('Oracle: lists every posting, reads details for tech roles only, and marks capped reads partial', async () => {
  const list = [
    {Id: '1', Title: 'Senior Software Engineer', PostedDate: '2026-11-20', PrimaryLocation: 'Bengaluru, India', secondaryLocations: [{Name: 'Hyderabad, India'}], WorkplaceType: 'Hybrid'},
    {Id: '2', Title: 'Store Associate', PostedDate: '2026-11-21', PrimaryLocation: 'Austin, TX', secondaryLocations: [], ShortDescriptionStr: '<p>Help customers</p>'}];
  const detailCalls = [];
  const get = fake([
    [/recruitingCEJobRequisitions\?/, {items: [{TotalJobsCount: 2, requisitionList: list}]}],
    [/recruitingCEJobRequisitionDetails/, url => { detailCalls.push(url); return {items: [{ExternalDescriptionStr: '<p>Build APIs in Java</p>', ExternalQualificationsStr: '<ul><li>3 years</li></ul>', JobSchedule: 'Full time', Department: 'Engineering'}]}; }]]);
  const jobs = await READERS.oracle_hcm('acme.fa.us2.oraclecloud.com/CX_1', get);
  assert.equal(jobs.length, 2);
  assert.equal(detailCalls.length, 1);
  assert.match(detailCalls[0], /Id=%221%22,siteNumber=CX_1/);
  const [eng, store] = jobs;
  assert.equal(eng.url, 'https://acme.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1');
  assert.equal(eng.location, 'Bengaluru, India; Hyderabad, India');
  assert.match(eng.description, /Build APIs in Java/);
  assert.match(eng.description, /3 years/);
  assert.equal(eng.department, 'Engineering');
  assert.equal(eng.work_mode, 'hybrid');
  assert.equal(store.description, 'Help customers');
  assert.ok(!jobs.partial);
  const big = fake([[/recruitingCEJobRequisitions\?/, {items: [{TotalJobsCount: 5000, requisitionList: list}]}], [/Details/, {items: [{}]}]]);
  assert.ok((await READERS.oracle_hcm('acme.fa.us2.oraclecloud.com/CX_1', big)).partial, 'more postings than read');
  await assert.rejects(READERS.oracle_hcm('acme.fa.us2.oraclecloud.com/CX_1', fake([[/./, {items: []}]])), /Unexpected Oracle/);
  await assert.rejects(READERS.oracle_hcm('../evil', get), /Bad Oracle identifier/);
});

test('Rippling: list plus details for tech roles; a role closed in between is skipped', async () => {
  const get = fake([
    [/\/jobs\/a$/, {description: {role: '<p>Run our cloud</p>', company: '<p>About us</p>'}, workLocations: ['Remote'], department: {name: 'CloudOps', base_department: 'Engineering'},
      employmentType: {id: 'Salaried, full-time'}, createdOn: '2026-11-10T10:39:18-08:00'}],
    [/\/jobs\/c$/, () => { const e = new Error('gone'); e.status = 404; throw e; }],
    [/\/jobs$/, [{uuid: 'a', name: 'Cloud Engineer', url: 'https://ats.rippling.com/x/jobs/a', workLocation: {label: 'Remote'}},
      {uuid: 'b', name: 'Office Manager', url: 'https://ats.rippling.com/x/jobs/b', workLocation: {label: 'Austin'}},
      {uuid: 'c', name: 'Backend Engineer', url: 'https://ats.rippling.com/x/jobs/c'}]]]);
  const jobs = await READERS.rippling('x', get);
  assert.deepEqual(jobs.map(j => j.title), ['Cloud Engineer', 'Office Manager']);
  assert.match(jobs[0].description, /Run our cloud/);
  assert.equal(jobs[0].work_mode, 'remote');
  assert.equal(jobs[0].team, 'CloudOps');
  assert.equal(jobs[0].posted_at, '2026-11-10T18:39:18.000Z');
  await assert.rejects(READERS.rippling('a/b', get), /Bad Rippling identifier/);
});

test('phenomId reads host and locale; phenomData reads the page object even with braces inside strings', () => {
  assert.equal(phenomId('https://careers.allianz.com/us/en/search-results'), 'careers.allianz.com/us/en');
  assert.equal(phenomId('https://jobs.baesystems.com/global/en'), 'jobs.baesystems.com/global/en');
  assert.equal(phenomId('https://jobs.example.com/'), null);
  const html = '<script>phApp.ddo = {"a":{"t":"curly } and \\" quote"}}; phApp.more = {"x":1};</script>';
  assert.deepEqual(phenomData(html), {a: {t: 'curly } and " quote'}});
  assert.equal(phenomData('<html>no data</html>'), null);
});

test('Phenom: searches the tech words, keeps each role once, links the role page, and is always partial', async () => {
  const page = (word, jobs) => `<script>phApp.ddo = ${JSON.stringify({eagerLoadRefineSearch: {totalHits: jobs.length, data: {jobs}}})}; x();</script>`;
  const dev = {jobId: '7', title: 'Software Developer', multi_location: ['Pune, India', 'Remote, India'], category: 'IT', type: 'Full-Time', remote: 'Hybrid working', postedDate: '2026-11-20T10:00:00.000+0000', descriptionTeaser: 'Build things.'};
  const data = {jobId: '8', title: 'Data Engineer', location: 'Munich, Germany'};
  const urls = [];
  const get = async url => { urls.push(url); const w = new URL(url).searchParams.get('keywords'); return {url, text: page(w, w === 'software' ? [dev] : w === 'data' ? [data, dev] : [])}; };
  const jobs = await READERS.phenom('careers.example.com/us/en', null, get);
  assert.equal(urls.length, PHENOM_WORDS.length);
  assert.match(urls[0], /^https:\/\/careers\.example\.com\/us\/en\/search-results\?keywords=software&size=100$/);
  assert.equal(jobs.length, 2);
  assert.equal(jobs.partial, true);
  const [a, b] = jobs;
  assert.equal(a.url, 'https://careers.example.com/us/en/job/7');
  assert.equal(a.location, 'Pune, India; Remote, India');
  assert.equal(a.work_mode, 'hybrid');
  assert.equal(a.job_type, 'full_time');
  assert.equal(a.posted_at, '2026-11-20T10:00:00.000Z');
  assert.equal(b.location, 'Munich, Germany');
  await assert.rejects(READERS.phenom('careers.example.com/us/en', null, async url => ({url, text: '<html></html>'})), /Unexpected Phenom page/);
  await assert.rejects(READERS.phenom('../evil/us/en', null, get), /Bad Phenom identifier/);
  await assert.rejects(READERS.phenom('careers.example.com/us/en', null), /page getter/);
});
