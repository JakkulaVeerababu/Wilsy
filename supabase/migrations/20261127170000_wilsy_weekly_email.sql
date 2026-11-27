-- Weekly WILSY email: one small row per signed-in person who turns it on in Account. Each person can
-- read and change only their own row; collectors/digest.mjs reads it with the service key and records
-- last_digest_at. Unsubscribing (api/alerts/unsubscribe?k=weekly) sets weekly_digest to false.
create table if not exists public.user_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_digest boolean not null default false,
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_email_prefs enable row level security;

drop policy if exists "own email prefs: read" on public.user_email_prefs;
drop policy if exists "own email prefs: add" on public.user_email_prefs;
drop policy if exists "own email prefs: change" on public.user_email_prefs;
create policy "own email prefs: read" on public.user_email_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "own email prefs: add" on public.user_email_prefs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own email prefs: change" on public.user_email_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.user_email_prefs from anon, authenticated;
grant select (user_id, weekly_digest) on public.user_email_prefs to authenticated;
grant insert (user_id, weekly_digest) on public.user_email_prefs to authenticated;
grant update (user_id, weekly_digest) on public.user_email_prefs to authenticated;
grant all on public.user_email_prefs to service_role;
