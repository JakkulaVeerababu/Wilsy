import {DURATIONS, PASSAGES, BEST_KEY, words, testText, typingScore, liveMarks, clock, bestAfter, shareText, whatsappLink, typingResult} from './typing-core.js';
import {escapeHtml as e} from './directory-core.js';
import {site} from './site-config.js';
import {track} from './analytics.js';

// /typing-test: the timer starts with the first key. Words turn green or red as you finish them, the passage
// scrolls with you, and the result compares your speed with SSC's skill tests. Best scores stay in this browser.
const root = document.querySelector('[data-typing]');
if(root) {
  const $ = selector => root.querySelector(selector);
  const box = $('[data-ty-passage]'), input = $('[data-ty-input]'), timer = $('[data-ty-timer]'), speed = $('[data-ty-speed]'), wrong = $('[data-ty-wrong]');
  const result = $('[data-ty-result]'), share = $('[data-ty-share]'), status = $('[data-ty-status]'), select = $('[data-ty-select]'), marksOn = $('[data-ty-marks]');
  const bestLine = $('[data-ty-best]'), whatsapp = share.querySelector('[data-share-whatsapp]');
  const times = [...root.querySelectorAll('[data-ty-minutes]')];
  const params = new URLSearchParams(location.search);
  let minutes = DURATIONS.some(([m]) => String(m) === params.get('minutes')) ? Number(params.get('minutes')) : 1;
  let passage = PASSAGES.some(p => p.id === params.get('passage')) ? params.get('passage') : select.value;
  let target = [], spans = [], painted = 0, startedAt = 0, ticker = 0, finished = false, tracked = false;

  const readBests = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch { return {}; } };
  const showBest = () => {
    const best = readBests()[minutes];
    bestLine.textContent = best ? `Your best for ${minutes} minute${minutes === 1 ? '' : 's'}: ${best.net} wpm at ${best.accuracy}% accuracy.` : '';
  };
  const elapsed = () => startedAt ? (performance.now() - startedAt) / 1000 : 0;

  function setup() {
    clearInterval(ticker);
    startedAt = 0; finished = false; painted = 0;
    target = words(testText(passage, minutes));
    box.innerHTML = target.map(word => `<span>${e(word)}</span>`).join(' ');
    spans = [...box.children];
    spans[0]?.classList.add('is-current');
    box.scrollTop = 0;
    input.value = '';
    input.readOnly = false;
    timer.textContent = clock(minutes * 60);
    speed.textContent = '0 wpm';
    wrong.textContent = '0';
    result.hidden = true;
    share.hidden = true;
    status.textContent = '';
    for(const button of times) button.setAttribute('aria-pressed', String(Number(button.dataset.tyMinutes) === minutes));
    select.value = passage;
    showBest();
  }

  function paint() {
    const {marks, index, onTrack} = liveMarks(input.value, target), show = marksOn.checked;
    const upto = Math.min(spans.length, Math.max(painted, index + 1) + 1);
    for(let i = 0; i < upto; i++) {
      const name = i < index ? (show && !marks[i] ? 'is-bad' : 'is-done') : i === index ? (show && !onTrack ? 'is-current is-bad' : 'is-current') : '';
      if(spans[i].className !== name) spans[i].className = name;
    }
    painted = index + 1;
    wrong.textContent = String(marks.filter(ok => !ok).length);
    // Keep the word in progress in view, a line from the top.
    const span = spans[Math.min(index, spans.length - 1)];
    if(span) {
      const line = span.offsetHeight || 28;
      if(span.offsetTop < box.scrollTop || span.offsetTop + line > box.scrollTop + box.clientHeight - line) box.scrollTop = Math.max(0, span.offsetTop - line);
    }
    return index;
  }

  function tick() {
    const left = Math.max(0, Math.ceil(minutes * 60 - elapsed()));
    timer.textContent = clock(left);
    speed.textContent = `${Math.round(input.value.trim().length / 5 / (Math.max(elapsed(), 1) / 60))} wpm`;
    if(left <= 0) finish();
  }

  function finish() {
    if(finished) return;
    finished = true;
    clearInterval(ticker);
    input.readOnly = true;
    const seconds = Math.min(minutes * 60, elapsed());
    const score = typingScore({typed: input.value, target: target.join(' '), seconds});
    const outcome = bestAfter(readBests(), minutes, score, new Date().toISOString().slice(0, 10));
    if(outcome.isBest) { try { localStorage.setItem(BEST_KEY, JSON.stringify(outcome.bests)); } catch {} }
    result.innerHTML = typingResult(score, {minutes, best: outcome.previous, isBest: outcome.isBest && !!outcome.previous});
    result.hidden = false;
    timer.textContent = clock(Math.max(0, Math.ceil(minutes * 60 - seconds)));
    if(score.words) {
      whatsapp.href = whatsappLink(shareText(score, minutes), `${site.origin}/typing-test?minutes=${minutes}&utm_source=whatsapp&utm_medium=share`);
      share.hidden = false;
      status.textContent = `Done: ${score.net} words a minute at ${score.accuracy}% accuracy.`;
      if(!tracked) { tracked = true; track('tool_use', {tool: 'typing_test', via: String(minutes)}); }
    } else status.textContent = 'No words typed.';
    showBest();
    result.focus();
  }

  input.addEventListener('input', () => {
    if(finished) return;
    if(!startedAt && input.value.trim()) { startedAt = performance.now(); ticker = setInterval(tick, 250); status.textContent = ''; }
    const index = paint(), list = words(input.value), lastWord = target[target.length - 1];
    if(index >= target.length || (list.length >= target.length && list[target.length - 1] === lastWord)) finish();
  });
  input.addEventListener('paste', event => { event.preventDefault(); status.textContent = 'Pasting is turned off in the test.'; });
  input.addEventListener('drop', event => event.preventDefault());
  for(const button of times) button.addEventListener('click', () => { minutes = Number(button.dataset.tyMinutes); setup(); input.focus(); });
  select.addEventListener('change', () => { passage = select.value; setup(); });
  $('[data-ty-restart]').addEventListener('click', () => { setup(); input.focus(); });
  $('[data-ty-next]').addEventListener('click', () => {
    const i = PASSAGES.findIndex(p => p.id === passage);
    passage = PASSAGES[(i + 1) % PASSAGES.length].id;
    setup();
    input.focus();
  });
  $('[data-ty-finish]').addEventListener('click', () => { if(startedAt) finish(); else status.textContent = 'Start typing first: the timer starts with your first key.'; });
  marksOn.addEventListener('change', () => { painted = spans.length; paint(); });
  if(typeof navigator.share === 'function') share.querySelectorAll('[data-share-native]').forEach(button => { button.hidden = false; });
  setup();
}
