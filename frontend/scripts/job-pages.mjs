import {searchJobs} from '../js/data-client.js';
import {decodeEntities} from '../js/job-text.js';
import {applyUrl, jobSalary, label, relativePostingLabel, postingLabel, dateLabel} from '../js/jobs-core.js';
import {jobLogo, jobTags, profileFor} from '../js/job-card.js';
import {escapeHtml as e} from '../js/directory-core.js';
import {site} from '../js/site-config.js';
import {landingPages, landingUrl, workspaceUrl} from './landing-pages.mjs';

// Static job pages (/jobs/<id>-<slug>) with JobPosting data, and the landing pages that list them.
// Live builds read the public search API; offline builds only use the committed snapshot.

const slugify = value => String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70).replace(/-+$/,'');
export const jobPath = job => `/jobs/${job.id}-${slugify(`${job.title} ${job.company}`) || 'role'}`;
const known = value => value && !/^(n\/?a|none|null|unknown|unspecified|tbd|-)$/i.test(String(value).trim()) ? String(value).trim() : '';
const time = value => { const t = Date.parse(value||''); return Number.isFinite(t) ? t : NaN; };

// A job gets a page only when it is public, links to an https application and has not expired.
export function publishable(job, now=Date.now()) {
  if(!/^\d+$/.test(String(job?.id)) || !known(job.title) || !known(job.company) || !applyUrl(job.apply_url)) return false;
  const end = Math.min(...[job.deadline_at,job.expires_at].map(time).filter(Number.isFinite));
  return !(end < now);
}

// A standalone page also needs a real description: short previews make thin pages that search engines
// (and Google's job guidelines) treat as low quality, so those roles open in the /jobs workspace instead.
export const MIN_PAGE_DESCRIPTION = 600;
export function pageWorthy(job, now=Date.now()) {
  return publishable(job, now) && descriptionParagraphs(job.description).replace(/<[^>]+>/g,'').length >= MIN_PAGE_DESCRIPTION;
}

/** Source HTML or text -> escaped paragraphs; capped so pages stay light. */
export function descriptionParagraphs(value, limit=6000) {
  let text = String(value ?? '');
  for(let pass=0; pass<4; pass++) text = decodeEntities(text);
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<\s*li[^>]*>/gi,'\n• ')
    .replace(/<\s*(?:br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|h[1-6][^>]*)\s*\/?>/gi,'\n')
    .replace(/<[^>]*>/g,' ').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g,' ');
  const out = []; let size = 0;
  for(const line of text.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean)) {
    if(size + line.length > limit) { out.push(line.slice(0, Math.max(0,limit-size)).replace(/\s+\S*$/,'')+' …'); break; }
    out.push(line); size += line.length;
  }
  return out.map(line=>`<p>${e(line)}</p>`).join('');
}

const employment = {full_time:'FULL_TIME',part_time:'PART_TIME',contract:'CONTRACTOR',internship:'INTERN',temporary:'TEMPORARY'};
const units = {year:'YEAR',month:'MONTH',week:'WEEK',day:'DAY',hour:'HOUR'};

