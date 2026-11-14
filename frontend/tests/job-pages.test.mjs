import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {jobPath,publishable,jobPosting,descriptionParagraphs} from '../scripts/job-pages.mjs';
import {landingPages,browseRoles,browseStages} from '../scripts/landing-pages.mjs';

const job={id:123,title:'Backend Engineer (Go)',company:'Acme',apply_url:'https://jobs.example.com/1',description:'<p>Build APIs &amp; services.</p><ul><li>Go</li><li>Postgres</li></ul><script>x</script>',
  posted_at:'2026-11-10T10:00:00Z',work_mode:'hybrid',job_type:'full_time',locations:[{city:'Bengaluru',state:'Karnataka',country:'India',country_code:'IN',location:'Bengaluru, Karnataka, India'}],
  salary_min:2000000,salary_max:3000000,salary_currency:'INR',salary_period:'year'};

test('Job pages get stable, readable URLs and only for live, applicable roles',()=>{
  assert.equal(jobPath(job),'/jobs/123-backend-engineer-go-acme');
  assert.ok(publishable(job,Date.parse('2026-11-14')));
  assert.ok(!publishable({...job,expires_at:'2026-11-01T00:00:00Z'},Date.parse('2026-11-14')));
  assert.ok(!publishable({...job,apply_url:'http://insecure.example.com'}));
  assert.ok(!publishable({...job,id:'abc'}));
});
test('Descriptions become escaped paragraphs without scripts',()=>{
  const html=descriptionParagraphs(job.description);
  assert.equal(html,'<p>Build APIs &amp; services.</p><p>• Go</p><p>• Postgres</p>');
  assert.match(descriptionParagraphs('a'.repeat(50)+' '+'b'.repeat(50),60),/ …<\/p>$/);
});
test('JobPosting data has the fields Google requires, and is skipped when they are unknown',()=>{
  const ld=jobPosting(job);
  assert.equal(ld['@type'],'JobPosting');
  assert.equal(ld.datePosted,'2026-11-10T10:00:00.000Z');
  assert.equal(ld.hiringOrganization.name,'Acme');
  assert.deepEqual(ld.jobLocation[0].address,{'@type':'PostalAddress',addressLocality:'Bengaluru',addressRegion:'Karnataka',addressCountry:'IN'});
  assert.equal(ld.employmentType,'FULL_TIME');
  assert.equal(ld.baseSalary.value.unitText,'YEAR');
  assert.equal(ld.directApply,false);
  assert.equal(jobPosting({...job,posted_at:null,first_seen_at:null,discovered_at:null}),null);
  assert.equal(jobPosting({...job,locations:[],location:'',country:null,work_mode:'remote'}),null);
  const remote=jobPosting({...job,locations:[],country:'India',work_mode:'remote'});
  assert.equal(remote.jobLocationType,'TELECOMMUTE');assert.equal(remote.applicantLocationRequirements.name,'India');
});
test('Landing pages are unique, linked from browse chips, and built for every slug',async()=>{
  assert.equal(new Set(landingPages.map(p=>p.slug)).size,landingPages.length);
  assert.ok(landingPages.every(p=>/^[a-z][a-z0-9-]+$/.test(p.slug)));
  for(const [url] of [...browseRoles,...browseStages])assert.ok(landingPages.some(p=>url==='/jobs/'+p.slug),url);
  for(const p of landingPages){
    const html=await fs.readFile(path.join('dist','jobs',p.slug+'.html'),'utf8');
    assert.match(html,new RegExp(`<h1>${p.title}</h1>`));
    assert.match(html,/href="\/jobs\?[^"]+">Filter these jobs/);
    if(!/class="job-list"/.test(html))assert.match(html,/noindex/);
  }
});
test('Built job pages carry JobPosting data and an employer apply link',async()=>{
  const files=(await fs.readdir(path.join('dist','jobs'))).filter(f=>/^\d+-/.test(f));
  assert.ok(files.length>0);
  for(const f of files){
    const html=await fs.readFile(path.join('dist','jobs',f),'utf8');
    assert.match(html,/Apply on employer site/);
    assert.match(html,/<link rel="canonical" href="https:\/\/www\.wilsy\.in\/jobs\/\d+-/);
    assert.doesNotMatch(html,/pagead2/);
    const ld=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    if(ld){const data=JSON.parse(ld[1]);assert.equal(data['@type'],'JobPosting');assert.ok(data.jobLocation||data.jobLocationType);}
  }
});
test('Landing searches retry transient failures and give up after three attempts',async()=>{
  const {fetchLandingJobs}=await import('../scripts/job-pages.mjs');
  const calls={};
  const search=async f=>{const k=JSON.stringify(f);calls[k]=(calls[k]||0)+1;if(f.role==='down')throw new Error('503');if(calls[k]<2)throw new Error('57014');return {total:5,jobs:[{id:1}]};};
  const r=await fetchLandingJobs([{slug:'a',filters:{role:'x'}},{slug:'b',filters:{role:'down'}}],{search,wait:async()=>{}});
  assert.deepEqual(r.get('a'),{total:5,jobs:[{id:1}]});
  assert.equal(r.get('b'),null);
  assert.equal(calls['{"role":"down"}'],3);
});
test('Short descriptions do not get a standalone page',async()=>{
  const {pageWorthy}=await import('../scripts/job-pages.mjs');
  assert.ok(!pageWorthy(job,Date.parse('2026-11-14')));
  assert.ok(pageWorthy({...job,description:'<p>'+'Build reliable APIs. '.repeat(40)+'</p>'},Date.parse('2026-11-14')));
});
