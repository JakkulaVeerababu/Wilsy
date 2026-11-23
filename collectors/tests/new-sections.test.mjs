import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseUnstopEvent,unstopEventSubtype,readUnstop,isListable,plan} from '../opportunities.mjs';
import {normaliseMicrosoft,microsoftTopic,parseNptel,nptelTopic,firstPageLast,readMicrosoft} from '../courses.mjs';
import {rejection,normaliseInternship,readInternships} from '../unstop-internships.mjs';

const NOW=new Date('2026-11-23T00:00:00Z');
const workshop=(over={})=>({id:1824242,type:'workshops',subtype:'workshops',title:'Deep Learning Workshop',regn_open:1,status:'LIVE',visibility:'public',isPaid:false,
  seo_url:'https://unstop.com/workshops/deep-learning-workshop-iit-bombay-1824242',region:'offline',details:'<p>Hands-on <b>deep learning</b></p>',
  end_date:'2026-12-06T18:00:00+05:30',organisation:{name:'Indian Institute of Technology (IIT), Bombay'},filters:[{type:'eligible',name:'Engineering Students'}],
  regnRequirements:{start_regn_dt:'2026-11-20T00:00:00+05:30',end_regn_dt:'2026-12-06T10:00:00+05:30'},address_with_country_logo:{city:'Mumbai',country:{name:'India'}},
  registerCount:40,...over});

test('Free Unstop workshops become events, with dates and place, and no personal data',()=>{
  const item=normaliseUnstopEvent(workshop());
  assert.equal(item.open,true);
  assert.deepEqual([item.row.kind,item.row.subtype,item.row.external_id,item.row.city],['event','workshop','1824242','Mumbai']);
  assert.equal(item.row.registration_deadline_at,'2026-12-06T04:30:00.000Z');
  assert.equal(item.row.eligibility,'Open to: Engineering Students.');
  assert.equal(item.row.prize_amount,null);
  assert.ok(isListable(item,NOW.getTime()));
});

test('Paid events and coaching sales demos are left out; webinars and conferences get their own type',()=>{
  assert.equal(normaliseUnstopEvent(workshop({isPaid:true})).open,false,'a fee to attend');
  assert.equal(normaliseUnstopEvent(workshop({title:'GCP Data Engineer Training in Hyderabad | Free Demo'})).open,false,'a sales demo');
  assert.equal(normaliseUnstopEvent(workshop({title:'Data Science Training in Hyderabad'})).open,false,'a training-course advert');
  assert.equal(normaliseUnstopEvent(workshop({title:'Democracy and Technology Workshop'})).open,true,'"demo" only as a whole word');
  assert.equal(unstopEventSubtype({type:'workshops',title:'Founders Playbook Webinar Series'}),'webinar');
  assert.equal(unstopEventSubtype({type:'workshops',title:'Career Guidance Masterclass'}),'webinar');
  assert.equal(unstopEventSubtype({type:'conferences',title:'TEDxSurat'}),'conference');
  assert.equal(unstopEventSubtype({type:'competitions'}),null);
});

test('One Unstop read covers competitions and events, so a partial read never closes either',async()=>{
  const pages={competitions:[{id:1,type:'competitions',subtype:'case_competition',title:'Case',regn_open:1,status:'LIVE',visibility:'public',seo_url:'https://unstop.com/c/1'}],
    workshops:[workshop({id:2})],quizzes:[],webinars:[],conferences:[]};
  const items=await readUnstop(async url=>({data:{data:pages[new URL(url).searchParams.get('opportunity')],last_page:1}}));
  assert.deepEqual(items.map(i=>i.row.kind),['competition','event']);
  const work=plan({existing:[{id:9,source_name:'Unstop',external_id:'3',status:'live'}],fetched:items,readOk:{Unstop:false},now:NOW});
  assert.equal(work.closes.length,0,'a failed read closes nothing');
});

test('Microsoft Learn paths keep title, summary, level and length; school-only paths are left out',()=>{
  const p={uid:'learn.languages.fsharp-first-steps',type:'learningPath',title:'Take your first steps with F#',summary:'F# is an open-source language.',levels:['beginner'],
    roles:['developer','student'],subjects:['app-development'],duration_in_minutes:102,url:'https://learn.microsoft.com/en-us/training/paths/fsharp-first-steps/?WT.mc_id=api_CatalogApi'};
  const item=normaliseMicrosoft(p);
  assert.equal(item.open,true);
  assert.deepEqual([item.row.kind,item.row.subtype,item.row.source_name,item.row.duration_minutes],['course','programming','Microsoft Learn',102]);
  assert.equal(item.row.official_url,'https://learn.microsoft.com/en-us/training/paths/fsharp-first-steps/','tracking parameter removed');
  assert.deepEqual(item.row.tags,['Beginner','Self-paced']);
  assert.equal(normaliseMicrosoft({...p,roles:['k-12-educator','school-leader']}).open,false);
  assert.equal(normaliseMicrosoft({...p,url:'https://example.com/x'}).open,false,'only Microsoft Learn links');
  assert.equal(microsoftTopic({title:'Get started with generative AI',subjects:['cloud-computing']}),'ai','the title decides AI courses');
  assert.equal(microsoftTopic({title:'Secure your identities',subjects:['identity-access']}),'security');
});

