# WILSY Pro: assisted apply and subscription plan

Written 24 Nov 2026 from the code in this repository. Nothing here is built yet.

## The idea in one paragraph

A signed-in user gives WILSY their profile and resume once. Every new role the collectors find is matched against that profile, and the best matches reach the user each day. The user picks the ones they want, and WILSY prepares each application: a cover letter, answers to the employer's questions, and a check of which skills the resume shows. A WILSY browser extension then fills the employer's form in one click. The user reads it and presses Submit themselves. Paid users (Pro) get daily matches, AI-prepared applications and full autofill, through a Razorpay subscription.

## Product rules (do not change without a new decision)

1. **The user submits every application.** WILSY never presses Submit, never sends an application from its own servers, and never gets around a CAPTCHA or bot check. Reasons:
   - Greenhouse, Lever and Ashby accept applications through an API only with the **employer's** private key. Without it, a server would have to drive a robot browser through their forms, which their terms forbid.
   - WILSY's collectors read jobs from those same boards. If WILSY's servers were flagged for bot applications, the job feed itself could be blocked.
   - Mass applications under a user's name, with answers they never read, get users marked as spam by recruiters.
2. **AI never invents facts.** Answers are written only from the user's profile, resume and saved standard answers. A question it cannot answer from those (visa, notice period, salary, "years of X") is left blank and marked "You answer this", unless the user saved an answer for it.
3. **Resumes are stored only with explicit consent**, can be deleted at any time, and are used only to match and prepare that user's applications. They are never shown to employers except when the user applies, never sold, and never used to train models.
4. **The free on-device tools stay on-device.** Resume Match and My WILSY keep working without an account and without uploading anything. Pro is a separate, opt-in flow, so the current privacy promise for those tools stays true.

## What already exists and gets reused

| Need | Already in the repo |
|---|---|
| Sign-in | `frontend/js/auth-client.js`: Supabase Auth with email code or link, Google and GitHub, PKCE. |
| Per-user tables with RLS | `supabase/migrations/20261102150000_wilsy_accounts.sql`: the pattern of `user_id default auth.uid()`, an "own rows" policy and explicit grants. |
| Profile model | `frontend/js/my-wilsy-core.js`: `readProfile`, `canonicalSkill`, `eligibility`, `rankJobs`, `skillGaps`. Today it is kept in `localStorage` only (`PROFILE_KEY`). |
| Resume reading | `frontend/js/resume-file.js` reads PDF, DOCX and text in the browser. `resume-core.js` has `matchResume`. `resume-jobs-core.js` has `resumeYears`, `scoreJob` and `rankJobs`. |
| Skills | `frontend/js/skills-core.js`: `findSkills` and the canonical skill list. |
| Email | `collectors/alerts.mjs` sends through Resend, at most one email per person per run. `.github/workflows/send-alerts.yml` exists but is manual-only and does a dry run by default. |
| Jobs | The `public.jobs` table, filled hourly by the collectors, with `apply_url`, `ats_platform`, `description`, `first_seen_at`, `status` and `closed_at`. |
| Server code | Vercel functions in `api/` (`job-page.mjs`, `search.mjs`), with `maxDuration` set in `vercel.json`. |

## Database (new migration: `supabase/migrations/2026112xxxxxxx_wilsy_pro.sql`)

Same style as the accounts migration: RLS on, "own rows" policies, explicit grants, and limits enforced by triggers.

- **`user_profiles`**: one row per user.
  - Columns:
    - `user_id` (primary key)
    - `full_name`, `phone`, `city`, `country`, `links` (jsonb: LinkedIn, GitHub, portfolio)
    - `degree`, `grad_year`, `cgpa`, `years_experience`, `skills` (text[])
    - `work_authorization`, `notice_period`, `expected_ctc`, `willing_to_relocate`
    - `standard_answers` (jsonb: question to answer, at most 30)
    - `resume_path`, `resume_text` (plain text for matching, capped at 30,000 characters like `RESUME_MAX`)
    - `consent_at`, `updated_at`
  - Users can select, insert, update and delete their own row.
