// Letters and emails for leaving a job, answering an offer and following up on an application.
// The templates are WILSY's own, filled from a few fields. Anything left blank stays as a [placeholder]
// to fill in by hand, so a letter never says something the writer didn't give us.

/** Every field the letters use. `blank` is the placeholder text when a letter's own label doesn't fit. */
export const LETTER_FIELDS = {
  me: {label: 'Your name', type: 'text', max: 60, autocomplete: 'name'},
  to: {label: 'Their name', type: 'text', max: 60},
  company: {label: 'Company', type: 'text', max: 80, autocomplete: 'organization'},
  role: {label: 'Role', type: 'text', max: 80},
  notice: {label: 'Notice period', type: 'notice', max: 40, placeholder: 'e.g. 60 days or 3 months', blank: 'notice period'},
  last: {label: 'Last working day', type: 'date', blank: 'last working day'},
  join: {label: 'Joining date', type: 'date', blank: 'joining date'},
  date: {label: 'Date', type: 'date', blank: 'date'},
  amount: {label: 'What you are asking for', type: 'text', max: 80, placeholder: 'e.g. ₹16 LPA fixed', blank: 'the figure you want'},
  reason: {label: 'Why, in a line (optional)', type: 'text', max: 160, placeholder: 'e.g. another offer at ₹15 LPA'},
  about: {label: 'About you, in a few words', type: 'text', max: 120, placeholder: 'e.g. a final-year CSE student at VIT', blank: 'a few words about you'},
  detail: {label: 'Something you talked about', type: 'text', max: 200, blank: 'something you talked about',
    blankFor: {cold: 'One or two lines on what you have built or done that fits the role.'}},
};

const sign = v => `Best regards,\n${v('me')}`;

/**
 * The letters, in the order the page lists them. fields: what the form asks for; labels: field labels for
 * this letter; subject and body: the text, from v(key) (the value, or its placeholder) and has(key).
 */
