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
import {noticePlan, noticeResult, NOTICE_PRESETS} from '../js/notice-core.js';
import {LETTERS, LETTER_FIELDS, LETTER_GROUPS, letterText, fieldLabel, mailtoLink} from '../js/letters-core.js';
import {emptyDraft, resumeHtml, checksHtml, mainFieldHtml, entryForm} from '../js/resume-builder-core.js';
import {DEADLINE_KINDS, upcoming, deadlineList, kindCounts} from '../js/deadlines-core.js';
import {CATEGORIES, PWBD_YEARS, MAX_OTHER_YEARS, AGE_BANDS, agePlan, ageResult} from '../js/age-core.js';
import {DURATIONS, PASSAGES, words, testText} from '../js/typing-core.js';
import {LEAVE_BASES, settlement, settlementResult} from '../js/settlement-core.js';
import {QUESTIONS, IA_GROUPS, shortName, questionForm, answerChecks, checksList, exampleText} from '../js/interview-core.js';
import {DA_RATE, DA_SINCE, LEVELS, X_CITIES, TA_CITIES, POSTS, govPay, govPayResult, cellLabel} from '../js/govpay-core.js';
import {EPF_RATE, RATE_YEAR, WAGE_CEILING, CEILING_SINCE, epfPlan, epfResult} from '../js/epf-core.js';
import {FORMULAS, SEMESTERS, cgpaPlan, cgpaResult} from '../js/cgpa-core.js';
import {experience, experienceResult, jobRow} from '../js/experience-core.js';
import {rupees} from '../js/take-home-core.js';
import {site} from '../js/site-config.js';

// Page bodies for the career tools (tracker, salary explorer, calculators, offer comparison, resume match,
// scam check, tools hub and jobs widget), plus the share bar used on job pages and the quick-search index.
// Shared by the static build.

const crumbs = (label, mid) => `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>${mid ? `<a href="${mid[0]}">${e(mid[1])}</a><span>/</span>` : ''}<span aria-current="page">${e(label)}</span></nav>`;
const toolCrumbs = label => crumbs(label, ['/tools', 'Tools']);

/** Every career tool: [url, icon, name, what it does, group]. The tools hub and the homepage list them. */
export const TOOLS = [
  ['/my-wilsy', 'sparkle', 'My WILSY', 'Your best job matches, the jobs you qualify for, skills to learn next and a free 30-day plan.', 'Apply'],
  ['/tracker', 'kanban', 'Application tracker', 'Saved → Applied → Interviewing → Offer, with interview reminders. Add jobs from any site.', 'Apply'],
  ['/resume-builder', 'pen', 'Resume builder', 'Write a clean one-page resume and save it as a PDF. Nothing is uploaded.', 'Apply'],
  ['/resume-match', 'file', 'Resume match and job fit', 'Your fit for a job, part by part: skills, experience, level, education, and whether you can apply at all.', 'Apply'],
  ['/copy-check', 'search', 'Copy check', 'Does your resume or cover letter copy the job posting? See the copied lines and fix them.', 'Apply'],
  ['/deadlines', 'calendar', 'Deadlines calendar', 'Last dates for hackathons, competitions, scholarships and exams, soonest first.', 'Apply'],
  ['/scam-check', 'shield', 'Job scam check', 'Paste an offer or a WhatsApp message to check it for the signs of a job scam.', 'Apply'],
  ['/age-calculator', 'cake', 'Age calculator for government jobs', 'Your age on a notice’s cut-off date, the birth dates that qualify and your relaxation.', 'Apply'],
  ['/cgpa-calculator', 'graduation', 'CGPA to percentage calculator', 'CGPA to percentage, CGPA from your semesters and the SGPA you need.', 'Apply'],
  ['/experience-calculator', 'briefcase', 'Work experience calculator', 'Your total experience in years and months, with overlaps and gaps.', 'Apply'],
  ['/salary-calculator', 'calculator', 'In-hand salary calculator', 'From CTC to monthly take-home under the new tax regime.', 'Pay'],
  ['/government-salary-calculator', 'government', 'Government salary calculator', 'In-hand pay for central government posts: basic pay, DA, HRA, NPS and tax.', 'Pay'],
  ['/offer-compare', 'scale', 'Compare job offers', 'Two or three offers side by side: in hand, first-year cash and equity.', 'Pay'],
  ['/salary-hike-calculator', 'trending', 'Salary hike calculator', 'What a raise really adds to your monthly pay, and the hike you need.', 'Pay'],
  ['/epf-calculator', 'piggy', 'EPF calculator', 'Your PF balance at retirement, with your employer’s share and 8.25% interest.', 'Pay'],
  ['/notice-period-calculator', 'logout', 'Notice period calculator', 'Your last working day, an early release and what a buyout costs.', 'Switch'],
  ['/career-letters', 'mail', 'Resignation and offer letters', 'Resignation, offer acceptance, negotiation and follow-up emails, ready to copy.', 'Switch'],
  ['/gratuity-calculator', 'wallet', 'Gratuity calculator', 'What you get when you leave, under the labour codes.', 'Switch'],
  ['/full-and-final-settlement', 'receipt', 'Full and final settlement', 'Salary, leave, gratuity and recoveries when you leave, and when they are due.', 'Switch'],
  ['/salaries', 'rupee', 'Salary explorer', 'Published pay at 1,000 companies, as INR estimates.', 'Research'],
  ['/hiring-trends', 'chart', 'Hiring trends', 'What is hiring right now, counted from live jobs.', 'Research'],
  ['/skills', 'sparkle', 'Skills in demand', 'Live jobs and the employers hiring for each skill.', 'Research'],
  ['/interview-answers', 'mic', 'Interview answer builder', 'Answers to the 15 questions most interviews ask, with examples and a practice timer.', 'Prepare'],
  ['/dsa', 'code', 'DSA roadmap', 'Interview patterns with practice links and saved progress.', 'Prepare'],
  ['/typing-test', 'keyboard', 'Typing speed test', 'Words a minute and accuracy, against the speeds SSC typing tests ask for.', 'Prepare'],
  ['/embed', 'link', 'Jobs widget', 'Live jobs for your college, club or community website.', 'Share'],
  ['/feed.xml', 'rss', 'New jobs RSS feed', 'Follow new jobs in any feed reader.', 'Share'],
];
// Text-first cards: the icon name stays in the data, but no icon tile is drawn.
export const toolCard = ([url, , name, text], tag = 'h3') => `<a class="tool-card" href="${url}"><${tag}>${e(name)}</${tag}><p>${e(text)}</p><span class="tool-card-go" aria-hidden="true">${icon('arrow')}</span></a>`;
const hero = (eyebrow, title, text) => `<div class="editorial-hero"><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p>${e(text)}</p></div>`;

/** Share a page: WhatsApp (a plain link, works without scripts), copy link, and the phone's share sheet. */
export function shareBar(url, text, {label = 'Share this role'} = {}) {
  const shared = url + (url.includes('?') ? '&' : '?') + 'utm_source=whatsapp&utm_medium=share';
  return `<div class="share-bar" role="group" aria-label="${e(label)}"><a class="share-button share-whatsapp" data-share-whatsapp href="${e(whatsappUrl(text, shared))}" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span></a><button class="share-button" type="button" data-share-copy="${e(url)}"><span data-label>Copy link</span></button><button class="share-button" type="button" data-share-native="${e(url)}" data-share-title="${e(text)}" hidden><span>Share</span></button></div>`;
}

// Pressed on any job page, the bookmarklet opens the tracker's "Add an application" form, filled in.
export const bookmarklet = origin => `javascript:(function(){var u='${origin}/tracker?add=1&title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href);window.open(u,'_blank')||(location.href=u)})()`;

