import {findSkills} from './skills-core.js';

// Resume match: which of a job's skills a resume shows, and which it doesn't. Runs in the browser only;
// the resume text is never sent anywhere.

export const RESUME_KEY = 'wilsy-resume-text';
export const RESUME_MAX = 30000;
/** The resume builder hands its text to resume match here, for one page load in this tab. */
export const RESUME_HANDOFF = 'wilsy-resume-handoff';

// Skills close enough that showing one is half-credit for another ("LLMs" for "Generative AI").
export const RELATED = [
  ['Generative AI', 'LLMs', 'RAG', 'NLP'], ['Machine learning', 'Deep learning', 'PyTorch', 'TensorFlow', 'scikit-learn', 'Computer vision'],
  ['SQL', 'PostgreSQL', 'MySQL', 'BigQuery', 'Snowflake'], ['React', 'Next.js', 'Vue', 'Angular'], ['JavaScript', 'TypeScript', 'Node.js'],
  ['Docker', 'Kubernetes'], ['Spark', 'Kafka', 'Airflow', 'ETL', 'dbt'], ['Tableau', 'Power BI', 'Looker'], ['Microservices', 'Distributed systems'],
  ['iOS', 'Swift'], ['Android', 'Kotlin'], ['AWS', 'GCP', 'Azure'],
];
const relatedTo = (skill, mine) => RELATED.find(group => group.includes(skill))?.find(other => other !== skill && mine.has(other)) || '';

/** matched: skills in both. close: [missing skill, related skill the resume shows] for half credit. */
export function matchResume(resume, job) {
  const want = findSkills(job), have = findSkills(resume), mine = new Set(have);
  const matched = want.filter(skill => mine.has(skill));
  const close = want.filter(skill => !mine.has(skill)).map(skill => [skill, relatedTo(skill, mine)]).filter(([, near]) => near);
  const missing = want.filter(skill => !mine.has(skill) && !close.some(([s]) => s === skill));
  return {want, matched, close, missing, extra: have.filter(skill => !want.includes(skill)),
    score: want.length ? Math.round((matched.length + close.length / 2) / want.length * 100) : null, years: yearsAsked(job)};
}

export function verdict(score) {
  if(score == null) return 'No skills found in the job text';
  return score >= 75 ? 'Strong match' : score >= 50 ? 'Good match' : score >= 25 ? 'Partial match' : 'Low match';
}

/** The smallest "N years" or "N+ years" of experience a listing asks for, or null. */
export function yearsAsked(text) {
  const years = [...String(text || '').toLowerCase().matchAll(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2}\s*)?\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:\w+\s+){0,3}?experience/g)]
    .map(m => Number(m[1])).filter(n => n > 0 && n <= 30);
  return years.length ? Math.min(...years) : null;
}
