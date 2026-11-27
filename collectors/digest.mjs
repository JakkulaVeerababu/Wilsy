// The weekly WILSY email: new internships and fresher jobs in India from the last 7 days, sent once a
// week to each signed-in person who ticked it in Account (public.user_email_prefs.weekly_digest).
//
// Dry run by default: prints what would be sent, sends nothing and writes nothing.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/digest.mjs
// Live (only with WILSY_DIGEST_SEND=1 and RESEND_API_KEY):
//   WILSY_DIGEST_SEND=1 RESEND_API_KEY=… WILSY_UNSUBSCRIBE_SECRET=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/digest.mjs
// Preview this week's email with the public key only (nothing sent):
//   node collectors/digest.mjs --preview [--out weekly.html]
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import {jobPath} from '../frontend/js/jobs-core.js';
import {supabaseConfig} from '../frontend/js/supabase-config.js';
import {site} from '../frontend/js/site-config.js';
import {alertFilters, newJobs, searchJobs, createRest, createResendSender, confirmedEmail, loadUser, escapeHtml, clean,
  jobPlace, jobPay, dateIst, LOGO_URL, MANAGE_URL} from './alerts.mjs';
import {unsubscribeUrl} from '../frontend/scripts/unsubscribe-handler.mjs';

export const FROM = 'WILSY Weekly <weekly@wilsy.in>';
export const DEFAULT_MAX_EMAILS = 50; // leaves room in Resend's 100-a-day free limit for job alerts
export const DUE_AFTER_MS = 6.9 * 24 * 3600e3;
export const WEEK_MS = 7 * 24 * 3600e3;
export const PER_SECTION = 6;
export const SECTIONS = [
  {title: 'Internships in India', query: 'stage=internship&country=India'},
  {title: 'Fresher jobs in India', query: 'stage=fresher&country=India'},
];

const tracking = 'utm_source=wilsy_weekly&utm_medium=email&utm_campaign=weekly_email';
const link = path => `${site.origin}${path}${path.includes('?') ? '&' : '?'}${tracking}`;

export const isDue = (row, now = new Date()) => !row.last_digest_at || now - new Date(row.last_digest_at) >= DUE_AFTER_MS;

/** This week's sections, the same for everyone: new roles found in the 7 days before `until`. */
export async function buildSections({search, fx, until}) {
  const since = new Date(until.getTime() - WEEK_MS), sections = [];
  for(const s of SECTIONS) {
    const result = await search(alertFilters(s.query, fx));
    if(!Array.isArray(result?.jobs)) throw new Error('Unexpected search response');
    const found = newJobs(result.jobs, since, until, PER_SECTION);
    if(found.jobs.length) sections.push({...s, ...found, since});
  }
  return sections;
}

