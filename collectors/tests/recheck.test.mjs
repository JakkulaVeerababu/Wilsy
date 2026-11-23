import test from 'node:test';
import assert from 'node:assert/strict';
import {boardOf,decide,summary,summaryMarkdown,UNVERIFIED_DAYS} from '../recheck.mjs';
import {HttpError} from '../ats.mjs';

const NOW=Date.parse('2026-11-23T12:00:00Z');
const daysAgo=n=>new Date(NOW-n*86_400_000).toISOString();

test('Job links are traced to the board and role they came from', () => {
  assert.deepEqual(boardOf({apply_url:'https://boards.greenhouse.io/cloudflare/jobs/7421718?gh_jid=7421718'}),{ats:'greenhouse',slug:'cloudflare',id:'7421718'});
  assert.deepEqual(boardOf({apply_url:'https://job-boards.eu.greenhouse.io/Acme/jobs/42'}),{ats:'greenhouse',slug:'acme',id:'42'});
  assert.deepEqual(boardOf({apply_url:'https://jobs.ashbyhq.com/lgads/02B11BAE-83d2-47f5-9ff2-6114f13ee360/application'}),
    {ats:'ashby',slug:'lgads',id:'02b11bae-83d2-47f5-9ff2-6114f13ee360'});
  assert.deepEqual(boardOf({apply_url:'https://jobs.eu.lever.co/acme/d4d27dd5-7b7f-4b5c-a5f1-dd9d81a604a2/apply'}),
    {ats:'lever',slug:'acme',id:'d4d27dd5-7b7f-4b5c-a5f1-dd9d81a604a2',eu:true});
  assert.deepEqual(boardOf({apply_url:'https://apply.workable.com/acme/j/ab12cd/'}),{ats:'workable',slug:'acme',id:'AB12CD'});
  assert.deepEqual(boardOf({apply_url:'https://jobs.smartrecruiters.com/Acme/7440000123'}),{ats:'smartrecruiters',slug:'Acme',id:'7440000123'});
  assert.deepEqual(boardOf({apply_url:'https://acme.recruitee.com/o/backend-engineer'}),{ats:'recruitee',slug:'acme',id:'backend-engineer'});
  // A company site that carries a Greenhouse id: the board is a guess from the company.
  assert.deepEqual(boardOf({apply_url:'https://stripe.com/jobs/search?gh_jid=8023524',company_slug:null,company:'Stripe'}),
    {ats:'greenhouse',slug:'stripe',id:'8023524',guessed:true});
  // A later link is used when the first is not on a board.
  assert.equal(boardOf({apply_url:'https://example.com/apply',job_url:'https://jobs.lever.co/acme/d4d27dd5-7b7f-4b5c-a5f1-dd9d81a604a2'}).ats,'lever');
  assert.equal(boardOf({apply_url:'https://careers.example.com/jobs/1'}),null);
});

test('Roles still on their board stay open; roles gone from it, or from a deleted board, close', async () => {
  const jobs=[
    {id:1,apply_url:'https://job-boards.greenhouse.io/acme/jobs/11',last_seen_at:daysAgo(5)},
    {id:2,apply_url:'https://job-boards.greenhouse.io/acme/jobs/12',last_seen_at:daysAgo(5)},
    {id:3,apply_url:'https://job-boards.greenhouse.io/gone/jobs/13',last_seen_at:daysAgo(5)},
  ];
  const reads=[];
  const result=await decide(jobs,{now:NOW,page:async()=>{},list:async(ats,slug)=>{
    reads.push(`${ats}:${slug}`);
    if(slug==='gone')throw new HttpError(404,'x');
    return new Set(['11']);
  }});
  assert.deepEqual(reads.sort(),['greenhouse:acme','greenhouse:gone']); // one read per board
  assert.deepEqual(result.open,[1]);
  assert.deepEqual(result.closed.sort((a,b)=>a.id-b.id),[{id:2,reason:'no longer on its board'},{id:3,reason:'board no longer exists'}]);
  assert.deepEqual(result.unknown,[]);
});

test('Timeouts, rate limits and empty boards never close a role, however old', async () => {
  const old=daysAgo(UNVERIFIED_DAYS+30);
  const jobs=[
    {id:1,apply_url:'https://job-boards.greenhouse.io/slow/jobs/1',last_seen_at:old},
    {id:2,apply_url:'https://job-boards.greenhouse.io/empty/jobs/2',last_seen_at:old},
    {id:3,apply_url:'https://careers.example.com/jobs/3',last_seen_at:old},
  ];
  const result=await decide(jobs,{now:NOW,
    list:async slug=>{throw new Error('never');},
    page:async()=>{throw new HttpError(503,'x');}});
  assert.equal(result.closed.length,0);
  const empty=await decide(jobs.slice(1,2),{now:NOW,page:async()=>{},list:async()=>new Set()});
  assert.deepEqual(empty,{open:[],closed:[],unknown:[2]});
  const limited=await decide(jobs.slice(0,1),{now:NOW,page:async()=>{},list:async()=>{throw new HttpError(429,'x');}});
  assert.deepEqual(limited.unknown,[1]);
});

test('Pages that are gone close; roles that cannot be checked close only after the unconfirmed limit', async () => {
  const jobs=[
    {id:1,apply_url:'https://careers.example.com/jobs/gone',last_seen_at:daysAgo(4)},
    {id:2,apply_url:'https://careers.example.com/jobs/live',last_seen_at:daysAgo(10)},
    {id:3,apply_url:'https://careers.example.com/jobs/live-old',last_seen_at:daysAgo(UNVERIFIED_DAYS+1)},
    // A guessed board: a role that is not on it may belong to another board, so it is only unconfirmed.
    {id:4,apply_url:'https://example.com/jobs?gh_jid=77',company:'Acme',last_seen_at:daysAgo(10)},
    {id:5,apply_url:'https://example.com/jobs?gh_jid=78',company:'Acme',last_seen_at:daysAgo(UNVERIFIED_DAYS+1)},
    {id:6,apply_url:'https://example.com/jobs?gh_jid=79',company:'Acme',last_seen_at:daysAgo(10)},
  ];
  const result=await decide(jobs,{now:NOW,
    list:async()=>new Set(['79']),
    page:async url=>{if(url.endsWith('/gone'))throw new HttpError(410,url);}});
  assert.deepEqual(result.open,[6]);
  assert.deepEqual(result.closed.sort((a,b)=>a.id-b.id),[
    {id:1,reason:'page no longer exists'},
    {id:3,reason:`not confirmed for ${UNVERIFIED_DAYS} days`},
    {id:5,reason:`not confirmed for ${UNVERIFIED_DAYS} days`}]);
  assert.deepEqual(result.unknown.sort(),[2,4]);
  // A guessed board that does not exist is not proof either.
  const missing=await decide([jobs[3]],{now:NOW,page:async()=>{},list:async()=>{throw new HttpError(404,'x');}});
  assert.deepEqual(missing,{open:[],closed:[],unknown:[4]});
});

test('The run summary counts every outcome and reason', () => {
  const s=summary({checked:5,open:[1],closed:[{id:2,reason:'a'},{id:3,reason:'a'},{id:4,reason:'b'}],unknown:[5]});
  assert.deepEqual(s,{checked:5,still_open:1,closed:3,unknown:1,reasons:{a:2,b:1}});
  assert.match(summaryMarkdown(s),/\| 1 \| 3 \| 1 \|/);
  assert.match(summaryMarkdown(s),/- 2 closed: a/);
});
