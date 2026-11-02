begin;
set local lock_timeout = '5s';
-- Write path for the collector fleet (collectors/collect.mjs), run by the service role only.
-- Same rules as Worker D 3.1: technical roles only, a row is rewritten only when a visible field
-- changes, it reopens, or every 12 hours. Adds source salary fields. Called with up to 50 jobs at a
-- time; a final call with live_urls (the board's complete inventory) closes roles that disappeared
-- and records the check on the watchlist row.
create or replace function public.wilsy_ingest_board(board jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  w record; j jsonb; v_url text; v_job_id bigint; v_existing boolean; v_ats text := lower(board->>'ats');
  n_found int := 0; n_inserted int := 0; n_updated int := 0; n_unchanged int := 0; n_invalid int := 0;
  n_other_roles int := 0; n_locations int := 0; n_expired int := 0;
  tech_re constant text := '(software|developer|engineer|engineering|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|machine learning|(^|[^a-z])ml([^a-z]|$)|artificial intelligence|(^|[^a-z])ai([^a-z]|$)|data scientist|data engineer|analytics engineer|devops|site reliability|(^|[^a-z])sre([^a-z]|$)|platform engineer|cloud engineer|security engineer|cyber|firmware|embedded|fpga|rtl|asic|vlsi|verification engineer|hardware engineer|electrical engineer|electronics|computer vision|nlp|research engineer|solutions architect|technical architect|qa engineer|sdet|test automation|database engineer|systems engineer|network engineer|robotics)';
begin
  select * into w from public.company_watchlist_11k where master_rank = (board->>'master_rank')::int;
  if not found then raise exception 'Unknown watchlist row %', board->>'master_rank'; end if;
  if lower(coalesce(w.ats_platform,'')) <> v_ats or lower(coalesce(w.ats_identifier,'')) <> lower(coalesce(board->>'slug','')) then
    raise exception 'Board %/% does not match watchlist row %', v_ats, board->>'slug', w.master_rank;
  end if;

  if board ? 'error' then
    update public.company_watchlist_11k set last_jobs_checked_at=now(), consecutive_empty_checks=consecutive_empty_checks+1, updated_at=now()
    where master_rank=w.master_rank;
    return jsonb_build_object('failed',1);
  end if;

  for j in select value from jsonb_array_elements(coalesce(board->'jobs','[]'::jsonb)) loop
    v_url := j->>'url';
    if nullif(btrim(j->>'title'),'') is null or v_url is null or v_url !~* '^https://' then n_invalid := n_invalid+1; continue; end if;
    if lower(coalesce(j->>'title','')||' '||coalesce(j->>'department','')||' '||left(coalesce(j->>'description',''),1200)) !~ tech_re then
      n_other_roles := n_other_roles+1; continue;
    end if;
    n_found := n_found+1;
    v_existing := exists(select 1 from public.jobs where apply_url=v_url);
    v_job_id := null;
    insert into public.jobs(
      company,title,location,work_mode,job_type,description,apply_url,source_name,source_url,posted_at,verified_at,status,metadata,
      company_slug,external_job_id,ats_platform,job_url,canonical_url,department,team,posted_at_raw,posted_at_precision,posted_at_source,
      source_updated_at,last_seen_at,last_verified_at,is_direct_apply,is_company_verified,is_internship,source_payload,is_apprenticeship,is_fresher,is_new_grad,
      employment_type_raw,workplace_type_raw,company_tier,watchlist_master_rank,source_quality_score,verification_level,
      salary_min,salary_max,salary_currency,salary_period,salary_text
    ) values (
      w.company,j->>'title',j->>'location',coalesce(j->>'work_mode','unspecified'),coalesce(j->>'job_type','other'),j->>'description',v_url,v_ats,
      coalesce(j->>'source_url',v_url),(j->>'posted_at')::timestamptz,now(),'published',
      jsonb_build_object('worker','fleet','authoritative',true,'adapter',v_ats),
      regexp_replace(lower(w.company),'[^a-z0-9]+','-','g'),j->>'external_id',v_ats,v_url,v_url,j->>'department',j->>'team',
      j->>'posted_at',case when j->>'posted_at' is not null then 'exact' else 'unknown' end,
      case when j->>'posted_at' is not null then 'ats' else 'ats_missing' end,(j->>'posted_at')::timestamptz,now(),now(),true,true,
      (j->>'job_type')='internship','{}'::jsonb,false,false,false,j->>'employment_type_raw',j->>'workplace_type_raw',
      w.priority_tier,w.master_rank,100,'authoritative_ats',
      (j->>'salary_min')::numeric,(j->>'salary_max')::numeric,j->>'salary_currency',j->>'salary_period',j->>'salary_text'
    )
    on conflict(apply_url) do update set
      company=excluded.company,title=excluded.title,location=excluded.location,work_mode=excluded.work_mode,job_type=excluded.job_type,
      description=coalesce(excluded.description,public.jobs.description),source_name=excluded.source_name,source_url=excluded.source_url,
      posted_at=coalesce(excluded.posted_at,public.jobs.posted_at),verified_at=excluded.verified_at,status='published',updated_at=now(),
      external_job_id=coalesce(excluded.external_job_id,public.jobs.external_job_id),ats_platform=excluded.ats_platform,job_url=excluded.job_url,
      canonical_url=excluded.canonical_url,department=coalesce(excluded.department,public.jobs.department),team=coalesce(excluded.team,public.jobs.team),
      source_updated_at=coalesce(excluded.source_updated_at,public.jobs.source_updated_at),last_seen_at=excluded.last_seen_at,last_verified_at=excluded.last_verified_at,
      is_company_verified=true,is_internship=excluded.is_internship,
      employment_type_raw=coalesce(excluded.employment_type_raw,public.jobs.employment_type_raw),workplace_type_raw=coalesce(excluded.workplace_type_raw,public.jobs.workplace_type_raw),
      company_tier=excluded.company_tier,watchlist_master_rank=excluded.watchlist_master_rank,source_quality_score=100,verification_level='authoritative_ats',closed_at=null,
      salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,salary_period=excluded.salary_period,salary_text=excluded.salary_text
    where public.jobs.status<>'published' or public.jobs.closed_at is not null
      or public.jobs.last_seen_at is null or public.jobs.last_seen_at < now()-interval '12 hours'
      or (public.jobs.company,public.jobs.title,public.jobs.location,public.jobs.work_mode,public.jobs.job_type,public.jobs.description,
          public.jobs.source_url,public.jobs.posted_at,public.jobs.department,public.jobs.team,public.jobs.is_internship,
          public.jobs.salary_min,public.jobs.salary_max,public.jobs.salary_currency,public.jobs.salary_period,public.jobs.salary_text)
      is distinct from (excluded.company,excluded.title,excluded.location,excluded.work_mode,excluded.job_type,coalesce(excluded.description,public.jobs.description),
          excluded.source_url,coalesce(excluded.posted_at,public.jobs.posted_at),coalesce(excluded.department,public.jobs.department),coalesce(excluded.team,public.jobs.team),
          excluded.is_internship,excluded.salary_min,excluded.salary_max,excluded.salary_currency,excluded.salary_period,excluded.salary_text)
    returning id into v_job_id;

    if v_job_id is null then select id into v_job_id from public.jobs where apply_url=v_url; n_unchanged := n_unchanged+1;
    elsif v_existing then n_updated := n_updated+1; else n_inserted := n_inserted+1; end if;
    if j->>'location' is not null and not exists(select 1 from public.job_locations where job_id=v_job_id and is_primary=true and coalesce(location_text,'')=j->>'location') then
      insert into public.job_locations(job_id,is_primary,location_text) values (v_job_id,true,j->>'location');
      n_locations := n_locations+1;
    end if;
  end loop;

  if board ? 'live_urls' then
    with closed as (
      update public.jobs set status='expired', closed_at=now(), updated_at=now()
      where watchlist_master_rank=w.master_rank and ats_platform=v_ats and status='published'
        and not (apply_url = any(array(select jsonb_array_elements_text(board->'live_urls'))))
      returning 1
    ) select count(*) into n_expired from closed;
    update public.company_watchlist_11k set last_jobs_checked_at=now(),
      consecutive_empty_checks=case when jsonb_array_length(board->'live_urls')=0 then consecutive_empty_checks+1 else 0 end, updated_at=now()
    where master_rank=w.master_rank;
  end if;

  return jsonb_build_object('found',n_found,'inserted',n_inserted,'updated',n_updated,'unchanged',n_unchanged,'invalid',n_invalid,
    'other_roles',n_other_roles,'locations',n_locations,'expired',n_expired);
end $$;
revoke all on function public.wilsy_ingest_board(jsonb) from public, anon, authenticated;
grant execute on function public.wilsy_ingest_board(jsonb) to service_role;
commit;
