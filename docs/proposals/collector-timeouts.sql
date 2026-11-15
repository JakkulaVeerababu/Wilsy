-- Collector statement timeouts: SQL PROPOSALS. NOT APPLIED. Nothing in this file has been run.
-- Review each part, then run it in the Supabase SQL editor. Parts are independent; A matters most.
--
-- What was found, read-only, on 15 Nov 2026 (project pnkthqatdlozrojwefnc):
-- * Postgres logged 920 statement timeouts (SQLSTATE 57014) in wilsy_ingest_board in 24 hours:
--   900 inside the per-job upsert ("line 29", including its generated search_vector and the
--   updated_at trigger) and 20 at other lines of the function. None was in the expiry UPDATE that
--   the final live_urls call runs.
-- * The timeout rate grows with payload size (edge logs, 24 h, rpc/wilsy_ingest_board):
--     under 20 KB 0.5%, 20-100 KB 5.3%, 100-250 KB 11.4%, over 250 KB 20.3%.
--   Old 50-job calls for big Greenhouse boards were 290-500 KB.
-- * Rewriting a stored job is expensive: jobs has 36 indexes, including two full-text GIN indexes,
--   and only 31 of its 5,677,638 updates since 25 Aug were HOT, so nearly every one also writes both
--   GIN indexes and a new TOASTed search_vector. Computing the vectors is cheap (164 Scale AI rows in
--   0.55 s); the writes are not.
-- * Rows change every hour because two writers keep rewriting the same Greenhouse and Ashby jobs
--   in different formats:
--     - the collector fleet (collectors/boards.mjs) stores plain text and Greenhouse's
--       first_published date;
--     - Worker D (pg_cron "wilsy-worker-d-internal", :36 every hour) stores Greenhouse's
--       entity-escaped HTML and its updated_at date.
--   Worker D rewrote 330-1,140 rows an hour (job_ingestion_runs, last 12 runs). It reads the
--   80 boards with the oldest last_jobs_checked_at. A board whose collector run timed out never
--   gets that timestamp, so Worker D always takes it back. On 15 Nov, 115 of Scale AI's 164 live rows
--   still held Worker D's escaped HTML, and Scale AI's collector call timed out in all 9 runs checked.
-- * The site's own searches time out while the collector writes: in the same 24 hours,
--   wilsy_search_jobs and wilsy_job_facets timed out 238 times, 234 of them between :07 and :14.
--
-- The collector change on this branch (smaller, size-capped calls, split on timeout, non-technical
-- jobs skipped before sending) is meant to stop the lost boards with no database change; it has not
-- run in production yet. These parts remove the cause and the dead listings.


-- ---------------------------------------------------------------------------------------------
-- Part A: pause Worker D, so each board has one writer.
--
-- README.md already plans this step ("Once the fleet's runs are confirmed in job_ingestion_runs,
-- unschedule Worker D"). The fleet reads every board Worker D reads (verified, active Greenhouse and
-- Ashby rows) and four more services, every hour. Worker D is paused, not deleted: the function and
-- the cron row stay.
-- After it is paused, the fleet's next run rewrites Worker D's escaped-HTML rows to plain text once;
-- after that, an hourly run rewrites only rows that really changed (plus the 12-hour refresh).
-- Check:   select jobname, active from cron.job where jobname = 'wilsy-worker-d-internal';
-- Undo:    select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'wilsy-worker-d-internal'), active := true);
-- Remove for good later:  select cron.unschedule('wilsy-worker-d-internal');
-- ---------------------------------------------------------------------------------------------
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'wilsy-worker-d-internal'), active := false);


