import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createJobPageHandler, jobTarget, JOB_ROUTE, PAGE_CACHE, SECURITY_HEADERS, loadAssets} from '../scripts/job-page-handler.mjs';
import {landingPages} from '../scripts/landing-pages.mjs';
import jobPageFunction from '../../api/job-page.mjs';

const now = Date.parse('2026-11-14T12:00:00Z');
const long = 'Design and run the services behind our payments platform. '.repeat(12);
const job = {id:123,title:'Backend Engineer (Go)',company:'Acme',apply_url:'https://jobs.example.com/1',description:long,
  posted_at:'2026-11-10T10:00:00Z',work_mode:'hybrid',job_type:'full_time',location:'Bengaluru, India',
  locations:[{city:'Bengaluru',state:'Karnataka',country:'India',country_code:'IN',location:'Bengaluru, Karnataka, India'}]};
const canonical = '/jobs/123-backend-engineer-go-acme';
const others = [{...job,id:124,title:'Frontend Engineer'},{...job,id:125,title:'Data Engineer',expires_at:'2026-11-01T00:00:00Z'}];

// A fake public search: {id} returns the job (or nothing), {company} returns other roles.
function fakeSearch(found=job, {fail=false}={}) {
  const calls = [];
  const search = async (filters, pageSize) => {
    calls.push({filters, pageSize});
    if(fail) throw new Error('Data service unavailable (503)');
    if(filters.id) return {jobs: found && String(found.id) === filters.id ? [found] : [], total: found ? 1 : 0};
    return {jobs: [found, ...others].filter(Boolean), total: 3};
  };
  return {search, calls};
}
const handlerFor = (found, options) => { const fake = fakeSearch(found, options); return {fake, handle: createJobPageHandler({search: fake.search, now: () => now})}; };
const get = (handle, url, method='GET') => handle(new Request('https://www.wilsy.in'+url, {method}));
const robots = html => /<meta name="robots" content="noindex,follow">/.test(html);

test('A live job renders with the shared shell, JobPosting data, apply link and caching', async () => {
  const {handle, fake} = handlerFor(job);
  // Vercel's rewrite passes the id and slug as query parameters; the original path works too.
  for(const url of [`/api/job-page?job_id=123&job_slug=backend-engineer-go-acme`, canonical]) {
    const response = await get(handle, url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), PAGE_CACHE);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    for(const [key, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(key), value);
    assert.equal(response.headers.get('x-robots-tag'), null);
    const html = await response.text();
    assert.match(html, /<h1>Backend Engineer \(Go\)<\/h1>/);
    assert.match(html, /<title>Backend Engineer \(Go\) at Acme — WILSY<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www.wilsy.in\/jobs\/123-backend-engineer-go-acme">/);
    assert.match(html, /"@type":"JobPosting"/);
    assert.match(html, /href="https:\/\/jobs.example.com\/1" target="_blank" rel="noopener noreferrer">Apply on employer site/);
    assert.match(html, /<header class="site-header">/); assert.match(html, /<footer class="site-footer premium-footer">/);
    assert.ok(!robots(html)); assert.doesNotMatch(html, /pagead2/);
    // Other live roles at the company link to their own pages; expired ones are left out.
    assert.match(html, /<h2 id="similar-title">More roles at Acme<\/h2>/);
    assert.match(html, /href="\/jobs\/124-frontend-engineer-acme"/);
    assert.doesNotMatch(html, /125-data-engineer/);
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="(\/css\/[^"]+)"/g)].map(m => m[1]);
    assert.equal(sheets.length, 1); assert.match(sheets[0], /^\/css\/b-[0-9a-f]{12}\.css$/);
  }
  assert.deepEqual(fake.calls.slice(0, 2).map(c => c.filters), [{id:'123'}, {company:'Acme'}]);
});

test('The function links the same CSS bundle the build writes for job and landing pages', async t => {
  const dist = path.resolve('dist');
  const landing = await fs.readFile(path.join(dist, 'jobs', 'backend-jobs.html'), 'utf8').catch(() => null);
  if(!landing) return t.skip('run the build first');
  const {handle} = handlerFor(job);
  const html = await (await get(handle, canonical)).text();
  const bundle = html.match(/href="\/css\/(b-[0-9a-f]{12}\.css)"/)[1];
  assert.equal(landing.match(/href="\/css\/(b-[0-9a-f]{12}\.css)"/)[1], bundle);
  await fs.access(path.join(dist, 'css', bundle));
});

test('A different or missing slug gets a permanent redirect to the canonical URL, keeping other query parameters', async () => {
  const {handle} = handlerFor(job);
  for(const [url, location] of [
    ['/jobs/123-old-title?utm_source=mail', canonical+'?utm_source=mail'],
    ['/api/job-page?job_id=123&job_slug=old-title&utm_source=mail', canonical+'?utm_source=mail'],
    ['/jobs/0123-backend-engineer-go-acme', canonical],
    ['/jobs/123-Backend-Engineer-Go-Acme', canonical],
  ]) {
    const response = await get(handle, url);
    assert.equal(response.status, 301, url);
    assert.equal(response.headers.get('location'), location);
    assert.equal(response.headers.get('cache-control'), PAGE_CACHE);
  }
});

