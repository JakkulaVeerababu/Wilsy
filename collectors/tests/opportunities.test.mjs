import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normaliseUnstopCompetition,unstopSubtype,readUnstopCompetitions,normaliseCodeforces,codeforcesSubtype,readCodeforces,parseAtCoder,isListable,plan,SOURCES} from '../opportunities.mjs';

const NOW=new Date('2026-11-15T00:00:00Z');
const unstop=(over={})=>({id:1810410,type:'competitions',subtype:'case_competition',title:'The Ultimate Brand Challenge 2026',regn_open:1,status:'LIVE',visibility:'public',isPaid:false,
  public_url:'competitions/the-ultimate-brand-challenge-2026-student-tribe-1810410',seo_url:'https://unstop.com/competitions/the-ultimate-brand-challenge-2026-student-tribe-1810410',
  region:'online',details:'<p><strong>Ultimate</strong> Brand Challenge</p>',end_date:'2026-12-31T23:59:00+05:30',organisation:{name:'Student Tribe'},
  filters:[{type:'eligible',name:'Engineering Students'},{type:'eligible',name:'Postgraduate'},{type:'category',name:'Marketing'}],
  required_skills:[{skill_name:'Branding'}],workfunction:[{name:'Marketing'}],
  regnRequirements:{start_regn_dt:'2026-11-14T00:00:00+05:30',end_regn_dt:'2026-12-31T23:59:00+05:30',min_team_size:1,max_team_size:3,eligibility:'{"sector":["students"]}'},
  address_with_country_logo:{city:'Mumbai',country:{name:'India'}},
  prizes:[{rank:'Top 3',cash:7500,currencyCode:'INR',others:'Goodies'},{rank:'4',cash:2500,currencyCode:'INR'}],
  registerCount:4,participants:[{name:'someone'}],...over});

test('Unstop competitions keep listing facts, INR prize totals and eligibility, and no personal data',()=>{
  const item=normaliseUnstopCompetition(unstop());
  assert.equal(item.open,true);
  const r=item.row;
  assert.deepEqual([r.kind,r.subtype,r.source_name,r.external_id],['competition','case','Unstop','1810410']);
  assert.equal(r.official_url,'https://unstop.com/competitions/the-ultimate-brand-challenge-2026-student-tribe-1810410');
  assert.equal(r.description,'Ultimate Brand Challenge');
  assert.equal(r.eligibility,'Open to: Engineering Students, Postgraduate.');
  assert.deepEqual(r.tags,['Branding','Marketing']);
  assert.equal(r.registration_deadline_at,'2026-12-31T18:29:00.000Z');
  assert.deepEqual([r.prize_amount,r.prize_currency,r.prize_text],[10000,'INR','₹10,000 in cash prizes']);
  assert.deepEqual([r.participation_mode,r.city,r.team_size_max],['online',null,3],'online events carry no city');
  assert.ok(!JSON.stringify(item).includes('someone'),'participants are never stored');
});

test('Paid entry, closed registration, private pages and non-competitions are not listed',()=>{
  assert.equal(normaliseUnstopCompetition(unstop({isPaid:true})).open,false);
  assert.equal(normaliseUnstopCompetition(unstop({regn_open:0})).open,false);
  assert.equal(normaliseUnstopCompetition(unstop({visibility:'private'})).open,false);
  assert.equal(normaliseUnstopCompetition(unstop({subtype:'workshops'})).open,false);
  assert.equal(normaliseUnstopCompetition(unstop({type:'hackathons',subtype:'online_coding_challenge'})).open,false,'hackathons have their own section');
  assert.equal(unstopSubtype({type:'quizzes',subtype:''}),'quiz');
  assert.equal(unstopSubtype({type:'competitions',subtype:''}),'general');
  assert.equal(unstopSubtype({type:'competitions',subtype:'innovation_challenge'}),'innovation');
});

test('Mixed-currency or non-INR prizes are not added up into an invented total',()=>{
  const r=normaliseUnstopCompetition(unstop({prizes:[{cash:100,currencyCode:'USD'},{cash:5000,currencyCode:'INR'}]})).row;
  assert.deepEqual([r.prize_amount,r.prize_text],[null,null]);
});

