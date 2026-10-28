import {escapeHtml as e} from '../js/directory-core.js';
import {jobSalary, relativePostingLabel} from '../js/jobs-core.js';
import {renderJobCard, jobLogo, profileFor} from '../js/job-card.js';
import {icon} from '../js/icons.js';
import {brandMark} from './brand.mjs';

const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const count = value => Number(value || 0).toLocaleString('en-IN');
const companyLink = (item,companies) => profileFor({company_slug:item.slug,company:item.name},companies)
  ? `/companies/${encodeURIComponent(profileFor({company_slug:item.slug,company:item.name},companies).id)}`
  : `/jobs?company=${encodeURIComponent(item.name)}`;
const marqueeIds = ['google','microsoft','openai','nvidia','apple','amazon','meta','stripe','airbnb','netflix','uber','atlassian','anthropic','databricks','figma','notion'];

function feedCard(job,companies,fx,now) {
  const salary = jobSalary(job,fx);
  return `<a class="home-index-row" href="/jobs?job=${e(job.id)}">
    <span class="home-index-company">${jobLogo(job,companies)}<span>${e(job.company)}</span></span>
    <span class="home-index-role"><strong>${e(job.title)}</strong><span>${e(job.location || 'Location not specified')}</span></span>
    <span class="home-index-pay"><strong>${e(salary.primary)}</strong><span>${e(relativePostingLabel(job,now))}</span></span>
    ${job.is_company_verified === true ? `<span class="home-index-verified" title="Employer verified">${icon('check')}<span class="sr-only">Employer verified</span></span>`:''}
  </a>`;
}

function featuredCard(item,companies) {
  return `<a class="home-featured-company" href="${companyLink(item,companies)}">
    ${jobLogo({company:item.name,company_slug:item.slug},companies)}<h3>${e(item.name)}</h3>
    <p><strong>${count(item.roles)}</strong> open roles in snapshot</p>
    ${item.verified === true ? `<span class="home-verified-label">${icon('check')} Employer verified</span>` : '<span class="home-verified-label">Source-linked roles</span>'}
    <span class="home-featured-arrow" aria-hidden="true">${icon('arrow')}</span>
  </a>`;
}

function marquee(featured,companies) {
  const seen = new Set(), items = [];
  for(const c of [...featured.map(item=>profileFor({company:item.name,company_slug:item.slug},companies)),...marqueeIds.map(id=>companies.find(c=>c.id===id))]) {
    if(!c || seen.has(c.id)) continue;
    seen.add(c.id); items.push(c);
  }
  const row = hidden => `<div class="home-marquee-row"${hidden?' aria-hidden="true"':''}>${items.slice(0,14).map(c=>`<a href="/companies/${encodeURIComponent(c.id)}"${hidden?' tabindex="-1"':''}><img src="/${e(c.logo)}" alt="" width="30" height="30" loading="lazy"><span>${e(c.name)}</span></a>`).join('')}</div>`;
  return `<div class="home-trust-logos home-marquee">${row(false)}${row(true)}</div>`;
}

