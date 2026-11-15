import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {readOpportunityState,opportunityQuery,opportunityFilters,subtypeLabel,closingLabel,durationLabel,contestStatus,contestIcs,dayKey} from '../js/opportunity-core.js';
import {programStatus} from '../scripts/programs-pages.mjs';

const root=path.resolve('dist');
const page=route=>fs.readFile(path.join(root,route+'.html'),'utf8');

test('Competition and contest filters read from the address keep only known values',()=>{
  const s=readOpportunityState('competition','?q=brand&subtype=case&mode=online&when=week&cash=yes&sort=new&page=3&item=42&evil=1');
  assert.deepEqual(s,{q:'brand',subtype:'case',mode:'online',when:'week',cash:'yes',sort:'new',page:3,id:'42'});
  assert.deepEqual(readOpportunityState('competition','?subtype=<script>&mode=moon&sort=x'),{q:'',subtype:'',mode:'',when:'',cash:'',sort:'soon',page:1,id:''});
  assert.equal(opportunityQuery('competition',{...s,sort:'soon',page:1,id:''}),'q=brand&subtype=case&mode=online&when=week&cash=yes');
  assert.deepEqual(opportunityFilters('contest',readOpportunityState('contest','?source=Codeforces&q=ignored')),{kind:'contest',source:'Codeforces'});
  assert.equal(readOpportunityState('contest','?source=LeetCode').source,'','only sources WILSY reads can be filtered');
});

test('Closing, length and start labels are short and honest',()=>{
  const now=new Date(2026,10,15,10,0).getTime();
  assert.deepEqual(closingLabel(new Date(2026,10,15,23,0).toISOString(),now),{text:'Closes today',soon:true});
  assert.deepEqual(closingLabel(new Date(2026,10,16,9,0).toISOString(),now),{text:'Closes tomorrow',soon:true});
  assert.equal(closingLabel(new Date(2026,11,30).toISOString(),now),null,'far deadlines get no chip');
  assert.equal(closingLabel(new Date(2026,10,14).toISOString(),now),null,'past deadlines get no chip');
  assert.deepEqual([durationLabel(100),durationLabel(120),durationLabel(150),durationLabel(10080),durationLabel(null)],['1 h 40 min','2 h','2 h 30 min','7 days',null]);
  assert.equal(contestStatus({starts_at:new Date(now-6e5).toISOString(),ends_at:new Date(now+6e5).toISOString()},now).text,'Live now');
  assert.equal(contestStatus({starts_at:new Date(now+3*36e5).toISOString()},now).text,'Starts in 3 h');
  assert.equal(contestStatus({starts_at:new Date(2026,10,18,20,0).toISOString()},now).text,'In 3 days');
  assert.equal(dayKey(new Date(2026,10,21,21,0).toISOString()),'2026-11-21');
  assert.equal(subtypeLabel({kind:'contest',subtype:'div2'}),'Div. 2');
  assert.equal(subtypeLabel({kind:'competition',subtype:'case'}),'Case competition');
});

