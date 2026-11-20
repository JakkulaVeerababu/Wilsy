import {escapeHtml as e} from './directory-core.js';

// CGPA and percentage, for the CGPA calculator. There is no single national rule: each board or university sets
// its own, and many print it on the grade card.
// - CBSE (Classes 9 and 10, 10-point grades): indicative percentage = CGPA × 9.5.
// - The formula AICTE gives for engineering and management colleges: percentage = (CGPA − 0.75) × 10.
// - Some universities simply multiply by 10.
// A CGPA over several semesters is the credit-weighted average of their SGPAs (a plain average when the credits
// aren't known).

/** [id, name, multiplier, offset]: percentage = CGPA × multiplier + offset. */
export const FORMULAS = [['aicte', 'AICTE: (CGPA − 0.75) × 10', 10, -7.5], ['cbse', 'CBSE Class 10: CGPA × 9.5', 9.5, 0], ['ten', 'CGPA × 10', 10, 0], ['custom', 'Your university’s formula', null, null]];
export const SEMESTERS = 8;
export const MAX_SEMESTERS = 12;

const num = value => {
  if(String(value ?? '').trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round2 = n => Math.round(n * 100) / 100;
/** "8", "8.5" or "8.25". */
export const fmt = n => n == null ? '' : String(round2(n));

/** {id, name, m, c}, or null when a custom formula has no multiplier. */
export function formulaOf(id, {multiplier, offset} = {}) {
  const row = FORMULAS.find(([key]) => key === id) || FORMULAS[0];
  if(row[0] !== 'custom') return {id: row[0], name: row[1], m: row[2], c: row[3]};
  const m = num(multiplier), c = num(offset) ?? 0;
  if(m == null || m <= 0 || m > 20 || Math.abs(c) > 100) return null;
  return {id: 'custom', name: `CGPA × ${fmt(m)}${c ? ` ${c < 0 ? '−' : '+'} ${fmt(Math.abs(c))}` : ''}`, m, c};
}

/** Percentage for a CGPA out of 10, or null. */
export function toPercent(cgpa, f) {
  const g = num(cgpa);
  if(!f || g == null || g < 0 || g > 10) return null;
  return round2(Math.min(100, Math.max(0, g * f.m + f.c)));
}
/** CGPA for a percentage, or null. */
export function toCgpa(percent, f) {
  const p = num(percent);
  if(!f || p == null || p < 0 || p > 100) return null;
  return round2(Math.min(10, Math.max(0, (p - f.c) / f.m)));
}

/** CGPA from semesters [{sgpa, credits}]: weighted by credits when every filled semester has them. */
export function semesterCgpa(rows = []) {
  const filled = rows.map(row => ({sgpa: num(row.sgpa), credits: num(row.credits)})).filter(row => row.sgpa != null && row.sgpa >= 0 && row.sgpa <= 10);
  if(!filled.length) return null;
  const weighted = filled.every(row => row.credits != null && row.credits > 0 && row.credits <= 100);
  const weight = row => weighted ? row.credits : 1;
  const total = filled.reduce((sum, row) => sum + weight(row), 0);
  return {cgpa: round2(filled.reduce((sum, row) => sum + row.sgpa * weight(row), 0) / total), count: filled.length, weighted, credits: weighted ? total : null};
}

/**
 * The average SGPA needed over the semesters left to reach a target CGPA. done and left are in the same unit:
 * credits, or semesters when credits aren't used.
 */
export function neededSgpa({cgpa, done, target, left}) {
  const g = num(cgpa), d = num(done), t = num(target), l = num(left);
  if([g, d, t, l].includes(null) || g < 0 || g > 10 || t < 0 || t > 10 || d <= 0 || l <= 0) return null;
  const need = (t * (d + l) - g * d) / l;
  return {need: round2(Math.max(0, need)), reachable: need <= 10, already: need <= 0, best: round2((g * d + 10 * l) / (d + l)), target: t};
}

/**
 * Everything the calculator shows. from: the box typed in last ('cgpa' or 'percent'). semesters: [{sgpa,
 * credits}]. target, left: the target CGPA and the semesters left. done: semesters done, used when no semesters
 * are filled in. Without a CGPA or a percentage, the semesters' CGPA is converted.
 */
export function cgpaPlan({cgpa, percent, from = 'cgpa', formula = 'aicte', multiplier, offset, semesters = [], target, left, done} = {}) {
  const f = formulaOf(formula, {multiplier, offset}), sems = semesterCgpa(semesters);
  let convert = null;
  if(f) {
    if(from === 'percent') { const g = toCgpa(percent, f); if(g != null) convert = {cgpa: g, percent: round2(num(percent))}; }
    else { const p = toPercent(cgpa, f); if(p != null) convert = {cgpa: round2(num(cgpa)), percent: p}; }
    if(!convert && sems) convert = {cgpa: sems.cgpa, percent: toPercent(sems.cgpa, f), fromSemesters: true};
  }
  const more = num(left), count = more > 0 && more <= MAX_SEMESTERS ? Math.round(more) : null;
  // With credits, the semesters left are counted at the average credits of those done.
  const unit = sems?.weighted ? sems.credits / sems.count : 1;
  const need = count ? neededSgpa({cgpa: sems ? sems.cgpa : convert?.cgpa ?? num(cgpa), done: sems ? (sems.weighted ? sems.credits : sems.count) : done, target, left: count * unit}) : null;
  return {formula: f, convert, sems, need, left: count};
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The result panel, from cgpaPlan. */
export function cgpaResult({convert, sems, need, formula, left}) {
  if(!formula) return '<p class="match-empty">Enter the number your university multiplies the CGPA by.</p>';
  const main = convert
    ? `<div><span>Percentage</span><strong>${fmt(convert.percent)}%</strong><small>CGPA ${fmt(convert.cgpa)}${convert.fromSemesters ? ' from your semesters' : ''} · ${e(formula.name)}</small></div>`
    : '<div><span>Percentage</span><strong>–</strong><small>Enter a CGPA, a percentage or your semesters</small></div>';
  const semBox = sems
    ? `<div><span>CGPA from your semesters</span><strong>${fmt(sems.cgpa)}</strong><small>${plural(sems.count, 'semester')}, ${sems.weighted ? `${fmt(sems.credits)} credits` : 'equal weight'}</small></div>`
    : '<div><span>CGPA from your semesters</span><strong>–</strong><small>Add your SGPAs</small></div>';
  let needBox;
  if(!need) needBox = '<div><span>SGPA you need</span><strong>–</strong><small>Add a target and the semesters left</small></div>';
  else if(!need.reachable) needBox = `<div><span>SGPA you need</span><strong>Over 10</strong><small>The best you can reach is ${fmt(need.best)}</small></div>`;
  else if(need.already) needBox = `<div><span>SGPA you need</span><strong>Any</strong><small>You’re at ${fmt(need.target)} or above already</small></div>`;
  else needBox = `<div><span>SGPA you need</span><strong>${fmt(need.need)}</strong><small>On average${left ? ` over ${plural(left, 'semester')}` : ''}, for ${fmt(need.target)}</small></div>`;
  const steps = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  return `<div class="calc-headline cg-headline">${main}${semBox}${needBox}</div>
  <table class="calc-table cg-table"><caption>CGPA to percentage: ${e(formula.name)}</caption><thead><tr><th scope="col">CGPA</th><th scope="col">Percentage</th></tr></thead>
    <tbody>${steps.map(g => `<tr><th scope="row">${fmt(g)}</th><td>${fmt(toPercent(g, formula))}%</td></tr>`).join('')}</tbody></table>
  <p class="hike-note">Check your university’s rule before you fill in a form: many print the formula on the grade card or give a conversion certificate on request.</p>`;
}
