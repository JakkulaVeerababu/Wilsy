import {matchResume, yearsAsked} from './resume-core.js';
import {resumeYears} from './resume-jobs-core.js';

// Job fit check: can you apply at all, and how well you fit, one part at a time. Pure functions, no network:
// the resume never leaves the browser. The order (hard gates first, then separate scores) is adapted from the
// job-evaluation rules of the open-source ai-job-search project (MIT licence, github.com/ai-job-search-dev/ai-job-search).

// Sentences that only promise not to discriminate mention "citizenship" too; they are not requirements.
const EEO = /discriminat|without regard|regardless of|equal (?:employment )?opportunit|protected (?:class|characteristic|veteran)|affirmative action/i;
const CITIZEN = /\b(?:citizens? only|must be (?:a |an )?(?:[a-z]+ )?(?:citizen|national)|(?:[a-z]+ )?citizenship (?:is )?required|requires? (?:[a-z]+ )?citizenship|permanent residen(?:t|cy)|green card(?: holder)?|pr holders?)\b/i;
const CLEARANCE = /\b(?:security clearance|ts\/sci|top secret|secret clearance|active clearance|clearance (?:is )?required|public trust)\b/i;
const NO_SPONSOR = /\b(?:no|not|unable to|cannot|can['’]?t|won['’]?t|will not|does not|do not|doesn['’]?t|don['’]?t)\b[^.\n]{0,50}\bsponsor|without (?:the need for |requiring )?(?:visa |employer |future )?sponsorship|sponsorship (?:is )?not (?:available|provided|offered)/i;
const SPONSOR = /\b(?:visa sponsorship (?:is )?(?:available|provided|offered)|(?:we|company) (?:can |will |do |does )?(?:offer |provide )?(?:visa )?sponsor(?:ship)?\b|sponsorship (?:is )?(?:available|provided|offered)|relocation (?:support|assistance|package))/i;

export const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Urdu',
  'German', 'French', 'Spanish', 'Portuguese', 'Italian', 'Dutch', 'Japanese', 'Korean', 'Mandarin', 'Chinese', 'Cantonese', 'Arabic', 'Russian',
  'Polish', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Turkish', 'Hebrew', 'Vietnamese', 'Thai', 'Indonesian', 'Malay'];
const LANGUAGE_NEED = /\b(?:fluen(?:t|cy)|proficien(?:t|cy)|native|business[- ]level|professional working|required|must|mandatory|essential|[abc][12]\b|written and (?:spoken|verbal)|spoken and written)/i;

const sentences = text => String(text || '').split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(Boolean);
const quote = s => s.length > 220 ? s.slice(0, 217) + '…' : s;
const firstSentence = (text, pattern) => sentences(text).find(s => pattern.test(s) && !EEO.test(s));

