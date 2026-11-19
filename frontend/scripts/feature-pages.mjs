import {escapeHtml as e} from '../js/directory-core.js';
import {icon} from '../js/icons.js';
import {STAGES} from '../js/tracker-core.js';
import {salaryRows, sortRows, facet, ROLE_GROUPS} from '../js/salary-core.js';
import {statsHtml, chartHtml, rowsHtml} from '../js/salary-view.js';
import {takeHome, FY} from '../js/take-home-core.js';
import {takeHomeResult} from '../js/take-home-view.js';
import {whatsappUrl, referralMessage} from '../js/features.js';
import {offerFields, offerTable, DEFAULT_OFFERS} from '../js/offer-core.js';
import {SKILLS} from '../js/skills-core.js';
import {SIGNS} from '../js/scam-core.js';
import {hikeResult, hikeTable, inWords, HIKE_STEPS} from '../js/hike-core.js';
import {gratuity, gratuityResult} from '../js/gratuity-core.js';
import {site} from '../js/site-config.js';

// Page bodies for the career tools (tracker, salary explorer, calculators, offer comparison, resume match,
// scam check, tools hub and jobs widget), plus the share bar used on job pages and the quick-search index.
// Shared by the static build.

const crumbs = (label, mid) => `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>${mid ? `<a href="${mid[0]}">${e(mid[1])}</a><span>/</span>` : ''}<span aria-current="page">${e(label)}</span></nav>`;
const toolCrumbs = label => crumbs(label, ['/tools', 'Tools']);

/** Every career tool: [url, icon, name, what it does, group]. The tools hub and the homepage list them. */
export const TOOLS = [
  ['/tracker', 'kanban', 'Application tracker', 'Saved → Applied → Interviewing → Offer, with interview reminders. Add jobs from any site.', 'Apply'],
  ['/resume-match', 'file', 'Resume match', 'See which of a job’s skills your resume shows, and which are missing.', 'Apply'],
  ['/scam-check', 'shield', 'Job scam check', 'Paste an offer or a WhatsApp message to check it for the signs of a job scam.', 'Apply'],
  ['/salary-calculator', 'calculator', 'In-hand salary calculator', 'From CTC to monthly take-home under the new tax regime.', 'Pay'],
  ['/offer-compare', 'scale', 'Compare job offers', 'Two or three offers side by side: in hand, first-year cash and equity.', 'Pay'],
  ['/salary-hike-calculator', 'trending', 'Salary hike calculator', 'What a raise really adds to your monthly pay, and the hike you need.', 'Pay'],
  ['/gratuity-calculator', 'wallet', 'Gratuity calculator', 'What you get when you leave, under the labour codes.', 'Pay'],
  ['/salaries', 'rupee', 'Salary explorer', 'Published pay at 1,000 companies, as INR estimates.', 'Research'],
  ['/hiring-trends', 'chart', 'Hiring trends', 'What is hiring right now, counted from live jobs.', 'Research'],
  ['/skills', 'sparkle', 'Skills in demand', 'Live jobs and the employers hiring for each skill.', 'Research'],
  ['/dsa', 'code', 'DSA roadmap', 'Interview patterns with practice links and saved progress.', 'Prepare'],
  ['/embed', 'link', 'Jobs widget', 'Live jobs for your college, club or community website.', 'Share'],
  ['/feed.xml', 'rss', 'New jobs RSS feed', 'Follow new jobs in any feed reader.', 'Share'],
];
export const toolCard = ([url, ic, name, text], tag = 'h3') => `<a class="tool-card" href="${url}"><span class="tool-card-icon">${icon(ic)}</span><${tag}>${e(name)}</${tag}><p>${e(text)}</p><span class="tool-card-go" aria-hidden="true">${icon('arrow')}</span></a>`;
const hero = (eyebrow, title, text) => `<div class="editorial-hero"><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p>${e(text)}</p></div>`;

