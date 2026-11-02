import {HttpError} from './ats.mjs';

// Polite HTTP: identifies WILSY, limits parallel requests per host, retries 429/5xx with backoff,
// and never follows redirects off HTTPS.
export const USER_AGENT='WILSYJobsBot/1.0 (+https://www.wilsy.in/about; contact@wilsy.in)';

export function createClient({perHost=2,timeoutMs=12000,retries=2,fetcher=globalThis.fetch}={}) {
  const active=new Map(),waiting=new Map();
  async function slot(host) {
    while((active.get(host)||0)>=perHost)await new Promise(r=>(waiting.get(host)||waiting.set(host,[]).get(host)).push(r));
    active.set(host,(active.get(host)||0)+1);
    return ()=>{active.set(host,active.get(host)-1);waiting.get(host)?.shift()?.();};
  }
  async function request(url,{json=true}={}) {
    const {protocol,host}=new URL(url);
    if(protocol!=='https:')throw new HttpError(0,url);
    for(let attempt=0;;attempt++){
      const release=await slot(host);
      try{
        const response=await fetcher(url,{headers:{'User-Agent':USER_AGENT,Accept:json?'application/json':'text/html,application/xhtml+xml'},
          redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
        if(response.url&&!response.url.startsWith('https:'))throw new HttpError(0,url);
        if((response.status===429||response.status>=500)&&attempt<retries){await new Promise(r=>setTimeout(r,1000*2**attempt));continue;}
        if(!response.ok)throw new HttpError(response.status,url);
        if(!json)return {url:response.url||url,text:(await response.text()).slice(0,2_000_000)};
        return await response.json();
      }finally{release();}
    }
  }
  return {json:url=>request(url),page:url=>request(url,{json:false})};
}

// Runs tasks with at most `limit` in flight.
export async function pool(items,limit,task) {
  const results=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){const i=next++;results[i]=await task(items[i],i);}
  }));
  return results;
}