const sparkline = `<svg class="home-spark" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path d="M0 48 C30 46 52 42 80 40 S130 32 150 26 S185 12 200 8 V56 H0Z" fill="url(#spark-fill)"/><path d="M0 48 C30 46 52 42 80 40 S130 32 150 26 S185 12 200 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

export function homePage({snapshot, companies, guides, fx, dsaStats}) {
  const jobs = snapshot.jobs.slice(0,6), featured = snapshot.featured.slice(0,6);
  const now = Date.now();
  const date = new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(snapshot.updatedAt));
  const chipLogos = featured.map(item=>profileFor({company:item.name,company_slug:item.slug},companies)).filter(Boolean).slice(0,2);
  const guideCard = guide => `<a class="home-guide-card" href="/guides/${e(guide.slug)}"><span class="home-guide-meta">${e(guide.category)} · ${e(guide.minutes)} MIN READ</span><h3>${e(guide.title)}</h3><p>${e(guide.description)}</p><span class="home-text-link">Read the guide ${icon('arrow')}</span></a>`;
  return `<main id="main-content" class="home-shell">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-copy">
      <p class="home-live-pill"><span></span> INTRODUCING THE WILSY INDEX</p>
      <h1 id="home-title">Find the work<br><em>that moves you forward.</em></h1>
      <p class="home-hero-lede">Real opportunities, researched for you. Every role links to its source, with INR salary context.</p>
      <form class="home-search" id="job-search-form" action="/jobs" method="get" role="search">
        <div class="home-search-query"><span class="home-search-plus">${icon('plus')}</span><label class="sr-only" for="job-search">Role, company or skill</label><input id="job-search" name="q" maxlength="200" autocomplete="off" placeholder="Ask for a role, company or skill"><kbd aria-hidden="true">/</kbd></div>
        <label class="home-search-location"><span class="sr-only">Country</span>${icon('pin')}<select id="job-location" name="country"><option value="">Anywhere</option><option value="India">India</option><option value="United States">United States</option><option value="United Kingdom">United Kingdom</option></select></label>
        <button class="home-search-submit" type="submit">Search ${icon('arrow')}</button>
      </form>
      <nav class="home-quick-links" aria-label="Quick job searches"><span>Try</span><a href="/jobs?stage=internship">Internships</a><a href="/jobs?stage=fresher">Freshers</a><a href="/jobs?mode=remote">Remote</a><a href="/government-jobs">Government</a><a href="/jobs?time=today">Today</a></nav>
    </div>
    <div class="home-hero-chips" aria-hidden="true">
      <span class="hero-chip hero-chip-1">${icon('check')} Source verified</span>
      ${chipLogos[0]?`<span class="hero-chip hero-chip-logo hero-chip-2"><img src="/${e(chipLogos[0].logo)}" alt="" width="34" height="34">${e(chipLogos[0].name)}</span>`:''}
      ${chipLogos[1]?`<span class="hero-chip hero-chip-logo hero-chip-3"><img src="/${e(chipLogos[1].logo)}" alt="" width="34" height="34">${e(chipLogos[1].name)}</span>`:''}
      <span class="hero-chip hero-chip-4">${icon('rupee')} INR salary context</span>
    </div>
  </section>
  <section class="home-console" aria-label="A preview of the live job index">
    <div class="home-live-panel">
      <div class="home-console-bar"><span class="home-console-brand">${brandMark(26)}wilsy</span><span class="home-console-tabs"><span class="is-active">${icon('sparkle')} Live index</span><span>${icon('government')} Government</span><span>${icon('bolt')} Hackathons</span><span>${icon('building')} Companies</span></span><span class="home-console-search">${icon('search')} Search the index</span></div>
      <div class="home-console-body">
        <div class="home-console-main">
          <p class="home-console-prompt">Show me today’s opportunity summary</p>
          <h2>Daily opportunity summary — ${e(date)}</h2>
          <p class="home-console-lede">Here’s what the index holds right now. Every role below opens its source; availability can change.</p>
          <dl class="home-stat-grid">
            <div class="home-stat-card home-stat-wide"><dt>Published jobs</dt><dd id="stat-total">${count(snapshot.stats.total)}</dd><span class="home-stat-note">${icon('arrow')} Source-linked roles</span>${sparkline}</div>
            <div class="home-stat-card"><dt>Companies hiring</dt><dd id="stat-companies">${count(snapshot.stats.companies)}</dd><span class="home-stat-note">Across the snapshot</span><span class="home-stat-bar" aria-hidden="true"><i></i></span></div>
            <div class="home-stat-card"><dt>Remote roles</dt><dd id="stat-remote">${count(snapshot.stats.remote)}</dd><span class="home-stat-note">Work from anywhere</span><span class="home-stat-bar home-stat-bar-teal" aria-hidden="true"><i></i></span></div>
          </dl>
          <div class="home-feed-track">${(snapshot.feed.length?snapshot.feed:jobs).slice(0,3).map(job=>feedCard(job,companies,fx,now)).join('')}</div>
          <div class="home-console-foot"><a class="home-index-link" href="/jobs">Browse the full opportunity index ${icon('arrow')}</a><p class="home-feed-note" id="home-snapshot-status">Snapshot ${e(date)} · Availability can change.</p></div>
        </div>
      </div>
    </div>
  </section>
  <section class="home-trust-strip" aria-label="Companies represented in the collection"><p>Discover roles and research from teams including</p>${marquee(featured,companies)}<p class="home-trust-line">${icon('check')} Every listing links to its source. No affiliation or endorsement implied.</p></section>
  <section class="home-manifesto" aria-label="What WILSY stands for">
    <p class="home-manifesto-text"><span class="m-seg"><sup>(01)</sup> <b>Search with context.</b> Every role links to the employer, with pay translated into rupees so you can compare honestly.</span> <span class="m-seg"><sup>(02)</sup> <b>Grow deliberately.</b> Exams, hackathons and interview prep sit beside the jobs — because not every next step looks the same.</span> <span class="m-seg"><sup>(03)</sup> <b>Move with proof.</b> Research the team, shortlist with intent and apply where it matters.</span></p>
  </section>
  <section class="home-paths home-section" id="paths" aria-labelledby="paths-title">
    <div class="home-section-heading"><div><p class="home-kicker">EXPLORE YOUR POSSIBILITIES</p><h2 id="paths-title">Purpose-built for every next move.</h2></div><a class="home-pill-button" href="/jobs">Start searching ${icon('arrow')}</a></div>
    <div class="home-path-tabs" role="tablist" aria-label="Choose a path" hidden>
      <button type="button" role="tab" id="path-tab-0" aria-controls="path-0" aria-selected="true">Jobs</button>
      <button type="button" role="tab" id="path-tab-1" aria-controls="path-1" aria-selected="false" tabindex="-1">Government</button>
      <button type="button" role="tab" id="path-tab-2" aria-controls="path-2" aria-selected="false" tabindex="-1">Hackathons</button>
      <button type="button" role="tab" id="path-tab-3" aria-controls="path-3" aria-selected="false" tabindex="-1">Companies</button>
    </div>
    <div class="home-path-grid">
      <a class="home-path home-path-jobs" id="path-0" href="/jobs" role="tabpanel" aria-labelledby="path-tab-0"><span class="home-path-index">01 / OPPORTUNITY INDEX</span><h3>Turn a vague search into a real shortlist.</h3><p>Filter source-linked roles by stage, mode and location. Save, compare and open the employer’s own page.</p><span class="home-path-bottom">Find your next role ${icon('arrow')}</span><span class="home-path-num" aria-hidden="true">01</span></a>
      <a class="home-path home-path-government" id="path-1" href="/government-jobs" role="tabpanel" aria-labelledby="path-tab-1"><span class="home-path-index">02 / PUBLIC SERVICE</span><h3>Government jobs &amp; exams, explained.</h3><p>Find your route. Understand eligibility. Go straight to the official notice.</p><span class="home-path-bottom">Explore the India guide ${icon('arrow')}</span><span class="home-path-num" aria-hidden="true">02</span></a>
      <a class="home-path home-path-hackathons" id="path-2" href="/hackathons" role="tabpanel" aria-labelledby="path-tab-2"><span class="home-path-index">03 / PROOF OF WORK</span><h3>Build something worth showing.</h3><p>Hackathons and challenges where your ideas become the strongest line on your résumé.</p><span class="home-path-bottom">Find a challenge ${icon('arrow')}</span><span class="home-path-num" aria-hidden="true">03</span></a>
      <a class="home-path home-path-companies" id="path-3" href="/companies#companies" role="tabpanel" aria-labelledby="path-tab-3"><span class="home-path-index">04 / COMPANY RESEARCH</span><h3>Go beyond the job title.</h3><p>Explore 1,000 employers, sourced salary examples and the teams behind the roles.</p><span class="home-path-bottom">Explore companies ${icon('arrow')}</span><span class="home-path-num" aria-hidden="true">04</span></a>
    </div>
    <a class="home-learning-link" href="/dsa"><span>${icon('code')} Preparing for interviews? Explore the DSA roadmap.</span>${icon('arrow')}</a>
  </section>` + homeSections({snapshot,jobs,featured,companies,guides,guideCard,fx,now,date,dsaStats}) + `
