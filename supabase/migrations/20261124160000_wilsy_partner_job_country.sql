begin;
set local lock_timeout = '5s';
-- Partner jobs (The Job Company) arrived with only a location text such as "Bengaluru, India", so their
-- country and city were empty and every India view (the India filter, the homepage India tab, India
-- landing pages) left them out. The Job Company lists jobs in India only, so its jobs get
-- country India (IN) and, when the location starts with a real place, that place as the city.
-- Triggers fill this in on every write from wilsy_ingest_partner, and the update below fixes the
-- jobs already stored.

-- The city from a partner location: its first comma-separated part, unless that part is not a place
-- ("Remote", "Online", "Pan India", "India - Local Office", "Work-from-home/Remote").
create or replace function wilsy_private.partner_city(location text)
returns text language sql immutable set search_path = '' as $$
  select case when part is null or part = ''
                or part ~* '^(india|pan india|remote|online|work[- ]from[- ]home|wfh|hybrid|anywhere)\M'
              then null else left(part, 80) end
  from (select btrim(split_part(coalesce(location, ''), ',', 1)) as part) p
$$;

create or replace function wilsy_private.partner_job_place()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.ats_platform = 'thejobcompany' then
    new.country := coalesce(new.country, 'India');
    new.country_code := coalesce(new.country_code, 'IN');
    if new.city is null or (tg_op = 'UPDATE' and new.location is distinct from old.location) then
      new.city := wilsy_private.partner_city(new.location);
    end if;
  end if;
  return new;
end $$;

create or replace function wilsy_private.partner_job_location_place()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.country is null and exists(select 1 from public.jobs where id = new.job_id and ats_platform = 'thejobcompany') then
    new.country := 'India';
    new.country_code := coalesce(new.country_code, 'IN');
    new.city := coalesce(new.city, wilsy_private.partner_city(new.location_text));
  end if;
  return new;
end $$;

revoke all on function wilsy_private.partner_city(text) from public, anon, authenticated;
revoke all on function wilsy_private.partner_job_place() from public, anon, authenticated;
revoke all on function wilsy_private.partner_job_location_place() from public, anon, authenticated;

drop trigger if exists wilsy_partner_job_place on public.jobs;
create trigger wilsy_partner_job_place before insert or update on public.jobs
  for each row when (new.ats_platform = 'thejobcompany') execute function wilsy_private.partner_job_place();

drop trigger if exists wilsy_partner_job_location_place on public.job_locations;
create trigger wilsy_partner_job_location_place before insert or update on public.job_locations
  for each row when (new.country is null) execute function wilsy_private.partner_job_location_place();

-- The jobs and locations already stored.
update public.jobs
   set country = coalesce(country, 'India'), country_code = coalesce(country_code, 'IN'),
       city = coalesce(city, wilsy_private.partner_city(location))
 where ats_platform = 'thejobcompany' and (country is null or country_code is null or city is null);

update public.job_locations l
   set country = 'India', country_code = coalesce(l.country_code, 'IN'),
       city = coalesce(l.city, wilsy_private.partner_city(l.location_text))
  from public.jobs j
 where j.id = l.job_id and j.ats_platform = 'thejobcompany' and l.country is null;

commit;
