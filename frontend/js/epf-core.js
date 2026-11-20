import {escapeHtml as e} from './directory-core.js';
import {rupees} from './take-home-core.js';

// EPF balance at retirement, for the EPF calculator.
// - Interest: 8.25% a year for 2025-26 (set by EPFO's trustees in March 2026 and ratified in June 2026). EPFO works
//   it out on the monthly running balance and credits it once a year, so a month's contribution earns interest from
//   the next month: a year's interest is rate ÷ 12 × (12 × opening balance + 66 × the monthly contribution).
// - Contributions: you pay 12% of basic pay + DA and so does your employer, but 8.33% of wages up to the wage
//   ceiling goes from the employer's share to the pension scheme (EPS), not to your EPF balance.
// - Wage ceiling: ₹25,000 a month from 17 September 2026 (it was ₹15,000). Employers pay PF on the full basic pay
//   + DA or only on the ceiling.
// - Members who joined after 1 September 2014 with wages above the ceiling at the time aren't in EPS: the whole
//   employer share goes to EPF.
// - Tax: interest on your own contributions above ₹2.5 lakh a year is taxable.

export const EPF_RATE = 8.25;
export const RATE_YEAR = '2025-26';
export const WAGE_CEILING = 25000;
export const CEILING_SINCE = '17 September 2026';
export const RETIREMENT_AGE = 58;
export const TAX_FREE_LIMIT = 250000;

const num = (value, lo, hi) => {
  if(String(value ?? '').trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/** The employer's EPS share: 8.33% of wages up to the ceiling, to the nearest rupee. */
export const epsShare = wage => Math.round(Math.min(Math.max(0, wage), WAGE_CEILING) * 833 / 10000);

/**
 * The projection, year by year. age, retire: whole years. wage: basic pay + DA a month now. rise: yearly pay rise
 * in percent. balance: EPF balance now. pfOn: 'full' (PF on the whole basic pay + DA) or 'ceiling' (on at most
 * ₹25,000). eps: a member of the pension scheme. vpf: voluntary PF in percent of basic pay + DA.
 */
export function epfPlan({age, retire = RETIREMENT_AGE, wage, rise = 5, balance = 0, rate = EPF_RATE, pfOn = 'full', eps = true, vpf = 0} = {}) {
  const now = num(age, 15, 75), end = num(retire, 18, 75), pay = num(wage, 0, 10000000);
  if(now == null || !pay) return null;
  if(end == null || Math.round(end) <= Math.round(now)) return {error: 'retire'};
  const from = Math.round(now), years = Math.round(end) - from;
  const growth = (num(rise, 0, 30) ?? 0) / 100, yearly = (num(rate, 0, 20) ?? EPF_RATE) / 100, voluntary = (num(vpf, 0, 88) ?? 0) / 100;
  const capped = pfOn === 'ceiling', opening = Math.round(num(balance, 0, 1e9) ?? 0);
  let total = opening, mine = 0, theirs = 0, interest = 0, pension = 0, first = null;
  const rows = [];
  for(let y = 0; y < years; y++) {
    const monthly = Math.round(pay * (1 + growth) ** y), pfWage = capped ? Math.min(monthly, WAGE_CEILING) : monthly;
    const own = Math.round(pfWage * .12), extra = Math.round(monthly * voluntary), employer = Math.round(pfWage * .12);
    const toEps = eps ? Math.min(employer, epsShare(pfWage)) : 0, toEpf = employer - toEps, month = own + extra + toEpf;
    const earned = Math.round((12 * total + 66 * month) * yearly / 12);
    total += 12 * month + earned;
    mine += 12 * (own + extra); theirs += 12 * toEpf; interest += earned; pension += 12 * toEps;
    first ||= {wage: monthly, pfWage, own, extra, employer, toEps, toEpf};
    rows.push({age: from + y + 1, wage: monthly, total});
  }
  return {age: from, retire: from + years, years, opening, total, mine, theirs, interest, pension, first, rows, rate: Math.round(yearly * 10000) / 100,
    eps: !!eps, pfOn: capped ? 'ceiling' : 'full', taxable: 12 * (first.own + first.extra) > TAX_FREE_LIMIT};
}

/** "₹1.23 crore" or "₹45.6 lakh". */
export const bigWords = n => n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)} crore` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} lakh` : rupees(n);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The result panel. */
export function epfResult(p) {
  if(!p) return '<p class="match-empty">Enter your age and your basic pay + DA a month.</p>';
  if(p.error === 'retire') return '<p class="match-empty">The retirement age has to be after your age now.</p>';
  const f = p.first;
  const shown = p.rows.filter((row, i) => (i + 1) % 5 === 0 || i === p.rows.length - 1);
  const yours = f.extra ? `${rupees(f.own)} + ${rupees(f.extra)} VPF` : rupees(f.own);
  return `<div class="calc-headline epf-headline"><div><span>Your EPF at ${p.retire}</span><strong>${rupees(p.total)}</strong><small>${e(bigWords(p.total))} after ${plural(p.years, 'year')}, at ${p.rate}% a year</small></div>
    <div><span>You put in</span><strong>${rupees(p.mine)}</strong><small>12% of PF wages${f.extra ? ' + VPF' : ''}</small></div>
    <div><span>Your employer puts in</span><strong>${rupees(p.theirs)}</strong><small>${p.eps ? 'After the pension (EPS) share' : 'All of its 12%'}</small></div></div>
  <p class="hike-note">This month you pay ${yours} and your employer pays ${rupees(f.employer)}: ${rupees(f.toEpf)} to EPF${f.toEps ? ` and ${rupees(f.toEps)} to the pension scheme` : ''}. Interest adds ${rupees(p.interest)} by ${p.retire}${p.opening ? `, on top of the ${rupees(p.opening)} you have now` : ''}.</p>
  <table class="calc-table epf-table"><caption class="sr-only">EPF balance by age</caption><thead><tr><th scope="col">At age</th><th scope="col">Basic + DA a month</th><th scope="col">EPF balance</th></tr></thead>
    <tbody>${shown.map(row => `<tr><th scope="row">${row.age}</th><td>${rupees(row.wage)}</td><td>${rupees(row.total)}</td></tr>`).join('')}</tbody></table>
  ${p.pension ? `<p class="hike-note">The ${rupees(f.toEps)} a month for the pension scheme (EPS) isn’t in this balance. After 10 years of service, EPS pays a monthly pension from 58.</p>` : ''}
  ${p.taxable ? '<p class="hike-note">You put in more than ₹2.5 lakh a year, so the interest on the part above that is taxable.</p>' : ''}
  <div class="notice-actions"><a class="secondary-button" href="/salary-calculator">Work out your in-hand pay</a><a class="secondary-button" href="/gratuity-calculator">Check your gratuity</a></div>`;
}
