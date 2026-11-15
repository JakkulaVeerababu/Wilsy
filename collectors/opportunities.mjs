// Opportunities collector: competitions and coding contests for public.opportunities
// (table and read functions: docs/proposals/opportunities.sql).
//
// Sources and why they may be read:
// - Unstop competitions and quizzes: the same public API the hackathon collector uses. Its robots.txt
//   allows /api/public/*, and its terms of use have no clause against automated reading.
// - Codeforces: the official API (contest.list), called once per run; its limit is 1 call per 2 seconds.
//   Its terms forbid commercialising site material, so only contest facts are stored: name, start,
//   length and link. No descriptions or problems.
// - AtCoder: the public contests page (robots.txt allows it; its terms have no clause against
//   automated reading). Facts only, as for Codeforces.
// CodeChef and Hasgeek (terms forbid crawling), LeetCode (robots.txt blocks its API), Internshala,
// Devpost and MLH are never read.
//
// Only listing facts are stored: no participants, contact details or raw payloads.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/opportunities.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {plainText} from './boards.mjs';
import {createClient} from './http.mjs';

export const SOURCES={unstop:'Unstop',codeforces:'Codeforces',atcoder:'AtCoder'};
const MAX_PAGES=20,PAGE_SIZE=100;
// Unstop's competition kinds, mapped to the short subtypes the site filters on. Anything else
// (workshops, events, webinars) is not a competition. Hackathon-type items are left out: they
// already appear in the Hackathons section.
const UNSTOP_SUBTYPES={case_competition:'case',innovation_challenge:'innovation',online_coding_challenge:'coding',general_competition:'general'};
export function unstopSubtype(item) {
  const type=String(item.type||'').toLowerCase(),sub=subtypeOf(item.subtype);
  if(type==='quizzes')return 'quiz';
  if(type!=='competitions')return null;
  if(!sub||sub==='null')return 'general';
  return sub==='quizzes'?'quiz':UNSTOP_SUBTYPES[sub]||null;
}

const https=url=>{try{const u=new URL(String(url||''));return u.protocol==='https:'&&u.hostname?u.toString():null;}catch{return null;}};
const iso=value=>{if(!value)return null;const d=new Date(String(value).replace(' GMT','').replace(/ (?=\d{2}:)/,'T'));return Number.isNaN(d.getTime())?null:d.toISOString();};
const text=(value,max=200)=>{const t=String(value??'').replace(/\s+/g,' ').trim();return t?t.slice(0,max):null;};
const uniq=values=>[...new Set(values.map(v=>text(v,60)).filter(Boolean))].slice(0,12);
const smallInt=v=>Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<1000?Number(v):null;
const subtypeOf=value=>{const s=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);return s||null;};
const inr=n=>`₹${Number(n).toLocaleString('en-IN')}`;

// Every row has the same keys, so a batch upsert sends one consistent column list.
function row(f) {
  return {kind:f.kind,subtype:f.subtype??null,source_name:f.source_name,external_id:String(f.external_id),title:text(f.title,200),
    organizer:text(f.organizer,200),description:f.description||null,eligibility:text(f.eligibility,600),tags:f.tags||[],
    participation_mode:['online','offline','hybrid'].includes(f.participation_mode)?f.participation_mode:null,
    city:text(f.city,80),country:text(f.country,80),official_url:https(f.official_url),registration_url:https(f.registration_url),
    registration_opens_at:f.registration_opens_at||null,registration_deadline_at:f.registration_deadline_at||null,
    starts_at:f.starts_at||null,ends_at:f.ends_at||null,duration_minutes:f.duration_minutes||null,
    team_size_min:smallInt(f.team_size_min),team_size_max:smallInt(f.team_size_max),
    prize_text:text(f.prize_text,300),prize_amount:f.prize_amount??null,prize_currency:f.prize_currency??null,rated_range:text(f.rated_range,40)};
}

