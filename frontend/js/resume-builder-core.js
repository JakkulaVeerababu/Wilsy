import {escapeHtml as e} from './directory-core.js';

// Resume builder: a draft you fill in, rendered as a one-page resume (HTML for the preview and the PDF,
// plain text for copying and for resume match) and checked for common problems. Runs in the browser only.

export const DRAFT_KEY = 'wilsy-resume-draft';
export const MAX_ENTRIES = 8;

/** Top-level fields: [key, label, max length, kind, placeholder]. */
export const MAIN_FIELDS = [
  ['name', 'Full name', 80, 'text', ''],
  ['headline', 'Headline', 120, 'text', 'e.g. Backend developer · final-year B.Tech'],
  ['email', 'Email', 120, 'email', 'you@example.com'],
  ['phone', 'Phone', 40, 'tel', '+91'],
  ['location', 'City', 80, 'text', 'e.g. Pune'],
  ['links', 'Links, one per line', 400, 'lines', 'linkedin.com/in/your-profile\ngithub.com/your-username'],
  ['summary', 'Summary (optional)', 800, 'area', 'Two or three lines on what you do and the role you want.'],
  ['skills', 'Skills, one group per line', 1000, 'area', 'Languages: Python, Java, SQL\nTools: Git, Docker, AWS'],
  ['achievements', 'Achievements and certifications, one per line', 1500, 'area', 'e.g. Finalist, national hackathon (2025)'],
];

/** Repeating sections: their fields as [key, label, max length, kind, placeholder]. */
export const ENTRY_FIELDS = {
  experience: [['role', 'Role', 80, 'text', 'e.g. Software engineering intern'], ['company', 'Company', 80, 'text', ''], ['place', 'Location', 60, 'text', 'e.g. Bengaluru or Remote'], ['dates', 'Dates', 40, 'text', 'e.g. May 2026 – Jul 2026'], ['points', 'What you did, one point per line', 1500, 'area', 'Start each point with a verb and add a number: Built…, Cut…, Led…']],
  projects: [['name', 'Project name', 80, 'text', ''], ['link', 'Link (optional)', 200, 'text', 'github.com/you/project'], ['tech', 'Built with', 120, 'text', 'e.g. React, Node.js, MongoDB'], ['dates', 'Dates (optional)', 40, 'text', ''], ['points', 'What it does and what you did, one point per line', 1500, 'area', '']],
  education: [['degree', 'Degree or class', 100, 'text', 'e.g. B.Tech, Computer Science'], ['school', 'College or school', 120, 'text', ''], ['dates', 'Years', 40, 'text', 'e.g. 2023 – 2027'], ['score', 'CGPA or percentage (optional)', 40, 'text', 'e.g. CGPA 8.4/10']],
};
export const SECTION_NAMES = {experience: 'Experience', projects: 'Projects', education: 'Education'};

const blankEntry = list => Object.fromEntries(ENTRY_FIELDS[list].map(([key]) => [key, '']));
export const emptyDraft = () => ({...Object.fromEntries(MAIN_FIELDS.map(([key]) => [key, ''])),
  experience: [blankEntry('experience')], projects: [blankEntry('projects')], education: [blankEntry('education')], educationFirst: false});
export const newEntry = blankEntry;

const text = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').slice(0, max);

/** A draft from anything (storage, a test): known fields only, strings capped, at most MAX_ENTRIES per section. */
export function cleanDraft(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = emptyDraft();
  for(const [key, , max] of MAIN_FIELDS) out[key] = text(src[key], max);
  for(const list of Object.keys(ENTRY_FIELDS)) {
    const items = Array.isArray(src[list]) ? src[list].slice(0, MAX_ENTRIES) : [];
    out[list] = items.length ? items.map(item => Object.fromEntries(ENTRY_FIELDS[list].map(([key, , max]) => [key, text(item?.[key], max)]))) : [];
  }
  out.educationFirst = src.educationFirst === true;
  return out;
}

const filled = entry => Object.values(entry).some(value => value.trim());
export const lines = value => String(value || '').split('\n').map(line => line.replace(/^\s*(?:[-*•▪◦–]|\d+[.)])\s+/, '').trim()).filter(Boolean);
const order = draft => draft.educationFirst ? ['education', 'experience', 'projects'] : ['experience', 'projects', 'education'];

