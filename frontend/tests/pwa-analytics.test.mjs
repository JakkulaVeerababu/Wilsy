import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {EVENTS,filterSummary,eventData,jobMode,pageKind,APPLY_LINKS,track} from '../js/analytics.js';
import {routeFor,pageBuild,shellAssets} from '../scripts/service-worker.mjs';
import {searchConsoleTag} from '../scripts/search-console.mjs';
import {renderJobCard} from '../js/job-card.js';

const root = path.resolve('dist');
const read = file => fs.readFile(path.join(root, file), 'utf8');

test('Analytics events carry only short, normalised values', () => {
  assert.equal(filterSummary({}), 'none');
  assert.equal(filterSummary({q:'jane@example.com', role:'backend', stage:'fresher', country:'India', mode:'remote', company:'Acme'}), 'role:backend,stage:fresher,country:india,mode:remote');
  assert.equal(filterSummary({role:'Jane Doe', country:'jane@example.com'}), 'role:other,country:other');
  assert.equal(filterSummary({country:'United States'}), 'country:united-states');
  assert.deepEqual(eventData({page:'jobs', filters:'none', extra:'dropped'}), {page:'jobs', filters:'none'}, 'Vercel Pro records 2 properties');
  assert.deepEqual(eventData({nested:{a:1}, list:[1], ok:true}), {ok:true});
  assert.equal(eventData({long:'x'.repeat(500)}).long.length, 120);
  assert.equal(jobMode({work_mode:'hybrid'}), 'hybrid');
  assert.equal(jobMode({work_mode:'mars'}), 'unknown');
  assert.equal(jobMode(undefined), 'unknown');
  for(const [url, kind] of [['/', 'home'], ['/jobs', 'jobs'], ['/jobs/123-backend-acme', 'job'], ['/jobs/remote-jobs', 'landing'], ['/companies/stripe', 'company'], ['/guides', 'other']]) assert.equal(pageKind(url), kind);
});

test('track() sends known events to Vercel, queues them across a page load, and is a no-op elsewhere', () => {
  track('search', {page:'jobs'}); // no window.va in Node: nothing happens, nothing throws
  const calls = [], store = new Map();
  globalThis.window = {va: (...args) => calls.push(args)};
  globalThis.sessionStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)};
  try {
    track('not_an_event', {a:'b'});
    track('apply_click', {from:'card', page:'jobs', extra:'x'});
    assert.deepEqual(calls, [['event', {name:'apply_click', data:{from:'card', page:'jobs'}}]]);
    track('search', {page:'home', filters:'country:india'}, {beforeNavigate:true});
    assert.equal(calls.length, 1, 'queued, not sent, before the page unloads');
    assert.deepEqual(JSON.parse(store.get('wilsy-pending-events')), [{name:'search', data:{page:'home', filters:'country:india'}}]);
  } finally { delete globalThis.window; delete globalThis.sessionStorage; }
});

