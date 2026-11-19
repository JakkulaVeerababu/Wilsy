import {escapeHtml as e} from '../js/directory-core.js';
import {icon} from '../js/icons.js';
import {STAGES} from '../js/tracker-core.js';
import {salaryRows, sortRows, facet, ROLE_GROUPS} from '../js/salary-core.js';
import {statsHtml, chartHtml, rowsHtml} from '../js/salary-view.js';
import {takeHome, FY} from '../js/take-home-core.js';
import {takeHomeResult} from '../js/take-home-view.js';
import {whatsappUrl} from '../js/features.js';

// Page bodies for the application tracker, salary explorer and in-hand salary calculator, plus the
// share bar used on job pages and the quick-search index. Shared by the static build.

const crumbs = label => `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">${e(label)}</span></nav>`;
const hero = (eyebrow, title, text) => `<div class="editorial-hero"><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p>${e(text)}</p></div>`;

/** Share a page: WhatsApp (a plain link, works without scripts), copy link, and the phone's share sheet. */
export function shareBar(url, text, {label = 'Share this role'} = {}) {
  const shared = url + (url.includes('?') ? '&' : '?') + 'utm_source=whatsapp&utm_medium=share';
  return `<div class="share-bar" role="group" aria-label="${e(label)}"><a class="share-button share-whatsapp" data-share-whatsapp href="${e(whatsappUrl(text, shared))}" target="_blank" rel="noopener noreferrer">${icon('message')}<span>WhatsApp</span></a><button class="share-button" type="button" data-share-copy="${e(url)}">${icon('link')}<span data-label>Copy link</span></button><button class="share-button" type="button" data-share-native="${e(url)}" data-share-title="${e(text)}" hidden>${icon('external')}<span>Share</span></button></div>`;
}

export function trackerBody({fx}) {
  return `<main id="main-content" class="editorial-shell tracker-shell">${crumbs('Application tracker')}
  ${hero('YOUR APPLICATIONS', 'Track every application.', 'Saved roles land here. Move them from Saved to Applied, Interviewing and Offer, and keep notes on each one.')}
  <section class="tracker" data-tracker aria-label="Application board">
    <div class="tracker-top"><p class="tracker-summary" data-tracker-summary tabindex="-1">Loading your board…</p>
      <div class="tracker-tools"><a class="secondary-button" href="/jobs">${icon('search')} Find roles to save</a><button class="secondary-button" type="button" data-export disabled>Download spreadsheet</button></div></div>
    <p class="tracker-status" data-tracker-status role="status" aria-live="polite"></p>
    <div class="tracker-board">${STAGES.map(([id, name]) => `<section class="tracker-col" data-col="${id}" aria-labelledby="col-${id}"><h2 id="col-${id}">${name} <span>0</span></h2><ol class="tracker-list"></ol></section>`).join('')}</div>
    <noscript><p class="tracker-status">The tracker needs JavaScript. Your <a href="/jobs?saved=1">saved jobs</a> still work without it.</p></noscript>
    <p class="quiet-callout">Your board and notes stay in this browser; they are not sent to WILSY or synced to your account yet. Use “Download spreadsheet” to keep a copy. Moving a role on the board never contacts the employer.</p>
    <script type="application/json" id="tracker-fx">${JSON.stringify({rate: fx.rate, date: fx.date}).replace(/</g, '\\u003c')}</script>
  </section>
  <script type="module" src="/js/tracker.js"></script></main>`;
}