/** A link as [href, label], or null. Only https (or http) addresses and bare domains become links. */
export function linkOf(value) {
  const raw = String(value || '').trim();
  if(/^https?:\/\/[^\s<>"']+$/i.test(raw)) return [raw, raw.replace(/^https?:\/\//i, '').replace(/\/$/, '')];
  if(/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"']*)?$/i.test(raw)) return ['https://' + raw, raw.replace(/\/$/, '')];
  return null;
}
const isEmail = value => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(value);

const entryHtml = (list, raw) => {
  const entry = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value.trim()]));
  const points = lines(entry.points);
  const dates = entry.dates ? `<span class="rs-dates">${e(entry.dates)}</span>` : '';
  const meta = items => items.filter(Boolean).length ? `<p class="rs-meta">${items.filter(Boolean).map(v => e(v)).join(' · ')}</p>` : '';
  const pointsHtml = points.length ? `<ul>${points.map(p => `<li>${e(p)}</li>`).join('')}</ul>` : '';
  let title;
  if(list === 'education') title = e(entry.degree || entry.school);
  else if(list === 'projects') { const link = linkOf(entry.link); title = e(entry.name || 'Project') + (link ? ` <a href="${e(link[0])}">${e(link[1])}</a>` : ''); }
  else title = entry.role && entry.company ? `${e(entry.role)}, <span>${e(entry.company)}</span>` : e(entry.role || entry.company);
  const details = list === 'education' ? meta([entry.degree ? entry.school : '', entry.score]) : meta([list === 'projects' ? entry.tech : entry.place]);
  return `<div class="rs-entry"><div class="rs-entry-head"><h4>${title}</h4>${dates}</div>${details}${pointsHtml}</div>`;
};

/** The resume as HTML: every value escaped, and only https/mailto links. */
export function resumeHtml(raw) {
  const d = cleanDraft(raw);
  const contact = [];
  if(d.email.trim()) contact.push(isEmail(d.email.trim()) ? `<a href="mailto:${e(d.email.trim())}">${e(d.email.trim())}</a>` : e(d.email.trim()));
  for(const value of [d.phone, d.location]) if(value.trim()) contact.push(e(value.trim()));
  for(const value of lines(d.links).slice(0, 4)) { const link = linkOf(value); contact.push(link ? `<a href="${e(link[0])}">${e(link[1])}</a>` : e(value)); }
  const skills = lines(d.skills).map(line => { const m = line.match(/^([^:]{1,40}):\s*(.+)$/); return m ? `<li><strong>${e(m[1])}:</strong> ${e(m[2])}</li>` : `<li>${e(line)}</li>`; });
  const parts = [];
  if(d.summary.trim()) parts.push(`<section><h3>Summary</h3><p>${e(d.summary.trim())}</p></section>`);
  if(skills.length) parts.push(`<section><h3>Skills</h3><ul class="rs-skills">${skills.join('')}</ul></section>`);
  for(const list of order(d)) {
    const items = d[list].filter(filled);
    if(items.length) parts.push(`<section><h3>${SECTION_NAMES[list]}</h3>${items.map(item => entryHtml(list, item)).join('')}</section>`);
  }
  const wins = lines(d.achievements);
  if(wins.length) parts.push(`<section><h3>Achievements and certifications</h3><ul>${wins.map(w => `<li>${e(w)}</li>`).join('')}</ul></section>`);
  return `<article class="resume-sheet" aria-label="Resume preview"><header class="rs-head"><p class="rs-name${d.name.trim() ? '' : ' is-empty'}">${e(d.name.trim() || 'Your name')}</p>${d.headline.trim() ? `<p class="rs-headline">${e(d.headline.trim())}</p>` : ''}${contact.length ? `<p class="rs-contact">${contact.join('<span aria-hidden="true"> · </span>')}</p>` : ''}</header>
  ${parts.length ? parts.join('') : '<p class="rs-empty">Your resume appears here as you fill in the form.</p>'}</article>`;
}

