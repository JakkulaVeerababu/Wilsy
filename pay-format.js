export function usd(value) {
  return '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value / 1000) + 'k';
}
export function inr(value, rate) {
  const amount = value * rate;
  if (amount < 100000) return '₹' + new Intl.NumberFormat('en-IN', {maximumFractionDigits: 0}).format(amount);
  const crore = amount >= 10000000;
  return '₹' + new Intl.NumberFormat('en-IN', {maximumFractionDigits: 2}).format(amount / (crore ? 10000000 : 100000)) + (crore ? ' Cr' : ' L');
}
export function usdTextToInr(value,rate) {
  return String(value||'').replace(/(?:US\$|\$|USD\s*)([\d,]+(?:\.\d+)?)(\s*(?:thousand|million|billion|[kmb])\b)?(?:\s*[–-]\s*(?:US\$|\$|USD\s*)?([\d,]+(?:\.\d+)?)(\s*(?:thousand|million|billion|[kmb])\b)?)?/gi,(_,a,unitA,b,unitB)=>{
    const scale=unit=>({k:1e3,thousand:1e3,m:1e6,million:1e6,b:1e9,billion:1e9}[unit?.trim().toLowerCase()]||1);
    const left=Number(a.replaceAll(',',''))*scale(unitA||(b&&unitB));
    return b?`${inr(left,rate)} – ${inr(Number(b.replaceAll(',',''))*scale(unitB||unitA),rate)}`:inr(left,rate);
  });
}
export function salaryPeriod(period,raw='') {
  const aliases={year:'year',annual:'year',annually:'year',yearly:'year',yr:'year',month:'month',monthly:'month',hour:'hour',hourly:'hour',week:'week',weekly:'week',day:'day',daily:'day'};
  if(period)return aliases[String(period).toLowerCase()]||String(period);
  const periods=[['year',/\b(year|yearly|annual|annually|annum)\b/i],['month',/\b(month|monthly)\b/i],['hour',/\b(hour|hourly)\b/i],['week',/\b(week|weekly)\b/i],['day',/\b(day|daily)\b/i]].filter(([,pattern])=>pattern.test(raw));
  return periods.length===1?periods[0][0]:null;
}
export function salaryRange(salary, format) {
  return salary.min === salary.max ? format(salary.min) : `${format(salary.min)} – ${format(salary.max)}`;
}
