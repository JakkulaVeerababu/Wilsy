import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {createPayHandlers, validSignature, FEATURED} from '../scripts/pay-handler.mjs';
import {jobIdFrom} from '../js/feature-job.js';
import {renderJobCard} from '../js/job-card.js';

const env = {RAZORPAY_KEY_ID: 'rzp_test_abc123', RAZORPAY_KEY_SECRET: 'test_secret', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_URL: 'https://db.example'};
const post = (url, body) => new Request('http://localhost' + url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
const sign = (o, p, secret = env.RAZORPAY_KEY_SECRET) => crypto.createHmac('sha256', secret).update(`${o}|${p}`).digest('hex');

// A fake Razorpay and database: records every call and answers like the real services.
function fakeServices({job = {id: 42, title: 'SDE Intern', company: 'Acme'}, patched = [{job_id: 42, status: 'paid', mode: 'test', ends_at: '2026-12-27T00:00:00.000Z'}]} = {}) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({url, method: init.method || 'GET', headers: init.headers, body: init.body && JSON.parse(init.body)});
    if (url.startsWith('https://api.razorpay.com/v1/orders')) return Response.json({id: 'order_TEST123456', amount: FEATURED.amount});
    if (url.includes('wilsy_public_jobs')) return Response.json(job ? [job] : []);
    if (url.includes('featured_job_orders') && init.method === 'POST') return new Response(null, {status: 201});
    if (url.includes('featured_job_orders') && init.method === 'PATCH') return Response.json(patched);
    if (url.includes('featured_job_orders')) return Response.json(patched);
    return new Response('not found', {status: 404});
  };
  return {calls, fetcher};
}

test('Razorpay signatures are checked with HMAC-SHA256 of order_id|payment_id', () => {
  assert.equal(validSignature('order_A', 'pay_B', sign('order_A', 'pay_B'), env.RAZORPAY_KEY_SECRET), true);
  assert.equal(validSignature('order_A', 'pay_C', sign('order_A', 'pay_B'), env.RAZORPAY_KEY_SECRET), false);
  assert.equal(validSignature('order_A', 'pay_B', sign('order_A', 'pay_B', 'other'), env.RAZORPAY_KEY_SECRET), false);
  assert.equal(validSignature('order_A', 'pay_B', 'short', env.RAZORPAY_KEY_SECRET), false);
  assert.equal(validSignature('order_A', 'pay_B', undefined, env.RAZORPAY_KEY_SECRET), false);
});

test('Creating an order checks the job, charges ₹999 and records a test-mode order', async () => {
  const {calls, fetcher} = fakeServices();
  const {createOrder} = createPayHandlers({env, fetcher});
  const response = await createOrder(post('/api/pay/create-order', {job_id: 42, company: ' Acme <b> ', email: 'HR@Acme.com'}));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual([body.order_id, body.key_id, body.amount, body.mode], ['order_TEST123456', 'rzp_test_abc123', 99900, 'test']);
  assert.ok(!JSON.stringify(body).includes('test_secret'), 'the key secret never reaches the browser');
  const order = calls.find(c => c.url.startsWith('https://api.razorpay.com'));
  assert.equal(order.body.amount, 99900);
  assert.equal(order.body.currency, 'INR');
  assert.equal(order.headers.Authorization, 'Basic ' + Buffer.from('rzp_test_abc123:test_secret').toString('base64'));
  const row = calls.find(c => c.url.endsWith('/featured_job_orders') && c.method === 'POST').body;
  assert.deepEqual([row.job_id, row.company, row.email, row.mode, row.amount_paise], [42, 'Acme b', 'hr@acme.com', 'test', 99900]);
});

