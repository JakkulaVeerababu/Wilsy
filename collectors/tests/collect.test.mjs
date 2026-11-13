import test from 'node:test';
import assert from 'node:assert/strict';
import {shardOf,collectBoard,loadBoards,runStatus,retryableDbError} from '../collect.mjs';
import {HttpError} from '../ats.mjs';
import {createClient} from '../http.mjs';
import {READERS} from '../boards.mjs';
import {plainText,jobType,workMode,canonicalUrl} from '../boards.mjs';

test('Shards split the watchlist without overlap or gaps',()=>{
  const boards=Array.from({length:95},(_,i)=>({master_rank:i+1}));
  const shards=Array.from({length:10},(_,s)=>shardOf(boards,s,10).map(b=>b.master_rank));
  assert.equal(shards.flat().length,95);
  assert.equal(new Set(shards.flat()).size,95);
});

test('Boards are sent in chunks of 50, then a final call with every live URL',async()=>{
  const jobs=Array.from({length:120},(_,i)=>({title:`Engineer ${i}`,url:`https://jobs.example/${i}`}));
  const calls=[];
  const totals=await collectBoard({master_rank:7,company:'Acme',ats_platform:'Ashby',ats_identifier:'acme'},
    {read:async()=>jobs,ingest:async payload=>{calls.push(payload);return {found:payload.jobs.length};}});
  assert.deepEqual(calls.map(c=>c.jobs.length),[50,50,20,0]);
  assert.ok(calls.slice(0,3).every(c=>!('live_urls' in c)));
  assert.equal(calls[3].live_urls.length,120);
  assert.deepEqual({ats:calls[0].ats,slug:calls[0].slug,master_rank:calls[0].master_rank},{ats:'ashby',slug:'acme',master_rank:7});
  assert.deepEqual(totals,{boards:1,found:120});
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
