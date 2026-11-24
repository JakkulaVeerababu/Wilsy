import test from 'node:test';
import assert from 'node:assert/strict';
import {shardOf,collectBoard,loadBoards,runStatus,retryableDbError,chunkJobs,jobKind,createDb,CHUNK_JOBS,CHUNK_BYTES} from '../collect.mjs';
import {HttpError} from '../ats.mjs';
import net from 'node:net';
import {createClient,CONNECT_ATTEMPT_MS} from '../http.mjs';
import {READERS} from '../boards.mjs';

test('loading the HTTP client gives each IPv4/IPv6 connection attempt at least 5 seconds', () => {
  assert.ok(CONNECT_ATTEMPT_MS>=5000);
  assert.ok(net.getDefaultAutoSelectFamilyAttemptTimeout()>=CONNECT_ATTEMPT_MS);
});
import {plainText,jobType,workMode,canonicalUrl} from '../boards.mjs';

test('Shards split the watchlist without overlap or gaps',()=>{
  const boards=Array.from({length:95},(_,i)=>({master_rank:i+1}));
  const shards=Array.from({length:10},(_,s)=>shardOf(boards,s,10).map(b=>b.master_rank));
  assert.equal(shards.flat().length,95);
  assert.equal(new Set(shards.flat()).size,95);
});

