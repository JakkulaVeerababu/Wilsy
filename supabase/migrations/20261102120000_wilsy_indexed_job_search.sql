begin;
-- Give up quickly rather than queue site reads behind a lock wait on jobs.
set local lock_timeout = '5s';
-- Precompute job search text once per row instead of on every request.
-- Supersedes 20260915120000, which dropped descriptions from search and reverted the INR salary filter.
create or replace function public.wilsy_job_search_vector(title text, company text,
 skills text[], tech_stack text[], description text)
returns tsvector language sql immutable parallel safe set search_path = '' as $$
select setweight(to_tsvector('simple'::regconfig,coalesce(title,'')),'A')
 || setweight(to_tsvector('simple'::regconfig,coalesce(company,'')||' '||
   coalesce(pg_catalog.array_to_string(skills,' '),'')||' '||coalesce(pg_catalog.array_to_string(tech_stack,' '),'')),'B')
 || setweight(to_tsvector('simple'::regconfig,left(coalesce(description,''),20000)),'D');
$$;
revoke all on function public.wilsy_job_search_vector(text,text,text[],text[],text) from public;
grant execute on function public.wilsy_job_search_vector(text,text,text[],text[],text) to anon, authenticated;

-- Generated, so collectors keep writing jobs exactly as before.
alter table public.jobs add column if not exists search_vector tsvector
 generated always as (public.wilsy_job_search_vector(title,company,skills,tech_stack,description)) stored;
create index if not exists jobs_search_vector_idx on public.jobs using gin (search_vector);

-- Same view, with search_vector appended (create or replace only allows new trailing columns).
create or replace view public.wilsy_public_jobs with (security_invoker = true) as
select j.id, j.company, j.company_slug, j.title, j.category_id, c.slug as category_slug,
 c.name as category_name, j.location, j.city, j.state_region, j.country, j.country_code,
 j.work_mode, j.remote_regions, j.job_type, j.experience_min, j.experience_max,
 j.experience_text, j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
 j.salary_text, j.compensation_notes, j.equity_text, j.bonus_text,
 j.eligibility, j.description, j.apply_url, j.source_name, j.source_url,
 j.posted_at, j.posted_at_raw, j.posted_at_precision, j.posted_at_source,
 j.deadline_at, j.discovered_at, j.verified_at, j.first_seen_at, j.last_seen_at,
 j.last_verified_at, j.expires_at, j.status, j.is_featured, j.is_direct_apply,
 j.is_company_verified, j.ats_platform, j.external_job_id, j.requisition_id,
 j.department, j.team, j.seniority_level, j.role_family, j.skills, j.tech_stack,
 j.education, j.graduation_years, j.visa_sponsorship, j.relocation_assistance,
 j.is_internship, j.is_fresher, j.is_new_grad, j.is_apprenticeship, j.career_stage,
 j.language_requirements, j.company_tier, j.verification_level,
 coalesce((select jsonb_agg(jsonb_build_object('location',l.location_text,'city',l.city,
   'state',l.state_region,'country',l.country,'country_code',l.country_code,'primary',l.is_primary)
   order by l.is_primary desc,l.id) from public.job_locations l where l.job_id=j.id),'[]'::jsonb) as locations,
 j.search_vector
from public.jobs j left join public.job_categories c on c.id=j.category_id
where j.status='published' and j.closed_at is null
 and (j.expires_at is null or j.expires_at>now())
 and (j.deadline_at is null or j.deadline_at>now())
 and j.apply_url ~ '^https://[^/[:space:]]+';
grant select on public.wilsy_public_jobs to anon, authenticated;