// schema.org JobPosting for Google's job search. Returns null when a required field is unknown.
export function jobPosting(job, companies=[]) {
  const posted = [job.posted_at,job.first_seen_at,job.discovered_at].find(v=>Number.isFinite(time(v)));
  const description = descriptionParagraphs(job.description);
  if(!posted || !description) return null;
  const places = (job.locations?.length ? job.locations : [{location:job.location,city:job.city,state:job.state_region,country:job.country,country_code:job.country_code}])
    .map(l=>({locality:known(l.city)||known(l.location),region:known(l.state),country:known(l.country_code)||known(l.country)}))
    .filter(p=>p.locality||p.country).slice(0,5);
  const remote = job.work_mode === 'remote';
  const remoteCountry = known(job.country) || places.find(p=>p.country)?.country;
  const data = {'@context':'https://schema.org','@type':'JobPosting',title:job.title,description,
    datePosted:new Date(time(posted)).toISOString(),
    hiringOrganization:{'@type':'Organization',name:job.company,...(profileFor(job,companies)?.website?{sameAs:profileFor(job,companies).website}:{})},
    identifier:{'@type':'PropertyValue',name:job.company,value:String(job.requisition_id||job.external_job_id||job.id)},
    directApply:false,url:site.origin+jobPath(job)};
  const end = [job.deadline_at,job.expires_at].find(v=>Number.isFinite(time(v)));
  if(end) data.validThrough = new Date(time(end)).toISOString();
  if(employment[job.job_type]) data.employmentType = employment[job.job_type];
  if(remote && remoteCountry) { data.jobLocationType='TELECOMMUTE'; data.applicantLocationRequirements={'@type':'Country',name:remoteCountry}; }
  if(places.length) data.jobLocation = places.map(p=>({'@type':'Place',address:{'@type':'PostalAddress',
    ...(p.locality?{addressLocality:p.locality}:{}),...(p.region?{addressRegion:p.region}:{}),...(p.country?{addressCountry:p.country}:{})}}));
  if(!data.jobLocation && !data.jobLocationType) return null;
  const unit = units[String(job.salary_period||'').toLowerCase()];
  if(unit && job.salary_currency && (job.salary_min!=null || job.salary_max!=null)) data.baseSalary = {'@type':'MonetaryAmount',currency:job.salary_currency,
    value:{'@type':'QuantitativeValue',...(job.salary_min!=null?{minValue:Number(job.salary_min)}:{}),...(job.salary_max!=null?{maxValue:Number(job.salary_max)}:{}),unitText:unit}};
  return data;
}

// One row in a landing-page or similar-jobs list.
export function jobRow(job, {companies, fx, now, pages}) {
  const pay = jobSalary(job, fx);
  const href = pages.has(String(job.id)) ? jobPath(job) : `/jobs?job=${encodeURIComponent(job.id)}`;
  return `<li class="job-list-row"><a href="${e(href)}">${jobLogo(job,companies)}<span class="job-list-main"><strong>${e(job.title)}</strong><span>${e(job.company)}</span><span class="job-card-tags">${jobTags(job)}</span></span><span class="job-list-meta"><strong>${e(pay.primary)}</strong><span>${e(relativePostingLabel(job,now))}</span></span></a></li>`;
}

export function landingBody(page, {jobs, total, companies, fx, now, pages, updatedAt}) {
  const related = landingPages.filter(p=>p.slug!==page.slug).slice(0,12);
  const list = jobs.length
    ? `<ol class="job-list" aria-label="${e(page.title)}">${jobs.map(job=>jobRow(job,{companies,fx,now,pages})).join('')}</ol>`
    : `<p class="job-list-empty">Open the live search to see current ${e(page.title.toLowerCase())}.</p>`;
  return `<main id="main-content" class="editorial-shell job-landing">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/jobs">Jobs</a><span>/</span><span aria-current="page">${e(page.title)}</span></nav>
  <div class="editorial-hero"><p class="eyebrow">WILSY JOBS</p><h1>${e(page.title)}</h1><p>${e(page.description)}</p></div>
  <div class="job-landing-bar"><p>${total!=null?`<strong>${Number(total).toLocaleString('en-IN')}</strong> open roles · `:''}updated <time datetime="${e(updatedAt)}">${e(dateLabel(updatedAt,{time:false}))}</time></p><a class="primary-button" href="${e(workspaceUrl(page))}">Filter these jobs</a></div>
  ${list}
  ${total>jobs.length?`<a class="job-landing-more" href="${e(workspaceUrl(page))}">See all ${Number(total).toLocaleString('en-IN')} ${e(page.title.toLowerCase())}</a>`:''}
  <section class="job-landing-related" aria-labelledby="related-searches"><h2 id="related-searches">Related searches</h2><nav class="home-chip-list" aria-label="Related job searches">${related.map(p=>`<a href="${landingUrl(p)}">${e(p.short)}</a>`).join('')}</nav></section>
  <p class="jobs-date-note">Every listing links to the employer’s own page. Availability can change; confirm details before you apply. <a href="/about#how-listings-are-collected">How listings are collected</a></p>
</main>`;
}

