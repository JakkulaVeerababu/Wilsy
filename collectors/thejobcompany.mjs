// Partner feed: The Job Company (thejobcompany.co.in). Collected with the site owner's permission
// (collaboration agreed with WILSY's founder, November 2026). Jobs keep "The Job Company" as their
// source and link back to its job page; the Apply button goes to the employer's own application link.
//
// Each run reads the newest listing pages, opens the job page and apply page only for jobs WILSY has
// not stored yet, and marks the jobs it already has as still listed. Requests go one at a time with a
// pause between them, so the partner's site sees at most about one request a second.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/thejobcompany.mjs [--pages 3] [--dry-run]
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {plainText,jobType,workMode} from './boards.mjs';
import {createClient} from './http.mjs';
import {createDb,chunkJobs} from './collect.mjs';

export const SOURCE='thejobcompany';
export const SOURCE_NAME='The Job Company';
export const ORIGIN='https://thejobcompany.co.in';
export const jobPageUrl=id=>`${ORIGIN}/frontend/job_details?job_id=${id}`;
const applyPageUrl=id=>`${ORIGIN}/frontend/apply_page.php?job_id=${id}`;
const MAX_DETAILS=120; // new jobs read per run; the backlog continues next hour
const pause=ms=>new Promise(r=>setTimeout(r,ms));

const between=(html,start,end)=>{const i=html.indexOf(start);if(i<0)return null;const j=html.indexOf(end,i+start.length);return j<0?null:html.slice(i+start.length,j);};
const text=html=>html==null?null:plainText(html,2000)?.replace(/\s+/g,' ').trim()||null;

// Job IDs on a listing page, newest first, without duplicates.
export function listingIds(html) {
  const ids=[...String(html).matchAll(/job_details(?:\.php)?\?job_id=(\d+)/g)].map(m=>Number(m[1]));
  return [...new Set(ids)].sort((a,b)=>b-a);
}

const MONTHS={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
export function parseDate(value) {
  const m=/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i.exec(value||'');
  if(!m||!(m[2].toLowerCase() in MONTHS))return null;
  return new Date(Date.UTC(Number(m[3]),MONTHS[m[2].toLowerCase()],Number(m[1]))).toISOString();
}

// "35 - 55 LPA", "12 LPA", "4.5-6 LPA" become yearly INR amounts; anything else stays text only.
export function parseSalary(value) {
  const t=String(value||'').trim();
  if(!t||/not disclosed|n\/a|^-$/i.test(t))return {};
  const m=/^₹?\s*(\d+(?:\.\d+)?)\s*(?:(?:-|to|–)\s*₹?\s*(\d+(?:\.\d+)?))?\s*(?:lpa|lakhs? per annum|lakhs?)\b/i.exec(t);
  if(m){
    const min=Math.round(Number(m[1])*100000),max=Math.round(Number(m[2]??m[1])*100000);
    return {salary_text:t,salary_min:Math.min(min,max),salary_max:Math.max(min,max),salary_currency:'INR',salary_period:'year'};
  }
  // Monthly stipends: "40,000/ Month", "70,000- 80,000/Month", "25K per month".
  const s=/^₹?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:(?:-|to|–)\s*₹?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?)?\s*(?:\/|per)\s*month/i.exec(t);
  if(!s)return {salary_text:t};
  const amount=(n,k)=>Math.round(Number(n.replace(/,/g,''))*(k?1000:1));
  const lo=amount(s[1],s[2]),hi=s[3]?amount(s[3],s[4]||s[2]):lo;
  if(!(lo>0&&hi>0))return {salary_text:t};
  return {salary_text:t,salary_min:Math.min(lo,hi),salary_max:Math.max(lo,hi),salary_currency:'INR',salary_period:'month'};
}

export function graduationYears(value) {
  return [...new Set([...String(value||'').matchAll(/\b(20[1-4]\d)\b/g)].map(m=>Number(m[1])))].sort();
}

