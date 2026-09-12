// Read-only production contract checks. No writes or privileged keys.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {searchJobs,jobFacets,databaseRequest,loadCompanies} from '../data-client.js';
const facets=await jobFacets();assert.ok(facets.total>0);assert.ok(facets.companies_count>0);
const first=await searchJobs({}),second=await searchJobs({},20);
assert.equal(first.jobs.length,Math.min(20,first.total));
assert.ok(!first.jobs.some(a=>second.jobs.some(b=>a.id===b.id)),'Pages overlap');
assert.ok(first.jobs.every(j=>j.status==='published'&&!('source_payload' in j)&&!('metadata' in j)));
for(const mode of ['remote','hybrid','onsite']){const r=await searchJobs({mode});assert.ok(r.jobs.every(j=>j.work_mode===mode));}
const intern=await searchJobs({stage:'internship'});assert.ok(intern.total>0);assert.ok(intern.jobs.every(j=>j.is_internship||j.job_type==='internship'));
for(const [filter,field] of [['new-grad','is_new_grad'],['fresher','is_fresher']]){const r=await searchJobs({stage:filter});assert.ok(r.jobs.every(j=>j[field]));}
for(const [filter,field] of [['visa','visa_sponsorship'],['relocation','relocation_assistance']]){const r=await searchJobs({[filter]:'yes'});assert.ok(r.jobs.every(j=>j[field]===true));}
const hourly=await searchJobs({time:'hour'});assert.ok(hourly.jobs.every(j=>j.posted_at&&Date.parse(j.posted_at)>=Date.now()-3600000&&!['unknown','date_only','date'].includes(j.posted_at_precision)));
const unknown=await searchJobs({q:'wilsy-no-such-job-zzzzzz'});assert.equal(unknown.total,0);
const none=await searchJobs({saved:[]});assert.equal(none.total,0);
const one=await searchJobs({saved:[String(first.jobs[0].id)]});assert.equal(one.jobs[0].id,first.jobs[0].id);
const detail=await searchJobs({id:String(first.jobs[0].id)});assert.equal(detail.total,1);assert.ok(Array.isArray(detail.jobs[0].locations));
const monthly=await searchJobs({currency:'USD',period:'month',minimum:'6000'});assert.ok(monthly.jobs.every(j=>j.salary_currency==='USD'&&j.salary_period==='month'&&Math.max(j.salary_min||0,j.salary_max||0)>=6000));
const published=await databaseRequest('jobs?select=id,status,expires_at,deadline_at&limit=1000');assert.ok(published.every(j=>j.status==='published'&&(!j.expires_at||Date.parse(j.expires_at)>Date.now())&&(!j.deadline_at||Date.parse(j.deadline_at)>Date.now())));
const local=JSON.parse(await fs.readFile('data/companies.json','utf8')).companies;
const directory=await loadCompanies();assert.equal(directory.source,'database');assert.equal(directory.companies.length,local.length);
for(const c of local)assert.deepEqual(directory.companies.find(row=>row.id===c.id),c,`${c.id} changed during integration`);
console.log(`Live API passed: ${facets.total} jobs, ${facets.companies_count} companies, filtered pagination and detail access. All ${local.length} company records preserved exactly.`);
