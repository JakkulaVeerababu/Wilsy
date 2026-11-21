import {escapeHtml as e} from '../js/directory-core.js';
import {renderJobCard, jobLogo, profileFor} from '../js/job-card.js';
import {icon} from '../js/icons.js';
import {browseRoles, browseStages} from './landing-pages.mjs';
import {logoSize, logoOpaque} from './logo-size.mjs';
import {TOOLS, toolCard} from './feature-pages.mjs';

// The homepage's six tool cards; /tools lists them all.
const HOME_TOOLS = ['/resume-builder', '/tracker', '/deadlines', '/scam-check', '/salary-calculator', '/offer-compare'];

const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const count = value => Number(value || 0).toLocaleString('en-IN');
const companyLink = (item,companies) => profileFor({company_slug:item.slug,company:item.name},companies)
  ? `/companies/${encodeURIComponent(profileFor({company_slug:item.slug,company:item.name},companies).id)}`
  : `/jobs?company=${encodeURIComponent(item.name)}`;
// Each word becomes its own span so home.js can light the words in reading order as the reader scrolls.
// Tags pass through untouched. Without the script, or with reduced motion, every word shows lit.
const lit = html => html.replace(/(<[^>]+>)|([^<\s]+)/g,(m,tag,word)=>tag||`<span class="home-lw">${word}</span>`);
// Decorative shapes set inline with the display type; hidden from screen readers.
const shapeArrow = '<svg class="home-shape home-shape-arrow" viewBox="0 0 168 80" aria-hidden="true" focusable="false"><rect width="168" height="80" rx="40" fill="#d8f8a8"/><circle cx="128" cy="40" r="40" fill="#b6efd9"/><path d="M38 40h88m-24-24 24 24-24 24" fill="none" stroke="#1f45ec" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const shapeSpark = '<svg class="home-shape home-shape-spark" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><path d="M40 0c3 22 18 37 40 40-22 3-37 18-40 40-3-22-18-37-40-40C22 37 37 22 40 0Z" fill="#a9ecd2"/></svg>';
const logoIds = ['google','microsoft','openai','nvidia','apple','amazon','meta','stripe','airbnb','netflix','uber','atlassian','anthropic','databricks','figma','notion'];

function featuredCard(item,companies) {
  return `<a class="home-featured-company" href="${companyLink(item,companies)}">
    ${jobLogo({company:item.name,company_slug:item.slug},companies)}<h3>${e(item.name)}</h3>
    <p><strong>${count(item.roles)}</strong> open roles</p>
    ${item.verified === true ? `<span class="home-verified-label">Employer verified</span>` : '<span class="home-verified-label">Source-linked roles</span>'}
    <span class="home-featured-arrow" aria-hidden="true">${icon('arrow')}</span>
  </a>`;
}

