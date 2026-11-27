// Read-only production check: the main pages, the tools, the sitemaps and the cached job search answer.
// Run hourly by "Live checks"; a failure opens (or updates) the team-visible "Live checks failing" issue.
import {site} from '../js/site-config.js';

const origin = process.env.WILSY_ORIGIN || site.origin;
const pages = ['/', '/jobs', '/companies', '/tracker', '/salaries', '/salary-calculator', '/offer-compare', '/resume-match', '/copy-check', '/hiring-trends', '/tools', '/scam-check', '/salary-hike-calculator', '/gratuity-calculator', '/notice-period-calculator', '/career-letters', '/resume-builder', '/deadlines', '/age-calculator', '/typing-test', '/full-and-final-settlement', '/interview-answers', '/government-salary-calculator', '/epf-calculator', '/cgpa-calculator', '/experience-calculator', '/skills', '/embed', '/guides', '/government-jobs', '/hackathons'];

async function get(route, attempt = 1) {
  try {
    const response = await fetch(origin + route, {headers: {'User-Agent': 'wilsy-live-checks'}, redirect: 'follow', signal: AbortSignal.timeout(20000)});
    return {status: response.status, type: response.headers.get('content-type') || '', text: await response.text()};
  } catch(error) {
    if(attempt < 2) { await new Promise(r => setTimeout(r, 3000)); return get(route, attempt + 1); }
    return {status: 0, type: '', text: '', error: error.message};
  }
}

const failures = [];
const fail = (route, why) => failures.push(`${route}: ${why}`);
for(const route of pages) {
  const page = await get(route);
  if(page.status !== 200) fail(route, page.error || `HTTP ${page.status}`);
  else if(!/<h1[\s>]/i.test(page.text) || !page.type.includes('text/html')) fail(route, 'no page heading');
}
const sitemap = await get('/sitemap.xml');
if(sitemap.status !== 200 || !sitemap.text.includes('<urlset')) fail('/sitemap.xml', sitemap.error || `HTTP ${sitemap.status}`);
const robots = await get('/robots.txt');
for(const line of robots.text.match(/^Sitemap: \S+$/gm) || []) {
  const route = new URL(line.slice(9)).pathname;
  if(route === '/sitemap.xml') continue;
  const extra = await get(route);
  if(extra.status !== 200 || !extra.text.includes('<urlset')) fail(route, extra.error || `HTTP ${extra.status}`);
}
const search = await get('/api/search');
let jobs = null;
try { jobs = JSON.parse(search.text); } catch {}
if(search.status !== 200 || !Array.isArray(jobs?.jobs) || !(jobs.total > 0)) fail('/api/search', search.error || `HTTP ${search.status}, ${Array.isArray(jobs?.jobs) ? jobs.total + ' jobs' : 'no job list'}`);
// The jobs widget other sites load.
const widget = await get('/embed.js');
if(widget.status !== 200 || !widget.text.includes('WilsyJobs')) fail('/embed.js', widget.error || `HTTP ${widget.status}`);

if(failures.length) {
  console.error(`Site check failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Site check passed: ${pages.length} pages, sitemaps and /api/search (${jobs.total.toLocaleString('en-IN')} live jobs) on ${origin}.`);
}