/** The resume as plain text, for copying into a form and for resume match. */
export function resumeText(raw) {
  const d = cleanDraft(raw);
  const out = [];
  if(d.name.trim()) out.push(d.name.trim().toUpperCase());
  if(d.headline.trim()) out.push(d.headline.trim());
  const contact = [d.email, d.phone, d.location].map(v => v.trim()).filter(Boolean).concat(lines(d.links).slice(0, 4));
  if(contact.length) out.push(contact.join(' | '));
  const section = (title, body) => { if(body.length) out.push('', title.toUpperCase(), ...body); };
  section('Summary', d.summary.trim() ? [d.summary.trim()] : []);
  section('Skills', lines(d.skills));
  for(const list of order(d)) {
    section(SECTION_NAMES[list], d[list].filter(filled).flatMap(item => {
      if(list === 'education') return [[item.degree, item.school, item.dates, item.score].map(v => v.trim()).filter(Boolean).join(', ')];
      const head = list === 'projects' ? [item.name, item.tech, item.link] : [item.role, item.company, item.place];
      const dates = item.dates.trim() ? ` (${item.dates.trim()})` : '';
      return [head.map(v => v.trim()).filter(Boolean).join(', ') + dates, ...lines(item.points).map(p => '- ' + p)];
    }));
  }
  section('Achievements and certifications', lines(d.achievements).map(p => '- ' + p));
  return out.join('\n').trim();
}

const WEAK = /^(responsible for|worked on|helped|assisted|involved in|handled|participated in|duties included|tasked with)\b/i;

/** Problems and tips: [{level: 'fix' | 'tip' | 'ok', text}], most important first. */
export function resumeChecks(raw) {
  const d = cleanDraft(raw);
  const out = [];
  const fix = t => out.push({level: 'fix', text: t}), tip = t => out.push({level: 'tip', text: t});
  const exp = d.experience.filter(filled), projects = d.projects.filter(filled), edu = d.education.filter(filled);
  const points = [...exp, ...projects].flatMap(item => lines(item.points));
  const words = resumeText(d).split(/\s+/).filter(Boolean).length;
  if(!d.name.trim()) fix('Add your name.');
  const email = d.email.trim(), phone = d.phone.trim();
  if(!email || !phone) fix(`Add ${!email && !phone ? 'an email address and a phone number' : !email ? 'your email address' : 'your phone number'}, so recruiters can reach you.`);
  if(email && !isEmail(email)) fix('Check your email address: it doesn’t look complete.');
  if(!lines(d.skills).length) fix('Add your skills. Recruiters and applicant tracking systems search for them.');
  if(!exp.length && projects.length < 2) fix('Add an internship or job, or at least two projects.');
  if(!edu.length) fix('Add your education: degree, college, years and score.');
  const weak = points.filter(p => WEAK.test(p)).length;
  if(weak) tip(`${weak === 1 ? 'One point starts' : `${weak} points start`} with words like “Responsible for” or “Worked on”. Start with what you did: Built, Cut, Led, Launched.`);
  const numbered = points.filter(p => /\d/.test(p)).length;
  if(points.length >= 3 && numbered < Math.ceil(points.length / 3)) tip('Add numbers to more points: users, time saved, percentages or size.');
  if(points.some(p => p.length > 220)) tip('Some points are long. Keep each to one or two lines.');
  if(points.some(p => /^(i|my)\b/i.test(p))) tip('Leave out “I” and “my” at the start of points.');
  if(d.summary.trim().split(/\s+/).length > 70) tip('Keep the summary to two or three lines.');
  if(words < 120 && d.name.trim()) tip('Quite short so far. Add projects, achievements or more detail.');
  if(!out.length) out.push({level: 'ok', text: 'Looks good. Check it against a job description to find missing keywords.'});
  return out;
}

/** True until anything is typed. */
export const isEmptyDraft = raw => { const d = cleanDraft(raw); return !MAIN_FIELDS.some(([key]) => d[key].trim()) && !Object.keys(ENTRY_FIELDS).some(list => d[list].some(filled)); };