export function trackerBody({fx}) {
  const stages = STAGES.map(([id, name]) => `<option value="${id}"${id === 'applied' ? ' selected' : ''}>${name}</option>`).join('');
  return `<main id="main-content" class="editorial-shell tracker-shell">${toolCrumbs('Application tracker')}
  ${hero('YOUR APPLICATIONS', 'Track every application.', 'Saved roles land here, and you can add jobs from any other site. Move them from Saved to Applied, Interviewing and Offer, set interview reminders and keep notes.')}
  <section class="tracker" data-tracker aria-label="Application board">
    <div class="tracker-top"><p class="tracker-summary" data-tracker-summary tabindex="-1">Loading your board…</p>
      <div class="tracker-tools"><button class="primary-button" type="button" data-add-open>Add an application</button><a class="secondary-button" href="/jobs">Find roles to save</a><button class="secondary-button" type="button" data-export disabled>Download spreadsheet</button></div></div>
    <p class="tracker-status" data-tracker-status role="status" aria-live="polite"></p>
    <section class="tracker-upcoming" data-upcoming aria-labelledby="upcoming-title" hidden><h2 id="upcoming-title">Coming up</h2><ol></ol></section>
    <section class="tracker-insights" data-insights aria-labelledby="insights-title" hidden><h2 id="insights-title">How your search is going</h2>
      <dl class="tracker-funnel" data-funnel></dl>
      <div class="tracker-closed" data-closed hidden><h3>Where closed roles stopped</h3><ul></ul><div data-closed-tip></div></div><div class="tracker-followups" data-followups hidden><h3>Time to follow up</h3><p>Applied a week or more ago, with no reply booked. A short, polite note to the recruiter often gets an answer.</p><ol></ol></div>
    </section>
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
      <p class="salary-note tracker-add-tip">Faster: on a phone, share a job from LinkedIn, Naukri or your browser to the installed WILSY app and it opens here, filled in. On a computer, drag this button to your bookmarks bar, then press it on any job page: <a class="bookmarklet" href="${e(bookmarklet(site.origin))}" data-bookmarklet>Add to WILSY</a></p>
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
      <div class="calc-field"><label for="calc-pf">Provident fund (PF)</label><select id="calc-pf" name="pf"><option value="basic">12% of basic</option><option value="capped">12% of ₹25,000 a month (the wage ceiling)</option><option value="none">No PF</option></select></div>
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
    <div class="offer-tools"><button class="secondary-button" type="button" data-offer-copy>Copy a link to this comparison</button><a class="secondary-button" href="/salary-calculator">See the full in-hand breakdown</a></div>
    <p class="offer-status" data-offer-status role="status" aria-live="polite"></p>
    <p class="quiet-callout">The same estimate as the <a href="/salary-calculator">in-hand calculator</a>: the new tax regime for FY ${FY}, basic pay at 50% of fixed pay, PF at 12% of basic and gratuity inside the CTC. Variable pay counts as if paid in full. Equity is shown as stated and never added to cash. Everything is worked out in your browser; a copied link carries only what you typed.</p>
  </section>
  <script type="module" src="/js/offer-compare.js"></script></main>`;
}

export function resumeBody() {
  return `<main id="main-content" class="editorial-shell resume-shell">${toolCrumbs('Resume match')}
  ${hero('RESUME MATCH', 'Find the jobs your resume fits', 'Upload your resume to see live jobs ranked from your highest chance of a match to your lowest, or check it against one job description.')}
  <section class="resume-match" data-resume aria-label="Resume match checker">
    <div class="resume-upload"><div><h2>Upload your resume</h2><p>PDF, Word (.docx) or a text file, up to 5 MB. It is read in your browser and never uploaded or sent to WILSY.</p></div>
      <label class="primary-button resume-upload-button" for="resume-file">Choose a file</label><input id="resume-file" class="sr-only" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
      <p class="resume-upload-status" data-resume-file-status role="status"></p></div>
    <section class="resume-jobs" aria-labelledby="resume-jobs-title"><div class="resume-jobs-head"><div><p class="eyebrow">JOBS FOR YOUR RESUME</p><h2 id="resume-jobs-title">Live jobs, highest chance first</h2></div>
      <div class="resume-jobs-controls"><div class="calc-field"><label for="resume-years">Years of work experience</label><input id="resume-years" type="number" inputmode="decimal" min="0" max="40" step="0.5" placeholder="From your resume"></div>
      <button class="primary-button" type="button" data-resume-jobs>Find matching jobs</button></div></div>
      <div data-resume-jobs-list aria-live="polite"><p class="match-empty">Upload or paste your resume, then find matching jobs.</p></div>
      <p class="salary-note">The chance is an estimate: the share of each job’s listed skills your resume shows (a related skill counts half), lowered when the job asks for more years than your resume shows. It can’t see everything an employer weighs, so read each job before you apply.</p></section>
    <h2 class="resume-one-job">Job fit check: one job</h2>
    <p class="resume-one-job-lead">See whether you can apply at all (citizenship, visas, languages), then your fit for skills, experience, level and education, and the skills you are missing.</p>
    <p class="resume-job" data-resume-job role="status" hidden></p>
    <div class="resume-inputs">
      <div class="calc-field"><label for="resume-text">Your resume (uploaded, or paste the text)</label><textarea id="resume-text" rows="12" maxlength="30000" spellcheck="false" placeholder="Open your resume, select all, copy, and paste it here."></textarea>
        <div class="resume-keep"><label class="calc-check"><input type="checkbox" id="resume-remember"> Remember my resume on this device</label><button class="text-button" type="button" data-resume-clear>Clear</button></div></div>
      <div class="calc-field"><label for="job-text">Job description</label><textarea id="job-text" rows="12" maxlength="30000" spellcheck="false" placeholder="Paste the job description, including the requirements."></textarea></div>
    </div>
    <div class="resume-result" data-resume-result aria-live="polite"><p class="match-empty">Paste your resume and a job description to see the match.</p></div>
    <noscript><p class="tracker-status">The resume check needs JavaScript.</p></noscript>
    <p class="quiet-callout">The check runs in your browser. Your resume, uploaded or pasted, is never sent to WILSY, and it is kept on this device only if you tick “Remember”. To find matching jobs, WILSY searches live jobs by the skill names found in it, never the resume itself. It looks for ${SKILLS.length} common skills and tools, so treat it as a quick check, not a verdict. <a href="/jobs">Find a job to check against</a></p>
  </section>
  <script type="module" src="/js/resume-match.js"></script></main>`;
}

