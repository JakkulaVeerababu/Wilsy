// Salary explorer: one published example role per company (mostly US roles in USD), shown as dated INR
// estimates. Pure functions shared by the build (first render) and salaries.js (filtering in the browser).

export const ROLE_GROUPS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations'];
export const STAGE_ORDER = ['Startup', 'Growth', 'Established'];
// Pay bands for the distribution, in rupees per year (midpoint of the example role's range).
export const BANDS = [
  [0, 5e6, 'Under ₹50 L'],
  [5e6, 1e7, '₹50 L – 1 Cr'],
  [1e7, 1.5e7, '₹1 – 1.5 Cr'],
  [1.5e7, 2e7, '₹1.5 – 2 Cr'],
  [2e7, 2.5e7, '₹2 – 2.5 Cr'],
  [2.5e7, 3e7, '₹2.5 – 3 Cr'],
  [3e7, Infinity, '₹3 Cr and above'],
];

/** One row per company with a published annual range; amounts are rupees per year. */
export function salaryRows(companies, rate) {
  return companies.filter(c => Number.isFinite(c.salary?.min) && Number.isFinite(c.salary?.max) && c.salary.max >= c.salary.min).map(c => ({
    id: c.id, name: c.name, logo: c.logo, sector: c.sector, stage: c.stage,
    role: c.sample?.role || c.role || 'Other', title: c.sample?.title || '', remote: c.sample?.remote === true,
    location: c.sample?.location || c.location || '', payKind: c.sample?.payKind || c.payKind || '',
    min: Math.round(c.salary.min * rate), max: Math.round(c.salary.max * rate), mid: Math.round((c.salary.min + c.salary.max) / 2 * rate),
  }));
}

const fold = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export function filterRows(rows, {q = '', role = '', sector = '', stage = '', remote = ''} = {}) {
  const words = fold(q).split(' ').filter(Boolean);
  return rows.filter(r => (!role || (role === 'Other' ? !ROLE_GROUPS.includes(r.role) : r.role === role))
    && (!sector || r.sector === sector) && (!stage || r.stage === stage) && (!remote || r.remote)
    && words.every(w => fold(`${r.name} ${r.title} ${r.sector}`).includes(w)));
}

export function sortRows(rows, sort = 'pay') {
  const list = [...rows];
  if(sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
  if(sort === 'low') return list.sort((a, b) => a.mid - b.mid || a.name.localeCompare(b.name));
  return list.sort((a, b) => b.mid - a.mid || a.name.localeCompare(b.name));
}

/** Linear-interpolated quantile of a sorted list (q between 0 and 1). */
export function quantile(sorted, q) {
  if(!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}
export function stats(rows) {
  const mids = rows.map(r => r.mid).sort((a, b) => a - b);
  return {count: rows.length, median: quantile(mids, .5), p25: quantile(mids, .25), p75: quantile(mids, .75), max: mids.length ? mids[mids.length - 1] : null};
}
export function distribution(rows) {
  return BANDS.map(([from, to, name]) => ({name, from, to, count: rows.filter(r => r.mid >= from && r.mid < to).length}));
}
/** Options for a filter: the values present, most common first (stages in their natural order). */
export function facet(rows, key) {
  const counts = new Map();
  for(const r of rows) counts.set(r[key], (counts.get(r[key]) || 0) + 1);
  const list = [...counts].filter(([value]) => value);
  return key === 'stage' ? list.sort((a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0])) : list.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function readFilters(search = '') {
  const p = new URLSearchParams(search), pick = (key, max = 80) => (p.get(key) || '').slice(0, max);
  return {q: pick('q', 100), role: pick('role'), sector: pick('sector'), stage: pick('stage'), remote: p.get('remote') === '1' ? '1' : '', sort: ['pay', 'low', 'name'].includes(p.get('sort')) ? p.get('sort') : 'pay'};
}
export function filterQuery(filters) {
  const p = new URLSearchParams();
  for(const key of ['q', 'role', 'sector', 'stage', 'remote']) if(filters[key]) p.set(key, filters[key]);
  if(filters.sort && filters.sort !== 'pay') p.set('sort', filters.sort);
  return p.toString();
}
