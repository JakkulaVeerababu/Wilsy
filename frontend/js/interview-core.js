import {escapeHtml as e} from './directory-core.js';

// Interview answers: the questions most interviews include, each with a simple structure to fill in, an
// example answer written for WILSY (the people, companies and numbers in the examples are made up), and
// checks on length and content. Answers are timed at 140 spoken words a minute.

export const IA_KEY = 'wilsy-interview-answers';
export const SPOKEN_WPM = 140;
export const MAX_FIELD = 700;
export const IA_GROUPS = [['you', 'About you'], ['stories', 'Your experience'], ['job', 'This job']];

const STAR = (situation, task, action, result) => [['situation', 'Situation', situation], ['task', 'Your task', task], ['action', 'What you did', action], ['result', 'The result', result]];

/**
 * id, group, q (the question), why (what the interviewer wants), target [min, max] seconds,
 * fields [key, label, placeholder], example (one part per field), star (a story question).
 */
export const QUESTIONS = [
  {id: 'about-yourself', group: 'you', q: 'Tell me about yourself.', target: [45, 90],
    why: 'A short story that links your background to this role: what you do now, what you have done that fits, and why this job is your next step. Not your life history.',
    fields: [['now', 'Now', 'I’m a final-year computer science student at …'], ['before', 'What you’ve done that fits', 'Over the last year I built … which …'], ['next', 'Why this role', 'I’m applying because …']],
    example: ['I’m a final-year computer science student, and for the last eight months I’ve worked part-time as a web developer at a small travel startup.',
      'There I rebuilt the booking page, which cut its load time from six seconds to under two, and I added a dashboard the sales team now opens every morning. Before that, I led a team of four at a college hackathon where we built an app for bus timings and came second out of 60 teams.',
      'I enjoy turning messy problems into simple tools, which is why this frontend role interests me: your product is used by thousands of small shops, and I’d like to help make it faster for them.']},
  {id: 'strengths', group: 'you', q: 'What are your strengths?', target: [30, 60],
    why: 'One strength that matters for this job, backed by a real example. A list of adjectives with no proof is easy to forget.',
    fields: [['strength', 'Your strength', 'My biggest strength is …'], ['proof', 'A moment that shows it', 'In my internship, …'], ['fit', 'How it helps in this job', 'In this role, …']],
    example: ['My biggest strength is that I learn new tools quickly and then teach them to others.',
      'In my internship, our team moved from spreadsheets to a SQL database, and nobody knew SQL well. I took a short course over two weekends, wrote a one-page guide to the ten queries we used most and ran two short sessions for the team. Within a month, our weekly report took one hour instead of four.',
      'In this analyst role, where the tools keep changing, I think that habit of learning fast and sharing it would help the whole team.']},
  {id: 'weakness', group: 'you', q: 'What is your greatest weakness?', target: [30, 60],
    why: 'Honesty and self-awareness: a real weakness that isn’t central to the job, and what you are doing about it.',
    fields: [['weakness', 'The weakness', 'I used to …'], ['example', 'When it showed up', 'During …'], ['fix', 'What you’re doing about it', 'Since then I …']],
    example: ['I used to find it hard to say no when people asked for help, so I sometimes took on more than I could finish well.',
      'During my final-year project, I agreed to help two other teams and ended up rushing my own report.',
      'Since then I keep a simple list of what I’ve committed to each week, and before I say yes to something new, I check it against that list. If I can’t take it on, I suggest when I could help instead. It has made me more reliable, and I still get to help people.']},
  {id: 'five-years', group: 'you', q: 'Where do you see yourself in five years?', target: [20, 45],
    why: 'Whether your plans fit what the job can offer, and whether you are likely to grow with the team rather than leave soon.',
    fields: [['skills', 'What you want to be good at', 'In five years I’d like to be …'], ['role', 'The responsibility you want', 'I’d also like to …'], ['link', 'Why this company fits that path', 'This role is a good start because …']],
    example: ['In five years I’d like to be the person the team trusts with its hardest backend problems, especially around speed and reliability.',
      'I’d also like to be mentoring newer engineers, the way seniors helped me in my internship.',
      'This role is a good start on that path: your systems handle a lot of traffic, and the job description mentions design reviews and on-call work, which are exactly the experiences I want to grow into.']},
  {id: 'challenge', group: 'stories', q: 'Tell me about a challenge you faced.', target: [45, 90], star: true,
    why: 'How you solve problems under pressure. Tell it as a story: the situation, your task, what you did and the result, with a number if you can.',
    fields: STAR('In my internship at …, …', 'I was asked to …', 'I …', 'As a result, …'),
    example: ['In my internship at a logistics company, our delivery-tracking page started timing out every evening when traffic peaked.',
      'I was asked to find the cause before the festive sale, which was two weeks away.',
      'I added logging to each step of the page, found that one database query was running once for every order on the screen, and rewrote it as a single query with an index. I tested it with a copy of a busy evening’s data and reviewed it with my mentor before release.',
      'After the change, the page loaded in under 1 second even at peak time, and there were no timeouts during the sale.']},
  {id: 'failure', group: 'stories', q: 'Tell me about a time you failed.', target: [40, 75], star: true,
    why: 'Whether you own your mistakes and learn from them. Pick a real failure, keep the blame on yourself, and spend most of the answer on what you changed.',
    fields: [['situation', 'What happened', 'In my second year, …'], ['part', 'Your part in it', 'I …'], ['next', 'What you did next', 'I owned up and …'], ['lesson', 'What you do differently now', 'Since then, I …']],
    example: ['In my second year, I offered to build the website for our college fest and promised it would be ready a month before the event.',
      'I underestimated the work and didn’t tell anyone I was behind, so registrations opened only a week before the fest and we lost early sign-ups.',
      'I owned up to the organising team, worked with two friends to finish the remaining pages in three days, and we still handled over 1,200 registrations.',
      'Since then, I break work into weekly goals and share progress early, even when it’s bad news, so people can plan around it.']},
  {id: 'conflict', group: 'stories', q: 'Tell me about a disagreement with a teammate.', target: [40, 75], star: true,
    why: 'How you handle conflict: that you listen, look for facts rather than winning, and keep the relationship working.',
    fields: STAR('During …, a teammate and I disagreed about …', 'We needed to …', 'I suggested …', 'In the end, …'),
    example: ['During a group project, a teammate wanted to build our app with a framework none of us knew, while I wanted one we were already comfortable with.',
      'We had six weeks, so we needed to decide quickly without the discussion turning into an argument.',
      'I suggested that we each build the same small screen in both frameworks in one evening and compare them. His choice turned out to be much better for the charts we needed, so I agreed, and I learned it first so I could help the others.',
      'We submitted 1 week early and got the top grade of the 12 teams in our batch, and he and I still work on side projects together.']},
  {id: 'leadership', group: 'stories', q: 'Tell me about a time you took the lead.', target: [30, 75], star: true,
    why: 'Initiative: that you can move a group towards a goal without being told how, even without a formal title.',
    fields: STAR('Our … had …', 'My goal was to …', 'I started …', 'Within …, …'),
    example: ['Our college coding club had stopped meeting regularly, and only a handful of members came to events.',
      'As the new coordinator, my goal was to get people practising every week again.',
      'I started short Saturday contests that opened with easy problems, paired beginners with seniors and posted the solutions the same evening. I also asked members what they wanted and added a monthly session on interview questions.',
      'Within a semester, regular attendance went from about 10 to over 45, and eight members cleared their first coding interviews.']},
  {id: 'deadline', group: 'stories', q: 'Describe a time you worked to a tight deadline.', target: [30, 75], star: true,
    why: 'How you plan and prioritise under time pressure, and whether you keep people informed along the way.',
    fields: STAR('A week before …, …', 'I had to …', 'I listed …, agreed …, and …', 'We finished …'),
    example: ['A week before a client demo during my internship, the client asked for a new export feature.',
      'My manager asked me to deliver it without delaying the demo.',
      'I listed what the feature truly needed, agreed with my manager to leave an extra filter for later, and blocked two hours each morning for focused work. I also shared a working version with our tester on day three instead of waiting until the end.',
      'The feature was ready 1 day early, the demo went smoothly, and the client approved the next phase of the project that week.']},
  {id: 'why-hire', group: 'job', q: 'Why should we hire you?', target: [30, 60],
    why: 'A short case that you fit: what the role needs most, proof that you have it, and one extra thing you bring.',
    fields: [['need', 'What the role needs most', 'From the job description, you need someone who …'], ['proof', 'Your proof', 'In my internship I …'], ['extra', 'What else you bring', 'On top of that, …']],
    example: ['From the job description, you need someone who can build reliable data pipelines and explain the numbers to people who aren’t technical.',
      'In my internship I built three daily pipelines in Python and SQL that replaced manual reports, and the finance team used them to close the month two days sooner. I also ran the weekly review where I walked managers through the dashboards.',
      'On top of that, I pick up new tools quickly, which I think matters with how fast your team is growing.']},
  {id: 'why-company', group: 'job', q: 'Why do you want to work here?', target: [20, 45],
    why: 'That you did your research and want this job, not just any job. Be specific about the company, the role and what you want to learn.',
    fields: [['company', 'What you know and like about the company', 'I’ve used your …, and …'], ['role', 'Why the role fits you', 'This role combines …'], ['goal', 'What you hope to learn or do', 'I’d like to …']],
    example: ['I’ve used your app to pay my college fees, and I liked how simple it was compared with the alternatives. Reading your engineering blog, I also liked how openly the team writes about its mistakes and fixes.',
      'This role combines the backend work I enjoy with a direct effect on millions of payments.',
      'I’d like to learn how to build systems that stay reliable at that scale.']},
  {id: 'why-leave', group: 'job', q: 'Why are you leaving your current job?', target: [20, 45],
    why: 'That you are moving towards something, not running away. Stay positive about your current employer and talk about what you want next.',
    fields: [['learned', 'What you gained in your current role', 'I’ve learned a lot in my current role, especially …'], ['reason', 'Why you want to move', 'I’m now looking for …'], ['next', 'How this role offers it', 'This team’s focus on …']],
    example: ['I’ve learned a lot in my current role, especially about supporting a product that thousands of customers use every day. Over two years I’ve gone from fixing bugs to owning the billing module.',
      'I’m now looking for a role where I can build new features from the design stage.',
      'This team’s focus on launching new products is exactly that.']},
  {id: 'salary', group: 'job', q: 'What are your salary expectations?', target: [15, 40],
    why: 'Whether your number fits their budget. Give a researched range for fixed pay, and stay open on the full package.',
    fields: [['research', 'What similar roles pay', 'I’ve looked at what similar roles pay …'], ['number', 'Your range', 'I’m looking for a fixed salary of ₹… to ₹… lakh a year.'], ['open', 'Your flexibility', 'I’m open to discussing …']],
    example: ['I’ve looked at what similar roles in Bengaluru pay, and at the experience I bring with the tools you use.',
      'Based on that, I’m looking for a fixed salary in the range of ₹12 to ₹14 lakh a year.',
      'I’m open to discussing the overall package, including any joining bonus and benefits, and I’d like to understand how reviews and raises work here.']},
  {id: 'notice', group: 'job', q: 'What is your notice period?', target: [10, 30],
    why: 'When you can join. Give the exact notice, your likely last day, and whether an early release or a buyout is possible.',
    fields: [['notice', 'Your notice period', 'My notice period is … days.'], ['last', 'Your likely last day', 'If I resign …, my last day would be …'], ['early', 'Can you join earlier?', 'I can ask for an early release …']],
    example: ['My notice period is 60 days.',
      'If I resign this week, my last working day would be in mid-January.',
      'People in my team have been released early once their work was handed over, so I can ask for that, and I’m also open to a buyout if you need me sooner.']},
  {id: 'your-questions', group: 'job', q: 'Do you have any questions for us?', target: [15, 45],
    why: 'Your interest and judgement. Always ask one to three questions about the work, the team or how people grow there.',
    fields: [['work', 'About the work', 'What would a great first three months look like …?'], ['team', 'About the team', 'How is the team …?'], ['growth', 'About growth', 'How do people here …?']],
    example: ['What would a great first three months look like for someone in this role?',
      'How does the team split its time between new features and maintenance?',
      'And how do people here get feedback and grow into senior roles?']},
];

