import {applyKit} from './apply-kit-core.js';
import {RESUME_KEY, RESUME_MAX} from './resume-core.js';
import {searchJobs} from './data-client.js';
import {jobPath} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {sourceText} from './ui-helpers.js';
import {track} from './analytics.js';

// /apply-kit: builds one application's kit in this browser. The resume is read from the copy the visitor chose
// to keep on this device (resume match), never sent anywhere.
const root = document.querySelector('[data-kit]');
if(root) {
  const $ = id => root.querySelector('#kit-' + id);
  const posting = $('posting'), resume = $('resume'), title = $('title'), company = $('company'), name = $('name');
  const result = root.querySelector('[data-kit-result]'), jobInfo = root.querySelector('[data-kit-job]');
  let timer, counted = false, jobId = '';
  try { const kept = localStorage.getItem(RESUME_KEY); if(kept) resume.value = kept.slice(0, RESUME_MAX); } catch {}
  try { name.value = localStorage.getItem('wilsy-kit-name') || ''; } catch {}
  const chips = (list, kind, empty) => list.length ? `<ul class="match-chips is-${kind}">${list.map(s => `<li>${e(s)}</li>`).join('')}</ul>` : `<p class="salary-note">${empty}</p>`;

  function render() {
    const post = posting.value.trim(), mine = resume.value.trim();
    if(!post || !mine) { result.innerHTML = `<p class="match-empty">${!post ? 'Paste the job posting first.' : 'Paste your resume text.'}</p>`; return; }
    const kit = applyKit({resume: mine, name: name.value, job: {title: title.value.trim(), company: company.value.trim(), description: post}});
    if(!counted) { counted = true; track('tool_use', {tool: 'apply_kit'}); }
    const f = kit.fit, level = f.score == null ? 'fair' : f.score >= 55 ? 'high' : f.score >= 35 ? 'fair' : 'low';
    const gates = f.gates.filter(g => g.verdict === 'fail');
    result.innerHTML = `<div class="match-score is-${level}"><div><strong>${f.score == null ? '–' : f.score + '%'}</strong><span>${e(f.verdict)}</span></div>
      <p>${f.parts.map(p => e(p.note)).join(' ')}${gates.length ? ` <strong>Check first:</strong> ${gates.map(g => e(g.note || g.label || '')).join(' ')}` : ''} <a href="/resume-match${jobId ? `?job=${encodeURIComponent(jobId)}` : ''}">Full fit check</a></p></div>
      <section class="kit-letter"><h3>Cover letter draft</h3>
        <p class="salary-note">Built only from your resume${kit.proof.length ? ` (${kit.proof.length} line${kit.proof.length === 1 ? '' : 's'} quoted)` : ''}. Replace every [placeholder] before you send it.</p>
        <label class="sr-only" for="kit-letter">Cover letter draft</label><textarea id="kit-letter" rows="14" maxlength="8000">${e(kit.letter)}</textarea>
        <p class="kit-actions"><button type="button" class="secondary-button" data-kit-copy>Copy letter</button><button type="button" class="secondary-button" data-kit-download>Download as text</button><span data-kit-status role="status"></span></p></section>
      <div class="match-lists"><section><h3>Keywords to keep exactly (${kit.keywords.kept.length})</h3>${chips(kit.keywords.kept, 'have', 'None of the posting’s skills appear in your resume yet.')}</section>
      <section><h3>Missing from your resume (${kit.keywords.missing.length + kit.keywords.close.length})</h3>${chips([...kit.keywords.close.map(c => `${c.skill} (you show ${c.near})`), ...kit.keywords.missing], 'missing', 'Your resume names every skill the posting asks for.')}<p class="salary-note">Add one only if you really have it.</p></section></div>
      <section class="kit-questions"><h3>Questions to prepare</h3><ol>${kit.questions.map(q => `<li>${e(q)}</li>`).join('')}</ol>
        <p class="salary-note">Write your answers with <a href="/interview-answers">interview answers</a>.</p></section>`;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  for(const field of [posting, resume, title, company, name]) field.addEventListener('input', later);
  name.addEventListener('change', () => { try { localStorage.setItem('wilsy-kit-name', name.value.slice(0, 60)); } catch {} });

  const status = text => { const s = result.querySelector('[data-kit-status]'); if(s) s.textContent = text; };
  result.addEventListener('click', async event => {
    const letter = result.querySelector('#kit-letter');
    if(!letter) return;
    if(event.target.closest('[data-kit-copy]')) {
      try { await navigator.clipboard.writeText(letter.value); status('Copied.'); } catch { letter.select(); status('Press Ctrl+C to copy.'); }
    } else if(event.target.closest('[data-kit-download]')) {
      const file = `Cover letter - ${(company.value.trim() || 'job').replace(/[^\w .-]+/g, '').slice(0, 60)}.txt`;
      const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(new Blob([letter.value], {type: 'text/plain;charset=utf-8'})), download: file});
      link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); status('Saved.');
    }
  });

  // Opened from a job (/apply-kit?job=123): load it from the live search.
  const id = new URLSearchParams(location.search).get('job');
  if(/^\d{1,12}$/.test(id || '')) {
    jobInfo.hidden = false; jobInfo.textContent = 'Loading the job…';
    searchJobs({id}, 0).then(({jobs}) => {
      const j = jobs?.[0];
      if(!j) { jobInfo.textContent = 'That job is no longer open. Paste the posting below.'; return; }
      jobId = String(j.id);
      posting.value = sourceText(j.description).slice(0, 30000);
      title.value = j.title || ''; company.value = j.company || '';
      jobInfo.innerHTML = `Kit for <strong>${e(j.title)}</strong> at ${e(j.company)} · <a href="${e(jobPath(j))}">Open the job</a>`;
      render();
    }).catch(() => { jobInfo.textContent = 'Couldn’t load the job. Paste the posting below instead.'; });
  }
  render();
}
