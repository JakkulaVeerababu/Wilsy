import {HttpError} from './ats.mjs';

// Polite HTTP: identifies WILSY, limits parallel requests per host, retries 429/5xx and network
// failures with backoff (honouring Retry-After), and never follows redirects off HTTPS.
export const USER_AGENT='WILSYJobsBot/1.0 (+https://www.wilsy.in/about; contact@wilsy.in)';

const pause=ms=>new Promise(r=>setTimeout(r,ms));

export function createClient({perHost=2,timeoutMs=20000,retries=2,fetcher=globalThis.fetch,sleep=pause}={}) {
  const active=new Map(),waiting=new Map();
  async function slot(host) {
    while((active.get(host)||0)>=perHost)await new Promise(r=>(waiting.get(host)||waiting.set(host,[]).get(host)).push(r));
    active.set(host,(active.get(host)||0)+1);
    return ()=>{active.set(host,active.get(host)-1);waiting.get(host)?.shift()?.();};
  }
  async function attemptOnce(url,json) {
    const response=await fetcher(url,{headers:{'User-Agent':USER_AGENT,Accept:json?'application/json':'text/html,application/xhtml+xml'},
      redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
    if(response.url&&!response.url.startsWith('https:'))throw new HttpError(0,url);
    if(response.status===429||response.status>=500){
      const after=Number(response.headers?.get?.('retry-after'));
      const error=new HttpError(response.status,url);
      error.retryAfterMs=Number.isFinite(after)&&after>0?Math.min(after,30)*1000:null;
      throw error;
    }
    if(!response.ok)throw new HttpError(response.status,url);
    if(!json)return {url:response.url||url,text:(await response.text()).slice(0,2_000_000)};
    return await response.json();
  }
  async function request(url,{json=true}={}) {
    const {protocol,host}=new URL(url);
    if(protocol!=='https:')throw new HttpError(0,url);
    for(let attempt=0;;attempt++){
      const release=await slot(host);
      let wait;
      try{return await attemptOnce(url,json);}
      catch(error){
        // 4xx answers and the HTTPS rule are final; rate limits, server errors and network failures are retried.
        const final=error instanceof HttpError&&error.status!==429&&error.status<500;
        if(final||attempt>=retries)throw error;
        wait=error.retryAfterMs??1000*2**attempt+Math.floor(Math.random()*250);
      }finally{release();}
      await sleep(wait); // waits without holding the host slot
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
