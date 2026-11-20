import {agePlan, ageResult} from './age-core.js';
import {track} from './analytics.js';

// /age-calculator: recalculates as you type. The cut-off date starts at today's date in India; the quick
// buttons offer today and the next 1 January and 1 August, the cut-off dates many notices use.
// The date of birth is never saved or sent anywhere.
const form = document.querySelector('[data-age-form]');
if(form) {
  const result = document.querySelector('[data-age-result]'), field = name => form.elements[name];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  if(field('on').value === field('on').defaultValue) field('on').value = today;
  const next = month => { const year = Number(today.slice(0, 4)), day = `${year}-${month}-01`; return day >= today ? day : `${year + 1}-${month}-01`; };
  const label = day => new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(day + 'T00:00:00Z'));
  const dates = [...form.querySelectorAll('[data-age-on]')];
  for(const button of dates) {
    const which = button.dataset.ageOn;
    button.dataset.day = which === 'today' ? today : next(which === 'jan' ? '01' : '08');
    if(which !== 'today') button.textContent = label(button.dataset.day);
  }
  const bands = [...form.querySelectorAll('[data-age-band]')];
  let counted = false;
  const update = event => {
    const plan = agePlan({birth: field('birth').value, on: field('on').value, min: field('min').value, max: field('max').value,
      category: field('category').value, pwbd: field('pwbd').checked, other: field('other').value, rule: field('rule').value});
    result.innerHTML = ageResult(plan);
    for(const button of dates) button.setAttribute('aria-pressed', String(button.dataset.day === field('on').value));
    for(const button of bands) button.setAttribute('aria-pressed', String(button.dataset.min === field('min').value && button.dataset.max === field('max').value));
    if(event && !counted) { counted = true; track('tool_use', {tool: 'age_calculator'}); }
  };
  for(const button of dates) button.addEventListener('click', event => { field('on').value = button.dataset.day; update(event); });
  for(const button of bands) button.addEventListener('click', event => { field('min').value = button.dataset.min; field('max').value = button.dataset.max; update(event); });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
