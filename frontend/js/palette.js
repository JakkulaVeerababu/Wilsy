import {searchJobs} from './data-client.js';
import {jobPath} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {search, score, readRecent} from './palette-core.js';

// Quick search dialog (Ctrl/⌘ K, or the search button in the header). Loaded on first use by features.js.
// Pages, companies and guides come from a small static index; jobs come from the live public search.
const QUICK = [
  ['Find jobs', '/jobs', 'Search every live role'],
  ['Application tracker', '/tracker', 'Saved → Applied → Interviewing → Offer'],
  ['Saved jobs', '/jobs?saved=1', 'Roles you saved'],
  ['Salary explorer', '/salaries', 'Pay at 1,000 companies, in INR'],
  ['In-hand salary calculator', '/salary-calculator', 'CTC to monthly take-home'],
  ['Compare job offers', '/offer-compare', 'Which offer pays more in hand'],
  ['Resume match', '/resume-match', 'Check your resume against a job'],
  ['Hiring trends', '/hiring-trends', 'What is hiring right now'],
  ['Hackathons', '/hackathons', 'Open challenges and prizes'],
  ['DSA roadmap', '/dsa', 'Interview patterns and practice'],
];
const GROUP_NAMES = {job: 'Live jobs', page: 'Pages', company: 'Companies', guide: 'Guides & programmes', recent: 'Recently viewed', quick: 'Go to'};
let dialog, input, list, status, index = null, items = [], active = 0, jobs = [], jobsFor = '', timer, controller, opener;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'palette';
  dialog.setAttribute('aria-labelledby', 'palette-title');
  dialog.innerHTML = `<div class="palette-panel"><h2 id="palette-title" class="sr-only">Quick search</h2>
    <div class="palette-field"><svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input id="palette-input" type="search" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search jobs, companies, pages…" aria-label="Search jobs, companies and pages">
      <button class="palette-close" type="button" data-palette-close>Esc</button></div>
    <ul id="palette-list" class="palette-list" role="listbox" aria-label="Results"></ul>
    <p class="palette-status" role="status" aria-live="polite"></p>
    <p class="palette-hint" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></p></div>`;
  document.body.append(dialog);
  input = dialog.querySelector('input'); list = dialog.querySelector('ul'); status = dialog.querySelector('.palette-status');
  input.addEventListener('input', () => { active = 0; render(); queueJobs(); });
  input.addEventListener('keydown', onKey);
  dialog.addEventListener('click', event => {
    if(event.target === dialog || event.target.closest('[data-palette-close]')) dialog.close();
    const option = event.target.closest('[role="option"]');
    if(option) { active = Number(option.dataset.index); go(); event.preventDefault(); }
  });
  list.addEventListener('mousemove', event => { const option = event.target.closest('[role="option"]'); if(option && Number(option.dataset.index) !== active) { active = Number(option.dataset.index); highlight(); } });
  dialog.addEventListener('close', () => { controller?.abort(); opener?.focus?.({preventScroll: true}); });
}

function results() {
  const q = input.value.trim(), out = [];
  const add = (group, entries) => entries.forEach(entry => out.push({group, ...entry}));
  if(!q) {
    let recent = [];
    try { recent = readRecent(localStorage); } catch {}
    add('recent', recent.slice(0, 5).map(j => ({t: j.title, u: j.path, d: j.company})));
    add('quick', QUICK.map(([t, u, d]) => ({t, u, d})));
    return out;
  }
  add('quick', [{t: `Search jobs for “${q}”`, u: '/jobs?q=' + encodeURIComponent(q), d: 'All live roles that match'}]);
  // A page, company or guide whose name matches well (an exact name, or every word starting a name word) comes
  // before the live jobs, so "stripe" opens with the Stripe profile; weaker keyword matches follow the jobs.
  const found = index ? search(index, q) : {};
  const groups = ['page', 'company', 'guide'].filter(g => found[g]?.length);
  const strong = groups.filter(g => score(found[g][0], q) >= 60);
  for(const g of strong) add(g, found[g]);
  if(jobsFor === q) add('job', jobs);
  for(const g of groups) if(!strong.includes(g)) add(g, found[g]);
  return out;
}
function render() {
  items = results();
  let last = '';
  list.innerHTML = items.map((item, i) => {
    const head = item.group !== last ? `<li class="palette-group" role="presentation">${GROUP_NAMES[item.group]}</li>` : '';
    last = item.group;
    return `${head}<li id="palette-option-${i}" class="palette-option" role="option" data-index="${i}" aria-selected="${i === active}"><a href="${e(item.u)}" tabindex="-1"><strong>${e(item.t)}</strong>${item.d ? `<span>${e(item.d)}</span>` : ''}</a></li>`;
  }).join('');
  highlight();
  const q = input.value.trim();
  status.textContent = q ? `${items.length} result${items.length === 1 ? '' : 's'}${q.length >= 2 && jobsFor !== q ? '. Searching live jobs…' : ''}` : '';
}
function highlight() {
  list.querySelectorAll('[role="option"]').forEach(option => option.setAttribute('aria-selected', String(Number(option.dataset.index) === active)));
  const current = list.querySelector(`#palette-option-${active}`);
  input.setAttribute('aria-activedescendant', current ? current.id : '');
  current?.scrollIntoView({block: 'nearest'});
}
function onKey(event) {
  if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if(items.length) active = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    highlight();
  } else if(event.key === 'Enter') { event.preventDefault(); go(event.ctrlKey || event.metaKey); }
}
function go(newTab = false) {
  const item = items[active]; if(!item) return;
  if(newTab) window.open(item.u, '_blank', 'noopener'); else location.href = item.u;
}
function queueJobs() {
  clearTimeout(timer);
  const q = input.value.trim();
  if(q.length < 2) return;
  timer = setTimeout(async () => {
    controller?.abort(); controller = new AbortController();
    try {
      const result = await searchJobs({q}, 0, controller.signal);
      if(input.value.trim() !== q) return;
      jobs = (result.jobs || []).slice(0, 5).map(job => ({t: job.title, u: jobPath(job), d: [job.company, job.location || job.country].filter(Boolean).join(' · ')}));
      jobsFor = q; render();
    } catch(error) { if(error?.name !== 'AbortError' && input.value.trim() === q) { jobsFor = q; jobs = []; render(); status.textContent = 'Live jobs couldn’t load. Pages and companies still work.'; } }
  }, 220);
}

export async function open() {
  if(!dialog) build();
  if(dialog.open) { input.focus(); return; }
  opener = document.activeElement;
  input.value = ''; active = 0; render();
  dialog.showModal(); input.focus();
  if(!index) {
    try { index = await (await fetch('/data/search-index.json')).json(); } catch { index = []; }
    if(input.value.trim()) render();
  }
}
