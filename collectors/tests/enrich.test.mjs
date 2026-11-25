import test from 'node:test';
import assert from 'node:assert/strict';
import {enrich,pagePath,summaryMarkdown} from '../enrich.mjs';
import {FACTS_VERSION} from '../../frontend/js/job-facts.js';

const job=(id,extra={})=>({id,title:'Software Engineer',description:'- 3+ years of Python experience',skills:[],experience_min:null,experience_max:null,
  education:null,graduation_years:[],is_fresher:false,is_new_grad:false,seniority_level:null,career_stage:null,metadata:{},...extra});

test('Hourly runs read only jobs this version has not read; daily runs read every live job', () => {
  assert.match(pagePath(0),new RegExp(`or=\\(metadata->enrich->>v\\.is\\.null,metadata->enrich->>v\\.neq\\.${FACTS_VERSION}\\)`));
  assert.match(pagePath(42),/status=eq\.published&closed_at=is\.null&id=gt\.42/);
  assert.doesNotMatch(pagePath(0,{all:true}),/metadata->enrich/);
});

test('Each changed job is written once, by id; unchanged jobs and failures are counted, not retried forever', async () => {
  const marked={v:FACTS_VERSION,f:['career_stage','experience','skills'],};
  const pages=[[job(1),job(2,{skills:['Python'],experience_min:3,career_stage:'mid',metadata:{enrich:marked}}),job(3)]];
  const writes=[];
  const db=async(path,{method,body}={})=>{
    if(method==='PATCH'){ if(path.includes('id=eq.3'))throw new Error('Database 500'); writes.push([path,body]); return null; }
    return pages.shift()||[];
  };
  const result=await enrich(db,{writePauseMs:0});
  assert.deepEqual(result,{read:3,changed:2,written:1,failed:1,stopped:null,filled:{skills:2,experience_min:2,experience_max:2,career_stage:2}});
  assert.equal(writes[0][0],'jobs?id=eq.1&status=eq.published');
  assert.deepEqual(writes[0][1].skills,['Python']);
  assert.equal(writes[0][1].experience_min,3);
  assert.deepEqual(writes[0][1].metadata.enrich,marked);
});

test('A plan run writes nothing, and a limit stops the run', async () => {
  let reads=0;
  const db=async(path,{method}={})=>{ assert.notEqual(method,'PATCH'); reads++; return Array.from({length:200},(_,i)=>job(reads*1000+i)); };
  const result=await enrich(db,{plan:true,limit:250});
  assert.equal(result.read,250);
  assert.equal(result.written,0);
  assert.equal(reads,2);
  assert.match(summaryMarkdown(result,{plan:true}),/plan, nothing written[\s\S]*\| 250 \| 250 \| 0 \| 0 \|/);
});

test('Writes go one at a time with a pause, and a struggling database ends the run early', async () => {
  const sleeps=[];let active=0,most=0;
  const pages=[Array.from({length:6},(_,i)=>job(i+1))];
  const db=async(path,{method}={})=>{
    if(method!=='PATCH')return pages.shift()||[];
    active++;most=Math.max(most,active);await null;active--;
    if(Number(path.match(/id=eq\.(\d+)/)[1])>=2)throw new Error('Database 500: canceling statement due to statement timeout');
    return null;
  };
  const result=await enrich(db,{sleep:async ms=>sleeps.push(ms)});
  assert.equal(most,1,'never two writes at once');
  assert.equal(result.written,1);
  assert.equal(result.failed,3,'gives up after three failures in a row');
  assert.match(result.stopped,/3 writes failed in a row/);
  assert.ok(sleeps.length>=1&&sleeps.every(ms=>ms>0));
  assert.match(summaryMarkdown(result),/Stopped early/);
});

test('The hourly run reads at most 300 jobs, and a later page that times out keeps what was done', async () => {
  let reads=0;
  const db=async(path,{method}={})=>{ assert.notEqual(method,'PATCH'); reads++; if(reads===3)throw new Error('Database 500: timeout'); return Array.from({length:100},(_,i)=>job(reads*1000+i)); };
  const result=await enrich(db,{plan:true});
  assert.equal(result.read,200);
  assert.match(result.stopped,/read failed/);
  const full=await enrich(async(p,{method}={})=>Array.from({length:100},(_,i)=>job(i+1+Number(p.match(/id=gt\.(\d+)/)[1]))),{plan:true});
  assert.equal(full.read,300);
  await assert.rejects(enrich(async()=>{throw new Error('Database 500');},{plan:true}),/Database 500/,'a run that cannot read at all still fails');
});
