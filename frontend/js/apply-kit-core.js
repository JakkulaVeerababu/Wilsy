import {jobFit} from './fit-core.js';
import {skillEvidence} from './skills-core.js';

// Apply kit: everything for one application on one page, built from the visitor's own resume and the job
// posting, in the browser. Nothing is invented: the cover letter only quotes lines that are already in the
// resume, and anything it cannot know stays as a [placeholder] to fill in by hand. Ideas from the open-source
// Reparse (job-specific application packets, evidence per requirement) and career-materials-builder
// (never invent achievements) projects, both MIT; no code copied.

export const MAX_PROOF = 3;

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const ends = line => /[.!?…]$/.test(line) ? line : line + '.';

/** Matched skills that have a resume line behind them, in the job's order, at most `max`. */
export function proofLines(resume, match, max = MAX_PROOF) {
  const proof = skillEvidence(resume), used = new Set(), out = [];
  for(const skill of match.matched) {
    const line = proof.get(skill);
    if(!line || used.has(line)) continue;
    used.add(line);
    out.push({skill, line});
    if(out.length >= max) break;
  }
  return out;
}

/** A cover-letter draft. Only resume lines are quoted as experience; blanks stay as [placeholders]. */
export function coverLetter({name = '', title = '', company = '', proof = []}) {
  const me = clean(name) || '[Your name]', role = clean(title) || '[Role]', org = clean(company) || '[Company]';
  const body = proof.length
    ? [['From my resume, the experience closest to what this role asks for:', ...proof.map(p => `• ${p.skill}: ${ends(p.line)}`)].join('\n'),
      '[One or two sentences on the result of that work: what changed, for whom, with a number if you have one.]']
    : ['[Two or three lines on work you have done that fits this role: the project, what you did and the result.]'];
  return [
    'Dear [Hiring manager’s name],',
    `I am applying for the ${role} role at ${org}. [One sentence on why this team or product interests you.]`,
    ...body,
    `I would welcome the chance to talk about how I can help ${org}. Thank you for your time.`,
    `Regards,\n${me}`,
  ].join('\n\n');
}

/** Likely interview questions for this job, from what it asks for and how the resume compares. */
export function interviewQuestions({title = '', match, asks = null, proof = []}) {
  const role = clean(title) || 'this role';
  const out = [`Walk me through your background and why you applied for ${role}.`];
  for(const p of proof.slice(0, 2)) out.push(`Tell me about a project where you used ${p.skill}. What was hard, and what did you do?`);
  for(const [skill, near] of (match.close || []).slice(0, 2)) out.push(`This role uses ${skill}. You have worked with ${near}; how would you pick up ${skill}?`);
  for(const skill of (match.missing || []).slice(0, 2)) out.push(`The team uses ${skill}. How would you get up to speed in your first month?`);
  if(asks) out.push(`The role asks for ${asks}+ years of experience. Which of your work best shows that level?`);
  out.push('What would you want to achieve in your first 90 days?', 'What questions do you have for us?');
  return out;
}

/** The whole kit for one job: fit, proof, keywords, a letter draft and questions. */
export function applyKit({resume = '', name = '', job = {}}) {
  const posting = [job.title, job.description].filter(Boolean).join('\n\n');
  const fit = jobFit(resume, posting);
  const proof = proofLines(resume, fit.match);
  const asks = fit.match.years ?? null;
  return {
    fit, proof,
    keywords: {kept: fit.match.matched, close: fit.match.close.map(([skill, near]) => ({skill, near})), missing: fit.match.missing},
    letter: coverLetter({name, title: job.title, company: job.company, proof}),
    questions: interviewQuestions({title: job.title, match: fit.match, asks, proof}),
  };
}
