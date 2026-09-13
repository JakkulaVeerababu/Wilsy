import test from 'node:test';
import assert from 'node:assert/strict';
import {readState,stateQuery,apiFilters,jobSalary,postingLabel,applyUrl,readSaved} from '../jobs-core.js';
import {usdTextToInr,salaryPeriod,inr} from '../pay-format.js';
const fx={rate:95.56,date:'2026-09-11'};

test('Job filters, page, saved view and selected job survive a shared URL',()=>{
  const state=readState('?q=C%2B%2B+engineer&mode=remote&country=India&stage=new-grad&visa=yes&skill=C%2B%2B&page=3&job=123&saved=1&sort=posted');
  assert.deepEqual(readState('?'+stateQuery(state)),state);
  assert.equal(apiFilters(state,['123']).saved[0],'123');
  assert.equal(apiFilters(state).id,undefined,'Selecting a detail must not replace the result list filter');
  assert.equal(readState('?page=-9&minimum=NaN&experience=bad&job=javascript:alert(1)').page,1);
  assert.equal(readState('?page=99999999').page,5001);
});
test('Salary filtering accepts INR and requires a known rate and pay period',()=>{
  assert.equal(apiFilters(readState('?minimum=50000')).minimum,undefined);
  const filters=apiFilters(readState('?minimum=50000&period=year'),[],fx);
  assert.equal(filters.minimum,'50000');assert.equal(filters.display_currency,'INR');assert.equal(filters.inr_rate,95.56);
  assert.equal(filters.currency,undefined);
});
test('Monthly USD is converted without silently annualising or inventing missing bounds',()=>{
  const monthly=jobSalary({salary_min:6000,salary_max:7500,salary_currency:'USD',salary_period:'month'},fx);
  assert.match(monthly.primary,/₹5.73 L – ₹7.17 L \/ month/);
  assert.equal(monthly.secondary,'INR estimate');
  assert.doesNotMatch(monthly.primary+monthly.secondary,/\$|USD/);
  assert.match(monthly.note,/2026-09-11/);
  const unbounded=jobSalary({salary_min:100000,salary_max:null,salary_currency:'USD'},fx);
  assert.match(unbounded.primary,/^From ₹95.56 L · period not specified$/);
  assert.doesNotMatch(unbounded.secondary,/\$0k/);
  assert.equal(jobSalary({},fx).primary,'Salary not disclosed');
});
test('Dollar text conversions preserve scale, ranges, percentages and nearby words',()=>{
  assert.equal(usdTextToInr('$150–200K',95.56),'₹1.43 Cr – ₹1.91 Cr');
  assert.equal(usdTextToInr('$100 base, 10% bonus',95.56),'₹9,556 base, 10% bonus');
  assert.equal(usdTextToInr('USD 1 million',95.56),'₹9.56 Cr');
  assert.equal(usdTextToInr('$6000 per month',95.56),'₹5.73 L per month');
  assert.equal(inr(5000,1),'₹5,000');
});
test('Pay periods are inferred only from an unambiguous explicit statement',()=>{
  assert.equal(salaryPeriod(null,'₹90,00,000 - ₹1,50,00,000 a year'),'year');
  assert.equal(salaryPeriod(null,'$6K–$7.5K per month'),'month');
  assert.equal(salaryPeriod(null,'Yearly pay; monthly stipend'),null);
  assert.equal(salaryPeriod(null,'₹60L plus equity'),null);
  assert.equal(salaryPeriod('monthly',''), 'month');
});
test('Discovery is never passed off as an employer posting timestamp',()=>{
  assert.match(postingLabel({first_seen_at:'2026-09-12T05:00:00Z'}),/^Found /);
  const dated=postingLabel({posted_at:'2026-09-12T00:00:00Z',posted_at_precision:'date_only'});
  assert.match(dated,/^Posted /);assert.doesNotMatch(dated,/00:00/);
});
test('Applications must use a real HTTPS URL without embedded credentials',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hi','//evil.com','https://user:password@example.com'])assert.equal(applyUrl(url),'');
  assert.equal(applyUrl('https://jobs.lever.co/example/123'),'https://jobs.lever.co/example/123');
});
test('Saved jobs recover safely from blocked, malformed, or unrelated storage',()=>{
  assert.deepEqual(readSaved({getItem:()=>'{bad'}),[]);
  assert.deepEqual(readSaved({getItem:()=>'{"id":1}'}),[]);
  assert.deepEqual(readSaved({getItem:()=>{throw new Error('Blocked');}}),[]);
  assert.deepEqual(readSaved({getItem:()=>'[1,"1","2","<script>",null]'}),['1','2']);
});
