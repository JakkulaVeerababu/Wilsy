import {searchJobs} from './data-client.js';
import {readSaved, jobPath, jobSalary} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {announceSaved} from './ui-helpers.js';
import {track} from './analytics.js';
import {STAGES, readTracker, writeTracker, snapshot, syncSaved, setStage, setNotes, removeItem, columns, toCsv, TRACKER_KEY} from './tracker-core.js';

// The /tracker page: a board of saved roles by application stage. Everything stays in this browser.
const root = document.querySelector('[data-tracker]');
if(root) start(root);

function start(root) {
  const board = root.querySelector('.tracker-board'), status = root.querySelector('[data-tracker-status]');
  const fx = JSON.parse(root.querySelector('#tracker-fx')?.textContent || '{}');
  let tracker = {version: 1, items: {}}, storageOk = true, missing = 0;
  try { tracker = readTracker(localStorage); } catch { storageOk = false; }
  const say = message => { status.textContent = message; };
  const saveBoard = next => {
    tracker = next;
    try { writeTracker(localStorage, tracker); } catch { storageOk = false; say('This browser is blocking storage, so changes last only until you leave the page.'); }
  };
  const dateLabel = iso => iso ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short'}).format(new Date(iso)) : '';
  const stageOptions = current => STAGES.map(([id, name]) => `<option value="${id}"${id === current ? ' selected' : ''}>${name}</option>`).join('');

  function card(item) {
    const since = item.history[item.stage] || item.addedAt;
    const title = item.path ? `<a class="tracker-title" href="${e(item.path)}">${e(item.title)}</a>` : `<span class="tracker-title">${e(item.title)}</span>`;
    return `<li class="tracker-card" draggable="true" data-id="${e(item.id)}">
      <p class="tracker-company">${e(item.company)}</p>${title}
      ${item.place || item.pay ? `<p class="tracker-meta">${[item.place, item.pay].filter(Boolean).map(e).join(' · ')}</p>` : ''}
      <div class="tracker-row"><label class="sr-only" for="stage-${e(item.id)}">Stage for ${e(item.title)}</label><select id="stage-${e(item.id)}" data-stage="${e(item.id)}">${stageOptions(item.stage)}</select>${since ? `<span class="tracker-since">since ${e(dateLabel(since))}</span>` : ''}</div>
      <details class="tracker-notes"${item.notes ? ' open' : ''}><summary>Notes${item.notes ? '' : ' <span>(add)</span>'}</summary><label class="sr-only" for="notes-${e(item.id)}">Notes for ${e(item.title)}</label><textarea id="notes-${e(item.id)}" data-notes="${e(item.id)}" rows="3" maxlength="2000" placeholder="Recruiter, interview date, follow-up…">${e(item.notes)}</textarea></details>
      <div class="tracker-actions">${item.apply ? `<a href="${e(item.apply)}" target="_blank" rel="noopener noreferrer">Employer page</a>` : ''}<button type="button" data-remove="${e(item.id)}" aria-label="Remove ${e(item.title)} from the tracker">Remove</button></div>
    </li>`;
  }
  function render() {
    const cols = columns(tracker), total = Object.keys(tracker.items).length;
    board.innerHTML = cols.map(col => `<section class="tracker-col" data-col="${col.id}" aria-labelledby="col-${col.id}">
      <h2 id="col-${col.id}">${col.name} <span>${col.items.length}</span></h2>
      <ol class="tracker-list">${col.items.map(card).join('') || `<li class="tracker-empty">${col.id === 'saved' ? 'Save roles on <a href="/jobs">Find jobs</a> to start.' : 'Drag a card here or pick this stage.'}</li>`}</ol></section>`).join('');
    const count = id => cols.find(c => c.id === id).items.length;
    const moved = total - count('saved');
    root.querySelector('[data-tracker-summary]').innerHTML = total
      ? `<strong>${total}</strong> role${total === 1 ? '' : 's'} tracked · <strong>${moved}</strong> applied or further · <strong>${count('interviewing') + count('offer')}</strong> in interviews or offers`
      : 'No roles yet. Save a job and it appears under Saved.';
    root.querySelector('[data-export]').disabled = !total;
  }
  function move(id, stage) {
    const item = tracker.items[id]; if(!item || item.stage === stage) return;
    saveBoard(setStage(tracker, id, stage)); render();
    const name = STAGES.find(([key]) => key === stage)[1];
    say(`${item.title} moved to ${name}.`);
    track('tracker_move', {stage});
    document.getElementById('stage-' + id)?.focus({preventScroll: true});
  }

  board.addEventListener('change', event => { const select = event.target.closest('[data-stage]'); if(select) move(select.dataset.stage, select.value); });
  let typing;
  board.addEventListener('input', event => {
    const field = event.target.closest('[data-notes]'); if(!field) return;
    clearTimeout(typing);
    typing = setTimeout(() => { saveBoard(setNotes(tracker, field.dataset.notes, field.value)); say('Notes saved on this device.'); }, 500);
  });
  board.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]'); if(!remove) return;
    const id = remove.dataset.remove, item = tracker.items[id];
    saveBoard(removeItem(tracker, id));
    // Unsave it too, or the next sync would bring it straight back under Saved.
    try { localStorage.setItem('wilsy-saved-jobs', JSON.stringify(readSaved(localStorage).filter(v => v !== id))); announceSaved(); } catch {}
    render(); say(`${item?.title || 'Role'} removed from the tracker and your saved jobs.`);
    root.querySelector('[data-tracker-summary]').focus?.();
  });
  // Drag and drop between columns; the stage menu on each card does the same with a keyboard.
  board.addEventListener('dragstart', event => { const c = event.target.closest('.tracker-card'); if(!c) return; event.dataTransfer.setData('text/plain', c.dataset.id); event.dataTransfer.effectAllowed = 'move'; c.classList.add('is-dragging'); });
  board.addEventListener('dragend', event => { event.target.closest?.('.tracker-card')?.classList.remove('is-dragging'); board.querySelectorAll('.is-over').forEach(c => c.classList.remove('is-over')); });
  board.addEventListener('dragover', event => { const col = event.target.closest('[data-col]'); if(!col) return; event.preventDefault(); board.querySelectorAll('.is-over').forEach(c => c !== col && c.classList.remove('is-over')); col.classList.add('is-over'); });
  board.addEventListener('drop', event => { const col = event.target.closest('[data-col]'); if(!col) return; event.preventDefault(); col.classList.remove('is-over'); move(event.dataTransfer.getData('text/plain'), col.dataset.col); });

  root.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob(['﻿' + toCsv(tracker, location.origin)], {type: 'text/csv;charset=utf-8'});
    const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: `wilsy-applications-${new Date().toISOString().slice(0, 10)}.csv`});
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    say('Spreadsheet downloaded.');
  });

  // Saved roles come from the public search, 20 at a time; only listings that are still live come back.
  async function loadSaved() {
    let saved = [];
    try { saved = readSaved(localStorage); } catch {}
    const details = new Map();
    if(saved.length) {
      try {
        for(let offset = 0; offset < saved.length; offset += 20) {
          const result = await searchJobs({saved}, offset);
          for(const job of result.jobs || []) details.set(String(job.id), snapshot(job, {path: jobPath(job), pay: jobSalary(job, fx).primary}));
          if(!result.jobs?.length || offset + 20 >= (result.total ?? 0)) break;
        }
      } catch { say('Couldn’t refresh saved roles from the live search. Showing the board as it was.'); return; }
    }
    const next = syncSaved(tracker, saved, details);
    missing = saved.filter(id => !next.items[id]).length;
    saveBoard(next); render();
    if(missing) say(`${missing} saved role${missing === 1 ? ' is' : 's are'} no longer listed and can’t be added.`);
  }
  addEventListener('storage', event => {
    if(event.key === TRACKER_KEY) { try { tracker = readTracker(localStorage); render(); } catch {} }
    if(event.key === 'wilsy-saved-jobs') loadSaved();
  });
  addEventListener('wilsy:saved', () => loadSaved());
  render();
  if(!storageOk) say('This browser is blocking storage, so the tracker can’t keep your board.');
  loadSaved();
}
