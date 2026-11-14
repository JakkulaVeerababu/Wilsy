import {escapeHtml as e} from '../js/directory-core.js';
import {renderJobCard, jobLogo, profileFor} from '../js/job-card.js';
import {icon} from '../js/icons.js';
import {browseRoles, browseStages} from './landing-pages.mjs';

const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const count = value => Number(value || 0).toLocaleString('en-IN');
const companyLink = (item,companies) => profileFor({company_slug:item.slug,company:item.name},companies)
  ? `/companies/${encodeURIComponent(profileFor({company_slug:item.slug,company:item.name},companies).id)}`
  : `/jobs?company=${encodeURIComponent(item.name)}`;
const logoIds = ['google','microsoft','openai','nvidia','apple','amazon','meta','stripe','airbnb','netflix','uber','atlassian','anthropic','databricks','figma','notion'];

function featuredCard(item,companies) {
  return `<a class="home-featured-company" href="${companyLink(item,companies)}">
    ${jobLogo({company:item.name,company_slug:item.slug},companies)}<h3>${e(item.name)}</h3>
    <p><strong>${count(item.roles)}</strong> open roles</p>
    ${item.verified === true ? `<span class="home-verified-label">${icon('check')} Employer verified</span>` : '<span class="home-verified-label">Source-linked roles</span>'}
    <span class="home-featured-arrow" aria-hidden="true">${icon('arrow')}</span>
  </a>`;
}

// A static row of employer logos (no motion). Featured hiring companies come first.
function logoRow(featured,companies) {
  const seen = new Set(), items = [];
  for(const c of [...featured.map(item=>profileFor({company:item.name,company_slug:item.slug},companies)),...logoIds.map(id=>companies.find(c=>c.id===id))]) {
    if(!c || seen.has(c.id)) continue;
    seen.add(c.id); items.push(c);
  }
  return `<div class="home-logo-row">${items.slice(0,12).map(c=>`<a href="/companies/${encodeURIComponent(c.id)}"><img src="/${e(c.logo)}" alt="" width="30" height="30" loading="lazy"><span>${e(c.name)}</span></a>`).join('')}</div>`;
}

function browse(dsaStats) {
  const chip = ([url,label,n]) => `<a href="${url}">${e(label)}${n?`<span>${count(n)}</span>`:''}</a>`;
  const routes = [
    ['/government-jobs','government','Government jobs','Official notices, eligibility and last dates.'],
    ['/hackathons','bolt','Hackathons','Open challenges with dates and prizes.'],
    ['/companies#companies','building','1,000 company profiles','Salary examples and career links.'],
    ['/dsa','code','DSA roadmap',`${dsaStats?.patterns || 127} patterns to prepare for interviews.`],
  ];
  return `<section class="home-browse home-section" id="browse" aria-labelledby="browse-title">
    <div class="home-section-heading"><div><p class="home-kicker">BROWSE</p><h2 id="browse-title">Start where you are.</h2></div><a class="home-section-link" href="/jobs">All jobs ${icon('arrow')}</a></div>
    <div class="home-browse-grid">
      <div class="home-browse-group"><h3>By role</h3><nav class="home-chip-list" aria-label="Jobs by role">${browseRoles.map(chip).join('')}</nav></div>
      <div class="home-browse-group"><h3>By career stage</h3><nav class="home-chip-list" aria-label="Jobs by career stage">${browseStages.map(chip).join('')}</nav></div>
    </div>
    <div class="home-route-grid">${routes.map(([url,ic,title,text])=>`<a href="${url}"><span class="home-route-icon">${icon(ic)}</span><strong>${title}</strong><span>${text}</span></a>`).join('')}</div>
  </section>`;
}