test('Calendar files are valid one-event iCalendar with a reminder',()=>{
  const ics=contestIcs({source_name:'Codeforces',external_id:'2100',title:'Round 999; Div. 2, rated',official_url:'https://codeforces.com/contests/2100',
    starts_at:'2026-11-20T14:35:00.000Z',ends_at:'2026-11-20T16:35:00.000Z'},Date.parse('2026-11-15T00:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.match(ics,/\r\nUID:codeforces-2100@wilsy\.in\r\n/);
  assert.match(ics,/\r\nDTSTART:20261120T143500Z\r\nDTEND:20261120T163500Z\r\n/);
  assert.match(ics,/\r\nSUMMARY:Round 999\\; Div\. 2\\, rated\r\n/);
  assert.match(ics,/TRIGGER:-PT30M/);
  assert.ok(ics.split('\r\n').every(line=>line.length<=75),'long lines are folded');
  assert.equal(contestIcs({title:'No start'}),null);
});

test('Program status uses announced dates only, and never guesses',()=>{
  const now=Date.parse('2026-11-15T00:00:00Z');
  assert.equal(programStatus({next:null},now).text,'Next dates not announced');
  assert.equal(programStatus({next:{opens:'2027-03-16T18:00:00Z',closes:'2027-03-31T18:00:00Z'}},now).text,'Opens 16 March 2027');
  assert.equal(programStatus({next:{opens:'2026-11-01T00:00:00Z',closes:'2026-11-30T00:00:00Z'}},now).text,'Open until 30 November 2026');
  assert.equal(programStatus({next:{closes:'2026-11-01T00:00:00Z'}},now).key,'closed');
});

test('Open-source program data cites official HTTPS pages and is complete',async()=>{
  const data=JSON.parse(await fs.readFile('data/open-source-programs.json','utf8'));
  assert.ok(data.programs.length>=8);
  assert.equal(new Set(data.programs.map(p=>p.slug)).size,data.programs.length);
  for(const p of data.programs){
    assert.match(p.slug,/^[a-z0-9-]+$/);
    for(const url of [p.url,p.check_url])assert.match(url,/^https:\/\/[^/]+\//,`${p.slug} links an https page`);
    for(const key of ['name','short','organizer','summary','who','usual','format'])assert.ok(p[key],`${p.slug}.${key}`);
    assert.ok(Array.isArray(p.tags));
    assert.ok(!/mlh\.io|devpost\.com/i.test(JSON.stringify(p)),'MLH and Devpost are never read');
  }
});

test('Research internship and scholarship data cite official HTTPS pages and are complete',async()=>{
  for(const [file,money] of [['data/research-internships.json','stipend'],['data/scholarships.json','amount']]){
    const data=JSON.parse(await fs.readFile(file,'utf8'));
    assert.ok(data.items.length>=6,file);assert.match(data.reviewed_at,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Set(data.items.map(p=>p.slug)).size,data.items.length);
    for(const p of data.items){
      assert.match(p.slug,/^[a-z0-9-]+$/);
      for(const url of [p.url,p.check_url])assert.match(url,/^https:\/\/[^/]+\//,`${p.slug} links an https page`);
      for(const key of ['name','short','organizer','summary','who','usual','format',money])assert.ok(p[key],`${p.slug}.${key}`);
      assert.ok(Array.isArray(p.tags)&&p.tags.length);
      if(p.next)assert.ok(Number.isFinite(Date.parse(p.next.closes||p.next.opens)),`${p.slug}.next has a date`);
      if(p.check?.auto===false)assert.ok(p.check.reason,`${p.slug} says why it is not checked daily`);
      // Sources whose terms or robots rules forbid automated use, and aggregators, are never cited.
      assert.ok(!/buddy4study\.com|internshala|devpost\.com|mlh\.io/i.test(p.url+p.check_url),`${p.slug} cites the official site`);
    }
    for(const s of data.state_portals||[])assert.match(s.url,/^https:\/\/[^/]+\.gov\.in\//,s.state);
  }
});

test('Research internships and scholarships show announced dates only, and say when a page is not checked daily',async()=>{
  const research=await page('research-internships'),scholarships=await page('scholarships');
  assert.match(research,/Open until 30 November 2026/,'the academies’ fellowship shows its announced deadline');
  assert.match(research,/WILSY checks 6 of those pages every day/);
  assert.match(scholarships,/State scholarship portals/);assert.match(scholarships,/href="https:\/\/telanganaepass\.cgg\.gov\.in\/"/);
  const srip=await page('research-internships/iit-gandhinagar-srip');
  assert.match(srip,/WILSY updates this page when they are\./);assert.doesNotMatch(srip,/checks the official page every day/);
  assert.match(srip,/₹175 a day/,'fees are shown as the official site states them');
  const pragati=await page('scholarships/aicte-pragati');
  assert.match(pragati,/Open until 30 November 2026/);assert.match(pragati,/<dt>Amount<\/dt>/);
  assert.match(pragati,/subject=Scholarship%20correction%3A%20AICTE%20Pragati/);
});

test('The new sections are built, linked together, and the contest calendar carries no ads',async()=>{
  const competitions=await page('competitions'),contests=await page('contests'),programs=await page('open-source-programs'),hackathons=await page('hackathons');
  const research=await page('research-internships'),scholarships=await page('scholarships');
  for(const html of [competitions,contests,programs,hackathons,research,scholarships]){
    for(const href of ['/hackathons','/competitions','/contests','/open-source-programs','/research-internships','/scholarships'])assert.ok(html.includes(`href="${href}"`),href);
    assert.match(html,/class="section-tabs"/);
    assert.match(html,/data-sources="[^"]*\bhackathons\b/,'the shared hackathon styles are bundled');
  }
  assert.match(competitions,/data-kind="competition"/);assert.match(competitions,/src="\/js\/opportunities.js"/);
  assert.match(contests,/data-kind="contest"/);
  assert.ok(!/adsbygoogle|google-adsense-account/.test(contests),'no ads on the contest calendar');
  assert.match(contests,/codechef\.com\/contests/,'CodeChef appears only as a link');
  const gsoc=await page('open-source-programs/google-summer-of-code');
  assert.match(gsoc,/Google Summer of Code/);assert.match(gsoc,/href="https:\/\/summerofcode\.withgoogle\.com\/"/);
  assert.match(gsoc,/Next dates not announced/);
  for(const file of ['opportunities.js','opportunity-core.js'])await fs.access(path.join(root,'js',file));
});
