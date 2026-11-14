// Job alert emails. Reads saved searches whose alert is due, finds roles WILSY found since the last
// alert, and sends each person at most one email per run through Resend.
//
// Dry run by default: prints what would be sent, sends nothing and writes nothing.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/alerts.mjs
// Live (only with WILSY_ALERTS_SEND=1 and RESEND_API_KEY):
//   WILSY_ALERTS_SEND=1 RESEND_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/alerts.mjs
// Preview one email for any search, using only the public key (no account data, nothing sent):
//   node collectors/alerts.mjs --preview "role=backend&country=India" [--since 2026-11-13T00:00:00Z] [--out alert.html]
// See docs/alerts-setup.md.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import {readState,stateQuery,apiFilters,jobSalary,jobPath} from '../frontend/js/jobs-core.js';
import {searchName} from '../frontend/js/job-workspace-core.js';
import {decodeEntities} from '../frontend/js/job-text.js';
import {supabaseConfig} from '../frontend/js/supabase-config.js';
import {site} from '../frontend/js/site-config.js';
import {retryableDbError} from './collect.mjs';

export const FROM='WILSY Alerts <alerts@wilsy.in>';
export const REPLY_TO=site.email;
export const MANAGE_URL=`${site.origin}/jobs?saved=1`;
export const MAX_JOBS_PER_SEARCH=10;
export const DEFAULT_MAX_EMAILS=100; // Resend's free plan allows 100 emails a day
export const SEARCH_PAGE=50; // the most wilsy_search_jobs returns in one page
const HOUR=3600e3,DAY=24*HOUR;
// A little early, so a run that starts a few minutes before the same time tomorrow still counts.
export const DUE_AFTER_MS={daily:23*HOUR,weekly:6.9*DAY};
// A search that has never alerted looks back this far (or to when it was saved, if later).
export const FIRST_LOOKBACK_MS={daily:DAY,weekly:7*DAY};
// Roles found in the last few minutes wait for the next run, so a collector transaction that is
// still committing cannot be skipped.
export const SETTLE_MS=5*60e3;
const RESEND_URL='https://api.resend.com/emails';
const USER_AGENT='WILSYAlerts/1.0 (+https://www.wilsy.in/about)';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const time=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};

// --- Which searches are due -------------------------------------------------------------------

export function isDue(row,now=new Date()) {
  if(!row||!(row.alert in DUE_AFTER_MS))return false; // 'off' or anything unexpected is never due
  const last=time(row.last_alerted_at);
  return last==null||now.getTime()-last>=DUE_AFTER_MS[row.alert];
}

// Start of the window of roles to report: the last alert, or for a first alert the later of when
// the search was saved and one alert period ago.
export function windowStart(row,now=new Date()) {
  const last=time(row.last_alerted_at);
  if(last!=null)return new Date(last);
  const floor=now.getTime()-FIRST_LOOKBACK_MS[row.alert];
  return new Date(Math.max(floor,time(row.created_at)??floor));
}

// One entry per person, most overdue first, so a capped run drains the backlog fairly.
export function groupByUser(rows,now=new Date()) {
  const users=new Map();
  for(const row of rows){
    if(!isDue(row,now))continue;
    if(!users.has(row.user_id))users.set(row.user_id,{userId:row.user_id,searches:[]});
    users.get(row.user_id).searches.push(row);
  }
  const oldest=u=>Math.min(...u.searches.map(s=>time(s.last_alerted_at)??0));
  return [...users.values()].sort((a,b)=>oldest(a)-oldest(b)||String(a.userId).localeCompare(String(b.userId)));
}

// Only a real, confirmed address of an account that is not banned or deleted.
export function confirmedEmail(user,now=new Date()) {
  if(!user||user.is_anonymous||user.deleted_at)return null;
  if(!time(user.email_confirmed_at))return null;
  const banned=time(user.banned_until);if(banned&&banned>now.getTime())return null;
  const email=String(user.email||'').trim();
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z0-9-]{2,}$/i.test(email)&&email.length<=254?email:null;
}

