# WILSY

Wilsy Jobs combines a live job search on the homepage (`/`), with `/jobs` retained for existing links with an independent directory of 1,000 technology employers, sourced salary examples, INR salary estimates, real company logos, and career guides.

## Run and build

Use Node.js 22 or later. The static site uses native JavaScript modules and fetch; no runtime CDN imports are needed.

```sh
npm start
npm run build
npm test
```

`npm start` builds the site and serves it at `http://127.0.0.1:4173`. The production build creates `frontend/dist/`. Vercel uses the build command and output directory in `vercel.json`.

The homepage contains the jobs hero, live counters, search and filters, job results, source guidance, and shared navigation/footer. Company search is at `/companies`, with the crawlable A–Z index at `/companies/all`. Home is canonical for the jobs page; the `/jobs` alias is excluded from the sitemap.

The jobs workspace supports up to eight saved searches on the current browser, shareable filter links, and a persistent comfortable/compact display preference. Saved searches reopen fresh results and do not preserve a stale page, selected detail or device-specific saved-job list. Local storage failures show a useful fallback.

Visitors can compare up to three roles across search pages. The comparison is a temporary snapshot for the current visit, with source pay periods, location, experience, skills, sponsorship and recorded verification times. It does not infer missing details or send user data to another service. Direct applications open the employer's HTTPS listing. `job-workspace.css` provides responsive tools, comparison controls and lightweight motion; reduced-motion preferences are respected.

## Project layout

The site source, assets, build scripts and tests live under `frontend/`. Run npm commands from the repository root. Direct maintenance-script commands below run from `frontend/`; research inputs remain at the repository root in `.research/`. Legacy backend utilities are kept separately and are not needed for the static build.

## Content and data

- `index.html` is the directory template. Shared navigation, footer, metadata, and guide cards are added by `scripts/build-site.mjs`.
- `scripts/site-content.mjs` contains the editorial guides and policy-page content. All public pages are generated into `dist/`.
- `data/companies.json` is the checked-in company snapshot. Each salary example has a source, role, location, and snapshot date. Company logos are served locally, with source URLs retained in the data.
- `data/exchange-rate.json` is the dated ECB reference rate obtained through Frankfurter. Source values remain unchanged in the database and snapshot. Salary displays use INR, and converted estimates do not imply an Indian job offer or take-home pay.
- `site-config.js` contains the canonical domain, public contact email, publisher ID, and existing affiliate destination.

The build generates 1,000 company profiles, an A–Z index, three guides, about/contact/privacy/terms/disclosure/methodology pages, a sitemap, robots.txt, ads.txt, and a custom 404 page. Company profiles are ordinary HTML and remain usable without JavaScript. No `JobPosting` structured data is used because these are research profiles, not verified live vacancies.

## Methodology

The collection contains 11 selected established technology employers and 989 companies drawn from active/public YC employer profiles with published annual USD salaries. It is concentrated in the US and YC ecosystem, not a definitive world top-1,000 ranking. Tiers use the midpoint of one sampled role's original USD salary and do not control for geography or seniority. Equity and bonus are not assigned invented values.

