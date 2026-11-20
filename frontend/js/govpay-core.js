import {escapeHtml as e} from './directory-core.js';
import {incomeTax, STANDARD_DEDUCTION, rupees} from './take-home-core.js';

// Monthly pay in central government jobs on the 7th Pay Commission's pay matrix, for the government salary
// calculator. The 8th Pay Commission was set up on 3 November 2025 and has until May 2027 to report; until new pay
// is notified, this matrix and these allowances apply.
//
// - Basic pay: a level's first cell, then about 3% for each yearly increment (3% rounded to the nearest ₹100), up to
//   the level's last cell.
// - DA: 63% of basic pay from 1 July 2026 (approved in October 2026). It is revised every January and July.
// - HRA: 30%, 20% or 10% of basic pay in X, Y and Z cities since DA reached 50% on 1 January 2024
//   (27, 18 and 9% while DA was 25% to 50%; 24, 16 and 8% below that).
// - Transport allowance (Finance Ministry order of 7 July 2017), with DA on top: Level 9 and above ₹7,200 in the
//   19 cities with the higher rate and ₹3,600 elsewhere; Levels 3 to 8 ₹3,600 and ₹1,800; Levels 1 and 2 ₹1,350
//   and ₹900, or the Level 3 to 8 rates once basic pay reaches ₹24,200.
// - Deductions: NPS or UPS, 10% of basic pay + DA; CGHS ₹250 (Levels 1 to 5), ₹450 (6), ₹650 (7 to 11) or ₹1,000
//   (12 and up) a month; CGEGIS ₹30 (Group C), ₹60 (Group B) or ₹120 (Group A); income tax in the new regime,
//   where the government's own NPS share is deducted again and so is left out.

export const DA_RATE = 63;
export const DA_SINCE = '1 July 2026';
/** [level, first cell, last cell] of the pay matrix. */
export const LEVELS = [['1', 18000, 56900], ['2', 19900, 63200], ['3', 21700, 69100], ['4', 25500, 81100], ['5', 29200, 92300], ['6', 35400, 112400],
  ['7', 44900, 142400], ['8', 47600, 151100], ['9', 53100, 167800], ['10', 56100, 177500], ['11', 67700, 208700], ['12', 78800, 209200],
  ['13', 123100, 215900], ['13A', 131100, 216600], ['14', 144200, 218200], ['15', 182200, 224100], ['16', 205400, 224400], ['17', 225000, 225000], ['18', 250000, 250000]];
export const X_CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Pune'];
/** The cities (with their urban areas) that get the higher transport allowance. */
export const TA_CITIES = ['Ahmedabad', 'Bengaluru', 'Chennai', 'Coimbatore', 'Delhi', 'Ghaziabad', 'Hyderabad', 'Indore', 'Jaipur', 'Kanpur', 'Kochi', 'Kolkata',
  'Kozhikode', 'Lucknow', 'Mumbai', 'Nagpur', 'Patna', 'Pune', 'Surat'];
/** Common posts and the pay level recent notices give them: [id, name, level]. */
export const POSTS = [['mts', 'MTS (SSC)', '1'], ['ldc', 'LDC or JSA (SSC CHSL)', '2'], ['constable', 'Constable GD (SSC GD)', '3'], ['tax-assistant', 'Tax Assistant (SSC CGL)', '4'],
  ['auditor', 'Auditor (SSC CGL)', '5'], ['si', 'Sub-Inspector (SSC CPO)', '6'], ['inspector', 'Inspector or ASO (SSC CGL)', '7'], ['aao', 'Assistant Audit Officer (SSC CGL)', '8'],
  ['ias', 'IAS (UPSC civil services)', '10']];
export const CGEGIS = {A: 120, B: 60, C: 30};

const levelRow = level => LEVELS.find(([id]) => id === String(level ?? '').trim().toUpperCase());
const levelNumber = level => parseInt(level, 10);

/** The cells of a level, from its first to its last. */
export function payCells(level) {
  const row = levelRow(level);
  if(!row) return [];
  const [, first, last] = row, cells = [first];
  // Every cell is a multiple of ₹100, so cell ÷ 100 × 103 is a whole number of rupees.
  while(cells[cells.length - 1] < last && cells.length < 60) cells.push(Math.round(cells[cells.length - 1] / 100 * 103 / 100) * 100);
  return cells;
}

/** HRA as a percentage of basic pay, for a city class and a DA rate. */
export function hraRate(city, da) {
  const rates = da >= 50 ? [30, 20, 10] : da >= 25 ? [27, 18, 9] : [24, 16, 8];
  const i = ['X', 'Y', 'Z'].indexOf(city);
  return rates[i < 0 ? 2 : i];
}

/** Transport allowance before DA. */
export function transportBase(level, basic, higher) {
  const n = levelNumber(level);
  if(n >= 9) return higher ? 7200 : 3600;
  if(n >= 3 || basic >= 24200) return higher ? 3600 : 1800;
  return higher ? 1350 : 900;
}
export const cghsRate = level => { const n = levelNumber(level); return n <= 5 ? 250 : n === 6 ? 450 : n <= 11 ? 650 : 1000; };
/** Group C up to Level 5, Group B for Levels 6 to 9, Group A from Level 10. */
export const payGroup = level => { const n = levelNumber(level); return n <= 5 ? 'C' : n <= 9 ? 'B' : 'A'; };

