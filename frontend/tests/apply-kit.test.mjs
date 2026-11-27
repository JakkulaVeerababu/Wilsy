import test from 'node:test';
import assert from 'node:assert/strict';
import {applyKit, coverLetter, proofLines, interviewQuestions} from '../js/apply-kit-core.js';

const resume = `Asha Rao
Built REST APIs in Python and Django for a payments team of 6.
Wrote SQL reports in PostgreSQL that cut month-end close from 5 days to 2.
Deployed services on AWS with Docker.
B.Tech in Computer Science, 2022. 3 years of experience.`;
const job = {title: 'Backend Engineer', company: 'Acme', description: 'We need a backend engineer with Python, Django, PostgreSQL, Kubernetes and Go. 2+ years of experience.'};

test('Apply kit: the letter quotes only resume lines, keeps placeholders, and never claims a missing skill', () => {
  const kit = applyKit({resume, name: 'Asha Rao', job});
  assert.ok(kit.proof.length >= 2 && kit.proof.length <= 3);
  for(const p of kit.proof) assert.ok(resume.includes(p.line.replace(/…$/, '')), `quoted line comes from the resume: ${p.line}`);
  assert.match(kit.letter, /^Dear \[Hiring manager’s name\],/);
  assert.match(kit.letter, /Backend Engineer role at Acme/);
  assert.match(kit.letter, /\[One sentence on why/);
  assert.match(kit.letter, /Regards,\nAsha Rao$/);
  assert.doesNotMatch(kit.letter, /Kubernetes|\bGo\b/, 'skills the resume lacks never appear as experience');
  assert.ok(kit.keywords.kept.includes('Python') && kit.keywords.kept.includes('Django'));
  assert.ok([...kit.keywords.missing, ...kit.keywords.close.map(c => c.skill)].includes('Kubernetes'));
  assert.ok(kit.questions.some(q => /project where you used Python/.test(q)));
  assert.ok(kit.questions.some(q => /Kubernetes|Go\b/.test(q)));
  assert.ok(kit.questions.some(q => /2\+ years/.test(q)));
});

test('Apply kit: no proof gives a placeholder body; blanks stay as placeholders; one line is quoted once', () => {
  const letter = coverLetter({});
  assert.match(letter, /\[Role\] role at \[Company\]/);
  assert.match(letter, /\[Two or three lines on work you have done/);
  assert.match(letter, /Regards,\n\[Your name\]$/);
  const one = proofLines('Python and Django APIs.', {matched: ['Python', 'Django']});
  assert.equal(one.length, 1, 'the same resume line is not quoted twice');
  assert.deepEqual(interviewQuestions({match: {close: [], missing: []}}).slice(-2), ['What would you want to achieve in your first 90 days?', 'What questions do you have for us?']);
});

test('Apply kit page: on the tools hub, quick search, footer and every job page', async () => {
  const {TOOLS, searchIndex, applyKitBody} = await import('../scripts/feature-pages.mjs');
  const {header, footer} = await import('../scripts/page-shell.mjs');
  assert.ok(TOOLS.some(t => t[0] === '/apply-kit'));
  assert.ok(searchIndex({companies: []}).some(i => i.u === '/apply-kit'));
  assert.ok(footer().includes('href="/apply-kit"'));
  assert.match(header('apply-kit'), /href="\/tools" class="active"/);
  assert.match(applyKitBody(), /src="\/js\/apply-kit\.js"/);
  const fs = await import('node:fs/promises');
  assert.match(await fs.readFile('scripts/job-pages.mjs', 'utf8'), /\/apply-kit\?job=/);
});
