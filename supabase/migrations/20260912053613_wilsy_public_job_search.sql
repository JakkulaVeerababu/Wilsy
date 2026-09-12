begin;

-- Preserve every company and collector record; website visitors only need reads.
drop policy if exists "Enable insert for anon" on public.companies;
revoke insert, update, delete, truncate, references, trigger on public.companies from public, anon, authenticated;
grant select on public.companies to anon, authenticated;
alter table public.companies enable row level security;

-- Invoker views retain the existing published/unexpired RLS rules.
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
   order by l.is_primary desc,l.id) from public.job_locations l where l.job_id=j.id),'[]'::jsonb) as locations
from public.jobs j left join public.job_categories c on c.id=j.category_id
where j.status='published' and j.closed_at is null
 and (j.expires_at is null or j.expires_at>now())
 and (j.deadline_at is null or j.deadline_at>now())
 and j.apply_url ~ '^https://[^/[:space:]]+';
grant select on public.wilsy_public_jobs to anon, authenticated;

create or replace function public.wilsy_search_jobs(filters jsonb default '{}'::jsonb,
 page_size integer default 20, page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
with filtered as materialized (
 select j.* from public.wilsy_public_jobs j
 where (coalesce(filters->>'q','')='' or
   to_tsvector('simple',coalesce(j.title,'')||' '||coalesce(j.company,'')||' '||coalesce(j.description,'')||' '||coalesce(array_to_string(j.skills,' '),'')||' '||coalesce(array_to_string(j.tech_stack,' '),''))
   @@ websearch_to_tsquery('simple',left(filters->>'q',200)))
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
 and (coalesce(filters->>'period','')='' or j.salary_period=filters->>'period')
 and (coalesce(filters->>'minimum','')='' or
   (coalesce(j.salary_max,j.salary_min)>=least(1000000000,greatest(0,(filters->>'minimum')::numeric))
   and j.salary_currency=filters->>'currency' and j.salary_period=filters->>'period'))
 and (coalesce(filters->>'experience','')='' or
   (j.experience_min is not null and j.experience_min <= (filters->>'experience')::numeric
   and (j.experience_max is null or j.experience_max >= (filters->>'experience')::numeric)))
 and (coalesce(filters->>'time','')='' or
   (j.posted_at is not null and j.posted_at<=now() and case filters->>'time'
    when 'hour' then j.posted_at>=now()-interval '1 hour' and coalesce(j.posted_at_precision,'unknown') not in ('unknown','date_only','date')
    when 'today' then (j.posted_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date
    when 'week' then j.posted_at>=now()-interval '7 days' else false end))
), page as (
 select * from filtered order by
  case when filters->>'sort'='posted' then posted_at end desc nulls last,
  coalesce(first_seen_at,discovered_at) desc nulls last, id desc
 limit least(50,greatest(1,page_size)) offset least(100000,greatest(0,page_offset))
)
select jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
 'total',(select count(*) from filtered),'as_of',now());
$$;
revoke all on function public.wilsy_search_jobs(jsonb,integer,integer) from public;
grant execute on function public.wilsy_search_jobs(jsonb,integer,integer) to anon, authenticated;

create or replace function public.wilsy_job_facets()
returns jsonb language sql stable security invoker set search_path = '' as $$
with visible as materialized (select * from public.wilsy_public_jobs)
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
