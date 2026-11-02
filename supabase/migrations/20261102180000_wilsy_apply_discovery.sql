begin;
set local lock_timeout = '5s';
-- Applies job-board discovery results (collectors/discover.mjs) to the watchlist the collectors read.
-- Matches each result by official domain, then by normalised name, and never touches placeholder or
-- generated rows. Only boards confirmed through the company's own links are applied; guesses are noted.
create or replace function public.wilsy_apply_discovery(results jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb; w record; domain text; norm text; status text; supported boolean;
  counts jsonb := '{"set":0,"replaced":0,"confirmed":0,"noted":0,"unmatched":0}';
  note jsonb;
begin
  for r in select value from jsonb_array_elements(results) loop
    status := r->>'status';
    domain := lower(substring(coalesce(r->>'website','') from '^https?://(?:www\.)?([^/:?#]+)'));
    norm := lower(regexp_replace(coalesce(r->>'name',''), '[^a-zA-Z0-9]+', '', 'g'));
    select * into w from public.company_watchlist_11k c
    where c.company !~ '^LEGACY_UNRESOLVED_' and c.verification_status <> 'invalid'
      and ((domain <> '' and lower(regexp_replace(coalesce(c.official_domain,''),'^www\.','')) = domain) or (norm <> '' and c.normalized_name = norm))
    order by (domain <> '' and lower(regexp_replace(coalesce(c.official_domain,''),'^www\.','')) = domain) desc,
      (c.source_group = 'global_top_1000') desc, c.master_rank
    limit 1;
    if not found then counts := jsonb_set(counts,'{unmatched}',to_jsonb((counts->>'unmatched')::int+1)); continue; end if;

    note := jsonb_build_object('status',status,'ats',r->>'ats','slug',r->>'slug','jobs',r->'jobs','evidence',r->>'evidence',
      'name_matches',r->'nameMatches','checked_at',now());
    supported := r->>'ats' in ('greenhouse','ashby','lever','workable','smartrecruiters','recruitee');

    if status = 'found' and supported and coalesce(w.ats_identifier,'') = '' then
      update public.company_watchlist_11k set ats_platform=r->>'ats', ats_identifier=r->>'slug', verification_status='verified',
        careers_url=coalesce(careers_url, r->>'careers'), consecutive_empty_checks=0, last_jobs_checked_at=null,
        metadata=coalesce(metadata,'{}')||jsonb_build_object('discovery',note), updated_at=now()
      where master_rank=w.master_rank;
      counts := jsonb_set(counts,'{set}',to_jsonb((counts->>'set')::int+1));
    elsif status = 'found' and supported and lower(w.ats_platform)=r->>'ats' and lower(w.ats_identifier)=lower(r->>'slug') then
      update public.company_watchlist_11k set metadata=coalesce(metadata,'{}')||jsonb_build_object('discovery',note), updated_at=now()
      where master_rank=w.master_rank;
      counts := jsonb_set(counts,'{confirmed}',to_jsonb((counts->>'confirmed')::int+1));
    elsif status = 'found' and supported and w.consecutive_empty_checks >= 2 then
      update public.company_watchlist_11k set ats_platform=r->>'ats', ats_identifier=r->>'slug', consecutive_empty_checks=0, last_jobs_checked_at=null,
        metadata=coalesce(metadata,'{}')||jsonb_build_object('discovery',note||jsonb_build_object('replaced',jsonb_build_object('ats',w.ats_platform,'slug',w.ats_identifier))),
        updated_at=now()
      where master_rank=w.master_rank;
      counts := jsonb_set(counts,'{replaced}',to_jsonb((counts->>'replaced')::int+1));
    elsif status = 'unsupported' and coalesce(w.ats_identifier,'') = '' then
      update public.company_watchlist_11k set ats_platform=r->>'ats', ats_identifier=r->>'slug',
        metadata=coalesce(metadata,'{}')||jsonb_build_object('discovery',note), updated_at=now()
      where master_rank=w.master_rank;
      counts := jsonb_set(counts,'{set}',to_jsonb((counts->>'set')::int+1));
    else
      update public.company_watchlist_11k set metadata=coalesce(metadata,'{}')||jsonb_build_object('discovery',note), updated_at=now()
      where master_rank=w.master_rank;
      counts := jsonb_set(counts,'{noted}',to_jsonb((counts->>'noted')::int+1));
    end if;
  end loop;
  return counts;
end $$;
revoke all on function public.wilsy_apply_discovery(jsonb) from public, anon, authenticated;
grant execute on function public.wilsy_apply_discovery(jsonb) to service_role;
commit;
