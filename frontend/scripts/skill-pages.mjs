import {escapeHtml as e} from '../js/directory-core.js';
import {skillSlug, indiaCity} from '../js/skills-core.js';
import {jobPath} from '../js/jobs-core.js';
import {shareBar} from './feature-pages.mjs';
import {tally, inIndia, bars, panel, foundAt} from './trends.mjs';

// Skill pages (/skills and /skills/<slug>), counted at deploy time from the live job pass, like the
// hiring-trends page: for each skill with enough live jobs, who is hiring, what comes with it, and the
// newest roles. Built only with live data; without it /skills explains that and is not indexed.

export const SKILL_MIN = 5;
const n = value => Number(value || 0).toLocaleString('en-IN');
const pct = (part, whole) => whole ? Math.round(part / whole * 100) + '%' : '0%';
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const known = value => value && !/^(?:unknown|not specified|n\/a|none|-)$/i.test(String(value).trim()) ? String(value).trim() : '';
const MODES = {remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'};
const day = time => new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'}).format(new Date(time));
const updated = asOf => asOf ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'}).format(new Date(asOf)) : '';

/** One entry per skill with at least `min` live jobs, most jobs first. */
export function skillStats(jobs, {companies = [], min = SKILL_MIN, newest = 20} = {}) {
  const profiles = new Map(companies.flatMap(c => [[c.id, c], [normalized(c.name), c]]));
  const bySkill = new Map();
  for(const job of jobs) for(const skill of new Set(job.skills || [])) { if(!bySkill.has(skill)) bySkill.set(skill, []); bySkill.get(skill).push(job); }
  return [...bySkill].filter(([, list]) => list.length >= min).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([name, list]) => {
    const india = list.filter(inIndia), counts = tally(list.map(j => String(j.company || '').trim()));
    const slugOf = new Map();
    for(const j of list) { const c = String(j.company || '').trim(); if(c && j.company_slug && !slugOf.has(c)) slugOf.set(c, j.company_slug); }
    const recent = [...list].sort((a, b) => (foundAt(b) || 0) - (foundAt(a) || 0) || Number(b.id) - Number(a.id));
    return {name, slug: skillSlug(name), total: list.length, companies: counts.length,
      remote: list.filter(j => j.work_mode === 'remote').length, entry: list.filter(j => j.entry).length, india: india.length, pay: list.filter(j => j.pay).length,
      topCompanies: counts.slice(0, 10).map(([c, count]) => [c, count, (profiles.get(slugOf.get(c)) || profiles.get(normalized(c)))?.id || '']),
      together: tally(list.flatMap(j => (j.skills || []).filter(s => s !== name))).slice(0, 10),
      families: tally(list.map(j => j.family || 'Other')).sort((a, b) => (a[0] === 'Other') - (b[0] === 'Other') || b[1] - a[1]).slice(0, 8),
      cities: tally(india.map(j => indiaCity(`${j.location || ''} ${j.city || ''}`))).slice(0, 8),
      // Newest first, preferring jobs whose own page is indexable.
      jobs: [...recent.filter(j => j.indexable), ...recent.filter(j => !j.indexable)].slice(0, newest)};
  });
}

const crumbs = label => `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/tools">Tools</a><span>/</span>${label ? `<a href="/skills">Skills</a><span>/</span><span aria-current="page">${e(label)}</span>` : '<span aria-current="page">Skills in demand</span>'}</nav>`;
const note = '<p class="quiet-callout">Counted from live listings WILSY collects from employer career sites, so these figures show what is open in our collection today, not the whole job market. A job counts for a skill when its title, skills or description mention it. <a href="/methodology">How WILSY collects jobs</a></p>';

export function skillsIndexBody(skills, {total = 0, asOf = null} = {}) {
  if(!skills.length) return `<main id="main-content" class="editorial-shell trends-shell">${crumbs()}<div class="editorial-hero"><p class="eyebrow">SKILLS IN DEMAND</p><h1>Jobs by skill.</h1><p>These pages are counted from every live job each time the site updates. This copy was built without the live job data, so there is nothing to show yet.</p></div><a class="primary-button" href="/jobs">Search live jobs</a></main>`;
  return `<main id="main-content" class="editorial-shell trends-shell skills-shell">${crumbs()}
  <div class="editorial-hero"><p class="eyebrow">SKILLS IN DEMAND · LIVE DATA</p><h1>Jobs by skill.</h1><p>How many of the ${n(total)} live jobs WILSY tracks mention each skill${asOf ? `, updated ${e(updated(asOf))}` : ''}. Open a skill to see who is hiring and the newest roles.</p></div>
  <div class="trend-grid">${panel('skills-all-title', `${skills.length} skills with ${SKILL_MIN} or more live jobs`, 'Share of all live jobs that mention the skill.', bars(skills.map(s => [s.name, s.total, s.slug]), {total, link: (name, slug) => '/skills/' + slug}), true)}</div>
  <div class="trend-foot"><a class="secondary-button" href="/hiring-trends">Hiring trends</a><a class="secondary-button" href="/resume-match">Check your resume against a job</a></div>
  ${note}
</main>`;
}