const amount = (value, max) => { const n = Math.round(Number(value)); return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0; };

/**
 * Pay for one month. level: an id from LEVELS. basic: one of the level's cells (the first if not). city: 'X', 'Y'
 * or 'Z'. higherTa: posted in one of TA_CITIES. da: DA in percent. pension: 'nps' (NPS or UPS) or 'none' (old
 * pension). cghs: pays the CGHS contribution. other: other deductions in rupees a month.
 */
export function govPay({level = '7', basic, city = 'X', higherTa = true, da = DA_RATE, pension = 'nps', cghs = true, other = 0} = {}) {
  const row = levelRow(level);
  if(!row) return null;
  const cells = payCells(row[0]), wanted = Math.round(Number(basic));
  const pay = cells.includes(wanted) ? wanted : cells[0];
  const daRate = String(da ?? '').trim() === '' ? DA_RATE : amount(da, 200);
  const cls = ['X', 'Y', 'Z'].includes(city) ? city : 'Z';
  const dearness = Math.round(pay * daRate / 100);
  const hraPct = hraRate(cls, daRate), hra = Math.round(pay * hraPct / 100);
  const taBase = transportBase(row[0], pay, !!higherTa), transport = Math.round(taBase * (100 + daRate) / 100);
  const gross = pay + dearness + hra + transport;
  const nps = pension === 'nps' ? Math.round((pay + dearness) / 10) : 0;
  const health = cghs ? cghsRate(row[0]) : 0, group = payGroup(row[0]), insurance = CGEGIS[group];
  const yearTax = incomeTax(Math.max(0, gross * 12 - STANDARD_DEDUCTION)), tax = Math.round(yearTax / 12);
  const extra = amount(other, 1000000), deductions = nps + health + insurance + tax + extra;
  return {level: row[0], cells, basic: pay, step: cells.indexOf(pay), da: daRate, city: cls, higherTa: !!higherTa, dearness, hraPct, hra, taBase, transport, gross,
    pension: pension === 'nps' ? 'nps' : 'none', nps, cghs: health, group, cgegis: insurance, yearTax, tax, other: extra, deductions, inHand: gross - deductions,
    governmentNps: pension === 'nps' ? Math.round((pay + dearness) * 14 / 100) : 0};
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** "₹46,200 (after 1 increment)". */
export const cellLabel = (cells, i) => `${rupees(cells[i])} (${i ? `after ${plural(i, 'increment')}` : 'start of the level'})`;
const yearly = n => n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} lakh a year` : `${rupees(n)} a year`;

/** The result panel. */
export function govPayResult(p) {
  if(!p) return '<p class="match-empty">Choose a pay level to see the pay.</p>';
  const minus = n => n ? '−' + rupees(n) : rupees(0);
  const rows = [
    ['Basic pay', `Level ${p.level}`, rupees(p.basic)],
    ['Dearness allowance', `${p.da}% of basic pay`, rupees(p.dearness)],
    ['House rent allowance', `${p.hraPct}% of basic pay, ${p.city} city`, rupees(p.hra)],
    ['Transport allowance', `${rupees(p.taBase)} + ${p.da}% DA`, rupees(p.transport)],
  ];
  const cuts = [
    ['NPS or UPS', p.pension === 'nps' ? '10% of basic pay + DA' : 'Old pension scheme', minus(p.nps)],
    ['CGHS', p.cghs ? `Health scheme, Level ${p.level}` : 'Not counted', minus(p.cghs)],
    ['CGEGIS', `Group insurance, Group ${p.group}`, minus(p.cgegis)],
    ['Income tax', p.tax ? 'New regime, spread over 12 months' : 'Nil: taxable income up to ₹12 lakh', minus(p.tax)],
    ...(p.other ? [['Other deductions', 'As entered', minus(p.other)]] : []),
  ];
  const line = ([name, how, value]) => `<tr><th scope="row">${e(name)}<span>${e(how)}</span></th><td>${value}</td></tr>`;
  return `<div class="calc-headline gp-headline"><div><span>In hand a month</span><strong>${rupees(p.inHand)}</strong><small>After NPS, CGHS, CGEGIS and tax</small></div>
    <div><span>Gross pay a month</span><strong>${rupees(p.gross)}</strong><small>${e(yearly(p.gross * 12))}</small></div>
    <div><span>Basic pay</span><strong>${rupees(p.basic)}</strong><small>Level ${e(p.level)}, ${p.step ? `after ${plural(p.step, 'increment')}` : 'start of the level'}</small></div></div>
  <table class="calc-table ff-table gp-table"><caption class="sr-only">How the pay adds up</caption><tbody>${rows.map(line).join('')}
    <tr class="calc-subtotal"><th scope="row">Gross pay</th><td>${rupees(p.gross)}</td></tr>${cuts.map(line).join('')}
    <tr class="calc-total"><th scope="row">In hand</th><td>${rupees(p.inHand)}</td></tr></tbody></table>
  ${p.governmentNps ? `<p class="hike-note">The government also pays ${rupees(p.governmentNps)} a month (14% of basic pay + DA) into your NPS account, or 18.5% under UPS. It isn’t part of your in-hand pay.</p>` : ''}
  <div class="notice-actions"><a class="secondary-button" href="/government-jobs">Open government jobs</a><a class="secondary-button" href="/age-calculator">Check your age limit</a><a class="secondary-button" href="/deadlines?type=government">See last dates</a></div>`;
}
