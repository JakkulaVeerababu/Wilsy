begin;
set local lock_timeout = '5s';
-- Write path for partner job feeds (collectors/thejobcompany.mjs), run by the service role only.
-- Partners list jobs from many companies, so the company comes from each job instead of a watchlist
-- row. Rows are owned by the partner (ats_platform = the partner key): a job whose apply URL already
-- exists from an employer's own job board is never overwritten, it only counts as a duplicate.
--   feed.source  partner key (allow-listed below)      feed.name  display name, shown as the source
--   feed.jobs    jobs to insert or refresh              feed.seen  partner job-page URLs still listed
--   feed.expire  close partner jobs not seen for three days
-- Same tech-role filter as wilsy_ingest_board.
create or replace function public.wilsy_ingest_partner(feed jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  j jsonb; v_url text; v_job_id bigint; v_owner text; v_source text := lower(feed->>'source'); v_name text := feed->>'name';
  n_found int := 0; n_inserted int := 0; n_updated int := 0; n_unchanged int := 0; n_duplicate int := 0; n_invalid int := 0;
  n_other_roles int := 0; n_locations int := 0; n_seen int := 0; n_expired int := 0;
  tech_re constant text := '(software|developer|engineer|engineering|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|machine learning|(^|[^a-z])ml([^a-z]|$)|artificial intelligence|(^|[^a-z])ai([^a-z]|$)|data scientist|data engineer|analytics engineer|devops|site reliability|(^|[^a-z])sre([^a-z]|$)|platform engineer|cloud engineer|security engineer|cyber|firmware|embedded|fpga|rtl|asic|vlsi|verification engineer|hardware engineer|electrical engineer|electronics|computer vision|nlp|research engineer|solutions architect|technical architect|qa engineer|sdet|test automation|database engineer|systems engineer|network engineer|robotics)';
begin
  if v_source is null or v_source not in ('thejobcompany') then raise exception 'Unknown partner feed %', feed->>'source'; end if;
  if nullif(btrim(v_name),'') is null then raise exception 'Partner feed % needs a display name', v_source; end if;

  for j in select value from jsonb_array_elements(coalesce(feed->'jobs','[]'::jsonb)) loop
    v_url := j->>'url';
    if nullif(btrim(j->>'title'),'') is null or nullif(btrim(j->>'company'),'') is null or v_url is null or v_url !~* '^https://'
       or coalesce(j->>'source_url','') !~* '^https://' then n_invalid := n_invalid+1; continue; end if;
    if lower(coalesce(j->>'title','')||' '||left(coalesce(j->>'description',''),1200)) !~ tech_re then
      n_other_roles := n_other_roles+1; continue;
    end if;
    n_found := n_found+1;
    select id, ats_platform into v_job_id, v_owner from public.jobs where apply_url=v_url;
    if v_job_id is not null and coalesce(v_owner,'') <> v_source then n_duplicate := n_duplicate+1; continue; end if;
    v_owner := case when v_job_id is null then null else v_source end;
    v_job_id := null;
    insert into public.jobs(
      company,title,location,work_mode,job_type,description,apply_url,source_name,source_url,posted_at,verified_at,status,metadata,
      company_slug,external_job_id,ats_platform,job_url,canonical_url,posted_at_raw,posted_at_precision,posted_at_source,
      source_updated_at,last_seen_at,last_verified_at,is_direct_apply,is_company_verified,is_internship,source_payload,
      employment_type_raw,education,graduation_years,source_quality_score,verification_level,
      salary_min,salary_max,salary_currency,salary_period,salary_text
    ) values (
      btrim(j->>'company'),btrim(j->>'title'),j->>'location',coalesce(j->>'work_mode','unspecified'),coalesce(j->>'job_type','other'),j->>'description',v_url,v_name,
      j->>'source_url',(j->>'posted_at')::timestamptz,now(),'published',
      jsonb_build_object('worker','partner','partner',v_source,'authoritative',false),
      regexp_replace(lower(btrim(j->>'company')),'[^a-z0-9]+','-','g'),j->>'external_id',v_source,j->>'source_url',v_url,
      j->>'posted_at',case when j->>'posted_at' is not null then 'date_only' else 'unknown' end,
      case when j->>'posted_at' is not null then 'partner' else 'partner_missing' end,(j->>'posted_at')::timestamptz,now(),now(),
      v_url !~* 'thejobcompany\.co\.in',false,(j->>'job_type')='internship','{}'::jsonb,
      j->>'employment_type_raw',j->>'education',
      coalesce(array(select jsonb_array_elements_text(coalesce(j->'graduation_years','[]'::jsonb))::int),'{}'::int[]),70,'partner_feed',
      (j->>'salary_min')::numeric,(j->>'salary_max')::numeric,j->>'salary_currency',j->>'salary_period',j->>'salary_text'
    )
    on conflict(apply_url) do update set
      company=excluded.company,title=excluded.title,location=excluded.location,work_mode=excluded.work_mode,job_type=excluded.job_type,
      description=coalesce(excluded.description,public.jobs.description),source_name=excluded.source_name,source_url=excluded.source_url,job_url=excluded.job_url,
      posted_at=coalesce(excluded.posted_at,public.jobs.posted_at),verified_at=excluded.verified_at,status='published',closed_at=null,updated_at=now(),
      last_seen_at=excluded.last_seen_at,last_verified_at=excluded.last_verified_at,is_internship=excluded.is_internship,
      employment_type_raw=excluded.employment_type_raw,education=excluded.education,graduation_years=excluded.graduation_years,
      salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,salary_period=excluded.salary_period,salary_text=excluded.salary_text
    where public.jobs.ats_platform=v_source and (public.jobs.status<>'published' or public.jobs.closed_at is not null
      or public.jobs.last_seen_at < now()-interval '12 hours'
      or (public.jobs.company,public.jobs.title,public.jobs.location,public.jobs.job_type,public.jobs.description,public.jobs.source_url,
          public.jobs.education,public.jobs.graduation_years,public.jobs.salary_text)
      is distinct from (excluded.company,excluded.title,excluded.location,excluded.job_type,coalesce(excluded.description,public.jobs.description),
          excluded.source_url,excluded.education,excluded.graduation_years,excluded.salary_text))
    returning id into v_job_id;

    if v_job_id is null then
      select id into v_job_id from public.jobs where apply_url=v_url;
      if (select ats_platform from public.jobs where id=v_job_id) <> v_source then n_found := n_found-1; n_duplicate := n_duplicate+1; continue; end if;
      n_unchanged := n_unchanged+1;
    elsif v_owner is not null then n_updated := n_updated+1; else n_inserted := n_inserted+1; end if;
    if j->>'location' is not null and not exists(select 1 from public.job_locations where job_id=v_job_id and is_primary=true and coalesce(location_text,'')=j->>'location') then
      insert into public.job_locations(job_id,is_primary,location_text) values (v_job_id,true,j->>'location');
      n_locations := n_locations+1;
    end if;
  end loop;

  if jsonb_array_length(coalesce(feed->'seen','[]'::jsonb)) > 0 then
    with touched as (
      update public.jobs set last_seen_at=now()
      where ats_platform=v_source and status='published'
        and source_url = any(array(select jsonb_array_elements_text(feed->'seen')))
      returning 1
    ) select count(*) into n_seen from touched;
  end if;

  if coalesce((feed->>'expire')::boolean,false) then
    with closed as (
      update public.jobs set status='expired', closed_at=now(), updated_at=now()
      where ats_platform=v_source and status='published' and last_seen_at < now()-interval '3 days'
      returning 1
    ) select count(*) into n_expired from closed;
  end if;

  return jsonb_build_object('found',n_found,'inserted',n_inserted,'updated',n_updated,'unchanged',n_unchanged,'duplicate',n_duplicate,
    'invalid',n_invalid,'other_roles',n_other_roles,'locations',n_locations,'seen',n_seen,'expired',n_expired);
end $$;
revoke all on function public.wilsy_ingest_partner(jsonb) from public, anon, authenticated;
grant execute on function public.wilsy_ingest_partner(jsonb) to service_role;
commit;
