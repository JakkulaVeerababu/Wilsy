import {settlement, settlementResult} from './settlement-core.js';
import {isDay} from './notice-core.js';
import {track} from './analytics.js';

// /full-and-final-settlement: recalculates as you type. The last working day starts at today's date in India,
// or comes from the link (?last=yyyy-mm-dd&short=days) the notice period calculator makes.
const form = document.querySelector('[data-ff-form]');
if(form) {
  const result = document.querySelector('[data-ff-result]'), field = name => form.elements[name];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const params = new URLSearchParams(location.search);
  const last = params.get('last'), short = params.get('short');
  if(isDay(last)) field('last').value = last;
  else if(field('last').value === field('last').defaultValue) field('last').value = today;
  if(/^\d{1,3}$/.test(short || '') && Number(short) <= 365) field('shortDays').value = short;
  let counted = false;
  const update = event => {
    const plan = settlement({last: field('last').value, monthly: field('monthly').value, basic: field('basic').value, paidDays: field('paidDays').value,
      payBasis: field('payBasis').value, leaveDays: field('leaveDays').value, leaveBasis: field('leaveBasis').value, joined: field('joined').value,
      fixedTerm: field('fixedTerm').checked, other: field('other').value, shortDays: field('shortDays').value, recoverOn: field('recoverOn').value,
      deductions: field('deductions').value, saturdays: field('saturdays').checked});
    result.innerHTML = settlementResult(plan);
    // The days-owed box suggests the date's day of the month.
    if(plan) field('paidDays').placeholder = String(Number(field('last').value.slice(8, 10)));
    if(event && !counted) { counted = true; track('tool_use', {tool: 'final_settlement'}); }
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
