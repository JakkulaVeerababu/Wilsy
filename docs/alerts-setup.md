# Job alert emails: switching them on

Signed-in visitors can already choose **No alerts / Daily / Weekly** for each saved search (Account
dialog). This document covers what sends those emails and what the founders must do before the
first one goes out. Nothing is sent until every step below is done and a live run is started by hand.

## What is built

| Piece | What it does |
|---|---|
| `collectors/alerts.mjs` | Reads saved searches whose alert is due, finds roles found since the last alert, renders one email per person, sends through Resend, records `last_alerted_at`. |
| `.github/workflows/send-alerts.yml` | Manual "Send job alerts" workflow. **Dry run by default.** |
| `collectors/tests/alerts.test.mjs` | Due dates, grouping, rendering and escaping, dry run, `off` never emailed, retries. Runs in `npm test`. |
| `docs/proposals/alerts.sql` | SQL for later (scheduling live runs, one-click unsubscribe). **Not applied.** |

### How a run decides what to send

- **Due:** a `daily` search is due when `last_alerted_at` is empty or more than 23 hours old; a
  `weekly` one after 6.9 days. A little early on purpose, so a run at the same time each day never
  misses by a few minutes. `off` is never due, and the script reads only `daily`/`weekly` rows.
- **New roles:** the saved search runs through the same public `wilsy_search_jobs` call, filters and
  public key the website uses, newest found first. A role counts as new when WILSY *found* it
  (`first_seen_at`, else `discovered_at`) after the last alert. A first alert looks back to when the
  search was saved, or one period (1 or 7 days), whichever is later. Roles found in the last 5
  minutes wait for the next run, so a collector write still in progress is never skipped.
- **One email per person per run**, one section per search with new roles, up to 10 roles each,
  with a "View all matches" link. Each role shows title, company, place and pay when the employer
  published it (INR as published, USD as an INR estimate at the site's reference rate, other
  currencies as published). Each role links to its own page, `https://www.wilsy.in/jobs/<id>-<slug>`:
  every live job has one, pre-built or rendered on request by `api/job-page.mjs`, and a changed title
  only redirects to the new slug. Links carry `utm_source=wilsy_alerts` so visits can be measured.
- **Footer:** why the person is getting it, "Manage alerts" (`https://www.wilsy.in/jobs?saved=1`),
  and how to stop (sign in, open Account). Replies go to `contact@wilsy.in`.
- **Who is skipped:** anyone without a confirmed email (`email_confirmed_at`), banned or anonymous
  accounts.
- **After sending**, each checked search gets `last_alerted_at` = the end of the window. A search
  with nothing new is also recorded, so the daily/weekly rhythm holds. A failed search or send
  records nothing, so it is retried next run.
- **Safety:** at most `max_emails` per run (default 100), most overdue people first. 429 and 5xx
  answers are retried up to three times, honouring `Retry-After`; sends are spaced to about two a
  second. A rejected key or a spent quota stops the run. Each email carries an `Idempotency-Key`
  tied to the state of that person's searches, so a retry or re-run never delivers the same email twice.
- **Logs are public** (the GitHub repository is public), so run logs name no address and no search
  terms: only "person 3: 2 searches, 7 roles shown" and totals.

### Database access

No schema, grant or function change is needed. Checked read-only on 14 Nov 2026: `service_role`
has `SELECT` and `UPDATE` on `public.user_saved_searches` (including `last_alerted_at`) and bypasses
RLS. Email addresses come from the Supabase Auth admin API (`/auth/v1/admin/users/<id>`) with the same
`SUPABASE_SERVICE_ROLE_KEY` secret the collectors already use. Roles come from the public search with
the public key in `frontend/js/supabase-config.js`.

## What the founders must do

### 1. Create a Resend account