/** Share a page: WhatsApp (a plain link, works without scripts), copy link, and the phone's share sheet. */
export function shareBar(url, text, {label = 'Share this role'} = {}) {
  const shared = url + (url.includes('?') ? '&' : '?') + 'utm_source=whatsapp&utm_medium=share';
  return `<div class="share-bar" role="group" aria-label="${e(label)}"><a class="share-button share-whatsapp" data-share-whatsapp href="${e(whatsappUrl(text, shared))}" target="_blank" rel="noopener noreferrer">${icon('message')}<span>WhatsApp</span></a><button class="share-button" type="button" data-share-copy="${e(url)}">${icon('link')}<span data-label>Copy link</span></button><button class="share-button" type="button" data-share-native="${e(url)}" data-share-title="${e(text)}" hidden>${icon('external')}<span>Share</span></button></div>`;
}

// Pressed on any job page, the bookmarklet opens the tracker's "Add an application" form, filled in.
export const bookmarklet = origin => `javascript:(function(){var u='${origin}/tracker?add=1&title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href);window.open(u,'_blank')||(location.href=u)})()`;

export function trackerBody({fx}) {
  const stages = STAGES.map(([id, name]) => `<option value="${id}"${id === 'applied' ? ' selected' : ''}>${name}</option>`).join('');
  return `<main id="main-content" class="editorial-shell tracker-shell">${toolCrumbs('Application tracker')}
  ${hero('YOUR APPLICATIONS', 'Track every application.', 'Saved roles land here, and you can add jobs from any other site. Move them from Saved to Applied, Interviewing and Offer, set interview reminders and keep notes.')}
  <section class="tracker" data-tracker aria-label="Application board">
    <div class="tracker-top"><p class="tracker-summary" data-tracker-summary tabindex="-1">Loading your board…</p>
      <div class="tracker-tools"><button class="primary-button" type="button" data-add-open>${icon('plus')} Add an application</button><a class="secondary-button" href="/jobs">${icon('search')} Find roles to save</a><button class="secondary-button" type="button" data-export disabled>Download spreadsheet</button></div></div>
    <p class="tracker-status" data-tracker-status role="status" aria-live="polite"></p>
    <section class="tracker-upcoming" data-upcoming aria-labelledby="upcoming-title" hidden><h2 id="upcoming-title">${icon('clock')} Coming up</h2><ol></ol></section>
    <details class="tracker-add" id="add" data-add><summary>Add an application from another site</summary>
      <form class="tracker-add-form" data-add-form novalidate>
        <div class="calc-field"><label for="add-title">Role</label><input id="add-title" name="title" maxlength="200" autocomplete="off" placeholder="Software Engineer"></div>
        <div class="calc-field"><label for="add-company">Company</label><input id="add-company" name="company" maxlength="120" autocomplete="off" placeholder="Acme"></div>
        <div class="calc-field tracker-add-wide"><label for="add-url">Link to the job (optional)</label><input id="add-url" name="apply" type="url" inputmode="url" maxlength="2000" autocomplete="off" placeholder="https://"></div>
        <div class="calc-field"><label for="add-place">Location (optional)</label><input id="add-place" name="place" maxlength="120" autocomplete="off" placeholder="Bengaluru, remote…"></div>
        <div class="calc-field"><label for="add-stage">Stage</label><select id="add-stage" name="stage">${stages}</select></div>
        <div class="calc-field tracker-add-wide"><label for="add-notes">Notes (optional)</label><textarea id="add-notes" name="notes" rows="2" maxlength="2000" placeholder="Referred by…, applied through…"></textarea></div>
        <p class="tracker-add-error" data-add-error role="alert" hidden></p>
        <div class="tracker-add-actions"><button class="primary-button" type="submit">Add to the board</button></div>
      </form>
      <p class="salary-note tracker-add-tip">Faster: on a phone, share a job from LinkedIn, Naukri or your browser to the installed WILSY app and it opens here, filled in. On a computer, drag this button to your bookmarks bar, then press it on any job page: <a class="bookmarklet" href="${e(bookmarklet(site.origin))}" data-bookmarklet>${icon('plus')} Add to WILSY</a></p>
    </details>
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
  return `<main id="main-content" class="editorial-shell salary-shell">${toolCrumbs('Salary explorer')}
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
  return `<main id="main-content" class="editorial-shell calc-shell">${toolCrumbs('In-hand salary calculator')}
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

export function offerBody() {
  return `<main id="main-content" class="editorial-shell calc-shell offer-shell">${toolCrumbs('Compare job offers')}
  ${hero(`OFFER COMPARISON · FY ${FY}`, 'Which offer pays more?', 'Put two or three offers side by side: monthly in-hand pay, first-year cash with the joining bonus, income tax and equity.')}
  <section class="offers" data-offers aria-label="Compare job offers">
    <form class="offer-form" data-offer-form novalidate>${offerFields(DEFAULT_OFFERS)}</form>
    <div class="offer-result" data-offer-result aria-live="polite">${offerTable(DEFAULT_OFFERS)}</div>
    <div class="offer-tools"><button class="secondary-button" type="button" data-offer-copy>${icon('link')} Copy a link to this comparison</button><a class="secondary-button" href="/salary-calculator">See the full in-hand breakdown</a></div>
    <p class="offer-status" data-offer-status role="status" aria-live="polite"></p>
    <p class="quiet-callout">The same estimate as the <a href="/salary-calculator">in-hand calculator</a>: the new tax regime for FY ${FY}, basic pay at 50% of fixed pay, PF at 12% of basic and gratuity inside the CTC. Variable pay counts as if paid in full. Equity is shown as stated and never added to cash. Everything is worked out in your browser; a copied link carries only what you typed.</p>
  </section>
  <script type="module" src="/js/offer-compare.js"></script></main>`;
}

export function resumeBody() {
  return `<main id="main-content" class="editorial-shell resume-shell">${toolCrumbs('Resume match')}
  ${hero('RESUME MATCH', 'Does your resume fit the job?', 'Paste your resume and a job description to see which of the job’s skills your resume shows, and which are missing.')}
  <section class="resume-match" data-resume aria-label="Resume match checker">
    <p class="resume-job" data-resume-job role="status" hidden></p>
    <div class="resume-inputs">
      <div class="calc-field"><label for="resume-text">Your resume (paste the text)</label><textarea id="resume-text" rows="12" maxlength="30000" spellcheck="false" placeholder="Open your resume, select all, copy, and paste it here."></textarea>
        <div class="resume-keep"><label class="calc-check"><input type="checkbox" id="resume-remember"> Remember my resume on this device</label><button class="text-button" type="button" data-resume-clear>Clear</button></div></div>
      <div class="calc-field"><label for="job-text">Job description</label><textarea id="job-text" rows="12" maxlength="30000" spellcheck="false" placeholder="Paste the job description, including the requirements."></textarea></div>
    </div>
    <div class="resume-result" data-resume-result aria-live="polite"><p class="match-empty">Paste your resume and a job description to see the match.</p></div>
    <noscript><p class="tracker-status">The resume check needs JavaScript.</p></noscript>
    <p class="quiet-callout">The check runs in your browser. Your resume is never uploaded or sent to WILSY, and it is kept on this device only if you tick “Remember”. It looks for ${SKILLS.length} common skills and tools, so treat it as a quick check, not a verdict. <a href="/jobs">Find a job to check against</a></p>
  </section>
  <script type="module" src="/js/resume-match.js"></script></main>`;
}

export function scamBody() {
  const report = `mailto:${site.email}?subject=${encodeURIComponent('Suspicious listing on WILSY')}`;
  return `<main id="main-content" class="editorial-shell scam-shell">${toolCrumbs('Job scam check')}
  ${hero('JOB SCAM CHECK', 'Is this job offer real?', 'Paste a job offer, WhatsApp message or email to check it for the warning signs of common job scams. The check runs in your browser; nothing you paste is sent anywhere.')}
  <section class="scam-check" data-scam aria-label="Job scam check">
    <div class="calc-field"><label for="scam-text">The offer, message or listing</label><textarea id="scam-text" rows="9" maxlength="20000" spellcheck="false" placeholder="Paste the whole message, including any email addresses, phone numbers and links."></textarea>
      <div class="resume-keep"><button class="text-button" type="button" data-scam-example>Try an example scam</button><button class="text-button" type="button" data-scam-clear>Clear</button></div></div>
    <div class="scam-result" data-scam-result aria-live="polite"><p class="match-empty">Paste a message to check it.</p></div>
    <noscript><p class="tracker-status">The check needs JavaScript. The warning signs it looks for are listed below.</p></noscript>
  </section>
  <section class="scam-help" aria-labelledby="scam-paid-title"><h2 id="scam-paid-title">Already paid, or shared an OTP?</h2>
    <ol class="scam-steps">
      <li><strong>Call 1930</strong>, the national cyber crime helpline. The sooner you report, the better the chance of stopping the money.</li>
      <li><strong>Report it at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a></strong> with screenshots, phone numbers, UPI IDs and payment receipts.</li>
      <li><strong>Call your bank</strong> to block your card or UPI and dispute the payment. Change any password you shared.</li>
      <li><strong>Report the number</strong> on Chakshu at <a href="https://sancharsaathi.gov.in" target="_blank" rel="noopener noreferrer">sancharsaathi.gov.in</a>, and warn your friends.</li>
    </ol></section>
  <section class="scam-signs" aria-labelledby="scam-signs-title"><h2 id="scam-signs-title">The warning signs it checks for</h2>
    <ul>${SIGNS.map(s => `<li class="is-${s.level === 'high' ? 'high' : 'medium'}"><span class="scam-level">${s.level === 'high' ? 'Strong sign' : 'Warning sign'}</span><h3>${e(s.title)}</h3><p>${e(s.why)}</p></li>`).join('')}</ul></section>
  <p class="quiet-callout">The check looks for patterns seen in common job scams, so treat it as a second opinion, not a verdict: a scam can pass it, and a real job can trip a flag. Real employers never charge a fee to apply, train or join. Seen a suspicious listing on WILSY? <a href="${e(report)}">Report it to us</a>.</p>
  <script type="module" src="/js/scam-check.js"></script></main>`;
}

export function hikeBody() {
  const start = hikeResult({current: 1200000, hike: 20});
  const pf = '<option value="basic">12% of basic</option><option value="capped">12% of ₹15,000 a month (capped)</option><option value="none">No PF</option>';
  const pt = '<option value="2400">₹2,400 (Karnataka, Telangana and others)</option><option value="2500">₹2,500 (Maharashtra and others)</option><option value="0">None (Delhi, Haryana and others)</option>';
  return `<main id="main-content" class="editorial-shell calc-shell hike-shell">${toolCrumbs('Salary hike calculator')}
  ${hero(`SALARY HIKE CALCULATOR · FY ${FY}`, 'What will the hike add in hand?', 'Enter your CTC and the hike, or the new CTC, to see how much more reaches your bank account each month after tax and PF.')}
  <section class="calc" data-hike aria-label="Salary hike calculator">
    <form class="calc-form" data-hike-form novalidate>
      <div class="calc-field calc-field-main"><label for="hike-current">Current CTC (₹ a year)</label><input id="hike-current" name="current" type="number" inputmode="numeric" min="0" max="100000000" step="10000" value="1200000" aria-describedby="hike-current-words"><span id="hike-current-words" class="calc-words">${inWords(1200000)}</span></div>
      <div class="calc-field"><label for="hike-pct">Hike (%)</label><input id="hike-pct" name="hike" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="20"><div class="hike-steps" role="group" aria-label="Common hikes">${HIKE_STEPS.map(n => `<button type="button" data-hike-step="${n}"${n === 20 ? ' aria-pressed="true"' : ' aria-pressed="false"'}>${n}%</button>`).join('')}</div></div>
      <div class="calc-field"><label for="hike-new">New CTC (₹ a year)</label><input id="hike-new" name="offer" type="number" inputmode="numeric" min="0" max="100000000" step="10000" value="${start.next}" aria-describedby="hike-new-words"><span id="hike-new-words" class="calc-words">${inWords(start.next)}</span></div>
      <div class="calc-field"><label for="hike-pf">Provident fund (PF)</label><select id="hike-pf" name="pf">${pf}</select></div>
      <div class="calc-field"><label for="hike-pt">Professional tax (₹ a year)</label><select id="hike-pt" name="pt">${pt}</select></div>
      <div class="calc-field"><label for="hike-target">Hike for a monthly in-hand of (₹, optional)</label><input id="hike-target" name="target" type="number" inputmode="numeric" min="0" max="10000000" step="1000" placeholder="e.g. 100000" aria-describedby="hike-target-out"><span id="hike-target-out" class="calc-words" data-hike-target-out aria-live="polite"></span></div>
    </form>
    <div class="calc-result" data-hike-result aria-live="polite">${hikeTable(start)}</div>
    <div class="offer-tools"><a class="secondary-button" href="/offer-compare">Compare two offers</a><a class="secondary-button" href="/salary-calculator">See the full in-hand breakdown</a></div>
    <p class="quiet-callout">The same estimate as the <a href="/salary-calculator">in-hand calculator</a>: the new tax regime for FY ${FY}, basic pay at 50% of fixed pay, PF on basic and gratuity inside the CTC, with the whole CTC treated as fixed pay. Because tax rises with income, the in-hand hike is usually smaller than the CTC hike. Everything is worked out in your browser.</p>
  </section>
  <script type="module" src="/js/salary-hike.js"></script></main>`;
}

export function gratuityBody({today}) {
  const joined = `${Number(today.slice(0, 4)) - 7}-${today.slice(5, 7)}-01`;
  const start = gratuity({wages: 50000, joined, left: today});
  return `<main id="main-content" class="editorial-shell calc-shell gratuity-shell">${toolCrumbs('Gratuity calculator')}
  ${hero('GRATUITY CALCULATOR', 'How much gratuity will you get?', 'Enter your basic pay and your dates of service to work out the gratuity your employer owes when you leave, under the labour codes.')}
  <section class="calc" data-gratuity aria-label="Gratuity calculator">
    <form class="calc-form" data-gratuity-form novalidate>
      <div class="calc-field calc-field-main"><label for="gr-wages">Monthly basic pay + DA (₹)</label><input id="gr-wages" name="wages" type="number" inputmode="numeric" min="0" max="10000000" step="1000" value="50000" aria-describedby="gr-wages-help"><span id="gr-wages-help" class="calc-words">Your last month’s basic pay and dearness allowance, from your payslip.</span></div>
      <div class="calc-field"><label for="gr-joined">Date you joined</label><input id="gr-joined" name="joined" type="date" value="${joined}" max="${today}"></div>
      <div class="calc-field"><label for="gr-left">Last working day</label><input id="gr-left" name="left" type="date" value="${today}"></div>
      <div class="calc-field"><label for="gr-type">Type of job</label><select id="gr-type" name="type"><option value="permanent">Permanent (five years needed)</option><option value="fixed">Fixed-term contract (one year needed)</option></select></div>
      <div class="calc-field"><label for="gr-total">Total monthly pay (₹, optional)</label><input id="gr-total" name="total" type="number" inputmode="numeric" min="0" max="10000000" step="1000" placeholder="e.g. 120000" aria-describedby="gr-total-help"><span id="gr-total-help" class="calc-words">If basic + DA is under half of it, gratuity is worked out on half.</span></div>
    </form>
    <div class="calc-result" data-gratuity-result aria-live="polite">${gratuityResult(start)}</div>
    <section class="prose gratuity-notes" aria-labelledby="gr-how"><h2 id="gr-how">How gratuity works</h2>
      <p><strong>The formula.</strong> Gratuity is 15 days’ wages for every completed year of service. A month’s wages count as 26 working days, so it is your last monthly basic pay and DA × 15 ÷ 26 × years. A last part-year of more than six months counts as a full year: 7 years and 7 months counts as 8.</p>
      <p><strong>Who qualifies.</strong> Permanent employees after five years of continuous service; on death or disablement, the five-year rule doesn’t apply. Under the Code on Social Security, 2020, in force since 21 November 2025, fixed-term employees qualify after one year. Employers with fewer than ten employees don’t have to pay it, though many do.</p>
      <p><strong>Which pay counts.</strong> Basic pay and dearness allowance. The labour codes define wages so that allowances above half of your total pay count as wages too, so if your basic pay and DA are under half of your pay, gratuity is worked out on half of your pay.</p>
      <p><strong>Limits and tax.</strong> The amount the law requires is capped at ₹20 lakh; an employer can pay more. For private-sector employees, up to ₹20 lakh of gratuity is tax-free over your working life, and anything above it is taxed as salary. Gratuity for government employees is fully tax-free.</p>
    </section>
    <p class="quiet-callout">An estimate for monthly-paid employees; your employer’s gratuity policy and your final settlement are the final word. Check the rules that apply to you with your HR team or a tax adviser. Everything is worked out in your browser. <a href="/salary-calculator">Work out your in-hand pay</a></p>
  </section>
  <script type="module" src="/js/gratuity.js"></script></main>`;
}

export function toolsBody() {
  const groups = [['Apply', 'Apply and keep track'], ['Pay', 'Pay and offers'], ['Research', 'Research the market'], ['Prepare', 'Prepare for interviews'], ['Share', 'Share and follow']];
  return `<main id="main-content" class="editorial-shell tools-shell">${crumbs('Tools')}
  ${hero('FREE CAREER TOOLS', 'Every tool for your job search.', 'Track applications, check an offer for scams, work out your in-hand pay and see what is hiring. All free, and everything you type stays in your browser.')}
  ${groups.map(([key, title]) => `<section class="tools-group" aria-labelledby="tools-${key.toLowerCase()}"><h2 id="tools-${key.toLowerCase()}">${e(title)}</h2><div class="tool-grid">${TOOLS.filter(t => t[4] === key).map(t => toolCard(t)).join('')}</div></section>`).join('')}
  <p class="quiet-callout">The tools work in your browser: what you type into them isn’t sent to WILSY. The tracker, saved jobs and a remembered resume stay on this device. <a href="/privacy">Privacy policy</a></p>
</main>`;
}

const EMBED_FIELDS = [
  ['stage', 'Who it’s for', [['', 'Everyone'], ['internship', 'Internships'], ['fresher', 'Fresher jobs'], ['new-grad', 'New-grad roles']]],
  ['role', 'Role', [['', 'Any role'], ['software-engineering', 'Software engineering'], ['backend', 'Backend'], ['frontend', 'Frontend'], ['ai-ml', 'AI and ML'], ['genai', 'Generative AI'], ['data', 'Data'], ['devops-cloud', 'DevOps and cloud'], ['cybersecurity', 'Cybersecurity'], ['ece-core', 'ECE and core'], ['vlsi', 'VLSI'], ['embedded', 'Embedded']]],
  ['country', 'Country', [['', 'Anywhere'], ['India', 'India'], ['United States', 'United States'], ['United Kingdom', 'United Kingdom']]],
  ['mode', 'Workplace', [['', 'Any'], ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site']]],
  ['limit', 'Jobs to show', [['3', '3'], ['5', '5'], ['8', '8'], ['10', '10']], '5'],
  ['theme', 'Colours', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match the visitor’s setting']]],
];
export const embedSnippet = (origin, attrs = {limit: '5'}) => `<div data-wilsy-jobs${Object.entries(attrs).filter(([, v]) => v).map(([k, v]) => ` data-${k}="${e(v)}"`).join('')}><a href="${origin}/jobs">Jobs on WILSY</a></div>\n<script src="${origin}/embed.js" async></script>`;

export function embedBody() {
  const select = ([name, label, options, chosen = '']) => `<div class="calc-field"><label for="embed-${name}">${e(label)}</label><select id="embed-${name}" name="${name}">${options.map(([v, t]) => `<option value="${e(v)}"${v === chosen ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></div>`;
  return `<main id="main-content" class="editorial-shell embed-shell">${toolCrumbs('Jobs widget')}
  ${hero('JOBS WIDGET', 'Put live jobs on your website.', 'A free, always up-to-date list of the newest jobs for your college, placement cell, club or community site. Pick the jobs, copy two lines of code, done.')}
  <section class="embed-builder" data-embed aria-label="Jobs widget builder">
    <form class="calc-form embed-form" data-embed-form novalidate>
      <div class="calc-field"><label for="embed-q">Search words (optional)</label><input id="embed-q" name="q" maxlength="80" autocomplete="off" placeholder="e.g. python, data analyst"></div>
      ${EMBED_FIELDS.map(select).join('')}
      <div class="calc-field"><label for="embed-title">Heading</label><input id="embed-title" name="title" maxlength="40" autocomplete="off" placeholder="Latest jobs"></div>
    </form>
    <div class="embed-preview"><p class="eyebrow">PREVIEW</p><div data-embed-preview>${embedSnippet('', {limit: '5'}).split('\n')[0]}</div></div>
    <div class="embed-code-box"><p class="eyebrow">YOUR CODE</p><pre class="embed-code"><code data-embed-code>${e(embedSnippet(site.origin))}</code></pre><button class="primary-button" type="button" data-embed-copy>Copy the code</button><p class="offer-status" data-embed-status role="status" aria-live="polite"></p></div>
  </section>
  <section class="prose embed-notes" aria-labelledby="embed-how"><h2 id="embed-how">How it works</h2>
    <p>Paste the code where the jobs should appear: in the HTML of your page, or in a “Custom HTML” or “Embed code” block in WordPress, Google Sites or Wix. The list loads WILSY’s public job search each time the page opens, so it is always current.</p>
    <p>Each job links to its WILSY page, which links to the employer’s own application. The widget sets no cookies, shows no ads and collects nothing about your visitors. If it can’t load, the plain “Jobs on WILSY” link shows instead.</p>
    <p>Using it on a campus site? Tell us at <a href="mailto:${site.email}?subject=${encodeURIComponent('WILSY jobs widget')}">${site.email}</a> and see the <a href="/campus">campus ambassador programme</a>.</p>
  </section>
  <script src="/embed.js" defer></script><script type="module" src="/js/embed-builder.js"></script></main>`;
}

/** Job pages: write a referral request to someone at the company. features.js rebuilds it as you type. */
export function referralBox(job, url) {
  const people = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(job.company);
  return `<details class="ask-referral" id="ask-referral" data-referral="${e(JSON.stringify({title: job.title, company: job.company, url}))}"><summary>${icon('message')} Ask someone at ${e(job.company)} for a referral</summary>
  <div class="referral-body"><p>A referral can get your application read sooner. Find people who work there on <a href="${e(people)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>, then send a short, polite note.</p>
    <div class="referral-fields"><div class="calc-field"><label for="referral-me">Your name</label><input id="referral-me" name="me" autocomplete="name" maxlength="60"></div><div class="calc-field"><label for="referral-about">About you, in a few words</label><input id="referral-about" name="about" maxlength="120" placeholder="final-year CSE student at VIT"></div></div>
    <fieldset class="referral-kind"><legend>Message</legend><label><input type="radio" name="referral-kind" value="note" checked> LinkedIn note (300 characters)</label><label><input type="radio" name="referral-kind" value="message"> Full message</label></fieldset>
    <label class="sr-only" for="referral-text">Your message</label><textarea id="referral-text" rows="7" data-referral-text>${e(referralMessage({title: job.title, company: job.company, url}))}</textarea>
    <div class="referral-actions"><span class="salary-note" data-referral-count aria-live="polite"></span><button class="secondary-button" type="button" data-referral-copy>Copy message</button></div>
    <p class="salary-note">Replace [Name] with the person’s name before sending. What you type stays in this browser.</p></div></details>`;
}

/** The quick-search index: t title, u url, d description, k keywords, g group (page, company or guide). */
export function searchIndex({companies, guides = [], landing = [], curated = [], skills = []}) {
  const pages = [
    ['Find jobs', '/jobs', 'Search every live role', 'search work openings vacancies'],
    ['Application tracker', '/tracker', 'Saved → Applied → Interviewing → Offer', 'applications board kanban status'],
    ['Saved jobs', '/jobs?saved=1', 'Roles you saved', 'bookmarks shortlist'],
    ['Salary explorer', '/salaries', 'Pay at 1,000 companies, in INR', 'salary pay compensation ctc compare'],
    ['In-hand salary calculator', '/salary-calculator', 'CTC to monthly take-home', 'take home in hand ctc tax calculator monthly'],
    ['Compare job offers', '/offer-compare', 'Which offer pays more in hand', 'offer compare ctc joining bonus esop which offer'],
    ['Resume match', '/resume-match', 'Check your resume against a job', 'resume cv ats keywords skills match check'],
    ['Hiring trends', '/hiring-trends', 'What is hiring right now, from live jobs', 'trends market skills in demand hiring report statistics'],
    ['RSS feed of new jobs', '/feed.xml', 'Follow new jobs in a feed reader', 'rss feed subscribe telegram'],
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
    ['All career tools', '/tools', 'Every free tool in one place', 'tools calculators utilities'],
    ['Job scam check', '/scam-check', 'Is this job offer real?', 'scam fraud fake job offer whatsapp telegram task registration fee check'],
    ['Salary hike calculator', '/salary-hike-calculator', 'What a raise adds in hand', 'hike raise increment appraisal percentage ctc'],
    ['Gratuity calculator', '/gratuity-calculator', 'Gratuity under the labour codes', 'gratuity labour code resign leaving final settlement'],
    ['Skills in demand', '/skills', 'Live jobs for each skill', 'skills technologies demand python java sql'],
    ['Jobs widget for your website', '/embed', 'Live jobs on a college or club site', 'embed widget college website placement cell'],
    ['Add an application', '/tracker?add=1', 'Track a job from any other site', 'add application linkedin naukri track'],
  ].map(([t, u, d, k]) => ({t, u, d, k, g: 'page'}));
  return [
    ...pages,
    ...skills.map(([name, slug, n]) => ({t: `${name} jobs`, u: '/skills/' + slug, d: `${n.toLocaleString('en-IN')} live jobs`, k: 'skill jobs', g: 'page'})),
    ...landing.map(([u, t]) => ({t, u, d: 'Live roles', k: 'jobs', g: 'page'})),
    ...companies.map(c => ({t: c.name, u: '/companies/' + c.id, d: c.sector, k: [c.sector, ...(c.tags || [])].join(' '), g: 'company'})),
    ...guides.map(g => ({t: g.title, u: '/guides/' + g.slug, d: g.category, k: 'guide', g: 'guide'})),
    ...curated.map(([t, u, d]) => ({t, u, d, k: 'programme', g: 'guide'})),
  ];
}