export function homePage({snapshot, companies, guides, fx, dsaStats}) {
  const jobs = snapshot.jobs.slice(0,6), featured = snapshot.featured.slice(0,6);
  const now = Date.now();
  const date = new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(snapshot.updatedAt));
  const guideCard = guide => `<a class="home-guide-card" href="/guides/${e(guide.slug)}"><span class="home-guide-meta">${e(guide.category)} · ${e(guide.minutes)} MIN READ</span><h3>${e(guide.title)}</h3><p>${e(guide.description)}</p><span class="home-text-link">Read the guide ${icon('arrow')}</span></a>`;
  return `<main id="main-content" class="home-shell">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-copy">
      <p class="home-live-pill"><span></span> SOURCE-LINKED ROLES · UPDATED <time data-snapshot-date datetime="${e(snapshot.updatedAt)}">${e(date)}</time></p>
      <h1 id="home-title">Find the work<br><em>that moves you forward.</em></h1>
      <p class="home-hero-lede">Jobs, internships, government notices and hackathons for India. Every role links to the employer, with pay in rupees.</p>
      <form class="home-search" id="job-search-form" action="/jobs" method="get" role="search">
        <div class="home-search-query"><span class="home-search-plus">${icon('search')}</span><label class="sr-only" for="job-search">Role, company or skill</label><input id="job-search" name="q" maxlength="200" autocomplete="off" placeholder="Job title, company or skill"><kbd aria-hidden="true">/</kbd></div>
        <label class="home-search-location"><span class="sr-only">Country</span>${icon('pin')}<select id="job-location" name="country"><option value="">Anywhere</option><option value="India">India</option><option value="United States">United States</option><option value="United Kingdom">United Kingdom</option></select></label>
        <button class="home-search-submit" type="submit">Search ${icon('arrow')}</button>
      </form>
      <nav class="home-quick-links" aria-label="Quick job searches"><span>Try</span><a href="/jobs?stage=internship">Internships</a><a href="/jobs?stage=fresher">Freshers</a><a href="/jobs?mode=remote">Remote</a><a href="/government-jobs">Government</a><a href="/jobs?time=today">Today</a></nav>
      <dl class="home-hero-stats" aria-label="The job index right now">
        <div><dt>Live jobs</dt><dd id="stat-total">${count(snapshot.stats.total)}</dd></div>
        <div><dt>Companies hiring</dt><dd id="stat-companies">${count(snapshot.stats.companies)}</dd></div>
        <div><dt>Remote roles</dt><dd id="stat-remote">${count(snapshot.stats.remote)}</dd></div>
      </dl>
    </div>
  </section>
  <section class="home-trust-strip" aria-label="Companies represented in the collection"><p>Roles and research from teams including</p>${logoRow(featured,companies)}<p class="home-trust-line">${icon('check')} Every listing links to its source. No affiliation or endorsement implied.</p></section>
  ${browse(dsaStats)}
  <section class="home-opportunities home-section" id="fresh-opportunities" aria-labelledby="fresh-title">
    <div class="home-section-heading"><div><p class="home-kicker">FRESH OPPORTUNITIES</p><h2 id="fresh-title">Hiring <em>right now.</em></h2></div><a class="home-section-link" href="/jobs">View all jobs ${icon('arrow')}</a></div>
    <div class="home-job-grid" id="home-job-results">${jobs.map(job=>renderJobCard(job,{companies,fx,now})).join('')}</div>
    <p id="home-jobs-status" class="home-results-status" role="status">Published collection snapshot · ${e(date)}. Verify current availability with each employer.</p>
    <a class="home-saved-link" href="/jobs?saved=1" hidden>View your saved roles ${icon('arrow')}</a>
  </section>
  <section class="home-featured home-section" aria-labelledby="featured-title">
    <div class="home-section-heading"><div><p class="home-kicker">TOP HIRING COMPANIES</p><h2 id="featured-title">Know the team before you apply.</h2></div><div class="home-rail-tools"><a class="home-section-link" href="/companies/all">All 1,000 companies ${icon('arrow')}</a><span class="home-rail-nav" hidden><button type="button" data-rail="-1" aria-label="Previous companies">${icon('arrow')}</button><button type="button" data-rail="1" aria-label="More companies">${icon('arrow')}</button></span></div></div>
    <div class="home-featured-rail" tabindex="0" role="region" aria-label="Featured companies; scroll horizontally for more">${featured.map(item=>featuredCard(item,companies)).join('')}</div>
    <p class="home-results-status">Role counts from ${e(date)}. Employer verification is shown only when recorded by the source.</p>
  </section>
  <section class="home-why home-section" id="how-jobs-work" aria-labelledby="why-title">
    <div class="home-section-heading"><div><p class="home-kicker">HOW WILSY WORKS</p><h2 id="why-title">Real sources. Clear details. Your decision.</h2></div><a class="home-section-link" href="/methodology">Our source methodology ${icon('arrow')}</a></div>
    <div class="home-why-grid">
      <article><span class="home-why-num">01</span><h3>We collect from the source</h3><p>Roles come from employers’ own career pages and recruiting platforms, checked every hour. Each listing links back to where it was found.</p></article>
      <article><span class="home-why-num">02</span><h3>You see the details that matter</h3><p>Location, experience, workplace and disclosed pay in rupees. Unknown details stay unspecified. INR conversions are estimates, not Indian offers.</p></article>
      <article><span class="home-why-num">03</span><h3>You apply with the employer</h3><p>Save and compare roles, research the company, then apply on the employer’s site. WILSY never asks for your résumé or charges a fee.</p></article>
    </div>
  </section>
  <section class="home-guides home-section" aria-labelledby="home-guides-title">
    <div class="home-section-heading"><div><p class="home-kicker">CAREER GUIDES</p><h2 id="home-guides-title">A little guidance goes a long way.</h2></div><a class="home-section-link" href="/guides">All career guides ${icon('arrow')}</a></div>
    <div class="home-guide-grid">${guides.slice(0,3).map(guideCard).join('')}</div>
    <a class="home-dsa-banner" href="/dsa"><span class="home-dsa-stat"><b>${dsaStats?.patterns || dsaStats?.categories || 16}</b><small>${dsaStats?.patterns ? 'patterns' : 'topics'}</small></span><span><span class="home-kicker">WILSY / DSA ROADMAP</span><strong>Build the patterns behind your next interview.</strong><span>${dsaStats?.categories || 16} topics. ${dsaStats?.patterns || ''} patterns. An interactive mind-map and a place to track your progress.</span></span>${icon('arrow')}</a>
  </section>
  <section class="home-final-cta" aria-labelledby="final-cta-title"><div><p class="home-kicker">FREE ACCOUNT</p><h2 id="final-cta-title">Keep your search<br><em>on every device.</em></h2><p>Sync saved jobs, hackathons and searches with an email code. No password, no fee.</p></div><div class="home-final-actions"><a class="home-cta-primary" href="/jobs?saved=1" data-account-open>Create a free account ${icon('arrow')}</a><a class="home-cta-secondary" href="/jobs">Browse live jobs ${icon('arrow')}</a></div></section>
</main><script type="application/json" id="home-initial-data">${json({jobs,fx,updatedAt:snapshot.updatedAt})}</script><script type="module" src="/js/home.js"></script>`;
}
