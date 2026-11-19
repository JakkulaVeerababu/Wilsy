import {escapeHtml as e} from './directory-core.js';

// Notice period: the last working day, an early release and what buying out the rest costs.
// Employment contracts set the rules; this follows the usual practice in India. The notice runs from the
// day you resign (day 1); a notice of months ends the day before the same date that many months later
// (15 Jan + 1 month: 14 Feb), or at the end of a shorter month (31 Jan + 1 month: 28 Feb); and a day's
// pay is the monthly pay ÷ 30.

export const NOTICE_MAX_DAYS = 365;
export const NOTICE_MAX_MONTHS = 12;
export const NOTICE_PRESETS = [[30, 'days'], [60, 'days'], [90, 'days'], [1, 'months'], [2, 'months'], [3, 'months']];
const DAY = 864e5;
export const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const time = day => Date.parse(day + 'T00:00:00Z');
const toDay = ms => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day, n) => toDay(time(day) + n * DAY);
export const daysBetween = (from, to) => Math.round((time(to) - time(from)) / DAY);

/** The day before the same date `n` months on, or the last day of that month when it is shorter. */
export function monthsLater(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  if(d === 1) return addDays(toDay(Date.UTC(y, m - 1 + n, 1)), -1);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toDay(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d - 1, length)));
}

/** The last working day for a notice of `amount` days or months from the resignation date; '' if unusable. */
export function lastWorkingDay({resigned, amount, unit = 'days'}) {
  const n = Math.round(Number(amount));
  if(!isDay(resigned) || !(n > 0)) return '';
  if(unit === 'months') return n > NOTICE_MAX_MONTHS ? '' : monthsLater(resigned, n);
  return n > NOTICE_MAX_DAYS ? '' : addDays(resigned, n - 1);
}

/**
 * Everything the calculator shows; null without a resignation date and a notice period.
 * waived: days the manager waives or leave adjusted against the notice. joining: the new job's first day.
 * monthly: the pay a buyout is charged on (often basic pay; the contract says which).
 */
export function noticePlan({resigned, amount, unit = 'days', waived = 0, joining = '', monthly = 0}) {
  const last = lastWorkingDay({resigned, amount, unit});
  if(!last) return null;
  const length = daysBetween(resigned, last) + 1;
  const off = Math.max(0, Math.min(Math.round(Number(waived) || 0), length - 1));
  const end = addDays(last, -off);
  const nextDayRule = addDays(lastWorkingDay({resigned: addDays(resigned, 1), amount, unit}), -off);
  const perDay = Math.max(0, Math.min(Number(monthly) || 0, 1e8)) / 30;
  let release = null;
  if(isDay(joining)) {
    const wanted = addDays(joining, -1);
    if(daysBetween(resigned, wanted) < 0) release = {joining, wanted, early: true};
    else {
      const short = Math.max(0, daysBetween(wanted, end));
      release = {joining, wanted, short, cost: Math.round(short * perDay)};
    }
  }
  const n = Math.round(Number(amount));
  const notice = unit === 'months' ? `${n} month${n === 1 ? '' : 's'}` : `${n} day${n === 1 ? '' : 's'}`;
  return {resigned, last, length, notice, waived: off, end, served: length - off, nextDayRule, perDay: Math.round(perDay), release};
}

const DATE = new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const SHORT = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});
export const dayLabel = day => isDay(day) ? DATE.format(new Date(time(day))) : '';
const shortLabel = day => SHORT.format(new Date(time(day)));
const rupees = n => '₹' + Math.round(n).toLocaleString('en-IN');
const days = n => `${n} day${n === 1 ? '' : 's'}`;

/** Links to the letters tool, carrying the dates over. */
export function letterLink(letter, plan) {
  const p = new URLSearchParams({letter, last: plan.end, notice: plan.notice});
  if(plan.release?.joining) p.set('join', plan.release.joining);
  return '/career-letters?' + p;
}

/** The result panel. `today` (yyyy-mm-dd) adds how far away the last day is. */
export function noticeResult(plan, {today = ''} = {}) {
  if(!plan) return `<p class="match-empty">Enter the date you resign and a notice period of up to ${NOTICE_MAX_DAYS} days or ${NOTICE_MAX_MONTHS} months.</p>`;
  const away = isDay(today) ? daysBetween(today, plan.end) : null;
  const when = away == null ? '' : away > 1 ? `${away} days from today` : away === 1 ? 'Tomorrow' : away === 0 ? 'Today' : 'Already passed';
  const r = plan.release;
  let release = '';
  if(r?.early) release = `<p class="notice-release is-warn">That joining date is on or before the day you resign. Check the dates.</p>`;
  else if(r && r.short === 0) release = `<p class="notice-release is-ok">You can join on ${e(dayLabel(r.joining))}: your notice ends before it, so no early release is needed.</p>`;
  else if(r) release = `<p class="notice-release">To join on ${e(dayLabel(r.joining))}, you need to be released <strong>${days(r.short)} early</strong> (last day ${e(dayLabel(r.wanted))}).${plan.perDay ? ` Buying out ${days(r.short)} at ${rupees(plan.perDay)} a day costs about <strong>${rupees(r.cost)}</strong>.` : ' Add your monthly pay to see what a buyout costs.'}</p>`;
  return `<div class="calc-headline notice-headline"><div><span>Last working day</span><strong>${e(dayLabel(plan.end))}</strong><small>${when ? e(when) + ' · ' : ''}Notice from ${e(shortLabel(plan.resigned))}</small></div>
    <div><span>Notice period</span><strong>${days(plan.length)}</strong><small>${plan.waived ? `${days(plan.waived)} waived, ${days(plan.served)} to serve` : 'Counting the day you resign'}</small></div>
    <div><span>If counted from the next day</span><strong>${e(shortLabel(plan.nextDayRule))}</strong><small>Some companies start the next day</small></div></div>
  ${release}
  <div class="notice-actions"><a class="secondary-button" href="${e(letterLink('resignation', plan))}">Write your resignation letter</a>${r && r.short > 0 ? `<a class="secondary-button" href="${e(letterLink('early-release', plan))}">Ask to be released early</a>` : ''}</div>`;
}
