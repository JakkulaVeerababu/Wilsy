import {searchJobs} from './data-client.js';
import {readSaved, jobPath, jobSalary} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {announceSaved} from './ui-helpers.js';
import {track} from './analytics.js';
import {eventActions} from './calendar-core.js';
import {STAGES, readTracker, writeTracker, snapshot, syncSaved, setStage, setNotes, removeItem, columns, toCsv, TRACKER_KEY,
  isCustom, addCustom, setNext, upcoming, fromShare, setContact, needsFollowUp, funnel, closedAt} from './tracker-core.js';

// The /tracker page: a board of saved roles by application stage, plus roles added by hand from any
// other site, with the next step (an interview, a test) on each. Everything stays in this browser.
const root = document.querySelector('[data-tracker]');
if(root) start(root);

function start(root) {
  const board = root.querySelector('.tracker-board'), status = root.querySelector('[data-tracker-status]');
  const adder = root.querySelector('[data-add]'), addForm = root.querySelector('[data-add-form]'), addError = root.querySelector('[data-add-error]');
  const soon = root.querySelector('[data-upcoming]');
  const fx = JSON.parse(root.querySelector('#tracker-fx')?.textContent || '{}');
  let tracker = {version: 1, items: {}}, storageOk = true, missing = 0;
  try { tracker = readTracker(localStorage); } catch { storageOk = false; }
  const say = message => { status.textContent = message; };
  const saveBoard = next => {
    tracker = next;
    try { writeTracker(localStorage, tracker); } catch { storageOk = false; say('This browser is blocking storage, so changes last only until you leave the page.'); }
  };
  const dateLabel = iso => iso ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short'}).format(new Date(iso)) : '';
  const whenLabel = iso => new Intl.DateTimeFormat('en-IN', {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
  const pad = n => String(n).padStart(2, '0');
  const localInput = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const stageOptions = current => STAGES.map(([id, name]) => `<option value="${id}"${id === current ? ' selected' : ''}>${name}</option>`).join('');
  const reminder = item => eventActions({id: item.id, title: `${item.next.what}: ${item.title} at ${item.company}`, start: item.next.at, url: item.apply || (item.path ? location.origin + item.path : ''), note: item.notes.slice(0, 300)});

  function nextStep(item) {
    const id = e(item.id), next = item.next;
    return `<div class="tracker-next">${next ? `<p class="tracker-next-when"><strong>${e(next.what)}</strong> <time datetime="${e(next.at)}">${e(whenLabel(next.at))}</time></p>${reminder(item)}` : ''}
      <details class="tracker-next-edit"><summary>${next ? 'Change the next step' : 'Add an interview or next step'}</summary>
        <form data-next-form="${id}"><label class="sr-only" for="next-what-${id}">Next step for ${e(item.title)}</label><input id="next-what-${id}" name="what" maxlength="80" value="${e(next?.what || '')}" placeholder="Interview, test, HR call…">
          <label class="sr-only" for="next-at-${id}">Date and time</label><input id="next-at-${id}" name="at" type="datetime-local" value="${next ? e(localInput(next.at)) : ''}" required>
          <button type="submit">Save</button>${next ? `<button type="button" data-next-clear="${id}">Remove</button>` : ''}</form></details></div>`;
  }
  // The person to follow up with: shown on the card, edited in place.
  function contactBlock(item) {
    const id = e(item.id), c = item.contact;
    const reach = c?.reach ? (c.link ? `<a href="${e(c.link)}"${/^https:/.test(c.link) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(c.reach)}</a>` : e(c.reach)) : '';
    return `<details class="tracker-contact"><summary>${c ? `Contact: <strong>${e(c.name || c.reach)}</strong>${c.role ? ` · ${e(c.role)}` : ''}` : 'Contact <span>(add)</span>'}</summary>
      ${c && reach ? `<p class="tracker-contact-reach">${reach}</p>` : ''}
      <form data-contact-form="${id}"><label class="sr-only" for="contact-name-${id}">Contact name</label><input id="contact-name-${id}" name="name" maxlength="80" value="${e(c?.name || '')}" placeholder="Name">
        <label class="sr-only" for="contact-role-${id}">Their role</label><input id="contact-role-${id}" name="role" maxlength="80" value="${e(c?.role || '')}" placeholder="Recruiter, referrer…">
        <label class="sr-only" for="contact-reach-${id}">Email, phone or profile link</label><input id="contact-reach-${id}" name="reach" maxlength="200" value="${e(c?.reach || '')}" placeholder="Email, phone or https:// link">
        <button type="submit">Save</button>${c ? `<button type="button" data-contact-clear="${id}">Remove</button>` : ''}</form></details>`;
  }
  function insights() {
    const box = root.querySelector('[data-insights]'), f = funnel(tracker);
    box.hidden = !f.applied;
    if(!f.applied) return;
    const stat = (label, value, note = '') => `<div><dt>${label}</dt><dd>${value}${note ? `<span>${note}</span>` : ''}</dd></div>`;
    box.querySelector('[data-funnel]').innerHTML = stat('Applied', f.applied) + stat('Interviews', f.interviewing, f.interviewRate === null ? '' : `${f.interviewRate}% of applications`)
      + stat('Offers', f.offer, f.offerRate === null ? '' : `${f.offerRate}% of interviews`)
      + (f.daysToInterview === null ? '' : stat('Days to an interview', f.daysToInterview, 'typical wait after applying'));
    const stops = closedAt(tracker), why = box.querySelector('[data-closed]');
    why.hidden = !stops.total;
    if(stops.total) {
      const part = (n, text) => n ? `<li><strong>${n}</strong> ${text}</li>` : '';
      const tip = stops.pattern === 'before-interview'
        ? '<p class="tracker-tip">Most closed applications ended before an interview. Before the next one, compare your resume with the role in the <a href="/resume-match">job fit check</a> and fill the gaps it finds.</p>'
        : stops.pattern === 'after-interview'
          ? '<p class="tracker-tip">Most closed applications ended after interviews, so your resume is getting you in. Practise answers with <a href="/interview-answers">interview answers</a>.</p>' : '';
      why.querySelector('ul').innerHTML = part(stops.saved, 'closed before applying') + part(stops.applied, 'after applying, with no interview')
        + part(stops.interviewing, 'after interviews') + part(stops.offer, 'after an offer');
      why.querySelector('[data-closed-tip]').innerHTML = tip;
    }
    const due = needsFollowUp(tracker), list = box.querySelector('[data-followups]');
    list.hidden = !due.length;
    list.querySelector('ol').innerHTML = due.slice(0, 8).map(item => `<li><span><strong>${e(item.title)}</strong> at ${e(item.company)} · applied ${e(dateLabel(item.history.applied))}</span>${item.contact?.link ? `<a href="${e(item.contact.link)}"${/^https:/.test(item.contact.link) ? ' target="_blank" rel="noopener noreferrer"' : ''}>Contact ${e(item.contact.name || '')}</a>` : ''}</li>`).join('');
  }
  function card(item) {
    const since = item.history[item.stage] || item.addedAt;
    const title = item.path ? `<a class="tracker-title" href="${e(item.path)}">${e(item.title)}</a>` : `<span class="tracker-title">${e(item.title)}</span>`;
    return `<li class="tracker-card" draggable="true" data-id="${e(item.id)}">
      <p class="tracker-company">${e(item.company)}${isCustom(item.id) ? ' <span class="tracker-badge">Added by you</span>' : ''}</p>${title}
      ${item.place || item.pay ? `<p class="tracker-meta">${[item.place, item.pay].filter(Boolean).map(e).join(' · ')}</p>` : ''}
      <div class="tracker-row"><label class="sr-only" for="stage-${e(item.id)}">Stage for ${e(item.title)}</label><select id="stage-${e(item.id)}" data-stage="${e(item.id)}">${stageOptions(item.stage)}</select>${since ? `<span class="tracker-since">since ${e(dateLabel(since))}</span>` : ''}</div>
      ${item.stage === 'closed' ? '' : nextStep(item)}
      ${item.stage === 'saved' ? '' : contactBlock(item)}
      <details class="tracker-notes"${item.notes ? ' open' : ''}><summary>Notes${item.notes ? '' : ' <span>(add)</span>'}</summary><label class="sr-only" for="notes-${e(item.id)}">Notes for ${e(item.title)}</label><textarea id="notes-${e(item.id)}" data-notes="${e(item.id)}" rows="3" maxlength="2000" placeholder="Recruiter, salary discussed, follow-up…">${e(item.notes)}</textarea></details>
      <div class="tracker-actions">${item.apply ? `<a href="${e(item.apply)}" target="_blank" rel="noopener noreferrer">${isCustom(item.id) ? 'Job link' : 'Employer page'}</a>` : ''}<button type="button" data-remove="${e(item.id)}" aria-label="Remove ${e(item.title)} from the tracker">Remove</button></div>
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
      : 'No roles yet. Save a job, or add one from another site.';
    root.querySelector('[data-export]').disabled = !total;
    const next = upcoming(tracker);
    soon.hidden = !next.length;
    soon.querySelector('ol').innerHTML = next.map(item => `<li><time datetime="${e(item.next.at)}">${e(whenLabel(item.next.at))}</time><span><strong>${e(item.next.what)}</strong> · ${e(item.title)} at ${e(item.company)}</span></li>`).join('');
    insights();
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
  board.addEventListener('submit', event => {
    const contact = event.target.closest('[data-contact-form]');
    if(contact) {
      event.preventDefault();
      const f = contact.elements, id = contact.dataset.contactForm;
      saveBoard(setContact(tracker, id, {name: f.name.value, role: f.role.value, reach: f.reach.value})); render();
      say(tracker.items[id]?.contact ? 'Contact saved on this device.' : 'Add a name or a way to reach them.');
      track('tool_use', {tool: 'tracker_contact'});
      return;
    }
    const form = event.target.closest('[data-next-form]'); if(!form) return;
    event.preventDefault();
    const id = form.dataset.nextForm, at = Date.parse(form.elements.at.value);
    if(!Number.isFinite(at)) { form.elements.at.focus(); say('Pick a date and time for the next step.'); return; }
    saveBoard(setNext(tracker, id, {what: form.elements.what.value, at: new Date(at).toISOString()})); render();
    say(`Next step saved. Use “Remind me” to add it to your calendar.`);
    track('tool_use', {tool: 'tracker_next'});
    board.querySelector(`[data-id="${CSS.escape(id)}"] .cal-actions a`)?.focus();
  });
  board.addEventListener('click', event => {
    const clear = event.target.closest('[data-next-clear]');
    if(clear) { saveBoard(setNext(tracker, clear.dataset.nextClear, null)); render(); say('Next step removed.'); return; }
    const dropContact = event.target.closest('[data-contact-clear]');
    if(dropContact) { saveBoard(setContact(tracker, dropContact.dataset.contactClear, null)); render(); say('Contact removed.'); return; }
    const remove = event.target.closest('[data-remove]'); if(!remove) return;
    const id = remove.dataset.remove, item = tracker.items[id];
    saveBoard(removeItem(tracker, id));
    // Unsave a WILSY job too, or the next sync would bring it straight back under Saved.
    if(!isCustom(id)) { try { localStorage.setItem('wilsy-saved-jobs', JSON.stringify(readSaved(localStorage).filter(v => v !== id))); announceSaved(); } catch {} }
    render(); say(`${item?.title || 'Role'} removed from the tracker${isCustom(id) ? '' : ' and your saved jobs'}.`);
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

  // Add a role from another site: by hand, from the share sheet (installed app) or from the bookmarklet.
  const openAdder = () => { adder.open = true; adder.scrollIntoView({block: 'start', behavior: 'smooth'}); addForm.elements.title.focus({preventScroll: true}); };
  root.querySelector('[data-add-open]').addEventListener('click', openAdder);
  addForm.addEventListener('submit', event => {
    event.preventDefault();
    const f = addForm.elements, link = f.apply.value.trim();
    if(link && !/^https:\/\//i.test(link)) { addError.hidden = false; addError.textContent = 'Use the full link, starting with https://'; f.apply.focus(); return; }
    const result = addCustom(tracker, {title: f.title.value, company: f.company.value, apply: link, place: f.place.value, stage: f.stage.value, notes: f.notes.value});
    if(result.error) { addError.hidden = false; addError.textContent = result.error; f.title.focus(); return; }
    addError.hidden = true;
    saveBoard(result.tracker); render();
    const item = tracker.items[result.id];
    say(`${item.title} at ${item.company} added under ${STAGES.find(([id]) => id === item.stage)[1]}.`);
    track('tool_use', {tool: 'tracker_add'});
    addForm.reset(); adder.open = false;
    document.getElementById('stage-' + result.id)?.focus();
  });
  const bookmarklet = root.querySelector('[data-bookmarklet]');
  if(bookmarklet) {
    bookmarklet.href = bookmarklet.href.replace(/https:\/\/www\.wilsy\.in/, location.origin);
    bookmarklet.addEventListener('click', event => { event.preventDefault(); say('Drag the “Add to WILSY” button to your bookmarks bar, then press it on any job page.'); });
  }
  const params = new URLSearchParams(location.search);
  if(['title', 'text', 'url'].some(key => params.get(key)) || params.has('add')) {
    const shared = fromShare({title: params.get('title') || '', text: params.get('text') || '', url: params.get('url') || ''});
    const f = addForm.elements;
    f.title.value = shared.title; f.company.value = shared.company; f.apply.value = shared.apply; f.place.value = shared.place;
    history.replaceState(null, '', location.pathname + '#add');
    openAdder();
    if(shared.title || shared.apply) say('Check the details, then add it to your board.');
  } else if(location.hash === '#add') openAdder();

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
