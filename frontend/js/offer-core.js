import {takeHome, rupees} from './take-home-core.js';
import {escapeHtml as e} from './directory-core.js';

// Offer comparison: two or three job offers side by side in money that reaches your account, under the
// same FY 2026-27 new-regime maths as the in-hand calculator. Shared by the build and offer-compare.js.

export const MAX_OFFERS = 3;
const PT = [2400, 2500, 0];
const amount = (value, max) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)));

export function cleanOffer(raw = {}, index = 0) {
  const ctc = amount(raw.ctc, 1e9);
  return {name: String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || `Offer ${'ABC'[index] || index + 1}`,
    ctc, variable: amount(raw.variable, ctc), joining: amount(raw.joining, 1e8), equity: amount(raw.equity, 1e9),
    pt: PT.includes(Number(raw.pt)) ? Number(raw.pt) : 2400};
}

/** In-hand money for one offer. Year one adds the joining bonus as one-off pay, taxed with the rest. */
export function offerResult(raw, index = 0) {
  const o = cleanOffer(raw, index);
  const year = takeHome({ctc: o.ctc, variable: o.variable, professionalTax: o.pt});
  const first = o.joining ? takeHome({ctc: o.ctc + o.joining, variable: o.variable + o.joining, professionalTax: o.pt}) : year;
  return {...o, monthly: year.monthly, annual: year.annual, tax: year.tax, firstYear: first.annual, joiningNet: first.annual - year.annual};
}

export const ROWS = [
  ['monthly', 'In hand each month', 'Fixed pay after tax and PF'],
  ['annual', 'In hand per year', 'Including variable pay, if paid in full'],
  ['firstYear', 'First-year cash', 'Adds the joining bonus after tax'],
  ['tax', 'Income tax per year', 'Lower is better'],
  ['equity', 'Equity per year (as stated)', 'Not cash: may vest, change in value or be worth nothing'],
];

/** The position of the offer that leads each row (lowest tax, highest of the rest); ties and empty offers lead nothing. */
export function leaders(results) {
  const live = results.map((r, i) => [r, i]).filter(([r]) => r.ctc > 0);
  const out = {};
  for(const [key] of ROWS) {
    if(live.length < 2) continue;
    const values = live.map(([r]) => r[key]), best = key === 'tax' ? Math.min(...values) : Math.max(...values);
    if(values.filter(v => v === best).length === 1 && (key !== 'equity' || best > 0)) out[key] = live.find(([r]) => r[key] === best)[1];
  }
  return out;
}

export function summary(results) {
  const live = results.filter(r => r.ctc > 0).sort((a, b) => b.monthly - a.monthly);
  if(live.length < 2) return 'Enter the CTC of at least two offers to compare them.';
  const [first, second] = live, gap = first.monthly - second.monthly;
  if(gap === 0) return `${first.name} and ${second.name} pay the same in hand each month.`;
  return `${first.name} puts ${rupees(gap)} more in your account each month than ${second.name} (${rupees(gap * 12)} a year).`;
}

export function offerTable(rawOffers) {
  const results = rawOffers.map(offerResult), lead = leaders(results);
  return `<p class="offer-summary">${e(summary(results))}</p>
  <div class="salary-table-wrap"><table class="offer-table"><caption class="sr-only">The offers compared, in rupees</caption>
  <thead><tr><th scope="col">Per offer</th>${results.map(r => `<th scope="col">${e(r.name)}<span>${rupees(r.ctc)} CTC</span></th>`).join('')}</tr></thead>
  <tbody>${ROWS.map(([key, label, note]) => `<tr><th scope="row">${e(label)}<span>${e(note)}</span></th>${results.map((r, i) => `<td${lead[key] === i ? ' class="is-best"' : ''}>${rupees(r[key])}${lead[key] === i ? '<small>Best</small>' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// The comparison in the address bar, so it can be shared: ?offers=name~ctc~variable~joining~equity~pt|…
export function offersQuery(offers) {
  return offers.map((raw, i) => { const o = cleanOffer(raw, i); return [o.name, o.ctc, o.variable, o.joining, o.equity, o.pt].map(v => String(v).replace(/[~|]/g, ' ')).join('~'); }).join('|');
}
export function readOffers(value) {
  const parts = String(value || '').split('|').filter(Boolean).slice(0, MAX_OFFERS)
    .map((part, i) => { const [name, ctc, variable, joining, equity, pt] = part.split('~'); return cleanOffer({name, ctc, variable, joining, equity, pt}, i); });
  return parts.length >= 2 ? parts : null;
}
export const DEFAULT_OFFERS = [{name: 'Offer A', ctc: 1200000}, {name: 'Offer B', ctc: 1500000, variable: 150000, joining: 100000}].map(cleanOffer);

const field = (i, name, label, value, hint = '') => `<div class="calc-field"><label for="offer-${name}-${i}">${label}</label><input id="offer-${name}-${i}" name="${name}" type="number" inputmode="numeric" min="0" step="10000" value="${value || ''}"${name === 'ctc' ? ' required' : ''} placeholder="0">${hint ? `<span class="calc-words">${hint}</span>` : ''}</div>`;
/** The editable form: one fieldset per offer, plus add and remove buttons. */
export function offerFields(offers) {
  return offers.map((raw, i) => { const o = cleanOffer(raw, i); return `<fieldset class="offer-card" data-offer>
    <legend class="sr-only">Offer ${i + 1}</legend>
    <div class="calc-field offer-name"><label for="offer-name-${i}">Company or offer name</label><input id="offer-name-${i}" name="name" type="text" maxlength="40" value="${e(o.name)}" autocomplete="off"></div>
    ${field(i, 'ctc', 'Yearly CTC (₹)', o.ctc)}${field(i, 'variable', 'Variable pay or bonus in the CTC (₹ a year)', o.variable)}
    ${field(i, 'joining', 'Joining bonus, one time (₹)', o.joining)}${field(i, 'equity', 'Equity per year, as stated (₹)', o.equity, 'ESOPs or stock vesting each year. Shown, not added to cash.')}
    <div class="calc-field"><label for="offer-pt-${i}">Professional tax</label><select id="offer-pt-${i}" name="pt">${[[2400, '₹2,400 a year'], [2500, '₹2,500 (Maharashtra and others)'], [0, 'None (Delhi, Haryana and others)']].map(([v, t]) => `<option value="${v}"${o.pt === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    ${offers.length > 2 ? `<button class="offer-remove" type="button" data-offer-remove="${i}">Remove ${e(o.name)}</button>` : ''}
  </fieldset>`; }).join('') + (offers.length < MAX_OFFERS ? '<button class="secondary-button offer-add" type="button" data-offer-add>+ Add a third offer</button>' : '');
}
