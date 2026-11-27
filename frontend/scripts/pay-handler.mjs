import crypto from 'node:crypto';
import {supabaseConfig} from '../js/supabase-config.js';

// Featured job: one payment of ₹999 pins a job to the top of WILSY search for 30 days.
export const FEATURED = {amount: 99900, currency: 'INR', days: 30, label: 'Featured job, 30 days'};

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
const emailOk = value => typeof value === 'string' && value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const clean = value => String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim();

function settings(env) {
  const keyId = env.RAZORPAY_KEY_ID, keySecret = env.RAZORPAY_KEY_SECRET, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !serviceKey) return null;
  return {keyId, keySecret, serviceKey, dbUrl: env.SUPABASE_URL || supabaseConfig.url, mode: keyId.startsWith('rzp_live_') ? 'live' : 'test'};
}

async function db(s, path, {method = 'GET', body, prefer} = {}, fetcher = fetch) {
  const response = await fetcher(`${s.dbUrl}/rest/v1/${path}`, {
    method, body: body && JSON.stringify(body),
    headers: {apikey: s.serviceKey, Authorization: `Bearer ${s.serviceKey}`, 'Content-Type': 'application/json', ...(prefer && {Prefer: prefer})},
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Database ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 4000) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Razorpay signs "order_id|payment_id" with the key secret (HMAC-SHA256, hex).
export function validSignature(orderId, paymentId, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function createPayHandlers({env = process.env, fetcher = fetch} = {}) {
  // POST {job_id, company, email} → a Razorpay order for one Featured job.
  async function createOrder(request) {
    if (request.method !== 'POST') return json(405, {error: 'Use POST'});
    const s = settings(env);
    if (!s) return json(503, {error: 'Payments are not set up yet.'});
    const body = await readBody(request);
    const jobId = Number(body?.job_id), company = clean(body?.company).slice(0, 120), email = clean(body?.email).toLowerCase();
    if (!Number.isSafeInteger(jobId) || jobId <= 0) return json(400, {error: 'Enter the WILSY job link or job number.'});
    if (!company) return json(400, {error: 'Enter your company name.'});
    if (!emailOk(email)) return json(400, {error: 'Enter a valid work email.'});
    try {
      const [job] = await db(s, `wilsy_public_jobs?id=eq.${jobId}&select=id,title,company`, {}, fetcher);
      if (!job) return json(404, {error: 'That job is not live on WILSY. Check the job link.'});
      const auth = 'Basic ' + Buffer.from(`${s.keyId}:${s.keySecret}`).toString('base64');
      const response = await fetcher('https://api.razorpay.com/v1/orders', {
        method: 'POST', headers: {Authorization: auth, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({amount: FEATURED.amount, currency: FEATURED.currency, receipt: `job-${jobId}-${Date.now()}`, notes: {job_id: String(jobId), company, email}})
      });
      if (!response.ok) throw new Error(`Razorpay ${response.status}`);
      const order = await response.json();
      await db(s, 'featured_job_orders', {method: 'POST', prefer: 'return=minimal', body: {job_id: jobId, company, email, razorpay_order_id: order.id, amount_paise: FEATURED.amount, currency: FEATURED.currency, mode: s.mode}}, fetcher);
      return json(200, {order_id: order.id, key_id: s.keyId, amount: FEATURED.amount, currency: FEATURED.currency, mode: s.mode, job: {id: job.id, title: job.title, company: job.company}});
    } catch (error) {
      console.error('create-order', error.message);
      return json(502, {error: 'Could not start the payment. Please try again in a minute.'});
    }
  }

  // POST {order_id, payment_id, signature} from Razorpay Checkout → mark the order paid and start the 30 days.
  async function verify(request) {
    if (request.method !== 'POST') return json(405, {error: 'Use POST'});
    const s = settings(env);
    if (!s) return json(503, {error: 'Payments are not set up yet.'});
    const body = await readBody(request);
    const orderId = clean(body?.order_id), paymentId = clean(body?.payment_id);
    if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId) || !/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId)) return json(400, {error: 'Missing payment details.'});
    if (!validSignature(orderId, paymentId, body?.signature, s.keySecret)) return json(400, {error: 'Payment could not be verified.'});
    try {
      const now = new Date(), ends = new Date(now.getTime() + FEATURED.days * 864e5);
      const rows = await db(s, `featured_job_orders?razorpay_order_id=eq.${orderId}&status=eq.created`, {method: 'PATCH', prefer: 'return=representation', body: {status: 'paid', razorpay_payment_id: paymentId, paid_at: now.toISOString(), starts_at: now.toISOString(), ends_at: ends.toISOString()}}, fetcher);
      const row = rows?.[0] || (await db(s, `featured_job_orders?razorpay_order_id=eq.${orderId}&select=job_id,status,mode,ends_at`, {}, fetcher))?.[0];
      if (!row || row.status !== 'paid') return json(404, {error: 'Order not found.'});
      return json(200, {ok: true, job_id: row.job_id, mode: row.mode, ends_at: row.ends_at});
    } catch (error) {
      console.error('verify', error.message);
      return json(502, {error: 'Payment received but not yet recorded. Email us your payment ID and we will fix it.'});
    }
  }

  return {createOrder, verify};
}
