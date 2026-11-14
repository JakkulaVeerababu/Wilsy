# WILSY startup upgrade plan

Audit date: 14 Nov 2026. Sources: the live site (www.wilsy.in, desktop and 375 px phone width) and the code under `frontend/`.
Benchmarks: the patterns that LinkedIn Jobs, Indeed, Naukri, Wellfound, Instahyre, Glassdoor and Unstop share.

Ground rules for every item below:

- Keep the UI calm and flat. No backdrop blur, animated glows, marquees, scroll reveals, count-ups, gradient text, or grid/dot backgrounds.
- No invented proof: no fake testimonials, press logos, user counts or ratings. Every number on the site comes from the data.
- No Supabase grant or schema changes in this plan. New data reads use the existing public search RPCs.
- Devpost and MLH are never scraped.

## What the audit found

### Already at startup level

- Search-first hero with a location picker, quick chips and a `/` shortcut.
- Real, dated numbers: 9,186 jobs, 541 hiring companies, 2,626 remote (14 Nov), refreshed hourly.
- The jobs workspace is deep: filters for role, country, company, workplace, stage, type, seniority, skill, experience, pay and visa. Also saved jobs, saved searches, share links, compare (side by side), density toggle and pagination.
- Optional accounts (email code or Google) that sync saves across devices, plus alert preferences per saved search.
- Good base: security headers, sitemap, canonical URLs, OG images, skip link, no horizontal scroll at 375 px, 44 px tap targets.

### Gaps compared with big job startups

| Area | WILSY today | What established products do |
|---|---|---|
| Homepage story | 11 sections, about 8,100 px tall. Four of them say the same thing ("manifesto", "paths", "studio", "how it works"). The "studio" is a mock app window with a fake *Beta* tag. Backgrounds jump between blue, black and white. | 5–6 sections: search, browse by category/city, fresh jobs, top hiring companies, one "why us" block, sign-up CTA. One background rhythm. |
| Job URLs and SEO | A job opens in a dialog at `/jobs?job=ID`. No indexable job page, no `JobPosting` structured data. | Every job has its own URL with `JobPosting` schema. This is how Google for Jobs lists them, and it is the largest free traffic source for job sites. |
| Landing pages | Only `/jobs`. | Crawlable pages per role and city ("Backend jobs in Bengaluru") linked from the footer. |
| Company pages | 1,000 profiles show one salary example. They link to jobs but show no live openings. | The company page shows its open roles and a count. |
| Phone jobs page | First screen: hero, search, chips, saved-search row, save/copy buttons, density toggle. Not one job is visible. | Results start on the first screen. Filters sit behind one sticky "Filters" button. |
| Performance | 9 stylesheets on home, 13 on `/jobs` (about 400 KB of CSS in total, all render-blocking). AdSense loads on every page, including home and jobs. DOMContentLoaded was about 3.3 s on the test connection. | One minified stylesheet per page. No ads on the core product pages, or ads loaded only after the page is idle. |
| Trust | About page with the founding team, methodology, contact. The footer says "Newsletter subscriptions are not yet automated", which reads as unfinished. | A clear "how we get jobs" story, visible freshness, "Report a listing", one consistent CTA (create an account for alerts). |
| Alerts | Preferences are saved, but no emails are sent yet. The account panel says so honestly. | Daily/weekly email alerts are the main reason people sign up. |
| Navigation | 6 top links plus a theme toggle, a CTA and Sign in. Labels mix "Find jobs" and "Gov jobs". | Short nouns: Jobs · Companies · Government · Hackathons · Prepare (DSA, guides). Sign in plus one primary button. A mega-footer with popular searches. |

## Plan, by impact and effort

Effort: S = under half a day, M = about a day, L = several days or outside help needed.

### P0 — high impact, low effort (recommended first)

