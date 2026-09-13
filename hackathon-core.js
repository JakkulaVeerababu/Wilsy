import {inr,salaryRange,usdTextToInr} from './pay-format.js';
import {applyUrl} from './jobs-core.js';
export const hackathonFilterKeys=['q','mode','country','theme','when','cash','team','sort'];
export function readHackathonState(search=''){
  const p=new URLSearchParams(search),state={};
  for(const key of hackathonFilterKeys)state[key]=(p.get(key)||'').slice(0,key==='q'?200:120);
  state.sort=['start','deadline','found'].includes(state.sort)?state.sort:'start';
  state.page=Math.min(8334,Math.max(1,parseInt(p.get('page'),10)||1));
  state.id=/^\d+$/.test(p.get('event')||'')?p.get('event'):'';state.saved=p.get('saved')==='1';
  return state;
}
export function hackathonQuery(state){
  const p=new URLSearchParams();for(const k of hackathonFilterKeys)if(state[k]&&!(k==='sort'&&state[k]==='start'))p.set(k,state[k]);
  if(state.page>1)p.set('page',state.page);if(state.id)p.set('event',state.id);if(state.saved)p.set('saved','1');return p.toString();
}
export function hackathonFilters(state,saved=[]){
  const result=Object.fromEntries(hackathonFilterKeys.filter(k=>state[k]).map(k=>[k,state[k]]));
  if(state.saved)result.saved=saved;return result;
}
export function prizeValue({min,max,currency,raw},fx){
  if(min==null&&max==null)return {amount:raw?(currency==='USD'?usdTextToInr(raw,fx.rate):raw):'Prize not disclosed',note:raw&&currency==='USD'?'INR estimate':''};
  const format=n=>currency==='USD'?inr(n,fx.rate):currency==='INR'?inr(n,1):`${Number(n).toLocaleString('en-US')} ${currency||'(currency not specified)'}`;
  const amount=min==null?'Up to '+format(max):max==null?'From '+format(min):salaryRange({min,max},format);
  return {amount,note:currency==='USD'?'INR estimate':currency==='INR'?'Published in INR':'As published'};
}
export function teamLabel(event){
  const min=event.team_size_min,max=event.team_size_max;
  if(min==null&&max==null)return 'Team size not specified';
  if(min===1&&max===1)return 'Solo participation';
  if(min==null)return `Up to ${max} people`;
  if(max==null)return `${min}+ people`;
  return min===max?`${min} people`:`${min}–${max} people`;
}
export function eventPhase(event,now=Date.now()){
  if(event.ends_at&&Date.parse(event.ends_at)<now)return 'Event ended';
  if(event.starts_at&&event.ends_at&&Date.parse(event.starts_at)<=now&&Date.parse(event.ends_at)>=now)return 'In progress';
  if(event.registration_deadline_at&&Date.parse(event.registration_deadline_at)<now)return 'Registration ended';
  if(event.starts_at&&Date.parse(event.starts_at)>now)return 'Upcoming';
  return 'Verified listing';
}
export function registrationLink(event,now=Date.now()){
  const registration=applyUrl(event.registration_url),official=applyUrl(event.official_url)||applyUrl(event.source_url);
  const ended=(event.registration_deadline_at&&Date.parse(event.registration_deadline_at)<now)||(event.ends_at&&Date.parse(event.ends_at)<now);
  const notYet=event.registration_opens_at&&Date.parse(event.registration_opens_at)>now;
  return {url:ended||notYet?official||registration:registration||official,label:ended||notYet?'View organizer details':registration?'Official registration':'Organizer website',ended:!!ended,notYet:!!notYet};
}
export function readSavedHackathons(storage){
  try{const ids=JSON.parse(storage.getItem('wilsy-saved-hackathons')||'[]');return Array.isArray(ids)?[...new Set(ids.filter(id=>/^\d+$/.test(String(id))).map(String))].slice(0,500):[];}catch{return [];}
}
