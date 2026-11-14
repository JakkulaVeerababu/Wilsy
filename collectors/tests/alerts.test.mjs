import test from 'node:test';
import assert from 'node:assert/strict';
import {isDue,windowStart,groupByUser,newJobs,alertFilters,confirmedEmail,renderEmail,runAlerts,createResendSender,
  createRest,idempotencyKey,maskEmail,summaryMarkdown,jobPay,FROM,MANAGE_URL,SETTLE_MS,MAX_JOBS_PER_SEARCH} from '../alerts.mjs';

const NOW=new Date('2026-11-14T03:30:00Z');
const ago=hours=>new Date(NOW.getTime()-hours*3600e3).toISOString();
const fx={rate:95,date:'2026-09-11'};
const job=(id,hoursAgo,extra={})=>({id,title:`Engineer ${id}`,company:'Acme',city:'Bengaluru',country:'India',work_mode:'onsite',first_seen_at:ago(hoursAgo),...extra});
const confirmed=email=>({id:'u',email,email_confirmed_at:'2026-11-01T00:00:00Z'});
const response=(status,body={},headers={})=>({ok:status>=200&&status<300,status,
  headers:{get:name=>headers[name.toLowerCase()]??null},json:async()=>body,text:async()=>JSON.stringify(body)});

test('Daily alerts are due after about 23 hours, weekly after about 6.9 days, off never',()=>{
  assert.equal(isDue({alert:'daily',last_alerted_at:null},NOW),true);
  assert.equal(isDue({alert:'daily',last_alerted_at:ago(22)},NOW),false);
  assert.equal(isDue({alert:'daily',last_alerted_at:ago(23.2)},NOW),true);
  assert.equal(isDue({alert:'weekly',last_alerted_at:ago(24*6)},NOW),false);
  assert.equal(isDue({alert:'weekly',last_alerted_at:ago(24*6.95)},NOW),true);
  assert.equal(isDue({alert:'weekly',last_alerted_at:null},NOW),true);
  for(const alert of ['off','OFF','monthly','',null])assert.equal(isDue({alert,last_alerted_at:null},NOW),false);
});

test('Roles are new since the last alert, or for a first alert since saving, at most one period back',()=>{
  assert.equal(windowStart({alert:'daily',last_alerted_at:ago(30),created_at:ago(500)},NOW).toISOString(),ago(30));
  assert.equal(windowStart({alert:'daily',last_alerted_at:null,created_at:ago(2)},NOW).toISOString(),ago(2));
  assert.equal(windowStart({alert:'daily',last_alerted_at:null,created_at:ago(2000)},NOW).toISOString(),ago(24));
  assert.equal(windowStart({alert:'weekly',last_alerted_at:null,created_at:ago(2000)},NOW).toISOString(),ago(24*7));
});

test('Due searches are grouped per person, most overdue first, without off or early searches',()=>{
  const rows=[
    {user_id:'b',query:'role=backend',alert:'daily',last_alerted_at:ago(30)},
    {user_id:'a',query:'role=data',alert:'weekly',last_alerted_at:ago(24*8)},
    {user_id:'b',query:'q=react',alert:'weekly',last_alerted_at:null},
    {user_id:'b',query:'q=vue',alert:'off',last_alerted_at:null},
    {user_id:'c',query:'q=go',alert:'daily',last_alerted_at:ago(2)},
    {user_id:'d',query:'q=rust',alert:'off',last_alerted_at:null}];
  const users=groupByUser(rows,NOW);
  assert.deepEqual(users.map(u=>u.userId),['b','a']);
  assert.deepEqual(users[0].searches.map(s=>s.query),['role=backend','q=react']);
});

test('Only roles found inside the window count, newest first, ten at most',()=>{
  const since=new Date(ago(24)),until=new Date(NOW.getTime()-SETTLE_MS);
  const jobs=[job(1,25),job(2,24),job(3,23),job(4,1),job(4,1),job(5,0.01),{id:'x',first_seen_at:ago(1)},
    {id:6,discovered_at:ago(3)},{id:7}];
  const found=newJobs(jobs,since,until);
  assert.deepEqual(found.jobs.map(j=>j.id),[4,6,3]);
  assert.equal(found.count,3);assert.equal(found.more,false);
  const page=Array.from({length:50},(_,i)=>job(100+i,1+i/100));
  const full=newJobs(page,since,until);
  assert.equal(full.jobs.length,MAX_JOBS_PER_SEARCH);assert.equal(full.count,50);assert.equal(full.more,true);
});

