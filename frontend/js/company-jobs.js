import {searchJobs} from './data-client.js';
import {relativePostingLabel} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';

// Company profiles: show the employer's current openings from the public job search.
// The section stays hidden when the search fails or the company has no open roles.
const section = globalThis.document?.querySelector('.company-open-roles');
if(section) load(section).catch(()=>{});

export function roleRow(job, now=Date.now()) {
  const known = value => value && !/^(n\/?a|none|null|unknown|tbd|-)$/i.test(String(value).trim()) ? value : '';
  const place = known(job.location) || [known(job.city),known(job.country)].filter(Boolean).join(', ') || 'Location not specified';
  return `<li><a href="/jobs?job=${encodeURIComponent(job.id)}"><strong>${e(job.title)}</strong><span>${e(place)}${['remote','hybrid','onsite'].includes(job.work_mode)?' · '+e(job.work_mode.replace(/^\w/,c=>c.toUpperCase())):''}</span><small>${e(relativePostingLabel(job,now))}</small></a></li>`;
}

async function load(section) {
  const name = section.dataset.company;
  const result = await searchJobs({company:name});
  const jobs = Array.isArray(result?.jobs) ? result.jobs.filter(job=>job.company===name || job.company?.toLowerCase()===name.toLowerCase()) : [];
  if(!jobs.length) return;
  const total = Number.isSafeInteger(result.total) && result.total >= jobs.length ? result.total : jobs.length;
  section.querySelector('ul').innerHTML = jobs.slice(0,6).map(job=>roleRow(job)).join('');
  section.querySelector('[data-count]').textContent = `${total.toLocaleString('en-IN')} open role${total===1?'':'s'}`;
  section.querySelector('[data-all]').hidden = total <= 6;
  section.hidden = false;
}