export function jobBody(job, {companies, fx, now, pages, similar, landing}) {
  const pay = jobSalary(job, fx), url = applyUrl(job.apply_url), profile = profileFor(job, companies);
  const fact = (term, value) => value ? `<div><dt>${term}</dt><dd>${e(value)}</dd></div>` : '';
  const exp = job.experience_text || (job.experience_min!=null ? `${job.experience_min}${job.experience_max!=null?'–'+job.experience_max:'+'} years` : '');
  const mode = ['remote','hybrid','onsite'].includes(job.work_mode) ? label(job.work_mode) : '';
  const place = known(job.location) || [known(job.city),known(job.country)].filter(Boolean).join(', ');
  const crumb = landing ? `<a href="${landingUrl(landing)}">${e(landing.title)}</a><span>/</span>` : '';
  return `<main id="main-content" class="editorial-shell job-page">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/jobs">Jobs</a><span>/</span>${crumb}<span aria-current="page">${e(job.title)}</span></nav>
  <header class="job-page-head">${jobLogo(job,companies)}<div><p class="job-page-company">${profile?`<a href="/companies/${encodeURIComponent(profile.id)}">${e(job.company)}</a>`:e(job.company)}</p><h1>${e(job.title)}</h1><div class="job-card-tags">${jobTags(job)}</div></div></header>
  <div class="job-page-actions"><a class="primary-button" href="${e(url)}" target="_blank" rel="noopener noreferrer">Apply on employer site</a><a class="secondary-button" href="/jobs?job=${encodeURIComponent(job.id)}">Save or compare</a></div>
  <div class="job-page-layout"><article class="prose job-page-description"><h2>About the role</h2>${descriptionParagraphs(job.description)}<p class="jobs-date-note">This is the description captured from the source. The employer’s listing is the final word on requirements.</p></article>
  <aside class="job-page-facts"><dl>${fact('Pay',pay.primary+(pay.secondary?` (${pay.secondary})`:''))}${fact('Location',place)}${fact('Workplace',mode)}${fact('Experience',exp)}${fact('Job type',employment[job.job_type]?label(job.job_type):'')}${fact('Seniority',job.seniority_level?label(job.seniority_level):'')}${fact('Posted',postingLabel(job))}${fact('Source',job.source_name||(job.ats_platform?label(job.ats_platform):''))}</dl>
  <a href="mailto:${site.email}?subject=${encodeURIComponent('Report listing: '+job.id+' '+job.title)}">Report this listing</a></aside></div>
  ${similar.length?`<section class="job-page-similar" aria-labelledby="similar-title"><h2 id="similar-title">Similar jobs</h2><ol class="job-list">${similar.map(j=>jobRow(j,{companies,fx,now,pages})).join('')}</ol></section>`:''}
</main>`;
}

// Live data for landing pages; null for a page whose search failed.
// Searches run two at a time and retry twice (1 s, then 3 s), because the database is briefly busy
// while the hourly collectors write. A page that still fails builds as noindex for this deploy.
export async function fetchLandingJobs(pages=landingPages, {search=searchJobs, wait=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const results = new Map();
  const attempt = async filters => {
    for(const delay of [0,1000,3000]) {
      if(delay) await wait(delay);
      try { const r = await search(filters); if(Array.isArray(r?.jobs)) return {total:Number(r.total)||r.jobs.length, jobs:r.jobs}; } catch {}
    }
    return null;
  };
  for(let i=0; i<pages.length; i+=2) {
    const batch = pages.slice(i,i+2);
    const found = await Promise.all(batch.map(page=>attempt(page.filters)));
    batch.forEach((page,k)=>results.set(page.slug, found[k]));
  }
  return results;
}