// ---------- Unstop ----------
export function normaliseUnstopCompetition(item) {
  const regn=item.regnRequirements||{},place=item.address_with_country_logo||{};
  const mode=String(item.region||'').toLowerCase();
  const cash=(Array.isArray(item.prizes)?item.prizes:[]).filter(p=>Number(p.cash)>0);
  const currencies=[...new Set(cash.map(p=>String(p.currencyCode||'').toUpperCase()))];
  const pool=cash.length&&currencies.length===1&&currencies[0]==='INR'?cash.reduce((sum,p)=>sum+Number(p.cash),0):null;
  const eligible=(Array.isArray(item.filters)?item.filters:[]).filter(f=>f?.type==='eligible').map(f=>f.name);
  const subtype=unstopSubtype(item);
  return {
    // Listed only while registration is open, the page is public, and entry is free.
    open:!!subtype&&item.regn_open===1&&String(item.status).toUpperCase()==='LIVE'&&item.visibility==='public'&&item.isPaid!==true,
    row:row({kind:'competition',subtype,source_name:SOURCES.unstop,external_id:item.id,title:item.title,organizer:item.organisation?.name,
      description:plainText(item.details,6000)||null,eligibility:eligible.length?`Open to: ${uniq(eligible).join(', ')}.`:null,
      tags:uniq([...(item.required_skills||[]).map(s=>s?.skill_name||s?.skill),...(item.workfunction||[]).map(w=>w?.name)]),
      participation_mode:mode,city:mode==='online'?null:place.city,country:mode==='online'?null:(place.country?.name||place.country),
      official_url:https(item.seo_url)||https(`https://unstop.com/${String(item.public_url||'').replace(/^\/+/,'')}`),
      registration_opens_at:iso(regn.start_regn_dt),registration_deadline_at:iso(regn.end_regn_dt),ends_at:iso(item.end_date),
      team_size_min:regn.min_team_size,team_size_max:regn.max_team_size,
      prize_amount:pool,prize_currency:pool?'INR':null,prize_text:pool?`${inr(pool)} in cash prizes`:null})
  };
}
export async function readUnstopCompetitions(get) {
  const items=new Map();
  for(const type of ['competitions','quizzes']){
    for(let page=1;page<=MAX_PAGES;page++){
      const body=await get(`https://unstop.com/api/public/opportunity/search-result?opportunity=${type}&oppstatus=open&per_page=${PAGE_SIZE}&page=${page}`);
      const data=body?.data;
      if(!Array.isArray(data?.data))throw new Error('Unexpected Unstop response');
      for(const item of data.data)if(item?.id!=null&&!items.has(item.id))items.set(item.id,item);
      if(page>=Number(data.last_page||1)||!data.data.length)break;
    }
  }
  return [...items.values()].map(normaliseUnstopCompetition);
}

// ---------- Codeforces ----------
export function codeforcesSubtype(name) {
  const n=String(name);
  if(/educational/i.test(n))return 'educational';
  if(/global round/i.test(n))return 'global';
  const divisions=[...n.matchAll(/div\.?\s*(\d)/gi)].map(m=>m[1]);
  if(divisions.length)return 'div'+[...new Set(divisions)].sort().join('_div');
  return 'other';
}
export function normaliseCodeforces(contest) {
  const start=Number(contest.startTimeSeconds),length=Number(contest.durationSeconds);
  const startsAt=Number.isFinite(start)&&start>0?new Date(start*1000).toISOString():null;
  return {
    open:contest.phase==='BEFORE'&&!!startsAt,
    row:row({kind:'contest',subtype:codeforcesSubtype(contest.name),source_name:SOURCES.codeforces,external_id:contest.id,title:contest.name,
      organizer:'Codeforces',participation_mode:'online',official_url:`https://codeforces.com/contests/${encodeURIComponent(contest.id)}`,
      starts_at:startsAt,ends_at:startsAt&&length>0?new Date((start+length)*1000).toISOString():null,
      duration_minutes:length>0?Math.round(length/60):null})
  };
}
export async function readCodeforces(get) {
  const body=await get('https://codeforces.com/api/contest.list?gym=false');
  if(body?.status!=='OK'||!Array.isArray(body.result))throw new Error('Unexpected Codeforces response');
  return body.result.filter(c=>c.phase==='BEFORE').map(normaliseCodeforces);
}

