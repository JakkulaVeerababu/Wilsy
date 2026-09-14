import {supabaseConfig} from './supabase-config.js';

export async function databaseRequest(path,{body,signal}={}) {
  const timeout=AbortSignal.timeout(15000);
  const response=await fetch(`${supabaseConfig.url}/rest/v1/${path}`,{
    method:body?'POST':'GET',
    headers:{apikey:supabaseConfig.publishableKey,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,
    signal:signal?AbortSignal.any([signal,timeout]):timeout
  });
  if(!response.ok)throw new Error(`Data service unavailable (${response.status})`);
  return response.json();
}
export const searchJobs=(filters,offset=0,signal)=>databaseRequest('rpc/wilsy_search_jobs',{
  body:{filters,page_size:20,page_offset:offset},signal
});
export const jobFacets=()=>databaseRequest('rpc/wilsy_job_facets',{body:{}});
export const searchHackathons=(filters,offset=0,signal)=>databaseRequest('rpc/wilsy_search_hackathons',{
  body:{filters,page_size:12,page_offset:offset},signal
});
export const hackathonFacets=()=>databaseRequest('rpc/wilsy_hackathon_facets',{body:{}});

export async function loadCompanies() {
  try {
    const rows=[];
    for(let offset=0;;offset+=500){
      const batch=await databaseRequest(`companies?select=data&order=order_idx.asc,id.asc&limit=500&offset=${offset}`);
      if(!Array.isArray(batch))throw new Error('Invalid company data');
      rows.push(...batch);
      if(batch.length<500)break;
    }
    if(!rows.length||rows.some(row=>!row.data?.id||!row.data?.name))throw new Error('Incomplete company data');
    return {companies:rows.map(row=>row.data),source:'database'};
  } catch {
    const response=await fetch('/data/companies.json');
    if(!response.ok)throw new Error('Directory unavailable');
    const data=await response.json();
    return {companies:data.companies,source:'snapshot',updatedAt:data.updatedAt};
  }
}
