import {filterRows, sortRows, readFilters, filterQuery} from './salary-core.js';
import {statsHtml, chartHtml, rowsHtml} from './salary-view.js';

// The /salaries page: filters, summary numbers, distribution and the company table, all in the browser.
// The rows (one per company, INR per year) come from /data/salaries.json, written by the build.
const root = document.querySelector('[data-salaries]');
if(root) start(root).catch(() => {});

async function start(root) {
  const form = root.querySelector('[data-salary-filters]');
  let rows = [], shown = 50, filters = readFilters(location.search);
  const fill = () => {
    for(const [key, value] of Object.entries(filters)) {
      const field = form.elements[key]; if(!field) continue;
      if(field.type === 'checkbox') field.checked = value === '1'; else field.value = value;
    }
  };
  function render() {
    const list = sortRows(filterRows(rows, filters), filters.sort);
    root.querySelector('[data-salary-stats]').innerHTML = statsHtml(list);
    root.querySelector('[data-salary-chart]').innerHTML = chartHtml(list);
    root.querySelector('[data-salary-count]').textContent = list.length.toLocaleString('en-IN');
    root.querySelector('[data-salary-rows]').innerHTML = rowsHtml(list.slice(0, shown));
    root.querySelector('[data-salary-more]').hidden = list.length <= shown;
  }
  function update() {
    const data = new FormData(form);
    filters = {q: String(data.get('q') || '').trim(), role: data.get('role') || '', sector: data.get('sector') || '', stage: data.get('stage') || '', remote: data.get('remote') ? '1' : '', sort: data.get('sort') || 'pay'};
    shown = 50;
    const query = filterQuery(filters);
    history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
    render();
  }
  rows = await (await fetch('/data/salaries.json')).json();
  fill(); render();
  let typing;
  form.addEventListener('input', event => { if(event.target.name === 'q') { clearTimeout(typing); typing = setTimeout(update, 200); } });
  form.addEventListener('change', event => { if(event.target.name !== 'q') update(); });
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  root.querySelector('[data-salary-more]').addEventListener('click', () => { shown += 50; render(); });
}
