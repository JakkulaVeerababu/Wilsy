import {escapeHtml as e} from '../js/directory-core.js';
import {SKILLS, skillSlug} from '../js/skills-core.js';
import {jobPath} from '../js/jobs-core.js';
import {tally, inIndia, bars, panel, foundAt} from './trends.mjs';
import {DEGREE_OPTIONS} from '../js/my-wilsy-core.js';

// Page bodies for the personal career pages: My WILSY (matches, skill gaps and a 30-day plan).
// The page is a shell; js/my-wilsy.js fills it in the browser from the profile kept on this device.

const crumbs = label => `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/tools">Tools</a><span>/</span><span aria-current="page">${e(label)}</span></nav>`;
const hero = (eyebrow, title, text) => `<div class="editorial-hero"><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p>${e(text)}</p></div>`;

export function myWilsyBody() {
  const options = DEGREE_OPTIONS.map(([id, name]) => `<option value="${e(id)}">${e(name)}</option>`).join('');
  return `<main id="main-content" class="editorial-shell mywilsy-shell">${crumbs('My WILSY')}
  ${hero('MY WILSY', 'Jobs that fit your skills', 'Add your skills, degree and experience. See your best matches among live jobs, the jobs you qualify for, the skills to learn next and the companies hiring for what you know.')}
  <section class="mywilsy" data-mywilsy aria-label="My WILSY">
    <form class="mywilsy-profile" data-profile novalidate>
      <h2>Your profile</h2>
      <div class="calc-field mywilsy-skills"><label for="skill-input">Your skills</label>
        <ul class="skill-tags" data-skill-tags aria-label="Your skills"></ul>
        <div class="skill-add"><input id="skill-input" list="skill-options" autocomplete="off" maxlength="40" placeholder="Type a skill and press Enter: Python, SQL, React…"><button class="secondary-button" type="button" data-skill-add>Add</button></div>
        <datalist id="skill-options">${SKILLS.map(([name]) => `<option value="${e(name)}">`).join('')}</datalist>
        <details class="mywilsy-resume"><summary>Fill in from my resume</summary>
          <label class="sr-only" for="profile-resume">Resume text</label>
          <textarea id="profile-resume" rows="6" maxlength="30000" spellcheck="false" placeholder="Paste your resume text. WILSY picks out the skills it knows; the text stays on this device."></textarea>
          <button class="secondary-button" type="button" data-skill-resume>Add skills from this text</button></details>
      </div>
      <p class="mywilsy-hint">Enter a degree you have finished or are studying for. Leave anything you’d rather not say as it is: blanks never rule a job out.</p>
      <div class="mywilsy-fields">
        <div class="calc-field"><label for="profile-degree">Highest degree</label><select id="profile-degree">${options}</select></div>
        <div class="calc-field"><label for="profile-grad">Graduation year</label><input id="profile-grad" type="number" inputmode="numeric" min="1980" max="2040" placeholder="e.g. 2026"></div>
        <div class="calc-field"><label for="profile-years">Years of work experience</label><input id="profile-years" type="number" inputmode="decimal" min="0" max="40" step="0.5" placeholder="0 if you are a fresher"></div>
        <div class="calc-field"><label for="profile-where">Where</label><select id="profile-where"><option value="any">Anywhere</option><option value="india">In India</option><option value="remote">Remote</option></select></div>
      </div>
      <div class="mywilsy-foot"><label class="calc-check"><input type="checkbox" id="only-eligible"> Only jobs I qualify for</label>
        <button class="text-button" type="button" data-profile-clear>Clear my profile</button></div>
      <p class="mywilsy-status" data-profile-status role="status"></p>
    </form>
    <div class="mywilsy-results" data-results aria-live="polite"><p class="match-empty">Add a few skills to see your matches.</p></div>
    <noscript><p class="tracker-status">My WILSY needs JavaScript.</p></noscript>
    <p class="quiet-callout"><strong>How matching works.</strong> WILSY reads each live job’s skills, years of experience and degree from the employer’s own listing. Your match is the share of the job’s skills that you have; a closely related skill (PostgreSQL for SQL, say) counts half. “Qualify” means you meet what the listing states; a requirement the listing does not state never counts against you. Your profile is kept in this browser. To find jobs, only your skill names are looked up; your degree, experience and resume never leave this device. <a href="/resume-match">Check your resume against one job</a></p>
  </section>
  <script type="module" src="/js/my-wilsy.js"></script></main>`;
}

