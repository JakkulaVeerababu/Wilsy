import test from 'node:test';
import assert from 'node:assert/strict';
import {findBoards,isSyntheticName,slugGuesses,normalizeName,HttpError} from '../ats.mjs';
import {discoverCompany} from '../discover.mjs';

test('Job-board links are found in page order, decoded and de-duplicated',()=>{
  const page=String.raw`<a href="https:\/\/jobs.ashbyhq.com\/acme">Jobs</a> https://boards.greenhouse.io/embed/job_board?for=globex
    https://jobs.ashbyhq.com/ACME/123 &quot;https://jobs.gem.com/-broken&quot; https://acme.bamboohr.com/careers https://jobs.lever.co/initech/abc`;
  assert.deepEqual(findBoards(page),[{ats:'ashby',slug:'acme'},{ats:'greenhouse',slug:'globex'},{ats:'bamboohr',slug:'acme'},{ats:'lever',slug:'initech'}]);
  assert.deepEqual(findBoards('https://jobs.ashbyhq.com/Brex%20Inc'),[{ats:'ashby',slug:'Brex Inc'}]);
  assert.deepEqual(findBoards('https://boards.greenhouse.io/embed and app.doverXcom/jobs/x'),[]);
});
test('Placeholder and generated watchlist names are recognised',()=>{
  for(const n of ['LEGACY_UNRESOLVED_00274','Beta Hub 240','Iron LLC','Reliance Studios','Nano Capital'])assert.ok(isSyntheticName(n),n);
  for(const n of ['Tata Technologies','HCL Technologies','Anthropic','Modern Treasury','Zoho'])assert.ok(!isSyntheticName(n),n);
});
test('Name guesses come from the website and the name',()=>{
  assert.deepEqual(slugGuesses('Modern Treasury','https://www.moderntreasury.com'),['moderntreasury','modern-treasury']);
  assert.deepEqual(slugGuesses('AtoB','https://atob.com/'),['atob']);
  assert.equal(normalizeName('Acme Labs, Inc.'),normalizeName('ACME'));
});

function fakeClient(routes) {
  const calls=[];
  const lookup=url=>{calls.push(url);const hit=Object.entries(routes).find(([k])=>url.startsWith(k));if(!hit)throw new HttpError(404,url);return hit[1];};
  return {calls,json:async url=>lookup(url),page:async url=>({url,text:lookup(url)})};
}
const ashbyBoard={jobs:[{title:'Engineer',jobUrl:'https://jobs.ashbyhq.com/acme/1',location:'Remote'}]};

test('A job-board careers link is confirmed through the API',async()=>{
  const client=fakeClient({'https://api.ashbyhq.com/posting-api/job-board/acme':ashbyBoard});
  const r=await discoverCompany({name:'Acme',careers:'https://jobs.ashbyhq.com/acme'},client);
  assert.deepEqual(r,{status:'found',ats:'ashby',slug:'acme',boardName:'',jobs:1,evidence:'careers_url'});
});
test('Boards linked from the company careers page are found; dead links are skipped',async()=>{
  const client=fakeClient({'https://acme.com/careers':'<a href="https://jobs.lever.co/dead">old</a><a href="https://jobs.ashbyhq.com/acme">Open roles</a>',
    'https://api.ashbyhq.com/posting-api/job-board/acme':ashbyBoard});
  const r=await discoverCompany({name:'Acme',website:'https://acme.com',careers:'https://acme.com/careers'},client);
  assert.equal(r.status,'found');assert.equal(r.slug,'acme');assert.equal(r.evidence,'careers_page');
});
test('Pages linking to many boards are treated as ambiguous, not trusted',async()=>{
  const many=['a','b','c','d'].map(s=>`https://jobs.ashbyhq.com/${s}`).join(' ');
  const client=fakeClient({'https://vc.example/portfolio':many});
  const r=await discoverCompany({name:'Fund',careers:'https://vc.example/portfolio'},client);
  assert.deepEqual(r,{status:'ambiguous',evidence:'many_boards_on_page'});
  assert.ok(!client.calls.some(u=>u.includes('api.ashbyhq.com')));
});
test('Guessed names are only ever probable, even when the board name matches',async()=>{
  const client=fakeClient({'https://boards-api.greenhouse.io/v1/boards/globex/jobs':{jobs:[]},'https://boards-api.greenhouse.io/v1/boards/globex':{name:'Globex'}});
  const r=await discoverCompany({name:'Globex',website:'https://globex.com'},client);
  assert.equal(r.status,'probable');assert.equal(r.nameMatches,true);assert.equal(r.evidence,'name_probe');
});
test('Synthetic names are skipped without any network requests',async()=>{
  const client=fakeClient({});
  assert.deepEqual(await discoverCompany({name:'LEGACY_UNRESOLVED_00001'},client),{status:'skipped',evidence:'synthetic_name'});
  assert.equal(client.calls.length,0);
});
test('Recognised services without a reader are reported as unsupported',async()=>{
  const client=fakeClient({'https://acme.com/careers':'<a href="https://acme.bamboohr.com/careers">Jobs</a>'});
  const r=await discoverCompany({name:'Acme',website:'https://acme.com',careers:'https://acme.com/careers'},client);
  assert.deepEqual({status:r.status,ats:r.ats,slug:r.slug},{status:'unsupported',ats:'bamboohr',slug:'acme'});
});