export const questionById = id => QUESTIONS.find(q => q.id === id) || null;
const SHORT = {'about-yourself': 'About yourself', strengths: 'Strengths', weakness: 'Weakness', 'five-years': 'In five years', challenge: 'A challenge', failure: 'A failure',
  conflict: 'A disagreement', leadership: 'Taking the lead', deadline: 'A tight deadline', 'why-hire': 'Why hire you', 'why-company': 'Why this company',
  'why-leave': 'Why you’re leaving', salary: 'Salary', notice: 'Notice period', 'your-questions': 'Your questions'};
/** A short name for the question picker. */
export const shortName = question => SHORT[question.id] || question.q;
/** The example answer as one paragraph. */
export const exampleText = question => question.example.join(' ');
/** The example's parts, one per field, so it can be edited. */
export const exampleValues = question => Object.fromEntries(question.fields.map(([key], i) => [key, question.example[i] || '']).filter(([, value]) => value));

const words = text => String(text ?? '').trim().split(/\s+/).filter(Boolean);
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD);
const sentence = text => /[.!?…”"')\]]$/.test(text) ? text : text + '.';

/** The answer from its parts, as one paragraph. */
export const composeAnswer = (question, values = {}) => question.fields.map(([key]) => clean(values?.[key])).filter(Boolean).map(sentence).join(' ');

/** Seconds to say `text` aloud. */
export const spokenSeconds = text => Math.round(words(text).length / SPOKEN_WPM * 60);
export const secondsText = s => s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;

/** Checks on an answer: [level, text], where level is fix, tip or ok. */
export function answerChecks(question, values = {}) {
  const text = composeAnswer(question, values);
  if(!text) return [['tip', 'Fill in the parts above, or start from the example, to build your answer.']];
  const s = spokenSeconds(text), [lo, hi] = question.target, out = [];
  if(s > hi * 1.25) out.push(['fix', `Long: about ${secondsText(s)} spoken. Aim for ${lo} to ${hi} seconds; cut the background.`]);
  else if(s < lo * 0.6) out.push(['tip', `Short: about ${secondsText(s)} spoken. Aim for ${lo} to ${hi} seconds; add an example or a result.`]);
  const part = key => clean(values?.[key]);
  if(question.star) {
    if(part('result') && !/\d/.test(part('result'))) out.push(['tip', 'Add a number to the result: time saved, users, marks, money or a rank.']);
    const action = part('action'), we = (action.match(/\bwe\b/gi) || []).length, me = (action.match(/\bI\b/g) || []).length;
    if(we > me) out.push(['tip', 'Say what you did: use “I” for your part, not only “we”.']);
  }
  if(question.id === 'weakness' && /perfectionis/i.test(text)) out.push(['tip', '“Perfectionist” sounds rehearsed. Pick a real weakness you are working on.']);
  if(question.id === 'why-leave' && /\b(toxic|hate|boring|worst|bad manager|underpaid|politics)\b/i.test(text)) out.push(['fix', 'Keep it positive: talk about what you want next, not what you dislike now.']);
  if(question.id === 'salary' && !/\d/.test(text)) out.push(['tip', 'Give a number or a range, based on what similar roles pay.']);
  if(question.id === 'about-yourself' && /\b(born|hobbies|my father|my mother|my family)\b/i.test(text)) out.push(['tip', 'Keep it about work: skip family and hobbies unless they relate to the job.']);
  if(question.id === 'your-questions' && /\b(salary|leave|holidays|work from home)\b/i.test(text)) out.push(['tip', 'Save pay, leave and work-from-home questions for HR or the offer stage.']);
  if(!out.length) out.push(['ok', `Good length: about ${secondsText(s)} spoken.`]);
  return out;
}

export const checksList = checks => `<ul class="rb-check-list">${checks.map(([level, text]) => `<li class="is-${level}"><span>${level === 'fix' ? 'Fix' : level === 'tip' ? 'Tip' : 'Good'}</span>${e(text)}</li>`).join('')}</ul>`;

/** Saved answers, cleaned: {questionId: {field: text}} for known questions and fields only. */
export function cleanAnswers(raw) {
  const out = {};
  if(!raw || typeof raw !== 'object') return out;
  for(const question of QUESTIONS) {
    const saved = raw[question.id];
    if(!saved || typeof saved !== 'object') continue;
    const values = {};
    for(const [key] of question.fields) { const value = typeof saved[key] === 'string' ? saved[key].slice(0, MAX_FIELD) : ''; if(value.trim()) values[key] = value; }
    if(Object.keys(values).length) out[question.id] = values;
  }
  return out;
}

/** Every answered question as plain text, for copying or printing. */
export const answersText = answers => QUESTIONS.filter(q => composeAnswer(q, answers[q.id])).map(q => `${q.q}\n${composeAnswer(q, answers[q.id])}`).join('\n\n');

/** The form for one question. */
export function questionForm(question, values = {}) {
  const [lo, hi] = question.target;
  return `<div class="ia-head"><p class="eyebrow">${e(IA_GROUPS.find(([id]) => id === question.group)?.[1] || '')} · aim for ${lo} to ${hi} seconds</p><h2 id="ia-question" tabindex="-1">${e(question.q)}</h2><p>${e(question.why)}</p></div>
  ${question.fields.map(([key, label, placeholder]) => `<div class="calc-field"><label for="ia-${key}">${e(label)}</label><textarea id="ia-${key}" rows="3" maxlength="${MAX_FIELD}" data-ia-field="${key}" placeholder="${e(placeholder)}">${e(values?.[key] || '')}</textarea></div>`).join('')}
  <details class="ia-example"><summary>See an example answer</summary><p>${e(exampleText(question))}</p><button type="button" class="text-button" data-ia-use>Start from this example</button></details>`;
}
