import test from 'node:test';
import assert from 'node:assert/strict';
import {shardOf,collectBoard} from '../collect.mjs';
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
    {read:async()=>{throw new Error('HTTP 404');},ingest:async payload=>{calls.push(payload);return {failed:1};}});
  assert.deepEqual(calls,[{master_rank:3,ats:'greenhouse',slug:'gone',error:'HTTP 404'}]);
  assert.deepEqual(result,{failed:1,error:'Gone Inc: HTTP 404'});
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
