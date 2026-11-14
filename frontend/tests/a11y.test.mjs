import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {auditPage,rootTokens,hexToRgb,contrast} from './a11y-audit.mjs';

// Automated accessibility checks over every built page (run `npm run build` first).
// mathematical-sciences/ holds a temporary standalone page outside the WILSY shell, so it is excluded.
const root = path.resolve('dist');
const files = (await fs.readdir(root, {recursive: true})).filter(f => f.endsWith('.html') && !f.startsWith('mathematical-sciences'));
const pages = await Promise.all(files.map(async file => ({file, html: await fs.readFile(path.join(root, file), 'utf8')})));

test('The accessibility audit catches the problems it is meant to catch', () => {
  const bad = auditPage('<!doctype html><html><body><img src="a.png"><input id="q"><button></button><a href="/x"><svg aria-hidden="true"></svg></a><div id="d" tabindex="2"></div><p id="d"></p></body></html>');
  for(const expected of ['no valid lang','img without alt','unlabelled form control','no accessible name: <button>','no accessible name: <a href="/x">','positive tabindex','duplicate id "d"']) assert.ok(bad.some(p => p.includes(expected)), expected);
  const good = auditPage('<html lang="en"><body><img src="a.png" alt=""><label for="q">Search</label><input id="q"><label>Mode <select name="m"></select></label><button aria-label="Close"><svg aria-hidden="true"></svg></button><a href="/"><img src="l.png" alt="WILSY home"></a><input type="hidden" name="t"><script>if(a<b){}</script></body></html>');
  assert.deepEqual(good, []);
});

test('Every built page passes the automated accessibility checks', () => {
  assert.ok(pages.length > 1000, 'expected the full build');
  const failures = [];
  for(const {file, html} of pages) for(const problem of new Set(auditPage(html))) failures.push(`${file}: ${problem}`);
  assert.deepEqual(failures.slice(0, 40), [], `${failures.length} problems`);
});

// Colour contrast of the design tokens: body and secondary text on every page surface,
// in light and dark themes, from each page's real CSS bundle (WCAG AA, 4.5:1).
const TEXT = ['--ink', '--text', '--ink-soft', '--text-secondary', '--muted'];
const SURFACES = ['--paper', '--surface', '--surface-raised', '--surface-subtle'];
test('Text colour tokens meet WCAG AA (4.5:1) on every surface, light and dark', async () => {
  const bundles = new Set(pages.flatMap(({html}) => [...html.matchAll(/href="\/css\/(b-[0-9a-f]{12}\.css)"/g)].map(m => m[1])));
  assert.ok(bundles.size > 0);
  const failures = [];
  for(const bundle of bundles) {
    const css = await fs.readFile(path.join(root, 'css', bundle), 'utf8');
    for(const dark of [false, true]) {
      const token = rootTokens(css, dark);
      for(const text of TEXT) for(const surface of SURFACES) {
        const fg = token(text), bg = token(surface);
        if(!fg || !bg) continue;
        const [a, b] = [hexToRgb(fg), hexToRgb(bg)];
        assert.ok(a && b, `${bundle}: cannot read ${text} (${fg}) or ${surface} (${bg})`);
        const ratio = contrast(a, b);
        if(ratio < 4.5) failures.push(`${bundle} ${dark ? 'dark' : 'light'}: ${text} ${fg} on ${surface} ${bg} = ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