Sign up at [resend.com](https://resend.com) with a founders' address. Check the current plan limits
on [resend.com/pricing](https://resend.com/pricing). When this was written the free plan allowed
3,000 emails a month and 100 a day. Keep the workflow's `max_emails` at or below the daily limit.

### 2. Verify the wilsy.in domain

1. Resend → **Domains** → **Add domain** → `wilsy.in`. Pick the region closest to most readers
   (Tokyo, `ap-northeast-1`, is the nearest to India).
2. Resend shows the DNS records to add. Add **exactly what it shows** at whoever hosts the wilsy.in DNS
   (Vercel → Domains if wilsy.in uses Vercel's nameservers, otherwise the registrar). Typically:
   - **DKIM**: a `TXT` record at `resend._domainkey` holding a public key. This signs mail as wilsy.in.
   - **SPF**: a `TXT` record `v=spf1 include:amazonses.com ~all` and an `MX` record, both on the
     `send` subdomain (Resend's bounce address). They sit on `send.wilsy.in`, so they do not touch
     any SPF record wilsy.in already has for `contact@wilsy.in`. Never add a second SPF record on
     the root domain; merge instead.
3. Add **DMARC** yourself (Resend suggests it but does not require it): a `TXT` record at `_dmarc`
   with `v=DMARC1; p=none; rua=mailto:contact@wilsy.in`. If `_dmarc.wilsy.in` already exists, keep the
   existing one. After a few weeks of clean reports, move to `p=quarantine`.
4. Press **Verify** in Resend and wait until the domain shows *Verified*. Until then Resend refuses
   to send to anyone except the account owner, and the workflow stops at the first email.

`alerts@wilsy.in` does not need a mailbox. Replies go to `contact@wilsy.in`.

### 3. Add the API key to GitHub

1. Resend → **API Keys** → **Create API key**, permission **Sending access**, domain `wilsy.in`.
2. GitHub → JakkulaVeerababu/Wilsy → **Settings → Secrets and variables → Actions → New repository
   secret**: name `RESEND_API_KEY`, value the key. Never commit it or paste it anywhere else.
   (`SUPABASE_SERVICE_ROLE_KEY` is already there for the collectors.)

### 4. Run it dry

GitHub → **Actions → Send job alerts → Run workflow**, leave **Dry run** ticked. The run summary shows
searches due, people due, how many emails *would* go out, nothing new, no confirmed email, and errors.
Nothing is sent and nothing is written. To see an email for any search without an account or key:

```bash
node collectors/alerts.mjs --preview "role=backend&country=India" --since 2026-11-13T00:00:00Z --out alert.html
```

### 5. Send for real

1. Sign in on wilsy.in with a founder's address, save a search, set it to **Daily**.
2. Dry run again and check that **People due** is only who you expect.
3. Run the workflow with **Dry run** unticked and **max_emails** at `1`–`5`. Check the email in Gmail
   and Outlook: the content, the links, and that *Show original* says SPF, DKIM and DMARC all `PASS`.
4. Then run it once a day by hand, or schedule it (below).

When alerts are live, update two pieces of site copy: the Account dialog note "Alert emails begin once
delivery is switched on" (`frontend/js/account.js`), and the privacy policy, which should name Resend as
the provider that sends alert emails (`frontend/scripts/site-content.mjs`).

### 6. Schedule it (a later Supabase change)

The collectors are started by Supabase pg_cron through `wilsy_private.dispatch_workflow`
(`supabase/migrations/20261112020000_wilsy_hourly_dispatch.sql`). That function sends no workflow inputs,
so a run it starts would be a **dry run** (the safe default). To schedule live sends,
`docs/proposals/alerts.sql` adds a separate `dispatch_workflow_with_inputs` function and a daily job at
03:30 UTC (09:00 IST) that passes `dry_run=false`. Weekly alerts need no second job: the daily run sends
each weekly search when it is due. Review that file and apply it in the Supabase SQL editor only when
steps 1–5 are done.

## Gmail and Yahoo sender rules

Since 2024 Gmail and Yahoo (and since 2025 Outlook.com) enforce rules on anyone emailing their users.

**All senders, from the first email:**
- SPF or DKIM passes (both will, after step 2), TLS and valid reverse DNS (Resend provides both).
- Spam complaints stay below 0.3%, ideally below 0.1%. Watch it in
  [Google Postmaster Tools](https://postmaster.google.com) once you verify wilsy.in there.
- Only email people who asked: alerts go only to searches set to Daily or Weekly, by confirmed addresses.

**Bulk senders (about 5,000+ emails a day to Gmail addresses; once reached, the status is permanent):**
- SPF **and** DKIM **and** DMARC (at least `p=none`), with the From domain aligned. Resend's DKIM on
  wilsy.in gives alignment.
- **One-click unsubscribe** (RFC 8058): `List-Unsubscribe: <https://…>` plus
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, an endpoint that unsubscribes on a plain POST
  with no sign-in, honoured within two days, and a visible unsubscribe link in the body.

**Today** each email has a `List-Unsubscribe` header pointing at the Manage alerts page and a stop
instruction in the footer. That is fine at today's volume but is **not** one-click. Build one-click
before alerts approach a few thousand a day:

1. **A signed token per person.** No database change needed: the token is an HMAC of the user id with
   a new secret `WILSY_UNSUBSCRIBE_SECRET` (a GitHub secret for the alert workflow, and a secret for the
   endpoint). If a revocable stored token is preferred, `docs/proposals/alerts.sql` has a table and
   function for that instead.
2. **A public HTTPS endpoint** that turns every alert for that person to `off` on `POST` (Gmail's
   one-click) and on `GET` shows a short "You're unsubscribed" page with an undo link. Gmail's POST
   carries no Supabase API key, so PostgREST cannot serve it directly. Use a Supabase Edge Function with
   JWT verification off (it already has the service key), optionally behind a Vercel rewrite so the URL
   stays on `www.wilsy.in` (for example `/alerts/unsubscribe`).
3. **alerts.mjs** then sends `List-Unsubscribe: <https://www.wilsy.in/alerts/unsubscribe?u=<id>&t=<token>>`,
   `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and an "Unsubscribe" link in the footer.
4. **Bounces and complaints:** Resend suppresses addresses that hard-bounce or complain. Also add a
   Resend webhook (`email.bounced`, `email.complained`) to the same endpoint so those people's alerts
   are switched off at WILSY too.

A smaller improvement for any time: a "Manage alerts" link that opens the Account dialog directly
(for example `/jobs?saved=1#account`) instead of the saved-jobs view.