export function salariesBody({companies, fx}) {
  const rows = salaryRows(companies, fx.rate), sorted = sortRows(rows);
  const options = (key, all) => `<option value="">${all}</option>` + facet(rows, key).map(([v, n]) => `<option value="${e(v)}">${e(v)} (${n})</option>`).join('');
  const roleOptions = `<option value="">All roles</option>${ROLE_GROUPS.map(r => `<option value="${r}">${r}</option>`).join('')}<option value="Other">Other</option>`;
  return `<main id="main-content" class="editorial-shell salary-shell">${crumbs('Salary explorer')}
  ${hero('SALARY EXPLORER', 'What 1,000 companies pay.', 'Compare published pay for one example role per company, as INR estimates. Filter by role, sector and stage.')}
  <section class="salary-explorer" data-salaries aria-label="Salary explorer">
    <form class="salary-filters" data-salary-filters role="search" aria-label="Filter salaries">
      <div class="salary-field salary-field-wide"><label for="salary-q">Company or role</label><input id="salary-q" name="q" type="search" placeholder="e.g. Stripe, data, robotics" autocomplete="off"></div>
      <div class="salary-field"><label for="salary-role">Role</label><select id="salary-role" name="role">${roleOptions}</select></div>
      <div class="salary-field"><label for="salary-sector">Sector</label><select id="salary-sector" name="sector">${options('sector', 'All sectors')}</select></div>
      <div class="salary-field"><label for="salary-stage">Stage</label><select id="salary-stage" name="stage">${options('stage', 'All stages')}</select></div>
      <div class="salary-field"><label for="salary-sort">Sort</label><select id="salary-sort" name="sort"><option value="pay">Highest pay</option><option value="low">Lowest pay</option><option value="name">Company A–Z</option></select></div>
      <label class="salary-check"><input type="checkbox" name="remote" value="1"> Remote roles only</label>
    </form>
    <dl class="salary-stats" data-salary-stats aria-live="polite">${statsHtml(rows)}</dl>
    <div class="salary-grid">
      <section class="salary-panel" aria-labelledby="salary-dist-title"><h2 id="salary-dist-title">How pay is spread</h2><p class="salary-note">Companies by the midpoint of their example role’s yearly range.</p><div data-salary-chart>${chartHtml(rows)}</div></section>
      <section class="salary-panel salary-panel-wide" aria-labelledby="salary-table-title"><h2 id="salary-table-title">Companies <span data-salary-count>${rows.length.toLocaleString('en-IN')}</span></h2>
        <div class="salary-table-wrap"><table class="salary-table"><caption class="sr-only">Published yearly pay range per company, INR estimate</caption><thead><tr><th scope="col">Company</th><th scope="col">Example role</th><th scope="col" class="salary-num">Yearly pay (INR estimate)</th></tr></thead><tbody data-salary-rows>${rowsHtml(sorted.slice(0, 50))}</tbody></table></div>
        <button class="secondary-button salary-more" type="button" data-salary-more${rows.length > 50 ? '' : ' hidden'}>Show 50 more</button></section>
    </div>
    <p class="quiet-callout">Each figure is the published yearly pay range for one example role (usually engineering, mostly in the United States), converted at the reference rate of ₹${e(String(fx.rate))} per US dollar dated ${e(fx.date)}. They are not Indian offers and don’t include equity or bonuses. <a href="/methodology">How the salary data works</a> · <a href="/salary-calculator">Work out your own in-hand pay</a></p>
  </section>
  <script type="module" src="/js/salaries.js"></script></main>`;
}

export function calculatorBody() {
  const start = takeHome({ctc: 1200000});
  return `<main id="main-content" class="editorial-shell calc-shell">${crumbs('In-hand salary calculator')}
  ${hero(`IN-HAND CALCULATOR · FY ${FY}`, 'From CTC to in-hand pay.', 'Enter a CTC to see the monthly take-home after PF, professional tax and income tax under the new regime.')}
  <section class="calc" data-calc aria-label="In-hand salary calculator">
    <form class="calc-form" data-calc-form novalidate>
      <div class="calc-field calc-field-main"><label for="calc-ctc">Yearly CTC (₹)</label><input id="calc-ctc" name="ctc" type="number" inputmode="numeric" min="0" max="1000000000" step="10000" value="1200000" aria-describedby="calc-ctc-words"><span id="calc-ctc-words" class="calc-words">₹12 lakh a year</span></div>
      <div class="calc-field"><label for="calc-variable">Variable pay or bonus in the CTC (₹ a year)</label><input id="calc-variable" name="variable" type="number" inputmode="numeric" min="0" step="10000" value="0"></div>
      <div class="calc-field"><label for="calc-basic">Basic pay, % of fixed pay</label><input id="calc-basic" name="basic" type="number" inputmode="numeric" min="10" max="100" step="5" value="50"><span class="calc-words">Under the labour codes, basic and allowances usually make up at least 50% of pay.</span></div>
      <div class="calc-field"><label for="calc-pf">Provident fund (PF)</label><select id="calc-pf" name="pf"><option value="basic">12% of basic</option><option value="capped">12% of ₹15,000 a month (capped)</option><option value="none">No PF</option></select></div>
      <div class="calc-field"><label for="calc-pt">Professional tax (₹ a year)</label><select id="calc-pt" name="pt"><option value="2400">₹2,400 (Karnataka, Telangana and others)</option><option value="2500">₹2,500 (Maharashtra and others)</option><option value="0">None (Delhi, Haryana and others)</option></select></div>
      <label class="calc-check"><input type="checkbox" name="gratuity" checked> The CTC includes gratuity</label>
    </form>
    <div class="calc-result" data-calc-result aria-live="polite">${takeHomeResult(start)}</div>
    <p class="quiet-callout">An estimate for a salaried employee under the new tax regime for FY ${FY}: slabs from nil up to ₹4 lakh to 30% above ₹24 lakh, a ₹75,000 standard deduction, no tax up to ₹12 lakh of taxable income (with marginal relief just above it), surcharge above ₹50 lakh and 4% cess. It leaves out employer NPS, perks, other income and the old regime. Your payslip and Form 16 are the final word. <a href="/salaries">Compare pay across companies</a></p>
  </section>
  <script type="module" src="/js/take-home.js"></script></main>`;
}