// --- Which roles are new ----------------------------------------------------------------------

// The site's own filter mapping, newest-found first (the search's default order).
export function alertFilters(query,fx) {
  const filters=apiFilters(readState('?'+query),[],fx);
  delete filters.sort;
  return filters;
}
export const foundAt=job=>time(job.first_seen_at||job.discovered_at);

// Roles found after `since` and no later than `until`, at most `limit` of them.
export function newJobs(jobs,since,until,limit=MAX_JOBS_PER_SEARCH) {
  const from=since.getTime(),to=until.getTime(),seen=new Set();
  const fresh=(jobs||[]).filter(job=>{
    const at=foundAt(job),id=String(job?.id||'');
    if(!/^\d+$/.test(id)||seen.has(id)||at==null||at<=from||at>to)return false;
    seen.add(id);return true;
  }).sort((a,b)=>foundAt(b)-foundAt(a));
  // A full page of new roles means there may be more than we counted.
  return {jobs:fresh.slice(0,limit),count:fresh.length,more:(jobs||[]).length>=SEARCH_PAGE&&fresh.length===(jobs||[]).length};
}

// --- The email --------------------------------------------------------------------------------

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Decoded, single-line, control characters removed, trimmed to a sensible length.
export function clean(value,max=160) {
  const text=decodeEntities(String(value??'')).replace(/[\u0000-\u001f\u007f-\u009f]+/g,' ').replace(/\s+/g,' ').trim();
  return text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
}
const tracking=cadence=>`utm_source=wilsy_alerts&utm_medium=email&utm_campaign=${cadence==='weekly'?'weekly':'daily'}_alert`;
// The role's own page. Every live job has one (pre-built, or rendered on request by api/job-page.mjs),
// and a changed title only redirects to the new slug, keeping these parameters.
export const jobUrl=(job,cadence)=>`${site.origin}${jobPath({...job,id:encodeURIComponent(String(job.id))})}?${tracking(cadence)}`;
// The saved search itself, normalised the way the site writes it.
export function searchUrl(query,cadence) {
  const filters=stateQuery({...readState('?'+query),page:1,id:'',saved:false});
  return `${site.origin}/jobs?${filters?filters+'&':''}${tracking(cadence)}`;
}

export function jobPlace(job) {
  const place=clean(job.location,90)||[job.city,job.state_region,job.country].map(v=>clean(v,40)).filter(Boolean).join(', ');
  const mode=job.work_mode==='remote'?'Remote':job.work_mode==='hybrid'?'Hybrid':'';
  if(mode&&!place.toLowerCase().includes(mode.toLowerCase()))return place?`${mode} · ${place}`:mode;
  return place||'Location not specified';
}
// Pay only when the employer published it: INR as published, USD as an INR estimate, others as published.
export function jobPay(job,fx) {
  const disclosed=job.salary_min!=null||job.salary_max!=null||clean(job.salary_text);
  if(!disclosed)return '';
  const pay=jobSalary(job,fx);
  if(!pay.primary||pay.primary==='Salary not disclosed')return '';
  return clean(pay.primary,80)+(pay.secondary==='INR estimate'?' (INR estimate)':'');
}
const dateIst=value=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}).format(value);
const plural=(n,word)=>`${n} ${word}${n===1?'':/(s|sh|ch)$/.test(word)?'es':'s'}`;
const countLabel=s=>s.more?`${s.count}+`:String(s.count);

