import {escapeHtml as escape, safeHref} from './directory-core.js';
import {assessEligibility, filterGovernmentExams, sortGovernmentExams} from './government-exam-core.js';

const DAY = 24 * 60 * 60 * 1000;

const text = value => String(value ?? '').trim();
const lower = value => text(value).toLocaleLowerCase();
const escapeText = value => escape(value);
const dateValue = value => {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export function filterGovernmentJobs(rows, filters = {}) {
  const query = lower(filters.query);
  const words = query.split(/\s+/).filter(Boolean);
  return rows.filter(job => {
    const searchable = [
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
    ].map(lower).join(' ');
    if (words.length && !words.every(word => searchable.includes(word))) return false;
    if (filters.level && text(job.level) !== text(filters.level)) return false;
    if (filters.category && text(job.category) !== text(filters.category)) return false;
    if (filters.location && text(job.location) !== text(filters.location)) return false;
    if (filters.status && text(job.status) !== text(filters.status)) return false;
    return true;
  });
}

export function sortGovernmentJobs(rows, sort = 'seniority') {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sort === 'deadline') {
      const aDate = dateValue(a.deadline), bDate = dateValue(b.deadline);
      return (Number.isNaN(aDate) ? Number.MAX_SAFE_INTEGER : aDate) - (Number.isNaN(bDate) ? Number.MAX_SAFE_INTEGER : bDate) || Number(a.rank) - Number(b.rank);
    }
    if (sort === 'newest') {
      const aDate = dateValue(a.openingDate), bDate = dateValue(b.openingDate);
      return (Number.isNaN(bDate) ? -Infinity : bDate) - (Number.isNaN(aDate) ? -Infinity : aDate) || Number(a.rank) - Number(b.rank);
    }
    return Number(a.rank) - Number(b.rank) || text(a.id).localeCompare(text(b.id));
  });
  return sorted;
}

export function deadlineState(deadline, now = Date.now()) {
  const target = dateValue(deadline);
  if (Number.isNaN(target)) return {state: 'unknown', label: 'Deadline not provided'};
  const currentDate = new Date(Number.isFinite(now) ? now : Date.now());
  const today = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
  const days = Math.round((target - today) / DAY);
  if (days < 0) return {state: 'closed', label: 'Deadline passed'};
  if (days === 0) return {state: 'today', label: 'Due today'};
  if (days === 1) return {state: 'tomorrow', label: 'Due tomorrow'};
  return {state: 'open', label: `${days} days left`};
}

const dateText = value => {
  const parsed = dateValue(value);
  if (Number.isNaN(parsed)) return 'date not provided';
  return new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(parsed));
};

