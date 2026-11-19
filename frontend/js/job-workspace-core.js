import {readState,stateQuery,filterKeys,filterValue} from './jobs-core.js';

export const SEARCH_KEY='wilsy-saved-searches-v1';
export const MAX_SEARCHES=8;
export const MAX_COMPARE=3;

// A reusable search contains filters, never a stale page or a selected job.
export function searchQuery(state){
  return stateQuery({...readState('?'+stateQuery(state)),page:1,id:'',saved:false});
}
export function searchName(query){
  const state=readState('?'+query);
  const values=filterKeys.filter(k=>state[k]&&!(k==='sort'&&state[k]==='found'))
    .map(k=>k==='sort'?'Latest posted':k==='salary'?'Salary disclosed':k==='visa'?'Visa sponsorship':k==='relocation'?'Relocation':k==='experience'?`${state[k]} years`:filterValue(k,state[k]));
  return values.join(' · ')||'All opportunities';
}
export function readSearches(storage){
  try{
    const data=JSON.parse(storage.getItem(SEARCH_KEY)||'[]');
    if(!Array.isArray(data))return [];
    return [...new Set(data.filter(v=>typeof v==='string'&&v.length<=2500).map(v=>searchQuery(readState('?'+v))).filter(Boolean))].slice(0,MAX_SEARCHES);
  }catch{return [];}
}
export function addSearch(existing,state){
  const query=searchQuery(state);
  if(!query)return {searches:existing,error:'Choose a keyword or filter before saving this search.'};
  if(existing.includes(query))return {searches:existing,error:'This search is already saved.'};
  if(existing.length>=MAX_SEARCHES)return {searches:existing,error:'You have eight saved searches. Remove one to make room.'};
  return {searches:[query,...existing],error:''};
}
export function toggleComparison(current,job){
  const id=String(job?.id||'');
  if(!/^\d+$/.test(id))return {jobs:current,error:'This role cannot be compared.'};
  if(current.some(v=>String(v.id)===id))return {jobs:current.filter(v=>String(v.id)!==id),error:''};
  if(current.length>=MAX_COMPARE)return {jobs:current,error:'Compare up to three roles. Remove a role to add another.'};
  return {jobs:[...current,job],error:''};
}

// "New since you last looked" for saved searches: when each search was last opened, and how many of its
// newest results (sorted by when WILSY found them) arrived after that.
export const SEEN_KEY='wilsy-search-seen-v1';
export function readSeen(storage){
  try{
    const data=JSON.parse(storage.getItem(SEEN_KEY)||'{}');
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    return Object.fromEntries(Object.entries(data).filter(([query,time])=>query.length<=2500&&typeof time==='string'&&Number.isFinite(Date.parse(time))).slice(0,50));
  }catch{return {};}
}
/** Seen times for the current saved searches only; a search seen for the first time counts from now. */
export function syncSeen(seen,searches,now=Date.now()){
  return Object.fromEntries(searches.map(query=>[query,seen[query]||new Date(now).toISOString()]));
}
export function newSince(jobs,since,pageSize=20){
  const after=Date.parse(since);
  if(!Number.isFinite(after)||!Array.isArray(jobs))return {count:0,more:false};
  const count=jobs.filter(job=>Date.parse(job.first_seen_at||job.discovered_at||'')>after).length;
  return {count,more:count>=pageSize&&count===jobs.length};
}
export const newLabel=({count=0,more=false}={})=>count?`${count}${more?'+':''} new`:'';
