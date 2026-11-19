import test from 'node:test';
import assert from 'node:assert/strict';
import {listingIds,parseJobPage,parseApplyLink,parseSalary,parseDate,graduationYears,run,jobPageUrl} from '../thejobcompany.mjs';

const card=id=>`<div class="job-listing"><a target="_blank" href="frontend/job_details?job_id=${id}" class="applyBtn"><p class="company-title">X is hiring Y</p>
  <a target="_blank" class="job-apply" href="frontend/job_details?job_id=${id}">Apply Now</a></div>`;
const detail=({title='Forward Deployed Engineer Intern',company='Google'}={})=>`<div class="detail-top-in">
  <p class="position">${title}</p>
  <p class="company-name"><i class="fa-solid fa-building"></i> ${company}</p>
  <p class="upload-date"><i class="fa-solid fa-calendar-days"></i> Updated on: 16 November 2026</p></div>
  <div class="box-in"><div class="text"><p class="text-head">Work Location</p>
  <p class="text-ans">Bengaluru, India </p></div></div>
  <div class="box-in"><div class="text"><p class="text-head">Job Type</p><p class="text-ans">Internship + Fte</p></div></div>
  <div class="box-in"><div class="text"><p class="text-head">Batch</p><p class="text-ans">2027, 2028</p></div></div>
  <div class="box-in"><div class="text"><p class="text-head">Stream Required</p><p class="text-ans">Bachelor&#039;s degree in CS</p></div></div>
  <div class="box-in"><div class="text"><p class="text-head">Salary</p><p class="text-ans">35 - 55 LPA</p></div></div>
  <div class="job-description"><div class="jd-content"><h3>About the job</h3><ul><li>Build software with Python.</li></ul></div></div>
  <div class="apply-main"><p><strong>Disclaimer: </strong>Not part of the job.</p></div>`;
const applyPage=href=>`<a href="https://app.smartsheet.com/b/form/x">Channel Partner</a><a id="applyButton" href="${href}" target="_blank">Apply Now</a>`;

test('listing pages yield unique job IDs, newest first', () => {
  assert.deepEqual(listingIds(card(6628)+card(6629)+card(6629)), [6629,6628]);
  assert.deepEqual(listingIds('<p>nothing</p>'), []);
});

test('a job page becomes one WILSY job with its partner page as the source', () => {
  const job=parseJobPage(detail(),6629);
  assert.equal(job.company,'Google');
  assert.equal(job.title,'Forward Deployed Engineer Intern');
  assert.equal(job.location,'Bengaluru, India');
  assert.equal(job.job_type,'internship');
  assert.equal(job.posted_at,'2026-11-16T00:00:00.000Z');
  assert.deepEqual(job.graduation_years,[2027,2028]);
  assert.equal(job.education,"Bachelor's degree in CS");
  assert.equal(job.salary_min,3500000);assert.equal(job.salary_max,5500000);assert.equal(job.salary_period,'year');
  assert.match(job.description,/Build software with Python/);
  assert.doesNotMatch(job.description,/Disclaimer/);
  assert.equal(job.source_url,jobPageUrl(6629));
  assert.equal(parseJobPage('<h1>Not found</h1>',1),null);
});

test('the apply link is the employer link, never the partner site or plain http', () => {
  assert.equal(parseApplyLink(applyPage('https://careers.google.com/jobs/1/?a=1&amp;b=2#top')),'https://careers.google.com/jobs/1/?a=1&b=2');
  assert.equal(parseApplyLink(applyPage('https://example.oraclecloud.com/job/162274?')),'https://example.oraclecloud.com/job/162274');
  assert.equal(parseApplyLink(applyPage('http://insecure.example/job')),null);
  assert.equal(parseApplyLink(applyPage('https://thejobcompany.co.in/somewhere')),null);
  assert.equal(parseApplyLink('<a href="#">Apply</a>'),null);
});

test('salaries in LPA and monthly stipends become INR amounts; other text is kept as text', () => {
  assert.deepEqual(parseSalary('12 LPA'),{salary_text:'12 LPA',salary_min:1200000,salary_max:1200000,salary_currency:'INR',salary_period:'year'});
  assert.equal(parseSalary('4.5-6 LPA').salary_min,450000);
  assert.deepEqual(parseSalary('70,000- 80,000/Month(Expected Stipend)'),
    {salary_text:'70,000- 80,000/Month(Expected Stipend)',salary_min:70000,salary_max:80000,salary_currency:'INR',salary_period:'month'});
  assert.equal(parseSalary('25K per month').salary_min,25000);
  assert.deepEqual(parseSalary('Best in industry'),{salary_text:'Best in industry'});
  assert.deepEqual(parseSalary('Not Disclosed'),{});
  assert.equal(parseDate('16 November 2026'),'2026-11-16T00:00:00.000Z');
  assert.equal(parseDate('soon'),null);
  assert.deepEqual(graduationYears('2026/2027 & 2027'),[2026,2027]);
});