-- Filter and count on narrow rows; build full rows (with locations) only for the returned page.
create or replace function public.wilsy_search_jobs(filters jsonb default '{}'::jsonb,
 page_size integer default 20, page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
with filtered as materialized (
 select j.id, j.posted_at, coalesce(j.first_seen_at,j.discovered_at) as seen_at
 from public.wilsy_public_jobs j
 where (coalesce(filters->>'q','')='' or j.search_vector @@ websearch_to_tsquery('simple',left(filters->>'q',200)))
 and (coalesce(filters->>'id','')='' or j.id::text=filters->>'id')
 and (not (filters ? 'saved') or j.id::text in (select jsonb_array_elements_text(filters->'saved')))
 and (coalesce(filters->>'company','')='' or j.company=filters->>'company')
 and (coalesce(filters->>'country','')='' or j.country=filters->>'country'
   or exists(select 1 from public.job_locations l where l.job_id=j.id and l.country=filters->>'country'))
 and (coalesce(filters->>'mode','')='' or j.work_mode=filters->>'mode')
 and (coalesce(filters->>'type','')='' or j.job_type=filters->>'type')
 and (coalesce(filters->>'seniority','')='' or j.seniority_level=filters->>'seniority')
 and (coalesce(filters->>'stage','')='' or case filters->>'stage'
   when 'internship' then j.is_internship or j.job_type='internship'
   when 'fresher' then j.is_fresher when 'new-grad' then j.is_new_grad
   when 'apprenticeship' then j.is_apprenticeship else false end)
 and (coalesce(filters->>'role','')='' or j.category_slug=filters->>'role' or
   (lower(coalesce(j.role_family,'')||' '||j.title) ~ case filters->>'role'
     when 'software-engineering' then 'software|sde|full.?stack'
     when 'backend' then 'back.?end' when 'frontend' then 'front.?end'
     when 'ai-ml' then '(^|[^a-z])(ai|ml)([^a-z]|$)|machine learning|artificial intelligence'
     when 'genai' then 'genai|generative|llm|large language'
     when 'data' then 'data|analytics' when 'devops-cloud' then 'devops|cloud|site.?reliability|infrastructure'
     when 'cybersecurity' then 'cyber|security' when 'ece-core' then 'electrical|electronics|controls'
     when 'vlsi' then 'vlsi|asic|fpga|hardware.?verification|silicon'
     when 'embedded' then 'embedded|firmware' else 'a^' end))
 and (coalesce(filters->>'skill','')='' or exists(select 1 from unnest(coalesce(j.skills,'{}')||coalesce(j.tech_stack,'{}')) s where lower(s)=lower(filters->>'skill')))
 and (coalesce(filters->>'visa','')<>'yes' or j.visa_sponsorship is true)
 and (coalesce(filters->>'relocation','')<>'yes' or j.relocation_assistance is true)
 and (coalesce(filters->>'salary','')<>'yes' or j.salary_min is not null or j.salary_max is not null or nullif(j.salary_text,'') is not null)
 and (coalesce(filters->>'currency','')='' or j.salary_currency=filters->>'currency')
 and (coalesce(filters->>'period','')='' or public.wilsy_salary_period(j.salary_period,j.salary_text)=filters->>'period')
 and (coalesce(filters->>'minimum','')='' or
   (case when filters->>'display_currency'='INR' then
     case j.salary_currency when 'INR' then coalesce(j.salary_max,j.salary_min)
       when 'USD' then coalesce(j.salary_max,j.salary_min)*least(1000,greatest(0,(filters->>'inr_rate')::numeric)) end
    else case when j.salary_currency=filters->>'currency' then coalesce(j.salary_max,j.salary_min) end end
   >=least(1000000000,greatest(0,(filters->>'minimum')::numeric))
   and public.wilsy_salary_period(j.salary_period,j.salary_text)=filters->>'period'))
 and (coalesce(filters->>'experience','')='' or
   (j.experience_min is not null and j.experience_min <= (filters->>'experience')::numeric
   and (j.experience_max is null or j.experience_max >= (filters->>'experience')::numeric)))
 and (coalesce(filters->>'time','')='' or
   (j.posted_at is not null and j.posted_at<=now() and case filters->>'time'
    when 'hour' then j.posted_at>=now()-interval '1 hour' and coalesce(j.posted_at_precision,'unknown') not in ('unknown','date_only','date')
    when 'today' then (j.posted_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date
    when 'week' then j.posted_at>=now()-interval '7 days' else false end))
), page as (
 select f.*, row_number() over (order by
  case when filters->>'sort'='posted' then f.posted_at end desc nulls last, f.seen_at desc nulls last, f.id desc) as rank
 from filtered f order by rank
 limit least(50,greatest(1,page_size)) offset least(100000,greatest(0,page_offset))
)
select jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(v)-'search_vector' order by p.rank)
  from page p join public.wilsy_public_jobs v on v.id=p.id),'[]'::jsonb),
 'total',(select count(*) from filtered),'as_of',now());
$$;
revoke all on function public.wilsy_search_jobs(jsonb,integer,integer) from public;
grant execute on function public.wilsy_search_jobs(jsonb,integer,integer) to anon, authenticated;

-- Facets only need a few columns; avoid building every job's locations list.
create or replace function public.wilsy_job_facets()
returns jsonb language sql stable security invoker set search_path = '' as $$
with visible as materialized (select id, company, work_mode, country, skills, tech_stack,
 seniority_level, last_verified_at, verified_at from public.wilsy_public_jobs)
select jsonb_build_object(
 'total',(select count(*) from visible),
 'companies_count',(select count(distinct company) from visible),
 'remote_count',(select count(*) from visible where work_mode='remote'),
 'latest_check',(select max(coalesce(last_verified_at,verified_at)) from visible),
 'companies',coalesce((select jsonb_agg(company order by company) from (select distinct company from visible) x),'[]'::jsonb),
 'countries',coalesce((select jsonb_agg(country order by country) from
  (select distinct country from visible where country is not null and country<>'Multiple'
   union select distinct l.country from public.job_locations l join visible j on j.id=l.job_id where l.country is not null) x),'[]'::jsonb),
 'skills',coalesce((select jsonb_agg(s order by s) from (select distinct unnest(coalesce(skills,'{}')||coalesce(tech_stack,'{}')) s from visible) x),'[]'::jsonb),
 'seniority',coalesce((select jsonb_agg(seniority_level order by seniority_level) from (select distinct seniority_level from visible where seniority_level is not null) x),'[]'::jsonb));
$$;
revoke all on function public.wilsy_job_facets() from public;
grant execute on function public.wilsy_job_facets() to anon, authenticated;
notify pgrst, 'reload schema';
commit;