// sections: [{query, alert, since: Date, jobs, count, more}], already filtered to those with roles.
export function renderEmail(sections,{fx}={}) {
  const cadence=sections.some(s=>s.alert==='daily')?'daily':'weekly';
  const named=sections.map(s=>({...s,name:clean(searchName(s.query),120)||'All opportunities'}));
  const total=named.reduce((n,s)=>n+s.count,0),anyMore=named.some(s=>s.more);
  const totalLabel=`${total}${anyMore?'+':''}`;
  const subject=clean(named.length===1
    ?`${totalLabel} new ${total===1&&!anyMore?'role':'roles'} for ${named[0].name}`
    :`${totalLabel} new roles for your saved searches`,150);
  const preheader=named.map(s=>`${s.name}: ${countLabel(s)} new`).join(' · ');
  const font="font-family:Arial,Helvetica,sans-serif;";
  const jobHtml=(job,s)=>{
    const pay=jobPay(job,fx);
    return `<tr><td style="padding:12px 0;border-top:1px solid #e4e6eb;${font}">
<a href="${escapeHtml(jobUrl(job,s.alert))}" style="color:#0866ff;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(clean(job.title,140)||'Untitled role')}</a>
<div style="color:#1c1e21;font-size:14px;line-height:20px;margin-top:2px;">${escapeHtml(clean(job.company,80)||'Company not specified')} · ${escapeHtml(jobPlace(job))}</div>
${pay?`<div style="color:#65676b;font-size:14px;line-height:20px;">${escapeHtml(pay)}</div>`:''}
</td></tr>`;
  };
  const sectionHtml=s=>`<tr><td style="padding:24px 0 4px;${font}">
<h2 style="margin:0;color:#1c1e21;font-size:18px;line-height:24px;">${escapeHtml(s.name)}</h2>
<p style="margin:4px 0 0;color:#65676b;font-size:14px;">${escapeHtml(`${countLabel(s)} new since ${dateIst(s.since)}`)}${s.count>s.jobs.length||s.more?escapeHtml(` · showing ${s.jobs.length}`):''}</p>
</td></tr>
${s.jobs.map(job=>jobHtml(job,s)).join('\n')}
<tr><td style="padding:8px 0 0;border-top:1px solid #e4e6eb;${font}"><a href="${escapeHtml(searchUrl(s.query,s.alert))}" style="color:#0866ff;font-size:14px;">View all matches on WILSY</a></td></tr>`;
  const cadences=[...new Set(named.map(s=>s.alert))].sort().join(' and ');
  const why=`You are getting this because you turned on ${cadences} job alerts for saved searches on WILSY. To change or stop them, sign in and open Account.`;
  const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f7;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e6eb;border-radius:8px;">
<tr><td style="padding:24px 24px 0;${font}"><span style="color:#1c1e21;font-size:20px;font-weight:bold;letter-spacing:1px;">WILSY</span><span style="color:#65676b;font-size:14px;"> &nbsp;Job alerts</span></td></tr>
<tr><td style="padding:0 24px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${named.map(sectionHtml).join('\n')}
</table></td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e4e6eb;color:#65676b;font-size:12px;line-height:18px;${font}">
<p style="margin:0 0 8px;">${escapeHtml(why)}</p>
<p style="margin:0 0 8px;"><a href="${escapeHtml(MANAGE_URL)}" style="color:#0866ff;">Manage alerts</a></p>
<p style="margin:0;">Roles link to the employer's own application page. Check details with the employer before you apply.<br>WILSY · <a href="${escapeHtml(site.origin)}" style="color:#65676b;">wilsy.in</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text=['WILSY job alerts','',
    ...named.flatMap(s=>[`${s.name}: ${countLabel(s)} new since ${dateIst(s.since)}`,
      ...s.jobs.flatMap(job=>{const pay=jobPay(job,fx);
        return [`- ${clean(job.title,140)||'Untitled role'}`,`  ${clean(job.company,80)||'Company not specified'} · ${jobPlace(job)}${pay?` · ${pay}`:''}`,`  ${jobUrl(job,s.alert)}`];}),
      `View all matches: ${searchUrl(s.query,s.alert)}`,'']),
    `Manage alerts: ${MANAGE_URL}`,why,'','WILSY · wilsy.in',''].join('\n');
  return {subject,html,text};
}

// Stable for one state of a person's searches, so a retried or re-run send is not delivered twice.
export function idempotencyKey(userId,searches) {
  const state=[String(userId),...searches.map(s=>`${s.query}@${s.last_alerted_at||'first'}`).sort()].join('\n');
  return 'wilsy-alert-'+crypto.createHash('sha256').update(state).digest('hex').slice(0,40);
}
export const maskEmail=email=>{const [name,domain]=String(email).split('@');return `${name.slice(0,2)}***@${domain||'?'}`;};

