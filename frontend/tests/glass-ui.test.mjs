import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// The glass look: no keyboard-shortcut badges, no icon tiles or emoji, and frosted controls that stay readable.
const read = file => fs.readFile(new URL('../' + file, import.meta.url), 'utf8');

test('No keyboard-shortcut badges in the header, the search bars or quick search', async () => {
  for(const page of ['dist/index.html', 'dist/jobs.html', 'dist/tools.html', 'dist/companies.html']) {
    assert.doesNotMatch(await read(page), /<kbd/, page);
  }
  // The shortcut itself still works and is announced.
  assert.match(await read('scripts/page-shell.mjs'), /aria-keyshortcuts="Control\+K Meta\+K"/);
  const palette = await read('js/palette.js');
  assert.doesNotMatch(palette, /palette-hint|<kbd/);
  assert.match(palette, /data-palette-close>Cancel</);
});

test('Cards are text-first: no icon tiles on the tools hub or the homepage', async () => {
  const tools = await read('dist/tools.html'), home = await read('dist/index.html');
  assert.doesNotMatch(tools, /tool-card-icon/);
  assert.doesNotMatch(home, /home-route-icon|tool-card-icon/);
  assert.equal((tools.match(/class="tool-card"/g) || []).length, 25);
});

test('Glass UI: a frosted header, search and menu, with plain fallbacks', async () => {
  const css = await read('css/features.css');
  assert.match(css, /--glass-blur:saturate\(180%\) blur\(20px\)/);
  assert.match(css, /html body \.site-header\.is-scrolled,html body:not\(\.has-hero\) \.site-header\{background:var\(--glass-bar\)!important/);
  // The quick-search field shows focus as a rounded glow, not a box around the input.
  assert.match(css, /\.palette-field:focus-within\{/);
  assert.match(css, /\.palette-field input:focus-visible\{outline:0!important\}/);
  // On phones the Sign in button sits in the white menu, so its glass-on-blue look is for wide screens only.
  assert.match(css, /@media\(min-width:901px\)\{html body\.has-hero \.site-header:not\(\.is-scrolled\) \.account-toggle\{/);
  assert.match(css, /@media\(prefers-reduced-transparency:reduce\)/);
  const home = await read('css/homepage.css');
  assert.doesNotMatch(home, /clip-path:polygon|border-radius:6px!important/);
  // The logo strip's pause button shows only when a keyboard user tabs to it.
  assert.match(home, /\.home-logo-toggle:not\(:focus-visible\)\{opacity:0;pointer-events:none\}/);
});

test('Company names and taglines carry no emoji', async () => {
  const {companies} = JSON.parse(await read('data/companies.json'));
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u;
  assert.deepEqual(companies.filter(c => emoji.test(`${c.name} ${c.description}`)).map(c => c.id), []);
  assert.ok(companies.some(c => c.id === 'pump-co' && c.description === 'The Costco for cloud is here'));
});

test('A /sign-in page and sign-in buttons with the Google and GitHub logos', async () => {
  const page = await read('dist/sign-in.html');
  assert.match(page, /<div id="sign-in-app" class="signin-app">/);
  assert.match(page, /<meta name="robots" content="noindex,follow">/);
  assert.doesNotMatch(await read('dist/sitemap.xml'), /\/sign-in</);
  const js = await read('js/account.js');
  assert.match(js, /fill="#4285F4"/);
  assert.match(js, /viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor"/);
  assert.match(js, /data-provider="\$\{p\}" aria-label="Continue with \$\{OAUTH_NAMES\[p\]\}"/);
  const css = await read('css/account.css');
  assert.match(css, /\.account-oauth\.is-pair\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /html\.dark-theme \.account-brand\{/);
});

test('Homepage hero: blue glass with an italic serif line, and no grid lines or squares', async () => {
  const css = await read('css/homepage.css'), home = await read('dist/index.html');
  assert.match(css, /html body \.home-shell \.home-hero\{min-height:0;padding:168px var\(--gutter\) 260px;color:#fff;background:/);
  // The blue melts into the page colour at the bottom of the hero.
  assert.match(css, /var\(--paper\) 86%,transparent\) 84%,var\(--paper\) 100%\)\}/);
  assert.match(css, /font-family:'Instrument Serif',Georgia,'Times New Roman',serif!important;font-style:italic/);
  assert.match(css, /html body \.home-shell \.home-search input::placeholder\{color:rgba\(255,255,255,\.86\);opacity:1\}/);
  assert.doesNotMatch(css, /7px 7px|home-hero-frame|border-image:|home-stage/);
  assert.match(await read('assets/fonts/fonts.css'), /font-family: 'Instrument Serif';\s*font-style: italic;/);
  assert.match(home, /<body class="has-hero home-page">/);
  assert.doesNotMatch(home, /home-hero-frame|home-stage/);
});
