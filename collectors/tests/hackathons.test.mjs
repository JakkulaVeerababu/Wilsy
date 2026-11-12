import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseUnstop,normaliseDevfolio,readUnstop,readDevfolio,isListable,plan,existingKey} from '../hackathons.mjs';

const NOW=new Date('2026-11-12T00:00:00Z');
const unstop=(over={})=>({id:1801814,title:'Code Sprint',public_url:'hackathons/code-sprint-1801814',seo_url:'https://unstop.com/hackathons/code-sprint-1801814',
  region:'offline',status:'LIVE',regn_open:1,visibility:'public',details:'<p>Build <b>things</b></p>',end_date:'2026-11-21T17:00:00+05:30',
  updated_at:'2026-11-11T23:16:56+05:30',organisation:{name:'KPR Institute'},workfunction:[{name:'Robotics'}],required_skills:[{skill_name:'Python'}],
  regnRequirements:{start_regn_dt:'2026-11-08T00:00:00+05:30',end_regn_dt:'2026-11-15T23:59:00+05:30',min_team_size:1,max_team_size:4,eligibility:'{"sector":["students"]}'},
  address_with_country_logo:{city:'Coimbatore',state:'Tamil Nadu',country:{name:'India',iso:'IN'}},
  prizes:[{rank:'1',cash:5000,currencyCode:'INR',certificate:1},{rank:'2',cash:3000,currencyCode:'INR'}],...over});
const devfolio=(over={})=>({uuid:'d957bc2099f945e99edfae0c2972bed9',name:'DevNexus 2.0',slug:'devnexus2',tagline:'Code through the night',desc:'A 24-hour hackathon.',
  type:'HACKATHON',status:'publish',private:false,is_online:false,city:'Kolkata',state:'West Bengal',country:'India',team_min:2,team_size:4,
  starts_at:'2026-11-27T18:30:00+00:00',ends_at:'2026-11-28T18:30:00+00:00',themes:[{name:'Open'}],prizes:[{name:'Best Beginner Team',desc:'For first-timers'}],
  hackathon_setting:{reg_starts_at:'2026-09-18T18:30:00+00:00',reg_ends_at:'2026-11-13T18:30:00+00:00',site:'https://devnexushackathon.in/',contact_email:'x@y.z'},
  participants_details:[{username:'someone'}],...over});

test('Unstop events map to the hackathon table with INR prizes and no personal data',()=>{
  const e=normaliseUnstop(unstop());
  assert.equal(e.open,true);
  assert.equal(e.row.source_url,'https://unstop.com/hackathons/code-sprint-1801814');
  assert.equal(e.row.external_hackathon_id,'1801814');
  assert.equal(e.row.description,'Build things');
  assert.equal(e.row.registration_deadline_at,'2026-11-15T18:29:00.000Z');
  assert.deepEqual([e.row.city,e.row.country,e.row.participation_mode,e.row.team_size_max],['Coimbatore','India','offline',4]);
  assert.equal(e.row.prize_pool_min,8000);assert.equal(e.row.prize_currency,'INR');assert.equal(e.row.has_cash_prize,true);
  assert.equal(e.prizes[0].value_text,'₹5,000');assert.equal(e.prizes[0].description,'Also: certificate.');
  assert.equal(e.row.eligibility,'Open to: students.');
});

test('Online Unstop events carry no venue location',()=>{
  const e=normaliseUnstop(unstop({region:'online'}));
  assert.equal(e.row.is_online,true);assert.equal(e.row.city,null);assert.equal(e.row.country,null);
});

test('Devfolio events link to the event page and never store contact details or participants',()=>{
  const e=normaliseDevfolio(devfolio());
  assert.equal(e.row.source_url,'https://devnexus2.devfolio.co/');
  assert.equal(e.row.official_url,'https://devnexushackathon.in/');
  assert.equal(e.row.registration_deadline_at,'2026-11-13T18:30:00.000Z');
  assert.equal(e.prizes[0].prize_name,'Best Beginner Team');assert.equal(e.row.has_cash_prize,null);
  assert.ok(!JSON.stringify(e).includes('x@y.z'));assert.ok(!JSON.stringify(e).includes('someone'));
});

