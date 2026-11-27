import {copyCheck, copyVerdict, markLifts} from './copy-core.js';
import {searchJobs} from './data-client.js';
import {jobPath} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {sourceText} from './ui-helpers.js';
import {track} from './analytics.js';

// /copy-check: compares the visitor's text with a job posting, in this browser only. Nothing is sent or kept.
const root = document.querySelector('[data-copy]');
if(root) {
  const posting = root.querySelector('#copy-posting'), text = root.querySelector('#copy-text');
  const result = root.querySelector('[data-copy-result]'), jobInfo = root.querySelector('[data-copy-job]');
  let timer, counted = false;
  const chips = (list, kind, empty) => list.length ? `<ul class="match-chips is-${kind}">${list.map(s => `<li>${e(s)}</li>`).join('')}</ul>` : `<p class="salary-note">${empty}</p>`;

  function render() {
    const post = posting.value.trim(), mine = text.value;
    if(!post || !mine.trim()) { result.innerHTML = `<p class="match-empty">${!post ? 'Paste the job posting first.' : 'Paste your resume, cover letter or answer.'}</p>`; return; }
    const r = copyCheck(post, mine);
    if(!counted) { counted = true; track('tool_use', {tool: 'copy_check'}); }
    const clean = !r.lifts.length && !r.echoes.length;
    result.innerHTML = `<div class="match-score copy-score is-${clean ? 'high' : r.copiedShare >= 20 || r.lifts.length >= 4 ? 'low' : 'fair'}"><div><strong>${r.lifts.length}</strong><span>${e(copyVerdict(r))}</span></div>
      <p>${r.lifts.length ? `${r.lifts.length} copied line${r.lifts.length === 1 ? '' : 's'}, ${r.copiedShare}% of your words.` : 'No line of 5 or more words is copied from the posting.'}${r.echoes.length ? ` ${r.echoes.length} of the posting’s informal word${r.echoes.length === 1 ? '' : 's'} picked up.` : ''}</p></div>
      ${r.lifts.length ? `<section class="copy-lifts"><h3>Copied lines: rewrite these in your own words</h3><ol>${r.lifts.map(l => `<li>“${e(l.text)}”</li>`).join('')}</ol>
        <h3>Your text, with the copied lines marked</h3><div class="copy-marked">${markLifts(mine, r.lifts)}</div></section>` : ''}
      ${r.echoes.length ? `<section><h3>The posting’s voice words in your text</h3>${chips(r.echoes, 'missing', '')}<p class="salary-note">Say the same thing in plain words you would use in an interview.</p></section>` : ''}
      <div class="match-lists"><section><h3>Keywords you kept (${r.kept.length})</h3>${chips(r.kept, 'have', 'None of the posting’s skills appear yet.')}</section>
      <section><h3>Keywords you didn’t mention (${r.missing.length})</h3>${chips(r.missing, 'missing', 'You mention every skill the posting names.')}<p class="salary-note">Add one only if you really have it.</p></section></div>`;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  posting.addEventListener('input', later);
  text.addEventListener('input', later);

  // Opened from a job (/copy-check?job=123): load its description from the live search.
  const id = new URLSearchParams(location.search).get('job');
  if(/^\d{1,12}$/.test(id || '')) {
    jobInfo.hidden = false; jobInfo.textContent = 'Loading the job…';
    searchJobs({id}, 0).then(({jobs}) => {
      const j = jobs?.[0];
      if(!j) { jobInfo.textContent = 'That job is no longer open. Paste the posting below.'; return; }
      posting.value = [j.title, sourceText(j.description)].filter(Boolean).join('\n\n').slice(0, 30000);
      jobInfo.innerHTML = `Checking against <strong>${e(j.title)}</strong> at ${e(j.company)} · <a href="${e(jobPath(j))}">Open the job</a>`;
      render();
    }).catch(() => { jobInfo.textContent = 'Couldn’t load the job. Paste the posting below instead.'; });
  }
  render();
}
