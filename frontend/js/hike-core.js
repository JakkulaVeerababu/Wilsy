import {takeHome, rupees} from './take-home-core.js';
import {escapeHtml as e} from './directory-core.js';

// Salary hike calculator: what a raise (a hike percentage or a new CTC) means for monthly in-hand pay,
// with the same estimate as the in-hand calculator (new regime, basic at 50% of fixed pay, PF on basic).

export const HIKE_STEPS = [10, 15, 20, 30, 50];
export const MAX_CTC = 100000000;
const money = value => Math.min(MAX_CTC, Math.max(0, Math.round(Number(value) || 0)));
/** "₹14.4 lakh a year" under an amount field. */
export function inWords(n, per = 'a year') {
  n = Number(n) || 0;
  if(!n) return '';
  if(n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} crore ${per}`;
  if(n >= 1e5) return `₹${+(n / 1e5).toFixed(2)} lakh ${per}`;
  return `₹${n.toLocaleString('en-IN')} ${per}`;
}

/** Before and after: from a hike percentage, or from a new CTC when one is given. */
export function hikeResult({current, hike = 0, offer = null, pf = 'basic', professionalTax = 2400} = {}) {
  const now = money(current);
  const next = offer != null && String(offer).trim() !== '' ? money(offer) : money(now * (1 + (Number(hike) || 0) / 100));
  const before = takeHome({ctc: now, pf, professionalTax}), after = takeHome({ctc: next, pf, professionalTax});
  const extra = next - now;
  return {current: now, next, hike: now ? extra / now * 100 : null, before, after,
    monthlyRise: after.monthly - before.monthly, yearlyRise: after.annual - before.annual, taxRise: after.tax - before.tax,
    inHandHike: before.monthly ? (after.monthly - before.monthly) / before.monthly * 100 : null,
    // Of each extra ₹100 of CTC, how much reaches the bank account.
    kept: extra > 0 ? Math.round((after.annual - before.annual) / extra * 100) : null};
}

/** The CTC (and hike) needed for a monthly in-hand target; null when out of range. */
export function hikeFor(current, targetMonthly, {pf = 'basic', professionalTax = 2400} = {}) {
  const target = Number(targetMonthly) || 0, now = money(current);
  if(target <= 0 || takeHome({ctc: MAX_CTC, pf, professionalTax}).monthly < target) return null;
  let low = 0, high = MAX_CTC;
  while(high - low > 100) { const mid = Math.floor((low + high) / 2); if(takeHome({ctc: mid, pf, professionalTax}).monthly >= target) high = mid; else low = mid; }
  const ctc = Math.ceil(high / 1000) * 1000;
  return {ctc, hike: now ? (ctc - now) / now * 100 : null};
}

const pct = value => value == null ? '—' : `${value >= 0 ? '' : '−'}${Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`;
const change = value => value === 0 ? '₹0' : `${value > 0 ? '+' : '−'}${rupees(Math.abs(value))}`;

/** The before/after table and the headline under it. */
export function hikeTable(r) {
  const rows = [
    ['CTC per year', r.current, r.next], ['In hand each month', r.before.monthly, r.after.monthly], ['In hand per year', r.before.annual, r.after.annual],
    ['Income tax per year', r.before.tax, r.after.tax], ['Your PF per year', r.before.employeePf, r.after.employeePf],
  ];
  const note = r.kept != null && r.next > r.current
    ? `Of every extra ₹100 of CTC, about ₹${r.kept} reaches your bank account; the rest goes to tax, PF and gratuity.` : '';
  return `<div class="calc-headline hike-headline"><div><span>In hand each month</span><strong>${change(r.monthlyRise)}</strong><small>${rupees(r.before.monthly)} → ${rupees(r.after.monthly)}</small></div>
    <div><span>CTC hike</span><strong>${pct(r.hike)}</strong><small>${rupees(r.current)} → ${rupees(r.next)}</small></div>
    <div><span>In-hand hike</span><strong>${pct(r.inHandHike)}</strong><small>Monthly, after tax and PF</small></div></div>
  <table class="calc-table hike-table"><caption class="sr-only">Pay before and after the hike</caption><thead><tr><th scope="col"><span class="sr-only">Amount</span></th><th scope="col">Now</th><th scope="col">After the hike</th><th scope="col">Change</th></tr></thead>
    <tbody>${rows.map(([label, a, b]) => `<tr><th scope="row">${e(label)}</th><td>${rupees(a)}</td><td>${rupees(b)}</td><td>${change(b - a)}</td></tr>`).join('')}</tbody></table>
  ${note ? `<p class="hike-note">${e(note)}</p>` : ''}`;
}
