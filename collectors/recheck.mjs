// Rechecks published jobs that the hourly collectors have not seen for a few days, and closes the ones
// that are gone. The collectors only close roles on the boards they read, so a role from a board that
// was later removed, moved to another service or never added (one-off imports) stayed published forever.
//
// Each job is looked up on the board its own link points to (Greenhouse, Ashby, Lever, Workable,
// SmartRecruiters, Recruitee), one read per board. A role still on its board is marked seen; a role no
// longer on it, or on a board that no longer exists, is closed. Other links are opened once: a 404 or
// 410 closes the role. A role that cannot be checked at all (a company page that always opens, or a
// board guessed from ?gh_jid= that does not exist) is closed once nobody has confirmed it for
// UNVERIFIED_DAYS. A timeout, rate limit or server error never closes anything: the role waits for
// the next run.
//
// Usage (GitHub Actions): SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/recheck.mjs
// Plan only, no writes, with the public key: node collectors/recheck.mjs --plan --out plan.json
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createClient,pool} from './http.mjs';
import {createDb} from './collect.mjs';

export const STALE_DAYS=3;
export const UNVERIFIED_DAYS=60;
const PAGE=1000;
const WRITE_CHUNK=150;
const SMARTRECRUITERS_MAX=5000;
const DAY=86_400_000;

const decodeSlug=s=>{try{return decodeURIComponent(s);}catch{return s;}};

