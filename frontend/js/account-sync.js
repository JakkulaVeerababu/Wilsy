import {databaseRequest} from './data-client.js';
import {readSaved} from './jobs-core.js';
import {readSavedHackathons} from './hackathon-core.js';
import {SEARCH_KEY,MAX_SEARCHES,readSearches} from './job-workspace-core.js';

export const SYNC_KEY='wilsy-sync-state';
export const LISTS={
  job:{key:'wilsy-saved-jobs',limit:500,read:readSaved},
  hackathon:{key:'wilsy-saved-hackathons',limit:500,read:readSavedHackathons},
  search:{key:SEARCH_KEY,limit:MAX_SEARCHES,read:readSearches}
};
const minimal='return=minimal';

// Three-way merge. Edits made on this device since the last sync win; everything else follows the
// account, so removals on another device reach this one. Newest local additions come first.
export function reconcile(base,local,remote,limit) {
  const before=new Set(base),now=new Set(local);
  const added=local.filter(v=>!before.has(v)),removed=new Set(base.filter(v=>!now.has(v)));
  const result=[...new Set([...added,...remote.filter(v=>!removed.has(v))])].slice(0,limit);
  const kept=new Set(result),cloud=new Set(remote);
  return {result,toAdd:result.filter(v=>!cloud.has(v)),toRemove:remote.filter(v=>!kept.has(v))};
}

export function readSyncState(storage,userId) {
  try{const s=JSON.parse(storage.getItem(SYNC_KEY)||'null');if(s?.user===userId)return s;}catch{}
  return {user:userId,job:[],hackathon:[],search:[]};
}

export async function fetchAccount(token) {
  const [items,searches]=await Promise.all([
    databaseRequest('user_saved_items?select=kind,item_id&order=saved_at.desc',{token}),
    databaseRequest('user_saved_searches?select=query,alert&order=created_at.desc',{token})
  ]);
  const ids=kind=>items.filter(r=>r.kind===kind).map(r=>String(r.item_id));
  return {job:ids('job'),hackathon:ids('hackathon'),search:searches.map(r=>r.query),
    alerts:Object.fromEntries(searches.map(r=>[r.query,r.alert]))};
}

// Removals run first so the account's limits always have room for additions.
async function push(token,kind,{toAdd,toRemove}) {
  if(kind==='search'){
    for(const query of toRemove)await databaseRequest(`user_saved_searches?query=eq.${encodeURIComponent(query)}`,{token,method:'DELETE',prefer:minimal});
    if(toAdd.length)await databaseRequest('user_saved_searches',{token,body:toAdd.map(query=>({query})),prefer:`resolution=ignore-duplicates,${minimal}`});
    return;
  }
  if(toRemove.length)await databaseRequest(`user_saved_items?kind=eq.${kind}&item_id=in.(${toRemove.join(',')})`,{token,method:'DELETE',prefer:minimal});
  if(toAdd.length)await databaseRequest('user_saved_items',{token,body:toAdd.map(id=>({kind,item_id:Number(id)})),prefer:`resolution=ignore-duplicates,${minimal}`});
}

// Returns the storage keys whose lists changed, so open pages can refresh.
export async function syncAccount({token,userId,storage}) {
  const state=readSyncState(storage,userId),remote=await fetchAccount(token),changed=[],counts={};
  for(const [kind,{key,limit,read}] of Object.entries(LISTS)){
    const local=read(storage),plan=reconcile(state[kind]||[],local,remote[kind],limit);
    await push(token,kind,plan);
    if(JSON.stringify(plan.result)!==JSON.stringify(local)){storage.setItem(key,JSON.stringify(plan.result));changed.push(key);}
    state[kind]=plan.result;counts[kind]=plan.result.length;
  }
  storage.setItem(SYNC_KEY,JSON.stringify(state));
  return {changed,counts,alerts:remote.alerts};
}

export const setAlert=(token,query,alert)=>databaseRequest(`user_saved_searches?query=eq.${encodeURIComponent(query)}`,
  {token,method:'PATCH',body:{alert},prefer:minimal});

// Signing out leaves the account intact but removes its copy from this browser.
export function forgetAccount(storage) {
  for(const key of [...Object.values(LISTS).map(l=>l.key),SYNC_KEY])try{storage.removeItem(key);}catch{}
}