/**
 * "How <company> is hiring" for a company profile, from companySignals (scripts/live-jobs.mjs).
 * skillHref(name) gives a skill page link, or '' when there is none.
 */
export function hiringSignalsHtml(name, s, {asOf = '', skillHref = () => ''} = {}) {
  if(!s?.total) return '';
  const n = value => Number(value).toLocaleString('en-IN');
  const pay = s.payScore >= 75 ? 'Most roles state pay' : s.payScore >= 25 ? 'Some roles state pay' : s.payScore > 0 ? 'Few roles state pay' : 'No open role states pay';
  const skills = s.skills.map(skill => { const href = skillHref(skill); return href ? `<a href="${e(href)}">${e(skill)}</a>` : e(skill); });
  return `<section class="company-signals" aria-labelledby="signals-title"><div class="company-open-roles-head"><div><p class="eyebrow">HIRING SIGNALS</p><h2 id="signals-title">How ${e(name)} is hiring</h2></div><span>${n(s.total)} live role${s.total === 1 ? '' : 's'}</span></div>
    <div class="signal-pay"><div><strong>${s.payScore}<small>/100</small></strong><span>Pay transparency: ${e(pay)}</span></div><div class="match-meter" role="img" aria-label="${s.withPay} of ${s.total} open roles state pay"><span style="width:${s.payScore}%"></span></div><p>${n(s.withPay)} of ${n(s.total)} open role${s.total === 1 ? '' : 's'} state${s.total === 1 ? 's' : ''} a salary or pay range.</p></div>
    <dl class="signal-grid"><div><dt>New in the last 30 days</dt><dd>${n(s.newLast30)}</dd></div><div><dt>Entry-level roles</dt><dd>${n(s.entry)}</dd></div><div><dt>Fully remote roles</dt><dd>${n(s.remote)}</dd></div></dl>
    ${s.families.length ? `<p class="signal-line"><strong>Teams hiring most:</strong> ${s.families.map(([family, count]) => `${e(family)} (${n(count)})`).join(', ')}</p>` : ''}
    ${skills.length ? `<p class="signal-line"><strong>Skills asked for most:</strong> ${skills.join(', ')}</p>` : ''}
    <p class="signal-note">Counted from the live roles WILSY found on ${e(name)}’s own job board${asOf ? ` as of ${e(asOf)}` : ''}. “New” means first found in the last 30 days. <a href="/my-wilsy">See which of these roles fit your skills</a></p></section>`;
}