test('NPTEL courses keep facts only: title, institute, teacher, discipline and link',()=>{
  const html=`<div class="course-card svelte-x"><a href="/courses/106106145" target="_blank" class="svelte-x"><span></span> <div class="content svelte-x"><div class="name svelte-x">NOC:Introduction to Machine Learning</div> <div class="discipline svelte-x">Computer Science and Engineering</div> <div class="meta-data svelte-x"><span class="svelte-x">Prof. B. Ravindran</span> <br/> <span class="svelte-x">IIT Madras</span></div></div></a></div>
  <div class="course-card svelte-x"><a href="/courses/108105132" target="_blank"><div class="content"><div class="name svelte-x">Basic Electronics &amp; Circuits</div> <div class="discipline svelte-x">Electrical Engineering</div> <div class="meta-data svelte-x"><span>Prof. A</span> <br/> <span>IIT Kharagpur</span></div></div></a></div>`;
  const [ml,ee]=parseNptel(html).map(i=>i.row);
  assert.deepEqual([ml.title,ml.organizer,ml.subtype,ml.official_url],['Introduction to Machine Learning','IIT Madras','ai','https://nptel.ac.in/courses/106106145']);
  assert.deepEqual(ml.tags,['Computer Science and Engineering','Prof. B. Ravindran','Video lectures']);
  assert.equal(ml.description,null,'no lesson content is copied');
  assert.deepEqual([ee.title,ee.subtype],['Basic Electronics & Circuits','electronics']);
  assert.throws(()=>parseNptel('<html></html>'),/not found/);
  assert.equal(nptelTopic('Strength of Materials','Civil Engineering'),'engineering');
  assert.equal(nptelTopic('Principles of Management','Management'),'business');
});

test('Courses for the first page are written last, and a bad catalogue response is an error',async()=>{
  const order=firstPageLast([{row:{subtype:'ai'}},{row:{subtype:'humanities'}},{row:{subtype:'programming'}}]).map(i=>i.row.subtype);
  assert.deepEqual(order,['humanities','programming','ai']);
  await assert.rejects(readMicrosoft(async()=>({learningPaths:[]})),/Unexpected Microsoft Learn/);
});

const internship=(over={},jd={})=>({id:1824397,title:'Full Stack Developer Internship',regn_open:1,status:'LIVE',visibility:'public',isPaid:false,
  seo_url:'https://unstop.com/internships/full-stack-developer-internship-vortizo-1824397',organisation:{name:'Vortizo AI'},details:'<p>Build things</p>',
  approved_date:'2026-11-23 15:01:38 GMT+0530',locations:[{city:'Mumbai'}],
  jobDetail:{min_salary:35000,max_salary:40000,currency:'fa-rupee',type:'in_office',show_salary:1,paid_unpaid:'paid',pay_in:'monthly',not_disclosed:false,locations:['Mumbai'],...jd},...over});

test('Unstop internships must be paid, show the stipend, charge no fee and be a tech role',()=>{
  assert.equal(rejection(internship()),null);
  assert.equal(rejection(internship({},{paid_unpaid:'unpaid'})),'unpaid');
  assert.equal(rejection(internship({},{show_salary:0})),'stipend_not_shown');
  assert.equal(rejection(internship({},{not_disclosed:true})),'stipend_not_shown');
  assert.equal(rejection(internship({},{min_salary:null,max_salary:null})),'stipend_not_shown');
  assert.equal(rejection(internship({isPaid:true})),'fee');
  assert.equal(rejection(internship({regn_open:0})),'closed');
  assert.equal(rejection(internship({title:'Front Desk Executive Internship'})),'not_tech');
});

test('A kept internship carries the stipend, place and Unstop link in the partner feed shape',async()=>{
  const j=normaliseInternship(internship());
  assert.deepEqual([j.title,j.company,j.location,j.work_mode,j.job_type],['Full Stack Developer Internship','Vortizo AI','Mumbai','onsite','internship']);
  assert.deepEqual([j.salary_min,j.salary_max,j.salary_currency,j.salary_period,j.salary_text],[35000,40000,'INR','month','₹35,000–40,000 a month stipend']);
  assert.equal(j.url,'https://unstop.com/internships/full-stack-developer-internship-vortizo-1824397');
  assert.equal(j.posted_at,'2026-11-23T09:31:38.000Z');
  assert.equal(normaliseInternship(internship({},{type:'wfh'})).location,'Remote');
  const {listed,kept,left}=await readInternships(async()=>({data:{data:[internship(),internship({id:2},{paid_unpaid:'unpaid'})],last_page:1}}));
  assert.deepEqual([listed,kept.length,left],[2,1,{unpaid:1}]);
});
