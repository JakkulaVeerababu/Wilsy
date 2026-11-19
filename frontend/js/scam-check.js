import {checkScam, VERDICTS, EXAMPLE, SCAM_MAX} from './scam-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /scam-check: checks a pasted offer or message for the warning signs of job scams, in this browser only.
// Nothing typed here is stored or sent anywhere.
const root = document.querySelector('[data-scam]');
if(root) {
  const field = root.querySelector('#scam-text'), result = root.querySelector('[data-scam-result]');
  let timer, counted = false;
  const LEVEL = {high: 'Strong sign', medium: 'Warning sign'};

  function render() {
    const text = field.value.slice(0, SCAM_MAX);
    const r = checkScam(text);
    if(!r.level) { result.innerHTML = '<p class="match-empty">Paste a message to check it.</p>'; return; }
    if(!counted) { counted = true; track('tool_use', {tool: 'scam_check'}); }
    const [title, advice] = VERDICTS[r.level];
    const count = r.flags.length;
    result.innerHTML = `<div class="scam-verdict is-${r.level}" role="status"><strong>${e(title)}</strong><span>${count ? `${count} warning sign${count === 1 ? '' : 's'} found. ` : ''}${e(advice)}</span></div>
      ${count ? `<ol class="scam-flags">${r.flags.map(f => `<li class="is-${f.level}"><span class="scam-level">${LEVEL[f.level]}</span><h3>${e(f.title)}</h3><p>${e(f.why)}</p><p class="scam-found">Found: <q>${e(f.found)}</q></p></li>`).join('')}</ol>` : ''}
      <div class="scam-next"><h3>Before you go further</h3><ul>
        <li>Find the company’s own careers page yourself (not through a link in the message) and check the job is listed there.</li>
        <li>Never pay a fee, buy a kit or “top up” to get a job, and never share an OTP, PIN or password.</li>
        <li>Ask for an interview on a video call and a written offer from a company email address.</li></ul></div>`;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  field.addEventListener('input', later);
  root.querySelector('[data-scam-example]').addEventListener('click', () => { field.value = EXAMPLE; render(); field.focus(); });
  root.querySelector('[data-scam-clear]').addEventListener('click', () => { field.value = ''; render(); field.focus(); });
  render();
}