test('Boards are sent in small chunks, then a final call with every live URL',async()=>{
  const jobs=Array.from({length:120},(_,i)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`}));
  const calls=[];
  const totals=await collectBoard({master_rank:7,company:'Acme',ats_platform:'Ashby',ats_identifier:'acme'},
    {read:async()=>jobs,ingest:async payload=>{calls.push(payload);return {found:payload.jobs.length};}});
  assert.deepEqual(calls.map(c=>c.jobs.length),[20,20,20,20,20,20,0]);
  assert.ok(calls.slice(0,-1).every(c=>!('live_urls' in c)));
  assert.equal(calls.at(-1).live_urls.length,120);
  assert.deepEqual({ats:calls[0].ats,slug:calls[0].slug,master_rank:calls[0].master_rank},{ats:'ashby',slug:'acme',master_rank:7});
  assert.deepEqual(totals,{boards:1,found:120});
});

const longJob=(i,chars)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`,description:'x'.repeat(chars)});
test('Chunks stay under the job and size caps; one oversized job travels alone',()=>{
  assert.ok(CHUNK_JOBS<=20&&CHUNK_BYTES<=40_000);
  const chunks=chunkJobs(Array.from({length:30},(_,i)=>longJob(i,9000)));
  assert.ok(chunks.every(c=>Buffer.byteLength(JSON.stringify(c))<=CHUNK_BYTES+100));
  assert.deepEqual(chunks.map(c=>c.length),[4,4,4,4,4,4,4,2]);
  assert.deepEqual(chunkJobs([longJob(1,100),longJob(2,60_000),longJob(3,100)]).map(c=>c.map(j=>j.url.slice(-1))),[['1'],['2'],['3']]);
  assert.deepEqual(chunkJobs([]),[]);
});

test('Jobs the database would skip are counted here and not sent, but stay on the live list',async()=>{
  const jobs=[
    {title:'Account Executive',department:'Sales',url:'https://jobs.example/sales',description:'Sell things.'},
    {title:'Account Executive',department:'Sales',url:'https://jobs.example/sales-eng',description:'Work with our engineering team.'},
    {title:'Backend Engineer',url:'http://jobs.example/plain-http'},
    {title:'  ',url:'https://jobs.example/no-title'},
    {title:'Platform Engineer',url:'https://jobs.example/platform'}
  ];
  const calls=[];
  const totals=await collectBoard({master_rank:4,company:'Acme',ats_platform:'greenhouse',ats_identifier:'acme'},
    {read:async()=>jobs,ingest:async payload=>{calls.push(payload);return {found:payload.jobs.length};}});
  assert.deepEqual(calls[0].jobs.map(j=>j.url),['https://jobs.example/sales-eng','https://jobs.example/platform']);
  assert.equal(calls[1].live_urls.length,5);
  assert.deepEqual(totals,{boards:1,found:2,other_roles:1,invalid:2});
});

// Each expectation below was checked against Postgres with the tech_re of wilsy_ingest_board.
test('The role test matches the database: title, department and the first 1200 characters',()=>{
  const job=(fields)=>({title:'Account Executive',url:'https://jobs.example/1',...fields});
  assert.equal(jobKind(job({department:'Machine Learning'})),'tech');
  // "engineer" ends exactly at character 1200, then one character too late.
  assert.equal(jobKind(job({description:`${'a '.repeat(596)}engineer`})),'tech');
  assert.equal(jobKind(job({description:`${'a '.repeat(597)}engineer`})),'other_roles');
  // Postgres left() counts characters: 1194 emoji are 1194 characters, but 2388 UTF-16 units.
  assert.equal(jobKind(job({description:`${'🙂'.repeat(1194)}devops`})),'tech');
  // Postgres, like JavaScript, lowercases İ to i plus a combining dot, so "İOS" is not "ios" there either.
  assert.equal(jobKind(job({title:'İOS Lead Advocate'})),'other_roles');
  assert.equal(jobKind(job({title:'SENIOR ENGINEER'})),'tech');
  assert.equal(jobKind(job({title:'Head of Mail'})),'other_roles');
  assert.equal(jobKind(job({title:'Head of ML'})),'tech');
  assert.equal(jobKind(job({title:'HTML Writer'})),'other_roles');
});

const timeoutError=()=>Object.assign(new Error('Database 500: {"code":"57014"}'),{timeout:true});
test('A chunk cancelled by the statement timeout is split until it fits; nothing is lost',async()=>{
  const jobs=Array.from({length:20},(_,i)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`}));
  const sizes=[];
  const totals=await collectBoard({master_rank:5,company:'Big',ats_platform:'greenhouse',ats_identifier:'big'},
    {read:async()=>jobs,ingest:async payload=>{sizes.push(payload.jobs.length);if(payload.jobs.length>5)throw timeoutError();return {found:payload.jobs.length};}});
  assert.deepEqual(sizes,[20,10,5,5,10,5,5,0]);
  assert.deepEqual(totals,{boards:1,found:20});
});

test('A chunk that keeps failing is reported, and the rest of the board is still saved and checked',async()=>{
  const jobs=Array.from({length:60},(_,i)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`}));
  const calls=[];
  const totals=await collectBoard({master_rank:5,company:'Stuck',ats_platform:'greenhouse',ats_identifier:'stuck'},
    {read:async()=>jobs,ingest:async payload=>{calls.push(payload);
      if(payload.jobs.some(j=>j.url.endsWith('/25')))throw new Error('Database 400: bad row');
      return {found:payload.jobs.length,inserted:1};}});
  assert.deepEqual(calls.map(c=>c.jobs.length),[20,20,20,0]);
  assert.equal(calls.at(-1).live_urls.length,60);
  assert.deepEqual(totals,{boards:1,found:40,inserted:3,failed_jobs:20,failed:1,error:'Stuck: Database 400: bad row'});
});

