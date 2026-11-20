import {escapeHtml as e} from './directory-core.js';
import {isDay, addDays} from './notice-core.js';

// Age for government job notices: your exact age on the notice's cut-off date, the birth dates that qualify
// and your upper age limit after relaxations.
//
// UPSC and SSC count the limits like this: on the cut-off date you must have reached the minimum age and must
// not yet have reached the maximum. For ages 18 to 27 on 1 August 2025, SSC printed "born not before
// 2 August 1998 and not later than 1 August 2007". Some state notices let you apply until the day before your
// next birthday instead; `rule: 'completed'` counts the limit that way.
//
// In central government jobs the upper limit goes up by 3 years for OBC (non-creamy layer), 5 for SC and ST,
// and 10 more for persons with benchmark disabilities (so 13 for OBC and 15 for SC and ST). EWS candidates
// get no age relaxation. Other relaxations (ex-servicemen, serving employees, state rules) come from each notice.

export const CATEGORIES = [['general', 'General (unreserved)', 0], ['ews', 'EWS', 0], ['obc', 'OBC (non-creamy layer)', 3], ['sc', 'SC', 5], ['st', 'ST', 5]];
export const PWBD_YEARS = 10;
export const MAX_OTHER_YEARS = 20;
/** Common age bands in notices, as quick fills. */
export const AGE_BANDS = [[18, 23], [18, 25], [18, 27], [18, 30], [18, 32], [21, 32]];

const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
const parts = day => day.split('-').map(Number);
const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The day you turn `n`: the same date n years on, or 1 March for a 29 February birthday in a non-leap year. */
export function birthday(day, n) {
  const [y, m, d] = parts(day), year = y + n;
  return m === 2 && d === 29 && !leap(year) ? ymd(year, 3, 1) : ymd(year, m, d);
}

/** The same date `n` years earlier; 29 February becomes 28 February in a non-leap year. */
export function yearsBefore(day, n) {
  const [y, m, d] = parts(day), year = y - n;
  return ymd(year, m, m === 2 && d === 29 && !leap(year) ? 28 : d);
}

// The same day of the month `n` months on, or the month's last day when it is shorter.
const monthsOn = (day, n) => {
  const [y, m, d] = parts(day), first = new Date(Date.UTC(y, m - 1 + n, 1));
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return ymd(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, length));
};

/** Completed years, months and days from `birth` to `on`; null when a date is missing or `on` comes first. */
export function exactAge(birth, on) {
  if(!isDay(birth) || !isDay(on) || on < birth) return null;
  let years = parts(on)[0] - parts(birth)[0];
  if(birthday(birth, years) > on) years -= 1;
  const anchor = birthday(birth, years);
  let months = 0;
  while(months < 11 && monthsOn(anchor, months + 1) <= on) months += 1;
  const days = Math.round((Date.parse(on + 'T00:00:00Z') - Date.parse(monthsOn(anchor, months) + 'T00:00:00Z')) / DAY);
  return {years, months, days};
}

