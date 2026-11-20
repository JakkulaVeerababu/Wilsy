import {experience, experienceResult, experienceText, jobRow, MAX_JOBS} from './experience-core.js';
import {track} from './analytics.js';

// /experience-calculator: add jobs, and the total updates as you type. Nothing is saved or sent.
const form = document.querySelector('[data-xp-form]');
if(form) {
  const list = form.querySelector('[data-xp-jobs]'), add = form.querySelector('[data-xp-add]'), result = document.querySelector('[data-xp-result]');
  const asOn = form.elements.asOn;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  if(asOn.value === asOn.defaultValue) asOn.value = today;
  let next = list.children.length, counted = false, last = null;
  const read = () => [...list.querySelectorAll('[data-xp-job]')].map(box => {
    const value = name => box.querySelector(`[name="${name}"]`);
    return {name: value('company').value, from: value('from').value, to: value('to').value, current: value('current').checked};
  });
  const renumber = () => {
    [...list.children].forEach((box, i) => { box.querySelector('legend').textContent = `Job ${i + 1}`; });
    list.querySelectorAll('[data-xp-remove]').forEach(button => { button.hidden = list.children.length < 2; });
    add.hidden = list.children.length >= MAX_JOBS;
  };
  const update = event => {
    last = experience(read(), {asOn: asOn.value});
    result.innerHTML = experienceResult(last);
    if(event && !counted) { counted = true; track('tool_use', {tool: 'experience'}); }
  };
  form.addEventListener('input', update);
  form.addEventListener('change', event => {
    if(event.target.name === 'current') event.target.closest('[data-xp-job]').querySelector('[name="to"]').disabled = event.target.checked;
    update(event);
  });
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  add.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', jobRow(next++));
    renumber();
    list.lastElementChild.querySelector('input').focus();
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-xp-remove]');
    if(!button) return;
    button.closest('[data-xp-job]').remove();
    renumber();
    update(event);
    add.focus();
  });
  result.addEventListener('click', async event => {
    if(!event.target.closest('[data-xp-copy]')) return;
    const status = result.querySelector('[data-xp-status]'), text = experienceText(last);
    try { await navigator.clipboard.writeText(text); status.textContent = 'Copied: ' + text; }
    catch { status.textContent = 'Copying is blocked here: select the total and copy it yourself.'; }
  });
  renumber();
  update();
}
