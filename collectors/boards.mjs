// Full job inventories from public job-board APIs, normalised to one shape for wilsy_ingest_board.
// Apply URLs follow the original Worker D conventions exactly, since they are the jobs table's unique key.

const ENTITIES={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',bull:'•',hellip:'…'};
const decode=s=>s.replace(/&(#x?[\da-f]+|[a-z]+);/gi,(m,n)=>{
  const k=n.toLowerCase();if(k in ENTITIES)return ENTITIES[k];
  const code=k.startsWith('#x')?parseInt(k.slice(2),16):k.startsWith('#')?parseInt(k.slice(1),10):NaN;
  return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):m;
});
// Readable plain text with paragraph breaks, from HTML or entity-escaped HTML.
export function plainText(value,max=50000) {
  let text=String(value??'');
  for(let i=0;i<3&&/&(?:lt|gt|amp|quot|#\d+|#x[\da-f]+);/i.test(text);i++)text=decode(text);
  text=text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<\s*(?:br|\/p|\/div|\/h[1-6]|\/ul|\/ol|\/tr)\s*\/?>/gi,'\n').replace(/<\s*li\b[^>]*>/gi,'\n• ')
    .replace(/<[^>]*>/g,' ');
  text=decode(text).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g,' ').replace(/[  ]+/g,' ')
    .replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return text.slice(0,max)||null;
}
export const canonicalUrl=url=>String(url||'').split('#')[0].replace(/\/$/,'');
export function jobType(raw,title='') {
  const v=`${raw||''}`.toLowerCase();
  if(/intern/.test(v)||(!v&&/\bintern(ship)?\b/i.test(title)))return 'internship';
  if(/part/.test(v))return 'part_time';
  if(/contract|freelance/.test(v))return 'contract';
  if(/temp/.test(v))return 'temporary';
  if(/full/.test(v))return 'full_time';
  return /\bintern(ship)?\b/i.test(title)?'internship':'other';
}
export function workMode(...hints) {
  const v=hints.filter(Boolean).join(' ').toLowerCase();
  if(/remote/.test(v))return 'remote';
  if(/hybrid/.test(v))return 'hybrid';
  if(/on-?site|in[- ]office|office/.test(v))return 'onsite';
  return 'unspecified';
}
const PERIODS={year:'year',yearly:'year',annual:'year','1 year':'year','per-year-salary':'year',month:'month','1 month':'month','per-month-salary':'month',
  hour:'hour','1 hour':'hour','per-hour-wage':'hour',week:'week','1 week':'week',day:'day','1 day':'day'};
const salaryPeriod=raw=>PERIODS[String(raw||'').toLowerCase()]||null;
const iso=value=>{if(value==null||value==='')return null;const d=new Date(typeof value==='number'?value:String(value));return Number.isNaN(d.getTime())?null:d.toISOString();};
const num=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const clean=s=>{const t=String(s??'').replace(/\s+/g,' ').trim();return t||null;};

function job(fields) {
  const url=canonicalUrl(fields.url),source=canonicalUrl(fields.source_url||fields.url);
  return {external_id:clean(fields.external_id)||url,title:clean(fields.title),url,source_url:source,location:clean(fields.location),
    description:fields.description?String(fields.description).trim().slice(0,50000)||null:null,department:clean(fields.department),team:clean(fields.team),
    job_type:fields.job_type,work_mode:fields.work_mode,posted_at:iso(fields.posted_at),
    employment_type_raw:clean(fields.employment_type_raw),workplace_type_raw:clean(fields.workplace_type_raw),
    salary_min:num(fields.salary_min),salary_max:num(fields.salary_max),salary_currency:clean(fields.salary_currency)?.toUpperCase()||null,
    salary_period:fields.salary_period||null,salary_text:clean(fields.salary_text)};
}

// Same role filter as the collector in Postgres (wilsy_ingest_board applies it authoritatively).
export const TECH_ROLE=/(software|developer|engineer|engineering|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|machine learning|(^|[^a-z])ml([^a-z]|$)|artificial intelligence|(^|[^a-z])ai([^a-z]|$)|data scientist|data engineer|analytics engineer|devops|site reliability|(^|[^a-z])sre([^a-z]|$)|platform engineer|cloud engineer|security engineer|cyber|firmware|embedded|fpga|rtl|asic|vlsi|verification engineer|hardware engineer|electrical engineer|electronics|computer vision|nlp|research engineer|solutions architect|technical architect|qa engineer|sdet|test automation|database engineer|systems engineer|network engineer|robotics)/;

// A reader must fail loudly when a service answers with an unexpected shape: an empty list would
// otherwise be treated as "this company has no open roles".
const list=(value,service)=>{if(!Array.isArray(value))throw new Error(`Unexpected ${service} response`);return value;};
const SMARTRECRUITERS_MAX=5000;

