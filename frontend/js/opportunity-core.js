// Shared by the Competitions and Coding contests pages, and by the tests. No DOM here.
export const KINDS={
  competition:{path:'/competitions',plural:'competitions',filterKeys:['q','subtype','mode','when','cash','sort'],pageSize:12},
  contest:{path:'/contests',plural:'contests',filterKeys:['source','when'],pageSize:36},
};
export const SUBTYPES={case:'Case competition',quiz:'Quiz',innovation:'Innovation challenge',general:'Competition'};
export const CONTEST_SOURCES=['Codeforces','AtCoder'];
const CONTEST_SUBTYPES={div1:'Div. 1',div2:'Div. 2',div3:'Div. 3',div4:'Div. 4',div1_div2:'Div. 1 + 2',div2_div3:'Div. 2 + 3',educational:'Educational',global:'Global round',
  abc:'Beginner',arc:'Regular',agc:'Grand',ahc:'Heuristic'};
export const subtypeLabel=item=>(item.kind==='contest'?CONTEST_SUBTYPES:SUBTYPES)[item.subtype]||null;

const allowed={subtype:Object.keys(SUBTYPES),mode:['online','offline','hybrid'],when:['week'],cash:['yes'],source:CONTEST_SOURCES,sort:['soon','new']};
export function readOpportunityState(kind,search=''){
  const p=new URLSearchParams(search),state={};
  for(const key of KINDS[kind].filterKeys){
    const value=(p.get(key)||'').slice(0,key==='q'?200:40);
    state[key]=key==='q'||allowed[key].includes(value)?value:'';
  }
  if('sort' in state)state.sort=state.sort||'soon';
  state.page=Math.min(5000,Math.max(1,parseInt(p.get('page'),10)||1));
  state.id=/^\d+$/.test(p.get('item')||'')?p.get('item'):'';
  return state;
}
export function opportunityQuery(kind,state){
  const p=new URLSearchParams();
  for(const k of KINDS[kind].filterKeys)if(state[k]&&!(k==='sort'&&state[k]==='soon'))p.set(k,state[k]);
  if(state.page>1)p.set('page',state.page);if(state.id)p.set('item',state.id);
  return p.toString();
}
export function opportunityFilters(kind,state){
  return {kind,...Object.fromEntries(KINDS[kind].filterKeys.filter(k=>state[k]).map(k=>[k,state[k]]))};
}

// Calendar days in the visitor's time zone, so a deadline at 10 am tomorrow reads "Closes tomorrow".
const calendarDay=t=>{const d=new Date(t);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());};
export function closingLabel(deadline,now=Date.now()){
  const end=Date.parse(deadline||'');
  if(!Number.isFinite(end)||end<now)return null;
  const days=Math.round((calendarDay(end)-calendarDay(now))/864e5);
  if(days>14)return null;
  return {text:days===0?'Closes today':days===1?'Closes tomorrow':`${days} days left`,soon:days<=3};
}
export function durationLabel(minutes){
  const m=Number(minutes);
  if(!Number.isFinite(m)||m<=0)return null;
  if(m>=2880&&m%1440===0)return `${m/1440} days`;
  if(m>=1440)return `${Math.round(m/60)} hours`;
  const h=Math.floor(m/60),rest=m%60;
  return h?`${h} h${rest?` ${rest} min`:''}`:`${rest} min`;
}
export function contestStatus(item,now=Date.now()){
  const start=Date.parse(item.starts_at||''),end=Date.parse(item.ends_at||'');
  if(Number.isFinite(start)&&start<=now&&(!Number.isFinite(end)||end>=now))return {text:'Live now',soon:true};
  if(!Number.isFinite(start))return null;
  const hours=(start-now)/36e5;
  if(hours<1)return {text:`Starts in ${Math.max(1,Math.round(hours*60))} min`,soon:true};
  if(hours<24)return {text:`Starts in ${Math.round(hours)} h`,soon:true};
  const days=Math.round((calendarDay(start)-calendarDay(now))/864e5);
  return {text:days===1?'Tomorrow':`In ${days} days`,soon:false};
}
// Local calendar date (yyyy-mm-dd) used to group contests by day.
export const dayKey=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

// A one-event iCalendar file (RFC 5545) so a contest can be added to any calendar app.
const icsText=value=>String(value??'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const icsTime=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const fold=line=>{const out=[];let rest=line;while(rest.length>74){out.push(rest.slice(0,74));rest=' '+rest.slice(74);}out.push(rest);return out.join('\r\n');};
export function contestIcs(item,now=Date.now()){
  if(!Number.isFinite(Date.parse(item.starts_at||'')))return null;
  const end=item.ends_at||new Date(Date.parse(item.starts_at)+(Number(item.duration_minutes)||60)*60000).toISOString();
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WILSY//Coding contests//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${icsText(`${item.source_name}-${item.external_id}`.toLowerCase().replace(/[^a-z0-9-]+/g,'-'))}@wilsy.in`,
    `DTSTAMP:${icsTime(now)}`,`DTSTART:${icsTime(item.starts_at)}`,`DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(item.title)}`,`URL:${icsText(item.official_url)}`,
    `DESCRIPTION:${icsText(`${item.source_name} contest. Register and check the rules on ${item.official_url}`)}`,
    'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Contest starts in 30 minutes','TRIGGER:-PT30M','END:VALARM',
    'END:VEVENT','END:VCALENDAR'];
  return lines.map(fold).join('\r\n')+'\r\n';
}
