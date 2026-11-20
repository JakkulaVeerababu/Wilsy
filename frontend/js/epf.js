import {epfPlan, epfResult} from './epf-core.js';
import {track} from './analytics.js';

// /epf-calculator: recalculates as you type. Nothing leaves the browser.
const form = document.querySelector('[data-epf-form]');
if(form) {
  const result = document.querySelector('[data-epf-result]'), field = name => form.elements[name];
  let counted = false;
  const update = event => {
    result.innerHTML = epfResult(epfPlan({age: field('age').value, retire: field('retire').value, wage: field('wage').value, rise: field('rise').value,
      balance: field('balance').value, rate: field('rate').value, pfOn: field('pfOn').value, eps: field('eps').value === 'yes', vpf: field('vpf').value}));
    if(event && !counted) { counted = true; track('tool_use', {tool: 'epf'}); }
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