/** Hard gates, checked before any score. verdict: 'fail' (can't apply), 'flag' (check it), 'pass', 'unknown' (not mentioned). */
export function fitGates(resume, job) {
  const gates = [];
  const citizen = firstSentence(job, CITIZEN), clearance = firstSentence(job, CLEARANCE);
  const noSponsor = firstSentence(job, NO_SPONSOR), sponsor = firstSentence(job, SPONSOR);
  if(citizen || clearance) gates.push({id: 'eligibility', label: 'Who can apply', verdict: 'fail', quote: quote(citizen || clearance),
    note: clearance && !citizen ? 'The job needs a security clearance, which is normally given only to that country’s citizens.' : 'The job is open only to citizens or permanent residents. Apply only if you are one.'});
  else if(noSponsor) gates.push({id: 'eligibility', label: 'Who can apply', verdict: 'flag', quote: quote(noSponsor),
    note: 'The employer won’t sponsor a work visa. Apply only if you can already work in that country.'});
  else if(sponsor) gates.push({id: 'eligibility', label: 'Who can apply', verdict: 'pass', quote: quote(sponsor), note: 'The employer says it sponsors visas or helps with relocation.'});
  else gates.push({id: 'eligibility', label: 'Who can apply', verdict: 'unknown', note: 'The job doesn’t say who can apply. For a job abroad, check the employer’s careers page for visa rules.'});

  const known = new Set(LANGUAGES.filter(l => new RegExp(`\\b${l}\\b`, 'i').test(resume)));
  if(String(resume || '').trim()) known.add('English'); // the resume itself is written in English
  const needed = [];
  for(const s of sentences(job)) {
    if(!LANGUAGE_NEED.test(s) || EEO.test(s)) continue;
    for(const l of LANGUAGES) if(new RegExp(`\\b${l}\\b`, 'i').test(s) && !needed.some(n => n.language === l)) needed.push({language: l, quote: quote(s)});
  }
  const missing = needed.filter(n => !known.has(n.language));
  if(missing.length) gates.push({id: 'language', label: 'Languages', verdict: 'fail', quote: missing[0].quote,
    note: `The job asks for ${missing.map(n => n.language).join(' and ')}, which your resume doesn’t list. If you speak ${missing.length > 1 ? 'them' : 'it'}, add a Languages line.`});
  else if(needed.some(n => n.language !== 'English')) gates.push({id: 'language', label: 'Languages', verdict: 'pass', quote: needed.find(n => n.language !== 'English').quote, note: 'Your resume lists the languages this job asks for.'});
  return gates;
}

// Job levels, most senior first, read from the job's title area: [name, pattern, usual years from, to].
const LEVELS = [
  ['Lead or manager', /\b(?:lead|staff|principal|architect|head of|manager|director)\b/i, 7, 40],
  ['Senior', /\b(?:senior|sr\.?)\b/i, 4, 40],
  ['Internship', /\b(?:intern|internship|trainee)\b/i, 0, 1],
  ['Entry level', /\b(?:entry[- ]level|fresher|freshers|graduate|new grad|junior|jr\.?|associate|apprentice)\b/i, 0, 2],
];
export function jobLevel(job) {
  const head = String(job || '').split('\n').find(line => line.trim()) || '';
  const area = `${head} ${String(job || '').slice(0, 160)}`;
  const hit = LEVELS.find(([, pattern]) => pattern.test(head)) || LEVELS.find(([, pattern]) => pattern.test(area));
  return hit ? {name: hit[0], from: hit[2], to: hit[3]} : null;
}

