// One collector agent: reads every board in its shard of the watchlist and sends the jobs to
// public.wilsy_ingest_board. Run as 10 parallel agents (see .github/workflows/collect-jobs.yml).
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/collect.mjs --shard 0 --shards 10
import {parseArgs} from 'node:util';
import {READERS} from './boards.mjs';
import {createClient,pool} from './http.mjs';

const CHUNK=50; // keeps each database call well inside the API's 8-second statement limit

export function shardOf(boards,shard,shards) {
  return boards.filter(b=>b.master_rank%shards===shard);
}

// Reads one board and ingests it in chunks; the final call carries the complete live URL list.
export async function collectBoard(board,{read,ingest}) {
  const target={master_rank:board.master_rank,ats:board.ats_platform.toLowerCase(),slug:board.ats_identifier};
  let jobs;
  try{jobs=await read(target.ats,target.slug);}
  catch(error){await ingest({...target,error:String(error.message||error).slice(0,200)});return {failed:1,error:`${board.company}: ${error.message}`};}
  const totals={boards:1};
  const add=r=>{for(const [k,v] of Object.entries(r||{}))totals[k]=(totals[k]||0)+v;};
  for(let i=0;i<jobs.length;i+=CHUNK)add(await ingest({...target,jobs:jobs.slice(i,i+CHUNK)}));
  add(await ingest({...target,jobs:[],live_urls:[...new Set(jobs.map(j=>j.url).filter(Boolean))]}));
  return totals;
}

async function main() {
  const {values:args}=parseArgs({options:{shard:{type:'string'},shards:{type:'string'},concurrency:{type:'string'}}});
  const shard=Number(args.shard),shards=Number(args.shards||10),concurrency=Number(args.concurrency||4);
  if(!Number.isInteger(shard)||shard<0||shard>=shards)throw new Error('Pass --shard between 0 and --shards minus 1.');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db=async(path,{body,method=body?'POST':'GET',prefer}={})=>{
    const response=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Database ${response.status}: ${(await response.text()).slice(0,200)}`);
    const text=await response.text();return text?JSON.parse(text):null;
  };
  const started=new Date();
  const boards=shardOf(await db('company_watchlist_11k?select=master_rank,company,ats_platform,ats_identifier&is_active=is.true'
    +'&verification_status=eq.verified&ats_identifier=not.is.null&ats_platform=in.(greenhouse,ashby,lever,workable,smartrecruiters,recruitee)'
    +'&order=master_rank&limit=20000'),shard,shards);
  const client=createClient();
  const results=await pool(boards,concurrency,board=>collectBoard(board,{
    read:(ats,slug)=>READERS[ats](slug,client.json),
    ingest:payload=>db('rpc/wilsy_ingest_board',{body:{board:payload}})
  }).catch(error=>({failed:1,error:`${board.company}: ${error.message}`})));
  const totals={};for(const r of results)for(const [k,v] of Object.entries(r))if(typeof v==='number')totals[k]=(totals[k]||0)+v;
  const errors=results.map(r=>r.error).filter(Boolean);
  const status=!errors.length?'success':errors.length<boards.length?'partial':'failed';
  await db('job_ingestion_runs',{prefer:'return=minimal',body:{run_key:`fleet-${shard}-${started.getTime()}`,schedule_name:'Wilsy collector fleet',
    source_scope:`shard ${shard+1}/${shards}`,started_at:started.toISOString(),finished_at:new Date().toISOString(),
    companies_checked:boards.length,jobs_found:totals.found||0,jobs_inserted:totals.inserted||0,jobs_updated:totals.updated||0,
    invalid_skipped:totals.invalid||0,sources_failed:errors.length,status,error_summary:errors.slice(0,20).join(' | ')||null,
    metadata:{worker:'fleet',shard,shards,unchanged:totals.unchanged||0,expired:totals.expired||0,other_roles:totals.other_roles||0}}});
  console.log(JSON.stringify({shard,boards:boards.length,status,...totals,errors:errors.slice(0,5)}));
  if(status==='failed'&&boards.length)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===(await import('node:path')).resolve(process.argv[1]))await main();