test('A board stops splitting after repeated timeouts instead of hammering the database',async()=>{
  const jobs=Array.from({length:100},(_,i)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`}));
  const calls=[];
  const totals=await collectBoard({master_rank:5,company:'Down',ats_platform:'greenhouse',ats_identifier:'down'},
    {read:async()=>jobs,ingest:async payload=>{calls.push(payload);if(payload.jobs.length)throw timeoutError();return {};}});
  assert.equal(calls.filter(c=>c.jobs.length).length,6);
  assert.ok('live_urls' in calls.at(-1));
  assert.equal(totals.failed_jobs,100);assert.equal(totals.failed,1);assert.match(totals.error,/^Down: Database 500/);
});

test('The database client splits multi-job timeouts instead of resending them, and retries the rest',async()=>{
  const timeoutBody='{"code":"57014","details":null,"hint":null,"message":"canceling statement due to statement timeout"}';
  const answer=(status,text)=>({status,ok:status<300,text:async()=>text});
  let queue,requests;
  const fetcher=async(url,init)=>{requests.push({url,init});return queue.shift();};
  const db=createDb({url:'https://x.supabase.co',key:'k',fetcher,sleep:async()=>{}});
  queue=[answer(500,timeoutBody)];requests=[];
  await assert.rejects(db('rpc/wilsy_ingest_board',{body:{board:{}},retryTimeouts:false}),e=>e.timeout===true);
  assert.equal(requests.length,1);
  queue=[answer(500,timeoutBody),answer(503,''),answer(200,'{"found":1}')];requests=[];
  assert.deepEqual(await db('rpc/wilsy_ingest_board',{body:{board:{}}}),{found:1});
  assert.equal(requests.length,3);
  assert.equal(requests[0].init.method,'POST');assert.equal(requests[0].init.headers.apikey,'k');
  queue=[answer(400,'{"code":"22P02"}')];requests=[];
  await assert.rejects(db('rpc/wilsy_ingest_board',{body:{board:{}},retryTimeouts:false}),e=>e.timeout===false);
  assert.equal(requests.length,1);
});

test('A board that cannot be read is reported, and recorded without closing its jobs',async()=>{
  const calls=[];
  const result=await collectBoard({master_rank:3,company:'Gone Inc',ats_platform:'greenhouse',ats_identifier:'gone'},
    {read:async()=>{throw new HttpError(404,'https://x');},ingest:async payload=>{calls.push(payload);return {failed:1};}});
  assert.deepEqual(calls,[{master_rank:3,ats:'greenhouse',slug:'gone',error:'HTTP 404'}]);
  assert.deepEqual(result,{failed:1,gone:1,error:'Gone Inc: HTTP 404'});
});

test('Escaped HTML becomes readable text with paragraphs',()=>{
  const escaped='&lt;div class=&quot;intro&quot;&gt;&lt;p&gt;&lt;strong&gt;Who we are&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Build APIs&lt;/li&gt;&lt;li&gt;Ship &amp;amp; learn&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;';
  assert.equal(plainText(escaped),'Who we are\n\n• Build APIs\n• Ship & learn');
  assert.equal(plainText('<script>x()</script><p>Hi</p>'),'Hi');
  assert.equal(plainText(''),null);
});

test('Job type, workplace and URLs normalise like the existing collector',()=>{
  assert.equal(jobType('FullTime'),'full_time');assert.equal(jobType('Intern'),'internship');
  assert.equal(jobType('','Software Engineering Intern'),'internship');assert.equal(jobType('','Engineer'),'other');
  assert.equal(workMode('Remote'),'remote');assert.equal(workMode('OnSite'),'onsite');assert.equal(workMode('','London'),'unspecified');
  assert.equal(workMode('Hybrid','remote','London'),'hybrid'); // the board's own workplace type wins
  assert.equal(workMode(null,'remote','London'),'remote');
  assert.equal(canonicalUrl('https://jobs.example/1/#apply'),'https://jobs.example/1');
});

test('Transient read failures are reported but never recorded against the board',async()=>{
  const calls=[];
  for(const error of [new HttpError(503,'https://x'),new TypeError('fetch failed')]){
    const result=await collectBoard({master_rank:3,company:'Busy Inc',ats_platform:'greenhouse',ats_identifier:'busy'},
      {read:async()=>{throw error;},ingest:async payload=>{calls.push(payload);return {};}});
    assert.equal(result.failed,1);assert.ok(!('gone' in result));
  }
  assert.deepEqual(calls,[]);
});

test('An empty or truncated inventory never closes roles',async()=>{
  const calls=[];const ingest=async payload=>{calls.push(payload);return {found:payload.jobs.length};};
  const board={master_rank:9,company:'Quiet',ats_platform:'smartrecruiters',ats_identifier:'quiet'};
  assert.deepEqual(await collectBoard(board,{read:async()=>[],ingest}),{boards:1,empty:1});
  assert.deepEqual(calls,[]);
  const partial=Object.assign([{title:'Engineer',url:'https://jobs.example/1'}],{partial:true});
  assert.deepEqual(await collectBoard(board,{read:async()=>partial,ingest}),{boards:1,found:1,partial:1});
  assert.ok(calls.every(c=>!('live_urls' in c)));
});

test('The watchlist is read page by page and matches platform names in any case',async()=>{
  const paths=[];
  const db=async path=>{paths.push(path);const offset=Number(/offset=(\d+)/.exec(path)[1]);
    return Array.from({length:offset===0?1000:37},(_,i)=>({master_rank:offset+i}));};
  assert.equal((await loadBoards(db)).length,1037);
  assert.equal(paths.length,2);
  assert.match(paths[0],/ats_platform\.ilike\.greenhouse/);
});

test('A shard fails when it reads nothing or too many boards fail',()=>{
  assert.deepEqual(runStatus(33,0),{status:'success',failed:false});
  assert.deepEqual(runStatus(33,1),{status:'partial',failed:false});
  assert.deepEqual(runStatus(33,12),{status:'partial',failed:true});
  assert.deepEqual(runStatus(33,33),{status:'failed',failed:true});
  assert.equal(runStatus(0,0).failed,true);
});

test('Readers reject unexpected response shapes instead of returning no jobs',async()=>{
  for(const name of ['greenhouse','ashby','workable','recruitee','smartrecruiters','lever'])
    await assert.rejects(READERS[name]('acme',async()=>({message:'maintenance'})),/Unexpected/);
});

test('SmartRecruiters reads every page of a large board',async()=>{
  const get=async url=>{
    if(!url.includes('offset='))return {jobAd:{sections:{}}};
    const offset=Number(/offset=(\d+)/.exec(url)[1]);
    return {totalFound:250,content:Array.from({length:offset<200?100:50},(_,i)=>({id:String(offset+i),name:'Account Manager'}))};
  };
  const jobs=await READERS.smartrecruiters('acme',get);
  assert.equal(jobs.length,250);assert.ok(!jobs.partial);
  assert.equal(jobs[0].url,'https://jobs.smartrecruiters.com/acme/0');
});

const reply=(status,body={},headers={})=>({status,ok:status>=200&&status<300,url:'https://api.example/x',headers:new Headers(headers),json:async()=>body,text:async()=>''});
test('The HTTP client retries rate limits, server errors and network failures, but not 404',async()=>{
  const waits=[];const sleep=async ms=>{waits.push(ms);};
  let queue=[reply(503),new TypeError('fetch failed'),reply(200,{ok:1})];
  const fetcher=async()=>{const next=queue.shift();if(next instanceof Error)throw next;return next;};
  assert.deepEqual(await createClient({fetcher,sleep}).json('https://api.example/x'),{ok:1});
  assert.equal(waits.length,2);
  queue=[reply(429,{},{'retry-after':'2'}),reply(200,{ok:2})];waits.length=0;
  assert.deepEqual(await createClient({fetcher,sleep}).json('https://api.example/x'),{ok:2});
  assert.deepEqual(waits,[2000]);
  let calls=0;
  await assert.rejects(createClient({fetcher:async()=>{calls++;return reply(404);},sleep}).json('https://api.example/x'),e=>e.status===404);
  assert.equal(calls,1);
  await assert.rejects(createClient({fetcher,sleep}).json('http://api.example/x'),e=>e.status===0);
});

test('Statement timeouts and gateway errors are retried, other database errors are not',()=>{
  const timeout='{"code":"57014","details":null,"hint":null,"message":"canceling statement due to statement timeout"}';
  assert.equal(retryableDbError(500,timeout),true);
  for(const status of [502,503,504])assert.equal(retryableDbError(status,''),true);
  assert.equal(retryableDbError(500,'{"code":"23505","message":"duplicate key value"}'),false);
  assert.equal(retryableDbError(400,timeout),false);
  assert.equal(retryableDbError(404,''),false);
});
