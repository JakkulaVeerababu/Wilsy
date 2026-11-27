-- Ghost-job signals for one job page: how many times the same company listed the same title, in the same place, before
-- (rows that have since closed), when the last one closed, and how many days this listing has been open.
-- Read-only and stores nothing. Uses jobs_company_idx, about 10 ms per call. Idea from the MIT-licensed
-- career-ops project (repost detection); written for WILSY's own tables.
create or replace function public.wilsy_job_history(job_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with j as (
    select id, company, lower(btrim(regexp_replace(title, '\s+', ' ', 'g'))) as t, lower(coalesce(location, '')) as place, coalesce(posted_at, first_seen_at) as opened
    from public.jobs where id = job_id and status = 'published'
  ), earlier as (
    select o.id, coalesce(o.expires_at, o.last_seen_at) as closed
    from public.jobs o join j on o.company = j.company
    where o.id <> j.id and o.status = 'expired' and lower(coalesce(o.location, '')) = j.place and lower(btrim(regexp_replace(o.title, '\s+', ' ', 'g'))) = j.t
  )
  select case when not exists (select 1 from j) then null else jsonb_build_object(
    'earlier', (select count(*) from earlier),
    'last_closed', (select max(closed)::date from earlier),
    'open_days', (select greatest(0, current_date - opened::date) from j)
  ) end
$$;
revoke all on function public.wilsy_job_history(bigint) from public;
grant execute on function public.wilsy_job_history(bigint) to anon, authenticated;
