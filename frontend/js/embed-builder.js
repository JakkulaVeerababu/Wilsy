import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /embed: builds the widget code from the form and shows a live preview with the same script.
const form = document.querySelector('[data-embed-form]');
if(form) {
  const preview = document.querySelector('[data-embed-preview]'), code = document.querySelector('[data-embed-code]'), status = document.querySelector('[data-embed-status]');
  const origin = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? location.origin : 'https://www.wilsy.in';
  const KEYS = ['q', 'stage', 'role', 'country', 'mode', 'limit', 'theme', 'title'];
  const attrs = () => Object.fromEntries(KEYS.map(key => [key, String(form.elements[key]?.value || '').trim()]).filter(([key, value]) => value && !(key === 'theme' && value === 'light')));
  const snippet = a => `<div data-wilsy-jobs${Object.entries(a).map(([k, v]) => ` data-${k}="${e(v)}"`).join('')}><a href="${origin}/jobs">Jobs on WILSY</a></div>\n<script src="${origin}/embed.js" async></script>`;
  let timer;
  function update() {
    const a = attrs();
    code.textContent = snippet(a);
    const widget = document.createElement('div');
    widget.setAttribute('data-wilsy-jobs', '');
    for(const [k, v] of Object.entries(a)) widget.setAttribute('data-' + k, v);
    widget.innerHTML = `<a href="/jobs">Jobs on WILSY</a>`;
    preview.replaceChildren(widget);
    window.WilsyJobs?.render(widget);
  }
  form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 350); });
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  document.querySelector('[data-embed-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code.textContent); status.textContent = 'Code copied. Paste it into your site’s HTML.'; }
    catch { const range = document.createRange(); range.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(range); status.textContent = 'Press Ctrl+C to copy the selected code.'; }
    track('tool_use', {tool: 'embed'});
  });
  update();
}
