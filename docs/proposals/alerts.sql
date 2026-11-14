-- Job alert emails: SQL PROPOSALS. NOT APPLIED. Nothing in this file has been run.
-- See docs/alerts-setup.md. Review each part, then run it in the Supabase SQL editor only when
-- that document's steps 1-5 are done (Resend verified, dry and live runs checked by hand).
--
-- Nothing here is needed for collectors/alerts.mjs to work today. Checked read-only on
-- 14 Nov 2026: service_role has SELECT and UPDATE on public.user_saved_searches (including the
-- last_alerted_at column) and bypasses RLS; email addresses come from the Supabase Auth admin API;
-- roles come from the public wilsy_search_jobs with the public key. No grant, schema or function
-- change was made.

-- ---------------------------------------------------------------------------------------------
-- Part A: run the alert workflow live every day at 03:30 UTC (09:00 IST).
--
-- wilsy_private.dispatch_workflow (20261112020000_wilsy_hourly_dispatch.sql) sends no workflow
-- inputs, so a send-alerts.yml run it starts is a DRY RUN (the workflow's safe default). This adds
-- a separate function that also passes inputs, leaving the existing function and its four cron jobs
-- untouched. It reuses the github_dispatch_token Vault secret, which already has Actions read and
-- write on JakkulaVeerababu/Wilsy.
--
-- Weekly alerts need no second job: the daily run sends each weekly search when it is due.
-- Pause:   select cron.unschedule('wilsy-dispatch-send-alerts');
-- Check:   select id, status_code, left(content, 120), created from net._http_response order by id desc limit 5;
-- ---------------------------------------------------------------------------------------------
begin;
set local lock_timeout = '5s';

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

commit;

-- ---------------------------------------------------------------------------------------------
-- Part B (OPTIONAL, only if a stored, revocable token is preferred over the HMAC token described in
-- docs/alerts-setup.md, which needs no database change): one-click unsubscribe tokens.
--
-- The alert script would call wilsy_alert_unsubscribe_token(user_id) with the service key to put
-- the token in each email; the unsubscribe endpoint (a Supabase Edge Function with JWT verification
-- off, holding the service key server-side) would call wilsy_alerts_unsubscribe(token) on POST.
-- Both are callable by service_role only; anon and authenticated get nothing new.
-- ---------------------------------------------------------------------------------------------
begin;
set local lock_timeout = '5s';

create table if not exists wilsy_private.alert_unsubscribe_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table wilsy_private.alert_unsubscribe_tokens enable row level security;
-- No policies: only the two security definer functions below read or write it.
revoke all on table wilsy_private.alert_unsubscribe_tokens from public, anon, authenticated;

create or replace function public.wilsy_alert_unsubscribe_token(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result uuid;
begin
  insert into wilsy_private.alert_unsubscribe_tokens (user_id) values (p_user)
  on conflict (user_id) do nothing;
  select token into result from wilsy_private.alert_unsubscribe_tokens where user_id = p_user;
  return result;
end;
$$;
revoke all on function public.wilsy_alert_unsubscribe_token(uuid) from public, anon, authenticated;
grant execute on function public.wilsy_alert_unsubscribe_token(uuid) to service_role;

-- Turns every alert of the token's owner off; returns how many searches changed (0 for an unknown token).
create or replace function public.wilsy_alerts_unsubscribe(p_token uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with owner as (
    select user_id from wilsy_private.alert_unsubscribe_tokens where token = p_token
  ), changed as (
    update public.user_saved_searches s set alert = 'off'
    from owner where s.user_id = owner.user_id and s.alert <> 'off'
    returning 1
  )
  select count(*)::integer from changed;
$$;
revoke all on function public.wilsy_alerts_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.wilsy_alerts_unsubscribe(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
