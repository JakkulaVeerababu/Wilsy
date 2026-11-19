// In-hand salary estimate for a salaried employee in India, new tax regime, financial year 2026-27.
// Rules: slabs 0–4 L nil, 4–8 L 5%, 8–12 L 10%, 12–16 L 15%, 16–20 L 20%, 20–24 L 25%, above 24 L 30%;
// ₹75,000 standard deduction; no tax up to ₹12 L of taxable income, with marginal relief just above it;
// surcharge 10% above ₹50 L, 15% above ₹1 Cr, 25% above ₹2 Cr (the new regime's cap), with marginal relief;
// 4% health and education cess. Professional tax is not deductible in the new regime.
// It is an estimate: it ignores employer NPS, perquisites, other income and mid-year changes.

export const FY = '2026-27';
export const STANDARD_DEDUCTION = 75000;
export const REBATE_LIMIT = 1200000;
const SLABS = [[400000, 0], [800000, .05], [1200000, .10], [1600000, .15], [2000000, .20], [2400000, .25], [Infinity, .30]];
const SURCHARGE = [[5000000, .10], [10000000, .15], [20000000, .25]];
const CESS = .04;
export const PF_WAGE_CAP = 15000 * 12; // statutory PF wage ceiling; 12% of it is ₹21,600 a year

export function slabTax(taxable) {
  let tax = 0, lower = 0;
  for(const [upper, rate] of SLABS) { if(taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate; lower = upper; }
  return tax;
}
/** Income tax plus surcharge and cess on a taxable income, rounded to the rupee. */
export function incomeTax(taxable) {
  taxable = Math.max(0, Math.floor(taxable));
  let tax = slabTax(taxable);
  // Rebate: nothing to pay up to ₹12 L; just above it, tax can't exceed the income above ₹12 L.
  if(taxable <= REBATE_LIMIT) tax = 0;
  else tax = Math.min(tax, taxable - REBATE_LIMIT);
  // Surcharge with marginal relief: crossing a threshold can't cost more than the income above it.
  let surcharge = 0;
  for(let i = SURCHARGE.length - 1; i >= 0; i--) {
    const [threshold, rate] = SURCHARGE[i];
    if(taxable > threshold) {
      const below = i ? slabTax(threshold) * (1 + SURCHARGE[i - 1][1]) : slabTax(threshold);
      surcharge = Math.max(0, Math.min(tax * rate, below + (taxable - threshold) - tax));
      break;
    }
  }
  return Math.round((tax + surcharge) * (1 + CESS));
}

/**
 * ctc: total annual cost to company. variable: yearly bonus or variable pay inside the CTC (paid separately).
 * basicShare: basic pay as a share of fixed pay (0.5 = 50%). pf: 'basic' (12% of basic), 'capped' (12% of
 * at most ₹15,000 a month) or 'none'. gratuity: true when the CTC includes gratuity (4.81% of basic).
 * professionalTax: rupees a year (₹2,400 in many states, 0 where there is none).
 */
export function takeHome({ctc, variable = 0, basicShare = .5, pf = 'basic', gratuity = true, professionalTax = 2400} = {}) {
  ctc = Math.max(0, Number(ctc) || 0);
  variable = Math.min(ctc, Math.max(0, Number(variable) || 0));
  basicShare = Math.min(1, Math.max(.1, Number(basicShare) || .5));
  const fixed = ctc - variable, basic = fixed * basicShare;
  const employerPf = pf === 'none' ? 0 : .12 * (pf === 'capped' ? Math.min(basic, PF_WAGE_CAP) : basic);
  const gratuityPart = gratuity ? basic * .0481 : 0;
  const gross = Math.max(0, ctc - employerPf - gratuityPart);
  const employeePf = employerPf;
  const pt = Math.max(0, Math.min(Number(professionalTax) || 0, 2500));
  const taxable = Math.max(0, gross - STANDARD_DEDUCTION);
  const tax = incomeTax(taxable);
  const annual = Math.max(0, gross - employeePf - pt - tax);
  // Monthly pay leaves out the variable part; tax is shared across the year in proportion to gross pay.
  const fixedGross = gross - variable;
  const monthly = Math.max(0, (fixedGross - employeePf - pt - (gross ? tax * fixedGross / gross : 0)) / 12);
  return {ctc, variable, basic: Math.round(basic), employerPf: Math.round(employerPf), gratuity: Math.round(gratuityPart), gross: Math.round(gross),
    employeePf: Math.round(employeePf), professionalTax: pt, taxable: Math.round(taxable), tax, annual: Math.round(annual), monthly: Math.round(monthly),
    effectiveRate: gross ? tax / gross : 0};
}

export const rupees = value => '₹' + new Intl.NumberFormat('en-IN', {maximumFractionDigits: 0}).format(Math.round(value || 0));
