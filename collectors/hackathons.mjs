// Hackathon collector: reads the open-registration listings that Unstop and Devfolio publish for
// programmatic access, then adds, refreshes and closes events in public.hackathons.
//
// Sources and why they are used:
// - Unstop: robots.txt explicitly allows /api/public/*; the listing API used here lives under it.
// - Devfolio: robots.txt allows all paths and its terms contain no anti-automation clause.
// Devpost (terms forbid scraping) and MLH (terms forbid commercial reuse) are deliberately not read.
//
// Only event facts are stored: no participant lists, judges, contact e-mails or raw payloads.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/hackathons.mjs
import fs from 'node:fs/promises';
import {plainText} from './boards.mjs';
import {createClient} from './http.mjs';

export const SOURCE_UNSTOP='Unstop',SOURCE_DEVFOLIO='Devfolio';
const MAX_PAGES=20,PAGE_SIZE=100;
// Devfolio descriptions are Markdown; the site shows plain text, so keep the words and drop the syntax.
export function markdownText(value,max) {
  const md=String(value??'').replace(/\r\n?/g,'\n')
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')                    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')                  // [text](url) -> text
    .replace(/<(https?:[^>]+)>/g,'$1')
    .replace(/^[ \t]*#{1,6}[ \t]*/gm,'')                     // headings
    .replace(/^[ \t]*>[ \t]?/gm,'')                          // quotes
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm,'')    // rules
    .replace(/^[ \t]*[-*+][ \t]+/gm,'• ')                     // bullets
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g,'$2')         // bold
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g,'$1$2') // italic
    .replace(/(^|\W)_(?=\S)([^_\n]*?\S)_(?!\w)/g,'$1$2')
    .replace(/\*\*/g,'').replace(/`([^`]*)`/g,'$1');
  return plainText(md,max);
}
const https=url=>{try{const u=new URL(String(url||''));return u.protocol==='https:'?u.toString():null;}catch{return null;}};
const iso=value=>{if(!value)return null;const d=new Date(String(value).replace(' GMT','').replace(/ (?=\d{2}:)/,'T'));return Number.isNaN(d.getTime())?null:d.toISOString();};
const text=(value,max=300)=>{const t=String(value??'').replace(/\s+/g,' ').trim();return t?t.slice(0,max):null;};
const uniq=values=>[...new Set(values.map(v=>text(v,60)).filter(Boolean))].slice(0,12);
const list=(value,source)=>{if(!Array.isArray(value))throw new Error(`Unexpected ${source} response`);return value;};
const money=(amount,currency)=>currency==='INR'?`₹${Number(amount).toLocaleString('en-IN')}`:currency==='USD'?`$${Number(amount).toLocaleString('en-US')}`:`${Number(amount).toLocaleString('en-US')} ${currency||''}`.trim();
const MODES={online:'online',offline:'offline',hybrid:'hybrid'};

// ---------- Unstop ----------
function unstopEligibility(raw) {
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    const sectors=Array.isArray(parsed?.sector)?parsed.sector:[];
    return sectors.length?`Open to: ${sectors.map(s=>String(s).replace(/_/g,' ')).join(', ')}.`:null;
  }catch{return null;}
}
export function normaliseUnstop(item) {
  const url=https(item.seo_url)||https(`https://unstop.com/${String(item.public_url||'').replace(/^\/+/,'')}`);
  const regn=item.regnRequirements||{},place=item.address_with_country_logo||{};
  const mode=MODES[String(item.region||'').toLowerCase()]||null;
  const prizes=(Array.isArray(item.prizes)?item.prizes:[]).map((p,i)=>{
    const amount=Number(p.cash)>0?Number(p.cash):null,currency=text(p.currencyCode,8)?.toUpperCase()||null;
    const extras=[p.certificate?'certificate':null,p.pre_placement_internship?'pre-placement internship':null,p.pre_placement_opportunity?'pre-placement opportunity':null,text(p.others,120)].filter(Boolean);
    return {prize_rank:text(p.rank,10)||String(i+1),prize_name:`Rank ${text(p.rank,10)||i+1}`,prize_type:amount?'cash':'non_cash',amount,currency:amount?currency:null,
      value_text:amount?money(amount,currency):null,description:extras.length?`Also: ${extras.join(', ')}.`:null,quantity:1,source_url:url};
  });
  return event({source_name:SOURCE_UNSTOP,external_hackathon_id:String(item.id),title:item.title,organizer:item.organisation?.name,
    description:plainText(item.details,6000),eligibility:unstopEligibility(regn.eligibility),
    themes:uniq((item.workfunction||[]).map(w=>w?.name)),skills:uniq((item.required_skills||[]).map(s=>s?.skill_name||s?.skill)),
    participation_mode:mode,is_online:mode==='online',is_global:false,
    team_size_min:regn.min_team_size,team_size_max:regn.max_team_size,
    country:mode==='online'?null:place.country?.name,country_code:mode==='online'?null:place.country?.iso,
    city:mode==='online'?null:place.city,state_region:mode==='online'?null:place.state,
    url,registration_opens_at:iso(regn.start_regn_dt),registration_deadline_at:iso(regn.end_regn_dt),ends_at:iso(item.end_date),
    source_updated_at:iso(item.updated_at),prizes,open:item.regn_open===1&&String(item.status).toUpperCase()==='LIVE'&&item.visibility==='public'});
}
export async function readUnstop(get) {
  const items=[];
  for(let page=1;page<=MAX_PAGES;page++){
    const body=await get(`https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&oppstatus=open&per_page=${PAGE_SIZE}&page=${page}`);
    const data=body?.data;
    items.push(...list(data?.data,'Unstop'));
    if(!data.last_page||page>=data.last_page)break;
  }
  return items.map(normaliseUnstop);
}

