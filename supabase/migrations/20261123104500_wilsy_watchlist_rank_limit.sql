-- Ranks 1-11,000 are all taken by the original lists, so companies added by hand need room after them.
-- First used for GitLab (rank 11001, Greenhouse board "gitlab"), added on 2026-11-23.
alter table public.company_watchlist_11k drop constraint company_watchlist_11k_master_rank_check;
alter table public.company_watchlist_11k add constraint company_watchlist_11k_master_rank_check check (master_rank between 1 and 20000);

-- Jobs point at their watchlist row, so they need the same range.
alter table public.jobs drop constraint jobs_watchlist_master_rank_check;
alter table public.jobs add constraint jobs_watchlist_master_rank_check check (watchlist_master_rank is null or watchlist_master_rank between 1 and 20000);
