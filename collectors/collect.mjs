// One collector agent: reads every board in its shard of the watchlist and sends the jobs to
// public.wilsy_ingest_board. Run as 10 parallel agents (see .github/workflows/collect-jobs.yml).
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/collect.mjs --shard 0 --shards 10
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {READERS} from './boards.mjs';
import {createClient,pool} from './http.mjs';

const CHUNK=50; // keeps each database call well inside the API's 8-second statement limit
const PAGE=1000; // the API returns at most this many rows per request
const PLATFORMS=['greenhouse','ashby','lever','workable','smartrecruiters','recruitee'];
export const MAX_FAILURE_RATE=0.3;

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

// Reads one board and ingests it in chunks; the final call carries the complete live URL list.
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
  const add=r=>{for(const [k,v] of Object.entries(r||{}))totals[k]=(totals[k]||0)+v;};
  for(let i=0;i<jobs.length;i+=CHUNK)add(await ingest({...target,jobs:jobs.slice(i,i+CHUNK)}));
  if(jobs.partial)totals.partial=1;
  else add(await ingest({...target,jobs:[],live_urls:[...new Set(jobs.map(j=>j.url).filter(Boolean))]}));
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

// Gateway errors and Postgres statement timeouts (57014) are worth another try. Each ingest call is
// one transaction and an idempotent upsert, so a cancelled call leaves nothing half-written.
export function retryableDbError(status,text='') {
  return [502,503,504].includes(status)||(status===500&&/"code"\s*:\s*"57014"/.test(text));
}

async function main() {
  const {values:args}=parseArgs({options:{shard:{type:'string'},shards:{type:'string'},concurrency:{type:'string'}}});
  const shard=Number(args.shard),shards=Number(args.shards||10),concurrency=Number(args.concurrency||4);
  if(!Number.isInteger(shard)||shard<0||shard>=shards)throw new Error('Pass --shard between 0 and --shards minus 1.');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db=async(path,{body,method=body?'POST':'GET',prefer}={})=>{
    for(let attempt=0;;attempt++){
      try{
        const response=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
          body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
        if(!response.ok){
          const text=await response.text();
          const error=new Error(`Database ${response.status}: ${text.slice(0,200)}`);
          error.final=!retryableDbError(response.status,text);throw error;
        }
        const text=await response.text();return text?JSON.parse(text):null;
      }catch(error){
        if(error.final||attempt>=2)throw error;
        await new Promise(r=>setTimeout(r,500*4**attempt));
      }
    }
  };
  const started=new Date();
  const boards=shardOf(await loadBoards(db),shard,shards);
  const client=createClient();
  const results=await pool(boards,concurrency,board=>collectBoard(board,{
    read:(ats,slug)=>READERS[ats](slug,client.json),
    ingest:payload=>db('rpc/wilsy_ingest_board',{body:{board:payload}})
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
      empty:totals.empty||0,partial:totals.partial||0,gone:totals.gone||0,platforms:byPlatform}}});
  console.log(JSON.stringify({shard,boards:boards.length,status,platforms:byPlatform,...totals,errors:errors.slice(0,5)}));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summaryMarkdown({shard,shards,boards:boards.length,status,totals,errors})).catch(()=>{});
  if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
