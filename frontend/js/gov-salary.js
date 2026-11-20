import {govPay, govPayResult, payCells, cellLabel, POSTS} from './govpay-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /government-salary-calculator: recalculates as you change the form. A post button picks its pay level; links can
// open a level or a post (?level=7 or ?post=inspector).
const form = document.querySelector('[data-gp-form]');
if(form) {
  const result = document.querySelector('[data-gp-result]'), field = name => form.elements[name];
  const posts = [...form.querySelectorAll('[data-gp-post]')];
  let counted = false;
  const fillCells = () => {
    const cells = payCells(field('level').value);
    field('basic').innerHTML = cells.map((pay, i) => `<option value="${pay}">${e(cellLabel(cells, i))}</option>`).join('');
    field('basic').selectedIndex = 0;
  };
  const press = id => posts.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gpPost === id)));
  const update = event => {
    result.innerHTML = govPayResult(govPay({level: field('level').value, basic: field('basic').value, city: field('city').value, higherTa: field('higherTa').checked,
      da: field('da').value, pension: field('pension').value, cghs: field('cghs').checked, other: field('other').value}));
    if(event && !counted) { counted = true; track('tool_use', {tool: 'govt_salary'}); }
  };
  for(const button of posts) button.addEventListener('click', () => {
    field('level').value = button.dataset.level;
    fillCells();
    press(button.dataset.gpPost);
    update(true);
  });
  form.addEventListener('change', event => {
    if(event.target === field('level')) { fillCells(); press(null); }
    // X cities all get the higher transport allowance; elsewhere it depends on the city.
    if(event.target === field('city')) field('higherTa').checked = field('city').value === 'X';
    update(event);
  });
  form.addEventListener('input', event => { if(event.target.type === 'number') update(event); });
  form.addEventListener('submit', event => { event.preventDefault(); update(event); });
  const params = new URLSearchParams(location.search), post = POSTS.find(([id]) => id === params.get('post'));
  const level = post ? post[2] : params.get('level');
  if(level && [...field('level').options].some(option => option.value === level)) { field('level').value = level; fillCells(); press(post ? post[0] : null); }
  update();
}