test('Saved searches use the site filters, newest found first',()=>{
  assert.deepEqual(alertFilters('role=backend&country=India&sort=posted&time=week',fx),{time:'week',role:'backend',country:'India'});
  assert.deepEqual(alertFilters('q=react&period=year&minimum=1000000',fx),{q:'react',period:'year',minimum:'1000000',display_currency:'INR',inr_rate:95});
  assert.deepEqual(alertFilters('minimum=1000000',fx),{});
});

test('Only confirmed, unbanned, real addresses are emailed',()=>{
  assert.equal(confirmedEmail(confirmed('asha@example.com'),NOW),'asha@example.com');
  assert.equal(confirmedEmail({email:'asha@example.com',email_confirmed_at:null,confirmed_at:'2026-11-01T00:00:00Z'},NOW),null);
  assert.equal(confirmedEmail({...confirmed('asha@example.com'),banned_until:'2027-01-01T00:00:00Z'},NOW),null);
  assert.equal(confirmedEmail({...confirmed('asha@example.com'),banned_until:'2026-01-01T00:00:00Z'},NOW),'asha@example.com');
  assert.equal(confirmedEmail({...confirmed('asha@example.com'),is_anonymous:true},NOW),null);
  assert.equal(confirmedEmail(confirmed('not-an-address'),NOW),null);
  assert.equal(confirmedEmail(confirmed('a@b.com>, evil@x.com'),NOW),null);
  assert.equal(confirmedEmail(null,NOW),null);
  assert.equal(maskEmail('asha@example.com'),'as***@example.com');
});

test('The email lists each role with company, place, INR pay and links, and escapes everything',()=>{
  const hostile=job(42,2,{title:'<script>alert(1)</script> R&amp;D Lead',company:'Fish & "Chips" <Ltd>',location:'Pune\nIndia',
    salary_min:1200000,salary_max:1800000,salary_currency:'INR',salary_period:'year'});
  const usd=job(43,3,{title:'Remote SRE',work_mode:'remote',city:null,country:'United States',salary_min:100000,salary_max:160000,salary_currency:'USD',salary_period:'year'});
  const quiet=job(44,4,{title:'Analyst'});
  const sections=[{query:'q=%3Cimg+src%3Dx+onerror%3Dalert(1)%3E',alert:'daily',since:new Date(ago(24)),jobs:[hostile,usd,quiet],count:3,more:false}];
  const {subject,html,text}=renderEmail(sections,{fx});
  assert.equal(subject,'3 new roles for <img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; R&amp;D Lead'));
  assert.ok(!html.includes('&amp;amp;'));
  assert.ok(html.includes('Fish &amp; &quot;Chips&quot; &lt;Ltd&gt; · Pune India'));
  assert.ok(html.includes('₹12 L – ₹18 L / year'));
  assert.ok(html.includes('₹95 L – ₹1.52 Cr / year (INR estimate)'));
  assert.ok(html.includes('Remote · United States'));
  assert.ok(html.includes('href="https://www.wilsy.in/jobs?job=42&amp;utm_source=wilsy_alerts'));
  assert.ok(html.includes(`href="${MANAGE_URL}"`));
  assert.ok(html.includes('WILSY'));
  assert.ok(!/Salary not disclosed/.test(html),'undisclosed pay is left out');
  assert.ok(text.includes('- <script>alert(1)</script> R&D Lead'));
  assert.ok(text.includes('  Fish & "Chips" <Ltd> · Pune India · ₹12 L – ₹18 L / year'));
  assert.ok(text.includes('https://www.wilsy.in/jobs?job=42&utm_source=wilsy_alerts&utm_medium=email&utm_campaign=daily_alert'));
  assert.ok(text.includes(`Manage alerts: ${MANAGE_URL}`));
  assert.ok(!/[\r\n]/.test(subject));
});

test('Several searches make one email with one section each',()=>{
  const {subject,html,text}=renderEmail([
    {query:'role=backend&country=India',alert:'daily',since:new Date(ago(24)),jobs:[job(1,2)],count:1,more:false},
    {query:'q=react',alert:'weekly',since:new Date(ago(24*7)),jobs:Array.from({length:10},(_,i)=>job(10+i,5)),count:50,more:true}],{fx});
  assert.equal(subject,'51+ new roles for your saved searches');
  assert.ok(html.includes('Backend · India'));assert.ok(html.includes('50+ new since'));assert.ok(html.includes('showing 10'));
  assert.ok(text.includes('View all matches: https://www.wilsy.in/jobs?q=react&utm_source=wilsy_alerts&utm_medium=email&utm_campaign=weekly_alert'));
  assert.ok(text.includes('daily and weekly job alerts'));
  assert.equal(renderEmail([{query:'q=go',alert:'daily',since:new Date(ago(24)),jobs:[job(1,2)],count:1,more:false}],{fx}).subject,'1 new role for go');
});

