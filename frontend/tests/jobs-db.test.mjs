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

test('a search waits briefly when the database is full of connections, then answers', async () => {
  let calls = 0;
  const connect = async () => ({query: async () => { if (++calls < 2) throw Object.assign(new Error('too many connections'), {code: '53300'}); return {rows: [{result: {jobs: [], total: 0}}]}; }});
  const request = createJobsRequest({env: {JOBS_DATABASE_URL: 'postgres://x'}, connect, retryMs: 1});
  assert.deepEqual(await request('rpc/wilsy_job_facets', {body: {}}), {jobs: [], total: 0});
  assert.equal(calls, 2);
});

test('The deploy pass reads every live job in id order, 2,000 a query, and trims each batch', async () => {
  const {createBulkReader, BULK_COLUMNS} = await import('../scripts/jobs-db.mjs');
  const {fetchAllLiveJobs} = await import('../scripts/live-jobs.mjs');
  assert.equal(createBulkReader({env: {}}), null, 'without the jobs database the search is paged instead');
  const all = Array.from({length: 5}, (_, i) => ({id: String(i + 1), title: `Engineer ${i + 1}`, company: 'Acme', description: 'x'.repeat(50)}));
  const queries = [];
  const connect = async () => ({query: async ({text, values: [after, limit]}) => { queries.push([after, limit]); return {rows: all.filter(j => Number(j.id) > Number(after)).slice(0, limit)}; }});
  const bulk = createBulkReader({env: {JOBS_DATABASE_URL: 'postgres://x'}, connect, batch: 2});
  const result = await fetchAllLiveJobs({bulk, request: async () => { throw new Error('search not used'); }});
  assert.deepEqual(result.jobs.map(j => j.id), ['1', '2', '3', '4', '5']);
  assert.equal(result.total, 5);
  assert.deepEqual(queries, [[0, 2], ['2', 2], ['4', 2]]);
  assert.equal('description' in result.jobs[0], false, 'descriptions are dropped as rows arrive');
  assert.ok(BULK_COLUMNS.includes('apply_url') && BULK_COLUMNS.includes('description'));
});

test('A connection the server closed (idle timeout) or refused is retried; real errors are not', async () => {
  const {retryable, IDLE_SESSION_MS} = await import('../scripts/jobs-db.mjs');
  assert.ok(IDLE_SESSION_MS <= 30000, 'idle sessions close well before a frozen instance would wake');
  for(const error of [{code: '53300'}, {code: '57P05'}, {code: 'ECONNRESET'}, new Error('Connection terminated unexpectedly')]) assert.equal(retryable(error), true);
  for(const error of [{code: '42601'}, {code: '57014'}, new Error('Unsupported job function arguments')]) assert.equal(retryable(error), false);
  let calls = 0;
  const connect = async () => ({query: async () => { if(++calls === 1) throw Object.assign(new Error('terminating connection due to idle-session timeout'), {code: '57P05'}); return {rows: [{result: {total: 1}}]}; }});
  assert.deepEqual(await createJobsRequest({env: {JOBS_DATABASE_URL: 'postgres://x'}, connect, retryMs: 1})('rpc/wilsy_job_facets', {body: {}}), {total: 1});
});