export function renderDigest(sections, {fx, unsubscribe = null, now = new Date()} = {}) {
  const total = sections.reduce((n, s) => n + s.count, 0), more = sections.some(s => s.more);
  const subject = clean(`This week on WILSY: ${total}${more ? '+' : ''} new internships and fresher jobs`, 150);
  const font = 'font-family:Arial,Helvetica,sans-serif;';
  const jobHtml = job => {
    const pay = jobPay(job, fx);
    return `<tr><td style="padding:12px 0;border-top:1px solid #e4e6eb;${font}">
<a href="${escapeHtml(link(jobPath(job)))}" style="color:#0866ff;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(clean(job.title, 140) || 'Untitled role')}</a>
<div style="color:#1c1e21;font-size:14px;line-height:20px;margin-top:2px;">${escapeHtml(clean(job.company, 80) || 'Company not specified')} · ${escapeHtml(jobPlace(job))}</div>
${pay ? `<div style="color:#65676b;font-size:14px;line-height:20px;">${escapeHtml(pay)}</div>` : ''}
</td></tr>`;
  };
  const sectionHtml = s => `<tr><td style="padding:24px 0 4px;${font}"><h2 style="margin:0;color:#1c1e21;font-size:18px;line-height:24px;">${escapeHtml(s.title)}</h2>
<p style="margin:4px 0 0;color:#65676b;font-size:14px;">${escapeHtml(`${s.count}${s.more ? '+' : ''} new this week`)}${s.count > s.jobs.length || s.more ? escapeHtml(` · showing ${s.jobs.length}`) : ''}</p></td></tr>
${s.jobs.map(jobHtml).join('\n')}
<tr><td style="padding:8px 0 0;border-top:1px solid #e4e6eb;${font}"><a href="${escapeHtml(link(`/jobs?${s.query}`))}" style="color:#0866ff;font-size:14px;">See all ${escapeHtml(s.title.toLowerCase())}</a></td></tr>`;
  const why = 'You are getting this because you turned on the weekly WILSY email in your account.';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f7;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(sections.map(s => `${s.title}: ${s.count} new`).join(' · '))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e6eb;border-radius:8px;">
<tr><td style="padding:24px 24px 0;${font}"><a href="${escapeHtml(site.origin)}" style="text-decoration:none;"><img src="${escapeHtml(LOGO_URL)}" width="32" height="32" alt="WILSY" style="vertical-align:middle;border:0;border-radius:8px;"></a><span style="color:#1c1e21;font-size:20px;font-weight:bold;letter-spacing:1px;vertical-align:middle;"> &nbsp;WILSY</span><span style="color:#65676b;font-size:14px;vertical-align:middle;"> &nbsp;Weekly · ${escapeHtml(dateIst(now))}</span></td></tr>
<tr><td style="padding:0 24px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${sections.map(sectionHtml).join('\n')}
<tr><td style="padding:24px 0 0;${font}"><p style="margin:0;color:#1c1e21;font-size:14px;line-height:20px;">Also this week: <a href="${escapeHtml(link('/hackathons'))}" style="color:#0866ff;">hackathons</a> · <a href="${escapeHtml(link('/government-jobs'))}" style="color:#0866ff;">government job notices</a> · <a href="${escapeHtml(link('/scam-check'))}" style="color:#0866ff;">check a job offer for scams</a></p></td></tr>
</table></td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e4e6eb;color:#65676b;font-size:12px;line-height:18px;${font}">
<p style="margin:0 0 8px;">${escapeHtml(why)}</p>
<p style="margin:0 0 8px;"><a href="${escapeHtml(MANAGE_URL)}" style="color:#0866ff;">Manage emails</a>${unsubscribe ? ` · <a href="${escapeHtml(unsubscribe)}" style="color:#0866ff;">Unsubscribe from the weekly email</a>` : ''}</p>
<p style="margin:0;">Roles link to the employer's own application page. Check details with the employer before you apply.<br>WILSY · <a href="${escapeHtml(site.origin)}" style="color:#65676b;">wilsy.in</a></p>
</td></tr></table></td></tr></table>
</body></html>`;
  const text = ['WILSY Weekly', '', ...sections.flatMap(s => [`${s.title}: ${s.count}${s.more ? '+' : ''} new this week`,
    ...s.jobs.flatMap(job => { const pay = jobPay(job, fx);
      return [`- ${clean(job.title, 140) || 'Untitled role'}`, `  ${clean(job.company, 80) || 'Company not specified'} · ${jobPlace(job)}${pay ? ` · ${pay}` : ''}`, `  ${link(jobPath(job))}`]; }),
    `See all: ${link(`/jobs?${s.query}`)}`, '']),
    `Manage emails: ${MANAGE_URL}`, ...(unsubscribe ? [`Unsubscribe from the weekly email: ${unsubscribe}`] : []), why, '', 'WILSY · wilsy.in', ''].join('\n');
  return {subject, html, text};
}

/** One email per person per week: the key changes only when last_digest_at does. */
export const digestKey = (userId, lastAt) => 'wilsy-weekly-' + crypto.createHash('sha256').update(`${userId}\n${lastAt || 'first'}`).digest('hex').slice(0, 40);

export async function runDigest({now = new Date(), live = false, maxEmails = DEFAULT_MAX_EMAILS, fx, loadSubscribers, getUser, search, send, mark,
  unsubscribeFor = () => null, log = console.log}) {
  const report = {live, subscribers: 0, due: 0, emails: 0, noConfirmedEmail: 0, nothingNew: false, leftForNextRun: 0, sendErrors: 0, markErrors: 0, errors: []};
  const rows = await loadSubscribers();
  report.subscribers = rows.length;
  const due = rows.filter(r => isDue(r, now)).sort((a, b) => new Date(a.last_digest_at || 0) - new Date(b.last_digest_at || 0));
  report.due = due.length;
  if(!due.length) return report;
  const sections = await buildSections({search, fx, until: new Date(now.getTime() - 5 * 60e3)});
  if(!sections.length) { report.nothingNew = true; return report; }
  for(const [index, row] of due.entries()) {
    if(report.emails >= maxEmails) { report.leftForNextRun = due.length - index; break; }
    let email;
    try { email = confirmedEmail(await getUser(row.user_id), now); } catch(error) { report.errors.push(`user lookup: ${error.message}`); continue; }
    if(!email) { report.noConfirmedEmail++; continue; }
    const message = renderDigest(sections, {fx, unsubscribe: unsubscribeFor(row.user_id), now});
    if(!live) { report.emails++; log(`[dry run] would email person ${index + 1}`); continue; }
    try {
      await send({to: email, ...message, unsubscribe: unsubscribeFor(row.user_id), from: FROM, category: 'weekly_email', idempotencyKey: digestKey(row.user_id, row.last_digest_at)});
      report.emails++; log(`sent person ${index + 1}`);
    } catch(error) {
      if(!error.duplicate) { report.sendErrors++; report.errors.push(`send: ${error.message}`); if(error.fatal) { report.stopped = error.message; break; } continue; }
      log(`already sent person ${index + 1}`);
    }
    await mark(row.user_id, now).catch(error => { report.markErrors++; report.errors.push(`mark: ${error.message}`); });
  }
  return report;
}

export const loadSubscribers = db => db('user_email_prefs?select=user_id,last_digest_at&weekly_digest=is.true&order=user_id');
export const markSent = (db, userId, at) => db(`user_email_prefs?user_id=eq.${encodeURIComponent(userId)}`, {method: 'PATCH', body: {last_digest_at: at.toISOString()}, prefer: 'return=minimal'});

const loadFx = async () => JSON.parse(await fs.readFile(new URL('../frontend/data/exchange-rate.json', import.meta.url), 'utf8'));

async function main() {
  const {values: args} = parseArgs({options: {preview: {type: 'boolean'}, out: {type: 'string'}}});
  const fx = await loadFx();
  if(args.preview) {
    const publicDb = createRest({url: supabaseConfig.url, key: supabaseConfig.publishableKey});
    const sections = await buildSections({search: filters => searchJobs(publicDb, filters), fx, until: new Date()});
    if(!sections.length) return console.log('Nothing new this week.');
    const message = renderDigest(sections, {fx});
    console.log(`Subject: ${message.subject}\n\n${message.text}`);
    if(args.out) { await fs.writeFile(args.out, message.html); console.log(`HTML written to ${args.out}`); }
    return;
  }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const live = process.env.WILSY_DIGEST_SEND === '1';
  const cap = process.env.WILSY_DIGEST_MAX_EMAILS || '';
  const db = createRest({url, key}), publicDb = createRest({url, key: supabaseConfig.publishableKey});
  const secret = process.env.WILSY_UNSUBSCRIBE_SECRET || '';
  const send = live ? createResendSender({apiKey: process.env.RESEND_API_KEY}) : async () => { throw new Error('Dry run: sending is disabled.'); };
  console.log(live ? 'Live run.' : 'Dry run: nothing will be sent or written. Set WILSY_DIGEST_SEND=1 to send.');
  const report = await runDigest({live, maxEmails: /^[0-9]+$/.test(cap) ? Number(cap) : DEFAULT_MAX_EMAILS, fx,
    loadSubscribers: () => loadSubscribers(db), getUser: id => loadUser(db, id), search: filters => searchJobs(publicDb, filters),
    send, mark: (userId, at) => markSent(db, userId, at), unsubscribeFor: secret ? id => unsubscribeUrl(id, secret, site.origin, 'weekly') : () => null});
  const {errors, ...totals} = report;
  console.log(JSON.stringify({...totals, errors: errors.slice(0, 5)}));
  if(report.stopped || report.sendErrors || report.markErrors) process.exitCode = 1;
}
if(process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) await main();