1. **Tighter homepage story (S–M).** Cut 11 sections to 6: hero and search → browse by role and city (chips with live counts) → fresh jobs → top hiring companies → one "How WILSY works" block (merging manifesto, paths, studio and why) → guides and DSA strip and final CTA. Remove the mock "studio" window and the duplicate console chrome. Use one flat, light background rhythm with a single dark CTA band.
2. **Phone-first jobs page (S).** On phone, put results on the first screen: a compact heading with the count only, the search box, and one row with "Filters (n)" and sort. Move save search, copy link and density into a small "More" menu. Make the "Filters" bar sticky while scrolling results.
3. **Navigation and footer (S).** Short nav labels; group DSA and Career guides under "Prepare". Add a "Popular searches" footer column (role and city links). Replace the "newsletter not automated" block with "Create a free account to save jobs and get alerts".
4. **One CSS file per page (S).** At build time, concatenate and minify each page's stylesheets into one hashed file (`/css/page-<hash>.css`), cached as immutable. Tests check that every page links exactly one stylesheet.
5. **Ads off the core product pages (S, your call).** No AdSense on `/` and `/jobs`. Elsewhere, load it after the page is idle. This means less ad revenue on the two busiest pages.

### P1 — high impact, medium effort

6. **Shareable job pages with `JobPosting` (M).** Pre-render `/jobs/<id>` pages at build time for the jobs in the public snapshot (the daily deploy refreshes them). Each page gets the title, company, location, pay in INR, a description excerpt, `JobPosting` JSON-LD, an "Apply on employer site" button and similar jobs. The dialog on `/jobs` links to the page. For every job (not only the snapshot), a small Vercel function can render `/jobs/<id>` from the public search RPC. That is a later step, because it adds a server-side piece.
7. **Role × city landing pages (M).** Pre-render about 30 pages (for example `/jobs/backend/bengaluru`, `/jobs/internships/remote`) from the public search RPC at build time, with a count, the top 20 jobs and a link into the filtered workspace. Add them to the sitemap and footer.
8. **Live roles on company pages (S).** Each company profile fetches its open roles from the public search on load ("12 open roles · updated today") and links to the filtered `/jobs`.
9. **Trust details (S).** A "Report this listing" link on every job, "Updated N minutes ago" from the snapshot timestamp, and an About section on how the data is collected (sources, refresh cadence, what WILSY never does).

### P2 — needs your decisions or outside accounts

10. **Send job alert emails (L).** Needs an email provider account (for example Resend or Postmark), DNS records on wilsy.in (SPF/DKIM), and a scheduled sender in Supabase that writes `last_alerted_at`. You create the provider account and DNS. The sender is a schema-adjacent change, so it gets its own reviewed plan.
11. **Server-rendered job pages for all jobs (M–L).** The Vercel function from item 6.
12. **Accessibility pass (S–M).** Automated checks in tests (one `h1`, labelled controls, alt text, contrast tokens) and a manual keyboard pass of the job dialog and filters.

## Proposed first batch

Items 1–4 and 8, plus 5 if you agree to drop ads on home and jobs. Each goes in its own commit, with `npm run build` and `npm test` passing and a local check at desktop and 375 px. Then push to `main` with your OK. Items 6, 7 and 9 come next as a second batch.

## Status (14 Nov 2026)

Approved scope: items 1–9. Built in separate commits and deployed on 14 Nov 2026 (99079cb).

| Item | Status |
|---|---|
| 1. Homepage story | Done. 11 sections → 8, about 8,100 px → 5,900 px on desktop. Mock studio window, console, manifesto and duplicate path cards removed. |
| 2. Phone-first jobs page | Done. At 375 px the first job card moved from 986 px to 630 px. Filters, sort and refresh form the one sticky bar. |
| 3. Nav and footer | Done. Short nav labels, Popular searches footer column, "Create a free account" in place of the newsletter note. |
| 4. One CSS file per page | Done. Hashed bundles (`css/b-<hash>.css`) cached as immutable. The homepage loads 1 stylesheet instead of 9 (29 KB gzipped). |
| 5. Ads | Done. No AdSense on `/`, `/jobs` or the new job pages. Elsewhere it loads after the page is idle. |
| 6. Job pages | Done, with a change. Pages are built only for jobs with a full description (600+ characters): many public-search rows carry about 200-character previews, which would make thin pages. A live build makes about 240. |
| 7. Landing pages | Done, with a change. City pages are not possible yet: the public search has no city filter, and location text is not in the search index. Built instead: 24 pages by role, role in India, career stage, remote and India. Adding city pages needs a reviewed Supabase change (a city filter in `wilsy_search_jobs`). |
| 8. Live roles on company pages | Done. |
| 9. Trust details | Done. "Report listing" in the job dialog and on job pages, "updated N min ago" on /jobs, and an About section on how listings are collected. |

Still open: 10 (alert emails; needs an email provider account and DNS), 11 (server-rendered pages for every job), 12 (accessibility pass) and city landing pages (needs a Supabase change).