</main><script type="application/json" id="home-initial-data">${json({jobs,fx,updatedAt:snapshot.updatedAt})}</script><script type="module" src="/js/home.js"></script>`;
}

function studio(dsaStats) {
  const tools = [
    ['/jobs','search','Opportunity index','Source-linked roles with INR pay context','Jobs'],
    ['/government-jobs','government','Government exams','Eligibility, dates and official notices','Public'],
    ['/hackathons','bolt','Hackathons','Challenges worth building for','Build'],
    ['/companies#companies','building','Company research','1,000 employers and salary examples','Research'],
    ['/dsa','code','DSA roadmap',`${dsaStats?.categories || 16} topics, tracked progress`,'Prepare'],
    ['/guides','book','Career guides','Offers, pay and the next step','Learn'],
  ];
  return `<section class="home-studio home-section" aria-labelledby="studio-title">
    <div class="home-studio-copy"><p class="home-kicker">THE WILSY STUDIO</p><h2 id="studio-title">Manage your whole search from one studio.</h2><p>Jobs, exams, hackathons, company research and interview prep — configured around how you actually move. Pick a tool and go.</p><a class="home-text-link" href="/jobs?saved=1">Open your saved roles ${icon('arrow')}</a></div>
    <div class="home-studio-frame"><div class="home-studio-window">
      <div class="home-studio-bar"><span class="home-console-brand">${brandMark(26)}wilsy</span><span class="home-studio-crumbs"><b>Home</b><span>Saved</span><span>Compare</span></span><span class="home-studio-beta">Beta</span></div>
      <div class="home-studio-promo"><span class="home-kicker">FEATURED</span><strong>Government exam calendar, with official notices.</strong><a href="/government-jobs">Explore ${icon('arrow')}</a></div>
      <p class="home-studio-label">Explore tools</p>
      <div class="home-studio-grid">${tools.map(([url,ic,title,text,tag])=>`<a href="${url}"><span class="home-studio-icon">${icon(ic)}</span><span class="home-studio-tag">${tag}</span><strong>${title}</strong><span>${text}</span></a>`).join('')}</div>
    </div></div>
  </section>`;
}

function homeSections({snapshot,jobs,featured,companies,guideCard,guides,fx,now,date,dsaStats}) {
  return studio(dsaStats) + `
  <section class="home-opportunities home-section" id="fresh-opportunities" aria-labelledby="fresh-title">
    <div class="home-section-heading"><div><p class="home-kicker">FRESH OPPORTUNITIES</p><h2 id="fresh-title">Good work is being built <em>right now.</em></h2></div><a class="home-section-link" href="/jobs">View all jobs ${icon('arrow')}</a></div>
    <div class="home-job-grid" id="home-job-results">${jobs.map(job=>renderJobCard(job,{companies,fx,now})).join('')}</div>
    <p id="home-jobs-status" class="home-results-status" role="status">Published collection snapshot · ${e(date)}. Verify current availability with each employer.</p>
    <a class="home-saved-link" href="/jobs?saved=1" hidden>View your saved roles ${icon('arrow')}</a>
  </section>
  <section class="home-featured home-section" aria-labelledby="featured-title">
    <div class="home-section-heading"><div><p class="home-kicker">GET TO KNOW THE TEAM</p><h2 id="featured-title">A company is more than its open roles.</h2></div><a class="home-section-link" href="/companies/all">All 1,000 companies ${icon('arrow')}</a></div>
    <div class="home-featured-rail" tabindex="0" role="region" aria-label="Featured companies; scroll horizontally for more">${featured.map(item=>featuredCard(item,companies)).join('')}</div>
    <p class="home-results-status">Role counts from ${e(date)}. Employer verification is shown only when recorded by the source.</p>
  </section>
  <section class="home-why home-section" id="how-jobs-work" aria-labelledby="why-title">
    <h2 id="why-title" class="home-giant">How WILSY works.</h2>
    <div class="home-why-grid">
      <article><span class="home-why-num">01</span><h3>The source</h3><p>Every listing links to the employer or recruiting platform. Applications happen directly on the linked site.</p></article>
      <article><span class="home-why-num">02</span><h3>The details</h3><p>Compare location and disclosed pay in rupees. Unknown details stay unspecified. INR conversions are estimates, not Indian offers.</p></article>
      <article><span class="home-why-num">03</span><h3>Your move</h3><p>Save roles on this device, compare your options and research the company before you invest time in an application.</p></article>
    </div><a class="home-section-link" href="/methodology">Read our source methodology ${icon('arrow')}</a>
  </section>
  <section class="home-guides home-section" aria-labelledby="home-guides-title">
    <div class="home-section-heading"><div><p class="home-kicker">FIELD NOTES</p><h2 id="home-guides-title">A little guidance goes a long way.</h2></div><a class="home-section-link" href="/guides">All career guides ${icon('arrow')}</a></div>
    <div class="home-guide-grid">${guides.slice(0,3).map(guideCard).join('')}</div>
    <a class="home-dsa-banner" href="/dsa"><span class="home-dsa-stat"><b>${dsaStats?.patterns || dsaStats?.categories || 16}</b><small>${dsaStats?.patterns ? 'patterns' : 'topics'}</small></span><span><span class="home-kicker">WILSY / DSA ROADMAP</span><strong>Build the patterns behind your next interview.</strong><span>${dsaStats?.categories || 16} topics. ${dsaStats?.patterns || ''} patterns. An interactive mind-map and a place to track your progress.</span></span>${icon('arrow')}</a>
  </section>
  <section class="home-final-cta" aria-labelledby="final-cta-title"><div><p class="home-kicker">YOUR NEXT MOVE</p><h2 id="final-cta-title">For the most deliberate<br><em>job seekers in India.</em></h2><p>Start with a role. Leave with more context.</p></div><div class="home-final-actions"><a class="home-cta-primary" href="#job-search-form">Find your next role ${icon('arrow')}</a><a class="home-cta-secondary" href="/dsa">Prepare for what comes next ${icon('arrow')}</a></div></section>`;
}
