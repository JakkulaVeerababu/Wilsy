// One collector agent: reads every board in its shard of the watchlist and sends the jobs to
// public.wilsy_ingest_board. Run as 10 parallel agents (see .github/workflows/collect-jobs.yml).
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/collect.mjs --shard 0 --shards 10
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {READERS,TECH_ROLE} from './boards.mjs';
import {createClient,pool} from './http.mjs';
import {routeJobs} from './pg-rest.mjs';

// Every API call runs under an 8-second statement timeout, and rewriting one stored job costs far
// more than reading it (two full-text indexes over its description), so calls are kept small by job
// count and by size. 50-job calls over 250 KB timed out one time in five.
export const CHUNK_JOBS=20;
export const CHUNK_BYTES=40_000;
const MAX_BOARD_TIMEOUTS=6; // a board stops splitting after this many timed-out calls
const PAGE=1000; // the API returns at most this many rows per request
const PLATFORMS=['greenhouse','ashby','lever','workable','smartrecruiters','recruitee','oracle_hcm','rippling'];
export const MAX_FAILURE_RATE=0.3;
const pause=ms=>new Promise(r=>setTimeout(r,ms));

export function shardOf(boards,shard,shards) {
  return boards.filter(b=>b.master_rank%shards===shard);
}

// Reads the whole verified watchlist page by page, so a row cap can never silently drop boards.
export async function loadBoards(db) {
  const filter='company_watchlist_11k?select=master_rank,company,ats_platform,ats_identifier&is_active=is.true'
    +'&verification_status=eq.verified&ats_identifier=not.is.null'
    +`&or=(${PLATFORMS.map(p=>`ats_platform.ilike.${p}`).join(',')})&order=master_rank`;
  const boards=[];
  for(let offset=0;;offset+=PAGE){
    const page=await db(`${filter}&limit=${PAGE}&offset=${offset}`);
    if(!Array.isArray(page))throw new Error('Unexpected watchlist response');
    boards.push(...page);
    if(page.length<PAGE)break;
  }
  return boards;
}