const whole = (value, lo, hi) => {
  if(String(value ?? '').trim() === '') return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/**
 * Everything the calculator shows; null without both dates.
 * min, max: the notice's age limits (max may be blank). category: an id from CATEGORIES. pwbd: a person with a
 * benchmark disability. other: further relaxation in years from the notice. rule: 'reached' (UPSC, SSC: you must
 * not have reached the maximum) or 'completed' (you can be that age until your next birthday).
 */
export function agePlan({birth, on, min = 18, max = '', category = 'general', pwbd = false, other = 0, rule = 'reached'} = {}) {
  if(!isDay(birth) || !isDay(on)) return null;
  if(birth > on) return {birth, on, error: 'after'};
  const low = whole(min, 0, 100) ?? 0, high = whole(max, 1, 100);
  const cat = CATEGORIES.find(([id]) => id === category) || CATEGORIES[0];
  const extra = whole(other, 0, MAX_OTHER_YEARS) ?? 0;
  const relax = [];
  if(cat[2]) relax.push([cat[0].toUpperCase(), cat[2]]);
  if(pwbd) relax.push(['PwBD', PWBD_YEARS]);
  if(extra) relax.push(['other', extra]);
  const relaxYears = relax.reduce((sum, [, n]) => sum + n, 0);
  const completed = rule === 'completed';
  const badLimits = high != null && high < low;
  const upper = high == null || badLimits ? null : high + relaxYears;
  // The age at which you are out: the maximum itself, or the year after it when you can be that age.
  const outAt = upper == null ? null : upper + (completed ? 1 : 0);
  const latest = yearsBefore(on, low), earliest = outAt == null ? null : addDays(yearsBefore(on, outAt), 1);
  const tooYoung = birth > latest, tooOld = earliest != null && birth < earliest;
  return {birth, on, age: exactAge(birth, on), min: low, max: badLimits ? null : high, badLimits, category: cat[0], categoryName: cat[1],
    relax, relaxYears, upper, outAt, rule: completed ? 'completed' : 'reached', latest, earliest, tooYoung, tooOld, eligible: !tooYoung && !tooOld,
    reachesMin: birthday(birth, low), crossed: outAt == null ? null : birthday(birth, outAt),
    // The last cut-off date on which you are still under the limit, for notices still to come.
    lastCutoff: outAt == null ? null : addDays(birthday(birth, outAt), -1)};
}

/** The upper limit for each category, for a notice's maximum age. */
export function limitsTable(max) {
  const high = whole(max, 1, 100);
  if(high == null) return [];
  return [['General and EWS', high], ['OBC (non-creamy layer)', high + 3], ['SC and ST', high + 5], ['PwBD: general and EWS', high + PWBD_YEARS], ['PwBD: OBC', high + 3 + PWBD_YEARS], ['PwBD: SC and ST', high + 5 + PWBD_YEARS]];
}

const LABEL = new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const LONG = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
const SHORT = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const at = day => new Date(day + 'T00:00:00Z');
export const ageDayLabel = day => isDay(day) ? LABEL.format(at(day)) : '';
const longLabel = day => LONG.format(at(day));
const shortLabel = day => SHORT.format(at(day));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "27 + 3 (OBC) + 10 (PwBD)". */
export const limitText = plan => plan.relax.length ? `${plan.max} + ${plan.relax.map(([name, n]) => `${n} (${name})`).join(' + ')}` : 'No relaxation';

/** The result panel. */
export function ageResult(plan) {
  if(!plan) return '<p class="match-empty">Enter your date of birth and the cut-off date from the notice.</p>';
  if(plan.error === 'after') return '<p class="match-empty">Your date of birth is after the cut-off date. Check both dates.</p>';
  const {age} = plan;
  const rest = [age.months ? plural(age.months, 'month') : '', age.days ? plural(age.days, 'day') : ''].filter(Boolean).join(', ');
  const second = plan.upper == null
    ? `<div><span>Minimum age</span><strong>${plural(plan.min, 'year')}</strong><small>${plan.badLimits ? 'The maximum is below the minimum' : 'Add the maximum to check the upper limit'}</small></div>`
    : `<div><span>Your upper age limit</span><strong>${plural(plan.upper, 'year')}</strong><small>${e(limitText(plan))}</small></div>`;
  const third = plan.upper == null
    ? `<div><span>Your relaxation</span><strong>${plan.relaxYears ? '+' + plural(plan.relaxYears, 'year') : 'None'}</strong><small>Added to the notice’s maximum</small></div>`
    : `<div><span>Last cut-off you meet</span><strong>${e(shortLabel(plan.lastCutoff))}</strong><small>With the same age limits</small></div>`;
  const window = plan.earliest
    ? `born from ${e(longLabel(plan.earliest))} to ${e(longLabel(plan.latest))}, both days included`
    : `born on or before ${e(longLabel(plan.latest))}`;
  let status;
  if(plan.tooYoung) status = `<p class="age-status is-no">Too young on this cut-off date: you turn ${plan.min} on ${e(ageDayLabel(plan.reachesMin))}. The notice needs birth dates on or before ${e(longLabel(plan.latest))}.</p>`;
  else if(plan.tooOld) status = `<p class="age-status is-no">Over the limit: you ${plan.rule === 'completed' ? 'turned' : 'reached'} ${plan.outAt} on ${e(ageDayLabel(plan.crossed))}, on or before the cut-off date. To qualify you need to be ${window}.</p>`;
  else status = `<p class="age-status is-yes">${plan.upper == null ? 'You meet the minimum age' : 'You meet the age limit'}. The notice’s birth dates for you: ${window}.</p>`;
  const table = plan.max == null ? '' : `<table class="calc-table age-table"><caption class="sr-only">Upper age limit by category</caption><tbody>${limitsTable(plan.max).map(([name, n]) => `<tr><th scope="row">${e(name)}</th><td>${plural(n, 'year')}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="calc-headline age-headline"><div><span>Age on ${e(ageDayLabel(plan.on))}</span><strong>${plural(age.years, 'year')}</strong><small>${rest ? 'and ' + e(rest) : 'Exactly, to the day'}</small></div>${second}${third}</div>
  ${status}${table}
  <div class="notice-actions"><a class="secondary-button" href="/government-jobs">Open government jobs</a><a class="secondary-button" href="/deadlines?type=government">See last dates</a><a class="secondary-button" href="/typing-test">Practise typing</a></div>`;
}
