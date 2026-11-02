begin;
set local lock_timeout = '5s';
-- Index the first 5,000 description characters instead of 20,000 (median description: 7,250).
-- Titles, companies, skills and tech stack stay fully indexed. Estimated on 10,196 jobs: search
-- vectors shrink from 79 MB to 50 MB. Stored vectors are recomputed in batches afterwards, with the
-- updated_at trigger paused per batch so the recompute does not look like a content change.
create or replace function public.wilsy_job_search_vector(title text, company text,
 skills text[], tech_stack text[], description text)
returns tsvector language sql immutable parallel safe set search_path = '' as $$
select setweight(to_tsvector('simple'::regconfig,coalesce(title,'')),'A')
 || setweight(to_tsvector('simple'::regconfig,coalesce(company,'')||' '||
   coalesce(pg_catalog.array_to_string(skills,' '),'')||' '||coalesce(pg_catalog.array_to_string(tech_stack,' '),'')),'B')
 || setweight(to_tsvector('simple'::regconfig,left(coalesce(description,''),5000)),'D');
$$;
commit;

-- Recompute, one batch per transaction (repeat until no rows change):
-- begin; set local lock_timeout='5s';
-- alter table public.jobs disable trigger jobs_set_updated_at;
-- update public.jobs set title=title where id in (select id from public.jobs
--   where search_vector is distinct from public.wilsy_job_search_vector(title,company,skills,tech_stack,description) limit 2500);
-- alter table public.jobs enable trigger jobs_set_updated_at;
-- commit;