// ---------- AtCoder ----------
const decodeHtml=s=>String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'");
export function parseAtCoder(html) {
  const table=/<div id="contest-table-upcoming">([\s\S]*?)<\/table>/.exec(String(html))?.[1];
  if(!table)throw new Error('AtCoder upcoming table not found');
  const rows=[...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(r=>r.includes('<td'));
  return rows.map(r=>{
    const time=/<time[^>]*>([^<]+)<\/time>/.exec(r)?.[1]?.trim();
    const link=/<a href="\/contests\/([A-Za-z0-9_-]+)">([^<]+)<\/a>/.exec(r);
    const cells=[...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
    const [h,m]=String(cells[2]||'').split(':').map(Number);
    const startsAt=time?iso(time.replace(/^(\S+) (\S+?)([+-]\d{2})(\d{2})$/,'$1T$2$3:$4')):null;
    const minutes=Number.isFinite(h)&&Number.isFinite(m)&&h*60+m>0?h*60+m:null;
    const slug=link?.[1];
    return {
      open:!!(slug&&startsAt),
      row:row({kind:'contest',subtype:subtypeOf(/^(abc|arc|agc|ahc)/.exec(slug||'')?.[1]||'other'),source_name:SOURCES.atcoder,external_id:slug||'',
        title:link?decodeHtml(link[2]):null,organizer:'AtCoder',participation_mode:'online',
        official_url:slug?`https://atcoder.jp/contests/${slug}`:null,starts_at:startsAt,
        ends_at:startsAt&&minutes?new Date(Date.parse(startsAt)+minutes*60000).toISOString():null,duration_minutes:minutes,
        rated_range:decodeHtml(cells[3]||'').replace(/\s+/g,' ')||null})
    };
  });
}
export async function readAtCoder(page) {
  return parseAtCoder((await page('https://atcoder.jp/contests/?lang=en')).text);
}

// ---------- Plan ----------
// Listed only while it can still be entered: registration open (competitions) or not yet ended (contests).
export function isListable(item,now=Date.now()) {
  const r=item.row;
  if(!item.open||!r.title||!r.external_id||!r.official_url)return false;
  if(r.registration_deadline_at&&Date.parse(r.registration_deadline_at)<now)return false;
  if(r.ends_at&&Date.parse(r.ends_at)<now)return false;
  return true;
}
const key=(source,id)=>`${source}:${id}`;

// Works out every write for one run. Pure, so it can be tested without a database.
export function plan({existing,fetched,readOk,now=new Date()}) {
  const stamp=now.toISOString(),nowMs=now.getTime(),seen=new Set(),upserts=[];
  for(const item of fetched){
    if(!isListable(item,nowMs))continue;
    const k=key(item.row.source_name,item.row.external_id);
    if(seen.has(k))continue;seen.add(k);
    upserts.push({...item.row,status:'live',last_seen_at:stamp,closed_at:null,closed_reason:null});
  }
  // Close what can no longer be entered (any source), and what a source read completely this run
  // no longer lists. An empty or failed read never closes anything.
  const closes=[];
  for(const r of existing){
    if(r.status!=='live'||seen.has(key(r.source_name,r.external_id)))continue;
    const reason=r.registration_deadline_at&&Date.parse(r.registration_deadline_at)<nowMs?'registration_closed'
      :r.ends_at&&Date.parse(r.ends_at)<nowMs?'ended':readOk[r.source_name]===true?'no_longer_listed':null;
    if(reason)closes.push({id:r.id,reason});
  }
  return {upserts,closes};
}

async function main() {
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!secret)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db=async(target,{body,method=body?'POST':'GET',prefer}={})=>{
    for(let attempt=0;;attempt++){
      try{
        const response=await fetch(`${url}/rest/v1/${target}`,{method,headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
          body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
        if([502,503,504].includes(response.status)&&attempt<2)throw new Error(`Database ${response.status}`);
        if(!response.ok){const error=new Error(`Database ${response.status}: ${(await response.text()).slice(0,300)}`);error.final=true;throw error;}
        const t=await response.text();return t?JSON.parse(t):null;
      }catch(error){if(error.final||attempt>=2)throw error;await new Promise(r=>setTimeout(r,500*4**attempt));}
    }
  };
  const started=new Date(),client=createClient();
  const fetched=[],readOk={},counts={},errors=[];
  for(const [name,read] of [[SOURCES.unstop,()=>readUnstopCompetitions(client.json)],[SOURCES.codeforces,()=>readCodeforces(client.json)],[SOURCES.atcoder,()=>readAtCoder(client.page)]]){
    try{const items=await read();counts[name]=items.length;readOk[name]=items.length>0;fetched.push(...items);}
    catch(error){readOk[name]=false;errors.push(`${name}: ${error.message}`);}
  }
  const existing=await db('opportunities?select=id,source_name,external_id,status,registration_deadline_at,ends_at&status=eq.live&limit=20000');
  const work=plan({existing,fetched,readOk,now:started});
  let writeErrors=0;
  for(let i=0;i<work.upserts.length;i+=200){
    try{await db('opportunities?on_conflict=source_name,external_id',{body:work.upserts.slice(i,i+200),prefer:'resolution=merge-duplicates,return=minimal'});}
    catch(error){writeErrors++;errors.push(`upsert ${i}: ${error.message}`);}
  }
  const byReason=Object.groupBy(work.closes,c=>c.reason);
  for(const [reason,items] of Object.entries(byReason)){
    for(let i=0;i<items.length;i+=200){
      try{await db(`opportunities?id=in.(${items.slice(i,i+200).map(c=>Number(c.id)).join(',')})`,{method:'PATCH',prefer:'return=minimal',
        body:{status:'closed',closed_at:started.toISOString(),closed_reason:reason}});}
      catch(error){writeErrors++;errors.push(`close ${reason}: ${error.message}`);}
    }
  }
  const failedSources=Object.values(readOk).filter(ok=>!ok).length;
  const status=!errors.length?'success':failedSources===Object.keys(readOk).length||writeErrors?'failed':'partial';
  const summary={sources:counts,listed:work.upserts.length,closed:work.closes.length,status,errors:errors.slice(0,10)};
  console.log(JSON.stringify(summary));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Competitions and contests: ${status}\n\n| Unstop | Codeforces | AtCoder | listed | closed |\n|---|---|---|---|---|\n| ${counts.Unstop??'failed'} | ${counts.Codeforces??'failed'} | ${counts.AtCoder??'failed'} | ${summary.listed} | ${summary.closed} |\n\n${errors.slice(0,10).map(e=>`- ${e.replace(/[|<>]/g,' ')}`).join('\n')}\n`).catch(()=>{});
  if(status==='failed')process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
