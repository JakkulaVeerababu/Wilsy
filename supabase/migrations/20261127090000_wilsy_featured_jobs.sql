-- Paid "Featured job" orders (Razorpay). Employers pay once (₹999) to pin a job to the top of search for 30 days.
-- Only the server functions in api/pay/* write here, with the service role key. anon and authenticated get nothing.
create table public.featured_job_orders (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.jobs(id) on delete cascade,
  company text not null check (length(company) between 1 and 120),
  email text not null check (length(email) between 3 and 200),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  mode text not null check (mode in ('test','live')),
  status text not null default 'created' check (status in ('created','paid','failed','refunded')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index featured_job_orders_active_idx on public.featured_job_orders (ends_at) where status = 'paid' and mode = 'live';
alter table public.featured_job_orders enable row level security;
revoke all on public.featured_job_orders from anon, authenticated;

-- Job ids with a paid, live, unexpired order. Test-mode payments never feature a job, so test cards cannot pin jobs on wilsy.in.
create function wilsy_private.wilsy_featured_job_ids()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select distinct job_id from public.featured_job_orders
  where status = 'paid' and mode = 'live' and starts_at <= now() and ends_at > now()
$$;
revoke all on function wilsy_private.wilsy_featured_job_ids() from public;
grant execute on function wilsy_private.wilsy_featured_job_ids() to anon, authenticated;

-- Same search as before, with featured jobs first and is_featured set on them. With no paid orders, results are unchanged.
create or replace function public.wilsy_search_jobs(filters jsonb default '{}'::jsonb, page_size integer default 20, page_offset integer default 0)
returns jsonb language sql stable set search_path to '' as $function$
with matched as materialized (
 select id from wilsy_private.wilsy_match_job_ids(filters->>'q') id
), featured as materialized (
 select id from wilsy_private.wilsy_featured_job_ids() id
), filtered as materialized (
 select j.id, j.posted_at, coalesce(j.first_seen_at,j.discovered_at) as seen_at, j.id in (select id from featured) as featured
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
 select f.*, row_number() over (order by f.featured desc,
  case when filters->>'sort'='posted' then f.posted_at end desc nulls last, f.seen_at desc nulls last, f.id desc) as rank
 from filtered f order by rank
 limit least(50,greatest(1,page_size)) offset least(100000,greatest(0,page_offset))
)
select jsonb_build_object('jobs',coalesce((select jsonb_agg((to_jsonb(v)-'search_vector')||jsonb_build_object('is_featured',coalesce(v.is_featured,false) or p.featured) order by p.rank)
  from page p join public.wilsy_public_jobs v on v.id=p.id),'[]'::jsonb),
 'total',(select count(*) from filtered),'as_of',now());
$function$;
grant execute on function public.wilsy_search_jobs(jsonb,integer,integer) to anon, authenticated;