function start() {
  const dataElement = document.getElementById('gov-jobs-data');
  const results = document.getElementById('gov-jobs-results');
  if (!dataElement || !results) return;
  let snapshot;
  try { snapshot = JSON.parse(dataElement.textContent || '{}'); } catch { snapshot = {}; }
  const jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : [];
  const cards = [...results.querySelectorAll('[data-gov-jobs-card]')];
  const cardById = new Map(cards.map(card => [card.dataset.govJobsId, card]));
  const empty = document.getElementById('gov-jobs-empty');
  const query = document.getElementById('gov-jobs-query');
  const sort = document.getElementById('gov-jobs-sort');
  const resultCount = document.getElementById('gov-jobs-result-count');
  const feedback = document.getElementById('gov-jobs-feedback');
  const searchForm = document.getElementById('gov-jobs-search-form');
  const filtersForm = document.getElementById('gov-jobs-filters');
  const resetButtons = [document.getElementById('gov-jobs-reset'), document.getElementById('gov-jobs-empty-reset')].filter(Boolean);
  const state = {query: '', level: '', category: '', location: '', status: '', sort: sort?.value || 'seniority'};

  const updateDeadline = card => {
    const label = card.querySelector('[data-gov-jobs-deadline-label]');
    if (!label) return;
    const current = deadlineState(card.dataset.govJobsDeadline);
    label.textContent = `${current.label} · ${dateText(card.dataset.govJobsDeadline)}`;
    label.dataset.govJobsDeadlineState = current.state;
    card.dataset.state = current.state === 'closed' ? 'closed' : (['today', 'tomorrow'].includes(current.state) ? 'closing' : 'open');
    const status = card.querySelector('.gov-jobs-status');
    if (status && current.state === 'closed') status.textContent = 'Deadline passed';
  };
  cards.forEach(updateDeadline);

  function render() {
    const matching = sortGovernmentJobs(filterGovernmentJobs(jobs, state), state.sort);
    const matchingIds = new Set(matching.map(job => text(job.id)));
    const orderedCards = [];
    for (const job of matching) {
      const card = cardById.get(text(job.id));
      if (card) orderedCards.push(card);
    }
    for (const card of cards) {
      card.hidden = !matchingIds.has(text(card.dataset.govJobsId));
      if (!matchingIds.has(text(card.dataset.govJobsId))) orderedCards.push(card);
    }
    for (const card of orderedCards) results.append(card);
    if (empty) {
      empty.hidden = matching.length > 0;
      results.append(empty);
    }
    if (resultCount) resultCount.textContent = `${matching.length} active government job notice${matching.length === 1 ? '' : 's'}`;
    if (feedback) feedback.textContent = matching.length ? '' : 'No rows match these filters. The source hubs below may have broader official coverage.';
  }

  const clear = () => {
    state.query = '';
    state.level = '';
    state.category = '';
    state.location = '';
    state.status = '';
    state.sort = 'seniority';
    if (query) query.value = '';
    filtersForm?.querySelectorAll('select').forEach(selectElement => { selectElement.value = ''; });
    if (sort) sort.value = state.sort;
    render();
  };

  searchForm?.addEventListener('submit', event => { event.preventDefault(); state.query = query?.value || ''; render(); });
  query?.addEventListener('input', () => { state.query = query.value; render(); });
  filtersForm?.addEventListener('change', event => {
    const field = event.target;
    if (!(field instanceof HTMLSelectElement)) return;
    const key = field.id.replace(/^gov-jobs-/, '');
    if (key in state) { state[key] = field.value; render(); }
  });
  sort?.addEventListener('change', () => { state.sort = sort.value; render(); });
  resetButtons.forEach(button => button.addEventListener('click', clear));
  render();
}

function readJsonScript(id, fallback = {}) {
  const element = document.getElementById(id);
  if (!element) return fallback;
  try { return JSON.parse(element.textContent || '{}'); } catch { return fallback; }
}

function optionalBooleanValue(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  return value === 'true';
}

function eligibilityResultCard(exam, assessment) {
  const official = safeHref(exam.officialUrl);
  const statusLabel = assessment.status === 'potential' ? 'Potential route' : 'Review before applying';
  return `<article class="gov-eligibility-result gov-eligibility-result-${escapeText(assessment.status)}"><div><span class="gov-eligibility-status">${escapeText(statusLabel)}</span><span class="gov-eligibility-family">${escapeText(exam.category)}</span></div><h3>${escapeText(exam.shortName)}</h3><p>${escapeText(exam.eligibilityText)}</p><p class="gov-eligibility-reason">${escapeText(assessment.reasons[0] || 'Read the official notification for the exact rule.')}</p><a href="${escape(official)}" target="_blank" rel="noopener noreferrer">Open official source ↗</a></article>`;
}

