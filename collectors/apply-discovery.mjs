// Sends discovery results to public.wilsy_apply_discovery, which only the service role may run.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/apply-discovery.mjs results.json
import fs from 'node:fs/promises';

const [file]=process.argv.slice(2);
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!file)throw new Error('Pass the discovery results file.');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

const {results}=JSON.parse(await fs.readFile(file,'utf8'));
const fields=({name,website,careers,status,ats,slug,jobs,evidence,nameMatches})=>({name,website,careers,status,ats,slug,jobs,evidence,nameMatches});
const totals={};
for(let i=0;i<results.length;i+=200){
  const response=await fetch(`${url}/rest/v1/rpc/wilsy_apply_discovery`,{method:'POST',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({results:results.slice(i,i+200).filter(r=>r.status!=='skipped'&&r.status!=='error').map(fields)}),
    signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Apply failed (${response.status}): ${(await response.text()).slice(0,300)}`);
  for(const [k,v] of Object.entries(await response.json()))totals[k]=(totals[k]||0)+v;
}
console.log(JSON.stringify(totals));
