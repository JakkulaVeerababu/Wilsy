-- Starts the GitHub collector workflows from the database, on time, every hour.
-- GitHub's own cron has run these workflows up to 14 hours late; pg_cron is punctual.
--
-- Before running this file, store a GitHub fine-grained token in Vault ONCE, in the SQL editor
-- (never commit the token):
--   select vault.create_secret('<token>', 'github_dispatch_token', 'Starts WILSY collector workflows');
-- Token settings: Repository access "Only select repositories" -> JakkulaVeerababu/Wilsy,
-- Permissions -> Actions: Read and write. Nothing else.
--
-- Check delivery afterwards (201/204 = accepted by GitHub):
--   select id, status_code, left(content, 120), created from net._http_response order by id desc limit 5;

begin;

-- wilsy_private already holds functions the public site calls (wilsy_match_job_ids, used by
-- wilsy_search_jobs), so the schema must stay usable by anon and authenticated. Only the
-- dispatch function itself is locked down below.
create schema if not exists wilsy_private;
grant usage on schema wilsy_private to anon, authenticated, service_role;

create or replace function wilsy_private.dispatch_workflow(workflow text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if workflow !~ '^[a-z0-9-]+\.yml$' then
    raise exception 'Unexpected workflow name %', workflow;
  end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';
  if token is null then
    raise exception 'Vault secret github_dispatch_token is missing';
  end if;
  return net.http_post(
    url := 'https://api.github.com/repos/JakkulaVeerababu/Wilsy/actions/workflows/' || workflow || '/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'wilsy-pg-cron'),
    body := jsonb_build_object('ref', 'main'),
    timeout_milliseconds := 10000);
end;
$$;
revoke all on function wilsy_private.dispatch_workflow(text) from public, anon, authenticated, service_role;

-- Jobs at :07 (all ten shards), hackathons at :23. Re-running this file updates the jobs in place.
select cron.schedule('wilsy-dispatch-collect-jobs', '7 * * * *',
  $$select wilsy_private.dispatch_workflow('collect-jobs.yml')$$);
select cron.schedule('wilsy-dispatch-collect-hackathons', '23 * * * *',
  $$select wilsy_private.dispatch_workflow('collect-hackathons.yml')$$);
-- Production health checks at :50, so a broken public search is reported within the hour.
select cron.schedule('wilsy-dispatch-live-checks', '50 * * * *',
  $$select wilsy_private.dispatch_workflow('live-checks.yml')$$);

commit;