export function copyBody() {
  return `<main id="main-content" class="editorial-shell copy-shell">${toolCrumbs('Copy check')}
  ${hero('COPY CHECK', 'Did you copy the job posting?', 'Recruiters notice when a resume or cover letter hands their own sentences back. Paste the posting and your text to see the copied lines, and the posting’s informal words you picked up.')}
  <section class="copy-check" data-copy aria-label="Copy check">
    <p class="resume-job" data-copy-job role="status" hidden></p>
    <div class="resume-inputs">
      <div class="calc-field"><label for="copy-posting">The job posting</label><textarea id="copy-posting" rows="12" maxlength="30000" spellcheck="false" placeholder="Paste the whole job posting."></textarea></div>
      <div class="calc-field"><label for="copy-text">Your resume, cover letter or answer</label><textarea id="copy-text" rows="12" maxlength="30000" placeholder="Paste what you wrote for this job."></textarea></div>
    </div>
    <div class="copy-result" data-copy-result aria-live="polite"><p class="match-empty">Paste the job posting and your text to check them.</p></div>
    <noscript><p class="tracker-status">The copy check needs JavaScript.</p></noscript>
  </section>
  <section class="copy-rules" aria-labelledby="copy-rules-title"><h2 id="copy-rules-title">What it checks</h2>
    <ul>
      <li><strong>Copied lines.</strong> Any run of 5 or more words taken in order from the posting. Rewrite it from what you actually did: which project, which result. Words in “quotation marks” don’t count, so you can still quote the posting openly.</li>
      <li><strong>The posting’s voice words.</strong> Informal or company words such as “messy”, “ship fast” or “rockstar”. Would you use the word when talking about your own work in an interview? If not, say it plainly.</li>
      <li><strong>Keywords, kept exactly.</strong> Tools, skills and the job title should match the posting word for word, because applicant tracking systems often search for them literally. The check lists the ones you kept and the ones you didn’t mention.</li>
    </ul></section>
  <p class="quiet-callout">The check runs in your browser; nothing you paste is sent to WILSY or kept. Rules adapted from the “echo traps” guide of the open-source <a href="https://github.com/ai-job-search-dev/ai-job-search" target="_blank" rel="noopener noreferrer">ai-job-search</a> project (MIT licence). To check your skills against the job, use <a href="/resume-match">resume match</a>.</p>
  <script type="module" src="/js/copy-check.js"></script></main>`;
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
  const pf = '<option value="basic">12% of basic</option><option value="capped">12% of ₹25,000 a month (the wage ceiling)</option><option value="none">No PF</option>';
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

export function noticeBody({today}) {
  const start = noticePlan({resigned: today, amount: 60, unit: 'days'});
  const unitName = (n, unit) => unit === 'days' ? `${n} days` : `${n} month${n === 1 ? '' : 's'}`;
  const presets = NOTICE_PRESETS.map(([n, unit]) => `<button type="button" data-notice-preset data-amount="${n}" data-unit="${unit}" aria-pressed="${n === 60 && unit === 'days'}">${unitName(n, unit)}</button>`).join('');
  return `<main id="main-content" class="editorial-shell calc-shell notice-shell">${toolCrumbs('Notice period calculator')}
  ${hero('NOTICE PERIOD CALCULATOR', 'When is your last working day?', 'Enter the day you resign and your notice period to see your last working day, how early you need to be released to join your new job on time, and what buying out the rest costs.')}
  <section class="calc" data-notice aria-label="Notice period calculator">
    <form class="calc-form" data-notice-form novalidate>
      <div class="calc-field calc-field-main"><label for="np-resigned">Date you resign</label><input id="np-resigned" name="resigned" type="date" value="${today}" required></div>
      <div class="calc-field"><label for="np-amount">Notice period</label><div class="notice-amount"><input id="np-amount" name="amount" type="number" inputmode="numeric" min="1" max="365" step="1" value="60" required><select name="unit" aria-label="Days or months"><option value="days" selected>days</option><option value="months">months</option></select></div>
        <div class="hike-steps notice-steps" role="group" aria-label="Common notice periods">${presets}</div></div>
      <div class="calc-field"><label for="np-waived">Days waived or set off (optional)</label><input id="np-waived" name="waived" type="number" inputmode="numeric" min="0" max="365" step="1" placeholder="0" aria-describedby="np-waived-help"><span id="np-waived-help" class="calc-words">Days your manager agrees to waive, or saved leave set off against the notice.</span></div>
      <div class="calc-field"><label for="np-joining">New job’s joining date (optional)</label><input id="np-joining" name="joining" type="date" aria-describedby="np-joining-help"><span id="np-joining-help" class="calc-words">To see how early you need to be released.</span></div>
      <div class="calc-field"><label for="np-monthly">Monthly pay for a buyout (₹, optional)</label><input id="np-monthly" name="monthly" type="number" inputmode="numeric" min="0" max="10000000" step="1000" placeholder="e.g. 50000" aria-describedby="np-monthly-help"><span id="np-monthly-help" class="calc-words">Usually basic or gross monthly pay; your contract says which.</span></div>
    </form>
    <div class="calc-result" data-notice-result aria-live="polite">${noticeResult(start, {today})}</div>
    <section class="prose notice-notes" aria-labelledby="np-how"><h2 id="np-how">How the dates are counted</h2>
      <p><strong>The notice period.</strong> Most employers count the notice from the day you resign, so a 60-day notice given on 1 March ends on 29 April. A notice in months ends the day before the same date: one month from 15 January ends on 14 February, and one month from 31 January ends on the last day of February. Some employers start counting the next day, so the calculator shows that date too. Your appointment letter or HR policy decides which applies.</p>
      <p><strong>Early release and buyout.</strong> If your new job starts before your notice ends, ask your manager to release you early. Many employers agree once your work is handed over, or let you pay for the days you don’t serve, usually your monthly pay ÷ 30 for each day. Some new employers pay the buyout for you, so ask them. Saved leave can sometimes be set off against the notice, if your policy allows it.</p>
      <p><strong>Your final pay.</strong> Under section 17(2) of the Code on Wages, 2019, in force since 21 November 2025, wages due must be paid within two working days of leaving, whether you resign or are removed, dismissed or retrenched. Other parts of a full and final settlement, such as gratuity, have their own timelines, and employers read the rule in different ways, so ask HR for the settlement date in writing.</p>
      <p><strong>Get it in writing.</strong> Resign by email so the date is on record, keep the reply that accepts it, and ask for your relieving and experience letters on your last day.</p>
    </section>
    <p class="quiet-callout">Your contract and your employer’s policy decide the notice period and how it is counted; this calculator follows the most common practice. Everything is worked out in your browser. <a href="/gratuity-calculator">Work out your gratuity</a> or <a href="/salary-hike-calculator">what the new job adds in hand</a>.</p>
  </section>
  <script type="module" src="/js/notice-period.js"></script></main>`;
}

export function lettersBody() {
  const first = LETTERS[0], start = letterText(first.id);
  const field = key => {
    const f = LETTER_FIELDS[key], id = 'lt-' + key;
    const input = f.type === 'date' ? `<input id="${id}" name="${key}" type="date">`
      : `<input id="${id}" name="${key}" maxlength="${f.max}" autocomplete="${f.autocomplete || 'off'}"${f.placeholder ? ` placeholder="${e(f.placeholder)}"` : ''}>`;
    return `<div class="calc-field" data-letter-field="${key}"${first.fields.includes(key) ? '' : ' hidden'}><label for="${id}">${e(fieldLabel(first, key))}</label>${input}</div>`;
  };
  const picker = LETTER_GROUPS.map(group => `<fieldset class="letter-group"><legend>${e(group)}</legend><div class="letter-chips">${LETTERS.filter(l => l.group === group).map(l => `<label class="letter-chip"><input type="radio" name="letter" value="${l.id}"${l === first ? ' checked' : ''}><span>${e(l.name)}</span></label>`).join('')}</div></fieldset>`).join('');
  return `<main id="main-content" class="editorial-shell letters-shell">${toolCrumbs('Resignation and offer letters')}
  ${hero('LETTERS AND EMAILS', 'Resignation and offer letters, ready to send.', `Pick one of ${LETTERS.length} letters, add a few details, then copy it, open it in your email app or save it as a PDF. Resigning, asking for an early release, answering an offer and following up.`)}
  <section class="letters" data-letters aria-label="Letter writer">
    <form class="letters-form" data-letters-form novalidate>
      <div class="letter-pick">${picker}</div>
      <div class="letter-grid">
        <div class="letter-fields"><h2 class="letter-step">Your details</h2>${Object.keys(LETTER_FIELDS).map(field).join('')}<p class="calc-words">Leave anything blank to keep a [placeholder] you can fill in later.</p></div>
        <div class="letter-preview"><h2 class="letter-step" data-letter-name>${e(first.name)}</h2>
          <div class="calc-field"><label for="lt-subject">Subject</label><input id="lt-subject" name="subject" value="${e(start.subject)}" autocomplete="off" data-letter-subject></div>
          <div class="calc-field"><label for="lt-body">Letter</label><textarea id="lt-body" name="body" rows="18" data-letter-body>${e(start.body)}</textarea></div>
          <p class="letter-edited" data-letter-edited hidden>You edited the letter, so changing your details no longer updates it. <button class="text-button" type="button" data-letter-reset>Start again from the template</button></p>
          <div class="letter-actions"><button class="primary-button" type="button" data-letter-copy="body">Copy letter</button><button class="secondary-button" type="button" data-letter-copy="subject">Copy subject</button><a class="secondary-button" data-letter-mail href="${e(mailtoLink(start))}">Open in email</a><button class="secondary-button" type="button" data-letter-print>Print or PDF</button></div>
          <p class="offer-status" data-letter-status role="status" aria-live="polite"></p>
        </div>
      </div>
    </form>
    <noscript><p class="tracker-status">Without JavaScript the letter can’t fill itself in, but you can copy it above and fill in the [placeholders] by hand.</p></noscript>
  </section>
  <section class="prose letters-notes" aria-labelledby="lt-tips"><h2 id="lt-tips">Before you send it</h2>
    <p><strong>Resigning.</strong> Tell your manager on a call or in person first, then send the letter by email so the date is on record. Keep it short and polite: you will need their help with your relieving letter and references. <a href="/notice-period-calculator">Work out your last working day</a>.</p>
    <p><strong>Answering an offer.</strong> Accept in writing once you have the offer letter, after reading the notice period, probation and any joining-bonus clawback. To negotiate, ask once, give one clear figure with a reason, and stay friendly. <a href="/offer-compare">Compare your offers</a>.</p>
    <p><strong>Following up.</strong> Wait about a week after applying before you follow up, and follow up once or twice at most. Send a thank-you note on the day of the interview.</p>
  </section>
  <p class="quiet-callout">Letters are written in your browser and nothing you type is sent to WILSY. Your details stay in this tab until you close it. Read the letter before you send it, and change anything that doesn’t sound like you.</p>
  <div class="letter-print" data-letter-print-copy></div>
  <script type="module" src="/js/career-letters.js"></script></main>`;
}

export function resumeBuilderBody() {
  const draft = emptyDraft(), main = key => mainFieldHtml(key, draft[key]);
  const list = (name, legend, add) => `<fieldset class="rb-part"><legend>${e(legend)}</legend><div class="rb-entries" data-rb-entries="${name}">${draft[name].map((entry, i) => entryForm(name, entry, i)).join('')}</div><button type="button" class="secondary-button rb-add" data-rb-add="${name}">${e(add)}</button></fieldset>`;
  return `<main id="main-content" class="editorial-shell rb-shell">${toolCrumbs('Resume builder')}
  ${hero('RESUME BUILDER', 'Build a clean, one-page resume.', 'Fill in your details and watch your resume take shape, then save it as a PDF, copy it as text or check it against a job. Free, with no sign-up, and nothing is uploaded.')}
  <section class="rb" data-rb aria-label="Resume builder">
    <form class="rb-form" data-rb-form novalidate>
      <div class="rb-bar"><a class="text-button rb-jump" href="#rb-preview">See the preview</a><button type="button" class="text-button" data-rb-example>Fill in an example</button><button type="button" class="text-button" data-rb-clear>Clear everything</button><label class="rb-keep"><input type="checkbox" data-rb-keep checked> Save on this device</label></div>
      <fieldset class="rb-part"><legend>About you</legend><div class="rb-pair">${main('name')}${main('headline')}</div><div class="rb-pair">${main('email')}${main('phone')}</div><div class="rb-pair">${main('location')}${main('links')}</div>${main('summary')}</fieldset>
      <fieldset class="rb-part"><legend>Skills</legend>${main('skills')}</fieldset>
      ${list('experience', 'Experience and internships', 'Add a job or internship')}
      ${list('projects', 'Projects', 'Add a project')}
      ${list('education', 'Education', 'Add education')}
      <fieldset class="rb-part"><legend>Achievements</legend>${main('achievements')}<label class="rb-option"><input type="checkbox" data-rb-key="educationFirst"> Put education before experience (best for students and freshers)</label></fieldset>
    </form>
    <div class="rb-side">
      <div class="rb-side-head"><h2 id="rb-preview">Preview <span class="rb-pages" data-rb-pages aria-live="polite"></span></h2>
        <div class="rb-actions"><button class="primary-button" type="button" data-rb-pdf>Download PDF</button><button class="secondary-button" type="button" data-rb-copy>Copy as text</button><button class="secondary-button" type="button" data-rb-match>Check against a job</button></div>
        <p class="calc-words">For a PDF, choose “Save as PDF” as the printer.</p><p class="offer-status" data-rb-status role="status" aria-live="polite"></p></div>
      <div class="rb-paper" data-rb-preview>${resumeHtml(draft)}</div>
      <div class="rb-checks"><h3>Checks</h3><div data-rb-checks aria-live="polite">${checksHtml([])}</div></div>
    </div>
    <noscript><p class="tracker-status">The resume builder needs JavaScript.</p></noscript>
  </section>
  <section class="prose rb-notes" aria-labelledby="rb-tips"><h2 id="rb-tips">What recruiters look for</h2>
    <p><strong>One page that is easy to scan.</strong> A first read takes seconds, so put what matters most at the top: your experience if you have some, or your education and projects if you are a student.</p>
    <p><strong>Results, not duties.</strong> “Cut page load time from 4 s to 1.5 s” says more than “Responsible for performance”. Start each point with what you did, and add a number where you can.</p>
    <p><strong>The job’s own words.</strong> Many employers screen resumes with software that searches for skills, so name the tools from the job description that you really know. <a href="/resume-match">Check your resume against a job</a>.</p>
    <p><strong>What to leave out.</strong> A photo, date of birth, marital status and a declaration take space from your work, and most private employers don’t ask for them. Follow the instructions when an application, such as a government one, does ask.</p>
  </section>
  <p class="quiet-callout">Your resume is built in your browser and never uploaded. With “Save on this device” ticked, the draft stays in this browser so you can come back to it; untick it on a shared computer. <a href="/career-letters">Write a cover email or a follow-up</a></p>
  <div class="resume-print" data-rb-print></div>
  <script type="module" src="/js/resume-builder.js"></script></main>`;
}

/** items: the reviewed deadlines (government notices, scholarships, research internships); the rest load live. */
export function deadlinesBody({items, now = Date.now()}) {
  const open = upcoming(items, now), counts = kindCounts(open);
  const chip = (kind, label, n) => `<button type="button" data-dl-type="${kind}" aria-pressed="${kind === ''}">${e(label)} <span>${n}</span></button>`;
  const json = JSON.stringify(open).replace(/</g, '\\u003c');
  return `<main id="main-content" class="editorial-shell dl-shell">${toolCrumbs('Deadlines calendar')}
  ${hero('DEADLINES CALENDAR', 'Every last date, in one place.', 'Hackathons, competitions, government jobs, scholarships and research internships, soonest first. Add a deadline to your calendar so you don’t miss it.')}
  <section class="dl" data-deadlines aria-label="Upcoming deadlines">
    <div class="dl-filters" role="group" aria-label="Show deadlines for">${chip('', 'All', open.length)}${DEADLINE_KINDS.map(([kind, label]) => chip(kind, label, counts[kind])).join('')}</div>
    <p class="dl-status" data-dl-status role="status" aria-live="polite"></p>
    <div class="dl-results" data-dl-list>${deadlineList(open, {now})}</div>
    <script type="application/json" id="deadline-data">${json}</script>
  </section>
  <section class="prose dl-notes" aria-labelledby="dl-how"><h2 id="dl-how">How the dates work</h2>
    <p>Each date is the last day to register or apply, from the listing or its official page. A date without a time closes at the end of that day, India time. Hackathons and competitions load live from WILSY’s verified collection, soonest first; government notices, scholarships and research internships come from WILSY’s reviewed lists, which link to each official page.</p>
    <p>Organisers sometimes extend or move a deadline, so confirm it on the official page before you apply, and apply a few days early: sites slow down on the last day.</p>
  </section>
  <p class="quiet-callout">Looking for something with no fixed date? See <a href="/open-source-programs">open-source programs</a>, <a href="/contests">coding contests</a> and <a href="/jobs">jobs</a>, or keep your applications in the <a href="/tracker">tracker</a>.</p>
  <script type="module" src="/js/deadlines.js"></script></main>`;
}

export function ageBody({today}) {
  const birth = `${Number(today.slice(0, 4)) - 24}-06-15`;
  const start = agePlan({birth, on: today, min: 18, max: 27});
  const year = Number(today.slice(0, 4)), next = month => `${year}-${month}-01` >= today ? `${year}-${month}-01` : `${year + 1}-${month}-01`;
  const short = day => new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(day + 'T00:00:00Z'));
  const dates = [['today', 'Today', today], ['jan', short(next('01')), next('01')], ['aug', short(next('08')), next('08')]];
  const bands = AGE_BANDS.map(([lo, hi]) => `<button type="button" data-age-band data-min="${lo}" data-max="${hi}" aria-pressed="${lo === 18 && hi === 27}">${lo}–${hi}</button>`).join('');
  return `<main id="main-content" class="editorial-shell calc-shell age-shell">${toolCrumbs('Age calculator')}
  ${hero('AGE CALCULATOR FOR GOVERNMENT JOBS', 'Are you within the age limit?', 'Enter your date of birth and the cut-off date from the notice to see your exact age on that day, the birth dates that qualify and your upper age limit with category relaxations.')}
  <section class="calc" data-age aria-label="Age calculator">
    <form class="calc-form" data-age-form novalidate>
      <div class="calc-field calc-field-main"><label for="age-birth">Date of birth</label><input id="age-birth" name="birth" type="date" value="${birth}" max="${today}" required aria-describedby="age-birth-help"><span id="age-birth-help" class="calc-words">As on your Class 10 certificate. It stays in your browser.</span></div>
      <div class="calc-field"><label for="age-on">Age as on (cut-off date)</label><input id="age-on" name="on" type="date" value="${today}" required aria-describedby="age-on-help"><div class="hike-steps" role="group" aria-label="Common cut-off dates">${dates.map(([id, text, day]) => `<button type="button" data-age-on="${id}" data-day="${day}" aria-pressed="${id === 'today'}">${e(text)}</button>`).join('')}</div><span id="age-on-help" class="calc-words">Notices say “age as on” a date: often 1 January, 1 August or the last date to apply.</span></div>
      <div class="calc-field"><label for="age-min">Age limits in the notice</label><div class="age-limits"><input id="age-min" name="min" type="number" inputmode="numeric" min="0" max="100" step="1" value="18" aria-label="Minimum age"><span aria-hidden="true">to</span><input id="age-max" name="max" type="number" inputmode="numeric" min="1" max="100" step="1" value="27" placeholder="none" aria-label="Maximum age, blank for none"></div><div class="hike-steps" role="group" aria-label="Common age limits">${bands}</div></div>
      <div class="calc-field"><label for="age-category">Category</label><select id="age-category" name="category">${CATEGORIES.map(([id, name, n]) => `<option value="${id}">${e(name)}${n ? ` (+${n} years)` : ''}</option>`).join('')}</select></div>
      <label class="calc-check"><input type="checkbox" name="pwbd"> Person with benchmark disability (+${PWBD_YEARS} years)</label>
      <div class="calc-field"><label for="age-other">Other relaxation (years, optional)</label><input id="age-other" name="other" type="number" inputmode="numeric" min="0" max="${MAX_OTHER_YEARS}" step="1" placeholder="0" aria-describedby="age-other-help"><span id="age-other-help" class="calc-words">For ex-servicemen, serving government employees or state rules: the years given in your notice.</span></div>
      <div class="calc-field"><label for="age-rule">How the notice counts the upper limit</label><select id="age-rule" name="rule"><option value="reached">You must not have reached it (UPSC, SSC)</option><option value="completed">You can be that age until your next birthday</option></select></div>
    </form>
    <div class="calc-result" data-age-result aria-live="polite">${ageResult(start)}</div>
    <section class="prose age-notes" aria-labelledby="age-how"><h2 id="age-how">How age limits work</h2>
      <p><strong>Age on a cut-off date.</strong> Each notice fixes the date your age is counted on, such as 1 January or 1 August of the exam year, or the last date to apply. Your age on that day decides, not your age on the day you apply.</p>
      <p><strong>The UPSC and SSC rule.</strong> On the cut-off date you must have reached the minimum age and must not have reached the maximum. So for ages 18 to 27 on 1 August 2025, SSC accepted candidates born from 2 August 1998 to 1 August 2007. Some state notices let you apply until the day before your next birthday instead. The birth dates printed in your notice are final.</p>
      <p><strong>Relaxations.</strong> In central government jobs, the upper age limit rises by 3 years for OBC (non-creamy layer), 5 years for SC and ST, and 10 years for persons with benchmark disabilities (13 for OBC and 15 for SC and ST). EWS candidates get no age relaxation. Ex-servicemen, serving central government employees and some others get relaxations set out in each notice, and state jobs follow state rules.</p>
      <p><strong>Proof of age.</strong> Recruiters usually go by the date of birth on your Class 10 (matriculation or secondary school) certificate, so use that date, and keep the certificate ready for document verification.</p>
    </section>
    <p class="quiet-callout">A check, not a decision: each exam’s notice is the final word on age limits, relaxations and the cut-off date. Your date of birth is worked out in your browser and never saved. See <a href="/government-jobs">open government jobs</a> and <a href="/deadlines?type=government">their last dates</a>.</p>
  </section>
  <script type="module" src="/js/age-calculator.js"></script></main>`;
}

