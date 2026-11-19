# Analytics events

WILSY uses [Vercel Web Analytics](https://vercel.com/docs/analytics): cookie-free page views, plus the custom funnel events below. The code is in `frontend/js/analytics.js`.

## What the founders need to know

- **Plan.** Vercel records custom events only on **Pro** and **Enterprise**. On Hobby, page views still work, and these calls cost nothing because Vercel ignores them. Check: Vercel dashboard → the project → Analytics → Events. If the tab is missing or says "upgrade", the plan does not record them.
- **2 properties per event.** Pro records **2** properties per event; Web Analytics Plus and Enterprise record 8. So every event has at most 2, and the search filters are packed into one value (`filters`).
- **Cost.** On Pro, events are billed per event collected (see Vercel's [pricing page](https://vercel.com/docs/analytics/limits-and-pricing)). These events fire on deliberate actions only, never on scroll or page view.
- **Where they run.** `window.va` exists only on Vercel deployments (`analyticsTag` in `frontend/scripts/page-shell.mjs`, added to static pages and to job-page function pages). Locally and in tests, `track()` does nothing.

## Privacy rules

Events never carry personal data: no email addresses, names, job ids, account ids or anything a visitor typed. The search box text is never sent. Filter values are reduced to a short fixed list; anything else becomes `other`. Keep it that way when adding events (`eventData()` drops objects and arrays and caps strings).

## Events

| Event | When it fires | Properties (max 2) |
|---|---|---|
| `search` | The search form is submitted on the home page or on /jobs. Filter clicks are not searches. | `page`: `home` or `jobs`. `filters`: see below. |
| `job_open` | A job's details open in the /jobs dialog. | `via`: `list` (clicked in the results) or `link` (arrived with `?job=`, e.g. from the home page or a shared link). `mode`: the job's `remote`, `hybrid`, `onsite` or `unknown`. |
| `apply_click` | A visitor follows an apply link to the employer's site (click or middle-click). | `from`: `card`, `dialog`, `job_page` or `compare`. `page`: `home`, `jobs`, `job` (a /jobs/&lt;id&gt; page), `landing`, `company` or `other`. |
| `job_save` | A job is saved (not when it is removed). | `page`: `home`, `jobs` (a results card) or `dialog` (the job dialog). |
| `search_save` | "Save this search" stores a search. | `filters`: see below. |
| `sign_in` | Sign-in completes. | `method`: `email_code` (typed code), `google`, or `email_link` (the link in the sign-in email). |
| `alert_on` | A saved search's alerts go from off to daily or weekly. Changing daily to weekly is not counted. | `frequency`: `daily` or `weekly`. |
| `app_install` | The browser reports WILSY was installed as an app. | `via`: `wilsy_button` (the "Install app" entry) or `browser` (the browser's own install menu). |
| `share` | A visitor shares a job or page with the share buttons. | `via`: `whatsapp`, `copy` (copy link) or `native` (the phone's share sheet). `page`: as for `apply_click`. |
| `referral` | A visit arrives with a campus ambassador's `?ref=` link (counted once per visit; the code is then removed from the address bar). | `code`: the ambassador's code, 2–24 lowercase letters, digits and hyphens, issued by WILSY (for example `iitb-07`); it names the ambassador's link, not the visitor. `page`: as for `apply_click`. |
| `tracker_move` | A role moves to another stage on the application tracker (/tracker). | `stage`: `saved`, `applied`, `interviewing`, `offer` or `closed`. |
| `tool_use` | A visitor uses a career tool: types in the offer comparison or the resume match (once per page view), copies a referral-request message on a job page, or adds a deadline to their calendar. | `tool`: `offer_compare`, `resume_match`, `referral` or `calendar`. Nothing typed into a tool is sent. |

### The `filters` value

The role, career stage, country and workplace filters, in that fixed order, as `key:value` pairs joined by commas, or `none`:

```
role:backend,stage:fresher,country:india,mode:remote
```

- `role`: software-engineering, backend, frontend, ai-ml, genai, data, devops-cloud, cybersecurity, ece-core, vlsi, embedded, or `other`.
- `stage`: internship, fresher, new-grad, apprenticeship, or `other`.
- `country`: india, united-states, united-kingdom, canada, germany, singapore, australia, netherlands, ireland, france, united-arab-emirates, japan, or `other`.
- `mode`: remote, hybrid, onsite, or `other`.

The search text, company, skill, salary and date filters are never included.

## The funnel

1. `search` (or a landing page view, e.g. `/jobs/backend-jobs`)
2. `job_open`, or a job page view (`/jobs/<id>-…`)
3. `job_save` / `search_save`
4. `apply_click`
5. `sign_in` → `alert_on` (retention)

`app_install` and page views of `/jobs?source=pwa` (the installed app's start page) show how many people use WILSY as an app.

## How a search from the home page is counted

The home search form loads /jobs, which would cut off an event sent at that moment. So the home page puts the `search` event in `sessionStorage`, and the next page sends it. Nothing else is stored.

## Adding an event

1. Add its name to `EVENTS` in `frontend/js/analytics.js`.
2. Call `track('name', {key: 'short value'})` with at most 2 properties from a fixed list.
3. Add a row to the table above. `frontend/tests/pwa-analytics.test.mjs` fails if an event is not documented here.
