// Unstop internships as a partner feed for /jobs (public.jobs through wilsy_ingest_partner).
//
// Source: Unstop's public opportunity search API, the one the hackathon and competition collectors
// already read (robots.txt allows /api/public/*; its terms have no clause against automated reading).
//
// Quality rules, chosen by the founders on 23 Nov 2026 (docs/startup-upgrade-plan.md):
//   - paid only: the listing says paid, with the stipend shown and more than zero;
//   - never a fee: listings Unstop marks as paid to apply are left out;
//   - open, public listings only;
//   - a tech role by its title (WILSY's jobs are tech roles; wilsy_ingest_partner checks again).
//
// Not active yet: wilsy_ingest_partner accepts only 'thejobcompany' until the reviewed SQL in
// docs/proposals/unstop-internships.sql is applied. Until then run it with --dry-run.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/unstop-internships.mjs [--dry-run]
import path from 'node:path';
import {plainText,workMode,TECH_ROLE} from './boards.mjs';
import {createClient} from './http.mjs';
import {createDb,chunkJobs} from './collect.mjs';

export const SOURCE='unstop',SOURCE_NAME='Unstop';
const MAX_PAGES=20,PAGE_SIZE=100;
const https=url=>{try{const u=new URL(String(url||''));return u.protocol==='https:'&&u.hostname==='unstop.com'?u.toString():null;}catch{return null;}};
const iso=value=>{if(!value)return null;const d=new Date(String(value).replace(' GMT','').replace(/ (?=\d{2}:)/,'T'));return Number.isNaN(d.getTime())?null:d.toISOString();};
const inr=n=>`₹${Number(n).toLocaleString('en-IN')}`;
const MODES={wfh:'remote',hybrid:'hybrid',in_office:'onsite',on_field:'onsite'};

// Why a listing is left out, or null when it meets the quality rules.
export function rejection(item) {
  const jd=item.jobDetail||{},min=Number(jd.min_salary),max=Number(jd.max_salary||jd.min_salary);
  if(item.regn_open!==1||String(item.status).toUpperCase()!=='LIVE'||item.visibility!=='public')return 'closed';
  if(item.isPaid===true)return 'fee';
  if(jd.paid_unpaid!=='paid')return 'unpaid';
  if(jd.show_salary!==1||jd.not_disclosed===true||!(min>0)||!(max>0)||jd.currency!=='fa-rupee')return 'stipend_not_shown';
  if(!https(item.seo_url))return 'no_link';
  // The database's tech filter also reads the description, and Unstop descriptions often open with a
  // company blurb that mentions AI or engineering. So the role title alone must be a tech role here.
  if(!TECH_ROLE.test(String(item.title||'').toLowerCase()))return 'not_tech';
  return null;
}

export function normaliseInternship(item) {
  const jd=item.jobDetail||{},min=Math.min(Number(jd.min_salary),Number(jd.max_salary||jd.min_salary)),max=Math.max(Number(jd.min_salary),Number(jd.max_salary||jd.min_salary));
  const period=jd.pay_in==='monthly'?'month':null,mode=MODES[jd.type]||workMode(jd.type);
  const places=[...new Set((item.locations||[]).map(l=>l?.city).concat(jd.locations||[]).filter(Boolean))];
  const location=mode==='remote'?'Remote':places.join(', ')||null;
  const url=https(item.seo_url);
  return {
    external_id:String(item.id),title:String(item.title||'').trim(),company:String(item.organisation?.name||'').trim(),
    url,source_url:url,location,work_mode:mode,job_type:'internship',employment_type_raw:jd.timing||null,
    description:plainText(item.details,50000)||null,posted_at:iso(item.approved_date)||iso(item.updated_at),
    salary_min:min,salary_max:max,salary_currency:'INR',salary_period:period,
    salary_text:`${min===max?inr(min):`${inr(min)}–${inr(max).slice(1)}`}${period?' a month':''} stipend`
  };
}

export async function readInternships(get) {
  const items=new Map();
  for(let page=1;page<=MAX_PAGES;page++){
    const body=await get(`https://unstop.com/api/public/opportunity/search-result?opportunity=internships&oppstatus=open&per_page=${PAGE_SIZE}&page=${page}`);
    const data=body?.data;
    if(!Array.isArray(data?.data))throw new Error('Unexpected Unstop response');
    for(const item of data.data)if(item?.id!=null&&!items.has(item.id))items.set(item.id,item);
    if(page>=Number(data.last_page||1)||!data.data.length)break;
  }
  const kept=[],left={};
  for(const item of items.values()){const why=rejection(item);if(why)left[why]=(left[why]||0)+1;else kept.push(normaliseInternship(item));}
  return {listed:items.size,kept,left};
}

async function main() {
  const dry=process.argv.includes('--dry-run'),client=createClient();
  const {listed,kept,left}=await readInternships(client.json);
  if(!listed)throw new Error('Unstop listed no internships; the API may have changed.');
  if(dry){
    console.log(JSON.stringify({listed,kept:kept.length,left}));
    console.log(JSON.stringify(kept.slice(0,3).map(j=>({...j,description:j.description?.slice(0,120)})),null,2));
    return;
  }
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.');
  const db=createDb({url,key}),totals={listed,kept:kept.length,...left};
  const add=r=>{for(const [k,v] of Object.entries(r||{}))if(typeof v==='number')totals[k]=(totals[k]||0)+v;};
  for(const chunk of chunkJobs(kept,{maxJobs:25}))add(await db('rpc/wilsy_ingest_partner',{body:{feed:{source:SOURCE,name:SOURCE_NAME,jobs:chunk}}}));
  // Every kept listing counts as seen; internships unseen for three days close.
  add(await db('rpc/wilsy_ingest_partner',{body:{feed:{source:SOURCE,name:SOURCE_NAME,jobs:[],seen:kept.map(j=>j.source_url),expire:true}}}));
  console.log(JSON.stringify(totals));
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
