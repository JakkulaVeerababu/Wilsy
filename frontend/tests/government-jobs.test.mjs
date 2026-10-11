import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import snapshot from '../data/government-jobs.json' with {type: 'json'};
import examCatalog from '../data/government-exams.json' with {type: 'json'};
import {governmentJobsPage} from '../scripts/government-jobs-page.mjs';
import {filterGovernmentJobs, sortGovernmentJobs, deadlineState} from '../js/government-jobs.js';
import {filterGovernmentExams, matchesEligibility} from '../js/government-exam-core.js';

const checkedAt = Date.parse(`${snapshot.checkedAt}T00:00:00Z`);

test('Government jobs snapshot has official, current notice rows and source hubs', () => {
  assert.equal(snapshot.checkedAt, '2026-10-11');
  assert.match(snapshot.description, /curated snapshot/i);
  assert.match(snapshot.description, /not an exhaustive guarantee/i);
  assert.equal(snapshot.sourceHubs.length, 7);
  for (const hub of snapshot.sourceHubs) {
    assert.equal(hub.official, true);
    assert.match(hub.url, /^https:\/\//);
    assert.match(hub.domain, /^[a-z0-9.-]+$/);
    assert.ok(hub.note);
    assert.equal(new URL(hub.url).hostname.replace(/^www\./, ''), hub.domain.replace(/^www\./, ''));
  }
  assert.equal(snapshot.jobs.length, 7);
  assert.equal(new Set(snapshot.jobs.map(job => job.id)).size, snapshot.jobs.length);
  for (const job of snapshot.jobs) {
    for (const field of ['id', 'title', 'organization', 'ministryDepartment', 'level', 'gradeLevel', 'salaryPayBand', 'experienceEligibility', 'location', 'openingDate', 'deadline', 'status', 'officialNoticeUrl', 'sourceUrl', 'sourceDomain', 'verificationNote']) {
      assert.ok(job[field], `${job.id}: ${field} is present`);
    }
    assert.equal(job.status, 'Open', `${job.id}: current status`);
    assert.match(job.officialNoticeUrl, /^https:\/\//, `${job.id}: official notice is HTTPS`);
    assert.match(job.sourceUrl, /^https:\/\//, `${job.id}: source is HTTPS`);
    assert.equal(new URL(job.sourceUrl).hostname.replace(/^www\./, ''), job.sourceDomain.replace(/^www\./, ''), `${job.id}: source domain matches URL`);
    assert.ok(Date.parse(`${job.openingDate}T00:00:00Z`) <= checkedAt, `${job.id}: opening date is checked`);
    assert.ok(Date.parse(`${job.deadline}T00:00:00Z`) > checkedAt, `${job.id}: deadline is current at checkedAt`);
  }
  assert.equal(snapshot.jobs.find(job => job.id === 'isro-iprc-technical-assistant-2026').deadline, '2026-10-24');
  assert.equal(snapshot.jobs.find(job => job.id === 'isro-lpsc-scientist-engineer-sc-2026').openingDate, '2026-09-26');
});

test('Government jobs filtering, sorting and deadline labels remain deterministic offline', () => {
  assert.equal(filterGovernmentJobs(snapshot.jobs, {query: 'Mahendragiri'}).length, 4);
  assert.equal(filterGovernmentJobs(snapshot.jobs, {category: 'Medical'})[0].title, 'Medical Officer - SD');
  assert.deepEqual(sortGovernmentJobs(snapshot.jobs, 'seniority').map(job => job.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(sortGovernmentJobs(snapshot.jobs, 'newest').slice(0, 2).map(job => job.id), ['isro-hsfc-medical-officer-sd-2026', 'isro-nesac-director-2026']);
  assert.equal(deadlineState('2026-10-11', checkedAt).label, 'Due today');
  assert.equal(deadlineState('2026-10-31', checkedAt).label, '20 days left');
  assert.equal(deadlineState('2026-10-10', checkedAt).label, 'Deadline passed');
});

test('Government exam catalog has a useful shape and covers the requested browse categories', () => {
  const exams = examCatalog.exams;
  const requestedCategories = [
    'Civil Services',
    'State PSC',
    'Staff Selection',
    'Banking & Finance',
    'Railways',
    'Defence',
    'Police & Uniformed',
    'Teaching',
    'Engineering & Science',
    'Postal',
    'Healthcare',
    'Judiciary',
    'State Services'
  ];

  for (const field of ['dataset', 'checkedAt', 'description', 'classificationNote', 'powerNote', 'tierNote', 'eligibilityNote', 'browseModes']) {
    assert.ok(examCatalog[field], `catalog has ${field}`);
  }
  assert.match(examCatalog.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(exams));
  assert.ok(exams.length >= requestedCategories.length);
  assert.equal(new Set(exams.map(exam => exam.id)).size, exams.length);
  assert.deepEqual(Object.keys(examCatalog.browseModes).sort(), ['eligibility', 'official', 'qualification', 'ranking']);
  for (const mode of Object.values(examCatalog.browseModes)) {
    assert.ok(mode.label);
    assert.ok(Array.isArray(mode.fields) && mode.fields.length);
    assert.ok(mode.note);
  }

  const categories = new Set(exams.map(exam => exam.category));
  for (const category of requestedCategories) assert.ok(categories.has(category), `catalog covers ${category}`);
  for (const qualification of ['10th', '12th', 'ITI/Diploma', 'Graduate', 'Post-graduate', 'B.Tech/Professional']) {
    assert.ok(exams.some(exam => exam.qualification === qualification), `catalog covers ${qualification}`);
  }

  for (const exam of exams) {
    for (const field of ['id', 'shortName', 'name', 'conductingBody', 'category', 'qualification', 'officialUrl', 'officialDomain', 'sourceNote', 'lastVerified', 'updateNote']) {
      assert.ok(field in exam, `${exam.id}: ${field} is present`);
    }
    assert.equal(exam.lastVerified, null, `${exam.id}: overview has no verified notification date`);
    assert.equal(exam.verificationStatus, 'overview-only', `${exam.id}: overview verification status`);
    assert.ok(Array.isArray(exam.categories) && exam.categories.length, `${exam.id}: categories are present`);
    assert.ok(Number.isInteger(exam.qualificationRank) && exam.qualificationRank >= 1 && exam.qualificationRank <= 6, `${exam.id}: qualification rank is bounded`);
    assert.ok(Number.isInteger(exam.minimumQualificationRank) && exam.minimumQualificationRank >= 1 && exam.minimumQualificationRank <= 6, `${exam.id}: minimum qualification rank is bounded`);
    assert.ok(Array.isArray(exam.stages) && exam.stages.length, `${exam.id}: stages are present`);
    assert.ok(Array.isArray(exam.syllabus) && exam.syllabus.length, `${exam.id}: syllabus is present`);
    assert.ok(Array.isArray(exam.studyResources) && exam.studyResources.length, `${exam.id}: study resources are present`);
  }
});

test('Government exam catalog uses official HTTPS sources and labels WILSY ranking aids as non-official', () => {
  for (const exam of examCatalog.exams) {
    const official = new URL(exam.officialUrl);
    assert.equal(official.protocol, 'https:', `${exam.id}: official source is HTTPS`);
    assert.equal(official.hostname.replace(/^www\./, ''), exam.officialDomain.replace(/^www\./, ''), `${exam.id}: source domain matches URL`);
    assert.doesNotMatch(exam.officialUrl, /javascript:|data:/i, `${exam.id}: source URL is not executable`);
  }

  assert.match(examCatalog.description, /not an official ranking/i);
  assert.match(examCatalog.classificationNote, /not official/i);
  assert.match(examCatalog.powerNote, /not an official/i);
  assert.match(examCatalog.powerNote, /ranking/i);
  assert.match(examCatalog.tierNote, /not an official/i);
  assert.match(examCatalog.tierNote, /ranking/i);
  assert.match(examCatalog.browseModes.ranking.note, /official rank/i);
  assert.match(examCatalog.browseModes.eligibility.note, /never a legal eligibility decision/i);
});

test('Government exam browse filters support qualification and category aliases', () => {
  const exams = examCatalog.exams;
  const graduates = filterGovernmentExams(exams, {qualification: 'bachelor'});
  assert.ok(graduates.length > 0);
  assert.ok(graduates.every(exam => exam.qualification === 'Graduate'));

  const statePsc = filterGovernmentExams(exams, {category: 'psc'});
  assert.ok(statePsc.length >= 4);
  assert.ok(statePsc.every(exam => exam.category === 'State PSC' || exam.categories.includes('State PSC')));

  const bankingGraduates = filterGovernmentExams(exams, {qualification: 'Graduate', category: 'banking'});
  assert.ok(bankingGraduates.length >= 4);
  assert.ok(bankingGraduates.every(exam => (exam.category === 'Banking & Finance' || exam.categories.includes('Banking & Finance')) && exam.qualification === 'Graduate'));

  const tierOne = filterGovernmentExams(exams, {tier: 1});
  assert.ok(tierOne.length > 0);
  assert.ok(tierOne.every(exam => exam.prestigeTier === 1));
});

test('Government exam eligibility matching is conservative for qualification, age and state without rejecting category answers', () => {
  const cse = examCatalog.exams.find(exam => exam.id === 'upsc-cse');
  const appscGroupOne = examCatalog.exams.find(exam => exam.id === 'appsc-group-1');
  const chsl = examCatalog.exams.find(exam => exam.id === 'ssc-chsl');
  assert.ok(cse && appscGroupOne && chsl);

  assert.equal(matchesEligibility(cse, {qualification: 'Graduate', age: 32, state: 'Telangana', category: 'General'}), true);
  assert.equal(matchesEligibility(cse, {qualification: '12th', age: 32, state: 'Telangana', category: 'OBC'}), false);
  assert.equal(matchesEligibility(cse, {qualification: 'Graduate', age: 33, state: 'Telangana', category: 'SC'}), true);

  assert.equal(matchesEligibility(chsl, {qualification: '12th', age: 27, state: 'Kerala', category: 'ST'}), true);
  assert.equal(matchesEligibility(chsl, {qualification: '12th', age: 28, state: 'Kerala', category: 'ST'}), true);

  assert.equal(matchesEligibility(appscGroupOne, {qualification: 'Graduate', state: 'Andhra Pradesh', category: 'SC'}), true);
  assert.equal(matchesEligibility(appscGroupOne, {qualification: 'Graduate', state: 'Telangana', category: 'SC'}), true);
  for (const category of ['General', 'OBC', 'SC', 'ST', 'EWS', 'PwBD']) {
    assert.equal(matchesEligibility(appscGroupOne, {qualification: 'Graduate', state: 'Andhra Pradesh', category}), true, `category ${category} does not falsely reject`);
  }
});

test('Government jobs route includes the beginner explainer, browse controls, eligibility finder, catalog, resources and official links', () => {
  const page = governmentJobsPage;
  for (const id of [
    'gov-jobs-exam-catalog',
    'gov-jobs-qualification-browse',
    'gov-jobs-category-browse',
    'gov-jobs-tier-browse',
    'gov-jobs-eligibility-finder',
    'gov-jobs-eligibility-results',
    'gov-jobs-exam-query',
    'gov-jobs-exam-results',
    'gov-jobs-study-roadmap'
  ]) {
    assert.match(page, new RegExp(`(?:id|class)="[^\"]*\\b${id}\\b[^\"]*"`), `${id} is present`);
  }
  assert.match(page, /beginner/i);
  assert.match(page, /Group A, B, C and state Groups (?:1–4|1&ndash;4)/);
  assert.match(page, /study resources|previous question papers|syllabus/i);
  assert.match(page, /official links|official source|Open official/i);
  assert.match(page, /href="https:\/\//);
  assert.ok(examCatalog.exams.some(exam => page.includes(`href="${exam.officialUrl}"`)), 'catalog exposes at least one official exam link');
  assert.match(page, /not an official ranking|not an official prestige/i);
});

test('Government jobs page is generated at its route with safe source-first markup', async () => {
  const distPage = await fs.readFile(path.resolve('dist/government-jobs.html'), 'utf8');
  assert.match(distPage, /<link rel="canonical" href="https:\/\/www\.wilsy\.in\/government-jobs">/);
  assert.match(distPage, /href="\/government-jobs" class="active" aria-current="page">Gov jobs/);
  assert.match(distPage, /id="gov-jobs-search"/);
  assert.match(distPage, /id="gov-jobs-level"/);
  assert.match(distPage, /id="gov-jobs-category"/);
  assert.match(distPage, /id="gov-jobs-location"/);
  assert.match(distPage, /id="gov-jobs-status"/);
  assert.match(distPage, /id="gov-jobs-sort"/);
   assert.match(distPage, /src="\/js\/government-jobs\.js"/);
   assert.match(distPage, /href="\/css\/government-jobs\.css"/);
   assert.ok((await fs.stat(path.resolve('dist/data/government-jobs.json'))).isFile());
   assert.ok((await fs.stat(path.resolve('dist/js/government-exam-core.js'))).isFile());
   assert.match(distPage, /PRIMARY PORTALS/);
  assert.match(distPage, /not an exhaustive guarantee/i);
  assert.match(distPage, /Scientist \/ Engineer &#39;SC&#39;/);
  assert.doesNotMatch(distPage, /<h3>Scientist \/ Engineer 'SC'<\/h3>/);
  assert.doesNotMatch(distPage, /javascript:/i);
  assert.match(governmentJobsPage, /type="application\/json" id="gov-jobs-data"/);
});
