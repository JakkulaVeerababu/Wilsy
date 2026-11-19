import {matchResume, verdict, RESUME_KEY, RESUME_MAX} from './resume-core.js';
import {searchJobs} from './data-client.js';
import {jobPath} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {sourceText} from './ui-helpers.js';
import {track} from './analytics.js';

// /resume-match: compares a pasted resume with a job, entirely in this browser. Nothing typed here is
// sent to WILSY; the resume is kept on this device only when the visitor ticks "Remember".
const root = document.querySelector('[data-resume]');
if(root) {
  const resume = root.querySelector('#resume-text'), job = root.querySelector('#job-text'), remember = root.querySelector('#resume-remember');
  const result = root.querySelector('[data-resume-result]'), jobInfo = root.querySelector('[data-resume-job]');
  let timer, counted = false;
  try { const kept = localStorage.getItem(RESUME_KEY); if(kept) { resume.value = kept.slice(0, RESUME_MAX); remember.checked = true; } } catch {}

  const chips = (list, kind) => list.length ? `<ul class="match-chips is-${kind}">${list.map(s => `<li>${e(s)}</li>`).join('')}</ul>` : `<p class="salary-note">${kind === 'have' ? 'None yet.' : 'Nothing missing.'}</p>`;
  function render() {
    const mine = resume.value.trim(), theirs = job.value.trim();
    if(!mine || !theirs) { result.innerHTML = `<p class="match-empty">${!theirs ? 'Paste a job description, or open this page from a job with “Check your resume”.' : 'Paste your resume text to see how well it matches.'}</p>`; return; }
    const m = matchResume(mine, theirs);
    if(!counted) { counted = true; track('tool_use', {tool: 'resume_match'}); }
    if(m.score == null) { result.innerHTML = '<p class="match-empty">No skills we recognise appear in this job text. Paste the full description, including the requirements.</p>'; return; }
    result.innerHTML = `<div class="match-score"><div><strong>${m.score}%</strong><span>${e(verdict(m.score))}</span></div>
      <div class="match-meter" role="img" aria-label="${m.score}% of the job's skills appear in your resume"><span style="width:${m.score}%"></span></div>
      <p>Your resume shows ${m.matched.length} of the ${m.want.length} skills this job mentions${m.close.length ? `, and something close to ${m.close.length} more (half credit)` : ''}.</p></div>
      <div class="match-lists"><section><h3>Skills you show (${m.matched.length})</h3>${chips(m.matched, 'have')}</section>
      <section><h3>Add these if you have them (${m.missing.length + m.close.length})</h3>${m.close.length ? `<ul class="match-chips is-close">${m.close.map(([skill, near]) => `<li>${e(skill)} <span>you show ${e(near)}</span></li>`).join('')}</ul>` : ''}${chips(m.missing, 'missing')}</section></div>
      ${m.years ? `<p class="match-note">The listing asks for ${m.years}+ years of experience. Make your dates and project lengths easy to find.</p>` : ''}
      <ul class="match-tips"><li>Use the job’s own words: if it says “Kubernetes”, write “Kubernetes”, not only “containers”.</li><li>Put the skills inside real projects and results, not just in a list.</li><li>Only add skills you can talk about in an interview.</li></ul>`;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 200); };
  const keep = () => { try { if(remember.checked) localStorage.setItem(RESUME_KEY, resume.value.slice(0, RESUME_MAX)); else localStorage.removeItem(RESUME_KEY); } catch {} };
  resume.addEventListener('input', () => { later(); if(remember.checked) keep(); });
  job.addEventListener('input', later);
  remember.addEventListener('change', keep);
  root.querySelector('[data-resume-clear]')?.addEventListener('click', () => { resume.value = ''; remember.checked = false; keep(); render(); resume.focus(); });

  // Opened from a job: load its description from the live search.
  const id = new URLSearchParams(location.search).get('job');
  if(/^\d{1,12}$/.test(id || '')) {
    jobInfo.hidden = false; jobInfo.textContent = 'Loading the job…';
    searchJobs({id}, 0).then(({jobs}) => {
      const j = jobs?.[0];
      if(!j) { jobInfo.textContent = 'That job is no longer open. Paste another job description below.'; return; }
      job.value = [j.title, [...(j.skills || []), ...(j.tech_stack || [])].join(', '), sourceText(j.description)].filter(Boolean).join('\n\n').slice(0, RESUME_MAX);
      jobInfo.innerHTML = `Checking against <strong>${e(j.title)}</strong> at ${e(j.company)} · <a href="${e(jobPath(j))}">Open the job</a> · <a href="${e(jobPath(j))}#ask-referral">Ask for a referral</a>`;
      render();
    }).catch(() => { jobInfo.textContent = 'Couldn’t load the job. Paste its description below instead.'; });
  }
  render();
}
