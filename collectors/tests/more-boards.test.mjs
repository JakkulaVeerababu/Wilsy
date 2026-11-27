import test from 'node:test';
import assert from 'node:assert/strict';
import {READERS} from '../boards.mjs';
import {oracleId} from '../more-boards.mjs';

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
