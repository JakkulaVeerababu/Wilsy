// Government notices collector: refreshes frontend/data/government-jobs.json from two official,
// static recruitment pages, once a day (a step of the daily snapshot workflow).
//
// Sources and why they are used:
// - ISRO current opportunities (isro.gov.in, covering ISRO centres and the Department of Space):
//   a static page with one row per advertisement; each row links a detail page with its status,
//   centre, location and PDFs. The site publishes no robots.txt.
// - BARC new vacancies (barc.gov.in): a static table of current advertisements and walk-in
//   interviews with their last dates. robots.txt disallows only /cgi-bin/.
// Portals that need a login, show a bot check or offer no static listing (UPSC ORA, RBI, India Post,
// SSC, NCS) are never read here; they stay as hub links for people to check themselves.
//
// Hand-curated rows keep their wording. A row leaves the snapshot when its deadline passes, when
// its official page no longer says it is open, or when the official list it came from drops it.
// A source that fails to load changes nothing about its rows.
// Usage: node collectors/government.mjs [path/to/government-jobs.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import {createClient,pool} from './http.mjs';

export const ISRO_LIST='https://www.isro.gov.in/CurrentOpportunities.html';
export const BARC_LIST='https://www.barc.gov.in/careers/recruitment.html';
const DOS='Department of Space, Government of India',DAE='Department of Atomic Energy, Government of India';
// Rows without a printed last date are looked at only while their advertisement is recent.
const RECENT_DAYS=60;

const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘'};
// Tags out, entities decoded, invisible joiners removed, whitespace collapsed.
export function clean(html) {
  return String(html??'')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&([a-z]+);/gi,(m,name)=>ENTITIES[name.toLowerCase()]??m)
    .replace(/[​-‍⁠﻿]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

// Bilingual cells read "हिन्दी / English"; keep the English half.
export function english(text) {
  const parts=String(text??'').split(' / ').map(s=>s.trim()).filter(Boolean);
  return parts.find(part=>/[A-Za-z]/.test(part)&&!/[ऀ-ॿ]/.test(part))||parts.at(-1)||'';
}

const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const iso=(y,m,d)=>{
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
};
// Reads the date formats these portals print: "October 24, 2026", "Oct 15, 2026", "16-Nov-2026",
// "06 November 2026" and "14/02/2026" (day first). Returns YYYY-MM-DD or null.
export function parseDate(text) {
  const s=clean(text);
  let m=s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*,\s*(\d{4})\b/);
  if(m&&MONTHS[m[1].slice(0,3).toLowerCase()])return iso(+m[3],MONTHS[m[1].slice(0,3).toLowerCase()],+m[2]);
  m=s.match(/\b(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{4})\b/);
  if(m&&MONTHS[m[2].slice(0,3).toLowerCase()])return iso(+m[3],MONTHS[m[2].slice(0,3).toLowerCase()],+m[1]);
  m=s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if(m)return iso(+m[3],+m[2],+m[1]);
  return null;
}

