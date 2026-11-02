begin;
set local lock_timeout = '5s';
-- Signed-in visitors' saved jobs, hackathons and searches. Each row belongs to one user; RLS
-- limits every operation to that user, and anon has no access.
create table if not exists public.user_saved_items (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('job','hackathon')),
 item_id bigint not null check (item_id > 0),
 saved_at timestamptz not null default now(),
 primary key (user_id, kind, item_id)
);
create table if not exists public.user_saved_searches (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 query text not null check (length(query) between 1 and 2500),
 alert text not null default 'off' check (alert in ('off','daily','weekly')),
 created_at timestamptz not null default now(),
 last_alerted_at timestamptz,
 primary key (user_id, query)
);

alter table public.user_saved_items enable row level security;
alter table public.user_saved_searches enable row level security;
create policy "Users manage their saved items" on public.user_saved_items for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage their saved searches" on public.user_saved_searches for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.user_saved_items, public.user_saved_searches from public, anon, authenticated;
grant select, insert, delete on public.user_saved_items to authenticated;
grant select, insert, delete on public.user_saved_searches to authenticated;
grant update (alert) on public.user_saved_searches to authenticated;

-- Same limits as the website: 500 saved items of each kind, eight saved searches.
create or replace function wilsy_private.enforce_saved_limits()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_table_name = 'user_saved_items' then
  if (select count(*) from public.user_saved_items where user_id = new.user_id and kind = new.kind) >= 500 then
   raise exception 'You can save up to 500 of these. Remove one to save another.' using errcode = 'check_violation';
  end if;
 elsif (select count(*) from public.user_saved_searches where user_id = new.user_id) >= 8 then
  raise exception 'You have eight saved searches. Remove one to make room.' using errcode = 'check_violation';
 end if;
 return new;
end $$;
revoke all on function wilsy_private.enforce_saved_limits() from public;
grant execute on function wilsy_private.enforce_saved_limits() to authenticated;
create trigger enforce_saved_item_limit before insert on public.user_saved_items
 for each row execute function wilsy_private.enforce_saved_limits();
create trigger enforce_saved_search_limit before insert on public.user_saved_searches
 for each row execute function wilsy_private.enforce_saved_limits();
notify pgrst, 'reload schema';
commit;
