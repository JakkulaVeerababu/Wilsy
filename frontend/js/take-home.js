import {takeHome} from './take-home-core.js';
import {takeHomeResult} from './take-home-view.js';

// The /salary-calculator page: recalculates as the visitor types. Values can be shared in the address
// (?ctc=1800000&variable=100000), so a result can be sent to someone else.
const form = document.querySelector('[data-calc-form]');
if(form) start(form);

function words(n) {
  if(!n) return '';
  if(n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} crore a year`;
  if(n >= 1e5) return `₹${+(n / 1e5).toFixed(2)} lakh a year`;
  return `₹${n.toLocaleString('en-IN')} a year`;
}
function start(form) {
  const result = document.querySelector('[data-calc-result]'), params = new URLSearchParams(location.search);
  for(const key of ['ctc', 'variable', 'basic']) if(/^\d{1,10}$/.test(params.get(key) || '')) form.elements[key].value = params.get(key);
  if(['basic', 'capped', 'none'].includes(params.get('pf'))) form.elements.pf.value = params.get('pf');
  const update = () => {
    const ctc = Math.max(0, Number(form.elements.ctc.value) || 0);
    const r = takeHome({ctc, variable: Number(form.elements.variable.value) || 0, basicShare: (Number(form.elements.basic.value) || 50) / 100,
      pf: form.elements.pf.value, gratuity: form.elements.gratuity.checked, professionalTax: Number(form.elements.pt.value) || 0});
    document.getElementById('calc-ctc-words').textContent = words(ctc);
    result.innerHTML = takeHomeResult(r);
    const query = new URLSearchParams({ctc: String(ctc)});
    if(r.variable) query.set('variable', String(r.variable));
    history.replaceState(null, '', location.pathname + '?' + query);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  if(params.has('ctc')) update();
}
