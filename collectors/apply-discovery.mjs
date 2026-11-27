// Sends discovery results to public.wilsy_apply_discovery, which only the service role may run.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/apply-discovery.mjs results.json
// With JOBS_DATABASE_URL set, the call goes to the jobs database instead (see pg-rest.mjs).
import fs from 'node:fs/promises';
import {createPgRest} from './pg-rest.mjs';

const [file]=process.argv.slice(2);
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,jobsUrl=process.env.JOBS_DATABASE_URL;
if(!file)throw new Error('Pass the discovery results file.');
if(!jobsUrl&&(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key))throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

async function supabaseApply(body){
  const response=await fetch(`${url}/rest/v1/rpc/wilsy_apply_discovery`,{method:'POST',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Apply failed (${response.status}): ${(await response.text()).slice(0,300)}`);
  return response.json();
}
const apply=jobsUrl?(pg=>body=>pg('rpc/wilsy_apply_discovery',{body}))(createPgRest({url:jobsUrl})):supabaseApply;

const {results}=JSON.parse(await fs.readFile(file,'utf8'));
const fields=({name,website,careers,status,ats,slug,jobs,evidence,nameMatches})=>({name,website,careers,status,ats,slug,jobs,evidence,nameMatches});
const totals={};
for(let i=0;i<results.length;i+=200){
  const result=await apply({results:results.slice(i,i+200).filter(r=>r.status!=='skipped'&&r.status!=='error').map(fields)});
  for(const [k,v] of Object.entries(result||{}))totals[k]=(totals[k]||0)+v;
}
console.log(JSON.stringify(totals));
