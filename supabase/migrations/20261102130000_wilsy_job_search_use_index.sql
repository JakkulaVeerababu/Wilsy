begin;
-- Text search through jobs_search_vector_idx. Under RLS Postgres cannot use a GIN index for @@
-- (the operator is not leakproof), so anon searches scanned every stored vector and cold
-- searches hit the 3s statement timeout. This owner-run lookup uses the index and returns
-- only ids that the public view would also show; wilsy_search_jobs still reads rows as the invoker.
create or replace function public.wilsy_match_job_ids(q text)
returns setof bigint language sql stable security definer set search_path = '' as $$
select j.id::bigint from public.jobs j
where coalesce(q,'')<>'' and j.search_vector @@ websearch_to_tsquery('simple',left(q,200))
 and j.status='published' and j.closed_at is null
 and (j.expires_at is null or j.expires_at>now())
 and (j.deadline_at is null or j.deadline_at>now())
 and j.apply_url ~ '^https://[^/[:space:]]+';
$$;
revoke all on function public.wilsy_match_job_ids(text) from public;
grant execute on function public.wilsy_match_job_ids(text) to anon, authenticated;

create or replace function public.wilsy_search_jobs(filters jsonb default '{}'::jsonb,
 page_size integer default 20, page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
with matched as materialized (
 select id from public.wilsy_match_job_ids(filters->>'q') id
), filtered as materialized (
 select j.id, j.posted_at, coalesce(j.first_seen_at,j.discovered_at) as seen_at
 from public.wilsy_public_jobs j
 where (coalesce(filters->>'q','')='' or j.id in (select id from matched))
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
notify pgrst, 'reload schema';
commit;