export function typingBody() {
  const start = words(testText(PASSAGES[0].id, 1));
  return `<main id="main-content" class="editorial-shell typing-shell">${toolCrumbs('Typing test')}
  ${hero('TYPING SPEED TEST', 'How fast do you type?', 'Type the passage to see your speed in words a minute, your accuracy and your key depressions an hour, and how you compare with the typing tests in SSC and other government exams.')}
  <section class="typing" data-typing aria-label="Typing test">
    <div class="typing-bar">
      <div class="hike-steps typing-times" role="group" aria-label="Test length">${DURATIONS.map(([m, label]) => `<button type="button" data-ty-minutes="${m}" aria-pressed="${m === 1}">${e(label)}</button>`).join('')}</div>
      <div class="typing-pick"><label for="ty-passage">Passage</label><select id="ty-passage" data-ty-select>${PASSAGES.map(p => `<option value="${p.id}">${e(p.title)}</option>`).join('')}</select><button type="button" class="text-button" data-ty-next>Next passage</button></div>
      <label class="calc-check"><input type="checkbox" data-ty-marks checked> Show mistakes as I type</label>
    </div>
    <div class="typing-stats"><p><span>Time left</span><strong data-ty-timer>1:00</strong></p><p><span>Speed</span><strong data-ty-speed>0 wpm</strong></p><p><span>Wrong words</span><strong data-ty-wrong>0</strong></p></div>
    <div class="typing-passage" data-ty-passage>${start.map((word, i) => `<span${i ? '' : ' class="is-current"'}>${e(word)}</span>`).join(' ')}</div>
    <label class="sr-only" for="ty-input">Type the passage here</label>
    <textarea id="ty-input" class="typing-input" data-ty-input rows="4" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Start typing the passage here. The timer starts with your first key."></textarea>
    <div class="typing-actions"><button class="secondary-button" type="button" data-ty-restart>Restart</button><button class="secondary-button" type="button" data-ty-finish>Finish now</button><p class="typing-best" data-ty-best></p></div>
    <p class="typing-status" data-ty-status role="status" aria-live="polite"></p>
    <div class="calc-result typing-result" data-ty-result tabindex="-1" hidden></div>
    <div class="typing-share" data-ty-share hidden><p>Challenge a friend to beat it</p>${shareBar(site.origin + '/typing-test', 'Try the free typing speed test on WILSY.', {label: 'Share your score'})}</div>
  </section>
  <section class="prose typing-notes" aria-labelledby="ty-how"><h2 id="ty-how">How the test is scored</h2>
    <p><strong>Speed.</strong> Typing tests count a word as five key depressions, spaces included, so your gross speed is the characters you typed ÷ 5 ÷ minutes. Each wrong word takes one word a minute off, which gives your net speed. Key depressions an hour are your net speed × 5 × 60.</p>
    <p><strong>Accuracy.</strong> A word with any mistake in it counts as one wrong word, and so does a word you skip or add. Real exams have their own rules for which mistakes count and how many are allowed, so read the instructions for your exam.</p>
    <p><strong>Government typing tests.</strong> SSC’s typing test for lower division clerks and junior secretariat assistants asks for 35 words a minute in English, about 10,500 key depressions an hour, or 30 in Hindi, about 9,000, over 10 minutes. Its skill test for data entry operators asks for 8,000 key depressions an hour over 15 minutes. Other recruiters set their own speeds, so check your notice.</p>
    <p><strong>Practise well.</strong> Accuracy first, then speed: sit straight, keep your fingers on the home row and look at the passage, not the keyboard. Ten minutes a day helps more than an hour once a week.</p>
  </section>
  <p class="quiet-callout">The passages were written for WILSY. Everything runs in your browser, and your best scores stay on this device. <a href="/age-calculator">Check the age limit for a government job</a> or see <a href="/government-jobs">open government jobs</a>.</p>
  <script type="module" src="/js/typing-test.js"></script></main>`;
}