// The checks wilsy_ingest_board makes before it stores a job, in the same order. The database stays
// authoritative; this only avoids sending jobs it would skip. Postgres left(…,1200) counts characters,
// not UTF-16 units; its lower() matches toLowerCase() (both turn İ into i plus a combining dot).
export function jobKind(job) {
  if(!String(job.title??'').trim()||!/^https:\/\//i.test(job.url||''))return 'invalid';
  const head=Array.from(job.description||'').slice(0,1200).join('');
  return TECH_ROLE.test(`${job.title} ${job.department||''} ${head}`.toLowerCase())?'tech':'other_roles';
}

// Groups jobs into calls of at most maxJobs jobs and about maxBytes of JSON. A job bigger than
// maxBytes on its own still goes, alone.
export function chunkJobs(jobs,{maxJobs=CHUNK_JOBS,maxBytes=CHUNK_BYTES}={}) {
  const chunks=[];let current=[],bytes=0;
  for(const job of jobs){
    const size=Buffer.byteLength(JSON.stringify(job));
    if(current.length&&(current.length>=maxJobs||bytes+size>maxBytes)){chunks.push(current);current=[];bytes=0;}
    current.push(job);bytes+=size;
  }
  if(current.length)chunks.push(current);
  return chunks;
}

// Reads one board and ingests it in small chunks; the final call carries the complete live URL list.
// A chunk cancelled by the statement timeout is split in half and sent again, so one slow chunk no
// longer loses the whole board. Each call is its own transaction, so totals from calls that succeeded
// are kept even when another call fails.
export async function collectBoard(board,{read,ingest}) {
  const target={master_rank:board.master_rank,ats:board.ats_platform.toLowerCase(),slug:board.ats_identifier};
  let jobs;
  try{jobs=await read(target.ats,target.slug);}
  catch(error){
    // Only "this board no longer exists" is recorded against the board. Timeouts, rate limits and
    // server errors are transient and must not count towards replacing a working board.
    const gone=error?.status===404||error?.status===410;
    if(gone)await ingest({...target,error:String(error.message||error).slice(0,200)});
    return {failed:1,...(gone?{gone:1}:{}),error:`${board.company}: ${error.message}`};
  }
  // An empty answer is not proof that every role closed (several services answer 200 with an empty
  // list for a renamed board), so nothing is closed on an empty read.
  if(!jobs.length)return {boards:1,empty:1};
  const totals={boards:1};
  const add=r=>{for(const [k,v] of Object.entries(r||{}))if(typeof v==='number')totals[k]=(totals[k]||0)+v;};
  const tech=[];
  for(const job of jobs){const kind=jobKind(job);if(kind==='tech')tech.push(job);else add({[kind]:1});}
  let firstError=null,timeouts=0;
  const fail=(chunk,error)=>{add({failed_jobs:chunk.length});firstError??=error;};
  async function send(chunk) {
    if(timeouts>=MAX_BOARD_TIMEOUTS)return fail(chunk,firstError);
    try{add(await ingest({...target,jobs:chunk}));}
    catch(error){
      if(error?.timeout)timeouts++;
      if(!error?.timeout||chunk.length<2||timeouts>=MAX_BOARD_TIMEOUTS)return fail(chunk,error);
      const half=Math.ceil(chunk.length/2);
      await send(chunk.slice(0,half));await send(chunk.slice(half));
    }
  }
  for(const chunk of chunkJobs(tech))await send(chunk);
  // The live list holds every URL the board listed, including roles that were not sent or failed to
  // save, so the final call only ever closes roles that are really gone.
  if(jobs.partial)totals.partial=1;
  else{
    try{add(await ingest({...target,jobs:[],live_urls:[...new Set(jobs.map(j=>j.url).filter(Boolean))]}));}
    catch(error){firstError??=error;}
  }
  if(firstError)return {...totals,failed:1,error:`${board.company}: ${firstError.message}`};
  return totals;
}

// A shard is unhealthy when it read nothing or too many of its boards failed.
export function runStatus(boardCount,errorCount) {
  const status=!errorCount?'success':errorCount<boardCount?'partial':'failed';
  const failed=!boardCount||status==='failed'||errorCount/boardCount>MAX_FAILURE_RATE;
  return {status,failed};
}

export function summaryMarkdown({shard,shards,boards,status,totals,errors}) {
  const cols=['found','inserted','updated','unchanged','expired','empty','partial'];
  return [`### Shard ${shard+1}/${shards}: ${status}`,'',
    `| boards | ${cols.join(' | ')} | failed |`,`|${'---|'.repeat(cols.length+2)}`,
    `| ${boards} | ${cols.map(c=>totals[c]||0).join(' | ')} | ${errors.length} |`,'',
    ...errors.slice(0,20).map(e=>`- ${String(e).replace(/[|<>]/g,' ')}`),''].join('\n');
}

// Postgres cancelled the call at the API's 8-second statement timeout (SQLSTATE 57014).
export const statementTimeout=(status,text='')=>status===500&&/"code"\s*:\s*"57014"/.test(text);

// Gateway errors and statement timeouts are worth another try. Each ingest call is one transaction
// and an idempotent upsert, so a cancelled call leaves nothing half-written.
export function retryableDbError(status,text='') {
  return [502,503,504].includes(status)||statementTimeout(status,text);
}

// PostgREST calls as the service role, with up to three attempts. With retryTimeouts:false a statement
// timeout is thrown at once (error.timeout), because the same payload would only time out again:
// collectBoard splits it instead. With JOBS_DATABASE_URL set, job tables and functions go to that database.
export function createDb({url,key,fetcher=globalThis.fetch,sleep=pause,env=process.env}) {
  return routeJobs(async(path,{body,method=body?'POST':'GET',prefer,retryTimeouts=true}={})=>{
    for(let attempt=0;;attempt++){
      try{
        const response=await fetcher(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
          body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
        if(!response.ok){
          const text=await response.text();
          const error=new Error(`Database ${response.status}: ${text.slice(0,200)}`);
          error.timeout=statementTimeout(response.status,text);
          error.final=!retryableDbError(response.status,text)||(error.timeout&&!retryTimeouts);
          throw error;
        }
        const text=await response.text();return text?JSON.parse(text):null;
      }catch(error){
        if(error.final||attempt>=2)throw error;
        await sleep(500*4**attempt);
      }
    }
  },{env});
}

async function main() {
  const {values:args}=parseArgs({options:{shard:{type:'string'},shards:{type:'string'},concurrency:{type:'string'}}});
  const shard=Number(args.shard),shards=Number(args.shards||10),concurrency=Number(args.concurrency||4);
  if(!Number.isInteger(shard)||shard<0||shard>=shards)throw new Error('Pass --shard between 0 and --shards minus 1.');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db=createDb({url,key});
  const started=new Date();
  const boards=shardOf(await loadBoards(db),shard,shards);
  const client=createClient();
  const results=await pool(boards,concurrency,board=>collectBoard(board,{
    read:(ats,slug)=>READERS[ats](slug,client.json),
    // A timed-out call of several jobs is split by collectBoard; a single job is retried here.
    ingest:payload=>db('rpc/wilsy_ingest_board',{body:{board:payload},retryTimeouts:!(payload.jobs?.length>1)})
  }).catch(error=>({failed:1,error:`${board.company}: ${error.message}`})));
  const totals={};for(const r of results)for(const [k,v] of Object.entries(r))if(typeof v==='number')totals[k]=(totals[k]||0)+v;
  const errors=results.map(r=>r.error).filter(Boolean);
  const {status,failed}=runStatus(boards.length,errors.length);
  const byPlatform={};for(const b of boards){const p=b.ats_platform.toLowerCase();byPlatform[p]=(byPlatform[p]||0)+1;}
  await db('job_ingestion_runs',{prefer:'return=minimal',body:{run_key:`fleet-${shard}-${started.getTime()}`,schedule_name:'Wilsy collector fleet',
    source_scope:`shard ${shard+1}/${shards}`,started_at:started.toISOString(),finished_at:new Date().toISOString(),
    companies_checked:boards.length,jobs_found:totals.found||0,jobs_inserted:totals.inserted||0,jobs_updated:totals.updated||0,
    invalid_skipped:totals.invalid||0,sources_failed:errors.length,status,error_summary:errors.slice(0,20).join(' | ')||null,
    metadata:{worker:'fleet',shard,shards,unchanged:totals.unchanged||0,expired:totals.expired||0,other_roles:totals.other_roles||0,
      empty:totals.empty||0,partial:totals.partial||0,gone:totals.gone||0,failed_jobs:totals.failed_jobs||0,platforms:byPlatform}}});
  console.log(JSON.stringify({shard,boards:boards.length,status,platforms:byPlatform,...totals,errors:errors.slice(0,5)}));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summaryMarkdown({shard,shards,boards:boards.length,status,totals,errors})).catch(()=>{});
  if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
