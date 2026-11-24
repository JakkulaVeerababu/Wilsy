import {findSkills} from './skills-core.js';
import {RELATED} from './resume-core.js';

// Resume → live jobs, ranked by the chance of a match. Pure functions, no network or DOM, so the tests
// can run them; js/resume-match.js loads the jobs and shows the list. The resume never leaves the browser.

const MONTHS = {jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11};
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
// "Jan 2022 – Present", "06/2021 - 03/2023", "2019 to 2021".
const RANGE = new RegExp(`(?:${MONTH}\\s*'?|(\\d{1,2})\\s*[/.-]\\s*)?((?:19|20)\\d{2})\\s*(?:-|–|—|to|till|until)\\s*(?:(?:${MONTH}\\s*'?|(\\d{1,2})\\s*[/.-]\\s*)?((?:19|20)\\d{2})|(present|current|now|today|date))`, 'gi');
// Ranges under these headings are studies, not work.
const EDUCATION = /\b(education|academic|qualification|b\.?\s?tech|b\.?\s?e\b|bachelor|master|m\.?\s?tech|mca|bca|b\.?\s?sc|m\.?\s?sc|mba|degree|university|college|school|class (?:x|xii|10|12)|cgpa|gpa|percentage)\b/i;

/**
 * Years of work experience a resume shows: a stated "N+ years of experience", otherwise the months
 * covered by its work date ranges (overlaps counted once; ranges on education lines left out).
 * null when the resume shows neither. now: for "Present".
 */
export function resumeYears(text, now = new Date()) {
  const source = String(text || '').slice(0, 60000);
  const stated = [...source.toLowerCase().matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:\w+\s+){0,3}?experience/g)]
    .map(m => Number(m[1])).filter(n => n > 0 && n <= 40);
  if(stated.length) return Math.max(...stated);
  const months = new Set(), nowIndex = now.getFullYear() * 12 + now.getMonth();
  for(const line of source.split(/\n/)) {
    if(EDUCATION.test(line)) continue;
    for(const m of line.matchAll(RANGE)) {
      const startMonth = m[1] ? MONTHS[m[1].slice(0, 3).toLowerCase()] : m[2] ? Number(m[2]) - 1 : 0;
      const endMonth = m[7] ? nowIndex % 12 : m[4] ? MONTHS[m[4].slice(0, 3).toLowerCase()] : m[5] ? Number(m[5]) - 1 : 11;
      const start = Number(m[3]) * 12 + Math.min(11, Math.max(0, startMonth));
      const end = m[7] ? nowIndex : Number(m[6]) * 12 + Math.min(11, Math.max(0, endMonth));
      if(end < start || end > nowIndex + 1 || end - start > 480) continue;
      for(let i = start; i <= Math.min(end, nowIndex); i++) months.add(i);
    }
  }
  return months.size ? Math.round(months.size / 12 * 2) / 2 : null;
}

/** The skills a job asks for: its listed skills and tech stack, or else its title and description. */
export function jobWants(job) {
  const listed = findSkills([...(job.skills || []), ...(job.tech_stack || [])].join(', '));
  return listed.length ? listed : findSkills(`${job.title || ''}\n${job.description || ''}`);
}

const relatedIn = (skill, mine) => RELATED.find(group => group.includes(skill))?.find(other => other !== skill && mine.has(other)) || '';

export const CHANCES = [[70, 'High chance'], [45, 'Good chance'], [25, 'Fair chance'], [0, 'Low chance']];
export const chanceLabel = score => CHANCES.find(([min]) => score >= min)[1];

/**
 * One job's match with a resume's skills and years.
 * score (0–100): the share of the job's skills the resume shows (a related skill counts half), less
 * 12 points for each year the job asks for beyond what the resume shows (at most 40). Entry-level roles
 * get 5 points for a resume with under a year of experience. null when the job names no skill WILSY knows.
 */
export function scoreJob(job, skills, years) {
  const want = jobWants(job), mine = new Set(skills);
  if(!want.length) return null;
  const matched = want.filter(s => mine.has(s));
  const close = want.filter(s => !mine.has(s)).map(s => [s, relatedIn(s, mine)]).filter(([, near]) => near);
  const missing = want.filter(s => !mine.has(s) && !close.some(([c]) => c === s));
  let score = (matched.length + close.length / 2) / want.length * 100;
  const asks = Number.isFinite(Number(job.experience_min)) && job.experience_min !== null ? Number(job.experience_min) : null;
  const gap = years != null && asks != null ? Math.max(0, asks - years) : 0;
  score -= Math.min(40, gap * 12);
  const entry = job.is_fresher === true || job.is_new_grad === true || job.is_internship === true || /^(entry|fresher|intern)/i.test(job.career_stage || '');
  if(entry && years != null && years < 1) score += 5;
  score = Math.round(Math.min(100, Math.max(0, score)));
  return {job, score, chance: chanceLabel(score), matched, close, missing, asks, gap};
}

/** Jobs ranked from the highest chance to the lowest; ties go to more matched skills, then the newest. */
export function rankJobs(jobs, skills, years) {
  const seen = new Set(), out = [];
  for(const job of jobs) {
    if(!job || seen.has(job.id)) continue;
    seen.add(job.id);
    const r = scoreJob(job, skills, years);
    if(r && r.matched.length + r.close.length > 0) out.push(r);
  }
  const time = r => Date.parse(r.job.posted_at || r.job.first_seen_at || '') || 0;
  return out.sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || time(b) - time(a));
}

/** The skills to search live jobs by: the resume's skills, the ones employers ask for most first. */
export function searchSkills(skills, max = 6) {
  const priority = ['Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'SQL', 'Node.js', 'AWS', 'Machine learning', 'Go', 'C++', 'Kubernetes', 'Docker'];
  return [...skills].sort((a, b) => (priority.indexOf(a) + 1 || 99) - (priority.indexOf(b) + 1 || 99)).slice(0, max);
}