test('Readers page through the listings and reject unexpected responses',async()=>{
  const pages=[];
  const items=await readUnstop(async url=>{const page=Number(/[?&]page=(\d+)/.exec(url)[1]);pages.push(page);return {data:{last_page:2,data:[unstop({id:page})]}};});
  assert.deepEqual(pages,[1,2]);assert.equal(items.length,2);
  await assert.rejects(readUnstop(async()=>({message:'down'})),/Unexpected Unstop/);
  const froms=[];
  const d=await readDevfolio(null,async(url,body)=>{froms.push(body.from);return {hits:{hits:body.from===0?Array.from({length:100},()=>({_source:devfolio()})):[{_source:devfolio()}]}};});
  assert.deepEqual(froms,[0,100]);assert.equal(d.length,101);
  await assert.rejects(readDevfolio(null,async()=>({})),/Unexpected Devfolio/);
});

test('Only open events with a future deadline are listed',()=>{
  assert.equal(isListable(normaliseUnstop(unstop()),NOW.getTime()),true);
  assert.equal(isListable(normaliseUnstop(unstop({regn_open:0})),NOW.getTime()),false);
  assert.equal(isListable(normaliseUnstop(unstop({regnRequirements:{end_regn_dt:'2026-11-01T00:00:00Z'}})),NOW.getTime()),false);
  assert.equal(isListable(normaliseDevfolio(devfolio({private:true})),NOW.getTime()),false);
});

test('Existing rows are matched by source id, including old Unstop rows that only stored a URL',()=>{
  assert.equal(existingKey({source_name:'Unstop',source_url:'https://unstop.com/competitions/arc-hackathon-1749704/amp'}),'unstop:1749704');
  assert.equal(existingKey({source_name:'Devfolio',external_hackathon_id:'abc'}),'devfolio:abc');
  assert.equal(existingKey({source_name:'Devpost',source_url:'https://x.devpost.com/'}),null);
});

test('A run inserts new events, refreshes known ones and closes expired or delisted ones',()=>{
  const fetched=[normaliseUnstop(unstop()),normaliseUnstop(unstop({id:2222222,title:'New One'})),normaliseDevfolio(devfolio())];
  const existing=[
    {id:1,source_name:'Unstop',source_url:'https://unstop.com/competitions/code-sprint-1801814/amp',metadata:{participants_seen:3}},
    {id:2,source_name:'Unstop',external_hackathon_id:'999',metadata:{}},
    {id:3,source_name:'Devpost',source_url:'https://a.devpost.com/',registration_deadline_at:'2026-10-01T00:00:00Z',metadata:{}},
    {id:4,source_name:'Devpost',source_url:'https://b.devpost.com/',registration_deadline_at:'2026-12-01T00:00:00Z',metadata:{}},
    {id:5,source_name:'Unstop',external_hackathon_id:'777',closed_at:'2026-10-01T00:00:00Z',metadata:{}},
  ];
  const work=plan({existing,fetched,readOk:{Unstop:true,Devfolio:true},now:NOW});
  assert.deepEqual(work.inserts.map(i=>i.key).sort(),['devfolio:d957bc2099f945e99edfae0c2972bed9','unstop:2222222']);
  assert.deepEqual(work.updates.map(u=>u.id),[1]);
  assert.equal(work.updates[0].row.metadata.participants_seen,3);
  assert.equal(work.updates[0].row.last_verified_at,NOW.toISOString());
  assert.deepEqual(work.prizeReplacements.map(p=>p.id),[1]);
  assert.deepEqual(work.closes,[{id:2,reason:'no_longer_listed'},{id:3,reason:'registration_closed'}]);
});

test('A source that failed or returned nothing never closes its events',()=>{
  const existing=[{id:2,source_name:'Unstop',external_hackathon_id:'999',metadata:{}}];
  assert.deepEqual(plan({existing,fetched:[],readOk:{Unstop:false,Devfolio:true},now:NOW}).closes,[]);
});

test('Unchanged prizes are not rewritten',()=>{
  const item=normaliseUnstop(unstop());
  const first=plan({existing:[],fetched:[item],readOk:{},now:NOW}).inserts[0];
  const again=plan({existing:[{id:9,source_name:'Unstop',external_hackathon_id:'1801814',metadata:first.row.metadata}],fetched:[item],readOk:{},now:NOW});
  assert.deepEqual(again.prizeReplacements,[]);
});
