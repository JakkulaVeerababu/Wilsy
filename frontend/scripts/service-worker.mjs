// Builds /sw.js: an offline page, network-first pages and stale-while-revalidate styles,
// scripts and fonts. Its caches are named after the build, so each deploy starts clean.
// Only same-origin GET requests are handled; Supabase, /_vercel/, /api/ and every
// third-party script go straight to the network and are never cached.

// What the worker does with a request: 'page', 'asset' or '' (leave it to the network).
export function routeFor(url, request, origin) {
  if(request.method !== 'GET' || url.origin !== origin) return '';
  if(/^\/(?:_vercel|api)\//.test(url.pathname) || url.pathname === '/sw.js') return '';
  if(request.mode === 'navigate') return 'page';
  if(/\.(?:css|js|woff2)$/.test(url.pathname)) return 'asset';
  return '';
}

// The build id a page was made with (<meta name="wilsy-build">, early in <head>).
export function pageBuild(html) {
  return (/<meta name="wilsy-build" content="([0-9a-f]{6,64})">/.exec(html) || [])[1] || '';
}

// Every same-origin stylesheet, script and font a page needs, following module imports.
export async function shellAssets(pages, read) {
  const found = new Set(), queue = [];
  const add = url => { if(/^\/(?!\/)[^"'?#\s]+\.(?:css|js|woff2)$/.test(url) && !url.startsWith('/_vercel/') && !found.has(url)) { found.add(url); queue.push(url); } };
  for(const html of pages) for(const [, url] of html.matchAll(/<(?:link|script)\b[^>]*?(?:href|src)="([^"]+)"/g)) add(url);
  while(queue.length) {
    const url = queue.shift();
    if(url.endsWith('.woff2')) continue;
    const text = await read(url).catch(() => '');
    if(url.endsWith('.js')) for(const m of text.matchAll(/(?:^|[;\s])(?:import|export)\b[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|[;\s])import\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) add(new URL(m[1] || m[2], 'https://x' + url).pathname);
    if(url.endsWith('.css')) for(const [, ref] of text.matchAll(/url\((\/[^)'"]+)\)/g)) add(ref);
  }
  return [...found].sort();
}

/* global self, caches, fetch, Response, URL */
function worker(VERSION, PRECACHE, routeFor, pageBuild) {
  const SHELL = 'wilsy-shell-' + VERSION, PAGES = 'wilsy-pages-' + VERSION, ASSETS = 'wilsy-assets-' + VERSION;
  const OFFLINE = '/offline', MAX_PAGES = 40;
  // clientId -> promise of the build id of the page that client loaded.
  const builds = new Map();

  self.addEventListener('install', event => {
    event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
  });
  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      for(const name of await caches.keys()) if(name.startsWith('wilsy-') && ![SHELL, PAGES, ASSETS].includes(name)) await caches.delete(name);
      if(self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })());
  });
  self.addEventListener('fetch', event => {
    const url = new URL(event.request.url), route = routeFor(url, event.request, self.location.origin);
    if(route === 'page') event.respondWith(page(event, url));
    else if(route === 'asset') event.respondWith(asset(event));
  });

  // Reads only the start of the page, where the build id is, then lets go of the stream.
  async function readBuild(response) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = '';
    try {
      while(text.length < 8192) { const {done, value} = await reader.read(); if(done) break; text += decoder.decode(value, {stream: true}); if(pageBuild(text)) break; }
    } finally { reader.cancel().catch(() => {}); }
    return pageBuild(text);
  }
  async function trim(cache) {
    const keys = await cache.keys();
    for(const key of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(key);
  }
  // Network first; offline, the last copy of this page, then the offline page.
  async function page(event, url) {
    const key = url.origin + url.pathname;
    try {
      const response = (await event.preloadResponse) || await fetch(event.request);
      if(response.ok && response.type === 'basic' && /text\/html/.test(response.headers.get('content-type') || '')) {
        if(event.resultingClientId) {
          builds.set(event.resultingClientId, readBuild(response.clone()).catch(() => ''));
          while(builds.size > 50) builds.delete(builds.keys().next().value);
        }
        const copy = response.clone();
        event.waitUntil(caches.open(PAGES).then(cache => cache.put(key, copy)).then(() => caches.open(PAGES)).then(trim).catch(() => {}));
      }
      return response;
    } catch {
      return (await caches.match(key, {ignoreSearch: true})) || (await caches.match(OFFLINE)) || Response.error();
    }
  }
  // Stale-while-revalidate. A page from a newer deploy than this worker gets fresh files
  // from the network instead, so new HTML never runs with old scripts.
  async function asset(event) {
    const build = await (builds.get(event.clientId) || '');
    const current = !build || build === VERSION;
    const cached = current ? await caches.match(event.request) : undefined;
    const network = fetch(event.request).then(response => {
      if(current && response.ok && response.type === 'basic') { const copy = response.clone(); caches.open(ASSETS).then(cache => cache.put(event.request, copy)).catch(() => {}); }
      return response;
    });
    if(cached) { event.waitUntil(network.catch(() => {})); return cached; }
    return network.catch(async () => (await caches.match(event.request)) || Response.error());
  }
}

export function serviceWorker({version, precache}) {
  return `// WILSY service worker, build ${version}. Generated by scripts/service-worker.mjs.\n'use strict';\n(${worker})(${JSON.stringify(version)},${JSON.stringify(precache)},${routeFor},${pageBuild});\n`;
}