export const LETTERS = [
  {id: 'resignation', group: 'Leaving your job', name: 'Resignation letter', fields: ['me', 'to', 'company', 'role', 'notice', 'last'],
    labels: {to: 'Manager’s name', company: 'Your company', role: 'Your role'},
    subject: v => `Resignation – ${v('me')}`,
    body: v => `Dear ${v('to')},

I am writing to formally resign from my position as ${v('role')} at ${v('company')}. In line with my notice period of ${v('notice')}, my last working day will be ${v('last')}.

Thank you for the opportunities and the support I have had here. I have learned a great deal from you and the team, and I am grateful for it.

Before I leave, I will do all I can to hand over my work smoothly: finishing what I can, documenting the rest and helping whoever takes it over. Please let me know how you would like to plan the handover.

Could you confirm my last working day, and let me know the next steps for my relieving letter and full and final settlement?

Yours sincerely,
${v('me')}`},
  {id: 'early-release', group: 'Leaving your job', name: 'Ask to be released early', fields: ['me', 'to', 'last', 'join'],
    labels: {to: 'Manager’s name', last: 'Last day under your notice', join: 'New job’s joining date'},
    subject: v => `Request for early release – ${v('me')}`,
    body: (v, has, x) => `Dear ${v('to')},

My notice period ends on ${v('last')}. I have been offered a role that starts on ${v('join')}, and I would like to ask whether I could be released early, with my last working day on ${has('join') ? x.dayBefore('join') : '[the day before you join]'}.

I will make sure the handover is complete before I go. I can prepare a handover document, finish or pass on my open work, and spend time with whoever takes over, so the team is not left with gaps.

If it helps, I am also happy to set off my remaining leave against the notice, or to buy out the days I do not serve, in line with company policy.

Thank you for considering this.

${sign(v)}`},
  {id: 'counter-offer', group: 'Leaving your job', name: 'Turn down a counter-offer', fields: ['me', 'to', 'last'],
    labels: {to: 'Manager’s name'},
    subject: () => 'Re: My resignation',
    body: v => `Dear ${v('to')},

Thank you for the counter-offer, and for the time you took to put it together. It means a lot that you and the team value my work.

I have thought about it carefully and decided to go ahead with my resignation. The new role is the next step I want in my career, and I have committed to it.

My last working day remains ${v('last')}. Until then, I will stay fully focused on a smooth handover.

Thank you again for everything.

${sign(v)}`},
  {id: 'relieving', group: 'Leaving your job', name: 'Ask for relieving and experience letters', fields: ['me', 'to', 'company', 'role', 'last'],
    labels: {to: 'HR contact’s name', company: 'Your company', role: 'Your role'},
    subject: v => `Relieving letter and final settlement – ${v('me')}`,
    body: v => `Dear ${v('to')},

My last working day at ${v('company')} is ${v('last')}. Could you please share my relieving letter and experience letter on or before that day?

I would also be grateful to know the date of my full and final settlement, and to receive my last payslips, my Form 16 and the details I need to transfer my provident fund.

Please let me know if you need anything from me, such as returning my laptop, ID card or other company property, or a sign-off on my handover.

Thank you for your help.

Best regards,
${v('me')}
${v('role')}`},
  {id: 'offer-accept', group: 'Answering an offer', name: 'Accept an offer', fields: ['me', 'to', 'company', 'role', 'join'],
    labels: {to: 'Recruiter’s name', role: 'Role offered'},
    subject: v => `Acceptance of offer – ${v('role')}`,
    body: v => `Dear ${v('to')},

Thank you for offering me the role of ${v('role')} at ${v('company')}. I am delighted to accept.

As discussed, I will join on ${v('join')}. Please let me know what you need from me before then, such as documents or forms for onboarding.

I am looking forward to working with the team. Thank you again for this opportunity.

${sign(v)}`},
  {id: 'negotiate', group: 'Answering an offer', name: 'Negotiate an offer', fields: ['me', 'to', 'company', 'role', 'amount', 'reason'],
    labels: {to: 'Recruiter’s name', role: 'Role offered'},
    subject: v => `Re: Offer for the ${v('role')} role`,
    body: (v, has) => `Dear ${v('to')},

Thank you for the offer for the ${v('role')} role at ${v('company')}. I am excited about the team and the work, and I would very much like to join.

Before I accept, I would like to discuss the compensation. ${has('reason') ? `Given ${v('reason')}` : 'Given the scope of the role and my experience'}, I was hoping for ${v('amount')}. If we can get closer to that figure, I would be ready to accept.

I am open to talking about how this could work, including the split between fixed pay, a joining bonus and the other parts of the offer.

Thank you for considering this. I look forward to hearing from you.

${sign(v)}`},
  {id: 'joining-date', group: 'Answering an offer', name: 'Ask to move your joining date', fields: ['me', 'to', 'company', 'role', 'join', 'last'],
    labels: {to: 'Recruiter’s name', role: 'Role offered', join: 'Joining date in the offer', last: 'Last day at your current job'},
    subject: v => `Joining date for the ${v('role')} role`,
    body: (v, has, x) => `Dear ${v('to')},

Thank you again for the offer for the ${v('role')} role at ${v('company')}. I am looking forward to joining.

My current employer needs me to serve my notice period, and my last working day there is ${v('last')}. Would it be possible to move my joining date from ${v('join')} to ${has('last') ? x.dayAfter('last') : '[the day after your last working day]'}?

If my employer agrees to release me sooner, I will let you know at once. I am also happy to finish the onboarding paperwork before then.

Thank you for understanding.

${sign(v)}`},
  {id: 'offer-decline', group: 'Answering an offer', name: 'Decline an offer', fields: ['me', 'to', 'company', 'role'],
    labels: {to: 'Recruiter’s name', role: 'Role offered'},
    subject: v => `Your offer for the ${v('role')} role`,
    body: v => `Dear ${v('to')},

Thank you for offering me the role of ${v('role')} at ${v('company')}, and for the time you and the team spent with me during the interviews.

After a lot of thought, I have decided not to accept the offer, as I have chosen a role that is a closer fit for what I want to do next. It was not an easy decision: I enjoyed learning about the team and its work.

I hope we can stay in touch, and I would be glad to cross paths again.

${sign(v)}`},
  {id: 'follow-up', group: 'Applying and interviews', name: 'Follow up on an application', fields: ['me', 'to', 'company', 'role', 'date', 'about'],
    labels: {to: 'Recruiter’s name', role: 'Role you applied for', date: 'Date you applied'},
    subject: v => `Following up on my application for ${v('role')}`,
    body: (v, has) => `Dear ${v('to')},

I applied for the ${v('role')} role at ${v('company')} on ${v('date')}, and I wanted to follow up to say I am still very interested.

${has('about') ? `As ${v('about')}, I believe I could add to the team from the start, and I would welcome the chance to discuss the role.` : 'I believe my skills are a good fit for the role, and I would welcome the chance to discuss it.'}

Is there an update on my application, or anything else I can share?

Thank you for your time.

${sign(v)}`},
  {id: 'thank-you', group: 'Applying and interviews', name: 'Thank you after an interview', fields: ['me', 'to', 'company', 'role', 'date', 'detail'],
    labels: {to: 'Interviewer’s name', date: 'Interview date (optional)'},
    subject: v => `Thank you – ${v('role')} interview`,
    body: (v, has) => `Dear ${v('to')},

Thank you for taking the time to speak with me ${has('date') ? `on ${v('date')}` : 'today'} about the ${v('role')} role at ${v('company')}.

I enjoyed our conversation, especially ${v('detail')}. It made me even more excited about the role and the team.

If you need anything else from me, please let me know. I look forward to hearing about the next steps.

${sign(v)}`},
  {id: 'cold', group: 'Applying and interviews', name: 'Email a recruiter or hiring manager', fields: ['me', 'to', 'company', 'role', 'about', 'detail'],
    labels: {to: 'Their name', role: 'Role you want', detail: 'Why you, in a line or two'},
    subject: v => `${v('role')} roles at ${v('company')}`,
    body: v => `Dear ${v('to')},

I am ${v('me')}, ${v('about')}. I am writing about ${v('role')} roles at ${v('company')}: I would love to work with your team, and I would be grateful for a few minutes of your time.

${v('detail')}

I have attached my resume. If there is an open role that fits, or someone else I should speak to, I would really appreciate a pointer.

Thank you for reading, and I hope to hear from you.

${sign(v)}`},
];

