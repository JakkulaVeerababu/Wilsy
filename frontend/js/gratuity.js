import {gratuity, gratuityResult} from './gratuity-core.js';
import {track} from './analytics.js';

// /gratuity-calculator: recalculates as you type. The last working day starts at today's date.
const form = document.querySelector('[data-gratuity-form]');
if(form) {
  const result = document.querySelector('[data-gratuity-result]'), field = name => form.elements[name];
  let counted = false;
  const today = new Intl.DateTimeFormat('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  if(field('left').value !== today && field('left').defaultValue === field('left').value) field('left').value = today;
  field('joined').max = today;
  const update = event => {
    result.innerHTML = gratuityResult(gratuity({wages: field('wages').value, total: field('total').value, joined: field('joined').value, left: field('left').value, fixedTerm: field('type').value === 'fixed'}));
    if(event && !counted) { counted = true; track('tool_use', {tool: 'gratuity'}); }
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
