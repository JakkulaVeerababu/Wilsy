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
- Company directory reads are paginated from Supabase, with the original local snapshot as a labelled outage fallback. Company profile HTML and the compact logo index are still generated from `data/companies.json`; update the reviewed snapshot and redeploy to change those static profiles.

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

### Deferred database performance work

The collection grew to 3,354 public jobs during this UI release. Broad full-text searches can currently exceed the database's statement timeout; initial listings and structured filters use the existing API. A prepared search-index optimization was not applied after automatic approval review blocked its permission-change step. The user subsequently prioritized UI work. This is an existing backend limitation, not a completed optimization. 'verify-jobs-api.mjs' intentionally continues to report it; the website shows a recoverable search error. Existing company/source records are retained.
