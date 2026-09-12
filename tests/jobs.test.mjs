import test from 'node:test';
import assert from 'node:assert/strict';
import {readState,stateQuery,apiFilters,jobSalary,postingLabel,applyUrl,readSaved} from '../jobs-core.js';
const fx={rate:95.56,date:'2026-09-11'};

test('Job filters, page, saved view and selected job survive a shared URL',()=>{
  const state=readState('?q=C%2B%2B+engineer&mode=remote&country=India&stage=new-grad&visa=yes&skill=C%2B%2B&page=3&job=123&saved=1&sort=posted');
  assert.deepEqual(readState('?'+stateQuery(state)),state);
  assert.equal(apiFilters(state,['123']).saved[0],'123');
  assert.equal(apiFilters(state).id,undefined,'Selecting a detail must not replace the result list filter');
  assert.equal(readState('?page=-9&minimum=NaN&experience=bad&job=javascript:alert(1)').page,1);
  assert.equal(readState('?page=99999999').page,5001);
});
test('Salary filtering requires comparable original currency and pay period',()=>{
  assert.equal(apiFilters(readState('?minimum=50000')).minimum,undefined);
  assert.equal(apiFilters(readState('?minimum=50000&currency=USD&period=year')).minimum,'50000');
});
test('Monthly USD is converted without silently annualising or inventing missing bounds',()=>{
  const monthly=jobSalary({salary_min:6000,salary_max:7500,salary_currency:'USD',salary_period:'month'},fx);
  assert.match(monthly.primary,/₹5.73 L – ₹7.17 L \/ month/);
  assert.match(monthly.secondary,/\$6k – \$7.5k \/ month · original USD/);
  assert.match(monthly.note,/2026-09-11/);
  const unbounded=jobSalary({salary_min:100000,salary_max:null,salary_currency:'USD'},fx);
  assert.match(unbounded.primary,/^From ₹95.56 L · period not specified$/);
  assert.doesNotMatch(unbounded.secondary,/\$0k/);
  assert.equal(jobSalary({},fx).primary,'Salary not disclosed');
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
