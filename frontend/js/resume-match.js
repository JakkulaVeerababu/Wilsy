import {RESUME_KEY, RESUME_MAX, RESUME_HANDOFF} from './resume-core.js';
import {jobFit} from './fit-core.js';
import {resumeYears, rankJobs, searchSkills} from './resume-jobs-core.js';
import {readResumeFile} from './resume-file.js';
import {findSkills, skillEvidence} from './skills-core.js';
import {searchJobs} from './data-client.js';
import {jobPath, applyUrl} from './jobs-core.js';
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
  // Sent over by the resume builder's "Check against a job": used once, and not remembered unless ticked.
  try { const handed = sessionStorage.getItem(RESUME_HANDOFF); if(handed) { sessionStorage.removeItem(RESUME_HANDOFF); resume.value = handed.slice(0, RESUME_MAX); } } catch {}

  const chips = (list, kind) => list.length ? `<ul class="match-chips is-${kind}">${list.map(s => `<li>${e(s)}</li>`).join('')}</ul>` : `<p class="salary-note">${kind === 'have' ? 'None yet.' : 'Nothing missing.'}</p>`;
  function render() {
    const mine = resume.value.trim(), theirs = job.value.trim();
    if(!mine || !theirs) { result.innerHTML = `<p class="match-empty">${!theirs ? 'Paste a job description, or open this page from a job with “Check your resume”.' : 'Paste your resume text to see how well it matches.'}</p>`; return; }
    // Years: the visitor's own number when typed, otherwise read from the resume.
    const typed = root.querySelector('#resume-years')?.value.trim() ?? '';
    const fit = jobFit(mine, theirs, typed !== '' && Number.isFinite(Number(typed)) ? Math.max(0, Number(typed)) : null), m = fit.match;
    if(!counted) { counted = true; track('tool_use', {tool: 'resume_match'}); }
    const proof = skillEvidence(mine);
    if(m.score == null) { result.innerHTML = '<p class="match-empty">No skills we recognise appear in this job text. Paste the full description, including the requirements.</p>'; return; }
    const tone = s => s == null ? 'none' : s >= 75 ? 'high' : s >= 55 ? 'good' : s >= 35 ? 'fair' : 'low';
    const gateWord = {fail: 'Can’t apply', flag: 'Check this', pass: 'OK', unknown: 'Not stated'};
    const gates = fit.gates.map(g => `<li class="is-${g.verdict}"><span class="fit-gate-word">${gateWord[g.verdict]}</span><div><strong>${e(g.label)}</strong><p>${e(g.note)}</p>${g.quote ? `<blockquote>“${e(g.quote)}”</blockquote>` : ''}</div></li>`).join('');
    const parts = fit.parts.map(p => `<li class="is-${tone(p.score)}"><div class="fit-part-head"><strong>${e(p.label)}</strong><span>${p.score == null ? 'Not scored' : `${p.score}%`}</span></div>${p.score == null ? '' : `<div class="match-meter" role="img" aria-label="${e(p.label)}: ${p.score}%"><span style="width:${p.score}%"></span></div>`}<p>${e(p.note)}</p></li>`).join('');
    result.innerHTML = `<div class="match-score fit-score is-${fit.blocked ? 'blocked' : tone(fit.score)}"><div><strong>${fit.score}%</strong><span>${e(fit.verdict)}</span></div>
      <div class="match-meter" role="img" aria-label="${fit.score}% overall fit"><span style="width:${fit.score}%"></span></div>
      <p>Your overall fit for this job, from the parts below that the job and your resume both describe.${fit.workMode ? ` Work mode: ${e(fit.workMode)}.` : ''}</p></div>
      <section class="fit-gates"><h3>Can you apply?</h3><ul>${gates}</ul></section>
      <section class="fit-parts"><h3>Fit, part by part</h3><ul>${parts}</ul></section>
      ${m.matched.length ? `<section class="fit-evidence"><h3>Proof from your resume</h3><p class="salary-note">The line where your resume shows each skill the job asks for. A recruiter looks for the same thing.</p><ul>${m.matched.map(s => `<li><strong>${e(s)}</strong>${proof.get(s) ? `<q>${e(proof.get(s))}</q>` : ''}</li>`).join('')}${m.close.map(([s, near]) => `<li class="is-close"><strong>${e(s)}</strong> <span>(you show ${e(near)})</span>${proof.get(near) ? `<q>${e(proof.get(near))}</q>` : ''}</li>`).join('')}</ul></section>` : ''}
      <div class="match-lists"><section><h3>Skills you show (${m.matched.length})</h3>${chips(m.matched, 'have')}</section>
      <section><h3>Skill gaps: add these if you have them (${m.missing.length + m.close.length})</h3>${m.close.length ? `<ul class="match-chips is-close">${m.close.map(([skill, near]) => `<li>${e(skill)} <span>you show ${e(near)}</span></li>`).join('')}</ul>` : ''}${chips(m.missing, 'missing')}</section></div>
      <ul class="match-tips"><li>Use the job’s own words for skills: if it says “Kubernetes”, write “Kubernetes”, not only “containers”.</li><li>Don’t copy its sentences, though: <a href="/copy-check">run the copy check</a> on your resume or cover letter.</li><li>Only add skills you can talk about in an interview.</li></ul>
      <p class="salary-note">Skills count for half of the fit, experience for a quarter, the job’s level for 15% and education for 10%. A part the job doesn’t describe is left out. Rules adapted from the open-source <a href="https://github.com/ai-job-search-dev/ai-job-search" target="_blank" rel="noopener noreferrer">ai-job-search</a> project (MIT licence).</p>`;
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

  // Upload: the file is read into the resume box, here in the browser.
  const fileInput = root.querySelector('#resume-file'), fileStatus = root.querySelector('[data-resume-file-status]');
  const yearsInput = root.querySelector('#resume-years'), list = root.querySelector('[data-resume-jobs-list]'), findButton = root.querySelector('[data-resume-jobs]');
  const fillYears = () => { const y = resumeYears(resume.value); yearsInput.placeholder = y == null ? 'Not found: enter it' : `${y} from your resume`; };
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if(!file) return;
    fileStatus.textContent = `Reading ${file.name}…`;
    try {
      resume.value = (await readResumeFile(file)).slice(0, RESUME_MAX);
      if(remember.checked) keep();
      const found = findSkills(resume.value).length;
      fileStatus.textContent = `Read ${file.name}: ${found} skill${found === 1 ? '' : 's'} found.`;
      track('tool_use', {tool: 'resume_match', via: 'upload'});
      fillYears(); render(); findJobs();
    } catch(error) {
      fileStatus.textContent = error?.message?.length < 200 ? error.message : 'Couldn’t read that file. Paste your resume text instead.';
    } finally { fileInput.value = ''; }
  });
  resume.addEventListener('input', fillYears);
  yearsInput?.addEventListener('input', later);

  // Matching jobs: live jobs for the resume's main skills, scored here and listed highest chance first.
  const PER_SKILL_PAGES = 2;
  let jobsRequest = 0, jobsCounted = false;
  const card = r => {
    const j = r.job, link = applyUrl(j.apply_url), tone = r.score >= 70 ? 'high' : r.score >= 45 ? 'good' : r.score >= 25 ? 'fair' : 'low';
    const where = [j.location || j.city, j.work_mode && j.work_mode !== 'unspecified' ? j.work_mode.replace(/^./, c => c.toUpperCase()) : ''].filter(Boolean).join(' · ');
    return `<li class="resume-job-card"><div class="resume-job-score is-${tone}"><strong>${r.score}%</strong><span>${e(r.chance)}</span></div>
      <div class="resume-job-body"><h3><a href="${e(jobPath(j))}">${e(j.title)}</a></h3><p class="resume-job-meta">${e(j.company)}${where ? ` · ${e(where)}` : ''}</p>
      <div class="match-meter" role="img" aria-label="${r.score}% estimated match"><span style="width:${r.score}%"></span></div>
      <p class="resume-job-skills"><strong>You show:</strong> ${e([...r.matched, ...r.close.map(([s, near]) => `${s} (via ${near})`)].join(', '))}${r.missing.length ? `<br><strong>Missing:</strong> ${e(r.missing.slice(0, 6).join(', '))}${r.missing.length > 6 ? ` and ${r.missing.length - 6} more` : ''}` : ''}</p>
      ${r.gap ? `<p class="resume-job-note">Asks for ${r.asks}+ years of experience.</p>` : ''}
      <p class="resume-job-actions"><a href="${e(jobPath(j))}">See the job</a><a href="/resume-match?job=${encodeURIComponent(j.id)}">Check my resume against it</a>${link ? `<a href="${e(link)}" target="_blank" rel="noopener noreferrer">Apply on ${e(j.company)}’s site</a>` : ''}</p></div></li>`;
  };
  async function findJobs() {
    const text = resume.value.trim(), skills = findSkills(text);
    if(!text) { list.innerHTML = '<p class="match-empty">Upload or paste your resume first.</p>'; return; }
    if(!skills.length) { list.innerHTML = '<p class="match-empty">No skills we recognise appear in this resume. Make sure it lists your tools and technologies, such as Python, SQL or React.</p>'; return; }
    const typed = yearsInput.value.trim(), years = typed !== '' && Number.isFinite(Number(typed)) ? Math.max(0, Number(typed)) : resumeYears(text);
    const current = ++jobsRequest, query = searchSkills(skills);
    findButton.disabled = true; list.setAttribute('aria-busy', 'true');
    list.innerHTML = `<p class="match-empty">Searching live jobs for ${e(query.join(', '))}…</p>`;
    const pages = await Promise.allSettled(query.flatMap(skill => Array.from({length: PER_SKILL_PAGES}, (_, i) => searchJobs({skill}, i * 20))));
    if(current !== jobsRequest) return;
    findButton.disabled = false; list.setAttribute('aria-busy', 'false');
    const jobs = pages.filter(p => p.status === 'fulfilled').flatMap(p => p.value?.jobs || []);
    if(!jobs.length) { list.innerHTML = `<p class="match-empty">${pages.every(p => p.status === 'rejected') ? 'Couldn’t reach the live jobs. Try again in a moment.' : 'No live jobs ask for these skills right now. Try again tomorrow: new jobs arrive every hour.'}</p>`; return; }
    const ranked = rankJobs(jobs, skills, years).slice(0, 30);
    if(!jobsCounted) { jobsCounted = true; track('tool_use', {tool: 'resume_jobs'}); }
    list.innerHTML = `<p class="resume-jobs-summary">${ranked.length} live job${ranked.length === 1 ? '' : 's'} for your skills (${e(skills.slice(0, 8).join(', '))}${skills.length > 8 ? '…' : ''})${years != null ? `, with ${years} year${years === 1 ? '' : 's'} of experience` : ''}. Highest chance first.</p><ol class="resume-job-list">${ranked.map(card).join('')}</ol>`;
  }
  findButton?.addEventListener('click', findJobs);
  fillYears();
}
