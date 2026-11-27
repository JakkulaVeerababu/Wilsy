-- Daily job alert emails at 03:30 UTC (09:00 IST): Part A of docs/proposals/alerts.sql, applied 27 Nov 2026.
-- Pause: select cron.unschedule('wilsy-dispatch-send-alerts');

create or replace function wilsy_private.dispatch_workflow_with_inputs(workflow text, inputs jsonb)
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
  -- GitHub accepts at most 10 inputs, each a string.
  if jsonb_typeof(inputs) is distinct from 'object'
     or (select count(*) from jsonb_each(inputs)) > 10
     or exists (select 1 from jsonb_each(inputs) e
                where e.key !~ '^[a-z0-9_]{1,40}$' or jsonb_typeof(e.value) <> 'string') then
    raise exception 'Workflow inputs must be an object of up to 10 string values';
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
    body := jsonb_build_object('ref', 'main', 'inputs', inputs),
    timeout_milliseconds := 10000);
end;
$$;
-- Same lock-down as dispatch_workflow: only pg_cron (running as postgres) calls it.
revoke all on function wilsy_private.dispatch_workflow_with_inputs(text, jsonb) from public, anon, authenticated, service_role;

select cron.schedule('wilsy-dispatch-send-alerts', '30 3 * * *',
  $$select wilsy_private.dispatch_workflow_with_inputs('send-alerts.yml', '{"dry_run":"false","max_emails":"100"}'::jsonb)$$);

