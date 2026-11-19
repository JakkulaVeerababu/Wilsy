import {DRAFT_KEY, MAX_ENTRIES, MAIN_FIELDS, ENTRY_FIELDS, cleanDraft, emptyDraft, newEntry, resumeHtml, resumeText, resumeChecks, checksHtml, entryForm, isEmptyDraft, EXAMPLE} from './resume-builder-core.js';
import {RESUME_HANDOFF} from './resume-core.js';
import {track} from './analytics.js';

// /resume-builder: the draft lives in this browser (localStorage while "Save on this device" is ticked).
// The preview is an A4 sheet scaled to fit, so the page count matches the PDF.
const form = document.querySelector('[data-rb-form]');
if(form) {
  const root = document.querySelector('[data-rb]');
  const paper = root.querySelector('[data-rb-preview]'), checks = root.querySelector('[data-rb-checks]');
  const status = root.querySelector('[data-rb-status]'), pages = root.querySelector('[data-rb-pages]');
  const keep = form.querySelector('[data-rb-keep]'), printCopy = document.querySelector('[data-rb-print]');
  const LISTS = Object.keys(ENTRY_FIELDS);
  const A4 = {width: 794, height: 1123, margin: 53};
  const usedVia = new Set();
  let timer, title = document.title;

  const load = () => { try { const raw = localStorage.getItem(DRAFT_KEY); if(raw) return cleanDraft(JSON.parse(raw)); } catch {} return emptyDraft(); };
  let draft = load();
  const save = () => { try { if(keep.checked && !isEmptyDraft(draft)) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); else localStorage.removeItem(DRAFT_KEY); } catch {} };
  const used = via => { if(!usedVia.has(via)) { usedVia.add(via); track('tool_use', {tool: 'resume_builder', via}); } };
  const say = text => { status.textContent = text; };

  const drawList = list => {
    form.querySelector(`[data-rb-entries="${list}"]`).innerHTML = draft[list].map((entry, i) => entryForm(list, entry, i)).join('');
    form.querySelector(`[data-rb-add="${list}"]`).hidden = draft[list].length >= MAX_ENTRIES;
  };
  const fillForm = () => {
    for(const [key] of MAIN_FIELDS) form.querySelector(`[data-rb-key="${key}"]:not([data-rb-list])`).value = draft[key];
    form.querySelector('[data-rb-key="educationFirst"]').checked = draft.educationFirst;
    LISTS.forEach(drawList);
  };
  // Scale the A4 sheet to the column, and count the pages it will print on.
  const fit = () => {
    const sheet = paper.querySelector('.resume-sheet');
    if(!sheet) return;
    const scale = Math.min(1, paper.clientWidth / A4.width) || 1;
    sheet.style.setProperty('--rb-scale', scale);
    paper.style.height = Math.ceil(sheet.offsetHeight * scale) + 'px';
    const count = Math.max(1, Math.ceil((sheet.scrollHeight - 2 * A4.margin - 2) / (A4.height - 2 * A4.margin)));
    pages.textContent = isEmptyDraft(draft) ? '' : count === 1 ? 'Fits on one page' : `Runs to ${count} pages`;
    pages.classList.toggle('is-over', count > 1);
  };
  const render = () => {
    paper.innerHTML = resumeHtml(draft);
    checks.innerHTML = checksHtml(isEmptyDraft(draft) ? [] : resumeChecks(draft));
    fit();
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(() => { render(); save(); }, 120); };

  form.addEventListener('input', event => {
    const t = event.target, key = t.dataset.rbKey;
    if(!key) return;
    if(t.dataset.rbList) { const entry = draft[t.dataset.rbList]?.[Number(t.dataset.rbIndex)]; if(entry) entry[key] = t.value; }
    else if(key === 'educationFirst') draft.educationFirst = t.checked;
    else draft[key] = t.value;
    later();
  });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('click', event => {
    const add = event.target.closest('[data-rb-add]'), remove = event.target.closest('[data-rb-remove]');
    if(add) {
      const list = add.dataset.rbAdd;
      if(draft[list].length >= MAX_ENTRIES) return;
      draft[list].push(newEntry(list));
      drawList(list);
      form.querySelector(`[data-rb-list="${list}"][data-rb-index="${draft[list].length - 1}"]`)?.focus();
      later();
    }
    if(remove) {
      const list = remove.dataset.rbRemove, index = Number(remove.dataset.rbIndex), entry = draft[list]?.[index];
      if(!entry || (Object.values(entry).some(v => v.trim()) && !confirm('Remove this entry?'))) return;
      draft[list].splice(index, 1);
      drawList(list);
      form.querySelector(`[data-rb-add="${list}"]`).focus();
      later();
    }
  });
  keep.addEventListener('change', () => { save(); say(keep.checked ? 'Your resume is saved on this device.' : 'Your resume is no longer saved on this device. It is gone when you close the page.'); });
  root.querySelector('[data-rb-example]').addEventListener('click', () => {
    if(!isEmptyDraft(draft) && !confirm('Replace what you have written with the example?')) return;
    draft = cleanDraft(EXAMPLE);
    fillForm(); render(); save();
    say('Example filled in. Replace it with your own details.');
  });
  root.querySelector('[data-rb-clear]').addEventListener('click', () => {
    if(isEmptyDraft(draft) || !confirm('Clear the whole resume? This can’t be undone.')) return;
    draft = emptyDraft();
    fillForm(); render(); save();
    say('Cleared.');
    form.querySelector('[data-rb-key="name"]').focus();
  });

  const ready = () => { if(isEmptyDraft(draft)) { say('Fill in the form first.'); return false; } return true; };
  // Saving as a PDF goes through the print dialog; the file is named after the person.
  const beforePrint = () => { printCopy.innerHTML = resumeHtml(draft); title = document.title; document.title = `${draft.name.trim() || 'My'} resume`; };
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', () => { document.title = title; });
  root.querySelector('[data-rb-pdf]').addEventListener('click', () => { if(!ready()) return; used('pdf'); beforePrint(); window.print(); });
  root.querySelector('[data-rb-copy]').addEventListener('click', async () => {
    if(!ready()) return;
    try { await navigator.clipboard.writeText(resumeText(draft)); say('Copied as plain text, ready to paste into an application form.'); used('text'); }
    catch { say('Couldn’t copy. Your browser blocked it.'); }
  });
  root.querySelector('[data-rb-match]').addEventListener('click', () => {
    if(!ready()) return;
    try { sessionStorage.setItem(RESUME_HANDOFF, resumeText(draft)); } catch {}
    used('match');
    location.href = '/resume-match';
  });

  fillForm();
  render();
  if('ResizeObserver' in window) new ResizeObserver(fit).observe(paper);
  else window.addEventListener('resize', fit);
  document.fonts?.ready.then(fit);
}