export function settlementBody({today}) {
  const joined = `${Number(today.slice(0, 4)) - 3}-${today.slice(5, 7)}-01`;
  const start = settlement({last: today, monthly: 60000, basic: 30000, leaveDays: 10, joined});
  const select = (name, id, options, chosen) => `<select id="${id}" name="${name}">${options.map(([v, t]) => `<option value="${v}"${v === chosen ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`;
  const money = (name, id, label, value, help = '') => `<div class="calc-field"><label for="${id}">${e(label)}</label><input id="${id}" name="${name}" type="number" inputmode="numeric" min="0" max="10000000" step="1000"${value ? ` value="${value}"` : ' placeholder="0"'}${help ? ` aria-describedby="${id}-help"` : ''}>${help ? `<span id="${id}-help" class="calc-words">${e(help)}</span>` : ''}</div>`;
  return `<main id="main-content" class="editorial-shell calc-shell ff-shell">${toolCrumbs('Full and final settlement calculator')}
  ${hero('FULL AND FINAL SETTLEMENT', 'What will your final settlement be?', 'Add up what your employer owes you when you leave: salary still owed, unused leave, gratuity and other dues, less any notice recovery, with the dates they are due under the labour codes.')}
  <section class="calc" data-ff aria-label="Full and final settlement calculator">
    <form class="calc-form" data-ff-form novalidate>
      <div class="calc-field calc-field-main"><label for="ff-last">Last working day</label><input id="ff-last" name="last" type="date" value="${today}" required></div>
      <fieldset class="ff-group"><legend>Your pay</legend>
        ${money('monthly', 'ff-monthly', 'Gross monthly pay (₹)', 60000)}
        ${money('basic', 'ff-basic', 'Basic pay + DA a month (₹)', 30000, 'From your payslip. Used for leave, gratuity and some notice recoveries.')}
        <div class="ff-pair"><div class="calc-field"><label for="ff-days">Days of salary owed</label><input id="ff-days" name="paidDays" type="number" inputmode="numeric" min="0" max="31" step="1" placeholder="${Number(today.slice(8, 10))}" aria-describedby="ff-days-help"></div>
          <div class="calc-field"><label for="ff-basis">A day’s salary is</label>${select('payBasis', 'ff-basis', [['month', 'Pay ÷ days in that month'], ['30', 'Pay ÷ 30']], 'month')}</div></div>
        <span id="ff-days-help" class="calc-words">Leave it empty to count the days worked in your last month.</span>
        ${money('other', 'ff-other', 'Bonus and other dues (₹)', 0, 'Unpaid bonus, variable pay, reimbursements or arrears.')}
      </fieldset>
      <fieldset class="ff-group"><legend>Leave and gratuity</legend>
        <div class="ff-pair"><div class="calc-field"><label for="ff-leave">Unused leave to be paid (days)</label><input id="ff-leave" name="leaveDays" type="number" inputmode="decimal" min="0" max="300" step="0.5" value="10"></div>
          <div class="calc-field"><label for="ff-leave-basis">A day of leave is</label>${select('leaveBasis', 'ff-leave-basis', LEAVE_BASES, 'basic-30')}</div></div>
        <div class="calc-field"><label for="ff-joined">Date you joined</label><input id="ff-joined" name="joined" type="date" value="${joined}" max="${today}"></div>
        <label class="calc-check"><input type="checkbox" name="fixedTerm"> Fixed-term contract (gratuity after one year)</label>
      </fieldset>
      <fieldset class="ff-group"><legend>Recoveries</legend>
        <div class="ff-pair"><div class="calc-field"><label for="ff-short">Notice days not served</label><input id="ff-short" name="shortDays" type="number" inputmode="numeric" min="0" max="365" step="1" placeholder="0"></div>
          <div class="calc-field"><label for="ff-recover">Recovered at</label>${select('recoverOn', 'ff-recover', [['gross', 'Gross pay ÷ 30 a day'], ['basic', 'Basic + DA ÷ 30 a day']], 'gross')}</div></div>
        ${money('deductions', 'ff-deductions', 'Other deductions (₹)', 0, 'Loans, salary advances or company assets not returned.')}
        <label class="calc-check"><input type="checkbox" name="saturdays"> My office works on Saturdays</label>
      </fieldset>
    </form>
    <div class="calc-result" data-ff-result aria-live="polite">${settlementResult(start)}</div>
    <section class="prose ff-notes" aria-labelledby="ff-how"><h2 id="ff-how">What goes into a full and final settlement</h2>
      <p><strong>When it is due.</strong> Under section 17(2) of the Code on Wages, 2019, in force since 21 November 2025, wages due must be paid within two working days of leaving, whether you resign or are removed, dismissed or retrenched. Gratuity is due within 30 days of becoming payable, under section 56(3) of the Code on Social Security, 2020. Employers read the two-day rule in different ways, so ask HR for the settlement date in writing.</p>
      <p><strong>What you are owed.</strong> Salary for the days not yet paid, unused earned leave if your policy pays it out, gratuity once you qualify, and any bonus, variable pay, reimbursements or arrears due. Your leave policy decides which leave is paid and how a day is valued; many employers use basic pay and DA ÷ 30 or ÷ 26.</p>
      <p><strong>What can be recovered.</strong> Pay for notice days you did not serve, unless your manager waives them, plus loans, salary advances and assets you did not return. Ask for the full calculation, and check each line against your offer letter and payslips.</p>
      <p><strong>Tax and your PF.</strong> Tax is deducted from the salary, leave encashment and bonus parts as usual. Gratuity up to ₹20 lakh is tax-free for private-sector employees. Your provident fund is separate from the settlement: transfer it to your new employer or withdraw it on the EPFO member portal with your UAN.</p>
    </section>
    <p class="quiet-callout">An estimate before tax for monthly-paid employees; your employer’s policy and its settlement statement are the final word. Everything is worked out in your browser. <a href="/notice-period-calculator">Work out your notice period</a> or <a href="/career-letters?letter=relieving">ask for your relieving letter</a>.</p>
  </section>
  <script type="module" src="/js/final-settlement.js"></script></main>`;
}

export function interviewBody() {
  const first = QUESTIONS[0];
  const groups = IA_GROUPS.map(([id, name]) => `<fieldset class="letter-group"><legend>${e(name)}</legend><div class="letter-chips">${QUESTIONS.filter(q => q.group === id).map(q => `<label class="letter-chip"><input type="radio" name="ia-q" value="${q.id}"${q === first ? ' checked' : ''}><span>${e(shortName(q))}</span></label>`).join('')}</div></fieldset>`).join('');
  return `<main id="main-content" class="editorial-shell interview-shell">${toolCrumbs('Interview answer builder')}
  ${hero('INTERVIEW ANSWERS', 'Prepare answers that land.', 'Build clear answers to the 15 questions most interviews ask, from “Tell me about yourself” to your salary expectations. See how long each answer takes to say, get tips, and practise out loud.')}
  <section class="ia" data-ia aria-label="Interview answer builder">
    <div class="letter-pick ia-pick" role="group" aria-label="Choose a question">${groups}</div>
    <div class="ia-bar"><label class="rb-keep"><input type="checkbox" data-ia-keep checked> Save on this device</label><button type="button" class="text-button" data-ia-clear>Clear all answers</button></div>
    <div class="ia-grid">
      <div class="ia-form" data-ia-form>${questionForm(first)}</div>
      <div class="ia-side">
        <div class="ia-answer"><p class="eyebrow">YOUR ANSWER</p><p class="ia-preview is-empty" data-ia-preview>Your answer appears here as you write.</p><p class="ia-meta" data-ia-meta>Aim for ${first.target[0]} to ${first.target[1]} seconds</p>
          <div class="ia-actions"><button class="primary-button" type="button" data-ia-copy>Copy answer</button><button class="secondary-button" type="button" data-ia-practice aria-pressed="false">Practise out loud</button><span class="ia-timer" data-ia-timer aria-hidden="true">0:00</span></div>
          <p class="offer-status" data-ia-status role="status" aria-live="polite"></p></div>
        <div class="rb-checks"><h3>Checks</h3><div data-ia-checks>${checksList(answerChecks(first, {}))}</div></div>
        <div class="ia-more"><button class="secondary-button" type="button" data-ia-copy-all>Copy all answers</button><button class="secondary-button" type="button" data-ia-print>Print or PDF</button></div>
      </div>
    </div>
  </section>
  <section class="prose ia-bank" aria-labelledby="ia-bank-title"><h2 id="ia-bank-title">The 15 questions, with example answers</h2>
    ${QUESTIONS.map(q => `<details><summary>${e(q.q)}</summary><p>${e(q.why)}</p><p class="ia-bank-example"><strong>Example answer.</strong> ${e(exampleText(q))}</p><p><a href="/interview-answers?q=${q.id}" data-ia-open="${q.id}">Write your answer</a></p></details>`).join('')}
    <p class="ia-bank-note">The people, companies and numbers in the examples are made up. Use your own projects, results and words: interviewers notice answers learned by heart.</p>
  </section>
  <section class="prose ia-notes" aria-labelledby="ia-how"><h2 id="ia-how">How to answer well</h2>
    <p><strong>Tell stories.</strong> For “Tell me about a time…” questions, use the STAR structure: the situation, your task, the action you took and the result. Spend most of the time on what you did, and end with a number if you can.</p>
    <p><strong>Keep it short.</strong> Most answers work best at one to two minutes. Write the answer, say it out loud, and cut whatever you stumble over.</p>
    <p><strong>Prepare the facts.</strong> Know your notice period, your expected salary range and two or three projects you can talk about in detail. Read the job description again on the day.</p>
  </section>
  <p class="quiet-callout">Your answers stay in your browser and are never uploaded. Before the interview, check the role’s pay in the <a href="/salaries">salary explorer</a>, your <a href="/notice-period-calculator">notice period</a> and how your resume fits the job in <a href="/resume-match">resume match</a>.</p>
  <div class="ia-print" data-ia-print-copy></div>
  <script type="module" src="/js/interview-answers.js"></script></main>`;
}

export function govPayBody() {
  const start = govPay({level: '7', city: 'X'});
  const levels = LEVELS.map(([id, first, last]) => `<option value="${id}"${id === '7' ? ' selected' : ''}>Level ${id}: ${rupees(first)}${last > first ? ` to ${rupees(last)}` : ''}</option>`).join('');
  const cells = start.cells.map((pay, i) => `<option value="${pay}"${i ? '' : ' selected'}>${e(cellLabel(start.cells, i))}</option>`).join('');
  const posts = POSTS.map(([id, name, level]) => `<button type="button" data-gp-post="${id}" data-level="${level}" aria-pressed="${id === 'inspector'}">${e(name)}</button>`).join('');
  return `<main id="main-content" class="editorial-shell calc-shell gp-shell">${toolCrumbs('Government salary calculator')}
  ${hero('GOVERNMENT SALARY CALCULATOR', 'What does a government job pay in hand?', 'Pick a post or a pay level to see the monthly pay in central government jobs under the 7th Pay Commission: basic pay, DA, HRA and transport allowance, less NPS, CGHS, CGEGIS and income tax.')}
  <section class="calc" data-gp aria-label="Government salary calculator">
    <form class="calc-form" data-gp-form novalidate>
      <fieldset class="ff-group"><legend>Pick a post</legend><div class="hike-steps gp-posts">${posts}</div></fieldset>
      <div class="calc-field calc-field-main"><label for="gp-level">Pay level</label><select id="gp-level" name="level">${levels}</select></div>
      <div class="calc-field"><label for="gp-basic">Basic pay</label><select id="gp-basic" name="basic" aria-describedby="gp-basic-help">${cells}</select><span id="gp-basic-help" class="calc-words">New joiners start at the level’s first cell. Each yearly increment adds about 3%.</span></div>
      <div class="ff-pair"><div class="calc-field"><label for="gp-city">City for HRA</label><select id="gp-city" name="city" aria-describedby="gp-city-help"><option value="X" selected>X city (30%)</option><option value="Y">Y city (20%)</option><option value="Z">Z city (10%)</option></select></div>
        <div class="calc-field"><label for="gp-da">DA (% of basic pay)</label><input id="gp-da" name="da" type="number" inputmode="numeric" min="0" max="200" step="1" value="${DA_RATE}" aria-describedby="gp-city-help"></div></div>
      <span id="gp-city-help" class="calc-words">X cities: ${e(X_CITIES.join(', '))}. Y: most other big cities (5 lakh to 50 lakh people), such as Jaipur, Lucknow, Patna and Bhopal. Z: everywhere else. DA is ${DA_RATE}% from ${DA_SINCE}.</span>
      <label class="calc-check"><input type="checkbox" name="higherTa" checked> Posted in a city with the higher transport allowance</label>
      <details class="gp-cities"><summary>The 19 cities with the higher transport allowance</summary><p>${e(TA_CITIES.join(', '))}, with their urban areas.</p></details>
      <div class="calc-field"><label for="gp-pension">Pension</label><select id="gp-pension" name="pension"><option value="nps" selected>NPS or UPS: 10% of basic pay + DA</option><option value="none">Old pension scheme (no NPS deduction)</option></select></div>
      <label class="calc-check"><input type="checkbox" name="cghs" checked> CGHS contribution (in cities with CGHS)</label>
      <div class="calc-field"><label for="gp-other">Other deductions a month (₹, optional)</label><input id="gp-other" name="other" type="number" inputmode="numeric" min="0" max="1000000" step="100" placeholder="0" aria-describedby="gp-other-help"><span id="gp-other-help" class="calc-words">GPF, loan repayments, professional tax or society dues.</span></div>
    </form>
    <div class="calc-result" data-gp-result aria-live="polite">${govPayResult(start)}</div>
    <section class="prose gp-notes" aria-labelledby="gp-how"><h2 id="gp-how">How government pay is worked out</h2>
      <p><strong>Pay levels.</strong> Central government posts are paid on the 7th Pay Commission’s pay matrix. Each post has a pay level: you join at the level’s first cell and move up one cell, about 3%, with each yearly increment. Promotions move you to a higher level.</p>
      <p><strong>Allowances.</strong> Dearness allowance (DA) is a share of basic pay, ${DA_RATE}% from ${DA_SINCE}, revised every January and July. House rent allowance is 30%, 20% or 10% of basic pay in X, Y and Z cities if you don’t live in government housing. Transport allowance depends on your level and city, with DA on top. Some posts get more allowances, such as for risk or special duty.</p>
      <p><strong>Deductions.</strong> If you joined after 1 January 2004, 10% of basic pay + DA goes to NPS, or to UPS if you chose it, and the government adds 14% (18.5% under UPS). CGHS (health) and CGEGIS (group insurance) take a small fixed amount. Income tax follows the new regime: none up to ₹12 lakh of taxable income, after the ₹75,000 standard deduction.</p>
      <p><strong>The 8th Pay Commission.</strong> It was set up on 3 November 2025 and has until May 2027 to report. Until new pay is notified, the 7th Pay Commission’s matrix applies.</p>
    </section>
    <p class="quiet-callout">An estimate for central government jobs: your post’s notice and your pay slip are the final word, and state government jobs follow state pay rules. Worked out in your browser. See <a href="/government-jobs">open government jobs</a> or <a href="/age-calculator">check your age limit</a>.</p>
  </section>
  <script type="module" src="/js/gov-salary.js"></script></main>`;
}

export function epfBody() {
  const start = epfPlan({age: 25, wage: 30000, rise: 5});
  const number = (name, id, label, value, attrs, help = '') => `<div class="calc-field"><label for="${id}">${e(label)}</label><input id="${id}" name="${name}" type="number" ${attrs}${value === '' ? ' placeholder="0"' : ` value="${value}"`}${help ? ` aria-describedby="${id}-help"` : ''}>${help ? `<span id="${id}-help" class="calc-words">${e(help)}</span>` : ''}</div>`;
  return `<main id="main-content" class="editorial-shell calc-shell epf-shell">${toolCrumbs('EPF calculator')}
  ${hero('EPF CALCULATOR', 'How much will your PF grow to?', 'See your EPF balance at retirement from your basic pay + DA: what you put in, what your employer puts in after the pension scheme, and the interest at 8.25% a year.')}
  <section class="calc" data-epf aria-label="EPF calculator">
    <form class="calc-form" data-epf-form novalidate>
      <div class="calc-field calc-field-main"><label for="epf-wage">Basic pay + DA a month (₹)</label><input id="epf-wage" name="wage" type="number" inputmode="numeric" min="0" max="10000000" step="1000" value="30000" aria-describedby="epf-wage-help"><span id="epf-wage-help" class="calc-words">From your payslip. PF is 12% of it.</span></div>
      <div class="ff-pair">${number('age', 'epf-age', 'Your age', 25, 'inputmode="numeric" min="15" max="75" step="1"')}${number('retire', 'epf-retire', 'Retire at', 58, 'inputmode="numeric" min="18" max="75" step="1"')}</div>
      <div class="ff-pair">${number('rise', 'epf-rise', 'Pay rise a year (%)', 5, 'inputmode="decimal" min="0" max="30" step="0.5"')}${number('rate', 'epf-rate', 'Interest a year (%)', EPF_RATE, 'inputmode="decimal" min="0" max="20" step="0.05"')}</div>
      <span class="calc-words">EPF interest is ${EPF_RATE}% for ${RATE_YEAR}. EPFO sets it every year, so later years may differ.</span>
      ${number('balance', 'epf-balance', 'EPF balance now (₹, optional)', '', 'inputmode="numeric" min="0" max="1000000000" step="1000"', 'The total in your passbook on the EPFO member portal.')}
      <div class="calc-field"><label for="epf-on">Your employer pays PF on</label><select id="epf-on" name="pfOn"><option value="full" selected>Your full basic pay + DA</option><option value="ceiling">The wage ceiling only (${rupees(WAGE_CEILING)} a month)</option></select></div>
      <div class="calc-field"><label for="epf-eps">Pension scheme (EPS)</label><select id="epf-eps" name="eps" aria-describedby="epf-eps-help"><option value="yes" selected>I’m a member: part of my employer’s share goes to EPS</option><option value="no">I’m not a member: all of it goes to EPF</option></select><span id="epf-eps-help" class="calc-words">If you joined after 1 September 2014 with basic pay + DA above the wage ceiling, you’re usually not in EPS. Your passbook has a pension column if you are.</span></div>
      ${number('vpf', 'epf-vpf', 'Voluntary PF (% of basic pay + DA, optional)', '', 'inputmode="decimal" min="0" max="88" step="1"')}
    </form>
    <div class="calc-result" data-epf-result aria-live="polite">${epfResult(start)}</div>
    <section class="prose epf-notes" aria-labelledby="epf-how"><h2 id="epf-how">How your EPF grows</h2>
      <p><strong>Contributions.</strong> Each month you pay 12% of your basic pay + DA, and your employer pays 12% too. From your employer’s share, 8.33% of wages up to the wage ceiling (at most ₹2,083 a month) goes to the Employees’ Pension Scheme (EPS), and the rest to your EPF account.</p>
      <p><strong>The new wage ceiling.</strong> From ${CEILING_SINCE}, the wage ceiling is ${rupees(WAGE_CEILING)} a month, up from ₹15,000. If your employer pays PF only on the ceiling, that is ₹3,000 a month from you and ₹3,000 from your employer.</p>
      <p><strong>Interest.</strong> EPFO declares the rate every year: ${EPF_RATE}% for ${RATE_YEAR}, the same as the two years before. It is worked out on your monthly balance and added once a year, so it compounds. Interest on your own contributions above ₹2.5 lakh a year is taxable.</p>
      <p><strong>Taking it out.</strong> The balance is paid out when you retire. Before that, EPFO lets you take out part of it for needs like a house, medical treatment, education or a wedding. When you change jobs, transfer the balance with your UAN instead of closing the account.</p>
    </section>
    <p class="quiet-callout">An estimate: the interest rate is set every year, and your passbook is the final word. Everything is worked out in your browser. See your <a href="/salary-calculator">in-hand salary</a> or your <a href="/gratuity-calculator">gratuity</a>.</p>
  </section>
  <script type="module" src="/js/epf.js"></script></main>`;
}

export function cgpaBody() {
  const start = cgpaPlan({cgpa: 8, formula: 'aicte'});
  const semesters = Array.from({length: SEMESTERS}, (_, i) => `<tr><th scope="row">${i + 1}</th><td><input name="sgpa${i}" type="number" inputmode="decimal" min="0" max="10" step="0.01" aria-label="Semester ${i + 1} SGPA"></td><td><input name="credits${i}" type="number" inputmode="decimal" min="0" max="100" step="0.5" aria-label="Semester ${i + 1} credits"></td></tr>`).join('');
  return `<main id="main-content" class="editorial-shell calc-shell cg-shell">${toolCrumbs('CGPA calculator')}
  ${hero('CGPA CALCULATOR', 'Turn your CGPA into a percentage.', 'Convert CGPA to percentage with the CBSE, AICTE or your university’s formula, work out your CGPA from your semester SGPAs, and see the SGPA you need for a target.')}
  <section class="calc" data-cg aria-label="CGPA calculator">
    <form class="calc-form" data-cg-form novalidate>
      <fieldset class="ff-group"><legend>CGPA and percentage</legend>
        <div class="ff-pair"><div class="calc-field calc-field-main"><label for="cg-cgpa">CGPA (out of 10)</label><input id="cg-cgpa" name="cgpa" type="number" inputmode="decimal" min="0" max="10" step="0.01" value="8"></div>
          <div class="calc-field calc-field-main"><label for="cg-percent">Percentage</label><input id="cg-percent" name="percent" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="${start.convert.percent}"></div></div>
        <span class="calc-words">Type in either box and the other one follows.</span>
        <div class="calc-field"><label for="cg-formula">Formula</label><select id="cg-formula" name="formula">${FORMULAS.map(([id, name]) => `<option value="${id}">${e(name)}</option>`).join('')}</select></div>
        <div class="ff-pair" data-cg-custom hidden><div class="calc-field"><label for="cg-m">Multiply the CGPA by</label><input id="cg-m" name="multiplier" type="number" inputmode="decimal" min="0" max="20" step="0.01" placeholder="9.5"></div>
          <div class="calc-field"><label for="cg-c">Then add (minus to take away)</label><input id="cg-c" name="offset" type="number" inputmode="decimal" min="-100" max="100" step="0.01" placeholder="0"></div></div>
      </fieldset>
      <fieldset class="ff-group"><legend>CGPA from your semesters</legend>
        <table class="cg-sems"><thead><tr><th scope="col">Semester</th><th scope="col">SGPA</th><th scope="col">Credits (optional)</th></tr></thead><tbody>${semesters}</tbody></table>
        <span class="calc-words">With credits for every semester, each one counts by its credits; without them, each counts the same.</span>
      </fieldset>
      <fieldset class="ff-group"><legend>The SGPA you need</legend>
        <div class="ff-pair"><div class="calc-field"><label for="cg-target">Target CGPA</label><input id="cg-target" name="target" type="number" inputmode="decimal" min="0" max="10" step="0.01" placeholder="8.5"></div>
          <div class="calc-field"><label for="cg-left">Semesters left</label><input id="cg-left" name="left" type="number" inputmode="numeric" min="1" max="12" step="1" placeholder="2"></div></div>
        <div class="calc-field"><label for="cg-done">Semesters done (if you haven’t filled them in above)</label><input id="cg-done" name="done" type="number" inputmode="numeric" min="1" max="12" step="1" placeholder="4"></div>
      </fieldset>
    </form>
    <div class="calc-result" data-cg-result aria-live="polite">${cgpaResult(start)}</div>
    <section class="prose cg-notes" aria-labelledby="cg-how"><h2 id="cg-how">CGPA, SGPA and percentage</h2>
      <p><strong>SGPA and CGPA.</strong> Your SGPA is the grade point average of one semester, weighted by each course’s credits. Your CGPA is the average over all your semesters so far, weighted by their credits.</p>
      <p><strong>Converting to a percentage.</strong> There is no single rule: each board or university sets its own, and many print it on the grade card. CBSE’s Class 10 grades use CGPA × 9.5. The formula AICTE gives, used by many engineering colleges, is (CGPA − 0.75) × 10. Some universities simply multiply by 10.</p>
      <p><strong>Job and exam forms.</strong> When a form asks for a percentage, use your university’s formula and keep its conversion certificate or grade card ready for document verification. If there is no formula, some forms accept the CGPA as it is: check the notice.</p>
    </section>
    <p class="quiet-callout">Worked out in your browser, and nothing is saved. Next, <a href="/resume-builder">build your resume</a> or see <a href="/research-internships">research internships</a> and <a href="/scholarships">scholarships</a>.</p>
  </section>
  <script type="module" src="/js/cgpa.js"></script></main>`;
}

export function experienceBody({today}) {
  return `<main id="main-content" class="editorial-shell calc-shell xp-shell">${toolCrumbs('Work experience calculator')}
  ${hero('WORK EXPERIENCE CALCULATOR', 'How much experience do you have?', 'Add your jobs and internships to get your total experience in years and months, with overlapping time counted once and the gaps between jobs listed, as on any date.')}
  <section class="calc" data-xp aria-label="Work experience calculator">
    <form class="calc-form" data-xp-form novalidate>
      <div class="calc-field"><label for="xp-on">Count experience as on</label><input id="xp-on" name="asOn" type="date" value="${today}" required aria-describedby="xp-on-help"><span id="xp-on-help" class="calc-words">Today, or the date a notice asks for, such as its closing date.</span></div>
      <div class="xp-jobs" data-xp-jobs>${jobRow(0)}${jobRow(1)}</div>
      <button class="secondary-button xp-add" type="button" data-xp-add>Add a job</button>
    </form>
    <div class="calc-result" data-xp-result aria-live="polite">${experienceResult(experience([], {asOn: today}))}</div>
    <section class="prose xp-notes" aria-labelledby="xp-how"><h2 id="xp-how">How experience is counted</h2>
      <p><strong>Days and months.</strong> The first and the last day of each job both count, so 1 July 2023 to 30 June 2024 is exactly one year. Each stretch of work is counted in years, months and days, and 30 leftover days make a month.</p>
      <p><strong>Overlaps and gaps.</strong> Time when two jobs overlap, such as freelance work alongside a full-time job, counts once. Gaps of a month or more between jobs are listed, because forms and interviewers often ask about them.</p>
      <p><strong>What counts.</strong> Notices and employers decide what counts as experience: some count only full-time work after your degree, some count internships or apprenticeships. Leave out what yours doesn’t count, and keep experience letters ready for each job.</p>
    </section>
    <p class="quiet-callout">Worked out in your browser: your jobs aren’t saved or sent anywhere. Next, <a href="/resume-builder">build your resume</a> or <a href="/interview-answers">prepare your interview answers</a>.</p>
  </section>
  <script type="module" src="/js/experience.js"></script></main>`;
}

export function toolsBody() {
  const groups = [['Apply', 'Apply and keep track'], ['Pay', 'Pay and offers'], ['Switch', 'Switch jobs'], ['Research', 'Research the market'], ['Prepare', 'Prepare for interviews and tests'], ['Share', 'Share and follow']];
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
  return `<details class="ask-referral" id="ask-referral" data-referral="${e(JSON.stringify({title: job.title, company: job.company, url}))}"><summary>Ask someone at ${e(job.company)} for a referral</summary>
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
    ['Resume match', '/resume-match', 'Check your resume against a job', 'resume cv ats keywords skills match check fit gap eligibility'],
    ['Copy check', '/copy-check', 'Did you copy the job posting?', 'copy copied cover letter resume plagiarism echo posting job description ats'],
    ['Hiring trends', '/hiring-trends', 'What is hiring right now, from live jobs', 'trends market skills in demand hiring report statistics'],
    ['RSS feed of new jobs', '/feed.xml', 'Follow new jobs in a feed reader', 'rss feed subscribe telegram'],
    ['Government jobs', '/government-jobs', 'Official notices and exams', 'sarkari exam upsc ssc psu'],
    ['Hackathons', '/hackathons', 'Open challenges and prizes', 'hackathon challenge'],
    ['Competitions', '/competitions', 'Case competitions and challenges', 'case competition quiz'],
    ['Coding contests', '/contests', 'Codeforces and AtCoder calendar', 'competitive programming contest'],
    ['Open-source programmes', '/open-source-programs', 'GSoC, LFX, Outreachy and more', 'gsoc open source mentorship'],
    ['Research internships', '/research-internships', 'IAS, IIT and institute fellowships', 'summer research fellowship'],
    ['Scholarships', '/scholarships', 'Official scholarship schemes', 'scholarship funding'],
    ['Workshops & events', '/events', 'Free workshops, webinars and conferences', 'workshop webinar conference event seminar techfest'],
    ['Free courses', '/free-courses', 'NPTEL and Microsoft Learn courses', 'course nptel swayam microsoft learn certification online learning free'],
    ['Startup grants', '/startup-grants', 'Government seed funds and incubator grants', 'startup grant seed fund incubator funding birac'],
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
    ['Resume builder', '/resume-builder', 'One-page resume to PDF', 'resume cv builder maker template pdf format fresher create'],
    ['Deadlines calendar', '/deadlines', 'Every last date, soonest first', 'deadline last date closing soon calendar reminder hackathon scholarship exam'],
    ['Notice period calculator', '/notice-period-calculator', 'Your last working day and buyout', 'notice period last working day resign resignation buyout early release relieving'],
    ['Resignation and offer letters', '/career-letters', 'Resignation, offer and follow-up emails', 'resignation letter email template offer acceptance decline negotiate salary follow up thank you joining date relieving experience letter'],
    ['Age calculator for government jobs', '/age-calculator', 'Your age on a notice’s cut-off date', 'age calculator limit eligibility government sarkari ssc upsc cut off date relaxation obc sc st ews pwbd date of birth'],
    ['Typing speed test', '/typing-test', 'Words a minute and accuracy', 'typing test speed wpm ssc chsl deo kdph key depressions practice keyboard'],
    ['Full and final settlement calculator', '/full-and-final-settlement', 'What you are owed when you leave', 'full and final settlement fnf f&f leave encashment last salary relieving resign gratuity notice recovery'],
    ['Interview answer builder', '/interview-answers', 'Answers to common interview questions', 'interview questions answers tell me about yourself strengths weakness star hr salary expectations why should we hire you notice period'],
    ['Government salary calculator', '/government-salary-calculator', 'In-hand pay for government jobs', 'government sarkari salary in hand 7th pay commission cpc pay level matrix da hra ta nps ssc cgl chsl mts inspector'],
    ['EPF calculator', '/epf-calculator', 'Your PF balance at retirement', 'epf pf provident fund calculator interest 8.25 eps pension uan balance retirement vpf wage ceiling'],
    ['CGPA to percentage calculator', '/cgpa-calculator', 'CGPA, SGPA and percentage', 'cgpa sgpa percentage convert calculator cbse 9.5 aicte grade points marks semester'],
    ['Work experience calculator', '/experience-calculator', 'Total experience in years and months', 'work experience calculator total years months gap overlap jobs form'],
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
