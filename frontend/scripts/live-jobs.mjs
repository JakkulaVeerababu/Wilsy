import {databaseRequest} from '../js/data-client.js';
import {jobPath} from '../js/jobs-core.js';
import {escapeHtml as e} from '../js/directory-core.js';
import {pageWorthy} from './job-pages.mjs';

// One pass over every live job at deploy time, through the public search (50 rows per call, the most it
// returns). It feeds the job sitemap (every indexable job page, not only the pre-built ones) and the
// open roles that company pages show to search engines. Rows are trimmed as they arrive.

const keep = (job, now) => ({id: String(job.id), title: job.title, company: job.company, company_slug: job.company_slug,
  location: job.location, city: job.city, country: job.country, work_mode: job.work_mode,
  posted_at: job.posted_at, posted_at_precision: job.posted_at_precision, first_seen_at: job.first_seen_at, discovered_at: job.discovered_at,
  indexable: pageWorthy(job, now)});

export async function fetchAllLiveJobs({request = databaseRequest, pageSize = 50, max = 30000, concurrency = 4, now = Date.now()} = {}) {
  const call = offset => request('rpc/wilsy_search_jobs', {body: {filters: {}, page_size: pageSize, page_offset: offset}});
  const first = await call(0);
  if(!Array.isArray(first?.jobs) || !Number.isSafeInteger(first.total)) throw new Error('Invalid public job response');
  const total = Math.min(first.total, max), pages = new Map([[0, first.jobs]]), offsets = [];
  for(let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, offsets.length)}, async () => {
    while(next < offsets.length) {
      const offset = offsets[next++];
      for(let attempt = 1; ; attempt++) {
        try { const page = await call(offset); pages.set(offset, Array.isArray(page?.jobs) ? page.jobs : []); break; }
        catch(error) { if(attempt >= 3) throw error; await new Promise(r => setTimeout(r, 500 * attempt)); }
      }
    }
  }));
  const seen = new Set(), jobs = [];
  for(const offset of [...pages.keys()].sort((a, b) => a - b)) for(const job of pages.get(offset)) {
    if(/^\d+$/.test(String(job?.id)) && !seen.has(String(job.id))) { seen.add(String(job.id)); jobs.push(keep(job, now)); }
  }
  return {jobs, total: first.total, asOf: first.as_of};
}

const day = job => { const t = Date.parse(job.posted_at || job.first_seen_at || job.discovered_at || ''); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : ''; };
/** Sitemap of indexable job pages, leaving out routes already in the main sitemap. */
export function jobSitemap(jobs, {origin, exclude = new Set()} = {}) {
  const urls = jobs.filter(job => job.indexable).map(job => [jobPath(job), day(job)]).filter(([route]) => !exclude.has(route));
  return {count: urls.length, xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([route, lastmod]) => `<url><loc>${e(origin + route)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}</urlset>`};
}

const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** Open roles per company profile id, newest first: {total, jobs}. Matches by slug, then by name. */
export function rolesByCompany(jobs, companies) {
  const byId = new Map(companies.map(c => [c.id, c.id])), byName = new Map(companies.map(c => [normalized(c.name), c.id]));
  const out = new Map();
  for(const job of jobs) {
    const id = byId.get(job.company_slug) || byName.get(normalized(job.company));
    if(!id) continue;
    if(!out.has(id)) out.set(id, []);
    out.get(id).push(job);
  }
  const time = job => Date.parse(job.posted_at || job.first_seen_at || job.discovered_at || '') || 0;
  return new Map([...out].map(([id, list]) => [id, {total: list.length, jobs: list.sort((a, b) => time(b) - time(a)).slice(0, 6)}]));
}