// ---------- Devfolio ----------
export function normaliseDevfolio(item) {
  const setting=item.hackathon_setting||{},slug=text(item.slug,80);
  const url=slug&&/^[a-z0-9-]+$/i.test(slug)?`https://${slug}.devfolio.co/`:null;
  const prizes=(Array.isArray(item.prizes)?item.prizes:[]).filter(p=>!p.parent_prize_uuid).slice(0,20).map((p,i)=>({
    prize_rank:String(i+1),prize_name:text(p.name,120),prize_type:null,amount:null,currency:null,value_text:null,
    description:markdownText(p.desc,400),quantity:1,source_url:url}));
  const description=[text(item.tagline,300),markdownText(item.desc,6000)].filter(Boolean).join('\n\n')||null;
  return event({source_name:SOURCE_DEVFOLIO,external_hackathon_id:text(item.uuid,64),title:item.name,organizer:item.hosted_by?.name||null,
    description,eligibility:setting.women_only?'Women only.':null,
    themes:uniq((item.themes||[]).map(t=>typeof t==='string'?t:t?.name)),skills:[],
    participation_mode:item.is_online?'online':'offline',is_online:!!item.is_online,is_global:false,
    team_size_min:item.team_min,team_size_max:item.team_size,
    country:item.is_online?null:item.country,country_code:null,city:item.is_online?null:item.city,state_region:item.is_online?null:item.state,
    url,registration_url:https(setting.external_apply_url)||url,official_url:https(setting.site)||url,
    registration_opens_at:iso(setting.reg_starts_at),registration_deadline_at:iso(setting.reg_ends_at),
    starts_at:iso(item.starts_at),ends_at:iso(item.ends_at),prizes,
    open:item.private!==true&&item.status==='publish'&&String(item.type||'').toUpperCase()==='HACKATHON'});
}
export async function readDevfolio(get,post) {
  const items=[];
  for(let from=0;from<MAX_PAGES*PAGE_SIZE;from+=PAGE_SIZE){
    const body=await post('https://api.devfolio.co/api/search/hackathons',{type:'application_open',from,size:PAGE_SIZE});
    const hits=list(body?.hits?.hits,'Devfolio');
    items.push(...hits.map(h=>h?._source).filter(Boolean));
    if(hits.length<PAGE_SIZE)break;
  }
  return items.map(normaliseDevfolio);
}