test('Missing, expired and unpublishable jobs get a noindex 404 page', async () => {
  const cases = [
    [null, '/jobs/999-anything'],
    [{...job, expires_at:'2026-11-01T00:00:00Z'}, canonical],
    [{...job, deadline_at:'2026-11-13T00:00:00Z'}, canonical],
    [{...job, apply_url:'http://insecure.example.com'}, canonical],
  ];
  for(const [found, url] of cases) {
    const {handle} = handlerFor(found);
    const response = await get(handle, url);
    assert.equal(response.status, 404, url);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.match(response.headers.get('cache-control'), /^s-maxage=\d+/);
    const html = await response.text();
    assert.ok(robots(html)); assert.match(html, /This role is no longer open/);
    assert.doesNotMatch(html, /JobPosting/); assert.match(html, /href="\/jobs"/);
  }
  const {handle, fake} = handlerFor(job);
  assert.equal((await get(handle, '/api/job-page?job_id=abc&job_slug=x')).status, 404);
  assert.equal((await get(handle, '/api/job-page')).status, 404);
  assert.equal(fake.calls.length, 0);
});

test('Descriptions under 600 characters still get a useful page, but noindex and without JobPosting', async () => {
  for(const [length, indexable] of [[599, false], [600, true]]) {
    const role = {...job, description:'x'.repeat(length)};
    const {handle} = handlerFor(role);
    const response = await get(handle, canonical);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(robots(html), !indexable, `${length} characters`);
    assert.equal(response.headers.get('x-robots-tag'), indexable ? null : 'noindex');
    assert.equal(/"@type":"JobPosting"/.test(html), indexable);
    assert.match(html, /Apply on employer site/);
  }
  const {handle} = handlerFor({...job, description:''});
  const html = await (await get(handle, canonical)).text();
  assert.match(html, /The full description is on the <a href="https:\/\/jobs.example.com\/1"/);
});

test('A failing search retries once, then answers 503 without caching', async () => {
  const {handle, fake} = handlerFor(job, {fail:true});
  const response = await get(handle, canonical);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '60');
  const html = await response.text();
  assert.ok(robots(html)); assert.match(html, /href="\/jobs\?job=123"/);
  assert.equal(fake.calls.length, 2);
});

test('HEAD has headers and no body; other methods are refused', async () => {
  const {handle} = handlerFor(job);
  const head = await get(handle, canonical, 'HEAD');
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const post = await get(handle, canonical, 'POST');
  assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('jobTarget reads the id from the path or the rewrite query', () => {
  assert.deepEqual(jobTarget(new URL('https://x.test/jobs/42-a-b?ref=1')), {id:'42', path:'/jobs/42-a-b', query:'ref=1'});
  assert.deepEqual(jobTarget(new URL('https://x.test/api/job-page?job_id=42&job_slug=a-b')), {id:'42', path:'/jobs/42-a-b', query:''});
  assert.equal(jobTarget(new URL('https://x.test/api/job-page?job_id=4x2')), null);
});

const vercel = JSON.parse(await fs.readFile(path.resolve('..', 'vercel.json'), 'utf8'));
// path-to-regexp's ":name(pattern)" and ":name" segments, as Vercel matches rewrite sources.
const sourceRegex = source => new RegExp('^'+source.replace(/:([a-z]+)(?:\(([^)]+)\))?/gi, (_, name, pattern) => `(${pattern || '[^/#?]+?'})`)+'$', 'i');

test('vercel.json rewrites only /jobs/<digits>-… to the job-page function, never landing pages', async () => {
  const jobRewrites = (vercel.rewrites || []).filter(r => r.destination.startsWith('/api/job-page'));
  assert.equal(jobRewrites.length, 1);
  assert.equal(vercel.rewrites.length, 1, 'no other rewrites can shadow static files');
  const {source, destination} = jobRewrites[0];
  assert.equal(destination, '/api/job-page?job_id=:id&job_slug=:slug');
  const pattern = sourceRegex(source);
  const yes = ['/jobs/123-backend-engineer-acme', '/jobs/6653924-product-engineer-new-products-nango', '/jobs/1-role'];
  const no = ['/jobs', '/jobs/123', '/jobs/123-', '/jobs/123-a/b', '/jobs/abc-123', '/jobs/x123-a', '/companies/123-a', '/jobs/', ...landingPages.map(p => '/jobs/'+p.slug)];
  for(const url of yes) { assert.match(url, pattern, url); assert.match(url, JOB_ROUTE, url); }
  for(const url of no) { assert.doesNotMatch(url, pattern, url); assert.doesNotMatch(url, JOB_ROUTE, url); }
  await fs.access(path.resolve('..', 'api', 'job-page.mjs'));
});

test('The function keeps the site security headers and bundles the files it reads', async () => {
  const all = vercel.headers.find(h => h.source === '/(.*)').headers;
  assert.deepEqual(Object.fromEntries(all.map(h => [h.key, h.value])), SECURITY_HEADERS);
  const config = vercel.functions['api/job-page.mjs'];
  assert.ok(config.maxDuration <= 30);
  for(const part of ['css/*.css', 'data/companies.json', 'data/exchange-rate.json']) assert.ok(config.includeFiles.includes(part), part);
  const assets = await loadAssets();
  assert.ok(assets.companies.length > 900 && assets.companies.every(c => c.id && c.name));
  assert.ok(assets.fx.rate > 0);
  assert.match(await assets.read('styles'), /\S/);
  assert.equal(typeof jobPageFunction.fetch, 'function');
});

test('The /jobs dialog links quietly to the job page when the role has one', async () => {
  const source = await fs.readFile('js/jobs.js', 'utf8');
  assert.match(source, /\$\{url\?`<a class="job-page-link" href="\$\{e\(jobPath\(j\)\)\}">Open job page<\/a>`:''\}/);
  const css = await fs.readFile('css/premium.css', 'utf8');
  assert.match(css, /\.job-detail-actions>a\.job-page-link\{background:none!important/);
});
