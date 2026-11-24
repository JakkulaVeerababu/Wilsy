import {PROFILE_KEY, MAX_SKILLS, readProfile, canonicalSkill, rankJobs, skillGaps, companiesHiring, closingSoon, learningPlan, learnLink, skillsFromText} from './my-wilsy-core.js';
import {RESUME_KEY} from './resume-core.js';
import {databaseRequest} from './data-client.js';
import {jobPath, label} from './jobs-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /my-wilsy: the visitor's profile lives in localStorage. Only the skill names go to the database, to
// fetch live jobs that list them; matching, eligibility, gaps and the plan are worked out here.
const root = document.querySelector('[data-mywilsy]');
const FETCH_LIMIT = 1000;
const COLUMNS = 'id,title,company,company_slug,location,country,country_code,work_mode,job_type,skills,tech_stack,experience_min,experience_max,education,'
  + 'graduation_years,is_fresher,is_new_grad,is_internship,seniority_level,career_stage,posted_at,first_seen_at,discovered_at,deadline_at';

if(root) {
  const $ = selector => root.querySelector(selector);
  const tags = $('[data-skill-tags]'), input = $('#skill-input'), results = $('[data-results]'), status = $('[data-profile-status]');
  const fields = {degree: $('#profile-degree'), gradYear: $('#profile-grad'), years: $('#profile-years'), where: $('#profile-where')};
  const onlyEligible = $('#only-eligible');
  let profile = readProfile(null), cache = {key: '', jobs: [], capped: false}, shown = 15, timer, counted = false, request = 0;

  try { profile = readProfile(localStorage.getItem(PROFILE_KEY)); } catch {}
  try { onlyEligible.checked = localStorage.getItem(PROFILE_KEY + '-eligible') === '1'; } catch {}
  // A resume kept by Resume match fills the resume box, so its skills are one click away.
  try { const kept = localStorage.getItem(RESUME_KEY); if(kept) $('#profile-resume').value = kept.slice(0, 30000); } catch {}

  const save = () => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); localStorage.setItem(PROFILE_KEY + '-eligible', onlyEligible.checked ? '1' : '0'); status.textContent = 'Saved on this device.'; }
    catch { status.textContent = 'Your browser is not keeping data, so the profile lasts for this visit only.'; }
  };
  const showProfile = () => {
    tags.innerHTML = profile.skills.map(skill => `<li>${e(skill)}<button type="button" data-remove="${e(skill)}" aria-label="Remove ${e(skill)}">×</button></li>`).join('');
    fields.degree.value = profile.degree; fields.gradYear.value = profile.gradYear ?? ''; fields.years.value = profile.years ?? ''; fields.where.value = profile.where;
  };
  const addSkills = list => {
    const next = [...new Set([...profile.skills, ...list.map(canonicalSkill).filter(Boolean)])];
    if(next.length > MAX_SKILLS) status.textContent = `Up to ${MAX_SKILLS} skills: the first ${MAX_SKILLS} are kept.`;
    profile = readProfile({...profile, skills: next.slice(0, MAX_SKILLS)});
    showProfile(); save(); refresh();
  };

  tags.addEventListener('click', event => {
    const skill = event.target.closest('[data-remove]')?.dataset.remove;
    if(!skill) return;
    profile = readProfile({...profile, skills: profile.skills.filter(s => s !== skill)});
    showProfile(); save(); refresh(); input.focus();
  });
  const addTyped = () => { const value = input.value.split(',').map(s => s.trim()).filter(Boolean); if(value.length) { input.value = ''; addSkills(value); } };
  input.addEventListener('keydown', event => { if(event.key === 'Enter') { event.preventDefault(); addTyped(); } });
  $('[data-skill-add]').addEventListener('click', addTyped);
  $('[data-skill-resume]').addEventListener('click', () => {
    const found = skillsFromText($('#profile-resume').value);
    status.textContent = found.length ? `Found ${found.length} skill${found.length === 1 ? '' : 's'} in your resume.` : 'No skills WILSY knows were found in that text.';
    if(found.length) addSkills(found);
  });
  for(const [key, el] of Object.entries(fields)) el.addEventListener('change', () => { profile = readProfile({...profile, [key]: el.value}); save(); render(); });
  fields.years.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { profile = readProfile({...profile, years: fields.years.value}); save(); render(); }, 300); });
  onlyEligible.addEventListener('change', () => { save(); shown = 15; render(); });
  $('[data-profile-clear]').addEventListener('click', () => {
    profile = readProfile(null); onlyEligible.checked = false;
    try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(PROFILE_KEY + '-eligible'); } catch {}
    showProfile(); status.textContent = 'Profile cleared from this device.'; refresh();
  });
  results.addEventListener('click', event => { if(event.target.closest('[data-more]')) { shown += 30; render(); } });

  // Live jobs that list any of the skills (or a skill in their tech stack), newest first.
  async function fetchJobs(skills) {
    const list = encodeURIComponent(`{${skills.map(s => `"${s.replace(/["\\]/g, '')}"`).join(',')}}`);
    return databaseRequest(`wilsy_public_jobs?select=${COLUMNS}&or=(skills.ov.${list},tech_stack.ov.${list})&order=first_seen_at.desc.nullslast&limit=${FETCH_LIMIT}`);
  }
  async function refresh() {
    const key = [...profile.skills].sort().join('|');
    if(!profile.skills.length) { cache = {key: '', jobs: [], capped: false}; render(); return; }
    if(key === cache.key) { render(); return; }
    const mine = ++request;
    results.innerHTML = '<p class="match-empty">Finding live jobs that list your skills…</p>';
    try {
      const jobs = await fetchJobs(profile.skills);
      if(mine !== request) return;
      cache = {key, jobs: Array.isArray(jobs) ? jobs : [], capped: Array.isArray(jobs) && jobs.length >= FETCH_LIMIT};
      shown = 15; render();
      if(!counted) { counted = true; track('tool_use', {tool: 'my_wilsy'}); }
    } catch { if(mine === request) results.innerHTML = '<p class="match-empty">Couldn’t load live jobs just now. Check your connection and try again.</p>'; }
  }

  const place = job => { const mode = job.work_mode && job.work_mode !== 'unspecified' ? label(job.work_mode) : '';
    return [job.location, mode && !String(job.location || '').toLowerCase().includes(mode.toLowerCase()) ? mode : ''].filter(Boolean).join(' · '); };
  const dateText = value => new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'}).format(new Date(value));
  function jobRow({job, match, eligible}) {
    const missing = match.missing.slice(0, 4), more = match.missing.length - missing.length;
    return `<li class="mywilsy-job"><div class="mywilsy-job-main"><a class="mywilsy-job-title" href="${e(jobPath(job))}">${e(job.title)}</a>
      <p class="mywilsy-job-meta">${e(job.company)}${place(job) ? ` · ${e(place(job))}` : ''}</p>
      <ul class="mywilsy-chips" aria-label="Skills">${match.matched.map(s => `<li class="is-have">${e(s)}</li>`).join('')}${match.close.slice(0, 3).map(([skill, near]) => `<li class="is-close" title="Half credit: you have ${e(near)}">${e(skill)} ≈ ${e(near)}</li>`).join('')}${missing.map(s => `<li class="is-missing">${e(s)}</li>`).join('')}${more + Math.max(0, match.close.length - 3) > 0 ? `<li class="is-missing">+${more + Math.max(0, match.close.length - 3)} more</li>` : ''}</ul>
      <p class="mywilsy-job-fit ${eligible.ok ? 'is-ok' : 'is-short'}">${eligible.ok ? 'You meet what the listing states' : e(eligible.reasons.join(' · '))}</p></div>
      <div class="mywilsy-job-score"><strong>${match.score}%</strong><span>match</span><a href="/resume-match?job=${encodeURIComponent(job.id)}">Check resume</a></div></li>`;
  }

  function render() {
    if(!profile.skills.length) { results.innerHTML = '<p class="match-empty">Add a few skills to see your matches. Start with the languages, tools and subjects you know best.</p>'; return; }
    if(cache.key !== [...profile.skills].sort().join('|')) return;
    const all = rankJobs(profile, cache.jobs), eligible = all.filter(r => r.eligible.ok);
    const list = onlyEligible.checked ? eligible : all;
    if(!all.length) { results.innerHTML = `<p class="match-empty">No live jobs list ${profile.where === 'any' ? 'these skills' : `these skills ${profile.where === 'india' ? 'in India' : 'as remote'}`} right now. Try adding related skills, or <a href="/jobs">search all jobs</a>.</p>`; return; }
    const gaps = skillGaps(onlyEligible.checked && eligible.length ? eligible : all), plan = learningPlan(gaps.slice(0, 3));
    const companies = companiesHiring(list), soon = closingSoon(list);
    const known = profile.degree || profile.years != null || profile.gradYear;
    results.innerHTML = `<div class="mywilsy-summary"><div><strong>${all.length.toLocaleString('en-IN')}</strong><span>live jobs list your skills</span></div>
      <div><strong>${known ? eligible.length.toLocaleString('en-IN') : '—'}</strong><span>${known ? 'you qualify for' : 'add your degree or experience to check'}</span></div>
      <div><strong>${gaps[0] ? e(gaps[0].skill) : '—'}</strong><span>${gaps[0] ? `skill to learn next (asked by ${gaps[0].jobs})` : 'no gaps found'}</span></div></div>
      ${cache.capped ? `<p class="mywilsy-note">Your skills appear in more than ${FETCH_LIMIT.toLocaleString('en-IN')} live jobs; these are the newest ${FETCH_LIMIT.toLocaleString('en-IN')}. Add a location or more specific skills to narrow them.</p>` : ''}
      <section class="mywilsy-block" aria-labelledby="mw-matches"><h2 id="mw-matches">Best matches${onlyEligible.checked ? ' you qualify for' : ''}</h2>
        ${list.length ? `<ol class="mywilsy-jobs">${list.slice(0, shown).map(jobRow).join('')}</ol>${list.length > shown ? `<button class="secondary-button" type="button" data-more>Show more (${(list.length - shown).toLocaleString('en-IN')} left)</button>` : ''}`
          : '<p class="match-empty">None of the matching jobs fits the degree, experience and graduation year you entered. Untick “Only jobs I qualify for” to see them all, and why.</p>'}</section>
      <section class="mywilsy-block" aria-labelledby="mw-gaps"><h2 id="mw-gaps">Skills to learn next</h2>
        <p class="mywilsy-lead">The skills your matching jobs ask for most that are not in your profile.</p>
        ${gaps.length ? `<ol class="mywilsy-gaps">${gaps.map(g => { const link = learnLink(g.skill); return `<li><div><strong>${e(g.skill)}</strong><span>asked by ${g.jobs.toLocaleString('en-IN')} of your matches</span></div><a href="${e(link.url)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>Learn free: ${e(link.site)}</a></li>`; }).join('')}</ol>` : '<p class="match-empty">Your profile already covers every skill your matches ask for.</p>'}
        ${plan.length ? `<h3>Your 30-day plan</h3><ol class="mywilsy-plan">${plan.map(step => `<li><span class="mywilsy-week">Week ${step.week}</span><div><strong>${e(step.title)}</strong><p>${e(step.task)}${step.link ? ` <a href="${e(step.link.url)}"${step.link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(step.link.site)}</a>` : ''}</p></div></li>`).join('')}</ol>
          <p class="mywilsy-note">Prepare for interviews at the same time with the <a href="/dsa">DSA roadmap</a> and <a href="/interview-answers">interview answers</a>.</p>` : ''}</section>
      <section class="mywilsy-block" aria-labelledby="mw-companies"><h2 id="mw-companies">Companies hiring for your skills</h2>
        ${companies.length ? `<ul class="mywilsy-companies">${companies.map(c => `<li><a href="/jobs?company=${encodeURIComponent(c.company)}"><strong>${e(c.company)}</strong><span>${c.jobs} matching job${c.jobs === 1 ? '' : 's'}${c.skills.length ? ` · ${e(c.skills.join(', '))}` : ''}</span></a></li>`).join('')}</ul>` : '<p class="match-empty">No companies yet.</p>'}</section>
      <section class="mywilsy-block" aria-labelledby="mw-soon"><h2 id="mw-soon">Closing soon</h2>
        ${soon.length ? `<ul class="mywilsy-soon">${soon.slice(0, 8).map(({job}) => `<li><a href="${e(jobPath(job))}">${e(job.title)}</a> · ${e(job.company)} <span>closes ${e(dateText(job.deadline_at))}</span></li>`).join('')}</ul>`
          : '<p class="match-empty">None of your matches lists a closing date; most employers close a role when it is filled, so apply early. For dated openings see the <a href="/deadlines">deadlines calendar</a>.</p>'}</section>`;
  }

  showProfile();
  refresh();
}
