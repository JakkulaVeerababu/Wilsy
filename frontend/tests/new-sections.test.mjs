import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {readOpportunityState,opportunityQuery,opportunityFilters,subtypeLabel} from '../js/opportunity-core.js';

// Workshops & events, Free courses and Startup grants (built after `npm run build`).
const root=path.resolve('dist');
const page=route=>fs.readFile(path.join(root,route+'.html'),'utf8');

test('Event and course filters read from the address keep only values each section knows',()=>{
  const e=readOpportunityState('event','?q=ai&subtype=workshop&mode=offline&when=week&sort=new&cash=yes&source=NPTEL');
  assert.deepEqual(e,{q:'ai',subtype:'workshop',mode:'offline',when:'week',sort:'new',page:1,id:''},'no cash or source filter on events');
  assert.equal(readOpportunityState('event','?subtype=case').subtype,'','competition types are not event types');
  const c=readOpportunityState('course','?subtype=ai&source=NPTEL&mode=online');
  assert.deepEqual(c,{q:'',subtype:'ai',source:'NPTEL',page:1,id:''});
  assert.equal(readOpportunityState('course','?source=Codeforces').source,'','only course sources');
  assert.equal(readOpportunityState('contest','?source=NPTEL').source,'','only contest platforms');
  assert.equal(opportunityQuery('course',c),'subtype=ai&source=NPTEL');
  assert.deepEqual(opportunityFilters('course',c),{kind:'course',subtype:'ai',source:'NPTEL'});
  assert.equal(subtypeLabel({kind:'event',subtype:'webinar'}),'Webinar or talk');
  assert.equal(subtypeLabel({kind:'course',subtype:'electronics'}),'Electronics and electrical');
});

test('Startup grant data cites official HTTPS pages, and states amounts and who can apply',async()=>{
  const data=JSON.parse(await fs.readFile('data/startup-grants.json','utf8'));
  assert.ok(data.items.length>=4);assert.match(data.reviewed_at,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(data.items.map(p=>p.slug)).size,data.items.length);
  for(const p of data.items){
    assert.match(p.slug,/^[a-z0-9-]+$/);
    for(const url of [p.url,p.check_url])assert.match(url,/^https:\/\/[^/]+\.(gov\.in|nic\.in)\//,`${p.slug} links an official government page`);
    for(const key of ['name','short','organizer','summary','who','amount','usual','format'])assert.ok(p[key],`${p.slug}.${key}`);
    assert.match(p.amount,/₹\d/,`${p.slug} states an amount in rupees`);
    assert.ok(Array.isArray(p.tags)&&p.tags.length);
    if(p.check?.auto===false)assert.ok(p.check.reason,`${p.slug} says why it is not checked daily`);
  }
});

test('The new sections are built, sit in every section’s tabs and the footer, and are searchable',async()=>{
  const events=await page('events'),courses=await page('free-courses'),grants=await page('startup-grants'),competitions=await page('competitions');
  for(const html of [events,courses,grants,competitions]){
    for(const href of ['/events','/free-courses','/startup-grants','/hackathons','/scholarships'])assert.ok(html.includes(`href="${href}"`),href);
    assert.match(html,/class="section-tabs"/);
    assert.match(html,/data-sources="[^"]*\bhackathons\b/,'the shared section styles are bundled');
  }
  assert.match(events,/data-kind="event"/);assert.match(events,/src="\/js\/opportunities.js"/);assert.match(events,/aria-current="page">Workshops &amp; events</);
  assert.match(events,/No sales demos/);assert.match(events,/id="opp-detail"/);
  assert.match(courses,/data-kind="course"/);assert.match(courses,/<select id="opp-source" name="source">/);assert.doesNotMatch(courses,/id="opp-detail"/,'courses open at the source');
  assert.match(courses,/NPTEL’s proctored exam and Microsoft’s certification exams have fees/);
  assert.match(grants,/4 grants/);assert.match(grants,/WILSY checks 3 of those pages every day/);
  const sisfs=await page('startup-grants/startup-india-seed-fund');
  assert.match(sisfs,/Up to ₹20 lakh as a grant/);assert.match(sisfs,/href="https:\/\/seedfund\.startupindia\.gov\.in\/"/);
  assert.match(sisfs,/Open all year/,'a rolling scheme is open, not "dates not announced"');
  assert.doesNotMatch(sisfs,/next dates are not announced/);
  assert.doesNotMatch(sisfs,/checks the official page every day/,'a script-drawn page is not claimed to be checked daily');
  assert.match(await page('startup-grants/nidhi-prayas'),/Next dates not announced/);
  assert.match(await page('startup-grants/birac-big'),/The 25th call closed on 30 November 2025/);
  const index=JSON.parse(await fs.readFile(path.join(root,'data/search-index.json'),'utf8'));
  const urls=new Set(JSON.stringify(index).match(/"\/[a-z0-9/-]+"/g));
  for(const url of ['/events','/free-courses','/startup-grants','/startup-grants/birac-big'])assert.ok(urls.has(`"${url}"`),url);
  const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
  for(const url of ['/events','/free-courses','/startup-grants','/startup-grants/nidhi-prayas'])assert.ok(sitemap.includes(`wilsy.in${url}<`),url);
});
