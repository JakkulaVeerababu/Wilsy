import fs from 'node:fs/promises';
import {databaseRequest} from '../js/data-client.js';
import {jobPath, publishable, jobPageOptions, missingJobOptions} from './job-pages.mjs';
import {documentPage, bundleCss, analyticsTag} from './page-shell.mjs';

// On-demand job pages. vercel.json rewrites /jobs/<digits>-<slug> to api/job-page.mjs only when no static
// file matches (Vercel checks the filesystem before rewrites), so pre-built job pages and landing pages
// keep winning. This module renders any other live job with the same template and shell as the build.

export const JOB_ROUTE = /^\/jobs\/(\d+)-([^/]+)$/;
export const PAGE_CACHE = 's-maxage=3600, stale-while-revalidate=86400';
export const MISSING_CACHE = 's-maxage=600, stale-while-revalidate=3600';
// The same security headers vercel.json sets for every path (a test keeps the two lists equal).
export const SECURITY_HEADERS = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Strict-Transport-Security':'max-age=63072000; includeSubDomains',
  'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy':'same-origin-allow-popups',
};

// Public, read-only search with the anon key the site already uses.
export const searchPublicJobs = (filters, pageSize, signal) =>
  databaseRequest('rpc/wilsy_search_jobs',{body:{filters,page_size:pageSize,page_offset:0},signal});

// Literal paths so Vercel's file tracing sees them; vercel.json includeFiles also lists them.
const companiesFile = new URL('../data/companies.json', import.meta.url);
const fxFile = new URL('../data/exchange-rate.json', import.meta.url);
const cssDir = new URL('../css/', import.meta.url);
let cached;
// Company names and logos, the exchange rate and the stylesheets, read once per function instance.
export function loadAssets() {
  cached ??= (async () => {
    const [data, fx] = await Promise.all([companiesFile, fxFile].map(async file => JSON.parse(await fs.readFile(file,'utf8'))));
    return {companies:data.companies.map(({id,name,logo,website})=>({id,name,logo,website})), fx,
      read:name=>fs.readFile(new URL(name+'.css', cssDir),'utf8'), cache:new Map()};
  })().catch(error => { cached = undefined; throw error; });
  return cached;
}

/** The job id and requested path, from the original URL or from the rewrite's query (job_id, job_slug). */
export function jobTarget(url) {
  const match = url.pathname.match(JOB_ROUTE);
  const rawId = match ? match[1] : url.searchParams.get('job_id') || '';
  const slug = match ? match[2] : url.searchParams.get('job_slug') || '';
  if(!/^\d{1,18}$/.test(rawId)) return null;
  const id = rawId.replace(/^0+(?=\d)/,'');
  const query = new URLSearchParams(url.search);
  query.delete('job_id'); query.delete('job_slug');
  return {id, path:`/jobs/${rawId}-${slug}`, query:query.toString()};
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// One retry: the database is briefly busy while the hourly collectors write.
async function findJob(search, id) {
  let failure;
  for(const delay of [0, 400]) {
    if(delay) await wait(delay);
    try {
      const result = await search({id}, 1, AbortSignal.timeout(6000));
      if(Array.isArray(result?.jobs)) return result.jobs.find(job => String(job.id) === id) || null;
      failure = new Error('Unexpected search response');
    } catch(error) { failure = error; }
  }
  throw failure;
}
// Other live roles at the same company; optional, so a slow or failed search just leaves the section out.
async function companyJobs(search, job, now) {
  try {
    const result = await search({company:job.company}, 6, AbortSignal.timeout(2500));
    return (result?.jobs || []).filter(other => String(other.id) !== String(job.id) && publishable(other, now)).slice(0, 4);
  } catch { return []; }
}

export function createJobPageHandler({search=searchPublicJobs, now=()=>Date.now(), assets=loadAssets}={}) {
  const respond = (request, status, body, headers={}) => new Response(request.method === 'HEAD' ? null : body,
    {status, headers:{'Content-Type':'text/html; charset=utf-8', ...SECURITY_HEADERS, ...headers}});
  const render = async (options, {read, cache}) =>
    (await bundleCss(documentPage(options), {read, cache})).replace('</head>', `${analyticsTag()}</head>`);

  return async function handle(request) {
    if(request.method !== 'GET' && request.method !== 'HEAD')
      return respond(request, 405, 'Method not allowed', {'Content-Type':'text/plain; charset=utf-8', Allow:'GET, HEAD', 'Cache-Control':'no-store'});
    let shared;
    try { shared = await assets(); }
    catch(error) {
      console.error('job-page: assets unavailable', error);
      return respond(request, 500, 'This page is unavailable right now.', {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store'});
    }
    const url = new URL(request.url);
    const target = jobTarget(url);
    const missing = async route => respond(request, 404, await render(missingJobOptions(route), shared),
      {'Cache-Control':MISSING_CACHE, 'X-Robots-Tag':'noindex'});
    if(!target) return missing('/jobs');

    let job;
    try { job = await findJob(search, target.id); }
    catch(error) {
      console.error(`job-page: search failed for ${target.id}`, error?.message || error);
      return respond(request, 503, await render(missingJobOptions(target.path, {unavailable:true, id:target.id}), shared),
        {'Cache-Control':'no-store', 'Retry-After':'60', 'X-Robots-Tag':'noindex'});
    }
    const time = now();
    if(!job || !publishable(job, time)) return missing(target.path);

    const canonical = jobPath(job);
    if(target.path !== canonical)
      return respond(request, 301, '', {Location:canonical + (target.query ? '?' + target.query : ''), 'Cache-Control':PAGE_CACHE});

    const similar = request.method === 'HEAD' ? [] : await companyJobs(search, job, time);
    const options = jobPageOptions(job, {companies:shared.companies, fx:shared.fx, now:time,
      pages:new Set(similar.map(other => String(other.id))), similar, similarTitle:`More roles at ${job.company}`});
    return respond(request, 200, await render(options, shared),
      {'Cache-Control':PAGE_CACHE, ...(options.noindex ? {'X-Robots-Tag':'noindex'} : {})});
  };
}