// ---------- Shared shape ----------
function event(f) {
  const cash=f.prizes.filter(p=>p.amount);
  const currencies=[...new Set(cash.map(p=>p.currency))];
  const pool=cash.length&&currencies.length===1?cash.reduce((sum,p)=>sum+p.amount*(p.quantity||1),0):null;
  const int=v=>Number.isInteger(Number(v))&&Number(v)>0&&Number(v)<1000?Number(v):null;
  return {
    open:!!f.open,prizes:f.prizes,
    row:{title:text(f.title,200),organizer:text(f.organizer,200),description:f.description||null,eligibility:f.eligibility||null,
      themes:f.themes?.length?f.themes:null,skills:f.skills?.length?f.skills:null,hackathon_type:'hackathon',
      participation_mode:f.participation_mode,team_size_min:int(f.team_size_min),team_size_max:int(f.team_size_max),
      country:text(f.country,80),country_code:text(f.country_code,3),city:text(f.city,80),state_region:text(f.state_region,80),
      is_global:f.is_global,is_online:f.is_online,registration_url:https(f.registration_url)||f.url,official_url:https(f.official_url)||f.url,
      source_name:f.source_name,source_url:f.url,external_hackathon_id:f.external_hackathon_id,
      registration_opens_at:f.registration_opens_at||null,registration_deadline_at:f.registration_deadline_at||null,
      starts_at:f.starts_at||null,ends_at:f.ends_at||null,source_updated_at:f.source_updated_at||null,
      prize_pool_min:pool,prize_pool_max:pool,prize_currency:pool?currencies[0]:null,
      prize_text:pool?`${money(pool,currencies[0])} in cash prizes`:null,has_cash_prize:cash.length?true:(f.prizes.length?null:null)}
  };
}

// An event is listed only while its registration is open and it has a usable HTTPS link.
export function isListable(item,now=Date.now()) {
  const r=item.row;
  if(!item.open||!r.title||!r.external_hackathon_id||!r.source_url)return false;
  if(r.registration_deadline_at&&Date.parse(r.registration_deadline_at)<now)return false;
  if(r.ends_at&&Date.parse(r.ends_at)<now)return false;
  return true;
}

const unstopIdFromUrl=url=>/-(\d{5,})(?:\/|$|\?)/.exec(String(url||''))?.[1]||null;
export const eventKey=(source,id)=>`${String(source).toLowerCase()}:${id}`;
export function existingKey(row) {
  const id=row.external_hackathon_id||(row.source_name===SOURCE_UNSTOP?unstopIdFromUrl(row.source_url):null);
  return id?eventKey(row.source_name,id):null;
}
const prizeSignature=prizes=>JSON.stringify(prizes.map(p=>[p.prize_rank,p.prize_name,p.amount,p.currency,p.description]));

// Works out every write for one run. Pure, so it can be tested without a database.
export function plan({existing,fetched,readOk,now=new Date()}) {
  const stamp=now.toISOString(),nowMs=now.getTime();
  const byKey=new Map();for(const row of existing){const k=existingKey(row);if(k&&!byKey.has(k))byKey.set(k,row);}
  const inserts=[],updates=[],prizeReplacements=[],seen=new Set();
  for(const item of fetched){
    if(!isListable(item,nowMs))continue;
    const key=eventKey(item.row.source_name,item.row.external_hackathon_id);
    if(seen.has(key))continue;seen.add(key);
    const signature=prizeSignature(item.prizes);
    const fields={...item.row,status:'live',last_seen_at:stamp,last_verified_at:stamp,closed_at:null,verification_level:'platform_open_registration_listing'};
    const old=byKey.get(key);
    if(!old){inserts.push({key,row:{...fields,first_seen_at:stamp,metadata:{collector:'wilsy-hackathons',prize_signature:signature},source_payload:{}},prizes:item.prizes});continue;}
    updates.push({id:old.id,row:{...fields,metadata:{...(old.metadata||{}),collector:'wilsy-hackathons',prize_signature:signature}}});
    if(old.metadata?.prize_signature!==signature)prizeReplacements.push({id:old.id,prizes:item.prizes});
  }
  // Close what is no longer open: anything past its deadline or end (any source), and events from a
  // source that was read completely this run but no longer lists them.
  const closes=[];
  for(const row of existing){
    if(row.closed_at)continue;
    const key=existingKey(row);
    if(key&&seen.has(key))continue;
    const deadlinePassed=row.registration_deadline_at&&Date.parse(row.registration_deadline_at)<nowMs;
    const ended=row.ends_at&&Date.parse(row.ends_at)<nowMs;
    const delisted=readOk[row.source_name]===true;
    if(deadlinePassed||ended||delisted)closes.push({id:row.id,reason:deadlinePassed?'registration_closed':ended?'event_ended':'no_longer_listed'});
  }
  return {inserts,updates,prizeReplacements,closes};
}