// --- Sending through Resend -------------------------------------------------------------------

export class SendError extends Error {
  constructor(message,{status=0,fatal=false,duplicate=false}={}) {super(message);Object.assign(this,{status,fatal,duplicate});}
}

// Waits Retry-After (or ratelimit-reset) when given, else 1 s, 2 s, 4 s…, never more than a minute.
export function retryDelay(response,attempt) {
  const header=name=>Number(response?.headers?.get?.(name));
  const seconds=[header('retry-after'),header('ratelimit-reset')].find(v=>Number.isFinite(v)&&v>0);
  return Math.min(60000,seconds?seconds*1000:1000*2**attempt);
}

// Sends one email at a time, at most about two a second (Resend's default limit), retrying rate
// limits, server errors and network failures. A bad key or a spent quota stops the whole run.
export function createResendSender({apiKey,fetcher=globalThis.fetch,sleep=pause,retries=3,minIntervalMs=600,now=()=>Date.now()}) {
  if(!apiKey)throw new Error('Set RESEND_API_KEY to send alerts.');
  let last=-Infinity;
  return async function send({to,subject,html,text,idempotencyKey:key}) {
    const body=JSON.stringify({from:FROM,to:[to],reply_to:REPLY_TO,subject,html,text,
      headers:{'List-Unsubscribe':`<${MANAGE_URL}>`},tags:[{name:'category',value:'job_alert'}]});
    for(let attempt=0;;attempt++){
      const wait=last+minIntervalMs-now();if(wait>0)await sleep(wait);
      last=now();
      let response,detail='';
      try{
        response=await fetcher(RESEND_URL,{method:'POST',body,signal:AbortSignal.timeout(20000),
          headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','User-Agent':USER_AGENT,...(key?{'Idempotency-Key':key}:{})}});
      }catch(error){
        if(attempt>=retries)throw new SendError(`Resend unreachable: ${error.message}`);
        await sleep(1000*2**attempt);continue;
      }
      if(response.ok){const data=await response.json().catch(()=>({}));return {id:data.id||null};}
      try{detail=(await response.text()).slice(0,300);}catch{}
      const name=(detail.match(/"name"\s*:\s*"([a-z_]+)"/)||[])[1]||'';
      if(response.status===401||response.status===403||/quota/.test(name))
        throw new SendError(`Resend ${response.status} ${name}: stopping this run`,{status:response.status,fatal:true});
      // The same key with a different payload means this exact state was already emailed.
      if(response.status===409&&name==='invalid_idempotent_request')
        throw new SendError('Already sent for this state',{status:409,duplicate:true});
      const retryable=response.status===429||response.status>=500||(response.status===409&&name==='concurrent_idempotent_requests');
      if(!retryable||attempt>=retries)throw new SendError(`Resend ${response.status} ${name||detail.slice(0,120)}`,{status:response.status});
      await sleep(retryDelay(response,attempt));
    }
  };
}

// --- Database access --------------------------------------------------------------------------

export function createRest({url,key,fetcher=globalThis.fetch,sleep=pause,retries=2}) {
  return async function rest(path,{body,method=body?'POST':'GET',prefer,base='rest/v1'}={}) {
    for(let attempt=0;;attempt++){
      try{
        const response=await fetcher(`${url}/${base}/${path}`,{method,signal:AbortSignal.timeout(30000),
          headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
          body:body?JSON.stringify(body):undefined});
        const text=await response.text();
        if(response.status===404&&base==='auth/v1')return null;
        if(!response.ok){
          const error=new Error(`Database ${response.status}: ${text.slice(0,200)}`);
          error.final=!(response.status===429||retryableDbError(response.status,text));throw error;
        }
        return text?JSON.parse(text):null;
      }catch(error){
        if(error.final||attempt>=retries)throw error;
        await sleep(500*4**attempt);
      }
    }
  };
}

export async function loadAlertSearches(db) {
  const rows=[];
  for(let offset=0;;offset+=1000){
    const page=await db(`user_saved_searches?select=user_id,query,alert,created_at,last_alerted_at&alert=in.(daily,weekly)&order=user_id,query&limit=1000&offset=${offset}`);
    if(!Array.isArray(page))throw new Error('Unexpected saved-search response');
    rows.push(...page);
    if(page.length<1000)break;
  }
  return rows;
}
export const loadUser=(db,userId)=>db(`admin/users/${encodeURIComponent(userId)}`,{base:'auth/v1'});
export const searchJobs=(db,filters)=>db('rpc/wilsy_search_jobs',{body:{filters,page_size:SEARCH_PAGE,page_offset:0}});
// Only the searches that were checked, only while they are still switched on.
export async function markAlerted(db,userId,searches,at) {
  for(const s of searches)await db(`user_saved_searches?user_id=eq.${encodeURIComponent(userId)}&query=eq.${encodeURIComponent(s.query)}&alert=in.(daily,weekly)`,
    {method:'PATCH',body:{last_alerted_at:at.toISOString()},prefer:'return=minimal'});
}

// --- One run ----------------------------------------------------------------------------------

// Everything outside is passed in, so tests can run it with fakes. Nothing is sent or written
// unless `live` is true.
export async function runAlerts({now=new Date(),live=false,maxEmails=DEFAULT_MAX_EMAILS,fx,
  loadSearches,getUser,search,send,mark,log=console.log,verbose=false}) {
  const until=new Date(now.getTime()-SETTLE_MS);
  const rows=await loadSearches();
  const users=groupByUser(rows,now);
  const report={live,dueSearches:users.reduce((n,u)=>n+u.searches.length,0),dueUsers:users.length,
    emails:0,nothingNew:0,noConfirmedEmail:0,leftForNextRun:0,searchErrors:0,sendErrors:0,markErrors:0,errors:[]};
  const markChecked=(userId,checked)=>mark(userId,checked,until).catch(error=>{report.markErrors++;report.errors.push(`mark: ${error.message}`);});
  for(const [index,user] of users.entries()){
    if(report.emails>=maxEmails){report.leftForNextRun=users.length-index;break;}
    let email;
    try{email=confirmedEmail(await getUser(user.userId),now);}
    catch(error){report.errors.push(`user lookup: ${error.message}`);report.searchErrors++;continue;}
    if(!email){report.noConfirmedEmail++;continue;}
    const checked=[];
    for(const s of user.searches){
      if(!isDue(s,now))continue; // never 'off'
      try{
        const result=await search(alertFilters(s.query,fx));
        if(!Array.isArray(result?.jobs))throw new Error('Unexpected search response');
        const since=windowStart(s,now);
        checked.push({...s,since,...newJobs(result.jobs,since,until)});
      }catch(error){report.searchErrors++;report.errors.push(`search: ${error.message}`);}
    }
    const sections=checked.filter(s=>s.jobs.length);
    if(!sections.length){
      report.nothingNew+=checked.length?1:0;
      if(live&&checked.length)await markChecked(user.userId,checked);
      continue;
    }
    const message=renderEmail(sections,{fx});
    // The repository is public, and so are its Actions logs: by default a line names no address
    // and no search terms. WILSY_ALERTS_VERBOSE=1 adds a masked address and the subject, for local runs.
    const counts=`${plural(sections.length,'search')}, ${plural(sections.reduce((n,s)=>n+s.jobs.length,0),'role')} shown`;
    const summary=verbose?`${maskEmail(email)}: "${message.subject}" (${counts})`:`person ${index+1}: ${counts}`;
    if(!live){report.emails++;log(`[dry run] would email ${summary}`);continue;}
    try{
      await send({to:email,...message,idempotencyKey:idempotencyKey(user.userId,checked)});
      report.emails++;log(`sent ${summary}`);
    }catch(error){
      if(!error.duplicate){
        report.sendErrors++;report.errors.push(`send: ${error.message}`);
        if(error.fatal){report.stopped=error.message;break;}
        continue;
      }
      log(`already sent ${summary}`);
    }
    await markChecked(user.userId,checked);
  }
  return report;
}

export function summaryMarkdown(report) {
  const rows=[['Mode',report.live?'live':'dry run (nothing sent, nothing written)'],['Searches due',report.dueSearches],['People due',report.dueUsers],
    [report.live?'Emails sent':'Emails that would be sent',report.emails],['Nothing new',report.nothingNew],['No confirmed email',report.noConfirmedEmail],
    ['Left for next run (cap)',report.leftForNextRun],['Search errors',report.searchErrors],['Send errors',report.sendErrors],['Status write errors',report.markErrors]];
  return ['### Job alerts','','| | |','|---|---|',...rows.map(([k,v])=>`| ${k} | ${v} |`),'',
    ...(report.stopped?[`**Stopped:** ${String(report.stopped).replace(/[|<>]/g,' ')}`,'']:[]),
    ...report.errors.slice(0,20).map(e=>`- ${String(e).replace(/[|<>]/g,' ')}`),''].join('\n');
}

async function loadFx() {
  return JSON.parse(await fs.readFile(new URL('../frontend/data/exchange-rate.json',import.meta.url),'utf8'));
}

async function preview({query,since,out}) {
  const fx=await loadFx(),now=new Date();
  const db=createRest({url:supabaseConfig.url,key:supabaseConfig.publishableKey});
  const start=since?new Date(since):new Date(now.getTime()-DAY);
  if(!Number.isFinite(start.getTime()))throw new Error('Pass --since as an ISO date.');
  const result=await searchJobs(db,alertFilters(query,fx));
  const found=newJobs(result.jobs,start,new Date(now.getTime()-SETTLE_MS));
  console.log(`Preview for "${query}": ${found.count}${found.more?'+':''} new since ${start.toISOString()} (of ${result.total} current matches). Nothing is sent.`);
  if(!found.jobs.length)return;
  const message=renderEmail([{query,alert:'daily',since:start,...found}],{fx});
  console.log(`Subject: ${message.subject}\n\n${message.text}`);
  if(out){await fs.writeFile(out,message.html);console.log(`HTML written to ${out}`);}
}

async function main() {
  const {values:args}=parseArgs({options:{preview:{type:'string'},since:{type:'string'},out:{type:'string'}}});
  if(args.preview!=null)return preview({query:args.preview,since:args.since,out:args.out});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const live=process.env.WILSY_ALERTS_SEND==='1';
  const cap=process.env.WILSY_ALERTS_MAX_EMAILS||'';
  const maxEmails=/^[0-9]+$/.test(cap)?Number(cap):DEFAULT_MAX_EMAILS;
  const db=createRest({url,key});
  // Roles come from the same public search, with the same public key, that the website uses.
  const publicDb=createRest({url,key:supabaseConfig.publishableKey});
  const send=live?createResendSender({apiKey:process.env.RESEND_API_KEY}):async()=>{throw new Error('Dry run: sending is disabled.');};
  console.log(live?`Live run: sending up to ${maxEmails} emails.`:'Dry run: nothing will be sent or written. Set WILSY_ALERTS_SEND=1 to send.');
  const report=await runAlerts({live,maxEmails,fx:await loadFx(),verbose:process.env.WILSY_ALERTS_VERBOSE==='1'&&!process.env.GITHUB_ACTIONS,
    loadSearches:()=>loadAlertSearches(db),getUser:id=>loadUser(db,id),search:filters=>searchJobs(publicDb,filters),
    send,mark:(userId,searches,at)=>markAlerted(db,userId,searches,at)});
  const {errors,...totals}=report;
  console.log(JSON.stringify({...totals,errors:errors.slice(0,5)}));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summaryMarkdown(report)).catch(()=>{});
  if(report.stopped||report.sendErrors||report.searchErrors||report.markErrors)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
