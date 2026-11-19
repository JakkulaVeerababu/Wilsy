import {rupees} from './take-home-core.js';

// The calculator's result block, shared by the build (first render) and take-home.js.
export function takeHomeResult(r) {
  return `<div class="calc-headline"><div><span>In hand each month</span><strong>${rupees(r.monthly)}</strong><small>Fixed pay, after tax and PF</small></div><div><span>In hand per year</span><strong>${rupees(r.annual)}</strong><small>Including variable pay</small></div><div><span>Income tax per year</span><strong>${rupees(r.tax)}</strong><small>${(r.effectiveRate * 100).toFixed(1)}% of gross pay</small></div></div>
  <table class="calc-table"><caption class="sr-only">How the in-hand amount is worked out, per year</caption><tbody>
    <tr><th scope="row">Cost to company (CTC)</th><td>${rupees(r.ctc)}</td></tr>
    <tr><th scope="row">− Employer PF</th><td>${rupees(r.employerPf)}</td></tr>
    <tr><th scope="row">− Gratuity (paid later, not monthly)</th><td>${rupees(r.gratuity)}</td></tr>
    <tr class="calc-subtotal"><th scope="row">Gross pay</th><td>${rupees(r.gross)}</td></tr>
    <tr><th scope="row">− Your PF contribution</th><td>${rupees(r.employeePf)}</td></tr>
    <tr><th scope="row">− Professional tax</th><td>${rupees(r.professionalTax)}</td></tr>
    <tr><th scope="row">− Income tax with cess <span>(taxable income ${rupees(r.taxable)})</span></th><td>${rupees(r.tax)}</td></tr>
    <tr class="calc-total"><th scope="row">In hand per year</th><td>${rupees(r.annual)}</td></tr></tbody></table>`;
}
