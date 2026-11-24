import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resumeYears, jobWants, scoreJob, rankJobs, chanceLabel, searchSkills} from '../js/resume-jobs-core.js';
import {docxText, unzipEntry, readResumeFile} from '../js/resume-file.js';

const NOW = new Date('2026-11-23T00:00:00Z');

test('Years of experience come from a stated number, or from work date ranges, never from education', () => {
  assert.equal(resumeYears('Backend engineer with 4+ years of experience in Python.', NOW), 4);
  assert.equal(resumeYears('Software Engineer, Acme\nJan 2022 – Present\nIntern, Beta\nJun 2021 - Dec 2021', NOW), 5.5);
  assert.equal(resumeYears('Analyst, X  06/2020 - 05/2022\nEngineer, Y  2021 to 2023', NOW), 3.5, 'overlapping months count once');
  assert.equal(resumeYears('B.Tech, Computer Science, VIT University 2022 - 2026\nCGPA 8.4', NOW), null, 'study years are not work');
  assert.equal(resumeYears('Skills: Python, SQL', NOW), null);
});

const job = (over = {}) => ({id: 1, title: 'Backend Engineer', company: 'Acme', skills: ['Python', 'SQL', 'Docker', 'Kafka'], tech_stack: [], experience_min: null, posted_at: '2026-11-20', ...over});

test('A job’s chance is the share of its skills the resume shows, with related skills at half', () => {
  assert.deepEqual(jobWants(job({skills: ['Vue.js', 'LLM'], tech_stack: ['Node.js']})), ['Vue', 'Node.js', 'LLMs']);
  assert.deepEqual(jobWants(job({skills: [], title: 'React developer', description: 'We use TypeScript.'})), ['TypeScript', 'React']);
  const r = scoreJob(job(), ['Python', 'SQL', 'Kubernetes'], 2);
  assert.deepEqual([r.matched, r.close, r.missing], [['Python', 'SQL'], [['Docker', 'Kubernetes']], ['Kafka']]);
  assert.equal(r.score, 63); assert.equal(r.chance, 'Good chance');
  assert.equal(scoreJob(job({skills: ['Figma'], title: '', description: ''}), ['Python'], 0).score, 0);
  assert.equal(scoreJob(job({skills: [], title: 'Manager', description: 'People skills'}), ['Python'], 0), null, 'no known skills: no score');
});

test('Asking for more years than the resume shows lowers the chance; entry roles favour freshers', () => {
  const full = ['Python', 'SQL', 'Docker', 'Kafka'];
  assert.equal(scoreJob(job({experience_min: 5}), full, 2).score, 64, '3 years short: 36 points off');
  assert.equal(scoreJob(job({experience_min: 10}), full, 0).score, 60, 'at most 40 points off');
  assert.equal(scoreJob(job({experience_min: 5}), full, null).score, 100, 'unknown years: no penalty');
  assert.equal(scoreJob(job({skills: ['Python', 'SQL'], is_fresher: true}), ['Python'], 0).score, 55);
  assert.deepEqual([chanceLabel(70), chanceLabel(69), chanceLabel(45), chanceLabel(25), chanceLabel(24)], ['High chance', 'Good chance', 'Good chance', 'Fair chance', 'Low chance']);
});

test('Jobs are ranked from the highest chance to the lowest, once each, leaving out jobs with nothing in common', () => {
  const jobs = [job({id: 1, skills: ['Python', 'Kafka']}), job({id: 2, skills: ['Python', 'SQL']}), job({id: 2, skills: ['Python', 'SQL']}),
    job({id: 3, skills: ['Figma']}), job({id: 4, skills: ['Python', 'SQL'], posted_at: '2026-11-22'}), job({id: 5, skills: ['Python', 'SQL', 'Kafka', 'Docker'], experience_min: 1})];
  const ranked = rankJobs(jobs, ['Python', 'SQL'], 0);
  assert.deepEqual(ranked.map(r => r.job.id), [4, 2, 1, 5], 'ties: the newer job first; job 3 shares no skill');
  assert.deepEqual(ranked.map(r => r.score), [100, 100, 50, 38]);
  assert.deepEqual(searchSkills(['Figma', 'SQL', 'Python', 'React', 'Excel', 'AWS', 'Java', 'Go'], 4), ['Python', 'Java', 'React', 'SQL']);
});

// A minimal .docx: a zip holding word/document.xml, deflated as Word does.
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for(const [name, text, method = 8] of files) {
    const raw = Buffer.from(text), data = method ? zlib.deflateRawSync(raw) : raw, n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, data); centrals.push(central, n); offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('Word resumes are read in the browser: paragraphs become lines, entities are decoded', async () => {
  const xml = '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Asha Rao</w:t></w:r></w:p><w:p><w:r><w:t>Skills:</w:t></w:r><w:r><w:tab/><w:t>Python &amp; SQL, React</w:t></w:r></w:p></w:body></w:document>';
  const file = zip([['[Content_Types].xml', '<Types/>'], ['word/document.xml', xml]]);
  assert.equal(await docxText(file), 'Asha Rao\nSkills: Python & SQL, React');
  assert.equal(await unzipEntry(zip([['a.txt', 'stored', 0]]), 'a.txt'), 'stored');
  await assert.rejects(docxText(zip([['other.xml', '<x/>']])), /not a Word document/);
  await assert.rejects(docxText(Buffer.from('not a zip')), /not a Word document/);
});

test('Uploads: text files are read, and unsupported, empty or oversized files get a clear message', async () => {
  const file = (name, body, type = '') => new File([body], name, {type});
  assert.match(await readResumeFile(file('cv.txt', 'Python developer with 3 years of experience building APIs.')), /Python developer/);
  await assert.rejects(readResumeFile(file('cv.doc', 'x')), /Older \.doc files/);
  await assert.rejects(readResumeFile(file('cv.png', 'x', 'image/png')), /PDF, a Word/);
  await assert.rejects(readResumeFile(file('cv.txt', 'short')), /No text could be read/);
  await assert.rejects(readResumeFile({name: 'big.pdf', size: 6 * 1024 * 1024}), /larger than 5 MB/);
});

test('The resume match page offers an upload and the ranked job list, and says the resume stays on the device', async () => {
  const html = await fs.readFile(path.resolve('dist/resume-match.html'), 'utf8');
  assert.match(html, /<input id="resume-file" class="sr-only" type="file" accept="\.pdf,\.docx/);
  assert.match(html, /<label class="primary-button resume-upload-button" for="resume-file">Choose a file<\/label>/);
  assert.match(html, /data-resume-jobs-list/); assert.match(html, /Live jobs, highest chance first/);
  assert.match(html, /never uploaded or sent to WILSY/);
  for(const file of ['resume-jobs-core.js', 'resume-file.js']) await fs.access(path.resolve('dist/js', file));
});
