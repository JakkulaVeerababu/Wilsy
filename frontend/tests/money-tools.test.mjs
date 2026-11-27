import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {LEVELS, POSTS, payCells, govPay, govPayResult, hraRate, transportBase, cghsRate, payGroup, cellLabel} from '../js/govpay-core.js';
import {epfPlan, epfResult, epsShare, WAGE_CEILING} from '../js/epf-core.js';
import {PF_WAGE_CAP, takeHome} from '../js/take-home-core.js';
import {formulaOf, toPercent, toCgpa, semesterCgpa, neededSgpa, cgpaPlan, cgpaResult} from '../js/cgpa-core.js';
import {experience, experienceResult, experienceText, spanWords, jobRow} from '../js/experience-core.js';
import {TOOLS, toolsBody, searchIndex, govPayBody, epfBody, cgpaBody, experienceBody} from '../scripts/feature-pages.mjs';
import {header, footer} from '../scripts/page-shell.mjs';

test('Government pay: the matrix steps 3% to each level’s last cell, as the 7th Pay Commission printed it', () => {
  for(const [level, first, last] of LEVELS) {
    const cells = payCells(level);
    assert.equal(cells[0], first, level);
    assert.equal(cells[cells.length - 1], last, `Level ${level} ends at ${last}`);
    assert.ok(cells.every(n => n % 100 === 0), level);
  }
  for(const level of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']) assert.equal(payCells(level).length, 40, level);
  assert.deepEqual(payCells('7').slice(0, 5), [44900, 46200, 47600, 49000, 50500]);
  assert.deepEqual(payCells('1').slice(0, 4), [18000, 18500, 19100, 19700]);
  assert.equal(payCells('13a').length, 18);
  assert.deepEqual(payCells('19'), []);
  assert.equal(cellLabel(payCells('7'), 0), '₹44,900 (start of the level)');
  assert.equal(cellLabel(payCells('7'), 2), '₹47,600 (after 2 increments)');
  assert.ok(POSTS.every(([, , level]) => LEVELS.some(([id]) => id === level)));
});

test('Government pay: DA, HRA, transport allowance and deductions for a Level 7 post in an X city', () => {
  const p = govPay({level: '7', city: 'X'});
  assert.equal(p.basic, 44900);
  assert.equal(p.dearness, 28287, '63% of 44,900');
  assert.equal(p.hra, 13470, '30% in an X city');
  assert.equal(p.transport, 5868, '₹3,600 + 63% DA');
  assert.equal(p.gross, 92525);
  assert.equal(p.nps, 7319, '10% of basic + DA');
  assert.equal(p.cghs, 650);
  assert.equal(p.cgegis, 60, 'Group B');
  assert.equal(p.tax, 0, 'taxable income under ₹12 lakh');
  assert.equal(p.inHand, 92525 - 7319 - 650 - 60);
  assert.equal(p.governmentNps, Math.round((44900 + 28287) * .14));
  // Rules by level, city and DA.
  assert.deepEqual(['X', 'Y', 'Z'].map(c => hraRate(c, 63)), [30, 20, 10]);
  assert.deepEqual(['X', 'Y', 'Z'].map(c => hraRate(c, 40)), [27, 18, 9]);
  assert.equal(hraRate('Z', 10), 8);
  assert.equal(transportBase('10', 56100, true), 7200);
  assert.equal(transportBase('5', 29200, false), 1800);
  assert.equal(transportBase('1', 18000, true), 1350);
  assert.equal(transportBase('1', 24200, true), 3600, 'Levels 1 and 2 get the higher rate from ₹24,200');
  assert.deepEqual(['5', '6', '7', '12'].map(cghsRate), [250, 450, 650, 1000]);
  assert.deepEqual(['5', '6', '9', '10', '13A'].map(payGroup), ['C', 'B', 'B', 'A', 'A']);
  // Other choices.
  const mts = govPay({level: '1', city: 'Z', higherTa: false});
  assert.equal(mts.transport, Math.round(900 * 1.63));
  assert.equal(mts.cgegis, 30);
  const old = govPay({level: '7', pension: 'none', cghs: false, other: 1000});
  assert.equal(old.nps, 0);
  assert.equal(old.governmentNps, 0);
  assert.equal(old.inHand, old.gross - 60 - 1000);
  const senior = govPay({level: '13', city: 'X'});
  assert.ok(senior.tax > 0);
  assert.equal(govPay({level: '7', basic: 47600}).step, 2);
  assert.equal(govPay({level: '7', basic: 47601}).basic, 44900, 'a basic pay outside the level falls back to its first cell');
  assert.equal(govPay({level: '7', da: ''}).da, 63);
  assert.equal(govPay({level: '99'}), null);
  const html = govPayResult(p);
  assert.match(html, /In hand a month<\/span><strong>₹84,496/);
  assert.match(html, /30% of basic pay, X city/);
  assert.match(html, /Nil: taxable income up to ₹12 lakh/);
  assert.match(govPayBody(), /data-gp-post="inspector" data-level="7" aria-pressed="true"/);
  assert.equal((govPayBody().match(/<option value="\d+">₹/g) || []).length, 39, 'Level 7 has 40 cells, the first selected');
});

test('EPF: contributions, the pension share, the ₹25,000 wage ceiling and interest', () => {
  assert.equal(WAGE_CEILING, 25000);
  assert.equal(epsShare(15000), 1250);
  assert.equal(epsShare(25000), 2083);
  assert.equal(epsShare(60000), 2083);
  // One year by hand: ₹1 lakh now, ₹4,800 a month in, interest = 8.25% ÷ 12 × (12 × 1,00,000 + 66 × 4,800).
  const one = epfPlan({age: 30, retire: 31, wage: 20000, rise: 0, balance: 100000, eps: false});
  assert.equal(one.interest, 10428);
  assert.equal(one.total, 100000 + 12 * 4800 + 10428);
  const full = epfPlan({age: 25, wage: 30000});
  assert.deepEqual([full.first.own, full.first.employer, full.first.toEps, full.first.toEpf], [3600, 3600, 2083, 1517]);
  assert.equal(full.years, 33);
  assert.equal(full.retire, 58);
  assert.equal(full.total, full.opening + full.mine + full.theirs + full.interest);
  const capped = epfPlan({age: 40, wage: 60000, pfOn: 'ceiling'});
  assert.deepEqual([capped.first.own, capped.first.toEps, capped.first.toEpf], [3000, 2083, 917]);
  assert.equal(epfPlan({age: 40, wage: 60000, eps: false}).first.toEpf, 7200);
  assert.equal(epfPlan({age: 40, wage: 30000, vpf: 10}).first.extra, 3000);
  assert.equal(epfPlan({age: 40, wage: 200000}).taxable, true);
  assert.equal(epfPlan({age: 40, wage: 30000}).taxable, false);
  assert.deepEqual(epfPlan({age: 60, wage: 30000}), {error: 'retire'});
  assert.equal(epfPlan({age: '', wage: 30000}), null);
  assert.match(epfResult(full), /Your EPF at 58<\/span><strong>₹/);
  assert.match(epfResult(full), /₹1,517 to EPF and ₹2,083 to the pension scheme/);
  assert.match(epfBody(), /The wage ceiling only \(₹25,000 a month\)/);
  // The salary calculators use the new ceiling too.
  assert.equal(PF_WAGE_CAP, 300000);
  assert.equal(takeHome({ctc: 2400000, pf: 'capped'}).employeePf, 36000);
});

test('CGPA: conversions, the CGPA from semesters and the SGPA you need', () => {
  const aicte = formulaOf('aicte'), cbse = formulaOf('cbse'), ten = formulaOf('ten');
  assert.deepEqual([toPercent(8, aicte), toPercent(8, cbse), toPercent(8, ten)], [72.5, 76, 80]);
  assert.equal(toPercent(10, aicte), 92.5);
  assert.equal(toPercent(0.5, aicte), 0, 'never below 0%');
  assert.equal(toCgpa(72.5, aicte), 8);
  assert.equal(toCgpa(76, cbse), 8);
  assert.equal(toPercent(11, aicte), null);
  assert.equal(toPercent(8, formulaOf('custom', {multiplier: 7.1, offset: 11})), 67.8);
  assert.equal(formulaOf('custom', {multiplier: ''}), null);
  assert.equal(formulaOf('custom', {multiplier: 9.5, offset: -2}).name, 'CGPA × 9.5 − 2');
  assert.deepEqual(semesterCgpa([{sgpa: 8, credits: 20}, {sgpa: 9, credits: 25}, {sgpa: ''}]), {cgpa: 8.56, count: 2, weighted: true, credits: 45});
  assert.equal(semesterCgpa([{sgpa: 8}, {sgpa: 9, credits: 20}]).cgpa, 8.5, 'equal weights unless every semester has credits');
  assert.equal(semesterCgpa([{sgpa: 12}]), null);
  assert.equal(neededSgpa({cgpa: 7.5, done: 4, target: 8, left: 4}).need, 8.5);
  const far = neededSgpa({cgpa: 6, done: 6, target: 9, left: 2});
  assert.equal(far.reachable, false);
  assert.equal(far.best, 7);
  assert.equal(neededSgpa({cgpa: 9, done: 4, target: 8, left: 4}).need, 7, 'above the target, you still need 7 to stay there');
  assert.equal(neededSgpa({cgpa: 9, done: 8, target: 5, left: 1}).already, true);
  // The page's plan: typed percentage, semesters with credits, and the semesters' CGPA when nothing is typed.
  assert.deepEqual(cgpaPlan({percent: 72.5, from: 'percent'}).convert, {cgpa: 8, percent: 72.5});
  const sems = Array.from({length: 4}, () => ({sgpa: 8, credits: 20}));
  const plan = cgpaPlan({semesters: sems, target: 8.5, left: 2});
  assert.equal(plan.convert.fromSemesters, true);
  assert.equal(plan.need.need, 9.5, '(8.5 × 120 − 8 × 80) ÷ 40 credits');
  assert.equal(cgpaPlan({cgpa: 7, done: 4, target: 7.5, left: 4}).need.need, 8);
  const html = cgpaResult(cgpaPlan({cgpa: 8}));
  assert.match(html, /<strong>72\.5%<\/strong>/);
  assert.match(html, /<caption>CGPA to percentage: AICTE/);
  assert.match(cgpaResult(cgpaPlan({cgpa: 8, formula: 'custom'})), /Enter the number your university multiplies/);
  assert.equal((cgpaBody().match(/name="sgpa\d"/g) || []).length, 8);
});

test('Work experience: overlaps count once, gaps are listed and the total is as on a date', () => {
  const jobs = [{name: 'Acme', from: '2020-07-01', to: '2022-06-30'}, {name: 'Side project', from: '2022-01-01', to: '2022-12-31'}, {name: 'Now', from: '2023-07-01', current: true}];
  const r = experience(jobs, {asOn: '2026-11-20'});
  assert.equal(spanWords(r.total), '5 years, 10 months, 20 days');
  assert.equal(r.years, 5.9);
  assert.equal(r.months, 70);
  assert.equal(r.overlaps, true);
  assert.equal(r.gaps.length, 1);
  assert.deepEqual(r.gaps[0], {from: '2023-01-01', to: '2023-06-30', span: {years: 0, months: 6, days: 0}});
  assert.equal(experienceText(r), 'Total experience: 5 years, 10 months, 20 days (5.9 years), as on 20 Nov 2026');
  assert.equal(spanWords(experience([{from: '2023-07-01', to: '2024-06-30'}], {asOn: '2026-11-20'}).total), '1 year', 'both days count');
  // Counting stops at the "as on" date, and a gap since the last job is shown.
  const past = experience([{from: '2024-01-01', current: true}], {asOn: '2025-12-31'});
  assert.equal(spanWords(past.total), '2 years');
  const since = experience([{from: '2024-01-01', to: '2026-01-31'}], {asOn: '2026-11-20'});
  assert.equal(since.since.from, '2026-02-01');
  // Problems are reported, not counted.
  const bad = experience([{name: 'Late', from: '2027-01-01', to: '2027-06-30'}, {name: 'Backwards', from: '2024-05-01', to: '2024-01-01'}, {}], {asOn: '2026-11-20'});
  assert.equal(bad.total, null);
  assert.equal(bad.problems.length, 2);
  assert.match(experienceResult(bad), /The end date is before the start date/);
  // A company name with no dates asks for the dates; a fully blank row is ignored.
  const named = experience([{name: 'Gamma'}, {name: '  '}], {asOn: '2026-11-20'});
  assert.deepEqual(named.problems, [['Gamma', 'Add both dates, or tick “I work here now”.']]);
  const html = experienceResult(experience([{name: '<b>Co</b>', from: '2024-01-01', to: '2024-12-31'}], {asOn: '2026-11-20'}));
  assert.match(html, /&lt;b&gt;Co&lt;\/b&gt;/);
  assert.match(html, /data-xp-copy/);
  assert.match(jobRow(3, {name: '"x"'}), /id="xp-company-3"[^>]*value="&quot;x&quot;"/);
  assert.equal(experience([], {asOn: 'soon'}), null);
  assert.match(experienceBody({today: '2026-11-20'}), /name="asOn" type="date" value="2026-11-20"/);
});

test('The four new tools are on the tools hub, in quick search and the footer, highlighted and built', async () => {
  const urls = ['/government-salary-calculator', '/epf-calculator', '/cgpa-calculator', '/experience-calculator'];
  const foot = footer();
  for(const url of urls) {
    assert.ok(TOOLS.some(t => t[0] === url), url);
    assert.ok(toolsBody().includes(`href="${url}"`), url);
    assert.ok(searchIndex({companies: []}).some(i => i.u === url), url);
    assert.ok(foot.includes(`href="${url}"`), url);
    assert.match(header(url.slice(1)), /href="\/tools" class="active"/, url);
    const html = await fs.readFile(`dist${url}.html`, 'utf8');
    assert.match(html, /<h1>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.wilsy\.in/);
  }
  assert.equal(TOOLS.length, 27);
  for(const file of ['govpay-core.js', 'gov-salary.js', 'epf-core.js', 'epf.js', 'cgpa-core.js', 'cgpa.js', 'experience-core.js', 'experience.js']) await fs.access(`dist/js/${file}`);
});
