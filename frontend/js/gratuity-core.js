import {rupees} from './take-home-core.js';
import {escapeHtml as e} from './directory-core.js';

// Gratuity: 15 days' wages for every completed year of service, where a last part-year of more than six
// months counts as a full year. A month's wages count as 26 working days, so the amount is
// monthly wages × 15 ÷ 26 × years. The amount the law requires is capped at ₹20 lakh, which is also the
// tax-free limit for private-sector employees. Permanent employees qualify after five years; under the
// Code on Social Security, 2020, fixed-term employees qualify after one.

export const GRATUITY_CAP = 2000000;
export const TAX_FREE_LIMIT = 2000000;
const DAY = 864e5;
const parse = value => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };

/** Completed years, months and days from the joining date to the last working day (counted inclusive). */
export function serviceSpan(from, to) {
  const start = parse(from), end = parse(to);
  if(!start || !end || end < start) return null;
  const last = new Date(end.getTime() + DAY); // the last working day counts as worked
  let years = last.getUTCFullYear() - start.getUTCFullYear(), months = last.getUTCMonth() - start.getUTCMonth(), days = last.getUTCDate() - start.getUTCDate();
  if(days < 0) { months -= 1; days += new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 0)).getUTCDate(); }
  if(months < 0) { years -= 1; months += 12; }
  return {years, months, days};
}

/** Years that count: completed years, plus one when the part-year left over is more than six months. */
export const countedYears = span => span ? span.years + (span.months > 6 || (span.months === 6 && span.days > 0) ? 1 : 0) : 0;

/**
 * wages: monthly basic pay + dearness allowance. total (optional): all monthly pay; under the labour
 * codes, when basic + DA is less than half of it, gratuity is worked out on half of it instead.
 */
export function gratuity({wages, total = 0, joined, left, fixedTerm = false} = {}) {
  const span = serviceSpan(joined, left), basic = Math.max(0, Number(wages) || 0), all = Math.max(0, Number(total) || 0);
  const base = Math.max(basic, all / 2), years = countedYears(span), needs = fixedTerm ? 1 : 5;
  const eligible = !!span && span.years >= needs;
  const raw = base * 15 / 26 * years, amount = Math.min(raw, GRATUITY_CAP);
  return {span, years, base: Math.round(base), raised: base > basic, needs, eligible, raw: Math.round(raw), amount: Math.round(amount), capped: raw > GRATUITY_CAP,
    taxFree: Math.round(Math.min(amount, TAX_FREE_LIMIT))};
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const spanText = span => span ? [plural(span.years, 'year'), plural(span.months, 'month'), plural(span.days, 'day')].join(', ') : '';

/** The result panel. */
export function gratuityResult(r) {
  if(!r.span) return '<p class="match-empty">Enter the date you joined and your last working day.</p>';
  const status = r.eligible
    ? `<p class="gratuity-status is-yes">You qualify: ${e(spanText(r.span))} of service${r.years !== r.span.years ? `, counted as ${plural(r.years, 'year')}` : ''}.</p>`
    : `<p class="gratuity-status is-no">Not yet: ${e(r.needs === 1 ? 'fixed-term employees need one year' : 'gratuity needs five years')} of service, and you have ${e(spanText(r.span))}. The rule doesn’t apply on death or disablement.</p>`;
  return `${status}<div class="calc-headline gratuity-headline"><div><span>${r.eligible ? 'Your gratuity' : 'Gratuity once you qualify'}</span><strong>${rupees(r.amount)}</strong><small>${r.capped ? 'Capped at ₹20 lakh' : 'Before any employer top-up'}</small></div>
    <div><span>Years counted</span><strong>${r.years}</strong><small>${e(spanText(r.span))}</small></div>
    <div><span>Tax-free</span><strong>${rupees(r.taxFree)}</strong><small>Private-sector limit ₹20 lakh</small></div></div>
  <p class="gratuity-formula">${rupees(r.base)} × 15 ÷ 26 × ${plural(r.years, 'year')} = <strong>${rupees(r.raw)}</strong>${r.capped ? ', capped at ₹20,00,000' : ''}</p>
  ${r.raised ? '<p class="hike-note">Your basic pay and DA are under half of your total pay, so this uses half of your total pay, as the labour codes require.</p>' : ''}`;
}
