-- Jobs database (Heroku Postgres). Schema changes here are applied by hand with psql; the Supabase
-- migrations folder no longer covers the job tables.
--
-- Company boards from colophon-group/jobseek (MIT; see THIRD_PARTY_NOTICES.md) join the watchlist as their
-- own source group. Rows are inserted by a one-off import after each board was read once successfully.
alter table public.company_watchlist_11k drop constraint company_watchlist_11k_source_group_check;
alter table public.company_watchlist_11k add constraint company_watchlist_11k_source_group_check
  check (source_group = any (array['global_top_1000'::text, 'uploaded_10k'::text, 'jobseek'::text]));
