import {inr,salaryRange,usdTextToInr,salaryPeriod} from './pay-format.js';
export const PAGE_SIZE=20;
export const filterKeys=['q','time','stage','mode','role','country','company','skill','type','seniority','experience','salary','period','minimum','visa','relocation','sort'];
export function readState(search='') {
  const p=new URLSearchParams(search),state={};
  for(const k of filterKeys)state[k]=(p.get(k)||'').slice(0,k==='q'?200:120);
  state.sort=state.sort==='posted'?'posted':'found';
  for(const k of ['minimum','experience'])if(state[k]&&!/^\d+(\.\d+)?$/.test(state[k]))state[k]='';
  state.page=Math.min(5001,Math.max(1,Number.parseInt(p.get('page'),10)||1));
  state.saved=p.get('saved')==='1';state.id=/^\d+$/.test(p.get('job')||'')?p.get('job'):'';
  return state;
}
export function stateQuery(state) {
  const p=new URLSearchParams();
  for(const k of filterKeys)if(state[k]&&!(k==='sort'&&state[k]==='found'))p.set(k,state[k]);
  if(state.page>1)p.set('page',String(state.page));
  if(state.saved)p.set('saved','1');if(state.id)p.set('job',state.id);
  return p.toString();
}
export function apiFilters(state,savedIds=[],fx) {
  const f=Object.fromEntries(filterKeys.filter(k=>state[k]).map(k=>[k,state[k]]));
  if(!f.period||!fx?.rate)delete f.minimum;
  if(f.minimum){f.display_currency='INR';f.inr_rate=fx.rate;}
  if(state.saved)f.saved=savedIds.map(String).slice(0,500);
  return f;
}
export const applyUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export const label=value=>String(value||'Not specified').replaceAll('_',' ').replaceAll('-',' ').replace(/^\w/,c=>c.toUpperCase());
export function dateLabel(value,{time=true}={}) {
  if(!value||!Number.isFinite(Date.parse(value)))return 'Not provided';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit',timeZoneName:'short'}:{}),timeZone:'UTC'}).format(new Date(value));
}
export function postingLabel(job) {
  if(job.posted_at)return `Posted ${dateLabel(job.posted_at,{time:!['date_only','date','unknown'].includes(job.posted_at_precision)})}`;
  return `Found ${dateLabel(job.first_seen_at||job.discovered_at,{time:false})}`;
}
export function jobSalary(job,fx) {
  const range={min:job.salary_min,max:job.salary_max};
  if(range.min==null&&range.max==null)return {primary:job.salary_currency==='USD'?usdTextToInr(job.salary_text,fx.rate)||'Salary not disclosed':job.salary_text||'Salary not disclosed',secondary:job.salary_currency==='USD'&&job.salary_text?'INR estimate':'',note:''};
  const knownPeriod=salaryPeriod(job.salary_period,job.salary_text);
  const period=knownPeriod?` / ${label(knownPeriod).toLowerCase()}`:' · period not specified';
  const curr=job.salary_currency;
  const amount=format=>range.min==null?'Up to '+format(range.max):range.max==null?'From '+format(range.min):salaryRange(range,format);
  if(curr==='USD')return {primary:amount(n=>inr(n,fx.rate))+period,secondary:'INR estimate',note:`Converted using the reference rate dated ${fx.date}`};
  if(curr==='INR')return {primary:amount(n=>inr(n,1))+period,secondary:'Published in INR',note:''};
  const format=n=>`${curr||'Currency unspecified'} ${Number(n).toLocaleString('en-US')}`;
  return {primary:amount(format)+period,secondary:'',note:''};
}
export function readSaved(storage) {
  try {const ids=JSON.parse(storage.getItem('wilsy-saved-jobs')||'[]');return Array.isArray(ids)?[...new Set(ids.filter(id=>/^\d+$/.test(String(id))).map(String))].slice(0,500):[];}catch{return [];}
}
