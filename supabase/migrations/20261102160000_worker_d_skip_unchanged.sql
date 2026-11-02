begin;
set local lock_timeout = '5s';
-- Worker D rewrote every job it saw every hour (about 4,600 rows per run), raw payload included,
-- which bloated jobs by about 125 MB. Patch the live function in place with exact replacements:
-- update a job only when visible fields change, when it reopens, or every 12 hours to refresh
-- last_seen_at, and stop storing the raw ATS payload (the column is NOT NULL, so '{}'). Each replacement must match the expected
-- number of times or the whole migration aborts.
do $migration$
declare
  d text := pg_get_functiondef('wilsy_internal.worker_d_run'::regproc);
  p record;
  found int;
begin
  create temp table patch(n int, old text, new text, expected int) on commit drop;
  insert into patch values
  (1, E'  n_updated integer := 0;\n', E'  n_updated integer := 0;\n  n_unchanged integer := 0;\n', 1),
  (2, $$(v_job_type='internship'),j,false,false,false$$, $$(v_job_type='internship'),'{}'::jsonb,false,false,false$$, 1),
  (3, $$is_internship=excluded.is_internship,source_payload=excluded.source_payload,$$, $$is_internship=excluded.is_internship,$$, 1),
  (4, E'source_quality_score=100,verification_level=\'authoritative_ats\',closed_at=null\n        returning id into v_job_id;',
      E'source_quality_score=100,verification_level=\'authoritative_ats\',closed_at=null\n'
      || E'        where public.jobs.status<>\'published\' or public.jobs.closed_at is not null\n'
      || E'          or public.jobs.last_seen_at is null or public.jobs.last_seen_at < now()-interval \'12 hours\'\n'
      || E'          or (public.jobs.company,public.jobs.title,public.jobs.location,public.jobs.work_mode,public.jobs.job_type,public.jobs.description,\n'
      || E'              public.jobs.source_url,public.jobs.posted_at,public.jobs.department,public.jobs.team,public.jobs.is_internship)\n'
      || E'          is distinct from (excluded.company,excluded.title,excluded.location,excluded.work_mode,excluded.job_type,coalesce(excluded.description,public.jobs.description),\n'
      || E'              excluded.source_url,coalesce(excluded.posted_at,public.jobs.posted_at),coalesce(excluded.department,public.jobs.department),coalesce(excluded.team,public.jobs.team),excluded.is_internship)\n'
      || E'        returning id into v_job_id;', 1),
  (5, $$if v_existing then n_updated:=n_updated+1; else n_inserted:=n_inserted+1; end if;$$,
      $$if v_job_id is null then select id into v_job_id from public.jobs where apply_url=v_url; n_unchanged:=n_unchanged+1;
        elsif v_existing then n_updated:=n_updated+1; else n_inserted:=n_inserted+1; end if;$$, 1),
  (6, $$'jobs_updated',n_updated,'locations_written'$$, $$'jobs_updated',n_updated,'jobs_unchanged',n_unchanged,'locations_written'$$, 2),
  (7, $$'version','3.0'$$, $$'version','3.1'$$, 3);
  for p in select * from patch order by n loop
    found := (length(d) - length(replace(d, p.old, ''))) / length(p.old);
    if found <> p.expected then raise exception 'worker_d patch % matched % times, expected %', p.n, found, p.expected; end if;
    d := replace(d, p.old, p.new);
  end loop;
  execute d;
end
$migration$;
commit;