test('Every event is documented, and apply clicks are detected on every apply link the site renders', async () => {
  const docs = await fs.readFile('../docs/analytics-events.md', 'utf8');
  for(const name of EVENTS) assert.match(docs, new RegExp('`' + name + '`'), `${name} is documented`);
  const card = renderJobCard({id:1, title:'Engineer', company:'Acme', apply_url:'https://jobs.example.com/1'}, {});
  assert.match(card, /class="job-result-card"[\s\S]*class="job-apply-link" href="https:/);
  const jobsJs = await fs.readFile('js/jobs.js', 'utf8'), jobPages = await fs.readFile('scripts/job-pages.mjs', 'utf8');
  assert.match(jobsJs, /class="job-detail-actions"><a href="\$\{e\(url\)\}" target="_blank"/);
  assert.match(jobsJs, /compare-table[\s\S]*target="_blank" rel="noopener noreferrer" aria-label="Apply for/);
  assert.match(jobPages, /class="job-page-actions"><a class="primary-button" href="\$\{e\(url\)\}" target="_blank"/);
  assert.deepEqual(APPLY_LINKS.map(([, from]) => from), ['card', 'dialog', 'job_page', 'compare']);
});

test('The Search Console tag comes only from WILSY_GSC_TOKEN', async () => {
  assert.equal(searchConsoleTag(''), '');
  assert.equal(searchConsoleTag(undefined), '');
  const tag = '<meta name="google-site-verification" content="abcDEF123_-abcDEF123_-abc">';
  assert.equal(searchConsoleTag(' abcDEF123_-abcDEF123_-abc '), tag);
  assert.equal(searchConsoleTag(tag), tag, 'the whole pasted tag works too');
  const warnings = [];
  assert.equal(searchConsoleTag('"><script>alert(1)</script>', w => warnings.push(w)), '');
  assert.equal(warnings.length, 1);
  if(!process.env.WILSY_GSC_TOKEN) for(const file of ['index.html', 'jobs.html', 'companies.html']) assert.doesNotMatch(await read(file), /google-site-verification/);
});

test('The service worker leaves Supabase, Vercel, APIs and third parties to the network', () => {
  const origin = 'https://www.wilsy.in', route = (url, request = {}) => routeFor(new URL(url, origin), {method:'GET', mode:'cors', ...request}, origin);
  assert.equal(route('/jobs?source=pwa', {mode:'navigate'}), 'page');
  assert.equal(route('/companies/stripe', {mode:'navigate'}), 'page');
  for(const asset of ['/css/b-0123456789ab.css', '/js/jobs.js', '/assets/fonts/manrope.woff2', '/dsa/app.js']) assert.equal(route(asset), 'asset', asset);
  for(const url of ['https://abc.supabase.co/rest/v1/rpc/wilsy_search_jobs', 'https://abc.supabase.co/auth/v1/token', '/_vercel/insights/script.js', '/_vercel/insights/view', '/api/alerts', '/sw.js',
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', 'https://fonts.gstatic.com/x.woff2', '/data/company-index.json', '/assets/logos/stripe.png']) assert.equal(route(url), '', url);
  assert.equal(route('/jobs', {method:'POST', mode:'navigate'}), '');
  assert.equal(pageBuild('<head><meta charset="utf-8"><meta name="wilsy-build" content="0123456789ab">'), '0123456789ab');
  assert.equal(pageBuild('<head>'), '');
});

test('The app shell follows a page\'s styles, scripts, module imports and fonts', async () => {
  const files = {'/js/a.js':"import {b} from './b.js';\nimport './c.js';\nexport {d} from \"./d.js\";", '/js/b.js':'export const b=1;', '/js/c.js':'', '/js/d.js':'const s=\'import x from "./nope.js"\';',
    '/css/b-1.css':'@font-face{src:url(/assets/fonts/x.woff2)}'};
  const html = '<link rel="stylesheet" href="/css/b-1.css"><script type="module" src="/js/a.js"></script><script defer src="/_vercel/insights/script.js"></script><script src="https://pagead2.example/x.js"></script>';
  assert.deepEqual(await shellAssets([html], url => files[url] === undefined ? Promise.reject(new Error(url)) : Promise.resolve(files[url])),
    ['/assets/fonts/x.woff2', '/css/b-1.css', '/js/a.js', '/js/b.js', '/js/c.js', '/js/d.js']);
});

test('The built service worker precaches this build\'s app shell and serves the offline page', async () => {
  const code = await read('sw.js');
  const listeners = {}, opened = new Map();
  const cache = name => opened.get(name) || opened.set(name, {added:[], addAll: async list => { opened.get(name).added.push(...list); }, put: async () => {}, keys: async () => [], delete: async () => true}).get(name);
  const context = {URL, TextDecoder, Response: {error: () => 'network-error'}, fetch: () => Promise.reject(new Error('offline')),
    caches: {open: async name => cache(name), keys: async () => [...opened.keys(), 'wilsy-shell-old'], delete: async () => true, match: async url => url === '/offline' ? 'offline-page' : undefined},
    self: {addEventListener: (type, fn) => { listeners[type] = fn; }, location: {origin: 'https://www.wilsy.in'}, skipWaiting: async () => {}, registration: {}, clients: {claim: async () => {}}}};
  vm.runInNewContext(code, context, {filename: 'sw.js'});
  let installing; listeners.install({waitUntil: p => { installing = p; }}); await installing;
  const [shellName, shell] = [...opened].find(([name]) => name.startsWith('wilsy-shell-'));
  const version = shellName.slice('wilsy-shell-'.length);
  for(const required of ['/offline', '/jobs', '/js/pwa.js', '/js/jobs.js', '/js/analytics.js', '/js/site.js', '/assets/fonts/fonts.css']) assert.ok(shell.added.includes(required), required);
  for(const url of shell.added) {
    assert.match(url, /^\/(?!\/)/, `${url} is same-origin`);
    const file = url === '/offline' || url === '/jobs' ? url.slice(1) + '.html' : url.slice(1);
    await fs.access(path.join(root, file));
  }
  // Every page names the same build, so the worker can tell old pages from new ones.
  for(const file of ['index.html', 'jobs.html', 'offline.html', 'companies.html', 'about.html', path.join('companies', 'stripe.html')]) assert.equal(pageBuild(await read(file)), version, file);
  // Offline navigation falls back to the offline page; Supabase calls are never intercepted.
  let response; listeners.fetch({request: {url: 'https://www.wilsy.in/guides', method: 'GET', mode: 'navigate'}, preloadResponse: Promise.resolve(undefined), respondWith: p => { response = p; }, waitUntil: () => {}});
  assert.equal(await response, 'offline-page');
  let intercepted = false; listeners.fetch({request: {url: 'https://abc.supabase.co/rest/v1/rpc/wilsy_search_jobs', method: 'POST', mode: 'cors'}, respondWith: () => { intercepted = true; }});
  assert.equal(intercepted, false);
});

test('The manifest, icons and pages make WILSY installable', async () => {
  const manifest = JSON.parse(await read('assets/site.webmanifest'));
  assert.equal(manifest.name, 'WILSY'); assert.equal(manifest.short_name, 'WILSY');
  assert.equal(manifest.start_url, '/jobs?source=pwa'); assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0866ff'); assert.equal(manifest.scope, '/');
  const png = async src => { const b = await fs.readFile(path.join(root, src)); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };
  for(const [sizes, purpose] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const icon = manifest.icons.find(i => i.sizes === sizes && i.purpose === purpose);
    assert.ok(icon, `${sizes} ${purpose} icon`); assert.equal(await png(icon.src), sizes, icon.src);
  }
  for(const file of ['index.html', 'jobs.html', 'companies.html', 'offline.html', '404.html']) {
    const html = await read(file);
    assert.match(html, /<link rel="manifest" href="\/assets\/site.webmanifest">/, file);
    assert.match(html, /<script type="module" src="\/js\/pwa.js"><\/script>/, file);
  }
  const offline = await read('offline.html');
  assert.match(offline, /noindex/); assert.match(offline, /data-retry-page/);
  assert.doesNotMatch(await read('sitemap.xml'), /\/offline</);
  // Installing is offered only after the browser's own signal; no banner is built into pages.
  const pwa = await fs.readFile('js/pwa.js', 'utf8');
  assert.match(pwa, /addEventListener\('beforeinstallprompt'/);
  assert.doesNotMatch(await read('jobs.html'), /data-install-app/);
});