/** /certifications: a tracker kept in the browser (js/certs.js) and widely asked-for certifications with live job counts. */
export function certsBody(catalog, {skillCounts = new Map()} = {}) {
  const cards = catalog.map(([id, name, issuer, url, skill]) => { const count = skillCounts.get(skill);
    return `<li class="cert-card"><strong>${e(name)}</strong><span>${e(issuer)}</span>${count ? `<a href="/skills/${e(skillSlug(skill))}">${num(count)} live jobs mention ${e(skill)}</a>` : `<span>Shows ${e(skill)}</span>`}
      <div class="cert-actions"><a href="${e(url)}" target="_blank" rel="noopener">Official page</a><button class="text-button" type="button" data-track-cert="${e(id)}">Track this</button></div></li>`; }).join('');
  return `<main id="main-content" class="editorial-shell certs-shell">${crumbs('Certification tracker')}
  ${hero('CERTIFICATION TRACKER', 'Track your certifications', 'Keep the certifications you plan, are studying for and have earned in one place, with target dates and expiry reminders. Your list stays in this browser.')}
  <section class="certs" data-certs aria-label="Certification tracker">
    <form class="mywilsy-profile certs-form" data-cert-form novalidate><h2>Add a certification</h2><input type="hidden" name="catalog">
      <div class="mywilsy-fields">
        <div class="calc-field"><label for="cert-name">Name</label><input id="cert-name" name="name" list="cert-options" maxlength="120" autocomplete="off" placeholder="e.g. AWS Certified Cloud Practitioner"></div>
        <datalist id="cert-options">${catalog.map(c => `<option value="${e(c[1])}">`).join('')}</datalist>
        <div class="calc-field"><label for="cert-issuer">Issued by</label><input id="cert-issuer" name="issuer" maxlength="80"></div>
        <div class="calc-field"><label for="cert-status">Status</label><select id="cert-status" name="status">${[['planned', 'Planned'], ['studying', 'Studying'], ['earned', 'Earned']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="calc-field" data-when="planned"><label for="cert-target">Target date</label><input id="cert-target" name="target" type="date"></div>
        <div class="calc-field" data-when="earned" hidden><label for="cert-earned">Date earned</label><input id="cert-earned" name="earned" type="date"></div>
        <div class="calc-field" data-when="earned" hidden><label for="cert-expires">Valid until</label><input id="cert-expires" name="expires" type="date"></div>
        <div class="calc-field" data-when="earned" hidden><label for="cert-credential">Credential link</label><input id="cert-credential" name="credential" type="url" placeholder="https://"></div>
      </div>
      <div class="mywilsy-foot"><button class="primary-button" type="submit" data-cert-submit>Add certification</button><button class="text-button" type="button" data-cert-cancel hidden>Cancel</button></div>
      <p class="mywilsy-status" data-cert-status role="status"></p></form>
    <div class="certs-results" data-cert-list aria-live="polite"></div>
    <noscript><p class="tracker-status">The tracker needs JavaScript.</p></noscript>
    <section class="certs-catalog" aria-labelledby="certs-catalog-title"><h2 id="certs-catalog-title">Certifications employers ask about</h2>
      <p class="salary-note">Each links to its official page, which has the current exam details and fees. Job counts are live roles that mention the skill.</p><ul class="cert-cards">${cards}</ul></section>
  </section>
  <script type="module" src="/js/certs.js"></script></main>`;
}

// Startup jobs and global/remote pages, counted at deploy time from the live job pass (scripts/live-jobs.mjs),
// like the skill pages. Without the live pass each page explains itself and is not indexed.