export function skillBody(s, {origin, asOf = null, names = new Set()} = {}) {
  const q = value => '/jobs?q=' + encodeURIComponent(value);
  const list = s.jobs.map(j => {
    const place = [known(j.location) || [known(j.city), known(j.country)].filter(Boolean).join(', '), MODES[j.work_mode]].filter(Boolean).join(' · ');
    const found = foundAt(j);
    return `<li><a href="${e(jobPath(j))}"><strong>${e(j.title)}</strong><span>${e(j.company)}${place ? ' · ' + e(place.length > 80 ? place.slice(0, 79) + '…' : place) : ''}</span></a>${Number.isFinite(found) ? `<time datetime="${new Date(found).toISOString()}">Found ${e(day(found))}</time>` : ''}</li>`;
  }).join('');
  return `<main id="main-content" class="editorial-shell trends-shell skill-shell">${crumbs(s.name)}
  <div class="editorial-hero"><p class="eyebrow">SKILLS IN DEMAND · LIVE DATA</p><h1>${e(s.name)} jobs.</h1><p>${n(s.total)} live jobs mention ${e(s.name)}, at ${n(s.companies)} employer${s.companies === 1 ? '' : 's'}${asOf ? `. Updated ${e(updated(asOf))}` : ''}.</p></div>
  <dl class="salary-stats trend-stats">
    <div><dt>Live jobs</dt><dd>${n(s.total)}</dd></div>
    <div><dt>Employers hiring</dt><dd>${n(s.companies)}</dd></div>
    <div><dt>Remote roles</dt><dd>${pct(s.remote, s.total)}</dd></div>
    <div><dt>Pay published</dt><dd>${pct(s.pay, s.total)}</dd></div>
    <div><dt>Jobs in India</dt><dd>${n(s.india)}</dd></div>
    <div><dt>Internships and fresher roles</dt><dd>${n(s.entry)}</dd></div>
  </dl>
  <div class="skill-actions"><a class="primary-button" href="${e(q(s.name))}">Search ${e(s.name)} jobs</a><a class="secondary-button" href="/resume-match">Check your resume against a job</a></div>
  <section class="skill-newest" aria-labelledby="skill-newest-title"><h2 id="skill-newest-title">Newest ${e(s.name)} jobs</h2><ol class="skill-jobs">${list}</ol>
    ${s.total > s.jobs.length ? `<a class="skill-more" href="${e(q(s.name))}">See all ${n(s.total)} ${e(s.name)} jobs</a>` : ''}</section>
  <div class="trend-grid">
    ${panel('skill-company-title', `Companies hiring for ${s.name}`, 'Open roles that mention the skill, per employer.', bars(s.topCompanies, {total: s.total, link: (name, id) => id ? '/companies/' + encodeURIComponent(id) : '/jobs?company=' + encodeURIComponent(name), unit: 'open roles'}))}
    ${panel('skill-together-title', 'Skills that come with it', `How often jobs that mention ${s.name} also mention each skill.`, s.together.length ? bars(s.together, {total: s.total, link: name => names.has(name) ? '/skills/' + skillSlug(name) : q(name)}) : '<p class="salary-note">No other skills named.</p>')}
    ${panel('skill-family-title', 'Kinds of roles', 'Grouped from job titles.', bars(s.families, {total: s.total, link: () => ''}))}
    ${panel('skill-city-title', 'Where in India', `Out of ${n(s.india)} jobs in India.`, s.cities.length ? bars(s.cities, {total: s.india, link: name => q(`${s.name} ${name.replace(' NCR', '')}`)}) : '<p class="salary-note">No Indian city named yet.</p>')}
  </div>
  <div class="trend-foot">${shareBar(origin + '/skills/' + s.slug, `${s.name} jobs hiring now, on WILSY:`, {label: 'Share this page'})}<a class="secondary-button" href="/skills">All skills</a></div>
  ${note}
</main>`;
}

export const skillStructured = (s, origin) => ({'@context': 'https://schema.org', '@type': 'ItemList', name: `${s.name} jobs`,
  itemListElement: s.jobs.map((job, i) => ({'@type': 'ListItem', position: i + 1, url: origin + jobPath(job)}))});