The public `/methodology` page and each company page explain these limits. Source data: employer career pages, [YC company profiles](https://www.ycombinator.com/companies), and the [YC data mirror](https://devasheeshg.github.io/yc-api/). Logos identify their respective owners. Google Fonts are served locally with their OFL licenses in `assets/fonts/`.

For a data refresh, download the public mirror into `.research/yc.json`, review featured salary records, then run `npm run build:data`, `node scripts/cache-logos.mjs`, and the build/tests. The optional `scripts/discover-careers.mjs` inspects employer-provided career links. Review changed records and update snapshot dates only after refreshing the corresponding data. The raw research files are excluded from Git and deployment.

## Ads, consent, and search

The existing AdSense publisher ID is retained. Google's European regulations message for wilsy.in was observed as Published on 12 September 2026. The footer integrates Google's `showRevocationMessage` API with a privacy-page fallback; it is not a custom consent platform. Ads are not added to the 404 page. There are no fabricated ad slot IDs or empty advertisement placeholders.

The Amazon link is marked `rel="sponsored"` and has an adjacent affiliate disclosure. No purchase events or affiliate conversions are generated by this site.

AdSense review, ad density, Auto ads exclusions, regional privacy configuration, and Search Console verification remain account-level settings. A sitemap is available at `https://www.wilsy.in/sitemap.xml`; it has not been submitted automatically. No implementation guarantees approval, indexing, rankings, or revenue.

Tests cover data uniqueness and source fields, all local logos, salary tier boundaries, filter/sort/pagination behaviour, safe rendering, every generated internal link, page metadata, sitemap coverage, and currency conversion consistency.

## Live jobs and Supabase

The existing `wilsy-jobs` project is `pnkthqatdlozrojwefnc`. `supabase-config.js` holds its existing public anon credential for compatibility. It is intentionally public; never replace it with a service-role or secret key. Website traffic only needs read access. `data-client.js` uses the REST API directly.

The integration extends the existing database; it does not replace its schema or collectors. The migration in `supabase/migrations/` was created through the Supabase CLI and applied to the existing project through the authenticated SQL editor. It adds an RLS-preserving `security_invoker` view and two read-only search/facet functions. It also removes the previous anonymous company-insert policy and write grants. Original company rows were compared field-for-field with the checked-in snapshot: all 1,000 are unchanged.

- Search, filtering and pagination happen in Postgres, in batches of 20. The jobs view excludes closed, expired and past-deadline roles and preserves existing published-row RLS.
- The view explicitly selects public job fields; raw ingestion payloads and metadata are not returned. Private watchlists and ingestion logs retain RLS with no public policies.
- Filters include roles, workplace, company, country including secondary locations, career stage, skills, experience, disclosed compensation, visa and relocation. Missing information is not inferred. Minimum salary filters take INR and compare both INR amounts and converted USD amounts. Pay periods must be explicit or unambiguously stated in the salary text.
- Employer posting dates and discovery dates stay separate. Date-only timestamps never qualify for “Last hour.” “Today” uses UTC. “Recently found” sorts by discovery; employer-date sorting puts unknown posting dates last.
- Job details reload their current record before showing an application link. Saved job IDs stay in device-local browser storage. `?job=ID` shares a detail view. Closed saved roles are excluded from results.
- Live listings refresh on demand, every five minutes while the page is visible, and when a stale tab is resumed. This is frontend refresh, not a collector schedule.
- Company directory reads are paginated from Supabase, with the original local snapshot as a labelled outage fallback. Collectors also store partial company records in the same table, so the directory requests only rows with an id, salary and tier (the 1,000 reviewed profiles). Collectors also update reviewed profiles (for example ATS metadata, refreshed check dates, and renames), so `verify-jobs-api.mjs` requires each reviewed company to be present and renderable and reports how many differ from the checked-in snapshot, rather than requiring exact equality. Company profile HTML and the compact logo index are still generated from `data/companies.json`; update the reviewed snapshot and redeploy to change those static profiles.

Run `node scripts/verify-jobs-api.mjs` for read-only checks against the real database. It verifies pagination, filters, job-detail access, safe public fields, and exact preservation of the company collection. Normal `npm test` remains offline.

### Collector ownership and observed state

On 12 September 2026, the database contained 186 publicly visible jobs across 62 hiring companies. Ingestion logs contained recent successful **11K Company Hourly Watch** and **Hourly Global Job Radar** runs. The project has `pg_cron` and `pg_net`, but `cron.job` had no scheduled entries at inspection; collection is being orchestrated outside this website checkout. This change reuses that pipeline and does not create duplicate schedules or claim verified round-the-clock coverage.

The watchlist is not the same as verified hiring coverage. Additional local company-batch generators contain synthetic names. Those files and watchlist records were preserved, not republished as verified employers. Public counts come from current published job rows. Employer-verification badges appear only where the database explicitly marks the employer verified.

Supabase advisors were inspected after the original jobs integration: no error/warning entries were shown. Informational findings concerned intentionally private RLS tables with no public policies and unused indexes in the new database; those protections and indexes were retained.

## INR display and shared contact

The public contact address is `contact@wilsy.in`, configured in `site-config.js` and used by all generated pages and job correction links. The site displays company salaries, tiers, job pay, and compensation examples in INR. `usdTextToInr` also converts dollar amounts embedded in salary-role titles and compensation text. Original employer amounts are retained in Supabase and the data snapshot. Non-salary company descriptions remain source text.

The INR search migration adds an invoker helper for explicit pay-period normalisation and extends the existing read-only search function. Conversions use the same dated reference rate as the UI; monthly and annual amounts are never silently combined. Unknown or ambiguous periods are excluded when a period filter is selected.

`polish.css` provides the shared layout refinements, responsive navigation, clearer salary panels, compact Jobs header, and mobile filter controls.


## Electric-blue UI and hackathons

The shared theme is electric blue and white, with authentic company logos retained. The home page connects Jobs, Hackathons and the company directory. All 1,014 indexable pages share responsive navigation, contact links and the theme.

'/hackathons' reads the existing worker-owned tables through an RLS-preserving public view and search/facet functions. Only live/published events with a recorded verification and HTTPS registration/organizer link are public. Prizes require a public parent event; raw source payloads, metadata and ingestion logs remain private. The migration '20260912110519_wilsy_public_hackathon_search.sql' has been applied. Transaction-only positive and negative RLS checks passed and all fixtures were rolled back.

Events support format, country, theme, team, deadline, cash-prize and saved filters; detail views contain source dates, eligibility and separate prize breakdowns. Missing prizes are labelled undisclosed. USD prizes use the dated INR conversion; other currencies remain as published. Expired registration dates show organizer guidance instead of an active-registration prompt. No sample events are inserted into production. The public feed was empty at initial integration; it populates as the existing worker publishes eligible events. The user reports Worker B runs hourly at :12; this release does not create or independently validate that schedule.

Automatic refresh preserves drafts and existing results, pauses while editing or viewing details, and keeps the previous results labelled if refreshing fails. Detail descriptions retain paragraphs and lists as escaped text. Clipboard failures and dialog focus return are handled. Motion respects reduced-motion preferences. The homepage's employer preview uses six existing local brand assets linked to their profiles. Saving a job or hackathon shows a dismissible confirmation and a shortcut to saved items; its dismissal timer pauses while hovered or focused. Active filters use readable date, period and INR labels.

Validation: 'npm test' covers 29 offline checks. Read-only hackathon checks are available with 'node scripts/verify-hackathons-api.mjs'. Local DOM integration checks exercise actual data loading plus isolated fixtures for saved events, details, INR prizes, unsafe source text, and outage recovery.

### Brand and layout refinement

The shared header and footer use a single typographic Wilsy wordmark: an electric-blue W and black ilsy in the same typeface. The favicon uses a simple blue W. Decorative arrow/code tiles and placeholder company initials have been removed. Save, Refresh, Close and pagination controls use plain text; functional search and filter icons remain. `refined.css` aligns headings, cards, forms and details across desktop and mobile layouts.

Hackathon cards and detail views use original artwork from the event's published source page. `data/hackathon-branding.json` records the source URL and image URL for every local asset. On 13 September 2026, 35 of 36 public events had source artwork available, totalling about 1 MB. The remaining event's Devpost page returned HTTP 410 and receives a text-only layout. New or unmatched events also stay text-only until artwork is sourced. Failed images are removed, with no invented replacement. Source URLs must match the event before an indexed asset is displayed.

Run `node scripts/cache-hackathon-branding.mjs`, review the asset and manifest changes, then rebuild and deploy to refresh event artwork. This reads public event data and source pages; it does not mutate database records. Assets are source-provided thumbnails where available and are not recolored or recreated.

### Responsive wordmark and lightweight motion

The blue W now forms the first letter of the wordmark, followed by black `ilsy`, with no duplicated W. Header and footer gutters match. Homepage collection text has stronger contrast, small-screen detail actions use a full-width application/registration button, and mobile controls have comfortable tap areas. Duplicate hackathon format/location tags are removed.

Native IntersectionObserver and Web Animations add one-time reveals to editorial sections. Content remains visible without JavaScript. CSS coordinates brief result entrances, pointer-aware hover and press feedback, mobile menus, saved-state feedback, and dialog/backdrop transitions. Movement uses opacity and transforms, with no animation library, scroll listener, extra image, or production dependency. Reduced-motion preferences disable animation and smooth scrolling; changing that preference or hiding the tab cancels active section reveals.

Company-logo wrappers no longer inherit badge padding. Fixed, non-shrinking image frames use contain sizing, with room around each mark in cards and detail views.

On 13 September 2026, browser layout inspection covered widths of 320, 360, 390, 768, 820, 1024, 1280, 1440 and 1920 pixels, with 55 checks across Home, Jobs, Hackathons, company profiles, A–Z companies, Contact and career guides. No horizontal overflow remained. Populated cards, mobile menus, dialog actions, event artwork, and header/footer alignment were inspected. These are responsive checks in the available Chromium browser on Windows; they are not physical-device tests on macOS, Safari, iOS or Android.

On 14 September 2026, the revised job logo was checked at 320, 390, 768 and 1440 pixels, including Google in the card and detail flow. Mobile event details and navigation were inspected. All 29 offline checks and the Jobs/Hackathons DOM interaction checks passed. If a job-detail refresh fails, already-loaded listing details remain available with a clear retry notice; a confirmed unavailable listing still shows the unavailable state.

### Job search performance

The collection grew to 3,354 public jobs during an earlier UI release, and broad full-text searches began exceeding the statement timeout. `20260915120000_optimize_job_search.sql` avoided the timeout by dropping job descriptions from search, but it also reverted the INR salary filter, so `verify-jobs-api.mjs` reports converted INR minimums as failing.

`20261102120000_wilsy_indexed_job_search.sql` replaces it. A generated `jobs.search_vector` column (title weighted A; company, skills and tech stack B; first 20,000 description characters D) is computed once per row with a GIN index, so collectors keep writing `jobs` as before but must not set that column. The search function filters and counts on narrow rows and builds full job rows, including locations, only for the returned page. Facets read only the columns they need. The INR filter and description search are restored.

On 2 November 2026 the migration was tested on a local Postgres 18 copy of the schema, run as `anon`. Across 19 filter sets and two pages each, its output was byte-identical to the INR-correct 12 September function. Facets were also identical. At 8,000 seeded jobs, broad text searches took about 30 ms (pre-September: 2.6 s), the default listing 18 ms (live version: 119 ms) and facets 34 ms (177 ms). At 58,000 jobs, searches stayed between 100 and 145 ms. It was applied on 2 November 2026. The column rewrite held a lock on `jobs` for about a minute, and site searches timed out during that time. Future table changes start with `set local lock_timeout` so they fail fast instead.

Under RLS, Postgres cannot use a GIN index for `@@` because the operator is not leakproof, so `anon` searches still scanned every stored vector, and cold searches could exceed the 3-second statement timeout. `20261102130000_wilsy_job_search_use_index.sql` adds `wilsy_match_job_ids`, an owner-run lookup that uses the index and applies the same publication rules as `wilsy_public_jobs`, so it never returns draft or closed jobs. The search function still reads rows as the invoker. Locally, as `anon` with a non-superuser owner, output was identical across 26 cases and the plan used the index. It only replaces functions, so it takes no table lock. It was applied on 2 November 2026 through the Supabase connector. In production, as `anon`, cold searches that had timed out now return in 0.4–0.7 s. `20261102140000_wilsy_private_match_job_ids.sql` then moved the lookup into `wilsy_private`, a schema the REST API does not expose. `anon` can still run it through `wilsy_search_jobs` but cannot call it directly, which clears Supabase's "security definer function executable" warnings. The collector's own `wilsy_internal` schema is left untouched.

### Database size (free plan: 500 MB)

On 2 November 2026 the database was at 399 MB. `jobs` was 367 MB: 296 MB of TOAST, about 125 MB of it dead row versions, plus 56 MB of raw ATS payloads and 79 MB of search vectors.

- `20261102160000_worker_d_skip_unchanged.sql` patches the live `wilsy_internal.worker_d_run` with exact, count-checked text replacements. A job is rewritten only when a visible field changes, when it reopens, or every 12 hours to refresh `last_seen_at`. New raw payloads are stored as `{}`. Before (version 3.0), each run rewrote every job it saw (about 4,600 rows an hour). Rolled-back production tests exercised the skip, update, refresh and re-insert paths.
- `20261102170000_search_vector_5000_chars.sql` indexes the first 5,000 description characters (median 7,250). Search vectors shrank from 79 MB to 50 MB. Titles, companies and skills remain fully indexed. Trade-off: terms that appear only late in long descriptions no longer match (for example, "kubernetes" went from 646 to 473 matches).
- Existing raw payloads on 9,301 jobs (about 56 MB) are kept by decision; new and updated jobs no longer store them.
- Dead row versions are reclaimed only by `vacuum full`, which locks `jobs` while it runs. A one-off pg_cron job, `wilsy-compact-jobs-once`, runs `vacuum (full, analyze) public.jobs` at 21:30 UTC on 2 November (03:00 IST). `wilsy-compact-jobs-cleanup` unschedules both jobs at 21:45. Scheduled jobs inherit the global 2-minute `statement_timeout`, which also bounds any lock wait; if compaction needs longer, it is cancelled with no change.
- Side effect found and fixed: once `search_vector` existed, Worker D 3.0's hourly rewrite of about 4,600 rows exceeded the 2-minute timeout at 15:36 UTC, and that run rolled back. Version 3.1 skips unchanged rows.

## Job collection

### What exists

- **Worker D** (in Postgres): `wilsy_internal.worker_d_run(80)`, scheduled by pg_cron at :36 every hour. It reads Greenhouse and Ashby boards for verified watchlist rows, 80 companies per run, one request at a time.
- **Watchlist reality** (2 November 2026): `company_watchlist_11k` has 11,000 rows. 8,977 are `LEGACY_UNRESOLVED_…` placeholders and about 905 are generator-made names ("Iron LLC", "Beta Hub 240"), which leaves about 1,100 real companies. Before discovery, only 95 had a readable board.

### Collector code (`collectors/`, no dependencies)

- `ats.mjs`: link patterns and light API reads for Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Recruitee. Workday, Dover, Rippling, Gem, BambooHR and Work at a Startup links are recognised and recorded but cannot be read yet. Also detects placeholder and generated names.
- `discover.mjs`: finds each reviewed directory company's board. It tries the careers link first, then the company's own careers pages, and confirms every board through the service's API. A page linking to more than three boards is ambiguous. Boards found only by guessing a name are always `probable` and never applied automatically. Placeholder and generated names are skipped without any requests.
- `public.wilsy_apply_discovery(results)` (service role only, `20261102180000`) matches results by official domain, then normalised name. It sets a board when none exists, replaces a board only after two or more consecutive failed checks, never overwrites a working board, and only records probable or ambiguous results. A rolled-back production test confirmed each path.
- `boards.mjs`: full readers for the six services. They produce plain text with paragraph breaks (Greenhouse returns entity-escaped HTML, which Worker D stored as escaped markup), salary ranges where the source provides them (Ashby, Lever, Recruitee), Greenhouse first-published dates, internship detection and workplace type. Apply URLs follow Worker D's format because `apply_url` is the unique key.
- `public.wilsy_ingest_board(board)` (service role only, `20261102190000`) applies Worker D 3.1's rules (technical roles only; rewrite only on visible change, reopening or a 12-hour sighting refresh) and adds salary fields. It rejects a board that does not match its watchlist row. Calls carry at most 50 jobs, and a final call with the board's complete `live_urls` closes roles that disappeared. A rolled-back production test with a real Ashby board updated 2 rows with salaries, left them unchanged on a repeat call, and rejected a mismatched board.
- `collect.mjs`: one agent. It reads its shard (`master_rank % shards`) of verified, readable boards, ingests them in chunks, and logs a `job_ingestion_runs` row (`Wilsy collector fleet`).

### Schedules

- `collect-jobs.yml`: 10 agents (matrix shards 0–9) every hour at :07.
- `collect-hackathons.yml`: every hour at :23.
- `discover-boards.yml`: weekly discovery, kept as an artifact.
- `daily-snapshot.yml`: once a day at 01:41 UTC (07:11 IST). Refreshes the homepage job snapshot and the government notices, then commits both.

GitHub's own cron started the hourly collectors up to 14 hours late, so they are started from the database instead. pg_cron jobs `wilsy-dispatch-collect-jobs` (:07), `wilsy-dispatch-collect-hackathons` (:23), `wilsy-dispatch-live-checks` (:50) and `wilsy-dispatch-daily-snapshot` (01:41 UTC) call `wilsy_private.dispatch_workflow(...)` (`20261112020000`), which sends a `workflow_dispatch` request to GitHub using a fine-grained token stored in Vault as `github_dispatch_token` (Wilsy only, Actions: read and write). A 204 in `net._http_response` means GitHub accepted it; a 403 means the token lost that permission or expired. To replace the token:

```sql
select vault.update_secret((select id from vault.secrets where name = 'github_dispatch_token'), '<new token>');
```

Both write only when the `SUPABASE_SERVICE_ROLE_KEY` repository secret exists; until then they exit without writing. Once the fleet's runs are confirmed in `job_ingestion_runs`, unschedule Worker D (`select cron.unschedule('wilsy-worker-d-internal')`) so each board is read by one collector.

`npm test` runs the collector tests (`collectors/tests`) after the site tests.

## Hackathon collection

The original hackathon worker ("Daily Deep Job + Hackathon Research") last ran on 13 September 2026. `collectors/hackathons.mjs` replaces it and runs hourly at :23 (`.github/workflows/collect-hackathons.yml`, started by pg_cron as described under Schedules).

- **Sources.** Unstop's listing API (its robots.txt explicitly allows `/api/public/*`) and Devfolio's open-registration search (robots.txt allows all paths; no anti-automation clause in its terms). Devpost is not read because its terms forbid scraping, and MLH is not read because its terms forbid commercial reuse.
- **Stored.** Event facts only: title, organiser, description, dates, location, team size, themes, skills and prizes. Participant lists, judges, contact e-mails and raw payloads are never stored.
- **Matching.** The tables have no unique keys, so events are matched by source and the source's own event ID (older Unstop rows by the ID at the end of their URL).
- **Closing.** Events past their registration deadline or end date are closed, whatever their source. Events no longer listed are closed only when their source was read successfully and returned events; a failed or empty read closes nothing.
- **Monitoring.** Each run writes a `hackathon_ingestion_runs` row (`Wilsy hackathon collector`) and a run summary. Live checks fail when the newest verified event is older than eight hours (`MAX_HACKATHON_AGE_HOURS`).
- New events show without artwork until `scripts/cache-hackathon-branding.mjs` is run for them.

## Government notices

`frontend/data/government-jobs.json` is refreshed every morning by `collectors/government.mjs`, a step of the daily snapshot workflow.

- **Sources.** ISRO's current opportunities page, which covers ISRO centres and the Department of Space, and BARC's new vacancies page. Both are static official pages. ISRO publishes no robots.txt, and BARC's disallows only `/cgi-bin/`. Portals that need a login, show a bot check or have no static listing (UPSC ORA, RBI, India Post, SSC, NCS) are not read; they stay as hub links.
- **Adding.** A notice is added when its official page says it is open and prints a last date that has not passed. Its pay, eligibility and grade fields point readers to the official notice instead of guessing.
- **Curated rows.** Rows written by hand keep their wording. Use this for notices whose last date appears only in the PDF, such as Department of Space deputation calls. The run log lists any open notice it could not date, so it can be added by hand.
- **Removing.** A row leaves the snapshot when its deadline passes, when its ISRO page no longer says Open, or when the official list it came from drops it. A source that fails to load changes none of its rows. If neither source loads, the file is left untouched and the run shows a warning, without holding back the job snapshot.
- Run it by hand with `node collectors/government.mjs`.

## Accounts and sync

Accounts are optional. The header's **Sign in** button (`js/account.js`) opens a dialog. Sign-in uses a one-time email code or link, or Google once that provider is enabled; there are no passwords. `js/auth-client.js` is a small dependency-free Supabase Auth client. Email links and Google use PKCE, so tokens never appear in URLs, and the session is stored under `wilsy-auth`.

`20261102150000_wilsy_accounts.sql` adds `user_saved_items` (saved jobs and hackathons) and `user_saved_searches` (with an `alert` of `off`, `daily` or `weekly`). RLS restricts every row to its owner, `anon` has no access, signed-in users can update only `alert`, and triggers enforce the website's limits (500 items of each kind, eight searches). Before it was applied, a rolled-back run against production checked two-user isolation, cross-user writes, the column grant, both limits and `anon` denial; all nine checks passed.

`js/account-sync.js` uses a three-way merge between the last synced snapshot (`wilsy-sync-state`), this browser and the account. Local edits since the last sync win, so a first sign-in adds the device's saves to the account. Everything else follows the account, so removals on another device reach this one. Sync runs at sign-in, on page load, after every save (pages call `announceSaved()`), when a tab becomes visible, and when the browser comes back online. Changed lists are re-announced as `storage` events, so open pages refresh through their existing listeners. Signing out removes the account's copy from the browser and keeps it in the account.

**Dashboard settings required (Supabase → Authentication):**
- **URL Configuration:** Site URL `https://www.wilsy.in`. Redirect URLs `https://www.wilsy.in/**`, `https://wilsy.in/**`, `http://127.0.0.1:4173/**`.
- **Email Templates:** add the code to both *Magic Link* and *Confirm signup*, for example `<p>Your WILSY sign-in code: <strong>{{ .Token }}</strong></p>`, alongside the existing link. Without it, sign-in works by link only.
- **SMTP:** the built-in sender allows only a few emails per hour. Use a custom SMTP provider (Resend) before launch.
- **Google:** add an OAuth client under Providers → Google. The Google button appears automatically once it is enabled.

Alert preferences are stored now. The daily and weekly digest sender is not built yet; it needs the email provider above. The account dialog says so.

## Operations

- **CI** (`.github/workflows/ci.yml`) runs `npm ci`, the build and the offline tests on every push to `main` and on pull requests.
- **Live checks** (`.github/workflows/live-checks.yml`) run every three hours and on demand. They make read-only calls with the public key: `check-freshness.mjs` fails when the newest public job was found more than six hours ago (`MAX_JOB_AGE_HOURS`), followed by `verify-jobs-api.mjs` and `verify-hackathons-api.mjs`. GitHub emails the repository owner when a scheduled run fails.
- **Analytics.** Vercel builds (`VERCEL` set) add Vercel Web Analytics to every page. It is cookie-free and counts page views without cross-site tracking; the privacy policy describes it. Enable Web Analytics for the project in the Vercel dashboard. Local and CI builds omit the tag.