async function main() {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db=async(path,{body,method=body?'POST':'GET',prefer}={})=>{
    for(let attempt=0;;attempt++){
      try{
        const response=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
          body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
        if([502,503,504].includes(response.status)&&attempt<2)throw new Error(`Database ${response.status}`);
        if(!response.ok){const error=new Error(`Database ${response.status}: ${(await response.text()).slice(0,300)}`);error.final=true;throw error;}
        const t=await response.text();return t?JSON.parse(t):null;
      }catch(error){if(error.final||attempt>=2)throw error;await new Promise(r=>setTimeout(r,500*4**attempt));}
    }
  };
  const started=new Date();
  const client=createClient();
  const post=async(target,payload)=>{
    const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':(await import('./http.mjs')).USER_AGENT},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();
  };
  const fetched=[],readOk={},errors=[],counts={};
  for(const [name,read] of [[SOURCE_UNSTOP,()=>readUnstop(client.json)],[SOURCE_DEVFOLIO,()=>readDevfolio(client.json,post)]]){
    try{
      const items=await read();counts[name]=items.length;
      // An empty listing is never trusted to close events (same rule as the job collector).
      readOk[name]=items.length>0;fetched.push(...items);
    }catch(error){readOk[name]=false;errors.push(`${name}: ${error.message}`);}
  }
  const existing=await db('hackathons?select=id,source_name,source_url,external_hackathon_id,registration_deadline_at,ends_at,closed_at,metadata&limit=10000');
  const work=plan({existing,fetched,readOk,now:started});
  let prizesInserted=0,writeErrors=0;
  const insertPrizes=async(id,prizes)=>{if(!prizes.length)return;await db('hackathon_prizes',{prefer:'return=minimal',body:prizes.map(p=>({...p,hackathon_id:id,metadata:{collector:'wilsy-hackathons'}}))});prizesInserted+=prizes.length;};
  for(const item of work.inserts){
    try{const [row]=await db('hackathons?select=id',{body:item.row,prefer:'return=representation'});await insertPrizes(row.id,item.prizes);}
    catch(error){writeErrors++;errors.push(`insert ${item.key}: ${error.message}`);}
  }
  for(const item of work.updates){
    try{await db(`hackathons?id=eq.${item.id}`,{method:'PATCH',body:item.row,prefer:'return=minimal'});}
    catch(error){writeErrors++;errors.push(`update ${item.id}: ${error.message}`);}
  }
  for(const item of work.prizeReplacements){
    try{await db(`hackathon_prizes?hackathon_id=eq.${item.id}`,{method:'DELETE',prefer:'return=minimal'});await insertPrizes(item.id,item.prizes);}
    catch(error){writeErrors++;errors.push(`prizes ${item.id}: ${error.message}`);}
  }
  for(const item of work.closes){
    try{
      const [row]=await db(`hackathons?select=metadata&id=eq.${item.id}`);
      await db(`hackathons?id=eq.${item.id}`,{method:'PATCH',prefer:'return=minimal',body:{closed_at:started.toISOString(),metadata:{...(row?.metadata||{}),closed_reason:item.reason}}});
    }catch(error){writeErrors++;errors.push(`close ${item.id}: ${error.message}`);}
  }
  const sourcesFailed=Object.values(readOk).filter(ok=>!ok).length;
  const status=!errors.length?'success':sourcesFailed===2||writeErrors>work.inserts.length+work.updates.length/2?'failed':'partial';
  const summary={sources:counts,listable:work.inserts.length+work.updates.length,inserted:work.inserts.length,updated:work.updates.length,
    prizes:prizesInserted,closed:work.closes.length,status,errors:errors.slice(0,10)};
  await db('hackathon_ingestion_runs',{prefer:'return=minimal',body:{run_key:`wilsy-hackathons-${started.getTime()}`,schedule_name:'Wilsy hackathon collector',
    source_scope:'Unstop public API + Devfolio open registrations',started_at:started.toISOString(),finished_at:new Date().toISOString(),
    sources_checked:2,hackathons_found:fetched.length,hackathons_inserted:work.inserts.length,hackathons_updated:work.updates.length,
    prizes_inserted:prizesInserted,duplicates_skipped:0,invalid_skipped:fetched.length-work.inserts.length-work.updates.length,sources_failed:sourcesFailed,
    status,error_summary:errors.slice(0,20).join(' | ')||null,metadata:{closed:work.closes.length,counts}}});
  console.log(JSON.stringify(summary));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Hackathons: ${status}\n\n| Unstop | Devfolio | listed | new | refreshed | closed | prizes |\n|---|---|---|---|---|---|---|\n| ${counts.Unstop??'failed'} | ${counts.Devfolio??'failed'} | ${summary.listable} | ${summary.inserted} | ${summary.updated} | ${summary.closed} | ${prizesInserted} |\n\n${errors.slice(0,10).map(e=>`- ${e.replace(/[|<>]/g,' ')}`).join('\n')}\n`).catch(()=>{});
  if(status==='failed')process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
