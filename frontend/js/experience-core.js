import {escapeHtml as e} from './directory-core.js';
import {isDay, addDays, daysBetween} from './notice-core.js';
import {exactAge} from './age-core.js';

// Total work experience for the experience calculator. Both the first and the last day of a job count. Jobs that
// overlap are counted once, so a side project during a full-time job doesn't add time. Years, months and days are
// added up per stretch of work, with 30 days making a month. Experience counts up to an "as on" date, such as the
// closing date of a notice that asks for experience on that date.

export const MAX_JOBS = 12;
export const MIN_GAP_DAYS = 30;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** {years, months, days} from the first to the last day, both included. */
export const spanOf = (from, to) => exactAge(from, addDays(to, 1));
/** "3 years, 5 months": the parts that aren't zero. */
export function spanWords(span) {
  if(!span) return '';
  const parts = [[span.years, 'year'], [span.months, 'month'], [span.days, 'day']].filter(([n]) => n);
  return (parts.length ? parts : [[0, 'day']]).map(([n, word]) => plural(n, word)).join(', ');
}
const add = (a, b) => {
  let days = a.days + b.days, months = a.months + b.months + Math.floor(days / 30), years = a.years + b.years;
  days %= 30; years += Math.floor(months / 12); months %= 12;
  return {years, months, days};
};

/** jobs: [{name, from, to, current}]. asOn: count up to this day. */
export function experience(jobs = [], {asOn} = {}) {
  if(!isDay(asOn)) return null;
  const counted = [], problems = [];
  jobs.forEach((job, i) => {
    const name = String(job.name || '').trim().slice(0, 80) || `Job ${i + 1}`;
    const from = job.from, to = job.current ? asOn : job.to;
    // A blank row is skipped; a row with only a company name gets a nudge to add its dates.
    if(!job.from && !job.to && !job.current && !String(job.name || '').trim()) return;
    if(!isDay(from) || !isDay(to)) problems.push([name, 'Add both dates, or tick “I work here now”.']);
    else if(to < from) problems.push([name, 'The end date is before the start date.']);
    else if(from > asOn) problems.push([name, 'It starts after the “as on” date, so it isn’t counted.']);
    else counted.push({i, name, from, to: to > asOn ? asOn : to});
  });
  if(!counted.length) return {asOn, jobs: [], problems, total: null};
  for(const job of counted) job.span = spanOf(job.from, job.to);
  // Merge jobs that overlap or follow on the next day into stretches of work.
  const stretches = [];
  for(const job of [...counted].sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0)) {
    const last = stretches[stretches.length - 1];
    if(last && job.from <= addDays(last.to, 1)) {
      if(job.from <= last.to) last.overlap = true;
      if(job.to > last.to) last.to = job.to;
    } else stretches.push({from: job.from, to: job.to, overlap: false});
  }
  const total = stretches.reduce((sum, s) => add(sum, spanOf(s.from, s.to)), {years: 0, months: 0, days: 0});
  const gaps = [];
  for(let k = 1; k < stretches.length; k++) {
    const from = addDays(stretches[k - 1].to, 1), to = addDays(stretches[k].from, -1);
    if(daysBetween(from, stretches[k].from) >= MIN_GAP_DAYS) gaps.push({from, to, span: spanOf(from, to)});
  }
  const end = stretches[stretches.length - 1].to;
  const since = end < asOn && daysBetween(end, asOn) >= MIN_GAP_DAYS ? {from: addDays(end, 1), to: asOn, span: spanOf(addDays(end, 1), asOn)} : null;
  return {asOn, jobs: counted, problems, total, years: Math.round((total.years + total.months / 12 + total.days / 365) * 10) / 10,
    months: total.years * 12 + total.months, overlaps: stretches.some(s => s.overlap), gaps, since};
}