test('Pay is shown only when the employer published it',()=>{
  assert.equal(jobPay(job(1,1),fx),'');
  assert.equal(jobPay(job(1,1,{salary_text:'Competitive'}),fx),'Competitive');
  assert.equal(jobPay(job(1,1,{salary_min:50000,salary_currency:'EUR',salary_period:'year'}),fx),'From EUR 50,000 / year');
});

function fakes({rows,users={},jobs={}}) {
  const calls={search:[],send:[],mark:[],getUser:[]};
  return {calls,deps:{now:NOW,fx,log:()=>{},
    loadSearches:async()=>rows,
    getUser:async id=>{calls.getUser.push(id);return users[id]??null;},
    search:async filters=>{calls.search.push(filters);const key=Object.entries(filters).map(([k,v])=>`${k}=${v}`).join('&');return {jobs:jobs[key]||[]};},
    send:async message=>{calls.send.push(message);return {id:'email_1'};},
    mark:async(userId,searches,at)=>{calls.mark.push({userId,queries:searches.map(s=>s.query),at:at.toISOString()});}}};
}
const sampleRows=[
  {user_id:'u1',query:'role=backend',alert:'daily',created_at:ago(100),last_alerted_at:ago(25)},
  {user_id:'u1',query:'q=react',alert:'weekly',created_at:ago(100),last_alerted_at:null},
  {user_id:'u1',query:'q=vue',alert:'off',created_at:ago(100),last_alerted_at:null},
  {user_id:'u2',query:'q=go',alert:'off',created_at:ago(100),last_alerted_at:null},
  {user_id:'u3',query:'q=rust',alert:'daily',created_at:ago(100),last_alerted_at:null},
  {user_id:'u4',query:'q=java',alert:'daily',created_at:ago(100),last_alerted_at:null}];
const sampleJobs={'role=backend':[job(1,3),job(2,30)],'q=react':[job(3,10)],'q=vue':[job(9,1)],'q=go':[job(8,1)],'q=rust':[job(7,1)],'q=java':[]};
const sampleUsers={u1:confirmed('one@example.com'),u2:confirmed('two@example.com'),u3:{email:'three@example.com',email_confirmed_at:null},u4:confirmed('four@example.com')};

test('A dry run sends nothing and writes nothing',async()=>{
  const {calls,deps}=fakes({rows:sampleRows,users:sampleUsers,jobs:sampleJobs});
  const lines=[];
  const report=await runAlerts({...deps,live:false,log:line=>lines.push(line),
    send:async()=>{throw new Error('sent during a dry run');},mark:async()=>{throw new Error('wrote during a dry run');}});
  assert.equal(report.emails,1);assert.equal(report.noConfirmedEmail,1);assert.equal(report.nothingNew,1);
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(lines,['[dry run] would email person 1: 2 searches, 2 roles shown'],'public logs name no address or search terms');
  assert.ok(summaryMarkdown(report).includes('dry run (nothing sent, nothing written)'));
  lines.length=0;
  await runAlerts({...deps,live:false,verbose:true,log:line=>lines.push(line)});
  assert.match(lines[0],/^\[dry run\] would email on\*\*\*@example\.com: "2 new roles for your saved searches"/);
  assert.ok(!lines[0].includes('one@example.com'),'even verbose logs never show the full address');
  assert.equal(calls.send.length+calls.mark.length,0);
});

test('Searches with alerts off are never searched or emailed',async()=>{
  const {calls,deps}=fakes({rows:sampleRows,users:sampleUsers,jobs:sampleJobs});
  await runAlerts({...deps,live:true});
  assert.ok(!calls.getUser.includes('u2'),'a person with only off alerts is not even looked up');
  assert.ok(!calls.search.some(f=>f.q==='vue'||f.q==='go'));
  assert.ok(!calls.send.some(m=>m.to==='two@example.com'));
  assert.ok(calls.send.every(m=>!m.html.includes('Engineer 9')&&!m.html.includes('Engineer 8')));
  assert.ok(calls.mark.every(m=>!m.queries.includes('q=vue')&&!m.queries.includes('q=go')));
});