export const READERS={
  async greenhouse(slug,get) {
    const data=await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
    return list(data?.jobs,'Greenhouse').map(j=>job({external_id:j.id,title:j.title,url:j.absolute_url,location:j.location?.name,description:plainText(j.content),
      department:(j.departments||[]).map(d=>d.name).filter(Boolean).join(' / '),job_type:jobType('',j.title),work_mode:workMode(j.location?.name),
      posted_at:j.first_published||j.updated_at,workplace_type_raw:j.location?.name}));
  },
  async ashby(slug,get) {
    const data=await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
    return list(data?.jobs,'Ashby').filter(j=>j.isListed!==false).map(j=>{
      const pay=(j.compensation?.summaryComponents||[]).find(c=>/salary/i.test(c.compensationType||''));
      return job({external_id:j.id,title:j.title,url:j.applyUrl||j.jobUrl,source_url:j.jobUrl,location:j.location,
        description:j.descriptionPlain||plainText(j.descriptionHtml),department:j.department,team:j.team,job_type:jobType(j.employmentType,j.title),
        work_mode:workMode(j.workplaceType,j.isRemote&&'remote',j.location),posted_at:j.publishedAt,employment_type_raw:j.employmentType,
        workplace_type_raw:j.workplaceType,salary_min:pay?.minValue,salary_max:pay?.maxValue,salary_currency:pay?.currencyCode,
        salary_period:salaryPeriod(pay?.interval),salary_text:j.compensation?.compensationTierSummary});
    });
  },
  async lever(slug,get) {
    const data=await get(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    if(!Array.isArray(data))throw new Error('Unexpected Lever response');
    return data.map(j=>job({external_id:j.id,title:j.text,url:j.applyUrl||j.hostedUrl,source_url:j.hostedUrl,location:j.categories?.location,
      description:[j.descriptionPlain||plainText(j.description),...(j.lists||[]).map(l=>`${l.text}\n${plainText(l.content)||''}`),
        j.additionalPlain||plainText(j.additional)].filter(Boolean).join('\n\n'),
      department:j.categories?.department,team:j.categories?.team,job_type:jobType(j.categories?.commitment,j.text),
      work_mode:workMode(j.workplaceType,j.categories?.location),posted_at:j.createdAt,employment_type_raw:j.categories?.commitment,
      workplace_type_raw:j.workplaceType,salary_min:j.salaryRange?.min,salary_max:j.salaryRange?.max,salary_currency:j.salaryRange?.currency,
      salary_period:salaryPeriod(j.salaryRange?.interval)}));
  },
  async workable(slug,get) {
    const data=await get(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`);
    return list(data?.jobs,'Workable').map(j=>{
      const location=[j.city,j.state,j.country].filter(Boolean).join(', ');
      return job({external_id:j.shortcode||j.code,title:j.title,url:j.application_url||j.url||j.shortlink,source_url:j.url||j.shortlink,location,
        description:plainText(j.description),department:j.department,job_type:jobType(j.employment_type,j.title),
        work_mode:workMode(j.telecommuting&&'remote',location),posted_at:j.published_on||j.created_at,employment_type_raw:j.employment_type});
    });
  },
  async smartrecruiters(slug,get) {
    const postings=[];let partial=false;
    for(let offset=0;;offset+=100){
      if(offset>=SMARTRECRUITERS_MAX){partial=true;break;}
      const page=await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}`);
      const content=list(page?.content,'SmartRecruiters');
      postings.push(...content);
      if(!content.length||postings.length>=(page.totalFound||0))break;
    }
    // Descriptions need one request per posting, so they are fetched only for likely technical roles.
    const out=[];
    for(const p of postings){
      const location=p.location?.fullLocation||[p.location?.city,p.location?.country].filter(Boolean).join(', ');
      let description=null;
      if(TECH_ROLE.test(`${p.name} ${p.department?.label||''}`.toLowerCase())){
        try{const d=await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${p.id}`);
          description=Object.values(d.jobAd?.sections||{}).map(s=>plainText(s?.text)).filter(Boolean).join('\n\n');}catch{}
      }
      out.push(job({external_id:p.id,title:p.name,url:`https://jobs.smartrecruiters.com/${slug}/${p.id}`,location,description,
        department:p.department?.label,job_type:jobType(p.typeOfEmployment?.label,p.name),
        work_mode:workMode(p.location?.remote&&'remote',p.location?.hybrid&&'hybrid',location),posted_at:p.releasedDate,
        employment_type_raw:p.typeOfEmployment?.label}));
    }
    // A truncated inventory must never be used to close roles.
    if(partial)out.partial=true;
    return out;
  },
  async recruitee(slug,get) {
    const data=await get(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`);
    return list(data?.offers,'Recruitee').map(j=>job({external_id:j.id,title:j.title,url:j.careers_apply_url||j.careers_url,source_url:j.careers_url,
      location:j.location,description:[plainText(j.description),plainText(j.requirements)].filter(Boolean).join('\n\n'),department:j.department,
      job_type:jobType(j.employment_type_code,j.title),work_mode:workMode(j.remote&&'remote',j.hybrid&&'hybrid',j.on_site&&'onsite',j.location),
      posted_at:j.published_at||j.created_at,employment_type_raw:j.employment_type_code,salary_min:j.salary?.min,salary_max:j.salary?.max,
      salary_currency:j.salary?.currency,salary_period:salaryPeriod(j.salary?.period)}));
  }
};
