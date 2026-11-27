import crypto from 'node:crypto';
import {supabaseConfig} from '../js/supabase-config.js';
import {site} from '../js/site-config.js';

// One-click unsubscribe for job alert emails (RFC 8058, required by Gmail and Yahoo for bulk senders).
// Each email carries https://www.wilsy.in/api/alerts/unsubscribe?u=<user id>&t=<token>, where the token is an
// HMAC of the user id with WILSY_UNSUBSCRIBE_SECRET. Nothing new is stored: a valid POST turns every
// alert of that person to 'off'. GET only shows a confirm button, because mail scanners open links
// on their own and must not unsubscribe anyone.

export const UNSUBSCRIBE_PATH = '/api/alerts/unsubscribe';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function unsubscribeToken(userId, secret) {
  return crypto.createHmac('sha256', secret).update(`wilsy-alerts-unsubscribe:${String(userId).toLowerCase()}`).digest('base64url').slice(0, 32);
}

export function unsubscribeUrl(userId, secret, origin = site.origin) {
  return `${origin}${UNSUBSCRIBE_PATH}?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId, secret)}`;
}

export function validToken(userId, token, secret) {
  if (!secret || !UUID.test(String(userId || '')) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  return crypto.timingSafeEqual(Buffer.from(unsubscribeToken(userId, secret)), Buffer.from(token));
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function page(title, body, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)} · WILSY</title>
<style>
:root{--bg:#f5f6f7;--card:#fff;--ink:#1c1e21;--muted:#65676b;--line:#e4e6eb;--accent:#0866ff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#181b21;--ink:#e8eaed;--muted:#a8adb4;--line:#2a2e36;--accent:#5b9bff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
main{max-width:480px;margin:12vh auto 0;padding:0 16px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:28px 24px}
.brand{font-weight:700;letter-spacing:1px;color:var(--muted);font-size:14px;margin:0 0 12px}h1{font-size:22px;line-height:1.3;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px}
button{font:inherit;font-weight:600;background:var(--accent);color:#fff;border:0;border-radius:8px;padding:12px 18px;cursor:pointer;width:100%}
a{color:var(--accent)}
</style></head>
<body><main><div class="card"><p class="brand">WILSY</p>${body}</div></main></body></html>`;
  return new Response(html, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer'}});
}

const invalid = () => page('Link not valid', `<h1>This unsubscribe link isn’t valid</h1><p>It may have been cut short when copied. To stop job alerts, <a href="${site.origin}/jobs?saved=1">sign in</a> and open Account, or reply to any alert email.</p>`, 400);

export function createUnsubscribeHandlers({env = process.env, fetcher = fetch} = {}) {
  const secret = env.WILSY_UNSUBSCRIBE_SECRET, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = env.SUPABASE_URL || supabaseConfig.url;
  const ready = () => Boolean(secret && serviceKey);
  const read = request => { const url = new URL(request.url); return {userId: (url.searchParams.get('u') || '').toLowerCase(), token: url.searchParams.get('t') || ''}; };
  const unavailable = () => page('Try again later', `<h1>Unsubscribe isn’t available right now</h1><p>Please try again later, or reply to the alert email and we’ll stop your alerts.</p>`, 503);

  async function get(request) {
    if (!ready()) return unavailable();
    const {userId, token} = read(request);
    if (!validToken(userId, token, secret)) return invalid();
    const action = `${UNSUBSCRIBE_PATH}?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
    return page('Stop job alerts', `<h1>Stop WILSY job alerts?</h1><p>This turns off the emails for every search you saved. Your saved jobs and searches stay in your account.</p>
<form method="post" action="${escapeHtml(action)}"><button type="submit">Stop all job alerts</button></form>`);
  }

  // Gmail's one-click button and the confirm form both POST here.
  async function post(request) {
    if (!ready()) return unavailable();
    const {userId, token} = read(request);
    if (!validToken(userId, token, secret)) return invalid();
    const response = await fetcher(`${dbUrl}/rest/v1/user_saved_searches?user_id=eq.${userId}&alert=neq.off`, {
      method: 'PATCH', body: JSON.stringify({alert: 'off'}),
      headers: {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal'},
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return unavailable();
    return page('Unsubscribed', `<h1>You’re unsubscribed</h1><p>You won’t get WILSY job alert emails any more. To turn them back on, <a href="${site.origin}/jobs?saved=1">sign in</a> and choose Daily or Weekly in Account.</p>`);
  }

  return {get, post};
}