// Degrees from lowest to highest. "MS" alone is left out: it usually means Microsoft ("MS Excel").
const DEGREES = [
  ['Diploma', /\b(?:diploma|polytechnic)\b/i],
  ['Bachelor’s', /\b(?:bachelor['’]?s?|b\.?\s?tech|b\.\s?e\.?|b\.?\s?sc|b\.?com|bca|bba|undergraduate|graduate degree in|degree in)\b/i],
  ['Master’s', /\b(?:master['’]?s?|m\.?\s?tech|m\.\s?e\.|m\.\s?s\.|m\.?\s?sc|mca|mba|postgraduate|post-graduate)\b/i],
  ['PhD', /\b(?:ph\.?\s?d|doctorate|doctoral)\b/i],
];
const degreeIn = (text, pick) => {
  const found = DEGREES.map(([name, pattern], i) => pattern.test(text) ? i : -1).filter(i => i >= 0);
  return found.length ? pick(...found) : null;
};

const clamp = n => Math.round(Math.min(100, Math.max(0, n)));
export const WEIGHTS = {skills: 0.5, experience: 0.25, level: 0.15, education: 0.1};

/**
 * The full fit check. years: the visitor's own number, or null to read it from the resume.
 * Returns {gates, parts, score, verdict, match, workMode}. Each part has score 0–100, or null when the job or
 * the resume doesn't say enough to judge it; the overall score averages the parts that have one, by WEIGHTS.
 */
export function jobFit(resume, job, years = null) {
  const match = matchResume(resume, job);
  const have = years != null && Number.isFinite(Number(years)) ? Number(years) : resumeYears(resume);
  const asks = yearsAsked(job), level = jobLevel(job);
  const parts = [];
  parts.push({id: 'skills', label: 'Skills', score: match.score,
    note: match.score == null ? 'The job text names no skill WILSY recognises.' : `${match.matched.length} of ${match.want.length} skills shown${match.close.length ? `, ${match.close.length} close` : ''}.`});
  if(asks == null) parts.push({id: 'experience', label: 'Experience', score: null, note: 'The job doesn’t ask for a number of years.'});
  else if(have == null) parts.push({id: 'experience', label: 'Experience', score: null, note: `The job asks for ${asks}+ years. Add your years above, or dates to your resume.`});
  else parts.push({id: 'experience', label: 'Experience', score: have >= asks ? 100 : clamp(100 - (asks - have) * 25),
    note: have >= asks ? `It asks for ${asks}+ years; you show ${have}.` : `It asks for ${asks}+ years; you show ${have}. ${asks - have >= 3 ? 'That’s a big gap.' : 'Close enough to try if your projects are strong.'}`});
  if(!level || have == null) parts.push({id: 'level', label: 'Level', score: null, note: level ? `${level.name} role. Add your years to compare.` : 'The title doesn’t say the level.'});
  else {
    const score = have < level.from ? clamp(100 - (level.from - have) * 20) : have > level.to + 2 ? 70 : 100;
    parts.push({id: 'level', label: 'Level', score, note: score === 100 ? `${level.name} role, which suits your experience.` : have < level.from ? `${level.name} role; these usually want ${level.from}+ years.` : `${level.name} role; you may be overqualified.`});
  }
  const wantDegree = degreeIn(firstSentence(job, /degree|bachelor|master|b\.?\s?tech|m\.?\s?tech|ph\.?\s?d|diploma|graduate|mca|mba/i) || '', Math.min);
  const haveDegree = degreeIn(resume, Math.max);
  if(wantDegree == null) parts.push({id: 'education', label: 'Education', score: null, note: 'The job doesn’t name a degree.'});
  else if(haveDegree == null) parts.push({id: 'education', label: 'Education', score: null, note: `The job asks for a ${DEGREES[wantDegree][0]} degree; your resume doesn’t show one clearly.`});
  else parts.push({id: 'education', label: 'Education', score: haveDegree >= wantDegree ? 100 : haveDegree === wantDegree - 1 ? 50 : 20,
    note: haveDegree >= wantDegree ? `It asks for a ${DEGREES[wantDegree][0]} degree; you show ${DEGREES[haveDegree][0]}.` : `It asks for a ${DEGREES[wantDegree][0]} degree; you show ${DEGREES[haveDegree][0]}.`});

  const scored = parts.filter(p => p.score != null);
  const weight = scored.reduce((sum, p) => sum + WEIGHTS[p.id], 0);
  const score = match.score == null || !weight ? null : clamp(scored.reduce((sum, p) => sum + p.score * WEIGHTS[p.id], 0) / weight);
  const gates = fitGates(resume, job);
  const blocked = gates.some(g => g.verdict === 'fail');
  const text = String(job || '').toLowerCase();
  const workMode = /\bremote\b/.test(text) ? (/\bhybrid\b/.test(text) ? 'Remote or hybrid' : 'Remote') : /\bhybrid\b/.test(text) ? 'Hybrid' : /\b(?:on-?site|in[- ]office|work from office)\b/.test(text) ? 'On-site' : null;
  return {gates, parts, score, match, workMode, blocked,
    verdict: blocked ? 'Check the requirement first' : score == null ? 'Not enough to judge' : score >= 75 ? 'Strong fit' : score >= 55 ? 'Good fit' : score >= 35 ? 'Partial fit' : 'Weak fit'};
}
