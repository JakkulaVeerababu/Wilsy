import {escapeHtml as e} from './directory-core.js';
import {isDay, addDays, dayLabel} from './notice-core.js';
import {gratuity, spanText} from './gratuity-core.js';
import {rupees} from './take-home-core.js';

// Full and final settlement: what your employer owes you when you leave, before tax. Salary for the days not
// yet paid, unused leave paid out, gratuity once you qualify and anything else due, less pay for notice days
// not served and any other recoveries. Under section 17(2) of the Code on Wages, 2019 (in force since
// 21 November 2025), wages are due within two working days of leaving; under section 56(3) of the Code on
// Social Security, 2020, gratuity is due within 30 days of becoming payable.

export const MAX_PAY = 10000000;
export const PAY_BASES = [['month', 'Days in that month'], ['30', '30 days a month']];
export const LEAVE_BASES = [['basic-30', 'Basic + DA ÷ 30'], ['basic-26', 'Basic + DA ÷ 26'], ['gross-30', 'Gross pay ÷ 30']];

const money = value => Math.max(0, Math.min(Number(value) || 0, MAX_PAY));
const number = (value, max) => Math.max(0, Math.min(Number(value) || 0, max));

/** The day wages are due: two working days after the last working day, Monday to Friday (or Saturday too). */
export function wagesDue(last, {saturdays = false} = {}) {
  let day = last, left = 2;
  while(left > 0) {
    day = addDays(day, 1);
    const weekday = new Date(day + 'T00:00:00Z').getUTCDay();
    if(weekday !== 0 && (saturdays || weekday !== 6)) left -= 1;
  }
  return day;
}

/**
 * Everything the calculator shows; null without a last working day.
 * monthly: gross monthly pay. basic: monthly basic pay + DA. paidDays: days of salary still owed (blank: the
 * day of the month you leave). payBasis: 'month' (that month's days) or '30'. leaveDays and leaveBasis: unused
 * leave paid out, and how a day is valued. joined and fixedTerm: for gratuity. other: bonus and other dues.
 * shortDays and recoverOn: notice days not served, recovered at gross or basic pay ÷ 30. deductions: loans,
 * advances and other recoveries. saturdays: the office works on Saturdays.
 */