## Phase 0 progress (14 Nov 2026)

From the growth plan (`WILSY-Growth-Plan-2026-2030.pdf`), built and live:

- **Job alert emails** (ceaaf67): `collectors/alerts.mjs` and the manual "Send job alerts" workflow, dry run by default. Sending starts once the founders add a Resend account, its DNS records and the `RESEND_API_KEY` secret (`docs/alerts-setup.md`). The daily schedule is a reviewed SQL proposal, not applied (`docs/proposals/alerts.sql`).
- **For employers and Campus ambassadors pages** (`/employers`, `/campus`), linked from every footer.
- **A page for every live job** (cf5d5d8, a66c711): `api/job-page.mjs` renders `/jobs/<id>-<slug>` on request when no page was pre-built. It is cached for an hour at Vercel's edge.

Still in progress: database proposals (collector timeout root cause, city filter) and the installable app, funnel events and accessibility checks.

## Scaling features: proposal (14 Nov 2026)

Parked as backlog. The founders asked for new opportunity sections first (next section).

Facts behind this list:

- Every `/jobs` search and facet load goes from the visitor's browser straight to Supabase (`wilsy_search_jobs`, `wilsy_job_facets`). Nothing is cached in between.
- New jobs carry full descriptions: a sample of the 300 newest had 600+ characters each. So most on-demand job pages can be indexed, but Google can only find them through links. The sitemap lists just the ~240 pre-built ones.
- Company pages load their open roles in the browser, so search engines don't see them.
- `live-checks.yml` checks freshness and API contracts hourly. A failure only emails the repository owner.
- Collector runs on big boards still hit the database's 8-second statement timeout (root cause pending in the database session).

Effort: S = under a day, M = 1–3 days, L = a week or more, or outside help.

### Next batch (recommended): high impact, no new accounts

| # | Feature | Area | Impact | Effort | Founder decision |
|---|---|---|---|---|---|
| 1 | **Sitemap of every live job.** Sitemap files list all indexable job pages (not only the ~240 pre-built), refreshed every deploy. | Growth: search traffic | High. About 9,000 pages become discoverable by Google and Google for Jobs, instead of ~240. | S–M | How to list jobs. Recommended: one small read-only Supabase function returning id, title, company and last-seen date (one cheap query; reviewed SQL file, applied by you). Alternative without a database change: page through the public search during the build (about 185 extra queries per deploy). |
| 2 | **Edge-cached search.** `/jobs` searches and facets go through a Vercel function cached 1–5 minutes per filter combination. | Tech: Supabase load | High. Popular searches (home chips, landing pages, the empty /jobs view) hit Supabase once a minute instead of once per visitor. Also gives one place to rate-limit scrapers. | M | None if the Vercel plan allows the function usage (see cost checks). |
| 3 | **Monitoring that the whole team sees.** Failed live checks, collector runs and deploys open (and later close) a GitHub issue. Add page checks for home, /jobs, a job page and the job-page function, plus a daily freshness line: share of jobs seen in the last 24 hours. | Tech: reliability | Medium–high. Outages are noticed in minutes by everyone, not just one inbox. | S | Who gets notified (GitHub watchers, or email once Resend exists). |
| 4 | **Share and referral loops.** "Share on WhatsApp" and copy-link on job pages, with clean job-page URLs. Campus ambassador referral links (`?ref=<code>`) recorded with the funnel events. | Growth: acquisition | Medium. India shares jobs on WhatsApp; ambassadors get measurable results. | S | Ambassador code format (for example, college short name + number). |
| 5 | **Company pages show open roles to search engines.** The count and top roles are rendered into the page (on-demand, cached), not only fetched in the browser. | Growth: search traffic | Medium. 1,000 company pages gain fresh, indexable content ("<Company> jobs in India: N open roles"). | M | None. |

### Then: needs a reviewed database change or a founder account