const num = value => Number(value || 0).toLocaleString('en-IN');
const share = (part, whole) => whole ? Math.round(part / whole * 100) + '%' : '0%';
const plainName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const asOfText = asOf => asOf ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'}).format(new Date(asOf)) : '';
const FOUND = new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'});
const WORK = {remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'};
const usable = value => value && !/^(?:unknown|not specified|n\/a|none|-)$/i.test(String(value).trim()) ? String(value).trim() : '';

/** The directory profile for a live job, by slug then by name. */
export function profileFinder(companies) {
  const map = new Map(companies.flatMap(c => [[c.id, c], [plainName(c.name), c]]));
  return job => map.get(job.company_slug) || map.get(plainName(job.company)) || null;
}

/** Jobs at employers the directory lists as startups. */
export const startupJobs = (jobs, companies) => { const find = profileFinder(companies); return jobs.filter(job => find(job)?.stage === 'Startup'); };
/** Fully remote jobs anywhere, and on-site or hybrid jobs outside India. */
export const globalJobs = jobs => jobs.filter(job => job.work_mode === 'remote' || (!inIndia(job) && usable(job.country)));

/** Counts for one list of live jobs: totals, top employers, kinds of role, countries, skills and the newest roles. */
export function listStats(jobs, {companies = [], newest = 24} = {}) {
  const find = profileFinder(companies), slugOf = new Map();
  for(const job of jobs) { const name = String(job.company || '').trim(); if(name && !slugOf.has(name)) slugOf.set(name, find(job)?.id || ''); }
  const recent = [...jobs].sort((a, b) => (foundAt(b) || 0) - (foundAt(a) || 0) || Number(b.id) - Number(a.id));
  const counts = tally(jobs.map(job => String(job.company || '').trim()));
  const abroad = jobs.filter(j => !inIndia(j));
  return {total: jobs.length, companies: counts.length, remote: jobs.filter(j => j.work_mode === 'remote').length,
    entry: jobs.filter(j => j.entry).length, india: jobs.length - abroad.length, pay: jobs.filter(j => j.pay).length,
    topCompanies: counts.slice(0, 12).map(([name, count]) => [name, count, slugOf.get(name) || '']),
    families: tally(jobs.map(j => j.family || 'Other')).sort((a, b) => (a[0] === 'Other') - (b[0] === 'Other') || b[1] - a[1]).slice(0, 8),
    countryCount: tally(abroad.map(j => usable(j.country))).length,
    countries: tally(abroad.map(j => usable(j.country))).slice(0, 10),
    skills: tally(jobs.flatMap(j => j.skills || [])).slice(0, 10),
    jobs: [...recent.filter(j => j.indexable), ...recent.filter(j => !j.indexable)].slice(0, newest)};
}

const jobList = jobs => jobs.map(j => {
  const place = [usable(j.location) || [usable(j.city), usable(j.country)].filter(Boolean).join(', '), WORK[j.work_mode]].filter(Boolean).join(' · ');
  const found = foundAt(j);
  return `<li><a href="${e(jobPath(j))}"><strong>${e(j.title)}</strong><span>${e(j.company)}${place ? ' · ' + e(place.length > 80 ? place.slice(0, 79) + '…' : place) : ''}</span></a>${Number.isFinite(found) ? `<time datetime="${new Date(found).toISOString()}">Found ${e(FOUND.format(new Date(found)))}</time>` : ''}</li>`;
}).join('');
const companyLink = (name, id) => id ? '/companies/' + encodeURIComponent(id) : '/jobs?company=' + encodeURIComponent(name);
const skillLink = names => name => names.has(name) ? '/skills/' + skillSlug(name) : '/jobs?q=' + encodeURIComponent(name);
const listNote = '<p class="quiet-callout">Counted from live listings WILSY collects from employers’ own career sites, so these figures show what is open in our collection today, not the whole job market. <a href="/methodology">How WILSY collects jobs</a></p>';
const emptyPage = (crumb, eyebrow, title) => `<main id="main-content" class="editorial-shell trends-shell">${crumbs(crumb)}${hero(eyebrow, title, 'This page is counted from every live job each time the site updates. This copy was built without the live job data, so there is nothing to show yet.')}<a class="primary-button" href="/jobs">Search live jobs</a></main>`;
const stats = rows => `<dl class="salary-stats trend-stats">${rows.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`;

export function startupJobsBody(s, {asOf = null, startups = 0, skillPages = new Set()} = {}) {
  if(!s?.total) return emptyPage('Startup jobs', 'STARTUP JOBS', 'Jobs at startups.');
  return `<main id="main-content" class="editorial-shell trends-shell skill-shell">${crumbs('Startup jobs')}
  <div class="editorial-hero"><p class="eyebrow">STARTUP JOBS · LIVE DATA</p><h1>Jobs at startups.</h1><p>${num(s.total)} live roles at ${num(s.companies)} of the ${num(startups)} startups in the WILSY directory${asOf ? `. Updated ${e(asOfText(asOf))}` : ''}. Every role links to the startup’s own job board.</p></div>
  ${stats([['Live roles', num(s.total)], ['Startups hiring', num(s.companies)], ['Remote roles', share(s.remote, s.total)], ['Pay published', share(s.pay, s.total)], ['Jobs in India', num(s.india)], ['Internships and fresher roles', num(s.entry)]])}
  <div class="skill-actions"><a class="primary-button" href="/my-wilsy">See which roles fit your skills</a><a class="secondary-button" href="/companies">Browse companies</a></div>
  <section class="skill-newest" aria-labelledby="startup-newest-title"><h2 id="startup-newest-title">Newest startup roles</h2><ol class="skill-jobs">${jobList(s.jobs)}</ol></section>
  <div class="trend-grid">
    ${panel('startup-company-title', 'Startups hiring most', 'Open roles per startup.', bars(s.topCompanies, {total: s.total, link: companyLink, unit: 'open roles'}))}
    ${panel('startup-family-title', 'Kinds of roles', 'Grouped from job titles.', bars(s.families, {total: s.total, link: () => ''}))}
    ${panel('startup-skill-title', 'Skills startups ask for', 'Share of startup roles that mention each skill.', bars(s.skills, {total: s.total, link: skillLink(skillPages)}))}
    ${s.countries.length ? panel('startup-country-title', 'Where outside India', 'Roles outside India, by country.', bars(s.countries, {total: s.total, link: () => ''})) : ''}
  </div>
  <p class="quiet-callout"><strong>What counts as a startup.</strong> An employer the WILSY directory lists at the startup stage, from its size and funding. Larger, fast-growing companies are not counted here. <a href="/startup-grants">Grants and programs for founders</a></p>
  ${listNote}
</main>`;
}

export function globalJobsBody(s, {asOf = null, skillPages = new Set()} = {}) {
  if(!s?.total) return emptyPage('Global and remote jobs', 'GLOBAL & REMOTE', 'Remote and global jobs.');
  const abroad = s.total - s.india;
  return `<main id="main-content" class="editorial-shell trends-shell skill-shell">${crumbs('Global and remote jobs')}
  <div class="editorial-hero"><p class="eyebrow">GLOBAL & REMOTE · LIVE DATA</p><h1>Remote and global jobs.</h1><p>${num(s.remote)} fully remote roles and ${num(abroad)} roles outside India, at ${num(s.companies)} employers${asOf ? `. Updated ${e(asOfText(asOf))}` : ''}. Remote roles often hire only in certain countries, so read each listing’s eligibility before you apply.</p></div>
  ${stats([['Live roles', num(s.total)], ['Fully remote', num(s.remote)], ['Outside India', num(abroad)], ['Countries', num(s.countryCount)], ['Employers hiring', num(s.companies)], ['Pay published', share(s.pay, s.total)]])}
  <div class="skill-actions"><a class="primary-button" href="/jobs/remote-jobs">All remote jobs</a><a class="secondary-button" href="/my-wilsy">See which roles fit your skills</a></div>
  <section class="skill-newest" aria-labelledby="global-newest-title"><h2 id="global-newest-title">Newest remote and global roles</h2><ol class="skill-jobs">${jobList(s.jobs)}</ol></section>
  <div class="trend-grid">
    ${panel('global-country-title', 'Countries hiring most', 'Roles outside India, by country.', bars(s.countries, {total: s.total, link: () => ''}))}
    ${panel('global-company-title', 'Employers hiring most', 'Open remote and global roles per employer.', bars(s.topCompanies, {total: s.total, link: companyLink, unit: 'open roles'}))}
    ${panel('global-family-title', 'Kinds of roles', 'Grouped from job titles.', bars(s.families, {total: s.total, link: () => ''}))}
    ${panel('global-skill-title', 'Skills asked for most', 'Share of these roles that mention each skill.', bars(s.skills, {total: s.total, link: skillLink(skillPages)}))}
  </div>
  <p class="quiet-callout"><strong>Before you apply abroad.</strong> A role outside India usually needs the right to work in that country; some employers sponsor visas and many do not. A “remote” role may still be limited to certain countries or time zones. The listing on the employer’s site has the final word.</p>
  ${listNote}
</main>`;
}
