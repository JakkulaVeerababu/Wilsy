import {cgpaPlan, cgpaResult, fmt, SEMESTERS} from './cgpa-core.js';
import {track} from './analytics.js';

// /cgpa-calculator: the CGPA and percentage boxes follow each other; the semesters and the target update the result.
const form = document.querySelector('[data-cg-form]');
if(form) {
  const result = document.querySelector('[data-cg-result]'), field = name => form.elements[name];
  const custom = form.querySelector('[data-cg-custom]');
  let from = 'cgpa', counted = false;
  const update = event => {
    custom.hidden = field('formula').value !== 'custom';
    const semesters = Array.from({length: SEMESTERS}, (_, i) => ({sgpa: field('sgpa' + i).value, credits: field('credits' + i).value}));
    const plan = cgpaPlan({cgpa: field('cgpa').value, percent: field('percent').value, from, formula: field('formula').value, multiplier: field('multiplier').value,
      offset: field('offset').value, semesters, target: field('target').value, left: field('left').value, done: field('done').value});
    // Fill in the other box from the one typed in last, and leave that one alone.
    const typed = from === 'percent' ? field('percent') : field('cgpa'), other = from === 'percent' ? field('cgpa') : field('percent');
    other.value = typed.value.trim() && plan.convert && !plan.convert.fromSemesters ? fmt(from === 'percent' ? plan.convert.cgpa : plan.convert.percent) : '';
    result.innerHTML = cgpaResult(plan);
    if(event && !counted) { counted = true; track('tool_use', {tool: 'cgpa'}); }
  };
  form.addEventListener('input', event => {
    if(event.target === field('cgpa')) from = 'cgpa';
    if(event.target === field('percent')) from = 'percent';
    update(event);
  });
  form.addEventListener('change', event => { if(event.target.tagName === 'SELECT') update(event); });
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  update();
}
