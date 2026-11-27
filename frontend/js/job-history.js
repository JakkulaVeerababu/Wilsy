import {jobHistory} from './data-client.js';
import {historyNote} from './job-history-core.js';
import {escapeHtml as e} from './directory-core.js';

// Job pages: fills the "Posted before" note under the job facts. Quietly shows nothing on any error.
const slot = document.querySelector('[data-job-history]');
const id = slot?.dataset.jobHistory;
if(slot && /^\d{1,15}$/.test(id || '')) {
  jobHistory(id).then(history => {
    const note = historyNote(history);
    if(!note) return;
    slot.className = `job-history is-${note.level}`;
    slot.innerHTML = `<strong>${e(note.title)}</strong><p>${e(note.text)}</p>`;
    slot.hidden = false;
  }).catch(() => {});
}