// Wide wordmarks (Stripe, NVIDIA, Amazon) keep their real proportions and stand in for the name;
// square marks sit beside the company name.
function logoImage(logo) {
  const size = logoSize(logo), ratio = size ? size.width / size.height : 1;
  if(ratio < 1.8) return {wordmark:false, width:28, height:28};
  const width = Math.min(132, Math.round(24 * ratio));
  return {wordmark:true, width, height:Math.round(width / ratio)};
}
const pauseIcon = '<svg class="home-logo-pause" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>';
const playIcon = '<svg class="home-logo-play" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.1v9.8a.9.9 0 0 0 1.37.77l7.6-4.9a.9.9 0 0 0 0-1.54l-7.6-4.9A.9.9 0 0 0 5 3.1Z"/></svg>';
// Employer logos; featured hiring companies come first. With 8 or more, the row drifts in a slow loop.
// The track is copy, real row, copy: the copies are aria-hidden and unfocusable, the loop moves by one
// row so it has no seam, and every real logo has logos on both sides, so the viewport can centre any of
// them for keyboard focus. home.js reveals the pause button, stops the loop offscreen and handles focus.
// Reduced motion shows the real row, still and wrapped.
export const MARQUEE_MIN = 8;
export function logoStrip(featured,companies) {
  const seen = new Set(), items = [];
  for(const c of [...featured.map(item=>profileFor({company:item.name,company_slug:item.slug},companies)),...logoIds.map(id=>companies.find(c=>c.id===id))]) {
    if(!c || seen.has(c.id)) continue;
    seen.add(c.id); items.push(c);
  }
  const list = items.slice(0,12);
  const row = copy => `<ul class="home-logo-row" role="list"${copy?' aria-hidden="true"':''}>${list.map(c=>{
    const img = logoImage(c.logo);
    return `<li><a class="home-logo${img.wordmark?' home-logo-wordmark':''}${logoOpaque(c.logo)?' home-logo-tile':''}" href="/companies/${encodeURIComponent(c.id)}"${copy?' tabindex="-1"':''}><img src="/${e(c.logo)}" alt="" width="${img.width}" height="${img.height}" loading="lazy" decoding="async"><span${img.wordmark?' class="sr-only"':''}>${e(c.name)}</span></a></li>`;
  }).join('')}</ul>`;
  if(list.length < MARQUEE_MIN) return `<div class="home-logo-marquee is-static">${row(false)}</div>`;
  return `<div class="home-logo-marquee" data-logo-marquee style="--logo-count:${list.length}"><button class="home-logo-toggle" type="button" aria-label="Pause the logo animation" title="Pause the logo animation" hidden>${pauseIcon}${playIcon}</button><div class="home-logo-viewport"><div class="home-logo-track">${row(true)}${row(false)}${row(true)}</div></div></div>`;
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
    <div class="home-section-heading home-display-heading"><div><p class="home-kicker">BROWSE</p><h2 id="browse-title" class="home-display">Start ${shapeArrow}<br><em>where you</em><br>${shapeSpark} are.</h2></div></div>
    <div class="home-browse-grid">
      <div class="home-browse-group"><h3>By role</h3><nav class="home-chip-list" aria-label="Jobs by role">${browseRoles.map(chip).join('')}</nav></div>
      <div class="home-browse-group"><h3>By career stage</h3><nav class="home-chip-list" aria-label="Jobs by career stage">${browseStages.map(chip).join('')}</nav></div>
    </div>
    <div class="home-route-grid">${routes.map(([url,,title,text])=>`<a href="${url}"><strong>${title}</strong><span>${text}</span><span class="home-route-arrow" aria-hidden="true">${icon('arrow')}</span></a>`).join('')}</div>
    <a class="home-section-link home-browse-all" href="/jobs">All jobs ${icon('arrow')}</a>
  </section>`;
}

export function homePage({snapshot, companies, guides, fx, dsaStats}) {
  const jobs = snapshot.jobs.slice(0,6), featured = snapshot.featured.slice(0,6);
  const now = Date.now();
  const date = new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(snapshot.updatedAt));
  return `<main id="main-content" class="home-shell">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-frame" aria-hidden="true"><i></i><i></i></div>
    <div class="home-hero-copy">
      <p class="home-live-pill"><span></span> SOURCE-LINKED ROLES · UPDATED <time data-snapshot-date datetime="${e(snapshot.updatedAt)}">${e(date)}</time></p>
      <h1 id="home-title">Find the work<br><em>that moves you forward.</em></h1>
      <p class="home-hero-lede">Jobs, internships, government notices and hackathons for India. Every role links to the employer, with pay in rupees.</p>
      <form class="home-search" id="job-search-form" action="/jobs" method="get" role="search">
        <div class="home-search-query"><span class="home-search-plus">${icon('search')}</span><label class="sr-only" for="job-search">Role, company or skill</label><input id="job-search" name="q" maxlength="200" autocomplete="off" placeholder="Job title, company or skill"></div>
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
  <section class="home-trust-strip" aria-label="Companies represented in the collection"><p>Roles and research from teams including</p>${logoStrip(featured,companies)}<p class="home-trust-line">Every listing links to its source. No affiliation or endorsement implied.</p></section>
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
    <p class="home-kicker">HOW WILSY WORKS</p>
    <h2 id="why-title" class="home-statement" data-scroll-lit>${lit('Every role here links to the employer. Every detail is shown as published. The decision stays <em>yours.</em>')}</h2>
    <ol class="home-steps">
      <li><span class="home-step-num">(01)</span><h3>Straight from the source</h3><p>Every role links back to the employer’s own careers page.</p></li>
      <li><span class="home-step-num">(02)</span><h3>Only what matters</h3><p>Location, experience and pay in rupees. Nothing guessed.</p></li>
      <li><span class="home-step-num">(03)</span><h3>Apply with the employer</h3><p>WILSY never asks for your résumé or charges a fee.</p></li>
    </ol>
    <p class="home-why-foot">INR conversions are estimates, not Indian offers. <a class="home-section-link" href="/methodology">Our source methodology ${icon('arrow')}</a></p>
  </section>
  <section class="home-guides home-toolkit home-section" aria-labelledby="home-guides-title">
    <div class="home-section-heading"><div><p class="home-kicker">FREE TOOLS AND GUIDES</p><h2 id="home-guides-title">Tools for <em>every step.</em></h2></div><a class="home-section-link" href="/tools">All ${TOOLS.length} tools ${icon('arrow')}</a></div>
    <div class="tool-grid home-tool-grid">${HOME_TOOLS.map(url=>toolCard(TOOLS.find(t=>t[0]===url))).join('')}</div>
    <div class="home-guide-line"><p class="home-guide-line-head"><span class="home-guide-line-label">Career guides</span><a class="home-guide-line-all" href="/guides">All guides ${icon('arrow')}</a></p>
      <ul class="home-guide-links">${guides.slice(0,3).map(guide=>`<li><a href="/guides/${e(guide.slug)}"><span>${e(guide.title)}</span>${icon('arrow')}</a></li>`).join('')}</ul></div>
    <a class="home-dsa-banner" href="/dsa"><span class="home-dsa-stat"><b>${dsaStats?.patterns || dsaStats?.categories || 16}</b><small>${dsaStats?.patterns ? 'patterns' : 'topics'}</small></span><span><span class="home-kicker">DSA ROADMAP</span><strong>Build the patterns behind your next interview.</strong><span>${dsaStats?.categories || 16} topics. ${dsaStats?.patterns || ''} patterns. An interactive mind-map and a place to track your progress.</span></span>${icon('arrow')}</a>
  </section>
  <section class="home-final-cta" aria-labelledby="final-cta-title"><div><p class="home-kicker">FREE ACCOUNT</p><h2 id="final-cta-title">Keep your search<br><em>on every device.</em></h2><p>Sync saved jobs, hackathons and searches with an email code. No password, no fee.</p></div><div class="home-final-actions"><a class="home-cta-primary" href="/jobs?saved=1" data-account-open>Create a free account ${icon('arrow')}</a><a class="home-cta-secondary" href="/jobs">Browse live jobs ${icon('arrow')}</a></div></section>
</main><script type="application/json" id="home-initial-data">${json({jobs,fx,updatedAt:snapshot.updatedAt})}</script><script type="module" src="/js/home.js"></script>`;
}
