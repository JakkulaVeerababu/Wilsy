import test from 'node:test';
import assert from 'node:assert/strict';
import {readProfile, canonicalSkill, skillMatch, eligibility, rankJobs, skillGaps, companiesHiring, closingSoon, learningPlan, learnLink, inPlace, LEARN} from '../js/my-wilsy-core.js';
import {SKILLS} from '../js/skills-core.js';
import {myWilsyBody} from '../scripts/career-pages.mjs';

const job = (id, extra = {}) => ({id, title: 'Engineer', company: 'Acme', skills: [], tech_stack: [], experience_min: null, education: null, graduation_years: [], seniority_level: null, ...extra});

test('A stored profile is cleaned: skills get WILSY’s names, nonsense becomes not set', () => {
  assert.equal(canonicalSkill(' reactjs '), 'React');
  assert.equal(canonicalSkill('postgres'), 'PostgreSQL');
  assert.equal(canonicalSkill('Prompt engineering'), 'Prompt engineering');
  assert.deepEqual(readProfile('{"skills":["python","Python","SQL"],"degree":"bachelor","gradYear":"2026","years":"1.3","where":"remote"}'),
    {skills: ['Python', 'SQL'], degree: 'bachelor', gradYear: 2026, years: 1.5, where: 'remote'});
  assert.deepEqual(readProfile('not json'), {skills: [], degree: '', gradYear: null, years: null, where: 'any'});
  assert.deepEqual(readProfile({degree: 'wizard', gradYear: 1700, years: -4, where: 'moon'}), {skills: [], degree: '', gradYear: null, years: 0, where: 'any'});
});

test('The match is the share of the job’s skills you have, with related skills at half', () => {
  const m = skillMatch(['Python', 'PostgreSQL'], job(1, {skills: ['Python', 'SQL', 'Docker', 'Kubernetes'], tech_stack: ['python']}));
  assert.deepEqual(m.want, ['Python', 'SQL', 'Docker', 'Kubernetes']);
  assert.deepEqual(m.matched, ['Python']);
  assert.deepEqual(m.close, [['SQL', 'PostgreSQL']]);
  assert.deepEqual(m.missing, ['Docker', 'Kubernetes']);
  assert.equal(m.score, 38); // (1 + 0.5) / 4
  assert.equal(skillMatch(['Python'], job(2)).score, null);
});

test('Eligibility names each stated requirement you miss, and never counts an unstated one', () => {
  const fresher = {skills: [], degree: 'bachelor', gradYear: 2026, years: 0, where: 'any'};
  assert.deepEqual(eligibility(fresher, job(1)), {ok: true, reasons: []});
  assert.deepEqual(eligibility(fresher, job(2, {experience_min: 3, education: 'Master’s degree in Computer Science', graduation_years: [2025]})).reasons,
    ['Asks for 3+ years', 'Asks for a master’s degree', 'For 2025 graduates']);
  assert.equal(eligibility(fresher, job(3, {education: 'Master’s degree, or equivalent experience'})).ok, true);
  assert.equal(eligibility(fresher, job(4, {education: 'BE/B-TECH/MCA'})).ok, true);
  assert.deepEqual(eligibility(fresher, job(5, {seniority_level: 'Senior'})).reasons, ['Senior role']);
  // Nothing entered: nothing can rule a job out.
  assert.equal(eligibility(readProfile(null), job(6, {experience_min: 8, education: 'PhD', seniority_level: 'staff', graduation_years: [2024]})).ok, true);
});

test('Jobs are ranked by how many of your skills they use; gaps, companies and deadlines come from the matches', () => {
  const now = Date.parse('2026-11-23T00:00:00Z');
  const jobs = [
    job(1, {company: 'Acme', skills: ['Python'], first_seen_at: '2026-11-20'}),
    job(2, {company: 'Beta', skills: ['Python', 'SQL', 'Docker', 'Kubernetes', 'Go'], deadline_at: '2026-12-01T00:00:00Z'}),
    job(3, {company: 'Beta', skills: ['Python', 'Docker'], experience_min: 5, location: 'Remote', work_mode: 'remote'}),
    job(4, {company: 'Gamma', skills: ['Java']}),
    job(5, {company: 'Acme', skills: ['SQL', 'Docker'], deadline_at: '2027-03-01T00:00:00Z', location: 'Bengaluru, India'}),
  ];
  const profile = readProfile({skills: ['Python', 'SQL'], years: 1});
  const ranked = rankJobs(profile, jobs);
  assert.deepEqual(ranked.map(r => r.job.id), [2, 1, 3, 5]); // job 4 lists none of your skills
  assert.deepEqual(rankJobs(profile, jobs, {onlyEligible: true}).map(r => r.job.id), [2, 1, 5]);
  assert.deepEqual(rankJobs({...profile, where: 'india'}, jobs).map(r => r.job.id), [5]);
  assert.equal(inPlace('remote', jobs[2]), true);
  assert.deepEqual(skillGaps(ranked).slice(0, 3).map(g => [g.skill, g.jobs]), [['Docker', 3], ['Go', 1], ['Kubernetes', 1]]);
  assert.deepEqual(companiesHiring(ranked).map(c => [c.company, c.jobs, c.skills]), [['Acme', 2, ['Python', 'SQL']], ['Beta', 2, ['Python', 'SQL']]]);
  assert.deepEqual(closingSoon(ranked, {now}).map(r => r.job.id), [2]);
});

test('The 30-day plan covers up to three gaps, with a free place to learn each', () => {
  assert.deepEqual(learningPlan([]), []);
  const one = learningPlan([{skill: 'Docker'}]);
  assert.equal(one.length, 4);
  assert.equal(one[0].link.url, 'https://docs.docker.com/get-started/');
  const three = learningPlan([{skill: 'Docker'}, {skill: 'Kubernetes'}, {skill: 'Go'}]);
  assert.deepEqual(three.map(step => step.skill || null), ['Docker', 'Kubernetes', 'Go', null]);
  assert.deepEqual(learnLink('Snowflake'), {url: '/skills/snowflake', site: 'WILSY skill page', external: false});
  for(const [skill, url] of Object.entries(LEARN)) {
    assert.ok(SKILLS.some(([name]) => name === skill), `${skill} is a known skill`);
    assert.match(url, /^https:\/\/[a-z0-9.-]+\//, skill);
  }
});

test('The My WILSY page is a shell the script fills, and says what leaves the device', () => {
  const html = myWilsyBody();
  assert.match(html, /data-mywilsy/);
  assert.match(html, /<script type="module" src="\/js\/my-wilsy.js"><\/script>/);
  assert.match(html, /only your skill names are looked up/);
  assert.match(html, /id="only-eligible"/);
});