- **Storage bucket `resumes`** (private). The path is `{user_id}/resume.pdf`, and a storage policy allows a user only their own folder. Limit uploads to 5 MB (the same as `RESUME_FILE_MAX`), PDF and DOCX only.
- **`user_job_matches`**: `user_id`, `job_id`, `score`, `reasons` (jsonb: matched and missing skills, eligibility), `created_at`, `state` (`new`, `queued`, `dismissed`).
  - Only the service role inserts (the matcher).
  - Users can select their own rows and update `state`.
  - Old `new`/`dismissed` rows are pruned after 30 days.
- **`user_applications`**: `id`, `user_id`, `job_id`, `status` (`queued`, `ready`, `applied`, `interview`, `offer`, `rejected`, `withdrawn`), `cover_letter`, `answers` (jsonb), `prepared_at`, `prepared_model`, `applied_at`, `notes`, `updated_at`.
  - Users manage their own rows, but AI columns (`cover_letter`, `answers`, `prepared_at`, `prepared_model`) are written only by the server, using column grants like the existing `grant update (alert)`.
  - A user can edit the AI text through a separate `edited_answers` column.
- **`subscriptions`**: `user_id` (primary key), `plan` (`free`, `pro`), `status` (`active`, `pending`, `halted`, `cancelled`, `completed`), `razorpay_subscription_id`, `current_period_end`, `cancel_at_period_end`, `updated_at`.
  - Users can only select their own row. Only the billing webhook writes.
- **`billing_events`**: Razorpay event id (primary key, for idempotency), `event`, `received_at`, `payload`. Service role only.
- **Function `wilsy_private.is_pro(uid)`**: true when the plan is `pro`, the status is active, and `current_period_end` is in the future. Used by policies, the matcher and the API.
- **Function `wilsy_private.ai_prepares_this_month(uid)`**: counts `prepared_at` in the current month, for the quota.

## Server endpoints (Vercel functions in `api/`)