export const todayInIndia=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const addDays=(day,n)=>new Date(Date.parse(`${day}T00:00:00Z`)+n*86400000).toISOString().slice(0,10);
const readable=day=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${day}T00:00:00Z`));
const slug=text=>String(text).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60).replace(/-+$/,'');

// "Recruitment to the posts of X" -> "X". Titles keep the portal's wording otherwise.
export function tidyTitle(text) {
  let title=clean(text)
    .replace(/^(?:recruitment|application|applications|advertisement|notification)\s+(?:to|for)\s+(?:the\s+)?(?:various\s+)?posts?\s+of\s+/i,'')
    .replace(/^walk[\s-]*in[\s-]*interviews?\s+for\s+(?:the\s+)?posts?\s+of\s+/i,'')
    // "Technician - B/ Driver- A" -> "Technician-B / Driver-A"; grade forms like "Assistant/B" stay.
    .replace(/\s+\/\s*|\s*\/\s+/g,' / ')
    .replace(/\s*-\s*(?=[A-Z]\b)/g,'-')
    .replace(/\s+/g,' ').trim();
  if(/^walk[\s-]*in/i.test(clean(text))&&!/walk-in/i.test(title))title+=', walk-in interview';
  return title.charAt(0).toUpperCase()+title.slice(1);
}

export function categoryFor(title) {
  const t=title.toLowerCase();
  if(/medical|doctor|nurs|radiograph|patholog|pharmac|physician|dental|paramedic|lab(?:oratory)? technician/.test(t))return 'Medical';
  if(/apprentice/.test(t))return 'Apprenticeship';
  if(/accounts?\b|finance|audit/.test(t))return 'Finance';
  if(/scientist|engineer|scientific|research|fellow/.test(t))return 'Scientific';
  if(/technician|driver|draughts|tradesman|fireman|mechanic|operator|attendant/.test(t))return 'Technical';
  if(/group[- ]?[abc]\b|assistant|clerk|steno|officer|administrat|secretar|hindi|translator|deputation/.test(t))return 'Administration';
  return 'General';
}

// ---------- ISRO ----------
// The list is a grid of spans: post, advtNum, opendate, closedate and a details link.
export function parseIsroList(html,base=ISRO_LIST) {
  const flat=String(html).replace(/\s+/g,' ');
  return flat.split(/<span class="post">/).slice(1).map(part=>{
    const field=name=>clean((part.match(new RegExp(`<span class="${name}">(.*?)</span>`))||[])[1]||'');
    const href=(part.match(/<a[^>]+href="([^"#]+\.html)"/i)||[])[1];
    return {
      post:clean(part.split('</span>')[0]),
      advt:field('advtNum'),
      opening:parseDate(field('opendate')),
      closing:parseDate(field('closedate')),
      url:href?new URL(href,base).href:null
    };
  }).filter(row=>row.post&&row.url&&row.url.startsWith('https://www.isro.gov.in/'));
}

// The detail page is a small label/value table, then remarks with PDF links.
export function parseIsroDetail(html,base) {
  const flat=String(html).replace(/\s+/g,' ');
  const cells=[...flat.matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map(m=>clean(m[1]));
  const after=label=>{const i=cells.findIndex(cell=>label.test(cell));return i>=0?cells[i+1]??'':'';};
  const pdfs=[...flat.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)<\/a>/gi)].map(m=>({url:new URL(m[1],base).href,label:clean(m[2])}));
  return {
    advt:after(/Advertisement Number/i),
    advertised:parseDate(after(/Advertisement Date/i)),
    deadline:parseDate(after(/Last Date/i)),
    centre:english(after(/ISRO Centre/i)),
    area:english(after(/Area of Work/i)),
    status:english(after(/Status/i)),
    location:english(after(/Location/i)),
    pdf:pdfs.find(p=>/advertisement/i.test(p.label))?.url||pdfs[0]?.url||null
  };
}

function isroRow(list,detail,today) {
  const centre=detail.centre||'ISRO';
  const organization=/department of space/i.test(centre)?'Department of Space Secretariat, ISRO':/\bISRO\b/.test(centre)?centre:`${centre}, ISRO`;
  const title=tidyTitle(list.post);
  const advertised=detail.advertised||list.opening;
  const deadline=detail.deadline||list.closing;
  return {
    id:`isro-${slug(new URL(list.url).pathname.replace(/\.html$/,''))}-${slug(list.advt||detail.advt||title).slice(0,30)}`.replace(/-+$/,''),
    title,
    organization,
    ministryDepartment:DOS,
    category:categoryFor(`${title} ${detail.area}`),
    level:'See notice',
    gradeLevel:'Pay level and grade as listed in the official notice',
    salaryPayBand:'Pay level and allowances as listed in the official notice.',
    experienceEligibility:'Qualifications, experience and age limits are set out in the official notice; check them before applying.',
    location:detail.location||'See notice',
    openingDate:advertised&&advertised<=today?advertised:today,
    deadline,
    status:'Open',
    noticeNumber:list.advt||detail.advt||'See notice',
    officialNoticeUrl:list.url,
    sourceUrl:list.url,
    sourceDomain:'isro.gov.in',
    verificationNote:`Official ISRO careers page lists this notice as Open${advertised?`, advertised ${readable(advertised)}`:''}, with applications closing ${readable(deadline)}. Collected automatically on ${readable(today)}; confirm eligibility, pay and the application process in the official advertisement.`
  };
}

export async function readIsro(page,today) {
  const {text}=await page(ISRO_LIST);
  const rows=parseIsroList(text);
  if(!rows.length)throw new Error('ISRO list had no rows; the page layout may have changed');
  const recent=addDays(today,-RECENT_DAYS);
  // Rows still open by their printed date, plus recent rows that print no closing date.
  const candidates=rows.filter(row=>row.closing?row.closing>=today:(row.opening&&row.opening>=recent));
  const seen=new Set(),unique=candidates.filter(row=>!seen.has(row.url)&&seen.add(row.url));
  const details=await pool(unique,2,async row=>{
    try{const {text:html}=await page(row.url);return {row,detail:parseIsroDetail(html,row.url)};}
    catch(error){return {row,error:String(error.message||error)};}
  });
  return {
    listed:new Set(rows.map(row=>row.url)),
    // url -> {open, row?}; open is false when the official page says the notice is closed.
    checked:new Map(details.filter(d=>!d.error).map(({row,detail})=>{
      const open=/^open\b/i.test(detail.status);
      const deadline=detail.deadline||row.closing;
      return [row.url,{open,row:open&&deadline&&deadline>=today?isroRow(row,detail,today):null}];
    })),
    skipped:details.filter(d=>d.error||(!(d.detail?.deadline||d.row.closing)&&/^open\b/i.test(d.detail?.status||''))).map(d=>({url:d.row.url,title:tidyTitle(d.row.post),reason:d.error||'open, but no last date on the page'}))
  };
}

// ---------- BARC ----------
export function parseBarcList(html,base=BARC_LIST) {
  const flat=String(html).replace(/\s+/g,' ');
  const updated=parseDate((flat.match(/Last Updated on(.{0,120})/i)||[])[1]||'');
  const body=(flat.match(/<tbody[^>]*>(.*?)<\/tbody>/i)||[])[1]||'';
  const rows=[...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/gi)].map(m=>{
    const cells=[...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map(c=>c[1]);
    if(cells.length<4)return null;
    // The title cell may also hold a "download the form" link; the notice is the PDF in the last cell.
    const titleHtml=cells[1].split(/<b>|<font|<a /i)[0];
    const notice=(cells[3].match(/href=['"]([^'"]+\.pdf)['"]/i)||[])[1];
    const form=(cells[1].match(/href=['"]([^'"]+\.pdf)['"]/i)||[])[1];
    return {
      advt:clean(cells[0]),
      post:clean(titleHtml),
      deadline:parseDate(cells[2]),
      url:notice?new URL(notice,base).href:null,
      form:form?new URL(form,base).href:null
    };
  }).filter(row=>row&&row.post&&row.url&&row.url.startsWith('https://www.barc.gov.in/'));
  return {updated,rows};
}

function barcRow(row,updated,today) {
  const title=tidyTitle(row.post);
  const walkIn=/walk[\s-]*in/i.test(row.post);
  return {
    id:`barc-${slug(path.posix.basename(new URL(row.url).pathname,'.pdf'))}-${slug(title).slice(0,40)}`.replace(/-+$/,''),
    title,
    organization:'Bhabha Atomic Research Centre (BARC)',
    ministryDepartment:DAE,
    category:categoryFor(title),
    level:'See notice',
    gradeLevel:'Grade and emoluments as listed in the official notice',
    salaryPayBand:'Pay and allowances as listed in the official notice.',
    experienceEligibility:'Qualifications, experience and age limits are set out in the official notice; check them before applying.',
    location:'Mumbai (venue in the notice)',
    openingDate:updated&&updated<=today?updated:today,
    deadline:row.deadline,
    status:'Open',
    noticeNumber:`BARC ${row.advt}`.trim(),
    officialNoticeUrl:row.url,
    sourceUrl:BARC_LIST,
    sourceDomain:'barc.gov.in',
    verificationNote:`BARC’s official new-vacancies page${updated?` (last updated ${readable(updated)})`:''} lists this ${walkIn?'walk-in interview':'advertisement'} with the last date ${readable(row.deadline)}. Collected automatically on ${readable(today)}; read the notice for the venue, timing, eligibility and documents to bring.`
  };
}

export async function readBarc(page,today) {
  const {text}=await page(BARC_LIST);
  const {updated,rows}=parseBarcList(text);
  if(!rows.length&&!/<tbody/i.test(text))throw new Error('BARC page had no vacancy table; the page layout may have changed');
  return {
    listed:new Set(rows.map(row=>row.url)),
    rows:rows.filter(row=>row.deadline&&row.deadline>=today).map(row=>barcRow(row,updated,today))
  };
}

// ---------- merge ----------
const sourceOf=job=>job.sourceDomain==='barc.gov.in'?'barc':job.sourceDomain==='isro.gov.in'?'isro':null;
const keyOf=job=>sourceOf(job)==='barc'?job.officialNoticeUrl:job.sourceUrl;

// Decides the new job list. `isro`/`barc` are reader results, or null when that source failed.
export function plan({snapshot,isro,barc,today}) {
  const kept=[],dropped=[];
  for(const job of snapshot.jobs){
    const source=sourceOf(job),key=keyOf(job);
    let reason=null;
    if(!job.deadline||job.deadline<today)reason='deadline passed';
    else if(source==='isro'&&isro){
      const check=isro.checked.get(key);
      if(!isro.listed.has(key))reason='no longer on the ISRO list';
      else if(check&&!check.open)reason='ISRO page no longer says Open';
    } else if(source==='barc'&&barc&&!barc.listed.has(key))reason='no longer on the BARC list';
    if(reason)dropped.push({id:job.id,title:job.title,reason});else kept.push(job);
  }
  const have=new Set(kept.map(keyOf)),ids=new Set(kept.map(job=>job.id)),added=[];
  const fresh=[...(isro?[...isro.checked.values()].map(c=>c.row).filter(Boolean):[]),...(barc?barc.rows:[])];
  for(const row of fresh.sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.title.localeCompare(b.title))){
    if(have.has(keyOf(row)))continue;
    let id=row.id;for(let n=2;ids.has(id);n++)id=`${row.id}-${n}`;
    ids.add(id);have.add(keyOf(row));added.push({...row,id});
  }
  const jobs=[...kept,...added].map((job,i)=>({...job,rank:i+1}));
  return {jobs,added:jobs.slice(kept.length),dropped};
}

const ORGS={isro:'ISRO / the Department of Space',barc:'the Bhabha Atomic Research Centre (BARC)'};
export function coverageNote(jobs,today) {
  const orgs=[...new Set(jobs.map(sourceOf).filter(Boolean))].map(s=>ORGS[s]);
  const count=jobs.length,words=['no','one','two','three','four','five','six','seven','eight','nine','ten'];
  const from=orgs.length?` from ${orgs.join(' and ')}`:'';
  return `Official-source coverage only. This snapshot includes ${words[count]??count} open notice${count===1?'':'s'}${from}, checked on ${readable(today)}, plus selected official discovery hubs; it does not claim complete coverage of all central, state or public-sector vacancies.`;
}

export async function main({file=path.resolve(import.meta.dirname,'../frontend/data/government-jobs.json'),client=createClient({perHost:2,timeoutMs:30000}),now=new Date(),log=console.log}={}) {
  const snapshot=JSON.parse(await fs.readFile(file,'utf8'));
  const today=todayInIndia(now);
  const settle=async (name,run)=>{try{return await run();}catch(error){log(`${name}: unavailable (${error.message||error}); its rows are left as they were`);return null;}};
  const [isro,barc]=await Promise.all([settle('ISRO',()=>readIsro(client.page,today)),settle('BARC',()=>readBarc(client.page,today))]);
  if(!isro&&!barc)throw new Error('Neither official source could be read; the snapshot was not changed.');
  const {jobs,added,dropped}=plan({snapshot,isro,barc,today});
  const next={...snapshot,checkedAt:today,coverageNote:coverageNote(jobs,today),jobs};
  await fs.writeFile(file,JSON.stringify(next,null,2)+'\n');
  // Open notices without a printed last date need a person to read the PDF; curated rows already have one.
  const covered=new Set(jobs.map(keyOf)),skipped=(isro?.skipped||[]).filter(item=>!covered.has(item.url));
  log(`Government notices for ${today}: ${jobs.length} open (${added.length} added, ${dropped.length} removed).`);
  for(const job of added)log(`  + ${job.title} (${job.organization}), last date ${job.deadline}`);
  for(const job of dropped)log(`  - ${job.title}: ${job.reason}`);
  for(const item of skipped)log(`  ? ${item.title}: ${item.reason} (${item.url})`);
  return {jobs,added,dropped,skipped,sources:{isro:!!isro,barc:!!barc}};
}

if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main(process.argv[2]?{file:path.resolve(process.argv[2])}:{});
