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

Approved scope: items 1–9. Built locally in separate commits; not deployed yet.

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
