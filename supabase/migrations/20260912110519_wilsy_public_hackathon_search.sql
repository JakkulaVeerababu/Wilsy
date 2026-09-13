begin;

-- Worker-owned records remain private until verified and marked live/published.
alter table public.hackathons enable row level security;
alter table public.hackathon_prizes enable row level security;
alter table public.hackathon_ingestion_runs enable row level security;
revoke all on public.hackathons,public.hackathon_prizes,public.hackathon_ingestion_runs from public,anon,authenticated;
grant select(id,title,organizer,organizer_slug,description,eligibility,themes,skills,hackathon_type,
 participation_mode,team_size_min,team_size_max,country,country_code,city,state_region,venue,
 is_global,is_online,registration_url,official_url,source_name,source_url,external_hackathon_id,
 registration_opens_at,registration_deadline_at,starts_at,ends_at,results_at,
 prize_pool_min,prize_pool_max,prize_currency,prize_text,has_cash_prize,status,first_seen_at,
 last_seen_at,last_verified_at,closed_at,verification_level) on public.hackathons to anon,authenticated;
grant select(id,hackathon_id,prize_rank,prize_name,prize_type,amount,currency,value_text,
 description,quantity,source_url) on public.hackathon_prizes to anon,authenticated;

create policy "wilsy_verified_hackathons_read" on public.hackathons for select to anon,authenticated
 using(status in ('live','published') and last_verified_at is not null and closed_at is null
 and coalesce(nullif(registration_url,''),official_url) ~ '^https://[^/[:space:]]+');
create policy "wilsy_verified_prizes_read" on public.hackathon_prizes for select to anon,authenticated
 using(exists(select 1 from public.hackathons h where h.id=hackathon_id
  and h.status in ('live','published') and h.last_verified_at is not null and h.closed_at is null
  and coalesce(nullif(h.registration_url,''),h.official_url) ~ '^https://[^/[:space:]]+'));

create or replace view public.wilsy_public_hackathons with(security_invoker=true) as
select h.id,h.title,h.organizer,h.organizer_slug,h.description,h.eligibility,h.themes,h.skills,
 h.hackathon_type,h.participation_mode,h.team_size_min,h.team_size_max,h.country,h.country_code,
 h.city,h.state_region,h.venue,h.is_global,h.is_online,h.registration_url,h.official_url,
 h.source_name,h.source_url,h.external_hackathon_id,h.registration_opens_at,
 h.registration_deadline_at,h.starts_at,h.ends_at,h.results_at,h.prize_pool_min,h.prize_pool_max,
 h.prize_currency,h.prize_text,h.has_cash_prize,h.status,h.first_seen_at,h.last_seen_at,
 h.last_verified_at,h.verification_level,
 coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'rank',p.prize_rank,'name',p.prize_name,
  'type',p.prize_type,'amount',p.amount,'currency',p.currency,'value_text',p.value_text,
  'description',p.description,'quantity',p.quantity,'source_url',p.source_url) order by p.id)
  from public.hackathon_prizes p where p.hackathon_id=h.id),'[]'::jsonb) as prizes
from public.hackathons h
where h.status in ('live','published') and h.last_verified_at is not null and h.closed_at is null
 and coalesce(nullif(h.registration_url,''),h.official_url) ~ '^https://[^/[:space:]]+';
grant select on public.wilsy_public_hackathons to anon,authenticated;

create or replace function public.wilsy_search_hackathons(filters jsonb default '{}'::jsonb,
 page_size integer default 12,page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as materialized (
 select h.* from public.wilsy_public_hackathons h
 where (coalesce(filters->>'q','')='' or to_tsvector('simple',coalesce(h.title,'')||' '||
  coalesce(h.organizer,'')||' '||coalesce(h.description,'')||' '||coalesce(h.eligibility,'')||' '||
  coalesce(array_to_string(h.themes,' '),'')||' '||coalesce(array_to_string(h.skills,' '),''))
  @@ websearch_to_tsquery('simple',left(filters->>'q',200)))
 and (coalesce(filters->>'id','')='' or h.id::text=filters->>'id')
 and (not(filters ? 'saved') or h.id::text in (select jsonb_array_elements_text(filters->'saved')))
 and (coalesce(filters->>'mode','')='' or lower(h.participation_mode)=filters->>'mode'
  or (filters->>'mode'='online' and h.is_online is true))
 and (coalesce(filters->>'country','')='' or h.country=filters->>'country'
  or (filters->>'country'='Global' and h.is_global is true))
 and (coalesce(filters->>'theme','')='' or exists(select 1 from unnest(h.themes) t where lower(t)=lower(filters->>'theme')))
 and (coalesce(filters->>'cash','')<>'yes' or h.has_cash_prize is true)
 and (coalesce(filters->>'team','')='' or case filters->>'team'
  when 'solo' then h.team_size_min<=1 and (h.team_size_max is null or h.team_size_max>=1)
  when 'team' then h.team_size_max>=2 else false end)
 and (coalesce(filters->>'when','')='' or case filters->>'when'
  when 'upcoming' then h.starts_at>now()
  when 'ongoing' then h.starts_at<=now() and h.ends_at>=now()
  when 'deadline' then h.registration_deadline_at>=now() and h.registration_deadline_at<=now()+interval '30 days'
  else false end)
), page as (
 select * from filtered order by
  case when filters->>'sort'='deadline' then registration_deadline_at end asc nulls last,
  case when coalesce(filters->>'sort','start')='start' then starts_at end asc nulls last,
  first_seen_at desc nulls last,id desc
 limit least(36,greatest(1,page_size)) offset least(100000,greatest(0,page_offset))
)
select jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
 'total',(select count(*) from filtered),'as_of',now());
$$;
revoke all on function public.wilsy_search_hackathons(jsonb,integer,integer) from public;
grant execute on function public.wilsy_search_hackathons(jsonb,integer,integer) to anon,authenticated;

create or replace function public.wilsy_hackathon_facets()
returns jsonb language sql stable security invoker set search_path='' as $$
with visible as materialized(select * from public.wilsy_public_hackathons)
select jsonb_build_object('total',(select count(*) from visible),
 'online',(select count(*) from visible where is_online is true or lower(participation_mode)='online'),
 'cash',(select count(*) from visible where has_cash_prize is true),
 'latest_check',(select max(last_verified_at) from visible),
 'themes',coalesce((select jsonb_agg(theme order by theme) from (select distinct unnest(themes) as theme from visible) t),'[]'::jsonb),
 'countries',coalesce((select jsonb_agg(country order by country) from (select distinct country from visible where country is not null union select 'Global' where exists(select 1 from visible where is_global is true)) c),'[]'::jsonb));
$$;
revoke all on function public.wilsy_hackathon_facets() from public;
grant execute on function public.wilsy_hackathon_facets() to anon,authenticated;
create index if not exists wilsy_hackathons_public_start_idx on public.hackathons(starts_at,id)
 where status in ('live','published') and last_verified_at is not null;
notify pgrst,'reload schema';
commit;
