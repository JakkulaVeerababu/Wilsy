-- WILSY opportunities: competitions and coding contests.
-- Applied to the wilsy-jobs project on 15 Nov 2026 as migration 20261115024903 (wilsy_opportunities).
--
-- What it does: adds one table, public.opportunities, and two read-only functions the site calls
-- with the publishable key: wilsy_search_opportunities and wilsy_opportunity_facets.
-- What it does not do: it changes no existing table, view, function, policy or grant.
--
-- Who writes: collectors/opportunities.mjs, with the service-role key (bypasses RLS).
-- Who reads: anyone, but only rows that are live (status = 'live', not closed), through RLS.
-- Nothing in a row is private: every field is copied from a public listing.

create table public.opportunities (
  id bigint generated always as identity primary key,
  -- Only competition and contest are collected today. The other kinds are the sections proposed in
  -- docs/startup-upgrade-plan.md, listed now so adding one later needs no constraint change.
  kind text not null check (kind in ('competition','contest','program','research','scholarship','event','grant','course')),
  subtype text check (subtype ~ '^[a-z0-9_]{1,40}$'),
  source_name text not null check (length(source_name) between 1 and 40),
  external_id text not null check (length(external_id) between 1 and 80),
  title text not null check (length(title) between 1 and 200),
  organizer text check (length(organizer) <= 200),
  description text check (length(description) <= 6000),
  eligibility text check (length(eligibility) <= 600),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  participation_mode text check (participation_mode in ('online','offline','hybrid')),
  city text check (length(city) <= 80),
  country text check (length(country) <= 80),
  official_url text not null check (official_url ~ '^https://[^/[:space:]]+'),
  registration_url text check (registration_url ~ '^https://[^/[:space:]]+'),
  registration_opens_at timestamptz,
  registration_deadline_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer check (duration_minutes between 1 and 100000),
  team_size_min smallint check (team_size_min between 1 and 999),
  team_size_max smallint check (team_size_max between 1 and 999),
  prize_text text check (length(prize_text) <= 300),
  prize_amount numeric(14,2) check (prize_amount >= 0),
  prize_currency text check (prize_currency ~ '^[A-Z]{3}$'),
  rated_range text check (length(rated_range) <= 40),
  status text not null default 'live' check (status in ('live','closed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_reason text check (length(closed_reason) <= 40),
  unique (source_name, external_id)
);
comment on table public.opportunities is 'Public competitions and coding contests collected by collectors/opportunities.mjs. Every field comes from a public listing.';

-- Public read: live rows only. Writes stay with the service role.
alter table public.opportunities enable row level security;
revoke all on public.opportunities from public, anon, authenticated;
grant select on public.opportunities to anon, authenticated;
create policy wilsy_live_opportunities_read on public.opportunities
  for select to anon, authenticated
  using (status = 'live' and closed_at is null);

-- The listing pages filter by kind and sort by start time or registration deadline.
create index opportunities_live_kind_idx on public.opportunities (kind, starts_at, registration_deadline_at)
  where status = 'live' and closed_at is null;

-- One page of live items of one kind. Filters (all optional):
--   kind ('competition' default | 'contest'), q (words), id, subtype, mode (online/offline/hybrid),
--   source (e.g. 'Codeforces'), cash ('yes'), when ('week': closes or starts within 7 days),
--   sort ('soon' default: contests by start, competitions by deadline | 'new': newest first).
create or replace function public.wilsy_search_opportunities(filters jsonb default '{}'::jsonb,
  page_size integer default 12, page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
with filtered as materialized (
  select o.id, o.kind, o.subtype, o.source_name, o.external_id, o.title, o.organizer, o.description,
    o.eligibility, o.tags, o.participation_mode, o.city, o.country, o.official_url, o.registration_url,
    o.registration_opens_at, o.registration_deadline_at, o.starts_at, o.ends_at, o.duration_minutes,
    o.team_size_min, o.team_size_max, o.prize_text, o.prize_amount, o.prize_currency, o.rated_range,
    o.first_seen_at, o.last_seen_at
  from public.opportunities o
  where o.status = 'live' and o.closed_at is null
    and o.kind = coalesce(nullif(filters->>'kind', ''), 'competition')
    and (o.registration_deadline_at is null or o.registration_deadline_at >= now())
    and (o.ends_at is null or o.ends_at >= now())
    and (coalesce(filters->>'q', '') = '' or to_tsvector('simple', o.title || ' ' || coalesce(o.organizer, '') || ' ' ||
      coalesce(o.description, '') || ' ' || coalesce(o.eligibility, '') || ' ' || array_to_string(o.tags, ' '))
      @@ websearch_to_tsquery('simple', left(filters->>'q', 200)))
    and (coalesce(filters->>'id', '') = '' or o.id::text = filters->>'id')
    and (coalesce(filters->>'subtype', '') = '' or o.subtype = filters->>'subtype')
    and (coalesce(filters->>'mode', '') = '' or o.participation_mode = filters->>'mode')
    and (coalesce(filters->>'source', '') = '' or o.source_name = filters->>'source')
    and (coalesce(filters->>'cash', '') <> 'yes' or o.prize_amount > 0)
    and (coalesce(filters->>'when', '') <> 'week' or
      (case when o.kind = 'contest' then o.starts_at else o.registration_deadline_at end) <= now() + interval '7 days')
), ranked as (
  select f.*, row_number() over (order by
    case when filters->>'sort' = 'new' then f.first_seen_at end desc nulls last,
    case when f.kind = 'contest' then f.starts_at else f.registration_deadline_at end asc nulls last,
    f.first_seen_at desc, f.id desc) as position
  from filtered f
), page as (
  select * from ranked order by position
  limit least(36, greatest(1, page_size)) offset least(100000, greatest(0, page_offset))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(p) - 'position' order by p.position) from page p), '[]'::jsonb),
  'total', (select count(*) from filtered),
  'as_of', now());
$$;
revoke all on function public.wilsy_search_opportunities(jsonb, integer, integer) from public;
grant execute on function public.wilsy_search_opportunities(jsonb, integer, integer) to anon, authenticated;

-- Counts for the filter menus and the page header.
create or replace function public.wilsy_opportunity_facets(opportunity_kind text default 'competition')
returns jsonb language sql stable security invoker set search_path = '' as $$
with visible as materialized (
  select o.subtype, o.source_name, o.participation_mode, o.prize_amount, o.last_seen_at
  from public.opportunities o
  where o.status = 'live' and o.closed_at is null and o.kind = opportunity_kind
    and (o.registration_deadline_at is null or o.registration_deadline_at >= now())
    and (o.ends_at is null or o.ends_at >= now())
)
select jsonb_build_object(
  'total', (select count(*) from visible),
  'online', (select count(*) from visible where participation_mode = 'online'),
  'cash', (select count(*) from visible where prize_amount > 0),
  'latest_check', (select max(last_seen_at) from visible),
  'subtypes', coalesce((select jsonb_object_agg(subtype, n) from
    (select subtype, count(*) as n from visible where subtype is not null group by subtype) s), '{}'::jsonb),
  'sources', coalesce((select jsonb_object_agg(source_name, n) from
    (select source_name, count(*) as n from visible group by source_name) s), '{}'::jsonb));
$$;
revoke all on function public.wilsy_opportunity_facets(text) from public;
grant execute on function public.wilsy_opportunity_facets(text) to anon, authenticated;

notify pgrst, 'reload schema';