// The board and role a job link points to, or null for links that are not on a known job board.
// guessed: the board name was not in the link (a company site carrying ?gh_jid=), so a missing
// board is not proof the role closed.
export function boardOf(job) {
  for(const raw of [job.apply_url,job.job_url,job.source_url]){
    const url=String(raw||'');let m;
    if((m=url.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?!embed\/)([a-z0-9_-]+)\/jobs\/(\d+)/i)))return {ats:'greenhouse',slug:m[1].toLowerCase(),id:m[2]};
    if((m=url.match(/greenhouse\.io\/embed\/job_app\?(?=.*\bfor=([a-z0-9_-]+))(?=.*\btoken=(\d+))/i)))return {ats:'greenhouse',slug:m[1].toLowerCase(),id:m[2]};
    if((m=url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)))return {ats:'ashby',slug:decodeSlug(m[1]),id:m[2].toLowerCase()};
    if((m=url.match(/jobs\.(?:eu\.)?lever\.co\/([^/?#]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)))return {ats:'lever',slug:decodeSlug(m[1]),id:m[2].toLowerCase(),eu:/jobs\.eu\.lever/i.test(url)};
    if((m=url.match(/apply\.workable\.com\/([^/?#]+)\/j\/([a-z0-9]+)/i)))return {ats:'workable',slug:decodeSlug(m[1]),id:m[2].toUpperCase()};
    if((m=url.match(/jobs\.smartrecruiters\.com\/([^/?#]+)\/(\d+)/i)))return {ats:'smartrecruiters',slug:decodeSlug(m[1]),id:m[2]};
    if((m=url.match(/\/\/([a-z0-9-]+)\.recruitee\.com\/o\/([^/?#]+)/i)))return {ats:'recruitee',slug:m[1].toLowerCase(),id:m[2].toLowerCase()};
  }
  const jid=[job.apply_url,job.job_url,job.source_url].map(u=>String(u||'').match(/[?&]gh_jid=(\d+)/)).find(Boolean);
  const slug=String(job.company_slug||job.company||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  if(jid&&slug)return {ats:'greenhouse',slug,id:jid[1],guessed:true};
  return null;
}

const ids=(value,service,pick)=>{if(!Array.isArray(value))throw new Error(`Unexpected ${service} response`);return new Set(value.map(pick).map(String));};

// Every role id currently listed on a board, from the same public APIs the collectors use.
export const LISTERS={
  greenhouse:async(slug,get)=>ids((await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`))?.jobs,'Greenhouse',j=>j.id),
  ashby:async(slug,get)=>{
    const data=await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
    if(!Array.isArray(data?.jobs))throw new Error('Unexpected Ashby response');
    return new Set(data.jobs.filter(j=>j.isListed!==false).map(j=>String(j.id).toLowerCase()));
  },
  lever:async(slug,get,{eu}={})=>{
    const data=await get(`https://api.${eu?'eu.':''}lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    return ids(data,'Lever',j=>String(j.id).toLowerCase());
  },
  workable:async(slug,get)=>ids((await get(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`))?.jobs,'Workable',j=>String(j.shortcode||j.code).toUpperCase()),
  smartrecruiters:async(slug,get)=>{
    const found=new Set();
    for(let offset=0;;offset+=100){
      // A truncated list must never be used to close roles.
      if(offset>=SMARTRECRUITERS_MAX){const e=new Error('SmartRecruiters list truncated');e.partial=true;throw e;}
      const page=await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}`);
      if(!Array.isArray(page?.content))throw new Error('Unexpected SmartRecruiters response');
      for(const p of page.content)found.add(String(p.id));
      if(!page.content.length||found.size>=(page.totalFound||0))return found;
    }
  },
  recruitee:async(slug,get)=>ids((await get(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`))?.offers,'Recruitee',o=>String(o.slug||'').toLowerCase())
};

// Sorts stale jobs into open (still listed), closed (with a reason) and unknown (could not tell).
// list(ats,slug,board) returns a Set of role ids; page(url) resolves when the page opens.
export async function decide(jobs,{list,page,now=Date.now(),concurrency=6}) {
  const groups=new Map(),loose=[];
  for(const job of jobs){
    const board=boardOf(job);
    if(!board){loose.push(job);continue;}
    const key=`${board.ats}:${board.slug}:${board.eu?'eu':''}:${board.guessed?'g':''}`;
    if(!groups.has(key))groups.set(key,{board,jobs:[]});
    groups.get(key).jobs.push({job,id:board.id});
  }
  const open=[],closed=[],unknown=[];
  // reason closes the role; unverifiable roles close after UNVERIFIED_DAYS; anything else waits.
  const settle=(job,reason,unverifiable=false)=>{
    if(reason){closed.push({id:job.id,reason});return;}
    const seen=Date.parse(job.last_seen_at||job.created_at||0)||0;
    if(unverifiable&&now-seen>UNVERIFIED_DAYS*DAY)closed.push({id:job.id,reason:`not confirmed for ${UNVERIFIED_DAYS} days`});
    else unknown.push(job.id);
  };
  await pool([...groups.values()],concurrency,async({board,jobs:members})=>{
    let listed;
    try{listed=await list(board.ats,board.slug,board);}
    catch(error){
      const missing=error?.status===404||error?.status===410;
      for(const {job} of members)settle(job,missing&&!board.guessed?'board no longer exists':null,missing&&board.guessed);
      return;
    }
    // An empty answer is not proof that every role closed (the collectors follow the same rule).
    if(!listed.size){for(const {job} of members)settle(job,null);return;}
    // On a guessed board a missing role may simply belong to another board, so it only counts as
    // unconfirmed.
    for(const {job,id} of members){
      if(listed.has(String(id)))open.push(job.id);
      else if(board.guessed)settle(job,null,true);
      else closed.push({id:job.id,reason:'no longer on its board'});
    }
  });
  await pool(loose,concurrency,async job=>{
    const url=[job.apply_url,job.job_url,job.source_url].find(u=>/^https:\/\//i.test(u||''));
    if(!url)return settle(job,null,true);
    try{await page(url);settle(job,null,true);}
    catch(error){settle(job,error?.status===404||error?.status===410?'page no longer exists':null);}
  });
  return {open,closed,unknown};
}

export function summary({checked,open,closed,unknown}) {
  const reasons={};for(const c of closed)reasons[c.reason]=(reasons[c.reason]||0)+1;
  return {checked,still_open:open.length,closed:closed.length,unknown:unknown.length,reasons};
}

export function summaryMarkdown(s) {
  return ['### Stale job recheck','',`Checked ${s.checked} published roles not seen for ${STALE_DAYS}+ days.`,'',
    '| still open | closed | could not tell |','|---|---|---|',`| ${s.still_open} | ${s.closed} | ${s.unknown} |`,'',
    ...Object.entries(s.reasons).map(([r,n])=>`- ${n} closed: ${r}`),''].join('\n');
}

const inList=values=>`in.(${values.join(',')})`;

async function main() {
  const {values:args}=parseArgs({options:{plan:{type:'boolean'},out:{type:'string'},days:{type:'string'}}});
  const plan=!!args.plan,days=Number(args.days||STALE_DAYS);
  const url=process.env.SUPABASE_URL||'https://pnkthqatdlozrojwefnc.supabase.co';
  let key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(plan&&!key)key=(await import('../frontend/js/supabase-config.js')).supabaseConfig.publishableKey;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --plan.');
  const db=createDb({url,key});
  const cutoff=new Date(Date.now()-days*DAY).toISOString();
  const jobs=[];
  for(let offset=0;;offset+=PAGE){
    const rows=await db(`jobs?select=id,company,company_slug,apply_url,job_url,source_url,last_seen_at,created_at&status=eq.published`
      +`&or=(last_seen_at.lt.${cutoff},last_seen_at.is.null)&order=id.asc&limit=${PAGE}&offset=${offset}`);
    if(!Array.isArray(rows))throw new Error('Unexpected jobs response');
    jobs.push(...rows);
    if(rows.length<PAGE)break;
  }
  const client=createClient({perHost:2,timeoutMs:25000,retries:3});
  const result=await decide(jobs,{list:(ats,slug,board)=>LISTERS[ats](slug,client.json,board),page:u=>client.page(u)});
  const s=summary({checked:jobs.length,...result});
  if(!plan){
    const stamp=new Date().toISOString();
    for(let i=0;i<result.closed.length;i+=WRITE_CHUNK)
      await db(`jobs?id=${inList(result.closed.slice(i,i+WRITE_CHUNK).map(c=>c.id))}&status=eq.published`,
        {method:'PATCH',prefer:'return=minimal',body:{status:'expired',closed_at:stamp,updated_at:stamp}});
    for(let i=0;i<result.open.length;i+=WRITE_CHUNK)
      await db(`jobs?id=${inList(result.open.slice(i,i+WRITE_CHUNK))}&status=eq.published`,
        {method:'PATCH',prefer:'return=minimal',body:{last_seen_at:stamp,last_verified_at:stamp,updated_at:stamp}});
  }
  if(args.out)await fs.writeFile(path.resolve(args.out),JSON.stringify({...s,open:result.open,closed:result.closed,unknown:result.unknown},null,1));
  console.log(JSON.stringify({mode:plan?'plan':'applied',...s}));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summaryMarkdown(s)).catch(()=>{});
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