| # | Feature | Area | Impact | Effort | Founder decision |
|---|---|---|---|---|---|
| 6 | **Turn on alert emails and schedule them** (code is live). | Growth: retention | High. Alerts are the main reason people return. | S | Create the Resend account and DNS records; approve `docs/proposals/alerts.sql`. |
| 7 | **City filter, city facets and city × role pages** ("Backend jobs in Bengaluru"). | Growth: search traffic | High | M | Approve the database session's city-filter SQL. |
| 8 | **Collector timeout fix, then grow from 541 to 1,000+ hiring companies**, with a per-source health page. | Tech: collector throughput | High. More jobs, no failed runs. | M | Approve the database session's timeout fix. |
| 9 | **Application tracker** (saved → applied → interviewing → offer) synced to the account. | Growth: retention | Medium–high | M | Approve a small schema change (a status on saved jobs). |
| 10 | **Error tracking** for pages and the job-page function. | Tech: reliability | Medium | S | Add a third-party error tracker (for example, Sentry's free tier) and name it in the privacy policy. |
| 11 | **Staging for database changes**: Vercel preview deploys for branches, and Supabase branches to test SQL before production. | Tech: safety | Medium. Prevents outages like the one the earlier permission revoke caused. | S–M | Supabase branching is a paid feature; check the cost. |
| 12 | **Weekly "fresh jobs" newsletter** for people without an account (double opt-in). | Growth: retention | Medium | M | Same Resend account; privacy policy update. |

### Later: bigger product decisions

| # | Feature | Impact | Effort | Founder decision |
|---|---|---|---|---|
| 13 | WhatsApp alerts through an approved WhatsApp Business provider | High in India | M | Provider choice and a per-message budget. |
| 14 | Verified employer accounts: claim a company page, post jobs, moderation queue | Opens employer revenue | L | Verification rules, pricing, employer terms. |
| 15 | Profiles, résumé upload and match scores | High retention | L | WILSY currently promises it never collects résumés. Changing that needs a new privacy policy and DPDP Act consent flows. |
| 16 | Dedicated search engine (Typesense, Meilisearch or OpenSearch) | Faster search at 100k+ jobs | L | Hosting cost. Trigger: search slower than 300 ms for 5% of queries, or high database load. |
| 17 | Backups and recovery: confirm daily backups or point-in-time recovery; a nightly export of core tables | Protects the business | S–M | Depends on the Supabase plan. |

### Cost and plan checks for the founders

- **Vercel:** the Hobby plan is for non-commercial projects, and WILSY shows ads. If the project is on Hobby, move it to Pro before traffic grows. Functions (job pages, cached search) also count against plan limits.
- **Supabase:** the compute size affects the collector timeouts and search speed. The free plan has no daily backups. Check the plan, and the current prices, before item 2 and items 7–8.
- **Resend:** the free plan sends 100 emails a day. The alert sender's default cap matches it; raise both together.

## New opportunity sections: proposal (14 Nov 2026)

The founders asked for more sections like Jobs and Hackathons. Each new section would get the same parts Hackathons has:

- a listing page with filters (`/competitions`, `/contests` and so on), backed by a search function and a facets function in Supabase;
- a page for every listing, built like the job pages (pre-built when the build runs, on demand otherwise);
- an automated collector on GitHub Actions, started by Supabase pg_cron;
- sitemap entries, and later saved items and alerts.

Sources were checked on 14 Nov 2026. A source is used only if its terms and robots.txt allow automated reading and reuse. Sources we will not read:

- **Internshala:** its terms forbid automated access and data extraction.
- **CodeChef and Hasgeek:** their terms forbid crawling and scraping.
- **LeetCode:** its robots.txt blocks its API.
- **Buddy4Study:** a competing aggregator; its compiled lists are its own work.
- **Devpost and MLH:** as before.

Effort: S = under a day, M = 1–3 days, L = a week or more.

### Ranked

| # | Section | Sources | Value for Indian students and job seekers | Effort | Freshness |
|---|---|---|---|---|---|
| 1 | **Competitions**: case competitions, innovation challenges, quizzes, online coding challenges | Unstop public API, the one the hackathon collector already uses (`opportunity=competitions`, 708 open; `quizzes`, 72). Unstop's robots.txt allows `/api/public/*`, and its terms of use have no clause against automated reading. | High. Case competitions and challenges are how students build a CV, and many offer pre-placement interviews. | M: copy the hackathon collector and pages. Needs one reviewed database change (below). | Hourly |
| 2 | **Coding contests calendar** | Codeforces official API (`contest.list`, at most 1 call per 2 seconds); AtCoder's contests page (static; its terms have no clause against automated reading); Unstop online coding challenges. CodeChef and LeetCode appear only as links to their own contest pages, with no data read. | High. Placement preparation; fits the DSA roadmap. | S–M | Hourly |
| 3 | **Open-source programs**: GSoC, LFX Mentorship, Outreachy, Hacktoberfest, GirlScript Summer of Code, Season of KDE, Google Season of Docs, Code for GovTech | A curated list (like the hand-kept government notices) of about 20 programs, with dates and links taken from each program's official page. A daily job re-reads those pages and flags changes. Outreachy's status page is static and readable. GSoC has no documented public API. LFX's site was down for an upgrade during the test. | Very high. For years India has had more GSoC contributors than any other country, and these programs lead to jobs. | S–M | Daily check; dates updated each round |
| 4 | **Research internships**: IAS-INSA-NASI Summer Research Fellowship, IISc, IIT summer programs (such as SURGE at IIT Kanpur and SRIP at IIT Gandhinagar), TIFR VSRP, JNCASR SRFP, IISER summer programs | The same curated-list approach. The pages are static official ones; the IAS robots.txt allows them. | High for science and engineering undergraduates. Applications open November–March, so building it now catches this season. | M | Daily check; seasonal |
| 5 | **Scholarships**: National Scholarship Portal central schemes, AICTE (Pragati, Saksham), DST INSPIRE-SHE, state portals, company scholarships | Curated rows linking only to official pages. The National Scholarship Portal did not answer automated requests in the test. Unstop lists just 3 scholarships. | Very high. A huge search demand, especially from first-generation college students. | M, plus ongoing curation | Weekly review; most windows run June–December |
| 6 | **More internships**, inside Jobs, which already has `/jobs/internships` from employers' own career pages | Unstop internships (557 open). In a sample of 100, 65 were paid and most came from small companies WILSY cannot verify. | Medium–high: more volume, but the quality varies. | M | Hourly |
| 7 | **Apprenticeships**: NAPS (apprenticeshipindia.gov.in), NATS for graduate apprentices, PSU apprentice notices (such as BHEL, IOCL and NTPC) | Official portals, through the government-notices collector pattern. The NAPS portal is a JavaScript app and PSU notices are often PDFs. Check each portal's copyright policy first: Indian government sites usually allow reuse with credit, and some ask for an email first. | High for diploma, ITI and new-graduate job seekers, an audience WILSY doesn't reach today. | M–L | Daily |
| 8 | **Workshops, conferences and tech events** | Unstop (`workshops`, 102 open; `conferences`, 14). Hasgeek's terms forbid crawling and Meetup's API is paid, so neither is used. | Medium–low | S once Competitions exists | Hourly |
| 9 | **Startup grants, incubators and accelerators**: Startup India Seed Fund incubators, BIRAC BIG calls, MeitY Startup Hub, Atal Innovation Mission challenges | Curated rows from official pages; the Seed Fund site's robots.txt allows everything. | Medium: a small audience, but a valuable one, and it helps the employer side later. | M | Weekly |
| 10 | **Free courses and certifications** | Microsoft Learn's official Catalog API (public and documented); the NPTEL course list (its content is CC BY-NC-SA, so only course facts and links, no copied descriptions, because WILSY shows ads); SWAYAM. | Medium. Overlaps Guides and DSA; not time-sensitive. | S–M | Weekly |

### Recommended first build

Build sections 1, 2 and 3: Competitions, Coding contests and Open-source programs. Two of them come from sources WILSY already reads or that are official APIs. The third is a short curated list. Together they cover the three things students ask for most after jobs: CV-building challenges, placement practice and the routes into open source. Research internships (4) come next, while this season's applications are open.

### Decisions for the founders

1. **Database shape.** Recommended: one new table `opportunities` with a `kind` column (competition, contest, program, research, scholarship, event, grant, course), plus search and facets functions modelled on `wilsy_search_hackathons` and `wilsy_hackathon_facets`. The alternative is a separate table per section. Either way, it is a reviewed SQL file that the founders apply. It only adds new objects and changes no existing grants.
2. **Codeforces.** Its terms forbid "commercializing any Website material", and WILSY shows ads. Recommended: show only facts (contest name, start time, length, link) and no ads on contest pages. The alternative is to email Codeforces for permission first.
3. **Who keeps the curated lists current** (sections 3, 4 and 5): about an hour a week, helped by the daily change check.
4. **Quality rules for Unstop internships** (section 6): for example, paid only, the stipend shown, and never a fee to apply.