Every endpoint that acts for a user reads the Supabase access token from `Authorization: Bearer`, checks it with `GET {SUPABASE_URL}/auth/v1/user`, and uses that user id. Secrets live only in Vercel environment variables: `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `ANTHROPIC_API_KEY`. Pure logic goes in small `*-core.mjs` modules with injectable `fetch`, so `node --test` can cover it the way the rest of the repo is tested.

| Endpoint | Does |
|---|---|
| `POST /api/billing/subscribe` | Creates a Razorpay subscription for the Pro plan id, with `notes.user_id`, and returns `subscription_id` for Razorpay Checkout. Refuses if the user already has an active subscription. |
| `POST /api/billing/verify` | Checks the Checkout signature (HMAC-SHA256 of `payment_id|subscription_id` with the key secret) and marks the row `pending`. The webhook is what turns Pro on. |
| `POST /api/billing/webhook` | Checks `X-Razorpay-Signature` (HMAC-SHA256 of the raw body with the webhook secret) and skips repeated event ids. It handles `subscription.activated`, `.charged`, `.pending`, `.halted`, `.cancelled` and `.completed`, updating `subscriptions`. |
| `POST /api/billing/cancel` | Cancels at the end of the paid period. |
| `POST /api/prepare` | `{job_id}`. Checks Pro and the monthly quota, loads the profile and job, calls Claude, and stores the cover letter and answers on the user's application row. Rate-limited per user. |
| `POST /api/account/delete` | Deletes the resume file, profile, matches, applications and the auth user, and cancels any subscription first. Today deletion is "email us"; with resumes stored, it should be self-service. |

`vercel.json` additions:
- function entries with `maxDuration`: about 60 s for `prepare` (check the Vercel plan's limit) and 10 s for the rest;
- add `@anthropic-ai/sdk` to `package.json`.

The current `Permissions-Policy: payment=()` header may block parts of Razorpay Checkout. Test Checkout in test mode and, if needed, allow payment for Razorpay's origin on the pricing page only.

## AI preparation (`api/prepare.mjs`)

- **SDK and model.** Use the official `@anthropic-ai/sdk` with model `claude-opus-5-5`, effort set explicitly (`low` to start; this model cannot turn thinking off).
- **Refusals.** Enable server-side refusal fallbacks (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) and check `stop_reason` before reading the answer.
- **Structured output.** Use structured output (`output_config.format` with a JSON schema): `cover_letter`, plus `answers[]` with `question`, `answer`, `source` (`profile`, `resume`, `standard_answer` or `user_must_answer`) and `confidence`.
- **Prompt.**
  - The system prompt holds product rule 2, which is cached because it never changes.
  - The user message holds the profile, resume text and job description (capped, for example the first 8,000 characters), plus the employer's questions when the extension sends them.
- **Logs.** Store `prepared_model` and token usage for cost tracking. Never log resume text or answers.
- **Rough cost per prepared application.** Assumes about 7,000 input and 2,500 output tokens, at ₹95.56 per US dollar (the rate in `frontend/data/exchange-rate.json`).

  | Model | Per application | 60 applications |
  |---|---|---|
  | Claude Opus 5.5 | about ₹7.5 | about ₹450 |
  | Claude Sonnet 5.5 | about ₹3.7 | about ₹225 |
  | Claude Haiku 5.5 | about ₹0.2 | about ₹11 |

  Measure real usage on 20 real job descriptions before setting the price and quota. Which model to use is the owner's decision (see Decisions).

## Matching (`collectors/match.mjs` + workflow)

- Runs after the hourly job collection, or once a day to start. It reads jobs first seen since the last run that are still open.
- It reads Pro profiles with the service role and, for each user, scores the new jobs with the existing `scoreJob`/`rankJobs` and `eligibility`. It inserts the top matches (for example 20 a day) into `user_job_matches`.
- Free users get matched weekly, top 10, in the same run.
- Same safety style as `alerts.mjs`: dry run by default, and logs never name a person, email or skill, because this repository's Actions logs are public.
- **Daily email.** "N new matches for you" uses the Resend path in `alerts.mjs`. Resend's free plan allows 100 emails a day (the code already caps at that), so the paid Resend plan is needed after about 100 active users. `send-alerts.yml` also needs a schedule (today it is manual only).

## Pages (built by `frontend/scripts/*`, `noindex` for account pages)

- **`/pricing`**: Free vs Pro, the price, what is included, the AI quota, and links to the refund and cancellation policy.
- **`/profile`**: the profile form (prefilled from the on-device My WILSY profile if there is one), resume upload, standard answers, a consent checkbox with a link to the privacy section, "Download my data" and "Delete my data".
- **`/applications`**: three tabs.
  - **Matches**: new matches with score and reasons, plus Queue and Dismiss.
  - **Queue**: Prepare with AI (Pro), edit answers, Open application, and a "Mark as applied" button.
  - **Tracker**: status columns.
- **Account panel**: plan, renewal date, Cancel, and "Install the extension".
- **Policy pages**:
  - a new `/refund-policy`;
  - `/privacy`: a new "WILSY Pro" section on stored profiles and resumes, AI processing by Anthropic, retention, and self-service deletion. The current line "does not require an account or collect résumés" changes to say that free tools still don't, and Pro stores them only with consent;
  - `/terms`: subscription terms, renewal, cancellation, and that the user is responsible for what they submit.

Pure logic goes in `frontend/js/pro-core.js`, `applications-core.js` and `billing-core.js`, with tests in `frontend/tests/`.

## Browser extension (`extension/`, Chrome Manifest V3)

- **Popup**: sign in with the same email code flow, show the plan, and show "Fill this application" on supported pages.
- **Content scripts, only on**: `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co` and `jobs.ashbyhq.com`. Workday (`*.myworkdayjobs.com`) comes later, because its forms are multi-step and need a per-company account.
- **Filling.**
  - The extension matches form labels to profile fields (name, email, phone, links, education, location) and attaches the resume from the private bucket through a short-lived signed URL.
  - For custom questions it looks up the prepared answers for this job (found by `apply_url`) and fills them. Anything marked `user_must_answer` is highlighted, not filled.
- **It never clicks Submit.** A banner says "Check every answer, then press Submit." After the page changes, the extension asks "Did you submit?" and marks the application `applied`.
- **Permissions**: only those host patterns plus the Supabase project. No browsing history, and no reading of other sites.
- **Chrome Web Store**: needs a $5 developer account, the privacy policy, the data-use disclosure, and a review that can take days.

## Order of work

Effort: S = under half a day, M = about a day, L = several days.

| Phase | What | Effort | Done when |
|---|---|---|---|
| 0 | Owner decisions and accounts (below). Draft the refund, privacy and terms changes. | owner | Razorpay test keys exist; plan and price are chosen. |
| 1 | Profile and resume in the account: migration (`user_profiles`, bucket, policies), `/profile`, consent, download and delete. | M | A user can save, edit, download and delete their profile and resume; RLS tests show user A cannot read user B. |
| 2 | Matches and tracker: `user_job_matches`, `user_applications`, `collectors/match.mjs` and its workflow, the match email, `/applications`. | M–L | Dry run lists sensible matches for test profiles; the email preview renders; tracker states persist. |
| 3 | Subscription: `subscriptions`, `billing_events`, `api/billing/*`, `/pricing`, account panel, `is_pro` gating. | M–L | In Razorpay test mode, subscribe, renew, payment failure, cancel and resubscribe all give the right plan state, and replayed webhooks change nothing. |
| 4 | AI preparation: `api/prepare.mjs`, quota, editing, guardrails. | M | On 20 real job descriptions no answer states a fact missing from the profile, and the cost per application has been measured. |
| 5 | Extension for Greenhouse, Lever and Ashby, then Chrome Web Store review. | L | It fills test forms on each board correctly, never submits, and is published. |
| 6 | Later: "Easy Apply on WILSY" for jobs that partners or employers post directly, with applications going to an employer inbox on WILSY. The Job Company (`collectors/thejobcompany.mjs`) is a natural first partner. | L | Needs an employer side; plan separately. |

Pro can launch after phase 4, sold as daily matches, AI-prepared applications and the tracker. The extension adds autofill when it passes review.

## Decisions for the owner

1. **Plans and price.** For example, Free: weekly matches, tracker, profile. Pro: daily matches, AI preparation up to N per month, autofill. Monthly price, and whether to offer a quarterly or yearly plan.
2. **AI model for preparation.** Opus 5.5 gives the best writing at about ₹7.5 per application. Sonnet 5.5 is about half that, and Haiku 5.5 is about ₹0.2. Compare quality on the same 20 job descriptions before choosing. The quota and the price must cover the model's cost.
3. **Refund rule.** For example, a full refund within 7 days if no AI preparations were used.

## Accounts and checks only the owner can do

- **Razorpay account and KYC.** Razorpay reviews the website: pricing, terms, privacy, refund and cancellation, and contact details must be live. Subscriptions must be enabled on the account. Ask a CA about GST on subscription income.
- **Anthropic API key**, with a monthly spend limit set in the Console.
- **Vercel plan.** The free Hobby plan is for non-commercial use, and paid subscriptions are commercial. Check this and move to Pro if needed.
- **Resend.** The paid plan is needed once daily match emails exceed 100 a day.
- **Supabase plan.** The free plan includes 1 GB of file storage, roughly 5,000 resumes at 200 KB each. Upgrade before that.
- **Chrome Web Store developer account** (one-time $5).
- **India's DPDP Act 2023 and its Rules.** Clear consent notice, purpose, retention period, a grievance contact, self-service deletion, and reasonable security. Get the privacy text reviewed if possible.

## Risks to watch

- **Match quality.** Sending poor matches makes users unsubscribe. Start with strict eligibility (degree, graduation year, experience range) and the high-chance band only.
- **AI mistakes under the user's name.** Rule 2, plus review in the extension, plus a "Report a bad answer" button.
- **Board changes.** Greenhouse, Lever and Ashby change their form markup, so keep extension selectors in one file per board, with fixtures and tests.
- **Cost overrun.** Enforce the per-user quota on the server, alert on daily token spend, and set the Anthropic spend limit.
- **Data breach.** Keep the bucket private, use short-lived signed URLs, keep the service role key out of the browser and the extension, and keep logs free of personal data.