// Fields from a job details page. Returns null when the page is not a job (deleted or moved).
export function parseJobPage(html,id) {
  const title=text(between(html,'<p class="position">','</p>'));
  const company=text(between(html,'<p class="company-name">','</p>'));
  if(!title||!company)return null;
  const facts={};
  for(const m of String(html).matchAll(/<p class="text-head">([\s\S]*?)<\/p>\s*<p class="text-ans">([\s\S]*?)<\/p>/g))facts[text(m[1]).toLowerCase()]=text(m[2]);
  const start=html.indexOf('<div class="jd-content">');
  const end=start<0?-1:html.indexOf('<div class="apply-main"',start);
  const description=start<0?null:plainText(html.slice(start,end<0?undefined:end),50000);
  const location=facts['work location']||null,type=facts['job type']||'';
  return {external_id:String(id),company,title,location,description,
    job_type:jobType(type,title),work_mode:workMode(location,type),employment_type_raw:type||null,
    posted_at:parseDate(between(html,'Updated on:','<')),
    education:facts['stream required']||null,graduation_years:graduationYears(facts.batch),
    ...parseSalary(facts.salary),source_url:jobPageUrl(id)};
}

// The employer's application link behind the partner's Apply Now button.
export function parseApplyLink(html) {
  const m=/id="applyButton"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*id="applyButton"/.exec(String(html));
  const href=(m?.[1]||m?.[2]||'').replace(/&amp;/g,'&').trim();
  try{
    const u=new URL(href);u.hash='';
    return u.protocol==='https:'&&!u.hostname.endsWith('thejobcompany.co.in')?u.href.replace(/\?$/,''):null;
  }catch{return null;}
}

// Reads one job: details page, then apply page. Without an employer link the partner's own job page
// is the apply link, so the role is still reachable.
export async function readJob(id,{page,wait=pause,gapMs=1000}) {
  const details=await page(jobPageUrl(id));
  const job=parseJobPage(details.text,id);
  if(!job)return null;
  await wait(gapMs);
  let apply=null;
  try{apply=parseApplyLink((await page(applyPageUrl(id))).text);}catch{}
  return {...job,url:apply||job.source_url};
}

// One run: listing pages → which IDs are new → read new jobs → save them, and mark known ones seen.
// Partner job IDs only grow. `readRange` ({min,max}: the IDs earlier runs already read) keeps non-tech
// jobs, which are never stored, from being read again every hour, while a deeper run still reads older
// IDs below it. New IDs are read newest first, so a run that stops at maxDetails keeps the range whole.
export async function run({pages=3,page,knownIds,ingest,readRange=null,wait=pause,gapMs=1000,maxDetails=MAX_DETAILS,log=()=>{}}) {
  const ids=[];
  for(let p=1;p<=pages;p++){
    const found=listingIds((await page(`${ORIGIN}/?page=${p}`)).text);
    if(!found.length)break;
    ids.push(...found);
    await wait(gapMs);
  }
  const unique=[...new Set(ids)];
  if(!unique.length)throw new Error('No jobs found on the listing pages; the site layout may have changed.');
  const known=await knownIds(unique); // Map id -> status
  const already=id=>readRange&&id>=readRange.min&&id<=readRange.max;
  // Newest IDs above the range first, then older ones below it, so the range only ever grows contiguously.
  const above=unique.filter(id=>!already(id)&&(!readRange||id>readRange.max)&&known.get(String(id))!=='published').sort((a,b)=>a-b);
  const below=unique.filter(id=>!already(id)&&readRange&&id<readRange.min&&known.get(String(id))!=='published').sort((a,b)=>b-a);
  const fresh=[...above,...below].slice(0,maxDetails);
  const seen=unique.filter(id=>known.get(String(id))==='published').map(jobPageUrl);
  // Only a contiguous stretch counts as read: newest-above IDs are read oldest first and older-below
  // IDs newest first, so stopping at maxDetails never leaves a gap inside the range.
  const readAbove=fresh.filter(id=>!readRange||id>readRange.max),readBelow=fresh.filter(id=>readRange&&id<readRange.min);
  const range=fresh.length||readRange?{min:Math.min(readRange?.min??Infinity,...readAbove,...readBelow),max:Math.max(readRange?.max??-Infinity,...readAbove,...readBelow)}:null;
  const jobs=[],errors=[];
  for(const id of fresh){
    try{const job=await readJob(id,{page,wait,gapMs});if(job)jobs.push(job);}
    catch(error){errors.push(`${id}: ${error.message}`);}
    await wait(gapMs);
  }
  const totals={listed:unique.length,read:jobs.length,read_errors:errors.length};
  const add=r=>{for(const [k,v] of Object.entries(r||{}))if(typeof v==='number')totals[k]=(totals[k]||0)+v;};
  for(const chunk of chunkJobs(jobs,{maxJobs:10}))add(await ingest({source:SOURCE,name:SOURCE_NAME,jobs:chunk}));
  add(await ingest({source:SOURCE,name:SOURCE_NAME,jobs:[],seen,expire:true}));
  log(JSON.stringify({...totals,range,errors:errors.slice(0,5)}));
  return {...totals,range,errors};
}