test('a run reads only new jobs, oldest first, and marks known ones as still listed', async () => {
  const pages={'https://thejobcompany.co.in/?page=1':card(103)+card(102)+card(101)+card(100),'https://thejobcompany.co.in/?page=2':''};
  const requested=[];
  const page=async url=>{requested.push(url);
    if(url in pages)return {text:pages[url]};
    const id=Number(/job_id=(\d+)/.exec(url)[1]);
    if(url.includes('apply_page'))return {text:applyPage(`https://jobs.example.com/${id}`)};
    return {text:detail({title:`Software Engineer ${id}`})};
  };
  const calls=[];
  const result=await run({pages:2,page,wait:async()=>{},readRange:{min:100,max:100},
    knownIds:async ids=>{assert.deepEqual(ids,[103,102,101,100]);return new Map([['101','published']]);},
    ingest:async feed=>{calls.push(feed);return {found:feed.jobs.length,seen:feed.seen?.length||0};}});
  // 100 was read before, 101 is already stored: only 102 and 103 are read, oldest first.
  assert.deepEqual(requested.filter(u=>u.includes('job_details')),[jobPageUrl(102),jobPageUrl(103)]);
  assert.deepEqual(calls[0].jobs.map(j=>j.url),['https://jobs.example.com/102','https://jobs.example.com/103']);
  assert.equal(calls[0].source,'thejobcompany');assert.equal(calls[0].name,'The Job Company');
  assert.deepEqual(calls.at(-1),{source:'thejobcompany',name:'The Job Company',jobs:[],seen:[jobPageUrl(101)],expire:true});
  assert.deepEqual(result.range,{min:100,max:103});assert.equal(result.read,2);assert.equal(result.seen,1);
});

test('a deeper run also reads older jobs below the already-read range, newest first', async () => {
  const cards=[110,109,108,107].map(card).join('');
  const read=[];
  const page=async url=>{
    if(url.endsWith('?page=1'))return {text:cards};
    if(url.includes('apply_page'))return {text:applyPage('https://jobs.example.com/x'+url.slice(-3))};
    read.push(Number(/job_id=(\d+)/.exec(url)[1]));return {text:detail({title:'Data Engineer'})};
  };
  const result=await run({pages:1,page,wait:async()=>{},readRange:{min:109,max:109},maxDetails:2,
    knownIds:async()=>new Map(),ingest:async()=>({})});
  // 110 is above the range, 108 the newest below it; 107 waits for the next run without leaving a gap.
  assert.deepEqual(read,[110,108]);
  assert.deepEqual(result.range,{min:108,max:110});
});

test('a job without an employer link stays reachable through the partner page', async () => {
  const page=async url=>{
    if(url.endsWith('?page=1'))return {text:card(7)};
    if(url.includes('apply_page'))throw new Error('apply page down');
    return {text:detail()};
  };
  const calls=[];
  await run({pages:1,page,wait:async()=>{},knownIds:async()=>new Map(),ingest:async feed=>{calls.push(feed);return {};}});
  assert.equal(calls[0].jobs[0].url,jobPageUrl(7));
});

test('an empty listing fails loudly instead of expiring every partner job', async () => {
  await assert.rejects(run({pages:1,page:async()=>({text:'<html></html>'}),wait:async()=>{},knownIds:async()=>new Map(),ingest:async()=>({})}),/No jobs found/);
});

test('a failed seen/expire update is recorded, not thrown, after the new jobs are saved', async () => {
  const page=async url=>{
    if(url.endsWith('?page=1'))return {text:[201,200].map(card).join('')};
    if(url.includes('apply_page'))return {text:applyPage('https://jobs.example.com/'+/job_id=(\d+)/.exec(url)[1])};
    return {text:detail({title:'Backend Engineer'})};
  };
  const saved=[];
  const result=await run({pages:1,page,wait:async()=>{},knownIds:async()=>new Map([['200','published']]),
    ingest:async feed=>{if(feed.expire)throw new Error('Database 500: {"code":"57014"}');saved.push(...feed.jobs);return {found:feed.jobs.length};}});
  assert.deepEqual(saved.map(j=>j.external_id),['201']);
  assert.equal(result.found,1);assert.equal(result.update_errors,1);assert.equal(result.read_errors,0);
  assert.match(result.errors.at(-1),/^seen\/expire update: Database 500/);
});
