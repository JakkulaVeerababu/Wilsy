import test from 'node:test';
import assert from 'node:assert/strict';
import {jobFacts, factsPatch, experienceIn, degreeLevel, requiredPart, requirementLines, seniorityOf, graduationYears, plainLines, FACTS_VERSION} from '../js/job-facts.js';

test('Years of experience are read from requirement lines, not from company history', () => {
  assert.deepEqual(experienceIn('• 5+ years of backend engineering experience'), {min: 5, max: null});
  assert.deepEqual(experienceIn('- 3–5 years of experience in data engineering'), {min: 3, max: 5});
  assert.deepEqual(experienceIn('Minimum of 2 years of experience building hardware'), {min: 2, max: null});
  assert.deepEqual(experienceIn('• 8+ years building secure IT systems in complex environments'), {min: 8, max: null});
  assert.deepEqual(experienceIn('You have 7 years+ (Seven years or more) of pre-sales experience'), {min: 7, max: null});
  assert.deepEqual(experienceIn('0-2 years of experience in a design engineering role'), {min: 0, max: 2});
  assert.deepEqual(experienceIn('6 months of professional experience'), {min: 0.5, max: null});
  assert.equal(experienceIn('Founded 12 years ago, we have served customers for over 10 years'), null);
  assert.equal(experienceIn('This helped us complete tens of thousands of visits in just two years, industry-leading'), null);
  assert.equal(experienceIn('Developers have processed more than 200,000 years of audio'), null);
  assert.equal(experienceIn('Equity vests over 4 years with a one-year cliff'), null);
});

test('Preferred lines and clauses are not requirements', () => {
  assert.equal(requiredPart('8+ years of experience, ideally with 2+ years at Staff level'), '8+ years of experience');
  assert.equal(requiredPart("Bachelor's degree required, Master's preferred"), "Bachelor's degree required");
  assert.equal(requiredPart("Master's or PhD preferred"), '');
  const lines = requirementLines('Requirements\n•\n3+ years of Python experience\nPreferred qualifications\n•\n6+ years of experience\nBenefits');
  assert.deepEqual(lines.map(([line, required]) => [line, required]), [['Requirements', true], ['3+ years of Python experience', true], ['6+ years of experience', false], ['Benefits', false]]);
});

test('The lowest degree a line accepts is found, with short forms only beside other degree words', () => {
  assert.equal(degreeLevel("Bachelor's or Master's degree in Computer Science"), 'bachelor');
  assert.equal(degreeLevel('BS/MS in Electrical Engineering'), 'bachelor');
  assert.equal(degreeLevel('Advanced degree (MS or PhD) in Machine Learning'), 'master');
  assert.equal(degreeLevel('PhD in Statistics or a related field'), 'phd');
  assert.equal(degreeLevel('BE/B-TECH/MCA'), 'bachelor');
  assert.equal(degreeLevel('Graduate/Post Graduate in any discipline'), 'bachelor');
  assert.equal(degreeLevel('High school diploma or GED'), 'school');
  assert.equal(degreeLevel('A degree in Design or a related field'), 'bachelor');
  assert.equal(degreeLevel('No degree required'), 'none');
  assert.equal(degreeLevel('We accept candidates from AZ, CA, MA, MD and MI'), '');
  assert.equal(degreeLevel('Working knowledge of ERP data models (part masters, work orders)'), '');
  assert.equal(degreeLevel('4+ years of engineering experience, post-graduation'), '');
});

test('Seniority, freshers, new grads and graduation years come from the title and text', () => {
  assert.equal(seniorityOf('Senior Software Engineer'), 'senior');
  assert.equal(seniorityOf('Software Engineer - New Grad'), 'entry');
  assert.equal(seniorityOf('Jr. QA Automation Engineer'), 'junior');
  assert.equal(seniorityOf('Software Engineering Intern'), 'intern');
  assert.equal(seniorityOf('Software Engineer'), '');
  assert.deepEqual(graduationYears('Open to the class of 2026 and students graduating between Dec 2026 and June 2027'), [2026, 2027]);

  const grad = jobFacts({title: 'Software Engineer (New Grad)', description: 'Requirements\n- Python or Java\n- BS/MS in Computer Science, graduating in 2026'});
  assert.equal(grad.is_new_grad, true);
  assert.equal(grad.is_fresher, true);
  assert.equal(grad.career_stage, 'entry');
  assert.deepEqual(grad.skills, ['Python', 'Java']);
  assert.equal(grad.education, "Bachelor's degree in Computer Science");
  assert.deepEqual(grad.graduation_years, [2026]);

  // A senior role that mentors entry-level engineers is not a fresher role.
  const senior = jobFacts({title: 'Senior Backend Engineer', description: '- 6+ years of experience with Go and Kubernetes\n- Mentor new grads and entry-level engineers'});
  assert.equal(senior.is_fresher, false);
  assert.equal(senior.is_new_grad, false);
  assert.equal(senior.experience_min, 6);
  assert.equal(senior.career_stage, 'senior');
  assert.equal(senior.seniority_level, 'senior');

  const escaped = jobFacts({title: 'Data Analyst', description: '&lt;ul&gt;&lt;li&gt;2+ years of SQL experience&lt;/li&gt;&lt;li&gt;Bachelor&#39;s degree in Statistics or a related field, or equivalent practical experience&lt;/li&gt;&lt;/ul&gt;'});
  assert.equal(escaped.experience_min, 2);
  assert.equal(escaped.education, "Bachelor's degree in Statistics or a related field, or equivalent experience");
  assert.equal(escaped.career_stage, 'mid');
  assert.match(plainLines('<p>One</p><p>Two</p>'), /^One\nTwo$/);
});

test('Stored details from the employer are kept; details WILSY filled are kept current', () => {
  const job = {id: 1, title: 'Junior Data Engineer', description: '- 1+ years of Python and Airflow experience', skills: ['Scala'], experience_min: null, experience_max: null,
    education: null, graduation_years: [], is_fresher: false, is_new_grad: false, seniority_level: null, career_stage: null, metadata: {worker: 'fleet'}};
  const first = factsPatch(job);
  assert.equal(first.skills, undefined); // the employer's skills stay
  assert.equal(first.experience_min, 1);
  assert.equal(first.is_fresher, true);
  assert.equal(first.seniority_level, 'junior');
  assert.equal(first.metadata.worker, 'fleet');
  assert.deepEqual(first.metadata.enrich, {v: FACTS_VERSION, f: ['career_stage', 'experience', 'is_fresher', 'seniority_level']});

  const stored = {...job, ...first};
  assert.equal(factsPatch(stored), null); // nothing new

  // The listing is rewritten: WILSY's own values follow the text; cleared ones go back to empty.
  const rewritten = factsPatch({...stored, title: 'Data Engineer', description: '- 3+ years of Python experience'});
  assert.equal(rewritten.experience_min, 3);
  assert.equal(rewritten.is_fresher, false);
  assert.equal(rewritten.seniority_level, null);
  assert.equal(rewritten.career_stage, 'mid');
  assert.deepEqual(rewritten.metadata.enrich.f, ['career_stage', 'experience']);
});