test('Unstop is read page by page for competitions and quizzes, without duplicates',async()=>{
  const calls=[];
  const pages={competitions:[[unstop({id:1}),unstop({id:2})],[unstop({id:3})]],quizzes:[[unstop({id:3,type:'quizzes'}),unstop({id:4,type:'quizzes',subtype:''})]]};
  const items=await readUnstopCompetitions(async url=>{calls.push(url);const u=new URL(url),type=u.searchParams.get('opportunity'),page=Number(u.searchParams.get('page'));
    return {data:{data:pages[type][page-1],last_page:pages[type].length}};});
  assert.equal(calls.length,3);
  assert.deepEqual(items.map(i=>i.row.external_id),['1','2','3','4']);
  await assert.rejects(readUnstopCompetitions(async()=>({data:null})),/Unexpected Unstop/);
});

test('Codeforces contests store facts only: name, start, length and link',async()=>{
  const c=normaliseCodeforces({id:2100,name:'Codeforces Round 999 (Div. 2)',type:'CF',phase:'BEFORE',durationSeconds:7200,startTimeSeconds:1763650500,relativeTimeSeconds:-100});
  assert.equal(c.open,true);
  assert.deepEqual([c.row.kind,c.row.subtype,c.row.official_url,c.row.duration_minutes],['contest','div2','https://codeforces.com/contests/2100',120]);
  assert.equal(c.row.starts_at,'2025-11-20T14:55:00.000Z');
  assert.equal(c.row.ends_at,'2025-11-20T16:55:00.000Z');
  assert.equal(c.row.description,null);
  assert.equal(codeforcesSubtype('Codeforces Round 1000 (Div. 1 + Div. 2)'),'div1_div2');
  assert.equal(codeforcesSubtype('Educational Codeforces Round 190 (Rated for Div. 2)'),'educational');
  const items=await readCodeforces(async()=>({status:'OK',result:[{id:1,name:'A',phase:'BEFORE',durationSeconds:60,startTimeSeconds:2e9},{id:2,name:'B',phase:'FINISHED',durationSeconds:60,startTimeSeconds:1}]}));
  assert.deepEqual(items.map(i=>i.row.external_id),['1']);
  await assert.rejects(readCodeforces(async()=>({status:'FAILED'})),/Unexpected Codeforces/);
});

const ATCODER=`<div id="contest-table-upcoming"><h3>Upcoming Contests</h3><table><thead><tr><th>Start Time</th><th>Contest Name</th><th>Duration</th><th>Rated Range</th></tr></thead><tbody>
<tr><td class="text-center"><a href='http://www.timeanddate.com/x'><time class='fixtime fixtime-full'>2026-11-21 21:00:00+0900</time></a></td><td ><span title="Algorithm">Ⓐ</span><span class="user-blue">◉</span> <a href="/contests/abc485">AtCoder Beginner Contest 485</a></td><td class="text-center">01:40</td><td class="text-center"> - 1999</td></tr>
<tr><td class="text-center"><time class='fixtime fixtime-full'>2026-11-29 19:00:00+0900</time></td><td ><a href="/contests/ahc075">AtCoder Heuristic Contest 075 &amp; more</a></td><td class="text-center">100:00</td><td class="text-center">All</td></tr>
</tbody></table></div><div id="contest-table-recent"><table><tr><td><a href="/contests/abc484">Old</a></td></tr></table></div>`;
test('AtCoder upcoming contests are parsed from the public contests page, with times in UTC',()=>{
  const items=parseAtCoder(ATCODER);
  assert.equal(items.length,2);
  const [abc,ahc]=items.map(i=>i.row);
  assert.deepEqual([abc.external_id,abc.subtype,abc.starts_at,abc.ends_at,abc.duration_minutes,abc.rated_range],
    ['abc485','abc','2026-11-21T12:00:00.000Z','2026-11-21T13:40:00.000Z',100,'- 1999']);
  assert.equal(abc.official_url,'https://atcoder.jp/contests/abc485');
  assert.deepEqual([ahc.title,ahc.subtype,ahc.duration_minutes],['AtCoder Heuristic Contest 075 & more','ahc',6000]);
  assert.throws(()=>parseAtCoder('<html>maintenance</html>'),/not found/);
});

