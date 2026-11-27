import test from 'node:test';
import assert from 'node:assert/strict';
import {toSql, isJobPath, routeJobs, createPgRest} from '../pg-rest.mjs';

test('job paths are recognised; account and hackathon paths are not', () => {
  assert.ok(isJobPath('jobs?select=id'));
  assert.ok(isJobPath('rpc/wilsy_ingest_board'));
  assert.ok(isJobPath('company_watchlist_11k?select=company'));
  assert.ok(!isJobPath('user_saved_searches?select=user_id'));
  assert.ok(!isJobPath('rpc/wilsy_search_hackathons'));
  assert.ok(!isJobPath('hackathons'));
});

test('GET paths become parameterised selects', () => {
  assert.deepEqual(toSql('jobs?select=id,company&status=eq.published&closed_at=is.null&id=gt.10&order=id.asc&limit=200'), {
    text: 'select "id", "company" from public."jobs" where "status" = $1 and "closed_at" is null and "id" > $2 order by "id" limit 200',
    values: ['published', '10']});
  assert.deepEqual(toSql('jobs?select=external_job_id&external_job_id=in.(a,"b,c")'), {
    text: 'select "external_job_id" from public."jobs" where "external_job_id"::text = any($1::text[])', values: [['a', 'b,c']]});
  const watch = toSql('company_watchlist_11k?select=company&ats_identifier=not.is.null&or=(ats_platform.ilike.greenhouse,ats_platform.ilike.lever)&order=master_rank&limit=1000&offset=1000');
  assert.equal(watch.text, 'select "company" from public."company_watchlist_11k" where not ("ats_identifier" is null) and ("ats_platform" ilike $1 or "ats_platform" ilike $2) order by "master_rank" limit 1000 offset 1000');
  const json = toSql('jobs?select=id&or=(metadata->enrich->>v.is.null,metadata->enrich->>v.neq.1)');
  assert.equal(json.text, `select "id" from public."jobs" where ("metadata"->'enrich'->>'v' is null or "metadata"->'enrich'->>'v' <> $1)`);
  assert.deepEqual(toSql('job_ingestion_runs?select=metadata&order=started_at.desc&limit=1').text,
    'select "metadata" from public."job_ingestion_runs" order by "started_at" desc limit 1');
});

test('writes and functions', () => {
  assert.deepEqual(toSql('jobs?id=in.(1,2)&status=eq.published', {method: 'PATCH', body: {status: 'expired', metadata: {a: 1}}, prefer: 'return=minimal'}), {
    text: 'update public."jobs" set "status" = $1, "metadata" = $2 where "id"::text = any($3::text[]) and "status" = $4',
    values: ['expired', '{"a":1}', ['1', '2'], 'published']});
  const insert = toSql('job_ingestion_runs', {body: {run_key: 'r', metadata: {x: 1}}, prefer: 'return=minimal'});
  assert.equal(insert.text, 'insert into public."job_ingestion_runs" ("run_key", "metadata") select "run_key", "metadata" from json_populate_recordset(null::public."job_ingestion_runs", $1::json)');
  assert.deepEqual(insert.values, ['[{"run_key":"r","metadata":{"x":1}}]']);
  assert.deepEqual(toSql('rpc/wilsy_ingest_board', {body: {board: {jobs: []}}}),
    {text: 'select public."wilsy_ingest_board"("board" => $1::jsonb) as result', values: ['{"jobs":[]}'], rpc: true});
});

test('anything outside the supported subset is refused', () => {
  assert.throws(() => toSql('user_saved_searches?select=user_id'));
  assert.throws(() => toSql('rpc/wilsy_private_thing', {body: {}}));
  assert.throws(() => toSql('jobs?select=id;drop table jobs'));
  assert.throws(() => toSql('jobs?id=eq.1', {method: 'DELETE'}));
  assert.throws(() => toSql('jobs', {method: 'PATCH', body: {status: 'expired'}}));
  assert.throws(() => toSql('jobs?id=fts.x'));
  assert.throws(() => toSql('jobs?limit=1;select'));
  assert.throws(() => toSql('jobs?status=is.maybe'));
});

test('routeJobs leaves Supabase alone until JOBS_DATABASE_URL is set, then splits by path', async () => {
  const rest = async path => ({rest: path});
  assert.equal(routeJobs(rest, {env: {}}), rest);
  const queries = [];
  const connect = async () => ({query: async q => { queries.push(q.text); return {rows: q.text.startsWith('select public.') ? [{result: {ok: 1}}] : [{id: 1}]}; }});
  const db = routeJobs(rest, {env: {JOBS_DATABASE_URL: 'postgres://x'}, connect});
  assert.deepEqual(await db('user_saved_searches?select=user_id'), {rest: 'user_saved_searches?select=user_id'});
  assert.deepEqual(await db('rpc/wilsy_search_jobs', {body: {filters: {}}}), {ok: 1});
  assert.deepEqual(await db('jobs?select=id'), [{id: 1}]);
  assert.equal(await db('jobs?id=eq.1', {method: 'PATCH', body: {status: 'expired'}, prefer: 'return=minimal'}), null);
  assert.equal(queries.length, 3);
  const pg = createPgRest({url: 'postgres://x', connect});
  assert.deepEqual(await pg('jobs?select=id', {method: 'GET'}), [{id: 1}]);
});