test('Order creation refuses bad input, unknown jobs, and missing keys', async () => {
  const {createOrder} = createPayHandlers({env, fetcher: fakeServices().fetcher});
  assert.equal((await createOrder(post('/x', {job_id: 'abc', company: 'A', email: 'a@b.co'}))).status, 400);
  assert.equal((await createOrder(post('/x', {job_id: 1, company: '', email: 'a@b.co'}))).status, 400);
  assert.equal((await createOrder(post('/x', {job_id: 1, company: 'A', email: 'nope'}))).status, 400);
  assert.equal((await createOrder(new Request('http://localhost/x'))).status, 405);
  const missing = createPayHandlers({env: {}, fetcher: fakeServices().fetcher});
  assert.equal((await missing.createOrder(post('/x', {job_id: 1, company: 'A', email: 'a@b.co'}))).status, 503);
  const noJob = createPayHandlers({env, fetcher: fakeServices({job: null}).fetcher});
  assert.equal((await noJob.createOrder(post('/x', {job_id: 7, company: 'A', email: 'a@b.co'}))).status, 404);
});

test('Verifying a payment needs a valid signature, then marks the order paid for 30 days', async () => {
  const {calls, fetcher} = fakeServices();
  const {verify} = createPayHandlers({env, fetcher});
  const forged = await verify(post('/api/pay/verify', {order_id: 'order_TEST123456', payment_id: 'pay_TEST123456', signature: sign('order_TEST123456', 'pay_OTHER12345')}));
  assert.equal(forged.status, 400);
  assert.equal(calls.length, 0, 'a forged payment never touches the database');
  const ok = await verify(post('/api/pay/verify', {order_id: 'order_TEST123456', payment_id: 'pay_TEST123456', signature: sign('order_TEST123456', 'pay_TEST123456')}));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).job_id, 42);
  const patch = calls.find(c => c.method === 'PATCH');
  assert.match(patch.url, /razorpay_order_id=eq\.order_TEST123456&status=eq\.created$/);
  assert.equal(patch.body.status, 'paid');
  assert.equal(new Date(patch.body.ends_at) - new Date(patch.body.starts_at), 30 * 864e5);
});

test('The payment form reads a job number from a WILSY link', () => {
  assert.equal(jobIdFrom('12345'), 12345);
  assert.equal(jobIdFrom('https://www.wilsy.in/jobs/987-software-engineer'), 987);
  assert.equal(jobIdFrom('/jobs/55?x=1'), 55);
  assert.equal(jobIdFrom('https://example.com/careers'), null);
  assert.equal(jobIdFrom(''), null);
});

test('Featured jobs carry a visible label; other jobs do not', () => {
  const job = {id: 1, title: 'Engineer', company: 'Acme', description: 'Build', apply_url: 'https://acme.com/apply'};
  assert.match(renderJobCard({...job, is_featured: true}), /class="job-result-card is-featured"[\s\S]*job-featured-badge[^>]*>Featured</);
  assert.doesNotMatch(renderJobCard(job), /Featured/);
});

test('Pricing, refund and payment pages are built, linked and honest about who pays', async () => {
  const read = name => fs.readFile('dist/' + name, 'utf8');
  const [pricing, refund, pay, terms, home] = await Promise.all(['pricing.html', 'refund-policy.html', 'feature-job.html', 'terms.html', 'index.html'].map(read));
  assert.match(pricing, /₹999 for 30 days/);
  assert.match(pricing, /never charges job seekers/);
  assert.match(refund, /Within 7 days of payment/);
  assert.match(refund, /nothing is shipped/);
  assert.match(pay, /data-feature-job/);
  assert.match(pay, /src="\/js\/feature-job\.js"/);
  assert.match(pay, /noindex/);
  assert.doesNotMatch(pay, /checkout\.razorpay\.com/, 'Razorpay loads only when the employer presses Pay');
  assert.doesNotMatch(pay + pricing + refund, /pagead2\.googlesyndication/);
  assert.match(terms, /id="paid"/);
  assert.match(home, /href="\/pricing"/);
  assert.match(home, /href="\/refund-policy"/);
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, /\/pricing</);
  assert.doesNotMatch(sitemap, /\/feature-job</);
  await fs.access('dist/js/feature-job.js');
});
