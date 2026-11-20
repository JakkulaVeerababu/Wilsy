import {IA_KEY, QUESTIONS, questionById, composeAnswer, answerChecks, checksList, cleanAnswers, answersText, questionForm, exampleText, exampleValues, spokenSeconds, secondsText} from './interview-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /interview-answers: pick a question, fill in its parts and see the answer, its spoken length and checks.
// Answers stay in this browser (only while "Save on this device" is ticked) and are never uploaded.
const root = document.querySelector('[data-ia]');
if(root) {
  const $ = selector => root.querySelector(selector);
  const formBox = $('[data-ia-form]'), preview = $('[data-ia-preview]'), meta = $('[data-ia-meta]'), checks = $('[data-ia-checks]');
  const status = $('[data-ia-status]'), keep = $('[data-ia-keep]'), timer = $('[data-ia-timer]'), practise = $('[data-ia-practice]');
  const printCopy = document.querySelector('[data-ia-print-copy]');
  const chips = [...root.querySelectorAll('input[name="ia-q"]')];
  let answers = {};
  try { answers = cleanAnswers(JSON.parse(localStorage.getItem(IA_KEY) || '{}')); } catch {}
  const asked = new URLSearchParams(location.search).get('q');
  let current = questionById(asked) || questionById(chips.find(c => c.checked)?.value) || QUESTIONS[0];
  const used = new Set();
  const once = via => { if(!used.has(via)) { used.add(via); track('tool_use', {tool: 'interview_answers', via}); } };

  const save = () => {
    try {
      if(keep.checked && Object.keys(answers).length) localStorage.setItem(IA_KEY, JSON.stringify(answers));
      else localStorage.removeItem(IA_KEY);
    } catch {}
  };
  const markDone = () => chips.forEach(chip => chip.closest('.letter-chip')?.classList.toggle('is-done', !!composeAnswer(questionById(chip.value), answers[chip.value])));
  const refresh = () => {
    const values = answers[current.id] || {}, text = composeAnswer(current, values);
    preview.textContent = text || 'Your answer appears here as you write.';
    preview.classList.toggle('is-empty', !text);
    const count = text ? text.split(/\s+/).length : 0;
    meta.textContent = text ? `${count} words · about ${secondsText(spokenSeconds(text))} spoken · aim for ${current.target[0]} to ${current.target[1]} seconds` : `Aim for ${current.target[0]} to ${current.target[1]} seconds`;
    checks.innerHTML = checksList(answerChecks(current, values));
    markDone();
  };
  const show = (question, {focus = false} = {}) => {
    current = question;
    formBox.innerHTML = questionForm(question, answers[question.id]);
    for(const chip of chips) chip.checked = chip.value === question.id;
    const url = new URL(location.href);
    url.searchParams.set('q', question.id);
    history.replaceState(null, '', url);
    stopTimer(false);
    status.textContent = '';
    refresh();
    if(focus) formBox.querySelector('#ia-question')?.focus();
  };

  for(const chip of chips) chip.addEventListener('change', () => { if(chip.checked) show(questionById(chip.value)); });
  // "Write your answer" links in the question list below open that question in the builder.
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-ia-open]'), question = link && questionById(link.dataset.iaOpen);
    if(!question) return;
    event.preventDefault();
    show(question);
    root.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
    formBox.querySelector('#ia-question')?.focus({preventScroll: true});
  });
  formBox.addEventListener('input', event => {
    const box = event.target.closest('[data-ia-field]');
    if(!box) return;
    const values = {...(answers[current.id] || {})};
    if(box.value.trim()) values[box.dataset.iaField] = box.value; else delete values[box.dataset.iaField];
    if(Object.keys(values).length) answers[current.id] = values; else delete answers[current.id];
    save();
    refresh();
  });
  formBox.addEventListener('click', event => {
    if(!event.target.closest('[data-ia-use]')) return;
    if(composeAnswer(current, answers[current.id]) && !confirm('Replace what you have written for this question with the example?')) return;
    answers[current.id] = exampleValues(current);
    save();
    show(current);
    formBox.querySelector('[data-ia-field]')?.focus();
  });

  const copy = async (text, done) => {
    if(!text) { status.textContent = 'Nothing to copy yet.'; return false; }
    try { await navigator.clipboard.writeText(text); status.textContent = done; return true; }
    catch { status.textContent = 'Copying is blocked here: select the text and copy it yourself.'; return false; }
  };
  $('[data-ia-copy]').addEventListener('click', async () => { if(await copy(composeAnswer(current, answers[current.id]), 'Answer copied.')) once('copy'); });
  $('[data-ia-copy-all]').addEventListener('click', async () => { if(await copy(answersText(answers), 'All your answers copied.')) once('copy'); });

  // Printing: every answered question, or the current one with its example when nothing is written yet.
  const fillPrint = () => {
    const done = QUESTIONS.filter(q => composeAnswer(q, answers[q.id]));
    const list = done.length ? done.map(q => [q.q, composeAnswer(q, answers[q.id])]) : [[current.q, exampleText(current)]];
    printCopy.innerHTML = `<h1>My interview answers</h1>${list.map(([q, a]) => `<h2>${e(q)}</h2><p>${e(a)}</p>`).join('')}`;
  };
  window.addEventListener('beforeprint', fillPrint);
  $('[data-ia-print]').addEventListener('click', () => { fillPrint(); once('print'); window.print(); });

  // Practise out loud: a stopwatch against the target time.
  let started = 0, ticking = 0;
  const shown = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  function stopTimer(report = true) {
    if(!started) return;
    const seconds = Math.round((performance.now() - started) / 1000), [lo, hi] = current.target;
    clearInterval(ticking);
    started = 0;
    practise.textContent = 'Practise out loud';
    practise.setAttribute('aria-pressed', 'false');
    if(report) status.textContent = `You spoke for ${secondsText(seconds)}. ${seconds < lo ? 'A little short: add a detail or a result.' : seconds > hi ? 'A little long: try cutting the background.' : 'Right in the range.'}`;
  }
  practise.addEventListener('click', () => {
    if(started) { stopTimer(); return; }
    started = performance.now();
    timer.textContent = '0:00';
    practise.textContent = 'Stop';
    practise.setAttribute('aria-pressed', 'true');
    status.textContent = `Say your answer out loud. Aim for ${current.target[0]} to ${current.target[1]} seconds.`;
    ticking = setInterval(() => { timer.textContent = shown(Math.round((performance.now() - started) / 1000)); }, 250);
    once('practice');
  });

  keep.addEventListener('change', () => { save(); status.textContent = keep.checked ? 'Your answers are saved on this device.' : 'Your answers are no longer saved. They stay until you leave the page.'; });
  $('[data-ia-clear]').addEventListener('click', () => {
    if(!Object.keys(answers).length) { status.textContent = 'Nothing to clear.'; return; }
    if(!confirm('Clear all your answers? This cannot be undone.')) return;
    answers = {};
    save();
    show(current);
    status.textContent = 'All answers cleared.';
  });
  show(current);
}
