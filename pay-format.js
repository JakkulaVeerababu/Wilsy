export function usd(value) {
  return '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value / 1000) + 'k';
}
export function inr(value, rate) {
  const amount = value * rate;
  const crore = amount >= 10000000;
  return '₹' + new Intl.NumberFormat('en-IN', {maximumFractionDigits: 2}).format(amount / (crore ? 10000000 : 100000)) + (crore ? ' Cr' : ' L');
}
export function salaryRange(salary, format) {
  return salary.min === salary.max ? format(salary.min) : `${format(salary.min)} – ${format(salary.max)}`;
}
