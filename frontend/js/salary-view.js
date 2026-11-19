import {escapeHtml as e} from './directory-core.js';
import {inr} from './pay-format.js';
import {stats, distribution} from './salary-core.js';

// Salary explorer markup, shared by the build (first render) and salaries.js.
const money = n => n == null ? '—' : inr(n, 1);

export function statsHtml(rows) {
  const s = stats(rows);
  return `<div><dt>Companies</dt><dd>${s.count.toLocaleString('en-IN')}</dd></div><div><dt>Median midpoint</dt><dd>${money(s.median)}</dd></div><div><dt>Middle half</dt><dd>${money(s.p25)} – ${money(s.p75)}</dd></div><div><dt>Highest midpoint</dt><dd>${money(s.max)}</dd></div>`;
}
// A horizontal bar per pay band: one series, so no legend; the count sits at the bar's end and in the tooltip.
export function chartHtml(rows) {
  const bands = distribution(rows), top = Math.max(1, ...bands.map(b => b.count));
  return `<ol class="salary-bars">${bands.map(b => `<li title="${e(b.name)}: ${b.count} compan${b.count === 1 ? 'y' : 'ies'}"><span class="salary-bar-label">${e(b.name)}</span><span class="salary-bar-track"><span class="salary-bar" style="width:${b.count ? Math.max(1, b.count / top * 100).toFixed(1) : 0}%"></span></span><span class="salary-bar-count">${b.count}</span></li>`).join('')}</ol>`;
}
export function rowsHtml(rows) {
  return rows.map(r => `<tr><th scope="row"><a href="/companies/${encodeURIComponent(r.id)}">${e(r.name)}</a><span>${e(r.sector)} · ${e(r.stage)}</span></th><td>${e(r.title || r.role)}${r.remote ? ' <span class="salary-remote">Remote</span>' : ''}</td><td class="salary-num">${money(r.min)} – ${money(r.max)}</td></tr>`).join('')
    || '<tr><td colspan="3" class="salary-empty">No companies match these filters. Try fewer filters.</td></tr>';
}
