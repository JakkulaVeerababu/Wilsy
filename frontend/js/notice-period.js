import {noticePlan, noticeResult} from './notice-core.js';
import {track} from './analytics.js';

// /notice-period-calculator: recalculates as you type. The resignation date starts at today's date in India.
const form = document.querySelector('[data-notice-form]');
if(form) {
  const result = document.querySelector('[data-notice-result]'), field = name => form.elements[name];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  if(field('resigned').value === field('resigned').defaultValue) field('resigned').value = today;
  const presets = [...form.querySelectorAll('[data-notice-preset]')];
  const pressed = () => presets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.amount === field('amount').value && button.dataset.unit === field('unit').value)));
  let counted = false;
  const update = event => {
    const plan = noticePlan({resigned: field('resigned').value, amount: field('amount').value, unit: field('unit').value,
      waived: field('waived').value, joining: field('joining').value, monthly: field('monthly').value});
    result.innerHTML = noticeResult(plan, {today});
    pressed();
    if(event && !counted) { counted = true; track('tool_use', {tool: 'notice_period'}); }
  };
  for(const button of presets) button.addEventListener('click', event => {
    field('amount').value = button.dataset.amount;
    field('unit').value = button.dataset.unit;
    update(event);
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
