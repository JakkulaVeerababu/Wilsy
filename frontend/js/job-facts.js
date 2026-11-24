import {findSkills} from './skills-core.js';
import {decodeEntities} from './job-text.js';

// What a job asks for, read from its title and description: skills, years of experience, the lowest
// degree it accepts, graduation years and how senior it is. Shared by the enrich collector (which
// stores these on each job) and the pages that compare them with a person's profile. Plain text in,
// no network. Anything the text does not say stays empty; nothing is guessed from the company.

export const FACTS_VERSION = 1;

// Degree levels, lowest first. "school" is a school-leaving certificate (12th pass, high school).
export const DEGREES = [['school', 'High school'], ['diploma', 'Diploma'], ['bachelor', "Bachelor's degree"], ['master', "Master's degree"], ['phd', 'PhD']];
const RANK = Object.fromEntries(DEGREES.map(([id], i) => [id, i]));
export const degreeRank = id => RANK[id] ?? -1;

// Short forms ("BS", "MS") count only beside another degree word: "BS/MS", "BS or BA", "MS in".
const SHORT = '(?=\\s*(?:\\/|or\\b|in\\b|degree|with\\b))';
const DEGREE_PATTERNS = [
  ['phd', /\b(?:ph\.?\s?d|doctorate|doctoral degree)\b/],
  ['master', new RegExp(`\\b(?:master's|masters? (?:degree|in|of (?:science|engineering|arts|technology|business|computer)|program|student)|masters?${SHORT}|m\\.?\\s?tech|m\\.e\\.|me\\/m\\.?[- ]?tech|m\\.s\\.|ms${SHORT}|ma${SHORT}|m\\.?\\s?sc|mca|mba|pgdm|post[- ]?graduate\\b|pg degree|advanced degree|graduate degree)(?![a-z])`)],
  ['bachelor', new RegExp(`\\b(?:bachelor'?s?|b\\.?\\s?tech|b\\.e\\.?|be\\/b\\.?[- ]?tech|b\\.s\\.|bs${SHORT}|ba${SHORT}|b\\.?\\s?sc|bca|bba|b\\.com|b\\.a\\.|any graduate|graduate(?=\\s*(?:\\/\\s*post|in any))|graduation in|undergrad\\w*|ug degree)(?![a-z])`)],
  ['diploma', /\bdiploma\b(?! of| from high)(?<!high school diploma)/],
  ['school', /\b(?:high school (?:diploma|degree|certificate)|secondary school certificate|12th pass|10\+2|ged)\b/],
];
// A degree of no named level ("a degree in Computer Science"): counted as a bachelor's when the line names no level.
const ANY_DEGREE = /\b(?:(?:university|college|academic|engineering|technical|relevant|stem|four[- ]year|4[- ]year) degree|degree (?:in|from))\b/;
const NO_DEGREE = /\b(?:no|without an?) (?:college |university |formal )?degree (?:is )?(?:required|needed|necessary)\b|\bdegree (?:is )?not (?:required|necessary|needed)\b/;
// Lines about the team or the company ("our CRO: PhD in AI", "learned Mandarin in high school") are not requirements.
const NOT_REQUIREMENT = /https?:\/\/|linkedin|\bex-|\bformer\b|\bfounders?\b|\bour team\b|\bteam of\b|\bwe(?:'re| are)\b|\bthose who\b|\bmaybe you\b|\bstudents? from\b/;
const EQUIVALENT = /\bor (?:an? )?(?:equivalent|comparable|relevant)(?: [a-z-]+){0,2} (?:experience|combination)/;
const FIELDS = [['Computer Science', /\bcomputer science\b|\bCS\b(?! ?go)/i], ['Computer Engineering', /\bcomputer engineering\b/i], ['Information Technology', /\binformation technology\b|\bIT\b/],
  ['Electrical Engineering', /\belectrical\b|\bEEE?\b/i], ['Electronics', /\belectronics?\b|\bECE\b/i], ['Mechanical Engineering', /\bmechanical\b/i],
  ['Mathematics', /\bmath(?:s|ematics)?\b/i], ['Statistics', /\bstatistics\b/i], ['Data Science', /\bdata science\b/i], ['Physics', /\bphysics\b/i],
  ['Business', /\bbusiness\b|\bMBA\b/i], ['Design', /\bdegree in design\b|\bdesign degree\b|\bHCI\b/i], ['Engineering', /\bengineering\b/i]];

/** The lowest degree a piece of education text names: 'school', 'diploma', 'bachelor', 'master', 'phd', 'none' or ''. */
export function degreeLevel(text) {
  const t = clean(text);
  if(NO_DEGREE.test(t)) return 'none';
  let best = '';
  for(const [id, re] of DEGREE_PATTERNS) if(re.test(t) && (!best || RANK[id] < RANK[best])) best = id;
  return best || (ANY_DEGREE.test(t) ? 'bachelor' : '');
}

/** Up to three fields of study a degree line names; "Engineering" only when no particular branch is named. */
function fieldsIn(line) {
  const found = FIELDS.filter(([, re]) => re.test(line)).map(([name]) => name);
  const specific = found.filter(name => name !== 'Engineering');
  return (specific.some(name => /Engineering/.test(name)) ? specific : found).slice(0, 3);
}

const NUMBER_WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15};
const N = '(?<![\\d,.$])(\\d{1,2}(?:\\.\\d)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)';
const UNIT = '(years?|yrs?|months?)';
const num = value => NUMBER_WORDS[value] ?? Number(value);
const EXPERIENCE_FORMS = [
  [new RegExp(`${N}\\s*\\+?\\s*(?:-|–|—|to)\\s*${N}\\s*\\+?\\s*${UNIT}`), m => [num(m[1]), num(m[2]), m[3]]],
  [new RegExp(`(?:at least|a minimum of|minimum(?: of)?|min\\.?|over|more than|no less than)\\s*${N}\\s*\\+?\\s*${UNIT}`), m => [num(m[1]), null, m[2]]],
  [new RegExp(`${N}\\s*(?:\\+|plus|or more)\\s*${UNIT}`), m => [num(m[1]), null, m[2]]],
  [new RegExp(`${N}\\s*${UNIT}(?:\\s*\\+|\\s+or more|\\s+minimum)?`), m => [num(m[1]), null, m[2]]],
];
const EXPERIENCE_WORDS = /experienc|\bexp\b|track record|background (?:in|with)|professional|hands-on|success|working (?:in|on|with|as)|in (?:an? )?[a-z/ -]{2,40} role|\((?:\d|one|two|three|four|five)[^)]*(?:years?|yrs?)\)/;
// A requirement bullet that opens with the years ("8+ years building secure systems") needs no other word.
const LEADING_YEARS = new RegExp(`^(?:[-•*·▪●]\\s*)?(?:[a-z ]{0,30}:\\s*)?(?:(?:you )?(?:have|has|bring)\\s+)?(?:at least |a minimum of |minimum(?: of)? )?${N}\\s*(?:\\+|plus)?\\s*(?:(?:-|–|—|to)\\s*${N}\\s*\\+?\\s*)?(?:years?|yrs?)\\b(?! old| ago)`);
// Years that are about the company, equity or the calendar, not the candidate.
const NOT_EXPERIENCE = /\b(?:ago|founded|vest\w*|anniversary|warranty|contract|tenure|every|since|history|cliff|run-rate|revenue|audio)\b|\bwe(?: have|'ve| bring)\b|\bfor (?:over|more than) \d|\bin (?:just|only|under|less than)\b|\b(?:last|past|next|first) (?:\d+|few|two|three|five|ten) years\b/;

/** Years of experience asked for in one line: {min, max} or null. Months become fractions of a year. */
export function experienceIn(line) {
  const t = clean(line).trim();
  if(!(EXPERIENCE_WORDS.test(t) || LEADING_YEARS.test(t)) || NOT_EXPERIENCE.test(t)) return null;
  if(/\bno (?:prior |previous )?(?:work |professional |industry )?experience (?:is )?(?:required|needed|necessary)\b/.test(t)) return {min: 0, max: null};
  for(const [re, read] of EXPERIENCE_FORMS) {
    const m = t.match(re);
    if(!m || /^\s*(?:old|ago)\b/.test(t.slice(m.index + m[0].length))) continue;
    let [min, max, unit] = read(m);
    if(/^month/.test(unit)) { min = Math.round(min / 12 * 10) / 10; max = max == null ? null : Math.round(max / 12 * 10) / 10; }
    if(!(min >= 0 && min <= 20)) return null;
    if(max != null && !(max >= min && max <= 30)) max = null;
    return {min, max};
  }
  return null;
}

// Lines under a "Preferred / Nice to have / Bonus" heading, or that say so themselves, are not requirements.
const PREFERRED = /\b(?:preferred|a plus|is a bonus|bonus points?|nice[- ]to[- ]haves?|desirable|desired|good[- ]to[- ]have|advantageous|an advantage|plus points?)\b/;
const LEADS_PREFERRED = /\b(?:ideally|preferably|bonus if|nice to have|bonus points|good to have)\b/i;
const TRAILS_PREFERRED = /\b(?:preferred|a plus|a bonus|desired|desirable|advantageous|an advantage|nice[- ]to[- ]have|good[- ]to[- ]have|plus points?)\b/;
/** The part of a line that is a requirement: before "ideally ...", without clauses that say "... preferred". */
export function requiredPart(line) {
  let text = String(line || '');
  const lead = text.search(LEADS_PREFERRED);
  if(lead >= 0) text = text.slice(0, lead);
  return text.split(/(?<=[,;()])/).filter(clause => !TRAILS_PREFERRED.test(clean(clause))).join('').replace(/[\s,;(]+$/, '').trim();
}
const PREFERRED_HEADING = /^\W*(?:(?:preferred|desired|desirable|bonus|additional|extra)\s+(?:qualifications|skills|experience|requirements|points)|nice[- ]to[- ]haves?|good[- ]to[- ]haves?|bonus(?: points)?|pluses|it'?s a plus if|extra credit)\b/;
const REQUIRED_HEADING =/\b(?:minimum|basic|required|requirements?|must[- ]haves?|qualifications|what you(?:'ll)? (?:need|bring)|who you are|about you|you have|you(?:'ll)? need|skills|eligibility)\b/;

/** The description as lines, each marked required (true) or preferred (false). Bullets on their own line join the next line. */
export function requirementLines(text) {
  const lines = String(text || '').replace(/\r/g, '').replace(/^[\s•·▪●◦*-]+\n/gm, '').split(/\n|(?<=[.;])\s+(?=[A-Z0-9])/);
  let preferredSection = false;
  const out = [];
  for(const raw of lines) {
    const line = raw.trim();
    if(!line) continue;
    const lower = clean(line);
    // A heading: short, no digits, ending in a colon or naming a section ("Preferred qualifications", "Requirements").
    if(line.length <= 60 && !/\d/.test(line) && !/[.;,]$/.test(line)) {
      if(PREFERRED_HEADING.test(lower) || (/:$/.test(line) && PREFERRED.test(lower))) { preferredSection = true; continue; }
      if(REQUIRED_HEADING.test(lower)) preferredSection = false;
    }
    const required = preferredSection ? '' : requiredPart(line);
    out.push([required || line, !!required]);
  }
  return out;
}

const SENIOR_TITLE = /\b(?:senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|vice president|chief|distinguished|fellow)\b/;
const SENIORITY = [
  ['intern', /\b(?:intern(?:ship)?s?|co-?op)\b/],
  ['director', /\b(?:director|vp|vice president|head of|chief|cto)\b/],
  ['principal', /\b(?:principal|distinguished|fellow)\b/],
  ['staff', /\bstaff\b/],
  ['lead', /\b(?:lead|tech lead)\b/],
  ['senior', /\b(?:senior|sr\.?)(?![a-z])/],
  ['entry', /\b(?:new grad(?:uate)?s?|entry[- ]level|early career|university grad(?:uate)?|graduate (?:engineer|program|programme|trainee|scheme|developer)|fresher|trainee|apprentice(?:ship)?)\b/],
  ['junior', /\b(?:junior|jr\.?)(?![a-z])/],
  ['mid', /\b(?:mid[- ]level|intermediate)\b/],
];
/** Seniority from a job title, or '' when the title does not say. */
export function seniorityOf(title) {
  const t = clean(title);
  return SENIORITY.find(([, re]) => re.test(t))?.[0] || '';
}

const NEW_GRAD_TEXT = /\b(?:new grad(?:uate)?s?|recent(?:ly)? graduat\w*|class of 20\d\d|graduating (?:in|by|between|from)|graduated (?:with)?in the (?:last|past)|final[- ]year students?|fresh graduates?|campus (?:hire|hiring|recruit\w*))\b/;
const FRESHER_TEXT = /\b(?:freshers?|0\s*(?:-|–|to)\s*[12]\s*(?:years?|yrs?)|no (?:prior |previous )?(?:work |professional )?experience (?:is )?(?:required|needed|necessary)|entry[- ]level (?:role|position|job|opportunit\w*|candidates?))\b/;
const MENTORING = /\b(?:mentor\w*|manag\w*|lead\w*|guid\w*|coach\w*|train\w*|support\w*|hire|hiring|grow\w*)\s+(?:\w+\s+){0,3}$/;
const textSays = (text, re) => {
  for(const m of text.matchAll(new RegExp(re.source, 'g'))) if(!MENTORING.test(text.slice(Math.max(0, m.index - 40), m.index))) return true;
  return false;
};

/** Years named next to graduation words ("class of 2026", "graduating between Dec 2026 and Jun 2027"). */
export function graduationYears(text) {
  const years = new Set();
  const t = clean(text);
  for(const m of t.matchAll(/graduat\w*|class of|batch|pass(?:ing)?[- ]?outs?/g))
    for(const y of t.slice(m.index, m.index + 60).split('.')[0].matchAll(/\b20(2[4-9]|3[0-2])\b/g)) years.add(Number('20' + y[1]));
  for(const m of t.matchAll(/\b20(2[4-9]|3[0-2])\s*(?:\/\s*20(?:2[4-9]|3[0-2])\s*)?(?:graduates|grads|batch|pass[- ]?outs?)\b/g)) years.add(Number('20' + m[1]));
  return [...years].sort((a, b) => a - b).slice(0, 6);
}

/** Everything the text says about what the job asks for. */
export function jobFacts(job) {
  const title = String(job.title || ''), description = plainLines(job.description).slice(0, 60000);
  const lines = requirementLines(description), required = lines.filter(([, req]) => req).map(([line]) => line);
  const skills = findSkills(`${title}\n${description}`).slice(0, 25);

  let experience = job.experience_text ? experienceIn(job.experience_text) : null;
  for(const line of required) { if(experience) break; experience = experienceIn(line); }

  // The lowest degree any requirement line names; "or equivalent experience" anywhere beside it makes it optional.
  let degree = '', equivalent = false, fields = [], related = false;
  for(const line of required) {
    const lower = clean(line);
    if(NOT_REQUIREMENT.test(lower)) continue;
    const level = degreeLevel(line);
    if(!level) continue;
    if(level === 'none') { degree = 'none'; break; }
    if(!degree || RANK[level] < RANK[degree]) { degree = level; fields = fieldsIn(line); related = /\b(?:related|similar|equivalent|relevant)\b/.test(lower); }
    if(EQUIVALENT.test(lower)) equivalent = true;
  }
  const education = degree === 'none' ? 'No degree required' : degree
    ? `${DEGREES[RANK[degree]][1]}${fields.length ? ` in ${fields.join(', ')}${related ? ' or a related field' : ''}` : ''}${equivalent ? ', or equivalent experience' : ''}` : null;

  const seniority = seniorityOf(title), seniorTitle = SENIOR_TITLE.test(clean(title));
  const intern = !!job.is_internship || job.job_type === 'internship' || seniority === 'intern';
  const lowYears = !experience || experience.min <= 1;
  const text = clean(`${title}\n${required.join('\n')}`);
  const newGrad = !seniorTitle && !intern && lowYears && (['entry'].includes(seniority) && /grad|early career|university/.test(clean(title)) || textSays(text, NEW_GRAD_TEXT));
  const fresher = !seniorTitle && !intern && lowYears && (newGrad || ['entry', 'junior'].includes(seniority) || textSays(text, FRESHER_TEXT)
    || (experience?.min === 0 && (experience.max == null || experience.max <= 2)));
  const stage = intern ? 'internship'
    : fresher || ['entry', 'junior'].includes(seniority) || (experience && experience.min <= 1) ? 'entry'
    : ['senior', 'lead', 'staff', 'principal', 'director'].includes(seniority) || experience?.min >= 5 ? 'senior'
    : seniority === 'mid' || (experience && experience.min < 5) ? 'mid' : null;

  return {skills, experience_min: experience?.min ?? null, experience_max: experience?.max ?? null, education, degree: degree || null,
    graduation_years: graduationYears(`${title}\n${description}`), is_fresher: fresher, is_new_grad: newGrad,
    seniority_level: seniority || null, career_stage: stage};
}

// Stored fields the enrich collector may fill. It only writes a field that is empty, or one it wrote
// itself before (listed in metadata.enrich.f), so values that came from the employer are never replaced.
const EMPTY = {skills: [], experience: null, education: null, graduation_years: [], is_fresher: false, is_new_grad: false, seniority_level: null, career_stage: null};
const stored = (job, field) => field === 'experience' ? (job.experience_min == null && job.experience_max == null ? null : [job.experience_min ?? null, job.experience_max ?? null]) : job[field];
const isEmpty = value => value == null || value === false || (Array.isArray(value) && !value.length) || value === '';
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The PATCH body that brings a stored job up to date with its facts, or null when nothing changes. */
export function factsPatch(job, facts = jobFacts(job)) {
  const meta = job.metadata && typeof job.metadata === 'object' ? job.metadata : {};
  const owned = new Set(Array.isArray(meta.enrich?.f) ? meta.enrich.f : []);
  const want = {skills: facts.skills, experience: facts.experience_min == null ? null : [facts.experience_min, facts.experience_max],
    education: facts.education, graduation_years: facts.graduation_years, is_fresher: facts.is_fresher, is_new_grad: facts.is_new_grad,
    seniority_level: facts.seniority_level, career_stage: facts.career_stage};
  const patch = {};
  const set = (field, value) => {
    if(field === 'experience') { patch.experience_min = value?.[0] ?? null; patch.experience_max = value?.[1] ?? null; }
    else patch[field] = value;
  };
  for(const field of Object.keys(EMPTY)) {
    const current = stored(job, field), next = want[field];
    if(owned.has(field)) {
      if(isEmpty(next)) { if(!isEmpty(current)) set(field, EMPTY[field]); owned.delete(field); }
      else if(!same(current, next)) set(field, next);
    } else if(isEmpty(current) && !isEmpty(next)) { set(field, next); owned.add(field); }
  }
  const marker = {v: FACTS_VERSION, f: [...owned].sort(), ...(facts.degree ? {degree: facts.degree} : {})};
  if(!Object.keys(patch).length && same(meta.enrich, marker)) return null;
  return {...patch, metadata: {...meta, enrich: marker}};
}

/** Description HTML (or escaped HTML) as plain text that keeps its line breaks. */
export function plainLines(value) {
  let text = String(value ?? '');
  for(let pass = 0; pass < 4 && /&[#a-z0-9]+;/i.test(text); pass += 1) text = decodeEntities(text);
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*\/?\s*(?:br|li|p|div|h[1-6]|tr|ul|ol)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function clean(value) {
  return String(value || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
}
