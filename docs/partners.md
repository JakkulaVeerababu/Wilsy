# Partner job feeds

Job sites whose listings WILSY collects with the owner's permission. Other aggregators are never
collected without written permission (Devpost, MLH, Internshala and others are excluded for that reason).

| Partner | Site | Permission | Collector | Schedule |
|---|---|---|---|---|
| The Job Company | https://thejobcompany.co.in | Given by the site owner to WILSY's founder in November 2026 as a collaboration. Keep the written confirmation with the founders. | `collectors/thejobcompany.mjs` | Every hour with the job collector (newest 3 listing pages; 15 pages at 01:00 UTC) |

## How partner jobs appear on WILSY

- The source shown on each job is "The Job Company", and the job's source link is its page on thejobcompany.co.in.
- Apply goes to the employer's own application link taken from the partner's Apply page; when there is none, to the partner's job page.
- Only technology roles are kept (the same filter as the job boards).
- A job that WILSY already has from the employer's own job board is not duplicated or overwritten.
- Partner jobs close when they have not been listed for three days.

## Being a good partner

- One request at a time with about a second between requests, identified as `WILSYJobsBot` with WILSY's contact address.
- Job pages are read once; later runs only read the listing pages and new jobs.
- To stop collecting, remove the `partners` job from `.github/workflows/collect-jobs.yml`; existing jobs close after three days.

Database: `public.wilsy_ingest_partner(feed jsonb)` (migration `20261117041327_wilsy_ingest_partner.sql`) writes partner jobs. Partner keys are allow-listed inside the function.