function startExamGuide() {
  const data = readJsonScript('gov-exams-data', {});
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const results = document.getElementById('gov-jobs-exam-results');
  const examQuery = document.getElementById('gov-jobs-exam-query');
  const examFilters = document.getElementById('gov-jobs-exam-filters');
  const examReset = document.getElementById('gov-jobs-exam-reset');
  const examEmptyReset = document.getElementById('gov-jobs-exam-empty-reset');
  const examResultCount = document.getElementById('gov-jobs-exam-result-count');
  const examFeedback = document.getElementById('gov-jobs-exam-feedback');
  const examEmpty = document.getElementById('gov-jobs-exam-empty');
  const eligibilityForm = document.getElementById('gov-jobs-eligibility-form');
  const eligibilityResults = document.getElementById('gov-jobs-eligibility-results');
  if (!results || !exams.length) return;

  const cards = [...results.querySelectorAll('[data-gov-exam-card]')];
  const cardById = new Map(cards.map(card => [card.dataset.govExamId, card]));
  const state = {query: '', qualification: '', category: '', powerLevel: '', state: '', competition: '', sort: 'power'};

  function renderExamCatalog() {
    const matching = sortGovernmentExams(filterGovernmentExams(exams, state), state.sort);
    const matchingIds = new Set(matching.map(exam => text(exam.id)));
    const ordered = [];
    for (const exam of matching) {
      const card = cardById.get(text(exam.id));
      if (card) ordered.push(card);
    }
    for (const card of cards) {
      const visible = matchingIds.has(text(card.dataset.govExamId));
      card.hidden = !visible;
      if (!visible) ordered.push(card);
    }
    for (const card of ordered) results.append(card);
    if (examEmpty) examEmpty.hidden = matching.length > 0;
    if (examResultCount) examResultCount.textContent = `${matching.length} exam family overview${matching.length === 1 ? '' : 's'}`;
    if (examFeedback) examFeedback.textContent = matching.length ? '' : 'No guide families match these filters. Try a broader qualification or career family.';
  }

  function clearExamFilters() {
    state.query = '';
    state.qualification = '';
    state.category = '';
    state.powerLevel = '';
    state.state = '';
    state.competition = '';
    state.sort = 'power';
    if (examQuery) examQuery.value = '';
    examFilters?.querySelectorAll('select').forEach(select => { select.value = select.id === 'gov-jobs-exam-sort' ? 'power' : ''; });
    renderExamCatalog();
  }

  examQuery?.addEventListener('input', () => { state.query = examQuery.value; renderExamCatalog(); });
  examFilters?.addEventListener('change', event => {
    const field = event.target;
    if (!(field instanceof HTMLSelectElement)) return;
    const key = field.id.replace(/^gov-jobs-exam-/, '');
    if (key in state) { state[key] = field.value; renderExamCatalog(); }
  });
  examReset?.addEventListener('click', clearExamFilters);
  examEmptyReset?.addEventListener('click', clearExamFilters);
  function applyGuideBrowse(field, value) {
    if (field === 'powerLevel') state.powerLevel = value;
    if (field === 'qualification') state.qualification = value;
    if (field === 'category') state.category = value;
    renderExamCatalog();
    document.getElementById('gov-jobs-exam-catalog')?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  // Delegation keeps the browse cards working after the catalog is reordered.
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-gov-exam-filter]') : null;
    if (!button) return;
    event.preventDefault();
    applyGuideBrowse(button.dataset.govExamFilter, button.dataset.govExamValue || '');
  });

  eligibilityForm?.addEventListener('submit', event => {
    event.preventDefault();
    const qualification = document.getElementById('gov-jobs-eligibility-qualification')?.value || '';
    const ageInput = document.getElementById('gov-jobs-eligibility-age');
    const age = Number(ageInput?.value);
    if (!qualification || !Number.isFinite(age) || age < 0 || age > 100) {
      eligibilityResults.innerHTML = '<p class="gov-eligibility-empty">Choose a supported qualification and an age from 0 to 100.</p>';
      return;
    }
    const targetState = document.getElementById('gov-jobs-eligibility-state')?.value || '';
    const category = document.getElementById('gov-jobs-eligibility-category')?.value || '';
    const physical = optionalBooleanValue(document.getElementById('gov-jobs-eligibility-physical')?.value);
    const medical = optionalBooleanValue(document.getElementById('gov-jobs-eligibility-medical')?.value);
    let candidates = filterGovernmentExams(exams, {state: targetState, physical, medical});
    const assessed = candidates.map(exam => ({exam, assessment: assessEligibility(exam, {qualification, age, state: targetState, category})}))
      .filter(item => ['potential', 'review'].includes(item.assessment.status));
    const resultsByStatus = assessed.sort((left, right) => (left.assessment.status === 'potential' ? -1 : 1) - (right.assessment.status === 'potential' ? -1 : 1));
    if (!resultsByStatus.length) {
      eligibilityResults.innerHTML = '<p class="gov-eligibility-empty">No broad routes matched. Try a different qualification path, or read the official notices for specialist exceptions.</p>';
      return;
    }
    eligibilityResults.innerHTML = `<div class="gov-eligibility-summary"><strong>${resultsByStatus.length} starting route${resultsByStatus.length === 1 ? '' : 's'}</strong><span>Potential and review results only. This is not a legal eligibility decision.</span></div><div class="gov-eligibility-grid">${resultsByStatus.slice(0, 18).map(item => eligibilityResultCard(item.exam, item.assessment)).join('')}</div>`;
  });

  renderExamCatalog();
}

if (typeof document !== 'undefined') {
  start();
  startExamGuide();
}
