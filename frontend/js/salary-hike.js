import {hikeResult, hikeTable, hikeFor, inWords} from './hike-core.js';
import {rupees} from './take-home-core.js';
import {track} from './analytics.js';

// /salary-hike-calculator: the hike percentage and the new CTC stay in step (edit either one); the table
// updates as you type. Values can be shared in the address (?ctc=1200000&hike=20).
const form = document.querySelector('[data-hike-form]');
if(form) {
  const result = document.querySelector('[data-hike-result]'), target = form.querySelector('[data-hike-target-out]');
  const field = name => form.elements[name];
  const num = name => Math.max(0, Number(field(name).value) || 0);
  const params = new URLSearchParams(location.search);
  let counted = false;
  if(/^\d{1,9}$/.test(params.get('ctc') || '')) field('current').value = params.get('ctc');
  if(/^\d{1,3}(?:\.\d)?$/.test(params.get('hike') || '')) field('hike').value = params.get('hike');

  const options = () => ({pf: field('pf').value, professionalTax: Number(field('pt').value) || 0});
  function update(source) {
    const current = num('current');
    // Whichever of hike and new CTC was edited last decides the other.
    if(source === 'offer') { const offer = num('offer'); field('hike').value = current ? +((offer - current) / current * 100).toFixed(1) : 0; }
    else field('offer').value = Math.round(current * (1 + num('hike') / 100));
    const r = hikeResult({current, offer: num('offer'), ...options()});
    result.innerHTML = hikeTable(r);
    document.getElementById('hike-current-words').textContent = inWords(current);
    document.getElementById('hike-new-words').textContent = inWords(num('offer'));
    form.querySelectorAll('[data-hike-step]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.hikeStep) === num('hike'))));
    const want = num('target'), need = want ? hikeFor(current, want, options()) : null;
    target.textContent = !want ? '' : need ? `About ${rupees(need.ctc)} a year${need.hike != null ? `: a ${need.hike >= 0 ? '' : 'cut of '}${Math.abs(need.hike).toFixed(1)}%${need.hike >= 0 ? ' hike' : ''}` : ''}.` : 'That’s beyond what this calculator covers.';
    history.replaceState(null, '', location.pathname + '?' + new URLSearchParams({ctc: String(current), hike: String(+num('hike').toFixed(1))}));
    if(!counted && source) { counted = true; track('tool_use', {tool: 'salary_hike'}); }
  }
  form.addEventListener('input', event => update(event.target.name === 'offer' ? 'offer' : event.target.name || 'input'));
  form.addEventListener('change', event => { if(event.target.tagName === 'SELECT') update('input'); });
  form.addEventListener('click', event => { const step = event.target.closest('[data-hike-step]'); if(step) { field('hike').value = step.dataset.hikeStep; update('hike'); } });
  form.addEventListener('submit', event => { event.preventDefault(); update('input'); });
  if(params.has('ctc') || params.has('hike')) update('');
}