-- ---------------------------------------------------------------------------------------------
-- Part B: drop the full-text index nothing uses.
--
-- jobs_search_fts_idx (57 MB, GIN over company, title, full description, department and team) has
-- had 0 scans since statistics were reset on 25 Aug 2026. No constraint or object depends on it,
-- and no function uses its expression. Searches use jobs_search_vector_idx (search_vector) through
-- wilsy_private.wilsy_match_job_ids. Every non-HOT update of jobs still writes this index, and it
-- also turns each job's whole description (not the first 5,000 characters) into a vector.
-- It was not created by any migration in supabase/migrations.
-- CONCURRENTLY: no lock that blocks reads or writes, but it cannot run inside a transaction block,
-- so run this statement on its own.
-- Check first (expect 0):
--   select idx_scan from pg_stat_user_indexes where indexrelname = 'jobs_search_fts_idx';
-- Undo (rebuilds the same index; takes a few minutes):
--   create index concurrently jobs_search_fts_idx on public.jobs using gin (to_tsvector('simple'::regconfig,
--     coalesce(company,'')||' '||coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(department,'')||' '||coalesce(team,'')));
-- ---------------------------------------------------------------------------------------------
drop index concurrently if exists public.jobs_search_fts_idx;


-- ---------------------------------------------------------------------------------------------
-- Part C: the two boards that answer 404 every hour, and their dead listings.
--
-- Postman (master_rank 1012): greenhouse/postman has answered 404 since about 16 Sep 2026
-- (consecutive_empty_checks = 723). postman.com/company/careers/open-positions/ now lists its roles
-- from Workday (postman.wd108.myworkdayjobs.com/careers). The collectors cannot read Workday, so the
-- row is recorded as Workday, like BrowserStack ('browserstack.wd3'), and drops out of the
-- collectors' platform filter. Its 56 published Greenhouse jobs were last seen on 16 Sep 2026, and
-- their apply links return 404 (checked: job-boards.greenhouse.io/postman/jobs/6672559003).
--
-- Offstream (master_rank 527): ashby/offstream answers 404 and Ashby has no organisation by that
-- name any more. useoffstream.com/careers links only to one Ashby posting, which also returns 404.
-- No other board was found, so the row is deactivated. Its 1 published job has that dead link.
--
-- Each statement must touch the expected number of rows or the whole part rolls back.
-- Undo: the metadata note records the previous board; set ats_platform/ats_identifier or is_active
-- back, and the next collector run reopens any job its board still lists.
-- ---------------------------------------------------------------------------------------------
begin;
set local lock_timeout = '5s';
do $board_fixes$
declare n int;
begin
  update public.company_watchlist_11k
  set ats_platform = 'workday', ats_identifier = 'postman.wd108', updated_at = now(),
      metadata = coalesce(metadata,'{}') || jsonb_build_object('board_change', jsonb_build_object(
        'from', 'greenhouse/postman', 'to', 'workday/postman.wd108', 'checked_at', '2026-11-15',
        'reason', 'Greenhouse board returns 404; roles are listed at postman.wd108.myworkdayjobs.com/careers'))
  where master_rank = 1012 and lower(ats_platform) = 'greenhouse' and ats_identifier = 'postman';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Postman watchlist row: expected 1, got %', n; end if;

  update public.jobs set status = 'expired', closed_at = now(), updated_at = now()
  where watchlist_master_rank = 1012 and ats_platform = 'greenhouse' and status = 'published'
    and apply_url like 'https://job-boards.greenhouse.io/postman/%';
  get diagnostics n = row_count;
  if n <> 56 then raise exception 'Postman jobs: expected 56, got %', n; end if;

  update public.company_watchlist_11k
  set is_active = false, updated_at = now(),
      metadata = coalesce(metadata,'{}') || jsonb_build_object('board_change', jsonb_build_object(
        'from', 'ashby/offstream', 'to', null, 'checked_at', '2026-11-15',
        'reason', 'Ashby board and organisation return 404; no other public board found'))
  where master_rank = 527 and lower(ats_platform) = 'ashby' and ats_identifier = 'offstream' and is_active;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Offstream watchlist row: expected 1, got %', n; end if;

  update public.jobs set status = 'expired', closed_at = now(), updated_at = now()
  where watchlist_master_rank = 527 and ats_platform = 'ashby' and status = 'published'
    and apply_url like 'https://jobs.ashbyhq.com/offstream/%';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Offstream jobs: expected 1, got %', n; end if;
end $board_fixes$;
commit;