/** One job in the form; n keeps the ids unique when jobs are added and removed. */
export function jobRow(n, job = {}) {
  return `<fieldset class="xp-job" data-xp-job><legend>Job ${n + 1}</legend>
    <div class="calc-field"><label for="xp-company-${n}">Company or role (optional)</label><input id="xp-company-${n}" name="company" type="text" maxlength="80" value="${e(job.name || '')}"></div>
    <div class="ff-pair"><div class="calc-field"><label for="xp-from-${n}">From</label><input id="xp-from-${n}" name="from" type="date" value="${e(job.from || '')}"></div>
      <div class="calc-field"><label for="xp-to-${n}">To</label><input id="xp-to-${n}" name="to" type="date" value="${e(job.to || '')}"${job.current ? ' disabled' : ''}></div></div>
    <div class="xp-row"><label class="calc-check"><input type="checkbox" name="current"${job.current ? ' checked' : ''}> I work here now</label><button class="text-button" type="button" data-xp-remove>Remove</button></div>
  </fieldset>`;
}

/** "Total experience: 3 years, 5 months (3.4 years)", for pasting into a form. */
export const experienceText = r => r?.total ? `Total experience: ${spanWords(r.total)} (${r.years} years), as on ${dayText(r.asOn)}` : '';

const DAY = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const dayText = day => isDay(day) ? DAY.format(new Date(day + 'T00:00:00Z')) : '';

// Keep each number with its unit ("3&nbsp;months") so a long total only wraps after a comma.
const keep = span => e(spanWords(span)).replace(/(\d) /g, '$1&nbsp;');

/** The result panel. */
export function experienceResult(r) {
  if(!r) return '<p class="match-empty">Choose the date to count up to.</p>';
  const problems = r.problems.length ? `<ul class="xp-problems">${r.problems.map(([name, why]) => `<li><strong>${e(name)}:</strong> ${e(why)}</li>`).join('')}</ul>` : '';
  if(!r.total) return `<p class="match-empty">Add a job with its start date to count your experience.</p>${problems}`;
  const gapDays = r.gaps.reduce((sum, g) => add(sum, g.span), {years: 0, months: 0, days: 0});
  const rows = r.jobs.map(job => `<tr><th scope="row">${e(job.name)}<span>${e(dayText(job.from))} to ${e(dayText(job.to))}</span></th><td>${keep(job.span)}</td></tr>`).join('');
  const gapList = [...r.gaps.map(g => [g, 'Gap']), ...(r.since ? [[r.since, 'Since your last job']] : [])];
  return `<div class="calc-headline xp-headline"><div><span>Total experience as on ${e(dayText(r.asOn))}</span><strong>${keep(r.total)}</strong><small>${r.years} years · ${plural(r.months, 'month')}</small></div>
    <div><span>Jobs counted</span><strong>${r.jobs.length}</strong><small>${r.overlaps ? 'Overlapping time counted once' : 'No overlaps'}</small></div>
    <div><span>Gaps of a month or more</span><strong>${r.gaps.length}</strong><small>${r.gaps.length ? keep(gapDays) + ' in all' : 'Between your jobs'}</small></div></div>
  <table class="calc-table ff-table xp-table"><caption class="sr-only">Experience by job</caption><tbody>${rows}
    <tr class="calc-total"><th scope="row">Total</th><td>${keep(r.total)}</td></tr></tbody></table>
  ${gapList.length ? `<ul class="xp-gaps">${gapList.map(([g, label]) => `<li><strong>${label}:</strong> ${e(dayText(g.from))} to ${e(dayText(g.to))}, ${keep(g.span)}</li>`).join('')}</ul>
  <p class="hike-note">Interviewers often ask about gaps. A short, honest reason (study, an exam, family or health) and what you did in that time is enough.</p>` : ''}
  ${problems}
  <div class="notice-actions"><button class="primary-button" type="button" data-xp-copy>Copy for a form</button><a class="secondary-button" href="/resume-builder">Add it to your resume</a><a class="secondary-button" href="/interview-answers">Prepare your answers</a></div>
  <p class="offer-status" data-xp-status role="status" aria-live="polite"></p>`;
}
