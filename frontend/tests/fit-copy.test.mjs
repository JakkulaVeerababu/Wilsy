import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {jobFit, fitGates, jobLevel} from '../js/fit-core.js';
import {copyCheck, copyVerdict, markLifts} from '../js/copy-core.js';

const NOW_RESUME = 'Software Engineer, Acme\n4+ years of experience building APIs.\nSkills: Python, Django, MySQL, Docker\nB.Tech in ECE\nLanguages: English, Telugu, Hindi';

test('Citizenship and clearance requirements block the job; equal-opportunity lines do not', () => {
  const blocked = fitGates(NOW_RESUME, 'Engineer. Must be a US citizen to apply. Python.');
  assert.equal(blocked[0].verdict, 'fail');
  assert.match(blocked[0].quote, /Must be a US citizen/);
  assert.equal(fitGates(NOW_RESUME, 'Active TS/SCI security clearance required.')[0].verdict, 'fail');
  const eeo = fitGates(NOW_RESUME, 'We do not discriminate on the basis of race, religion or citizenship. Python.');
  assert.equal(eeo[0].verdict, 'unknown', 'an equal-opportunity statement is not a citizenship rule');
  assert.equal(fitGates(NOW_RESUME, 'We are unable to sponsor visas for this role.')[0].verdict, 'flag');
  assert.equal(fitGates(NOW_RESUME, 'Visa sponsorship is available for this role.')[0].verdict, 'pass');
});

test('A language the job requires but the resume does not list fails; listed languages pass', () => {
  const german = fitGates(NOW_RESUME, 'Fluent German is required for this role.').find(g => g.id === 'language');
  assert.equal(german.verdict, 'fail');
  assert.match(german.note, /German/);
  const hindi = fitGates(NOW_RESUME, 'Must speak Hindi and English.').find(g => g.id === 'language');
  assert.equal(hindi.verdict, 'pass');
  assert.equal(fitGates(NOW_RESUME, 'We have offices in Germany.').some(g => g.id === 'language'), false, 'a country is not a language requirement');
});

test('The fit is scored part by part, leaving out what the job does not describe', () => {
  const job = 'Senior Backend Engineer\nWe need 5+ years of experience with Python, Django and PostgreSQL. Bachelor’s degree in Computer Science. Remote.';
  const fit = jobFit(NOW_RESUME, job);
  const part = id => fit.parts.find(p => p.id === id);
  assert.equal(part('experience').score, 75, '4 years against 5+ is one year short');
  assert.equal(part('level').score, 100, 'senior roles want 4+ years');
  assert.equal(part('education').score, 100, 'a B.Tech meets a bachelor’s degree');
  assert.ok(part('skills').score > 0 && part('skills').score < 100);
  assert.equal(fit.workMode, 'Remote');
  assert.equal(fit.blocked, false);
  assert.ok(fit.score >= 0 && fit.score <= 100);

  const open = jobFit(NOW_RESUME, 'Backend role using Python and Django.');
  assert.equal(open.parts.find(p => p.id === 'experience').score, null);
  assert.equal(open.parts.find(p => p.id === 'education').score, null);
  assert.equal(open.score, open.parts.find(p => p.id === 'skills').score, 'with only skills to judge, the fit is the skills score');
  assert.equal(jobFit(NOW_RESUME, 'Python engineer. Must be a citizen of Canada.').verdict, 'Check the requirement first');
  assert.equal(jobFit(NOW_RESUME, 'Python Django engineer', 0).parts.find(p => p.id === 'experience').score, null, 'typed years still need a job ask');
});

test('Job levels come from the title, and an internship flags an experienced resume as overqualified', () => {
  assert.equal(jobLevel('Staff Software Engineer\nWork with senior engineers').name, 'Lead or manager');
  assert.equal(jobLevel('Software Engineer Intern').name, 'Internship');
  assert.equal(jobLevel('Backend Engineer\nPython'), null);
  const intern = jobFit(NOW_RESUME, 'Software Engineer Intern\nPython and Django.', 6);
  assert.equal(intern.parts.find(p => p.id === 'level').score, 70);
});

test('The copy check finds 5-word lifts and voice-word echoes, but not tool lists or quotes', () => {
  const post = 'You understand messy operational and planning problems. Translate the client’s business needs into data solutions. Python, SQL, dbt, Airflow and Spark.';
  const mine = 'I turn messy operational and planning problems into tools. Python, SQL, dbt, Airflow and Spark. As you put it, "translate the client’s business needs into data solutions".';
  const r = copyCheck(post, mine);
  assert.deepEqual(r.lifts.map(l => l.text), ['messy operational and planning problems']);
  assert.deepEqual(r.echoes, ['messy']);
  assert.ok(r.kept.includes('Python') && r.kept.includes('dbt'));
  assert.equal(copyVerdict(r), 'A few lines echo the posting');
  assert.equal(markLifts('a <b> messy operational and planning problems', [{start: 6, end: 45}]), 'a &lt;b&gt; <mark class="copy-lift">messy operational and planning problems</mark>');
  const own = copyCheck(post, 'I built forecasting tools for warehouse planners at Acme, cutting stockouts by a fifth.');
  assert.equal(own.lifts.length, 0);
  assert.equal(copyVerdict(own), 'Reads as your own words');
});

test('The copy check page and the fit check are built, linked and say nothing is uploaded', async () => {
  const copy = await fs.readFile('dist/copy-check.html', 'utf8');
  assert.match(copy, /data-copy/);
  assert.match(copy, /src="\/js\/copy-check\.js"/);
  assert.match(copy, /nothing you paste is sent to WILSY/);
  assert.match(copy, /ai-job-search/);
  assert.doesNotMatch(copy, /pagead2\.googlesyndication/);
  const resume = await fs.readFile('dist/resume-match.html', 'utf8');
  assert.match(resume, /Job fit check: one job/);
  const tools = await fs.readFile('dist/tools.html', 'utf8');
  assert.match(tools, /href="\/copy-check"/);
  for(const file of ['fit-core.js', 'copy-core.js', 'copy-check.js']) await fs.access('dist/js/' + file);
  const sitemap = await fs.readFile('dist/sitemap.xml', 'utf8');
  assert.match(sitemap, /\/copy-check</);
});

test('skillEvidence quotes the resume line behind each skill', async () => {
  const {skillEvidence} = await import('../js/skills-core.js');
  const proof = skillEvidence('Jane Doe\n• Built a REST API in Python and Django for 2,000 users\n- Wrote SQL reports. Deployed on AWS.\nSkills: Python, Excel at teamwork');
  assert.equal(proof.get('Python'), 'Built a REST API in Python and Django for 2,000 users');
  assert.equal(proof.get('SQL'), 'Wrote SQL reports.');
  assert.equal(proof.get('AWS'), 'Deployed on AWS.');
  assert.equal(proof.has('Excel'), false);
  assert.ok([...skillEvidence('x '.repeat(200) + 'Python').values()][0].length <= 160);
});
