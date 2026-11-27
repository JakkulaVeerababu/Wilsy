import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {historyNote, LONG_OPEN_DAYS} from '../js/job-history-core.js';

test('a role posted twice or more before is a warning, with the last closing date', () => {
  const note = historyNote({earlier: 3, last_closed: '2026-10-05', open_days: 12});
  assert.equal(note.level, 'warn');
  assert.equal(note.title, 'Posted again and again');
  assert.match(note.text, /listed the same role 3 times before, most recently closing on 5 Oct 2026/);
});

test('one earlier posting is a gentle note', () => {
  const note = historyNote({earlier: 1, last_closed: null, open_days: 3});
  assert.equal(note.level, 'note');
  assert.match(note.text, /same role once before\./);
});

test('a long-open listing gets a note; a fresh unique one gets nothing', () => {
  assert.equal(historyNote({earlier: 0, open_days: LONG_OPEN_DAYS}).title, `Open for ${LONG_OPEN_DAYS} days`);
  assert.equal(historyNote({earlier: 0, open_days: 20}), null);
  assert.equal(historyNote(null), null);
  assert.equal(historyNote('oops'), null);
});

test('job pages carry the note slot and its script', async () => {
  const source = await fs.readFile(new URL('../scripts/job-pages.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-job-history="\$\{e\(String\(job\.id\)\)\}" hidden/);
  assert.match(source, /<script type="module" src="\/js\/job-history\.js"><\/script>/);
  const build = await fs.readFile(new URL('../scripts/build-site.mjs', import.meta.url), 'utf8');
  assert.match(build, /'job-history-core\.js','job-history\.js'/);
});
