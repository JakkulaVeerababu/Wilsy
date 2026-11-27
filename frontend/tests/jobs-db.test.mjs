import test from 'node:test';
import assert from 'node:assert/strict';
import {functionCall, createJobsRequest} from '../scripts/jobs-db.mjs';
import {createJobsRpcHandler} from '../scripts/jobs-rpc-handler.mjs';

test('functionCall builds named, typed parameters for allowed functions only', () => {
  assert.deepEqual(functionCall('wilsy_search_jobs', {filters: {q: 'x'}, page_size: 20, page_offset: 0}), {
    text: 'select public.wilsy_search_jobs(filters => $1::jsonb, page_size => $2::integer, page_offset => $3::integer) as result',
    values: ['{"q":"x"}', 20, 0]});
  assert.deepEqual(functionCall('wilsy_job_facets', {}), {text: 'select public.wilsy_job_facets() as result', values: []});
  assert.equal(functionCall('wilsy_ingest_board', {}), null);
  assert.equal(functionCall('constructor', {}), null);
  assert.equal(functionCall('wilsy_job_history', {job_id: '1; drop table jobs'}), null);
  assert.equal(functionCall('wilsy_search_jobs', {filters: [1]}), null);
  assert.equal(functionCall('wilsy_search_jobs', {page_size: 1.5}), null);
});

test('jobsRequest uses Supabase until JOBS_DATABASE_URL is set', async () => {
  const calls = [];
  const fallback = async (path, options) => { calls.push(path); return {via: 'supabase'}; };
  const connect = async () => ({query: async call => ({rows: [{result: {via: 'heroku', call}}]})});
  assert.deepEqual(await createJobsRequest({env: {}, fallback, connect})('rpc/wilsy_job_facets', {body: {}}), {via: 'supabase'});
  const heroku = createJobsRequest({env: {JOBS_DATABASE_URL: 'postgres://x'}, fallback, connect});
  assert.equal((await heroku('rpc/wilsy_job_history', {body: {job_id: 7}})).via, 'heroku');
  // Anything that is not a job function still goes to Supabase.
  assert.deepEqual(await heroku('rpc/wilsy_search_hackathons', {body: {}}), {via: 'supabase'});
  assert.deepEqual(calls, ['rpc/wilsy_job_facets', 'rpc/wilsy_search_hackathons']);
  await assert.rejects(heroku('rpc/wilsy_job_history', {body: {job_id: 'x'}}));
});

test('the jobs-rpc endpoint accepts only job functions and JSON objects', async () => {
  const handle = createJobsRpcHandler({request: async (path, {body}) => ({path, body})});
  const post = (fn, body) => handle(new Request(`http://x/api/jobs-rpc?fn=${fn}`, {method: 'POST', body}));
  let response = await post('wilsy_job_history', '{"job_id":5}');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {path: 'rpc/wilsy_job_history', body: {job_id: 5}});
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await post('wilsy_ingest_board', '{}')).status, 404);
  assert.equal((await post('wilsy_job_facets', '[1]')).status, 400);
  assert.equal((await post('wilsy_job_facets', 'not json')).status, 400);
  assert.equal((await post('wilsy_job_facets', 'x'.repeat(20001))).status, 413);
  const failing = createJobsRpcHandler({request: async () => { throw new Error('down'); }});
  assert.equal((await failing(new Request('http://x/api/jobs-rpc?fn=wilsy_job_facets', {method: 'POST', body: '{}'}))).status, 502);
});