export function settlement({last, monthly = 0, basic = 0, paidDays = '', payBasis = 'month', leaveDays = 0, leaveBasis = 'basic-30', joined = '', fixedTerm = false,
  other = 0, shortDays = 0, recoverOn = 'gross', deductions = 0, saturdays = false} = {}) {
  if(!isDay(last)) return null;
  const gross = money(monthly), base = money(basic);
  const [y, m, d] = last.split('-').map(Number), monthDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const divisor = payBasis === '30' ? 30 : monthDays;
  const days = String(paidDays ?? '').trim() === '' ? d : number(paidDays, 31);
  const salary = Math.round(Math.min(gross, gross * days / divisor));
  const [leaveOn, leaveDiv] = (LEAVE_BASES.some(([id]) => id === leaveBasis) ? leaveBasis : 'basic-30').split('-');
  const leavePay = leaveOn === 'gross' ? gross : base, leave = number(leaveDays, 300);
  const encashment = Math.round(leavePay * leave / Number(leaveDiv));
  const service = isDay(joined) && joined <= last ? gratuity({wages: base, total: gross, joined, left: last, fixedTerm}) : null;
  const gratuityAmount = service?.eligible ? service.amount : 0;
  const dues = money(other), short = Math.round(number(shortDays, 365));
  const recovery = Math.round(short * (recoverOn === 'basic' ? base : gross) / 30);
  const taken = money(deductions);
  const total = salary + encashment + gratuityAmount + dues - recovery - taken;
  return {last, gross, base, days, divisor, monthDays, payBasis: payBasis === '30' ? '30' : 'month', salary, leave, leaveOn, leaveDiv: Number(leaveDiv), leavePay, encashment,
    service, gratuity: gratuityAmount, dues, short, recoverOn: recoverOn === 'basic' ? 'basic' : 'gross', recovery, deductions: taken, total,
    wagesBy: wagesDue(last, {saturdays}), gratuityBy: addDays(last, 30), saturdays: !!saturdays};
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const SHORT = new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
const short = day => SHORT.format(new Date(day + 'T00:00:00Z'));
const amount = n => n < 0 ? '−' + rupees(-n) : rupees(n);

/** Links onward: the relieving letter request, with the last day filled in. */
export const relievingLink = plan => '/career-letters?' + new URLSearchParams({letter: 'relieving', last: plan.last});

/** The result panel. */
export function settlementResult(plan) {
  if(!plan) return '<p class="match-empty">Enter your last working day and your monthly pay.</p>';
  const owe = plan.total < 0;
  const g = plan.service;
  const gratuityRow = !g
    ? ['Gratuity', 'Add the date you joined', '—']
    : g.eligible
      ? ['Gratuity', `${plural(g.years, 'year')} counted · ${rupees(g.base)} × 15 ÷ 26 × ${g.years}`, rupees(plan.gratuity)]
      : ['Gratuity', `Not yet: ${g.needs === 1 ? 'one year' : 'five years'} needed, you have ${spanText(g.span)}`, rupees(0)];
  const rows = [
    ['Salary still owed', `${plural(plan.days, 'day')} · ${rupees(plan.gross)} × ${plan.days} ÷ ${plan.divisor}`, rupees(plan.salary)],
    ['Leave encashment', plan.leave ? `${plural(plan.leave, 'day')} · ${rupees(plan.leavePay)} ÷ ${plan.leaveDiv} a day` : 'No unused leave entered', rupees(plan.encashment)],
    gratuityRow,
    ['Bonus and other dues', plan.dues ? 'As entered' : 'None entered', rupees(plan.dues)],
    ['Notice recovery', plan.short ? `${plural(plan.short, 'day')} not served · ${plan.recoverOn === 'basic' ? 'basic + DA' : 'gross pay'} ÷ 30 a day` : 'Notice served in full', plan.recovery ? '−' + rupees(plan.recovery) : rupees(0)],
    ['Other deductions', plan.deductions ? 'Loans, advances or assets' : 'None entered', plan.deductions ? '−' + rupees(plan.deductions) : rupees(0)],
  ];
  return `<div class="calc-headline ff-headline"><div><span>${owe ? 'You may owe your employer' : 'Estimated settlement, before tax'}</span><strong>${owe ? rupees(-plan.total) : rupees(plan.total)}</strong><small>For your last day, ${e(dayLabel(plan.last))}</small></div>
    <div><span>Wages due by</span><strong>${e(short(plan.wagesBy))}</strong><small>Two working days after you leave</small></div>
    <div><span>Gratuity due by</span><strong>${plan.gratuity ? e(short(plan.gratuityBy)) : 'Not due'}</strong><small>${plan.gratuity ? 'Within 30 days' : 'You don’t qualify yet'}</small></div></div>
  <table class="calc-table ff-table"><caption class="sr-only">How the settlement adds up</caption><tbody>${rows.map(([name, how, value]) => `<tr><th scope="row">${e(name)}<span>${e(how)}</span></th><td>${value}</td></tr>`).join('')}
    <tr class="calc-total"><th scope="row">${owe ? 'You may owe' : 'Total before tax'}</th><td>${amount(plan.total)}</td></tr></tbody></table>
  ${g?.raised && plan.gratuity ? '<p class="hike-note">Your basic pay and DA are under half of your gross pay, so gratuity uses half of your gross pay, as the labour codes require.</p>' : ''}
  <div class="notice-actions"><a class="secondary-button" href="${e(relievingLink(plan))}">Ask for your relieving letter</a><a class="secondary-button" href="/gratuity-calculator">Check your gratuity</a></div>`;
}