test('A live run sends one email per person, then records the checked searches',async()=>{
  const {calls,deps}=fakes({rows:sampleRows,users:sampleUsers,jobs:sampleJobs});
  const report=await runAlerts({...deps,live:true});
  assert.equal(calls.send.length,1);
  const [message]=calls.send;
  assert.equal(message.to,'one@example.com');
  assert.ok(message.html.includes('Engineer 1')&&message.html.includes('Engineer 3')&&!message.html.includes('Engineer 2'));
  assert.match(message.idempotencyKey,/^wilsy-alert-[0-9a-f]{40}$/);
  const until=new Date(NOW.getTime()-SETTLE_MS).toISOString();
  // u3 has no confirmed address: nothing is recorded, so it is retried once confirmed.
  assert.deepEqual(calls.mark,[{userId:'u1',queries:['role=backend','q=react'],at:until},{userId:'u4',queries:['q=java'],at:until}]);
  assert.equal(report.emails,1);assert.equal(report.nothingNew,1);assert.equal(report.noConfirmedEmail,1);
});

test('The email cap leaves the rest for the next run, and failed sends are not recorded',async()=>{
  const rows=[{user_id:'u1',query:'q=a',alert:'daily',last_alerted_at:ago(48)},{user_id:'u2',query:'q=b',alert:'daily',last_alerted_at:ago(30)},
    {user_id:'u3',query:'q=c',alert:'daily',last_alerted_at:ago(26)}];
  const users={u1:confirmed('a@example.com'),u2:confirmed('b@example.com'),u3:confirmed('c@example.com')};
  const jobs={'q=a':[job(1,2)],'q=b':[job(2,2)],'q=c':[job(3,2)]};
  let {calls,deps}=fakes({rows,users,jobs});
  let report=await runAlerts({...deps,live:true,maxEmails:2});
  assert.deepEqual(calls.send.map(m=>m.to),['a@example.com','b@example.com']);
  assert.equal(report.leftForNextRun,1);
  ({calls,deps}=fakes({rows,users,jobs}));
  report=await runAlerts({...deps,live:true,send:async message=>{if(message.to==='a@example.com')throw Object.assign(new Error('Resend 422'),{status:422});calls.send.push(message);}});
  assert.deepEqual(calls.mark.map(m=>m.userId),['u2','u3']);
  assert.equal(report.sendErrors,1);
  ({calls,deps}=fakes({rows,users,jobs}));
  report=await runAlerts({...deps,live:true,send:async()=>{throw Object.assign(new Error('Resend 401'),{fatal:true});}});
  assert.equal(report.stopped,'Resend 401');assert.deepEqual(calls.mark,[]);assert.equal(calls.getUser.length,1);
  ({calls,deps}=fakes({rows,users,jobs}));
  report=await runAlerts({...deps,live:true,send:async()=>{throw Object.assign(new Error('Already sent'),{duplicate:true});}});
  assert.equal(calls.mark.length,3,'an email already accepted for this state is recorded, not sent again');
});

test('A failed search is retried next run, not recorded as checked',async()=>{
  const rows=[{user_id:'u1',query:'q=a',alert:'daily',last_alerted_at:null},{user_id:'u1',query:'q=b',alert:'daily',last_alerted_at:null}];
  const {calls,deps}=fakes({rows,users:{u1:confirmed('a@example.com')},jobs:{'q=b':[job(2,2)]}});
  const report=await runAlerts({...deps,live:true,search:async f=>{if(f.q==='a')throw new Error('Database 500');return {jobs:[job(2,2)]};}});
  assert.equal(report.searchErrors,1);assert.equal(calls.send.length,1);
  assert.deepEqual(calls.mark.map(m=>m.queries),[['q=b']]);
});

test('The idempotency key follows the searches, not their order',()=>{
  const a={query:'q=a',last_alerted_at:'2026-11-13T00:00:00Z'},b={query:'q=b',last_alerted_at:null};
  assert.equal(idempotencyKey('u1',[a,b]),idempotencyKey('u1',[b,a]));
  assert.notEqual(idempotencyKey('u1',[a,b]),idempotencyKey('u1',[{...a,last_alerted_at:'2026-11-14T00:00:00Z'},b]));
  assert.notEqual(idempotencyKey('u1',[a]),idempotencyKey('u2',[a]));
});

function sender(responses,options={}) {
  const requests=[],waits=[];
  const send=createResendSender({apiKey:'re_test',minIntervalMs:0,sleep:async ms=>{waits.push(ms);},...options,
    fetcher:async(url,init)=>{requests.push({url,init});const next=responses.shift();if(next instanceof Error)throw next;return next;}});
  return {send,requests,waits};
}
const message={to:'asha@example.com',subject:'3 new roles',html:'<p>x</p>',text:'x',idempotencyKey:'wilsy-alert-abc'};