async function main() {
  const {values:args}=parseArgs({options:{pages:{type:'string'},'dry-run':{type:'boolean'}}});
  const pages=Number(args.pages||3),dry=!!args['dry-run'];
  const client=createClient({perHost:1});
  let db=null;
  if(!dry){
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.');
    db=createDb({url,key});
  }
  const knownIds=async ids=>{
    if(dry)return new Map();
    const rows=await db(`jobs?select=external_job_id,status&ats_platform=eq.${SOURCE}&external_job_id=in.(${ids.join(',')})`);
    return new Map(rows.map(r=>[r.external_job_id,r.status]));
  };
  const sample=[];
  const ingest=async payload=>{
    if(dry){sample.push(...payload.jobs);return {found:payload.jobs.length};}
    return db('rpc/wilsy_ingest_partner',{body:{feed:payload}});
  };
  const RUNS='job_ingestion_runs',SCHEDULE='Partner feed: The Job Company';
  let readRange=null;
  if(!dry){
    const last=await db(`${RUNS}?select=metadata&schedule_name=eq.${encodeURIComponent(SCHEDULE)}&order=started_at.desc&limit=1`);
    const m=last?.[0]?.metadata;
    if(Number.isInteger(m?.min_id)&&Number.isInteger(m?.max_id))readRange={min:m.min_id,max:m.max_id};
  }
  const started=new Date();
  const result=await run({pages,page:client.page,knownIds,ingest,readRange,maxDetails:dry?Math.min(MAX_DETAILS,pages*12):MAX_DETAILS,log:console.log});
  if(!dry)await db(RUNS,{prefer:'return=minimal',body:{run_key:`partner-${SOURCE}-${started.getTime()}`,schedule_name:SCHEDULE,
    source_scope:`${SOURCE} pages 1-${pages}`,started_at:started.toISOString(),finished_at:new Date().toISOString(),
    companies_checked:1,jobs_found:result.found||0,jobs_inserted:result.inserted||0,jobs_updated:result.updated||0,invalid_skipped:result.invalid||0,
    sources_failed:result.read_errors?1:0,status:result.read_errors?(result.read?'partial':'failed'):'success',
    error_summary:result.errors.slice(0,20).join(' | ')||null,
    metadata:{worker:'partner',partner:SOURCE,min_id:result.range?.min??null,max_id:result.range?.max??null,listed:result.listed,read:result.read,unchanged:result.unchanged||0,
      duplicate:result.duplicate||0,seen:result.seen||0,expired:result.expired||0,other_roles:result.other_roles||0}}});
  if(dry)console.log(JSON.stringify(sample.slice(0,3).map(j=>({...j,description:j.description?.slice(0,160)})),null,2));
  if(process.env.GITHUB_STEP_SUMMARY){
    const cols=['listed','read','found','inserted','updated','unchanged','duplicate','seen','expired','other_roles','read_errors'];
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,[`### ${SOURCE_NAME}`,'',`| ${cols.join(' | ')} |`,`|${'---|'.repeat(cols.length)}`,
      `| ${cols.map(c=>result[c]||0).join(' | ')} |`,'',...result.errors.slice(0,10).map(e=>`- ${e}`),''].join('\n')).catch(()=>{});
  }
  if(!result.read&&result.read_errors)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
