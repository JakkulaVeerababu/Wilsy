import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {logoSize, logoOpaque} from '../scripts/logo-size.mjs';
import {logoStrip, MARQUEE_MIN} from '../scripts/home-page.mjs';

const {companies} = JSON.parse(await fs.readFile('data/companies.json', 'utf8'));
const featured = ['Stripe', 'Deepgram', 'OpenAI'].map(name => ({name, slug: name.toLowerCase()}));
const rows = html => [...html.matchAll(/<ul class="home-logo-row"[^>]*>[\s\S]*?<\/ul>/g)].map(m => m[0]);
const hrefs = row => [...row.matchAll(/href="([^"]+)"/g)].map(m => m[1]);

test('Logo sizes come from PNG headers and SVG viewBoxes, and unknown files give null', async () => {
  assert.deepEqual(logoSize('assets/logos/stripe.svg'), {width: 512, height: 214});
  assert.deepEqual(logoSize('assets/logos/deepgram.png'), {width: 150, height: 142});
  assert.equal(logoSize('assets/logos/no-such-company.svg'), null);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wilsy-logo-'));
  await fs.writeFile(path.join(dir, 'plain.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
  assert.equal(logoSize('plain.svg', dir), null);
  await fs.rm(dir, {recursive: true, force: true});
});

test('The logo strip loops a real row between two hidden, unfocusable copies', () => {
  const html = logoStrip(featured, companies);
  assert.match(html, /^<div class="home-logo-marquee" data-logo-marquee style="--logo-count:\d+">/);
  const [before, real, after] = rows(html);
  assert.equal(rows(html).length, 3);
  for(const copy of [before, after]) {
    assert.match(copy, /^<ul class="home-logo-row" role="list" aria-hidden="true">/);
    assert.equal((copy.match(/<a /g) || []).length, (copy.match(/tabindex="-1"/g) || []).length, 'every link in a copy leaves the tab order');
  }
  assert.doesNotMatch(real, /aria-hidden|tabindex/);
  assert.deepEqual(hrefs(before), hrefs(real));
  assert.deepEqual(hrefs(after), hrefs(real));
  // Featured hiring companies lead, and no company repeats within the row.
  assert.deepEqual(hrefs(real).slice(0, 3), ['/companies/stripe', '/companies/deepgram', '/companies/openai']);
  assert.equal(new Set(hrefs(real)).size, hrefs(real).length);
  // The pause button is in the markup but shown only by home.js, and it comes before the logos.
  assert.match(html, /<button class="home-logo-toggle" type="button" aria-label="Pause the logo animation"[^>]* hidden>/);
  assert.ok(html.indexOf('home-logo-toggle') < html.indexOf('home-logo-viewport'));
});

test('Wide wordmarks keep their shape and stand in for the name; square marks sit beside it', () => {
  const real = rows(logoStrip(featured, companies))[1];
  const item = id => real.match(new RegExp(`<a class="([^"]+)" href="/companies/${id}"><img [^>]*width="(\\d+)" height="(\\d+)"[^>]*><span([^>]*)>([^<]+)</span>`));
  for(const [id, width] of [['stripe', 57], ['nvidia', 125], ['amazon', 72]]) {
    const [, cls, w, h, span, name] = item(id);
    assert.equal(cls, 'home-logo home-logo-wordmark', id);
    assert.deepEqual([Number(w), Number(h)], [width, 24], id);
    assert.equal(span, ' class="sr-only"', `${id} keeps its name for screen readers`);
    assert.ok(name.length > 2);
  }
  for(const id of ['openai', 'google', 'anthropic']) {
    const [, cls, w, h, span] = item(id);
    assert.equal(cls, 'home-logo', id);
    assert.deepEqual([w, h, span], ['28', '28', ''], id);
  }
});

test('With too few logos the strip is a still row with no copies or pause button', () => {
  const few = companies.filter(c => ['google', 'apple', 'figma'].includes(c.id));
  assert.ok(few.length < MARQUEE_MIN);
  const html = logoStrip([], few);
  assert.match(html, /^<div class="home-logo-marquee is-static">/);
  assert.equal(rows(html).length, 1);
  assert.doesNotMatch(html, /aria-hidden|tabindex|home-logo-toggle|data-logo-marquee/);
});

test('The loop moves one row per cycle, pauses on request, and stays still for reduced motion', async () => {
  const css = (await fs.readFile('css/homepage.css', 'utf8')).replace(/\s+/g, ' ');
  assert.match(css, /@keyframes wilsy-logo-drift\{to\{transform:translate3d\(calc\(-100% \/ 3\),0,0\)\}\}/);
  assert.match(css, /\.home-logo-marquee:is\(\.is-paused,\.is-offscreen\) \.home-logo-track,\.home-logo-marquee:not\(\.is-live\) \.home-logo-track\{animation-play-state:paused\}/);
  assert.match(css, /\.home-logo-track:has\(:focus-visible\)\{animation-play-state:paused\}/);
  const reduced = css.match(/@media\(prefers-reduced-motion:reduce\)\{ ?(\.home-logo-viewport[\s\S]*?\})\s*\}/)?.[1] || '';
  assert.match(reduced, /\.home-logo-track\{[^}]*animation:none/);
  assert.match(reduced, /\.home-logo-row\[aria-hidden\]\{display:none\}/);
  assert.match(reduced, /\.home-logo-toggle\{display:none\}/);
});

test('Logos with a solid background sit on a tile and are never inverted for the dark theme', () => {
  assert.equal(logoOpaque('assets/logos/deepgram.png'), true);
  assert.equal(logoOpaque('assets/logos/amazon.png'), false, 'palette PNG with transparency');
  assert.equal(logoOpaque('assets/logos/stripe.svg'), false);
  const real = rows(logoStrip(featured, companies))[1];
  assert.match(real, /<a class="home-logo home-logo-tile" href="\/companies\/deepgram">/);
  assert.match(real, /<a class="home-logo" href="\/companies\/openai">/);
});