test('Resend requests carry the sender, reply-to, unsubscribe header and idempotency key',async()=>{
  const {send,requests}=sender([response(200,{id:'email_1'})]);
  assert.deepEqual(await send(message),{id:'email_1'});
  const [{url,init}]=requests,body=JSON.parse(init.body);
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(init.headers.Authorization,'Bearer re_test');assert.equal(init.headers['Idempotency-Key'],'wilsy-alert-abc');
  assert.equal(body.from,FROM);assert.equal(FROM,'WILSY Alerts <alerts@wilsy.in>');
  assert.deepEqual(body.to,['asha@example.com']);assert.equal(body.reply_to,'contact@wilsy.in');
  assert.equal(body.headers['List-Unsubscribe'],`<${MANAGE_URL}>`);
  assert.equal(body.subject,'3 new roles');assert.equal(body.text,'x');
  assert.throws(()=>createResendSender({apiKey:''}),/RESEND_API_KEY/);
});

test('Rate limits and server errors are retried politely, honouring Retry-After',async()=>{
  let s=sender([response(429,{name:'rate_limit_exceeded'},{'retry-after':'2'}),response(200,{id:'ok'})]);
  assert.deepEqual(await s.send(message),{id:'ok'});
  assert.equal(s.requests.length,2);assert.deepEqual(s.waits,[2000]);
  s=sender([response(500),response(503),new TypeError('fetch failed'),response(200,{id:'ok'})]);
  assert.deepEqual(await s.send(message),{id:'ok'});
  assert.deepEqual(s.waits,[1000,2000,4000]);
  assert.equal(new Set(s.requests.map(r=>r.init.headers['Idempotency-Key'])).size,1,'every retry reuses the key');
  s=sender([response(502),response(502),response(502),response(502),response(200)]);
  await assert.rejects(s.send(message),/Resend 502/);
  assert.equal(s.requests.length,4,'three retries, then give up');
  s=sender([response(429,{},{'retry-after':'600'}),response(200,{id:'ok'})]);
  await s.send(message);assert.deepEqual(s.waits,[60000],'never waits more than a minute');
});

test('Bad requests are not retried; a bad key or a spent quota stops the run',async()=>{
  let s=sender([response(422,{name:'validation_error',message:'Invalid `to` field'})]);
  await assert.rejects(s.send(message),e=>e.status===422&&!e.fatal);
  assert.equal(s.requests.length,1);
  s=sender([response(401,{name:'missing_api_key'})]);
  await assert.rejects(s.send(message),e=>e.fatal===true);
  s=sender([response(429,{name:'daily_quota_exceeded'})]);
  await assert.rejects(s.send(message),e=>e.fatal===true);assert.equal(s.requests.length,1);
  s=sender([response(409,{name:'invalid_idempotent_request'})]);
  await assert.rejects(s.send(message),e=>e.duplicate===true);
});

test('Sends are spaced to stay under the provider rate limit',async()=>{
  let clock=0;
  const s=sender([response(200,{id:'a'}),response(200,{id:'b'})],{minIntervalMs:600,now:()=>clock,sleep:async ms=>{s.waits.push(ms);clock+=ms;}});
  await s.send(message);clock+=100;await s.send(message);
  assert.deepEqual(s.waits,[500]);
});

test('Database reads retry gateway errors and stop on client errors',async()=>{
  const seen=[];
  const replies=[response(503,{}),response(200,[{query:'q=a'}]),response(400,{message:'bad'}),response(404,{})];
  const db=createRest({url:'https://x.supabase.co',key:'k',sleep:async()=>{},fetcher:async(url,init)=>{seen.push([url,init.method]);return replies.shift();}});
  assert.deepEqual(await db('user_saved_searches?select=query'),[{query:'q=a'}]);
  await assert.rejects(db('user_saved_searches?bad'),/Database 400/);
  assert.equal(await db('admin/users/missing',{base:'auth/v1'}),null);
  assert.deepEqual(seen.map(s=>s[0]),['https://x.supabase.co/rest/v1/user_saved_searches?select=query','https://x.supabase.co/rest/v1/user_saved_searches?select=query',
    'https://x.supabase.co/rest/v1/user_saved_searches?bad','https://x.supabase.co/auth/v1/admin/users/missing']);
});
