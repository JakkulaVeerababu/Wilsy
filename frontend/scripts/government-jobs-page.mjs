import snapshot from '../data/government-jobs.json' with {type: 'json'};
import examCatalog from '../data/government-exams.json' with {type: 'json'};
import {escapeHtml as e, safeHref} from '../js/directory-core.js';

const jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : [];
const exams = Array.isArray(examCatalog.exams) ? examCatalog.exams : [];
const text = value => String(value ?? '').trim();
const href = value => e(safeHref(value));
const dateText = value => {
  if (!value || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) return 'Date not provided';
  return new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${value}T00:00:00Z`));
};
const unique = values => [...new Set(values.filter(Boolean))];
const option = (value, label) => `<option value="${e(value)}">${e(label || value)}</option>`;
const select = (id, label, values, allLabel) => `<label class="gov-jobs-field"><span>${e(label)}</span><select id="${e(id)}" name="${e(id)}"><option value="">${e(allLabel)}</option>${values.map(value => option(value, value)).join('')}</select></label>`;

const examSearchText = exam => [
  exam.shortName,
  exam.name,
  exam.conductingBody,
  exam.category,
  ...(Array.isArray(exam.categories) ? exam.categories : []),
  exam.qualification,
  exam.eligibilityText,
  exam.ageText,
  exam.careerText,
  exam.qualificationRoute,
  exam.officialLabel,
  exam.competition,
  ...(Array.isArray(exam.states) ? exam.states : []),
  ...(Array.isArray(exam.stages) ? exam.stages : []),
  ...(Array.isArray(exam.syllabus) ? exam.syllabus : []),
  ...(Array.isArray(exam.studyResources) ? exam.studyResources : [])
].filter(Boolean).join(' ');

const embeddedJson = value => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const qualificationLabels = ['10th', '12th', 'ITI/Diploma', 'Graduate', 'Post-graduate', 'B.Tech/Professional'];
const categoryLabels = [...new Set(exams.map(exam => exam.category).filter(Boolean))];
const stateLabels = ['Any state', 'Andhra Pradesh', 'Telangana', 'State-specific'];
const countBy = (field, value) => exams.filter(exam => Array.isArray(exam[field]) ? exam[field].includes(value) : exam[field] === value).length;
const powerBandNotes = {
  1: 'Higher typical authority or seniority routes',
  2: 'Officer and specialist responsibility routes',
  3: 'Professional, supervisory and institutional routes',
  4: 'Entry operational, clerical and support routes',
  5: 'Entry-level and foundational routes'
};
const powerExamples = power => exams.filter(exam => Number(exam.powerLevel) === power).slice(0, 4).map(exam => exam.shortName).join(' · ');
const qualificationNotes = {
  '10th': 'Start with school-level and entry operational routes. Physical, language and post-specific rules can apply.',
  '12th': 'Explore clerical, defence, railway and state routes. Some professional paths need additional training.',
  'ITI/Diploma': 'Technical routes depend on the exact trade, branch and discipline in the notification.',
  Graduate: 'The broadest route: civil services, SSC, banking, railways, state services and more.',
  'Post-graduate': 'Subject-specific academic, research, regulatory and specialist routes may be available.',
  'B.Tech/Professional': 'Engineering and professional routes can also cover broad graduate-level routes, but not unrelated disciplines.'
};
const studyRoadmap = [
  ['Common foundation', 'Current affairs, reasoning, quantitative aptitude, language and basic computer awareness.'],
  ['Civil and state services', 'Polity, history, economy, geography, governance, current affairs, essay and answer writing.'],
  ['SSC, banking and railways', 'Reasoning, mathematics, English, general awareness, banking awareness or railway science as applicable.'],
  ['Police and defence', 'Written subjects plus a progressive physical routine, measurements and medical preparation.'],
  ['Teaching and education', 'Child development, pedagogy, language, subject content and approved teacher training.'],
  ['Engineering and specialist routes', 'Engineering mathematics, discipline fundamentals, professional subjects and official previous papers.'],
  ['Judiciary and healthcare', 'Law bare acts and judgment writing, or nursing foundations and clinical subjects, depending on the route.']
];

function listItems(values, empty = 'Not specified in this overview.') {
  const items = Array.isArray(values) && values.length ? values : [empty];
  return `<ul>${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`;
}

function examBrowseButton(field, value, label, count, note = '') {
  return `<button type="button" class="gov-exam-browse-card" data-gov-exam-filter="${e(field)}" data-gov-exam-value="${e(value)}"><span class="gov-exam-browse-count">${e(count)}</span><strong>${e(label)}</strong>${note ? `<small>${e(note)}</small>` : ''}<span class="gov-exam-browse-arrow" aria-hidden="true">→</span></button>`;
}

function examCard(exam) {
  const officialUrl = href(exam.officialUrl);
  const tags = [exam.category, exam.qualification, `Power ${exam.powerLevel}`, `Tier ${exam.prestigeTier}`].filter(Boolean);
  const stages = Array.isArray(exam.stages) ? exam.stages : [];
  const syllabus = Array.isArray(exam.syllabus) ? exam.syllabus : [];
  const resources = Array.isArray(exam.studyResources) ? exam.studyResources : [];
  const lastVerified = exam.lastVerified ? dateText(exam.lastVerified) : 'Not verified';
  const reviewedAt = exam.reviewedAt ? dateText(exam.reviewedAt) : dateText(examCatalog.reviewedAt);
  const qualificationRoute = exam.qualificationRoute || (exam.qualification === 'ITI/Diploma' ? 'Exact technical trade or discipline' : exam.qualification === 'B.Tech/Professional' ? 'Exact professional discipline' : 'Broad academic route; check the notice');
  const serviceNote = exam.careerText || 'The actual post or service depends on the official notification and selection process.';
  return `<article class="gov-exam-card" data-gov-exam-card data-gov-exam-id="${e(exam.id)}" data-gov-exam-search="${e(examSearchText(exam))}" data-gov-exam-qualification="${e(exam.qualification)}" data-gov-exam-category="${e(exam.category)}" data-gov-exam-tier="${e(exam.prestigeTier)}" data-gov-exam-power="${e(exam.powerLevel)}" data-gov-exam-competition="${e(exam.competition)}">
    <div class="gov-exam-card-top"><span class="gov-exam-category">${e(exam.category)}</span><span class="gov-exam-competition">${e(exam.competition)} competition</span></div>
    <h3>${e(exam.shortName)}</h3>
    <p class="gov-exam-name">${e(exam.name)}</p>
    <div class="gov-exam-tags">${tags.map(tag => `<span>${e(tag)}</span>`).join('')}</div>
    <p class="gov-exam-eligibility"><strong>Start here:</strong> ${e(exam.eligibilityText)}</p>
    <dl class="gov-exam-facts"><div><dt>Conducting body</dt><dd>${e(exam.conductingBody)}</dd></div><div><dt>Can lead toward</dt><dd>${e(serviceNote)}</dd></div><div><dt>Selection</dt><dd>${e(exam.selectionType || stages.join(' → '))}</dd></div><div><dt>Frequency</dt><dd>${e(exam.frequency)}</dd></div></dl>
    <details class="gov-exam-details"><summary>See eligibility, stages, syllabus and preparation</summary><div class="gov-exam-detail-grid"><div><h4>Eligibility & age</h4><p>${e(exam.eligibilityText)}</p><p><strong>Qualification route:</strong> ${e(qualificationRoute)}</p><p>${e(exam.ageText)}</p><p>${e(exam.relaxationText)}</p></div><div><h4>Selection & pattern</h4><p>${e(exam.patternText)}</p>${listItems(stages, 'Selection stages depend on the official notification.').replace('<ul>', '<ol>').replace('</ul>', '</ol>')}${exam.physical ? '<p class="gov-exam-alert">Physical standards or testing may apply.</p>' : ''}${exam.medical ? '<p class="gov-exam-alert">Medical standards may apply.</p>' : ''}</div><div><h4>Pay & career context</h4><p>${e(exam.salaryText)}</p><p>${e(exam.careerText)}</p><p class="gov-exam-editorial"><strong>WILSY responsibility band:</strong> ${e(exam.powerLevel)} · <strong>WILSY prestige band:</strong> ${e(exam.prestigeTier)}. These are editorial browse aids, not official rankings.</p></div><div><h4>What to study</h4>${listItems(syllabus)}<h4>Study resources</h4>${listItems(resources)}</div></div><p class="gov-exam-update"><strong>Guide reviewed:</strong> ${e(reviewedAt)} · <strong>Last notification verified:</strong> ${e(lastVerified)}. ${e(exam.updateNote)}</p></details>
    <div class="gov-exam-card-actions"><a href="${officialUrl}" target="_blank" rel="noopener noreferrer">Open official source <span aria-hidden="true">↗</span></a><span>${e(exam.officialLabel || exam.officialDomain)}</span></div>
  </article>`;
}

const searchText = job => [
  job.title,
  job.organization,
  job.ministryDepartment,
  job.category,
  job.level,
  job.gradeLevel,
  job.salaryPayBand,
  job.experienceEligibility,
  job.location,
  job.status,
  job.noticeNumber,
  job.sourceDomain
].filter(Boolean).join(' ');

const postingText = job => job.portalListingDate
  ? `Portal listing ${dateText(job.portalListingDate)}`
  : `Opening date ${dateText(job.openingDate)}`;

function jobCard(job) {
  const officialUrl = href(job.officialNoticeUrl);
  const sourceUrl = href(job.sourceUrl);
  return `<article class="gov-jobs-card" data-gov-jobs-card data-gov-jobs-id="${e(job.id)}" data-gov-jobs-search="${e(searchText(job))}" data-gov-jobs-level="${e(job.level)}" data-gov-jobs-category="${e(job.category)}" data-gov-jobs-location="${e(job.location)}" data-gov-jobs-status="${e(job.status)}" data-gov-jobs-source="${e(job.sourceDomain)}" data-gov-jobs-rank="${e(job.rank)}" data-gov-jobs-opening="${e(job.openingDate)}" data-gov-jobs-deadline="${e(job.deadline)}" data-state="open">
     <div class="gov-jobs-card-top"><span class="gov-jobs-rank">${e(`0${job.rank}`.slice(-2))}</span><span class="gov-jobs-status">${e(job.status)}</span></div>
     <p class="gov-jobs-card-kicker">${e(job.organization)}</p>
     <h3>${e(job.title)}</h3>
     <p class="gov-jobs-card-department">${e(job.ministryDepartment)}</p>
     <div class="gov-jobs-tags"><span>${e(job.category)}</span><span>${e(job.level)}</span><span>${e(job.location)}</span></div>
     <dl class="gov-jobs-facts">
       <div><dt>Pay band</dt><dd>${e(job.salaryPayBand)}</dd></div>
       <div><dt>Eligibility</dt><dd>${e(job.experienceEligibility)}</dd></div>
       <div><dt>Notice</dt><dd>${e(job.noticeNumber)}</dd></div>
       <div><dt>Posting / deadline</dt><dd>${e(postingText(job))} · ${e(dateText(job.deadline))}</dd></div>
     </dl>
     <p class="gov-jobs-deadline" data-gov-jobs-deadline-label>Deadline: ${e(dateText(job.deadline))}</p>
     <details class="gov-jobs-card-details"><summary>More notice context</summary><p><strong>Posting time:</strong> Not published by the source portal.</p><p><strong>Snapshot checked:</strong> ${e(dateText(snapshot.checkedAt))}</p><p><strong>Verification:</strong> ${e(job.verificationNote)}</p></details>
     <p class="gov-jobs-verification">${e(job.verificationNote)}</p>
     <div class="gov-jobs-card-actions"><a href="${officialUrl}" target="_blank" rel="noopener noreferrer">Open official notice</a><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Source: ${e(job.sourceDomain)}</a></div>
   </article>`;
}

const activeJobs = jobs.filter(job => String(job.status).toLowerCase() === 'open');
const locations = unique(jobs.map(job => job.location));
const levels = unique(jobs.map(job => job.level));
const categories = unique(jobs.map(job => job.category));
const statuses = unique(jobs.map(job => job.status));
const embedded = JSON.stringify(snapshot)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const embeddedExams = JSON.stringify(examCatalog)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const qualificationBrowse = qualificationLabels.map(label => examBrowseButton('qualification', label, label, countBy('qualification', label), qualificationNotes[label])).join('');
const categoryBrowse = categoryLabels.map(label => examBrowseButton('category', label, label, countBy('category', label))).join('');
const powerBrowse = [1, 2, 3, 4, 5].map(power => examBrowseButton('powerLevel', String(power), `Band ${power}`, countBy('powerLevel', power), `${powerBandNotes[power]}${powerExamples(power) ? ` · ${powerExamples(power)}` : ''}`)).join('');
const examPortals = [...new Map(exams.map(exam => [exam.officialDomain, exam])).values()]
  .sort((a, b) => text(a.officialDomain).localeCompare(text(b.officialDomain)))
  .map(exam => `<a class="gov-jobs-exam-portal" href="${href(exam.officialUrl)}" target="_blank" rel="noopener noreferrer"><span>${e(exam.officialDomain)}</span><strong>${e(exam.officialLabel || exam.conductingBody)}</strong><small>Open official exam or careers hub ↗</small></a>`)
  .join('');
const studyRoadmapMarkup = studyRoadmap.map(([title, copy], index) => `<article class="gov-study-step"><span>0${index + 1}</span><div><h3>${e(title)}</h3><p>${e(copy)}</p></div></article>`).join('');

export const governmentJobsPage = `<main id="main-content" class="gov-jobs-shell">
  <section class="gov-jobs-hero">
    <div class="gov-jobs-hero-copy">
      <p class="gov-jobs-eyebrow"><span aria-hidden="true"></span> WILSY / GOVERNMENT JOBS &amp; EXAMS</p>
      <h1>Start with your route.<br><span>Understand the system first.</span></h1>
      <p>Government recruitment is not one single exam. Explore career routes for 10th, 12th, ITI/Diploma, graduate, postgraduate and professional candidates, then check the official notification before you apply.</p>
      <div class="gov-jobs-hero-actions"><a class="gov-jobs-primary" href="#gov-jobs-qualification-browse">Choose by qualification <span aria-hidden="true">↓</span></a><a class="gov-jobs-secondary" href="#gov-jobs-live-notices">Browse live notices</a></div>
    </div>
    <aside class="gov-jobs-hero-panel" aria-label="Government jobs guide details"><p>BEGINNER GUIDE + LIVE INDEX</p><strong>${e(String(exams.length).padStart(2, '0'))}</strong><span>exam family overviews</span><div><b>${e(String(activeJobs.length).padStart(2, '0'))} live rows</b><small>separate from the guide</small></div></aside>
  </section>

  <section class="gov-jobs-notice gov-jobs-guide-notice" role="note" aria-label="Government jobs guide notice"><div class="gov-jobs-notice-mark" aria-hidden="true">i</div><div><p class="gov-jobs-eyebrow">HOW TO USE THIS PAGE</p><h2>A career guide even when there is no open post.</h2><p>The exam catalog explains what each route is, who conducts it, what you can study and where the official source lives. The live-notice index below is a separate dated snapshot and may have zero rows in another cycle.</p><p><strong>Guide reviewed:</strong> ${e(dateText(examCatalog.reviewedAt || examCatalog.checkedAt))} · <strong>Last notification verified:</strong> Not verified for these family overviews.</p></div></section>

  <section class="gov-jobs-metrics" aria-label="Snapshot metrics">
    <div><strong>${e(exams.length)}</strong><span>exam family overviews</span></div>
    <div><strong>${e(qualificationLabels.length)}</strong><span>qualification paths</span></div>
    <div><strong>${e(categoryLabels.length)}</strong><span>career families</span></div>
    <div><strong>${e(activeJobs.length)}</strong><span>live notice rows</span></div>
  </section>

  <section id="gov-jobs-qualification-browse" class="gov-jobs-guide-section" aria-labelledby="gov-jobs-qualification-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">STEP 01 / YOUR STARTING POINT</p><h2 id="gov-jobs-qualification-heading">Choose by qualification.</h2></div><p>Start with what you have today. Specialist routes may require an additional degree, trade, registration or teacher-training qualification.</p></div>
    <div class="gov-exam-browse-grid">${qualificationBrowse}</div>
  </section>

  <section id="gov-jobs-category-browse" class="gov-jobs-guide-section" aria-labelledby="gov-jobs-category-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">STEP 02 / CAREER FAMILIES</p><h2 id="gov-jobs-category-heading">Browse the government career landscape.</h2></div><p>Exam families are grouped for learning. A category does not mean every post has the same qualification, salary or service status.</p></div>
    <div class="gov-exam-browse-grid gov-exam-browse-grid-wide">${categoryBrowse}</div>
  </section>

  <section id="gov-jobs-tier-browse" class="gov-jobs-guide-section gov-jobs-ranking-section" aria-labelledby="gov-jobs-tier-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">STEP 03 / WILSY ORIENTATION</p><h2 id="gov-jobs-tier-heading">Explore responsibility bands.</h2></div><p>These bands are subjective WILSY editorial browse aids. They are not official government rankings, measured difficulty scores or appointment grades.</p></div>
    <div class="gov-exam-browse-grid gov-exam-browse-grid-five">${powerBrowse}</div>
    <p class="gov-jobs-editorial-note"><strong>Important:</strong> Group A, B, C and state Groups 1–4 labels are government or state-specific classification language, not one universal ranking system. Group D may also appear in some post classifications. APPSC and TGPSC group numbers are not automatically equivalent.</p>
  </section>

  <section id="gov-jobs-eligibility-finder" class="gov-jobs-guide-section gov-eligibility-section" aria-labelledby="gov-jobs-eligibility-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">STEP 04 / SHORTLIST, NOT A LEGAL DECISION</p><h2 id="gov-jobs-eligibility-heading">Find routes to review.</h2></div><p>Enter broad details to get a starting shortlist. The state field is only a target-recruitment browse preference, not a domicile test.</p></div>
    <form id="gov-jobs-eligibility-form" class="gov-eligibility-form">
      <label class="gov-jobs-field"><span>Highest broad qualification</span><select id="gov-jobs-eligibility-qualification" name="qualification" required><option value="">Choose qualification</option>${qualificationLabels.map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Age in years</span><input id="gov-jobs-eligibility-age" name="age" type="number" min="0" max="100" step="1" required placeholder="For example, 24"></label>
      <label class="gov-jobs-field"><span>Target recruitment state</span><select id="gov-jobs-eligibility-state" name="state"><option value="">Any state / All India</option>${stateLabels.slice(1).map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Reservation category (optional)</span><select id="gov-jobs-eligibility-category" name="category"><option value="">Not specified</option>${['General/EWS', 'OBC', 'SC', 'ST', 'PwBD', 'Ex-servicemen'].map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Physical stage preference</span><select id="gov-jobs-eligibility-physical" name="physical"><option value="">Any physical requirement</option><option value="true">Physical stage accepted</option><option value="false">Prefer no physical stage</option></select></label>
      <label class="gov-jobs-field"><span>Medical stage preference</span><select id="gov-jobs-eligibility-medical" name="medical"><option value="">Any medical requirement</option><option value="true">Medical stage accepted</option><option value="false">Prefer no medical stage</option></select></label>
      <button class="gov-jobs-primary" type="submit">Show potential routes <span aria-hidden="true">→</span></button>
    </form>
    <div id="gov-jobs-eligibility-results" class="gov-eligibility-results" aria-live="polite"><p class="gov-eligibility-empty">Enter your qualification and age to see a conservative starting shortlist.</p></div>
  </section>

  <section id="gov-jobs-study-roadmap" class="gov-jobs-guide-section gov-study-section" aria-labelledby="gov-jobs-study-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">STEP 05 / PREPARATION</p><h2 id="gov-jobs-study-heading">What should you study?</h2></div><p>Build a common foundation first, then switch to the syllabus and previous papers for the specific family.</p></div>
    <div class="gov-study-grid">${studyRoadmapMarkup}</div>
    <div class="gov-study-disclaimer"><strong>Study source rule:</strong> Prefer the official syllabus, information bulletin, previous question papers and old-paper repository. Coaching materials can supplement them, but cannot replace the live notification.</div>
  </section>

  <section id="gov-jobs-live-notices" class="gov-jobs-workspace gov-jobs-live-section" aria-labelledby="gov-jobs-results-heading">
    <div id="gov-jobs-search" class="gov-jobs-anchor" aria-hidden="true"></div>
    <form id="gov-jobs-search-form" class="gov-jobs-search" role="search"><label class="gov-jobs-sr-only" for="gov-jobs-query">Search government jobs</label><input id="gov-jobs-query" type="search" maxlength="200" placeholder="Search title, organization, department or location" autocomplete="off"><button type="submit">Search notices <span aria-hidden="true">→</span></button></form>
    <form id="gov-jobs-filters" class="gov-jobs-filters" aria-label="Filter government jobs">${select('gov-jobs-level', 'Level', levels, 'All levels')}${select('gov-jobs-category', 'Category', categories, 'All categories')}${select('gov-jobs-location', 'Location', locations, 'All locations')}${select('gov-jobs-status', 'Status', statuses, 'All statuses')}<button id="gov-jobs-reset" type="button">Reset filters</button></form>
    <div class="gov-jobs-toolbar"><div><p class="gov-jobs-eyebrow">LIVE NOTICE INDEX / OPTIONAL</p><h2 id="gov-jobs-results-heading" tabindex="-1"><span id="gov-jobs-result-count">${e(`${activeJobs.length} active government job notices`)}</span></h2></div><label class="gov-jobs-sort"><span>Sort by</span><select id="gov-jobs-sort" name="sort"><option value="seniority">Seniority</option><option value="deadline">Deadline</option><option value="newest">Newest opening</option></select></label></div>
    <p id="gov-jobs-feedback" class="gov-jobs-feedback" role="status" aria-live="polite"></p>
    <div id="gov-jobs-results" class="gov-jobs-results" aria-live="polite">${jobs.map(jobCard).join('')}<article id="gov-jobs-empty" class="gov-jobs-empty" hidden><p class="gov-jobs-eyebrow">NO MATCHES IN THIS SNAPSHOT</p><h3>Try a broader search.</h3><p>No official notice rows match those filters. Clear one or more filters, or open the source hubs for wider official discovery.</p><button id="gov-jobs-empty-reset" type="button" class="gov-jobs-secondary">Clear filters</button></article></div>
  </section>

  <section id="gov-jobs-exam-catalog" class="gov-jobs-guide-section gov-exam-catalog-section" aria-labelledby="gov-jobs-exam-heading">
    <div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">THE GUIDE CATALOG / ${e(exams.length)} FAMILIES</p><h2 id="gov-jobs-exam-heading">Understand the route before you apply.</h2></div><p>These are representative family overviews, not current vacancy promises. Open the official source on every card before relying on any qualification, age, fee, date or selection detail.</p></div>
    <form id="gov-jobs-exam-filters" class="gov-exam-filters" aria-label="Filter government exam families">
      <label class="gov-jobs-field gov-exam-query-field"><span>Search families</span><input id="gov-jobs-exam-query" type="search" maxlength="200" placeholder="Try UPSC, police, banking, nursing or engineer" autocomplete="off"></label>
      <label class="gov-jobs-field"><span>Qualification</span><select id="gov-jobs-exam-qualification"><option value="">All qualifications</option>${qualificationLabels.map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Career family</span><select id="gov-jobs-exam-category"><option value="">All career families</option>${categoryLabels.map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Responsibility band</span><select id="gov-jobs-exam-power"><option value="">All bands</option>${[1, 2, 3, 4, 5].map(value => option(value, `Band ${value}`)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Target state</span><select id="gov-jobs-exam-state"><option value="">Any state</option>${stateLabels.slice(1).map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Competition</span><select id="gov-jobs-exam-competition"><option value="">Any competition label</option>${unique(exams.map(exam => exam.competition)).map(value => option(value)).join('')}</select></label>
      <label class="gov-jobs-field"><span>Sort</span><select id="gov-jobs-exam-sort"><option value="power">Responsibility band</option><option value="qualification">Qualification path</option><option value="name">Name</option><option value="competition">Competition</option></select></label>
      <button id="gov-jobs-exam-reset" type="button">Reset guide filters</button>
    </form>
    <p id="gov-jobs-exam-feedback" class="gov-jobs-feedback" role="status" aria-live="polite"></p>
    <div class="gov-exam-toolbar"><strong id="gov-jobs-exam-result-count">${e(`${exams.length} exam family overviews`)}</strong><span>Guide reviewed ${e(dateText(examCatalog.reviewedAt || examCatalog.checkedAt))} · Last notification verified: Not verified</span></div>
    <div id="gov-jobs-exam-results" class="gov-exam-results" aria-live="polite">${exams.map(examCard).join('')}<article id="gov-jobs-exam-empty" class="gov-jobs-empty" hidden><p class="gov-jobs-eyebrow">NO GUIDE MATCHES</p><h3>Try a broader route.</h3><p>No exam family matches those guide filters. Clear a filter or browse by qualification above.</p><button id="gov-jobs-exam-empty-reset" type="button" class="gov-jobs-secondary">Clear guide filters</button></article></div>
  </section>

  <section id="gov-jobs-sources" class="gov-jobs-sources" aria-labelledby="gov-jobs-sources-heading"><div class="gov-jobs-section-heading"><div><p class="gov-jobs-eyebrow">WHERE TO APPLY / PRIMARY PORTALS / OFFICIAL SOURCE MAP</p><h2 id="gov-jobs-sources-heading">Go wider, from the source.</h2></div><p>Use the official recruiting authority for the live notification, application form, syllabus, fees, dates and final eligibility rules.</p></div><div class="gov-jobs-source-grid">${snapshot.sourceHubs.map(hub => `<a class="gov-jobs-source-card" href="${href(hub.url)}" target="_blank" rel="noopener noreferrer"><span class="gov-jobs-source-domain">${e(hub.domain)}</span><h3>${e(hub.name)}</h3><p>${e(hub.note)}</p><span class="gov-jobs-source-link">Open official hub <span aria-hidden="true">↗</span></span></a>`).join('')}</div><div id="gov-jobs-exam-portals" class="gov-jobs-exam-portals"><h3>Exam and careers hubs from the guide</h3><div class="gov-jobs-exam-portal-grid">${examPortals}</div></div></section>

  <section class="gov-jobs-methodology" aria-labelledby="gov-jobs-methodology-heading"><div><p class="gov-jobs-eyebrow">HOW TO READ THIS PAGE</p><h2 id="gov-jobs-methodology-heading">Learn the route. Then verify the notice.</h2></div><div class="gov-jobs-methodology-copy"><p>The guide catalog is a beginner reference and remains useful when there is no active post. It groups representative exam families by qualification and career area; it does not promise a vacancy, appointment, promotion, salary amount or service allocation.</p><p>The live notice index is a separate snapshot checked on ${e(snapshot.checkedAt)}. Rows are included only when the official recruiting page provides an official notice page and the deadline is current/open as of that check. The official notification remains the authority for exact qualifications, subjects, age, reservations, fees, physical and medical standards, selection stages and application instructions.</p><p>${e(examCatalog.classificationNote)} ${e(examCatalog.powerNote)} ${e(examCatalog.eligibilityNote)}</p><a class="gov-jobs-text-link" href="/methodology">Read WILSY’s wider source methodology <span aria-hidden="true">→</span></a></div></section>
</main>
<noscript><div class="gov-jobs-noscript">JavaScript is needed for search, filters and sorting. The official notice cards remain visible above, and the source hubs provide broader official discovery.</div></noscript>
<script type="application/json" id="gov-jobs-data">${embedded}</script>
<script type="application/json" id="gov-exams-data">${embeddedExams}</script>
<script type="module" src="/js/government-jobs.js"></script>`;

export {snapshot as governmentJobsSnapshot};
