import {escapeHtml as e} from './directory-core.js';
import {applyUrl, jobSalary, label, relativePostingLabel, postingLabel} from './jobs-core.js';
import {previewJobText} from './job-text.js';
import {icon} from './icons.js';

const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function profileFor(job, companies = []) {
  return companies.find(c => c.id === job.company_slug) || companies.find(c => normalized(c.name) === normalized(job.company));
}
export function jobLogo(job, companies = []) {
  const profile = profileFor(job, companies);
  const local = String(profile?.logo || '').replace(/^\//, '');
  return /^assets\/logos\/[a-zA-Z0-9._/-]+$/.test(local)
    ? `<span class="job-logo"><img src="/${e(local)}" alt="" width="36" height="36" loading="lazy" decoding="async"></span>`
    : `<span class="job-logo job-logo-generic" aria-hidden="true">${icon('building')}</span>`;
}
export function jobTags(job) {
  const known = value => value && !['unspecified', 'unknown', 'not specified', 'other'].includes(String(value).toLowerCase());
  const values = [job.location || [job.city,job.state_region,job.country].filter(Boolean).join(', '), known(job.work_mode) && label(job.work_mode), known(job.job_type) && label(job.job_type)];
  return [...new Set(values.filter(Boolean))].slice(0, 3).map(value => `<span>${e(value)}</span>`).join('');
}
export function renderJobCard(job, {companies = [], fx, saved = [], comparison = [], interactive = false, compare = false, now = Date.now()} = {}) {
  const id = String(job.id), salary = jobSalary(job, fx), url = applyUrl(job.apply_url);
  const selected = saved.includes(id), compared = comparison.some(j => String(j.id) === id);
  return `<article class="job-result-card" data-job-card="${e(id)}">
    <div class="job-company-line">${jobLogo(job, companies)}<span class="job-employer-name">${e(job.company)}</span>${job.is_company_verified === true ? `<span class="job-verified" title="Employer verified">${icon('check')}<span class="sr-only">Employer verified</span></span>` : ''}</div>
    <h3 class="job-card-title"><a href="/jobs?job=${encodeURIComponent(id)}" data-job="${e(id)}">${e(job.title)}</a></h3>
    <div class="job-card-tags">${jobTags(job)}</div><p class="job-card-description">${e(previewJobText(job.description, 220))}</p>
    <div class="job-card-bottom"><div class="job-card-pay${salary.primary === 'Salary not disclosed' ? ' is-undisclosed' : ''}"><strong>${e(salary.primary)}</strong>${salary.secondary ? `<span>${e(salary.secondary)}</span>` : ''}</div><span class="job-card-time" title="${e(postingLabel(job))}">${e(relativePostingLabel(job,now))}</span></div>
    <div class="job-card-footer">${compare ? `<button class="job-compare" type="button" data-compare="${e(id)}" aria-pressed="${compared}" aria-label="Compare ${e(job.title)}" ${interactive?'':'hidden'}>${compared?'Selected':'Compare'}</button>` : ''}<button class="job-save" type="button" data-save="${e(id)}" aria-pressed="${selected}" aria-label="${selected?'Unsave':'Save'} ${e(job.title)} at ${e(job.company)}" ${interactive?'':'hidden'}>${selected?'Saved':'Save'}</button>${url ? `<a class="job-apply-link" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="Apply for ${e(job.title)} at ${e(job.company)}">Apply ${icon('external')}</a>` : ''}</div>
  </article>`;
}
