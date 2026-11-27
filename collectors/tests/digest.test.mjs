import test from 'node:test';
import assert from 'node:assert/strict';
import {runDigest, renderDigest, isDue, digestKey, SECTIONS, FROM} from '../digest.mjs';
import {unsubscribeUrl, unsubscribeToken, createUnsubscribeHandlers, UNSUBSCRIBE_PATH} from '../../frontend/scripts/unsubscribe-handler.mjs';

const NOW = new Date('2026-11-28T04:30:00Z');
const USER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const job = (id, hoursAgo) => ({id, title: `Role ${id}`, company: 'Acme', location: 'Bengaluru', first_seen_at: new Date(NOW - hoursAgo * 3600e3).toISOString()});
const confirmed = {email: 'a@example.com', email_confirmed_at: '2026-11-01T00:00:00Z'};

test('a person is due once a week', () => {
  assert.equal(isDue({last_digest_at: null}, NOW), true);
  assert.equal(isDue({last_digest_at: '2026-11-21T04:30:00Z'}, NOW), true);
  assert.equal(isDue({last_digest_at: '2026-11-25T04:30:00Z'}, NOW), false);
  assert.notEqual(digestKey(USER, null), digestKey(USER, '2026-11-21T04:30:00Z'));
});

function fakes({rows, jobs = [job(1, 5), job(2, 30), job(3, 24 * 9)]}) {
  const sent = [], marked = [];
  return {sent, marked, args: {now: NOW, fx: {}, log: () => {}, loadSubscribers: async () => rows, getUser: async () => confirmed,
    search: async () => ({jobs}), send: async m => { sent.push(m); return {id: 'x'}; }, mark: async (id, at) => { marked.push([id, at]); },
    unsubscribeFor: id => unsubscribeUrl(id, 'secret', 'https://www.wilsy.in', 'weekly')}};
}

test('dry run sends and writes nothing', async () => {
  const f = fakes({rows: [{user_id: USER, last_digest_at: null}]});
  const report = await runDigest(f.args);
  assert.equal(report.emails, 1);
  assert.equal(f.sent.length + f.marked.length, 0);
});

test('live run sends only last week’s roles, from the weekly sender, and records the send', async () => {
  const f = fakes({rows: [{user_id: USER, last_digest_at: null}, {user_id: '1f8fad5b-d9cb-469f-a165-70867728950e', last_digest_at: '2026-11-26T00:00:00Z'}]});
  const report = await runDigest({...f.args, live: true});
  assert.equal(report.subscribers, 2);
  assert.equal(report.due, 1);
  assert.equal(f.sent.length, 1);
  const m = f.sent[0];
  assert.equal(m.from, FROM);
  assert.equal(m.category, 'weekly_email');
  assert.ok(m.html.includes('Role 1') && m.html.includes('Role 2') && !m.html.includes('Role 3'));
  assert.match(m.unsubscribe, /&k=weekly$/);
  assert.ok(m.html.includes('Unsubscribe from the weekly email'));
  assert.deepEqual(f.marked, [[USER, NOW]]);
});

test('nothing new this week means no email', async () => {
  const f = fakes({rows: [{user_id: USER, last_digest_at: null}], jobs: [job(3, 24 * 9)]});
  const report = await runDigest({...f.args, live: true});
  assert.equal(report.nothingNew, true);
  assert.equal(f.sent.length, 0);
});

test('the email has the logo, both sections and escaped text', () => {
  const sections = SECTIONS.map(s => ({...s, jobs: [{...job(7, 2), title: 'Intern <b>x</b>'}], count: 1, more: false}));
  const {subject, html, text} = renderDigest(sections, {fx: {}, now: NOW});
  assert.match(subject, /^This week on WILSY: 2 new/);
  assert.ok(html.includes('/assets/icon-192.png'));
  assert.ok(html.includes('Intern &lt;b&gt;x&lt;/b&gt;'));
  assert.ok(text.includes('Internships in India') && text.includes('Fresher jobs in India'));
  assert.ok(!html.includes('Unsubscribe from the weekly email'));
});

test('a weekly unsubscribe link turns off only the weekly email, and an alerts token can’t be reused for it', async () => {
  const calls = [];
  const h = createUnsubscribeHandlers({env: {WILSY_UNSUBSCRIBE_SECRET: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://db.example.supabase.co'},
    fetcher: async (url, init) => { calls.push({url, init}); return new Response(null, {status: 204}); }});
  const weekly = unsubscribeUrl(USER, 'secret', 'https://www.wilsy.in', 'weekly');
  assert.match(await (await h.get(new Request(weekly))).text(), /Stop the weekly WILSY email\?/);
  assert.equal((await h.post(new Request(weekly, {method: 'POST'}))).status, 200);
  assert.equal(calls[0].url, `https://db.example.supabase.co/rest/v1/user_email_prefs?user_id=eq.${USER}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {weekly_digest: false});
  const crossed = `https://www.wilsy.in${UNSUBSCRIBE_PATH}?u=${USER}&t=${unsubscribeToken(USER, 'secret', 'alerts')}&k=weekly`;
  assert.equal((await h.post(new Request(crossed, {method: 'POST'}))).status, 400);
  assert.equal(calls.length, 1);
});