/** The quick-search index: t title, u url, d description, k keywords, g group (page, company or guide). */
export function searchIndex({companies, guides = [], landing = [], curated = []}) {
  const pages = [
    ['Find jobs', '/jobs', 'Search every live role', 'search work openings vacancies'],
    ['Application tracker', '/tracker', 'Saved → Applied → Interviewing → Offer', 'applications board kanban status'],
    ['Saved jobs', '/jobs?saved=1', 'Roles you saved', 'bookmarks shortlist'],
    ['Salary explorer', '/salaries', 'Pay at 1,000 companies, in INR', 'salary pay compensation ctc compare'],
    ['In-hand salary calculator', '/salary-calculator', 'CTC to monthly take-home', 'take home in hand ctc tax calculator monthly'],
    ['Government jobs', '/government-jobs', 'Official notices and exams', 'sarkari exam upsc ssc psu'],
    ['Hackathons', '/hackathons', 'Open challenges and prizes', 'hackathon challenge'],
    ['Competitions', '/competitions', 'Case competitions and challenges', 'case competition quiz'],
    ['Coding contests', '/contests', 'Codeforces and AtCoder calendar', 'competitive programming contest'],
    ['Open-source programmes', '/open-source-programs', 'GSoC, LFX, Outreachy and more', 'gsoc open source mentorship'],
    ['Research internships', '/research-internships', 'IAS, IIT and institute fellowships', 'summer research fellowship'],
    ['Scholarships', '/scholarships', 'Official scholarship schemes', 'scholarship funding'],
    ['DSA roadmap', '/dsa', 'Interview patterns and practice', 'data structures algorithms leetcode interview'],
    ['Career guides', '/guides', 'Practical reading for your search', 'guides advice'],
    ['Company directory', '/companies', '1,000 tech employers', 'companies employers'],
    ['All companies A–Z', '/companies/all', 'Every company profile', 'companies list'],
    ['For employers', '/employers', 'List and correct your jobs', 'employer hiring post job'],
    ['Campus ambassadors', '/campus', 'Bring WILSY to your campus', 'ambassador referral college'],
    ['About WILSY', '/about', 'Who we are and how listings are collected', 'about team'],
    ['Sources & methodology', '/methodology', 'How the data works', 'methodology sources'],
    ['Contact & corrections', '/contact', 'Questions and corrections', 'contact support email'],
  ].map(([t, u, d, k]) => ({t, u, d, k, g: 'page'}));
  return [
    ...pages,
    ...landing.map(([u, t]) => ({t, u, d: 'Live roles', k: 'jobs', g: 'page'})),
    ...companies.map(c => ({t: c.name, u: '/companies/' + c.id, d: c.sector, k: [c.sector, ...(c.tags || [])].join(' '), g: 'company'})),
    ...guides.map(g => ({t: g.title, u: '/guides/' + g.slug, d: g.category, k: 'guide', g: 'guide'})),
    ...curated.map(([t, u, d]) => ({t, u, d, k: 'programme', g: 'guide'})),
  ];
}
