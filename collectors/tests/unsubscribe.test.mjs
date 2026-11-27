import test from 'node:test';
import assert from 'node:assert/strict';
import {unsubscribeToken, unsubscribeUrl, validToken, createUnsubscribeHandlers, UNSUBSCRIBE_PATH} from '../../frontend/scripts/unsubscribe-handler.mjs';
import {renderEmail, unsubscribeHeaders, createResendSender, runAlerts, MANAGE_URL} from '../alerts.mjs';

const SECRET = 'test-secret-not-real';
const USER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const env = {WILSY_UNSUBSCRIBE_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_URL: 'https://db.example.supabase.co'};

test('tokens are stable per user and secret, and checked in constant time', () => {
  const token = unsubscribeToken(USER, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(unsubscribeToken(USER, SECRET), token);
  assert.notEqual(unsubscribeToken(USER, 'other-secret'), token);
  assert.notEqual(unsubscribeToken('1f8fad5b-d9cb-469f-a165-70867728950e', SECRET), token);
  assert.equal(validToken(USER, token, SECRET), true);
  assert.equal(validToken(USER, token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A'), SECRET), false);
  assert.equal(validToken('not-a-uuid', token, SECRET), false);
  assert.equal(validToken(USER, token, ''), false);
  assert.equal(validToken(USER, undefined, SECRET), false);
  const url = new URL(unsubscribeUrl(USER, SECRET, 'https://www.wilsy.in'));
  assert.equal(url.pathname, UNSUBSCRIBE_PATH);
  assert.equal(url.searchParams.get('u'), USER);
  assert.equal(url.searchParams.get('t'), token);
});

function harness(status = 204) {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({url, init}); return new Response(null, {status}); };
  return {calls, ...createUnsubscribeHandlers({env, fetcher})};
}
const link = (token = unsubscribeToken(USER, SECRET)) => `https://www.wilsy.in${UNSUBSCRIBE_PATH}?u=${USER}&t=${token}`;

test('GET only shows a confirm button and changes nothing (mail scanners open links)', async () => {
  const h = harness();
  const response = await h.get(new Request(link()));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<form method="post"/);
  assert.match(html, /Stop all job alerts/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal(h.calls.length, 0);
});

test('POST with a valid token turns off every alert of that person only', async () => {
  const h = harness();
  const response = await h.post(new Request(link(), {method: 'POST', body: 'List-Unsubscribe=One-Click'}));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /You’re unsubscribed/);
  assert.equal(h.calls.length, 1);
  const {url, init} = h.calls[0];
  assert.equal(url, `https://db.example.supabase.co/rest/v1/user_saved_searches?user_id=eq.${USER}&alert=neq.off`);
  assert.equal(init.method, 'PATCH');
  assert.deepEqual(JSON.parse(init.body), {alert: 'off'});
  assert.equal(init.headers.Authorization, 'Bearer service-key');
});

test('a wrong or missing token is refused and writes nothing', async () => {
  const h = harness();
  for (const request of [new Request(link('A'.repeat(32)), {method: 'POST'}), new Request(`https://www.wilsy.in${UNSUBSCRIBE_PATH}?u=${USER}`, {method: 'POST'}),
    new Request(`https://www.wilsy.in${UNSUBSCRIBE_PATH}?u=x&t=${unsubscribeToken(USER, SECRET)}`, {method: 'POST'})]) {
    assert.equal((await h.post(request)).status, 400);
  }
  assert.equal((await h.get(new Request(link('A'.repeat(32))))).status, 400);
  assert.equal(h.calls.length, 0);
});

test('without the secret or service key, or on a database error, it says try later', async () => {
  const missing = createUnsubscribeHandlers({env: {SUPABASE_SERVICE_ROLE_KEY: 'k'}, fetcher: async () => { throw new Error('must not call'); }});
  assert.equal((await missing.post(new Request(link(), {method: 'POST'}))).status, 503);
  assert.equal((await missing.get(new Request(link()))).status, 503);
  const failing = harness(500);
  assert.equal((await failing.post(new Request(link(), {method: 'POST'}))).status, 503);
});

const section = {query: 'stage=internship', alert: 'daily', since: new Date('2026-11-26T00:00:00Z'), count: 1, more: false,
  jobs: [{id: 7, title: 'Data Intern', company: 'Acme', location: 'Hyderabad', first_seen_at: '2026-11-26T05:00:00Z'}]};

test('emails carry a visible unsubscribe link and one-click headers when a URL is given', () => {
  const url = unsubscribeUrl(USER, SECRET, 'https://www.wilsy.in');
  const withLink = renderEmail([section], {fx: {}, unsubscribe: url});
  assert.ok(withLink.html.includes(`Unsubscribe from all alerts</a>`));
  assert.ok(withLink.html.includes(url.replace(/&/g, '&amp;')));
  assert.ok(withLink.text.includes(`Unsubscribe from all alerts: ${url}`));
  assert.deepEqual(unsubscribeHeaders(url), {'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'});
  const without = renderEmail([section], {fx: {}});
  assert.ok(!without.html.includes('Unsubscribe from all alerts'));
  assert.deepEqual(unsubscribeHeaders(null), {'List-Unsubscribe': `<${MANAGE_URL}>`});
});

test('the sender puts the one-click headers on the Resend request', async () => {
  let sent;
  const send = createResendSender({apiKey: 're_test', sleep: async () => {}, fetcher: async (_url, init) => { sent = JSON.parse(init.body); return new Response('{"id":"e1"}', {status: 200}); }});
  const url = unsubscribeUrl(USER, SECRET, 'https://www.wilsy.in');
  await send({to: 'a@example.com', subject: 's', html: 'h', text: 't', unsubscribe: url});
  assert.equal(sent.headers['List-Unsubscribe'], `<${url}>`);
  assert.equal(sent.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('runAlerts gives each person their own unsubscribe link', async () => {
  const sends = [];
  const now = new Date('2026-11-27T12:00:00Z');
  await runAlerts({now, live: true, fx: {}, log: () => {},
    loadSearches: async () => [{user_id: USER, query: 'stage=internship', alert: 'daily', created_at: '2026-11-20T00:00:00Z', last_alerted_at: '2026-11-26T03:30:00Z'}],
    getUser: async () => ({email: 'a@example.com', email_confirmed_at: '2026-11-01T00:00:00Z'}),
    search: async () => ({jobs: [{id: 9, title: 'Intern', company: 'Acme', first_seen_at: '2026-11-27T06:00:00Z'}]}),
    send: async message => { sends.push(message); return {id: 'x'}; }, mark: async () => {},
    unsubscribeFor: id => unsubscribeUrl(id, SECRET, 'https://www.wilsy.in')});
  assert.equal(sends.length, 1);
  assert.equal(sends[0].unsubscribe, unsubscribeUrl(USER, SECRET, 'https://www.wilsy.in'));
  assert.ok(sends[0].html.includes('Unsubscribe from all alerts'));
});