export const LETTER_GROUPS = [...new Set(LETTERS.map(l => l.group))];
export const letterById = id => LETTERS.find(l => l.id === id) || LETTERS[0];

const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const LONG = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
const longDate = day => LONG.format(new Date(day + 'T00:00:00Z'));
const shift = (day, n) => longDate(new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10));

/** The label a field has in a letter. */
export const fieldLabel = (letter, key) => letter.labels?.[key] || LETTER_FIELDS[key].label;

/** One field's value, trimmed and capped, or '' when it is blank or unusable. */
export function fieldValue(key, value) {
  const field = LETTER_FIELDS[key];
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if(!field || !raw) return '';
  if(field.type === 'date') return isDay(raw) ? raw : '';
  if(field.type === 'notice' && /^\d+$/.test(raw)) { const n = Number(raw); return n > 0 && n <= 365 ? `${n} day${n === 1 ? '' : 's'}` : ''; }
  return raw.slice(0, field.max || 80);
}

/** The subject and body of a letter, filled from `values`; blanks become [placeholders]. */
export function letterText(id, values = {}) {
  const letter = letterById(id);
  const clean = Object.fromEntries(letter.fields.map(key => [key, fieldValue(key, values[key])]));
  const has = key => Boolean(clean[key]);
  const placeholder = key => {
    const field = LETTER_FIELDS[key];
    return `[${field.blankFor?.[letter.id] || (letter.labels?.[key] ? letter.labels[key].replace(/ \(optional\)$/, '') : field.blank || field.label)}]`;
  };
  const v = key => {
    if(!has(key)) return placeholder(key);
    const type = LETTER_FIELDS[key].type;
    return type === 'date' ? longDate(clean[key]) : clean[key];
  };
  const x = {dayBefore: key => shift(clean[key], -1), dayAfter: key => shift(clean[key], 1)};
  return {subject: letter.subject(v, has, x), body: letter.body(v, has, x)};
}

/** A mailto: link that opens the letter in the visitor's email app, with no recipient filled in. */
export const mailtoLink = ({subject, body}) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`;

/** Values carried over from another tool in the URL (the notice period calculator). */
export function valuesFromUrl(search) {
  const p = new URLSearchParams(search);
  const out = {};
  for(const key of ['last', 'join', 'notice', 'role', 'company']) {
    const raw = p.get(key) || '';
    if(key === 'notice' && !/^\d{1,3}( (days?|months?))?$/.test(raw)) continue;
    const value = fieldValue(key, raw);
    if(value) out[key] = value;
  }
  const id = p.get('letter');
  return {letter: LETTERS.some(l => l.id === id) ? id : '', values: out};
}