export const checksHtml = checks => checks.length ? `<ul class="rb-check-list">${checks.map(c => `<li class="is-${c.level}"><span>${c.level === 'fix' ? 'Fix' : c.level === 'tip' ? 'Tip' : 'Ready'}</span>${e(c.text)}</li>`).join('')}</ul>` : '<p class="salary-note">Checks appear as you fill in the form.</p>';

// The form, shared by the static page and the script that redraws the repeating sections.
const AUTOCOMPLETE = {name: 'name', email: 'email', phone: 'tel', location: 'address-level2'};
const SINGULAR = {experience: 'Experience', projects: 'Project', education: 'Education'};
function fieldHtml(id, [key, label, max, kind, placeholder], value, attrs) {
  const ph = placeholder ? ` placeholder="${e(placeholder)}"` : '';
  const control = kind === 'area' || kind === 'lines'
    ? `<textarea id="${id}" ${attrs} maxlength="${max}" rows="${kind === 'lines' ? 2 : key === 'points' ? 4 : 3}"${ph}>${e(value)}</textarea>`
    : `<input id="${id}" ${attrs} type="${kind === 'email' || kind === 'tel' ? kind : 'text'}" maxlength="${max}" autocomplete="${AUTOCOMPLETE[key] && !attrs.includes('data-rb-list') ? AUTOCOMPLETE[key] : 'off'}" value="${e(value)}"${ph}>`;
  return `<div class="calc-field rb-field-${key}"><label for="${id}">${e(label)}</label>${control}</div>`;
}
export const mainFieldHtml = (key, value = '') => fieldHtml('rb-' + key, MAIN_FIELDS.find(f => f[0] === key), value, `data-rb-key="${key}"`);
export function entryForm(list, entry, index) {
  const fields = ENTRY_FIELDS[list].map(field => fieldHtml(`rb-${list}-${index}-${field[0]}`, field, entry[field[0]] || '', `data-rb-list="${list}" data-rb-index="${index}" data-rb-key="${field[0]}"`)).join('');
  return `<fieldset class="rb-entry"><legend>${SINGULAR[list]} ${index + 1}</legend>${fields}<button type="button" class="text-button rb-remove" data-rb-remove="${list}" data-rb-index="${index}">Remove ${SINGULAR[list].toLowerCase()} ${index + 1}</button></fieldset>`;
}

/** A made-up student, to show how a resume comes together. Not a real person or employer. */
export const EXAMPLE = {
  name: 'Asha Rao', headline: 'Backend developer · final-year B.Tech, Computer Science', email: 'asha.rao@example.com', phone: '+91 98xxx xxxxx', location: 'Bengaluru',
  links: 'linkedin.com/in/your-profile\ngithub.com/your-username',
  summary: 'Final-year computer science student who builds and ships backend services. Looking for a backend or full-stack role from July 2027.',
  skills: 'Languages: Python, Java, SQL, JavaScript\nBackend: Django, FastAPI, REST APIs, PostgreSQL, Redis\nTools: Git, Docker, Linux, AWS (EC2, S3)',
  experience: [{role: 'Backend intern', company: 'Acme Payments (example)', place: 'Bengaluru', dates: 'May 2026 – Jul 2026', points: 'Built a refund-status API in FastAPI that replaced manual checks by the support team\nCut the slowest report query from 9 s to 1.2 s by adding indexes and rewriting two joins\nWrote tests that raised the service’s coverage from 41% to 78%'}],
  projects: [
    {name: 'Campus bus tracker', link: '', tech: 'Django, PostgreSQL, Leaflet', dates: '2025', points: 'Shows live bus locations for 12 college routes on a map\nSends a notification when the bus is five minutes away'},
    {name: 'Expense splitter', link: '', tech: 'React, Node.js, MongoDB', dates: '2024', points: 'Splits shared expenses between friends and settles them in the fewest payments'},
  ],
  education: [{degree: 'B.Tech, Computer Science and Engineering', school: 'Example Institute of Technology, Bengaluru', dates: '2023 – 2027', score: 'CGPA 8.6/10'}, {degree: 'Class XII (CBSE)', school: 'Example Public School', dates: '2023', score: '92%'}],
  achievements: 'Finalist, national student hackathon (2025)\nAWS Certified Cloud Practitioner (2026)',
  educationFirst: true,
};
