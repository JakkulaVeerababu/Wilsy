import {supabaseConfig} from './supabase-config.js';

// token: a signed-in user's access token, for their own account rows. prefer: PostgREST Prefer header.
export async function databaseRequest(path,{body,signal,method=body?'POST':'GET',token,prefer}={}) {
  const timeout=AbortSignal.timeout(15000);
  const response=await fetch(`${supabaseConfig.url}/rest/v1/${path}`,{
    method,
    headers:{apikey:supabaseConfig.publishableKey,'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{}),...(prefer?{Prefer:prefer}:{})},
    body:body?JSON.stringify(body):undefined,
    signal:signal?AbortSignal.any([signal,timeout]):timeout
  });
  if(!response.ok)throw new Error(`Data service unavailable (${response.status})`);
  const text=await response.text();
  return text?JSON.parse(text):null;
}
// Public job search filters that the cached /api/search endpoint accepts. Saved-job lists are left out:
// they differ per person, so a shared cache would not help and they go straight to the database.
export const SEARCH_KEYS=['q','id','company','country','mode','type','seniority','stage','role','skill','visa','relocation','salary',
  'currency','period','minimum','experience','time','sort','display_currency','inr_rate'];
export const SEARCH_MAX_OFFSET=10000;
/** Query string for /api/search, keys sorted so equal searches share one cache entry; null when not cacheable. */
export function searchQuery(filters={},offset=0){
  const params=new URLSearchParams();
  for(const key of Object.keys(filters||{}).sort()){
    const value=filters[key];
    if(value==null||value==='')continue;
    if(!SEARCH_KEYS.includes(key)||!['string','number'].includes(typeof value))return null;
    const text=String(value);
    if(text.length>200)return null;
    params.set(key,text);
  }
  if(!Number.isSafeInteger(offset)||offset<0||offset>SEARCH_MAX_OFFSET)return null;
  if(offset)params.set('offset',String(offset));
  return params.toString();
}
/** Filters and offset back from a /api/search query; null when anything is not allowed. */
export function searchFromQuery(params){
  const filters={};let offset=0;
  for(const [key,value] of params){
    if(key==='offset'){if(!/^\d{1,5}$/.test(value)||Number(value)>SEARCH_MAX_OFFSET)return null;offset=Number(value);continue;}
    if(!SEARCH_KEYS.includes(key)||value.length>200||key in filters)return null;
    filters[key]=value;
  }
  return {filters,offset};
}
const cachedSearchHost=()=>/(^|\.)wilsy\.in$|\.vercel\.app$/.test(globalThis.location?.hostname||'');
export async function searchJobs(filters,offset=0,signal){
  const query=cachedSearchHost()?searchQuery(filters,offset):null;
  if(query!==null){
    // The cached copy (up to a minute old) is shared by everyone running the same search; the database is the fallback.
    try{
      const timeout=AbortSignal.timeout(8000);
      const response=await fetch('/api/search'+(query?'?'+query:''),{signal:signal?AbortSignal.any([signal,timeout]):timeout});
      if(response.ok){const data=await response.json();if(Array.isArray(data?.jobs))return data;}
    }catch(error){if(signal?.aborted)throw error;}
  }
  return databaseRequest('rpc/wilsy_search_jobs',{body:{filters,page_size:20,page_offset:offset},signal});
}
export const jobFacets=()=>databaseRequest('rpc/wilsy_job_facets',{body:{}});
export const searchHackathons=(filters,offset=0,signal)=>databaseRequest('rpc/wilsy_search_hackathons',{
  body:{filters,page_size:12,page_offset:offset},signal
});
export const hackathonFacets=()=>databaseRequest('rpc/wilsy_hackathon_facets',{body:{}});
// Competitions and coding contests (public.opportunities; filters.kind picks the section).
export const searchOpportunities=(filters,{pageSize=12,offset=0,signal}={})=>databaseRequest('rpc/wilsy_search_opportunities',{
  body:{filters,page_size:pageSize,page_offset:offset},signal
});
export const opportunityFacets=kind=>databaseRequest('rpc/wilsy_opportunity_facets',{body:{opportunity_kind:kind}});

export async function loadCompanies() {
  try {
    const rows=[];
    for(let offset=0;;offset+=500){
      // Collectors also store partial company records here; the directory needs reviewed profiles only.
      const batch=await databaseRequest(`companies?select=data&data->>id=not.is.null&data->salary=not.is.null&data->>tier=not.is.null&order=order_idx.asc,id.asc&limit=500&offset=${offset}`);
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