test('Every source produces rows with the same columns, so batch upserts are consistent',()=>{
  const keys=[normaliseUnstopCompetition(unstop()),normaliseCodeforces({id:1,name:'A',phase:'BEFORE',durationSeconds:60,startTimeSeconds:2e9}),parseAtCoder(ATCODER)[0]]
    .map(i=>Object.keys(i.row).sort().join(','));
  assert.equal(new Set(keys).size,1);
});

test('Only items that can still be entered and have an HTTPS link are listed',()=>{
  const now=NOW.getTime(),open=normaliseUnstopCompetition(unstop());
  assert.equal(isListable(open,now),true);
  assert.equal(isListable(normaliseUnstopCompetition(unstop({regnRequirements:{end_regn_dt:'2026-11-01T00:00:00Z'}})),now),false);
  assert.equal(isListable(normaliseUnstopCompetition(unstop({seo_url:'http://unstop.com/x',public_url:''})),now),true,'falls back to the https unstop.com page');
  assert.equal(isListable({open:true,row:{...open.row,official_url:null}},now),false);
});

test('The plan upserts what is open and closes what ended, passed its deadline or was delisted',()=>{
  const fetched=[normaliseUnstopCompetition(unstop({id:1})),normaliseUnstopCompetition(unstop({id:1})),
    normaliseCodeforces({id:7,name:'Div. 3',phase:'BEFORE',durationSeconds:7200,startTimeSeconds:Date.parse('2026-11-20T00:00:00Z')/1000})];
  const existing=[
    {id:10,source_name:'Unstop',external_id:'1',status:'live'},                                       // still listed
    {id:11,source_name:'Unstop',external_id:'2',status:'live',registration_deadline_at:'2026-11-01T00:00:00Z'},
    {id:12,source_name:'Codeforces',external_id:'5',status:'live',ends_at:'2026-11-10T00:00:00Z'},
    {id:13,source_name:'Unstop',external_id:'3',status:'live'},                                       // delisted, Unstop read fine
    {id:14,source_name:'AtCoder',external_id:'abc1',status:'live'},                                   // AtCoder failed: kept
    {id:15,source_name:'Unstop',external_id:'4',status:'closed'}];
  const work=plan({existing,fetched,readOk:{Unstop:true,Codeforces:true,AtCoder:false},now:NOW});
  assert.deepEqual(work.upserts.map(r=>`${r.source_name}:${r.external_id}`),['Unstop:1','Codeforces:7'],'duplicates are written once');
  assert.ok(work.upserts.every(r=>r.status==='live'&&r.last_seen_at===NOW.toISOString()&&r.closed_at===null&&!('first_seen_at' in r)),
    'first_seen_at is left to the database default, so a refresh never resets it');
  assert.deepEqual(work.closes,[{id:11,reason:'registration_closed'},{id:12,reason:'ended'},{id:13,reason:'no_longer_listed'}]);
});

test('The hourly workflow runs the collector after hackathons without blocking them',async()=>{
  const workflow=await fs.readFile(new URL('../../.github/workflows/collect-hackathons.yml',import.meta.url),'utf8');
  assert.ok(workflow.indexOf('node collectors/hackathons.mjs')<workflow.indexOf('node collectors/opportunities.mjs'));
  assert.match(workflow,/continue-on-error: true/);
  assert.deepEqual(Object.values(SOURCES),['Unstop','Codeforces','AtCoder']);
  const source=await fs.readFile(new URL('../opportunities.mjs',import.meta.url),'utf8');
  for(const banned of ['codechef.com','leetcode.com','hasgeek.com','internshala.com','devpost.com','mlh.io'])
    assert.ok(!source.includes('https://'+banned)&&!source.includes('www.'+banned),`${banned} is never read`);
});
