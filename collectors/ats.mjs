// Public job-board (ATS) services: how their links look and how to read a board through their API.
// Each read returns {name?, jobs:[{title,url,location}]} or throws an HttpError.

export class HttpError extends Error {
  constructor(status,url){super(`HTTP ${status}`);this.status=status;this.url=url;}
}

const job=(title,url,location)=>({title:String(title||'').trim(),url:String(url||''),location:String(location||'')});
const slugOk=s=>/^[a-z0-9][a-z0-9._ %-]{0,79}$/i.test(s)&&!/^(embed|jobs|api|v\d|careers|search|apply|en|us)$/i.test(s);

export const ATS={
  greenhouse:{
    links:[/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/gi],
    async read(slug,get){
      const [board,jobs]=await Promise.all([get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`),
        get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`)]);
      return {name:board.name,jobs:(jobs.jobs||[]).map(j=>job(j.title,j.absolute_url,j.location?.name))};
    }
  },
  lever:{
    links:[/jobs\.(?:eu\.)?lever\.co\/([a-z0-9._-]+)/gi],
    async read(slug,get){
      const data=await get(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
      if(!Array.isArray(data))throw new HttpError(404,slug);
      return {jobs:data.map(j=>job(j.text,j.hostedUrl,j.categories?.location))};
    }
  },
  ashby:{
    links:[/jobs\.ashbyhq\.com\/([^/?#"'\s<>]+)/gi],
    async read(slug,get){
      const data=await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
      return {jobs:(data.jobs||[]).map(j=>job(j.title,j.jobUrl,j.location))};
    }
  },
  workable:{
    links:[/apply\.workable\.com\/([a-z0-9_-]+)/gi,/\/\/([a-z0-9-]+)\.workable\.com/gi],
    async read(slug,get){
      const data=await get(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`);
      return {name:data.name,jobs:(data.jobs||[]).map(j=>job(j.title,j.url||j.shortlink,[j.city,j.country].filter(Boolean).join(', ')))};
    }
  },
  smartrecruiters:{
    links:[/(?:careers|jobs)\.smartrecruiters\.com\/([a-z0-9_-]+)/gi],
    async read(slug,get){
      const data=await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100`);
      return {jobs:(data.content||[]).map(j=>job(j.name,`https://jobs.smartrecruiters.com/${slug}/${j.id}`,j.location?.city))};
    }
  },
  recruitee:{
    links:[/\/\/([a-z0-9-]+)\.recruitee\.com/gi],
    async read(slug,get){
      const data=await get(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`);
      return {jobs:(data.offers||[]).map(j=>job(j.title,j.careers_url,j.location))};
    }
  }
};
// Recognised but not readable through a simple public API yet; recorded so a collector can be added.
export const UNSUPPORTED=[['workday',/([a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[a-z0-9_-]+)/gi],
  ['dover',/app\.dover\.com\/(?:jobs|apply)\/([a-z0-9][a-z0-9_.-]*)/gi],['rippling',/ats\.rippling\.com\/([a-z0-9][a-z0-9_.-]*)/gi],
  ['gem',/jobs\.gem\.com\/([a-z0-9][a-z0-9_.-]*)/gi],['bamboohr',/\/\/([a-z0-9-]+)\.bamboohr\.com/gi],
  ['workatastartup',/workatastartup\.com\/companies\/([a-z0-9_-]+)/gi]];
// Pages often carry links inside HTML attributes or JSON, escaped.
const ESCAPED_SLASHES=[String.raw`\u002F`,String.raw`\/`];
const decodeEntities=s=>ESCAPED_SLASHES.reduce((t,e)=>t.split(e).join('/'),s.replace(/&quot;|&#34;|&#x22;/gi,'"').replace(/&#x2F;|&#47;/gi,'/').replace(/&amp;/gi,'&'));

// Every job-board link in a URL or HTML page, in the order they appear, de-duplicated.
export function findBoards(text) {
  text=decodeEntities(String(text));
  const matches=[];
  for(const [ats,{links}] of Object.entries(ATS))for(const re of links)for(const m of text.matchAll(re))matches.push({ats,slug:m[1],at:m.index});
  for(const [ats,re] of UNSUPPORTED)for(const m of text.matchAll(re))matches.push({ats,slug:m[1],at:m.index});
  const found=[],seen=new Set();
  for(let {ats,slug} of matches.sort((a,b)=>a.at-b.at)){
    try{slug=decodeURIComponent(slug);}catch{}
    slug=slug.trim();
    const key=`${ats}:${slug.toLowerCase()}`;
    if(!seen.has(key)&&(ATS[ats]?slugOk(slug):slug.length>2)){seen.add(key);found.push({ats,slug});}
  }
  return found;
}

export const normalizeName=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'')
  .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|technologies|technology|labs|ai|hq|pvt|private)\b\.?/g,'').replace(/[^a-z0-9]+/g,'');

// Board-name guesses from a company's name and website, for the last-resort probe.
export function slugGuesses(name,website) {
  const out=new Set();
  try{const host=new URL(website).hostname.replace(/^www\./,'');const root=host.split('.')[0];if(root.length>2)out.add(root);}catch{}
  const words=String(name||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').trim().split(/\s+/).filter(Boolean);
  if(words.length){out.add(words.join(''));out.add(words.join('-'));}
  return [...out].filter(s=>s.length>2&&slugOk(s)).slice(0,4);
}

// Placeholder and generator-made watchlist names; never searched, to avoid false matches.
const PREFIX='Tech|Info|Bharat|Data|Cloud|Cyber|Neo|Next|Hyper|Fin|Health|Edu|Agri|Smart|Vishwa|Zeta|Omni|Aero|Quantum|Mind|Innova|Veda|Niti|Maha|Alpha|Beta|Gamma|Code|Dev|Stack|Core|Logic|Vision|Future|Apex|Global|Nexus|Vertex|Stellar|Prime|Meta|Sync|Pulse|Astro|Nova|Pioneer|Zenith|Frontier|Blue|Red|Green|Silver|Gold|Titan|Iron|Byte|Tera|Giga|Nano|Peta|Exa|Tata|Reliance|Wipro|HCL';
const SUFFIX='Systems|Solutions|Technologies|Labs|Software|Networks|Analytics|Consulting|Tech|Digital|Works|Hub|Space|Grid|Matrix|Dynamics|Services|Ventures|Innovations|Corp|Group|Studios|Enterprises|Inc|LLC|Holdings|Data|Cloud|AI|Robotics|Security|Capital';
const GENERATED=new RegExp(`^(${PREFIX}) (${SUFFIX})( \\d+)?$`,'i');
// Real companies whose names happen to fit the generator's pattern.
const REAL=new Set(['tata technologies','hcl technologies']);
export const isSyntheticName=name=>{
  const n=String(name||'').trim();
  return /^LEGACY_UNRESOLVED_/.test(n)||/ \d+$/.test(n)||(GENERATED.test(n)&&!REAL.has(n.toLowerCase()));
};
