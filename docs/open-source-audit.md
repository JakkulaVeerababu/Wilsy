# Open-source job tools: what WILSY uses, learns from, or avoids

Checked on 27 Nov 2026 with the GitHub API (licence, stars, last push). 64 repositories were suggested; 63 exist.
"ximang/open-resume" does not exist: the real OpenResume is `xitanggg/open-resume` (AGPL-3.0).

Rules WILSY follows (see also `docs/wilsy-pro-plan.md`):

1. **Licences.** MIT, Apache-2.0, BSD and CC0 code may be reused with credit. AGPL and GPL code is never copied:
   it would force WILSY's own code open. Repositories with no licence, or a non-standard one ("NOASSERTION"),
   are all rights reserved: ideas only, no code.
2. **No auto-apply bots and no LinkedIn, Indeed or Glassdoor scraping.** Their terms forbid it, recruiters mark
   mass applications as spam, and WILSY's own job collection could be blocked. The user submits every application.
3. **No getting around bot protection** (Cloudflare challenges, CAPTCHAs).

## Used now

| Repository | Licence | Stars | What WILSY takes |
|---|---|---|---|
| [colophon-group/jobseek](https://github.com/colophon-group/jobseek) | MIT | 234 | Its list of 8,307 company job boards (`apps/crawler/data/boards.csv`). About 4,060 are on platforms WILSY already reads (Greenhouse 2,571, Ashby 937, Lever 200, SmartRecruiters 149, Recruitee 119, Workable 84), and 550 are on Workday. To be imported once the jobs database has room (the move to Heroku Postgres). Credit in the import script. |
| [ai-job-search-dev/ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) | MIT | 73,686 | Its job-evaluation rules (eligibility and language gates before scoring, separate scores per dimension) power the **job fit check** on `/resume-match`, and its "echo traps" rules power the **copy check** (`/copy-check`). Rewritten in WILSY's own code; credited on both pages. |

## Learn from next (MIT or Apache-2.0)

| Repository | Licence | Stars | Idea for WILSY |
|---|---|---|---|
| [career-ops-hq/career-ops](https://github.com/career-ops-hq/career-ops) | MIT | 85,155 | Repost detection (a job re-posted again and again may be a ghost job), a "still open?" check, scoring 1–5 with a clear "don't apply" verdict. |
| [vesaias/JobNavigator](https://github.com/vesaias/JobNavigator) | MIT | 199 | Workday, Oracle HCM, Phenom and Rippling readers; Telegram alerts. |
| [fedorchenko-juli/job_search_tool](https://github.com/fedorchenko-juli/job_search_tool) | MIT | 156 | Deduplication across sources, trying a company name on every ATS. |
| [ConorsCode/ats-api-reference](https://github.com/ConorsCode/ats-api-reference) | MIT | 0 | A reference for the public job APIs of nine ATS platforms. Useful when writing the Workday reader. |
| [GetAnything-1/ats-jobs-scraper](https://github.com/GetAnything-1/ats-jobs-scraper) | MIT | 0 | A small Workday reader to compare with. |
| [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher) | Apache-2.0 | 29,437 | Resume tailoring screens and keyword reports, for WILSY Pro. |
| [Gsync/jobsync](https://github.com/Gsync/jobsync) | MIT | 1,559 | Tracker features: interview rounds, contacts, follow-up dates, funnel stats. |
| [averatec0773/offeros](https://github.com/averatec0773/offeros) | Apache-2.0 | 46 | Explaining why applications failed, from the tracker's own data. |
| [kbaas-ai/reparse-oss](https://github.com/kbaas-ai/reparse-oss) | MIT | 0 | Showing the evidence behind a match (which resume line proves which requirement). |
| [vaibhavarora14/job-application-agent](https://github.com/vaibhavarora14/job-application-agent) | MIT | 179 | Human-approval gates before anything is sent. |
| [muhammad-saadd/applyai](https://github.com/muhammad-saadd/applyai) | MIT | 2 | How a Chrome extension fills Greenhouse, Lever and Ashby forms (for the planned WILSY extension). |
| [IvanIsCoding/ResuLLMe](https://github.com/IvanIsCoding/ResuLLMe) | MIT | 474 | Prompts for resume rewriting, for WILSY Pro. |
| [dreamjobs-tech/skill-extractor](https://github.com/dreamjobs-tech/skill-extractor) | MIT | 2 | A small model that finds skills in text, if WILSY's skill list stops being enough. |
| [MenjliAymen/resume-parser](https://github.com/MenjliAymen/resume-parser) | MIT | 0 | Layout-aware resume parsing into sections. |
| [OmkarPathak/ResumeParser](https://github.com/OmkarPathak/ResumeParser) | MIT | 341 | Basic section and contact extraction. |
| [EMZStudio/career-materials-builder](https://github.com/EMZStudio/career-materials-builder) | MIT | 0 | Prompts that refuse to invent achievements. |
| [plilian/resume-to-role-mcp](https://github.com/plilian/resume-to-role-mcp) | MIT | 0 | Ranking job skills across many imported postings. |
| [cmdr-chara/open-job-scout](https://github.com/cmdr-chara/open-job-scout) | MIT | 1 | Checking that a listing is still live before showing it. |
| [akkisavi/job-automation](https://github.com/akkisavi/job-automation) | MIT | 1 | Explainable match reasons. |
| [vadimermolenko8787/jobchecker](https://github.com/vadimermolenko8787/jobchecker) | MIT | 3 | Scoring postings against a resume with an LLM. |
| [Ulas-Dursun/job-hunter](https://github.com/Ulas-Dursun/job-hunter) | MIT | 1 | Kanban tracker ideas. |
| [plibither8/jobber](https://github.com/plibither8/jobber) | MIT | 33 | Old (2022); WILSY's readers already cover it. |
| [d-alleyne/ashby-job-scraper](https://github.com/d-alleyne/ashby-job-scraper) | MIT | 5 | WILSY already reads Ashby. |
| [viktor-shcherb/job-seek](https://github.com/viktor-shcherb/job-seek) | CC0-1.0 | 17 | Nothing new for WILSY. |

## Ideas only: no code (licence)

| Repository | Licence | Why |
|---|---|---|
| [Shanupower/career-os](https://github.com/Shanupower/career-os) | AGPL-3.0 | Copying would force WILSY's code open. |
| [leoqingyu/jobfishing-public](https://github.com/leoqingyu/jobfishing-public) | AGPL-3.0 | Same. |
| [xitanggg/open-resume](https://github.com/xitanggg/open-resume) | AGPL-3.0 | Same. WILSY already has its own resume builder. |
| [pymupdf/PyMuPDF](https://github.com/pymupdf/PyMuPDF) | AGPL-3.0 | Same. WILSY reads PDFs in the browser already. |
| [OmkarPathak/pyresparser](https://github.com/OmkarPathak/pyresparser) | GPL-3.0 | Copyleft; also unmaintained since 2023. |
| [vinayjampana/role-miner](https://github.com/vinayjampana/role-miner), [Developer359/Jobscout-AI](https://github.com/Developer359/Jobscout-AI), [lookr-fyi/job-application-bot-by-ollama-ai](https://github.com/lookr-fyi/job-application-bot-by-ollama-ai), [Skalith/resume-analyser](https://github.com/Skalith/resume-analyser), [apoorvagaonkar99/AI-Resume-Analyzer-Python](https://github.com/apoorvagaonkar99/AI-Resume-Analyzer-Python), [Darshilmodi15/talentai-x](https://github.com/Darshilmodi15/talentai-x), [anubhavsanket/wayfarer](https://github.com/anubhavsanket/wayfarer), [JaimeYeung/Resume-Tailor-AI](https://github.com/JaimeYeung/Resume-Tailor-AI) | none | No licence means all rights reserved. |
| [tcpsyn/CareerPulse](https://github.com/tcpsyn/CareerPulse), [Pukakiii/Job-Agent](https://github.com/Pukakiii/Job-Agent), [NullSpace-BitCradle/jobhunter-framework](https://github.com/NullSpace-BitCradle/jobhunter-framework), [Cask-Hound-Digital/job_search_agent](https://github.com/Cask-Hound-Digital/job_search_agent) | non-standard | Licence terms unclear; ideas only. |

## Not for WILSY (auto-apply or scraping sites that forbid it)

| Repository | Licence | Stars | Why not |
|---|---|---|---|
| [feder-cr/Jobs_Applier_AI_Agent](https://github.com/feder-cr/Jobs_Applier_AI_Agent) (AIHawk) | MIT | 32,666 | Applies automatically on LinkedIn. |
| [naumov-alex/LinkedIn-AI-Job-Applier-Ultimate](https://github.com/naumov-alex/LinkedIn-AI-Job-Applier-Ultimate) | MIT | 187 | LinkedIn and Indeed bot. |
| [Azoo92i/AutoApplyMax](https://github.com/Azoo92i/AutoApplyMax) | non-standard | 65 | Auto-applies on LinkedIn and Indeed. |
| [LuisMIguelFurlanettoSousa/auto-apply-bot](https://github.com/LuisMIguelFurlanettoSousa/auto-apply-bot) | MIT | 47 | Applies with a robot browser. |
| [joeyspagnoli/agentic-job-applier](https://github.com/joeyspagnoli/agentic-job-applier) | MIT | 2 | "Applies all on your behalf". |
| [talhaimran/JobCollector](https://github.com/talhaimran/JobCollector) | MIT | 1 | Scrapes LinkedIn, Indeed and Glassdoor. |
| [OpenTechnology14/job-hunter](https://github.com/OpenTechnology14/job-hunter) | MIT | 0 | Scrapes LinkedIn and Indeed. |

## Infrastructure: not needed yet

WILSY is a static site with Vercel functions and one Postgres database. Postgres full-text search already
serves search, and `pgvector` inside Postgres can hold embeddings later without a separate vector database.

| Project | Licence | When it would matter |
|---|---|---|
| [ollama/ollama](https://github.com/ollama/ollama), [langchain-ai/langchain](https://github.com/langchain-ai/langchain), [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | MIT | Only if WILSY runs its own AI models or multi-step agents (WILSY Pro). |
| [huggingface/sentence-transformers](https://github.com/huggingface/sentence-transformers) | Apache-2.0 | Semantic matching (similar skills and roles), stored with `pgvector`. |
| [chroma-core/chroma](https://github.com/chroma-core/chroma), [qdrant/qdrant](https://github.com/qdrant/qdrant) | Apache-2.0 | Not needed while `pgvector` is enough. |
| [docling-project/docling](https://github.com/docling-project/docling), [Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured) | MIT / Apache-2.0 | Server-side resume parsing; WILSY parses in the browser so resumes never leave the device. |
| [fastapi/fastapi](https://github.com/fastapi/fastapi) | MIT | Only with a Python service. |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Testing WILSY's own pages. Never for applying or scraping protected sites. |
| [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch), [opensearch-project/OpenSearch](https://github.com/opensearch-project/OpenSearch), [redis/redis](https://github.com/redis/redis), [celery/celery](https://github.com/celery/celery) | mixed or custom | Only at much larger scale. Check each licence first. |

## The suggested 15-phase roadmap against WILSY today

| # | Feature | WILSY |
|---|---|---|
| 1 | Jobs from many sources | Done: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, government notices, Unstop, The Job Company. Next: jobseek boards, Workday. |
| 2 | One job format, duplicates removed | Done in the collectors. |
| 3 | Search, filters, saved searches | Done. |
| 4 | Resume upload and parsing | Done in the browser (`/resume-match`). |
| 5 | Personalised matching | Done: `/resume-match` and `/my-wilsy`. |
| 6 | Explainable match score | **Added now:** the job fit check. |
| 7 | Skill gap | Done (missing skills), extended by the fit check. |
| 8 | Personal alerts | Saved-search emails exist (`collectors/alerts.mjs`). |
| 9–10 | AI resume tailoring, cover letters | WILSY Pro (needs a paid AI API). The copy check is the free first step. |
| 11 | Application tracker | Done (`/tracker`). |
| 12 | Interview preparation | `/interview-answers` exists; AI practice is WILSY Pro. |
| 13–14 | Autofill extension, human-approved applying | Planned in `docs/wilsy-pro-plan.md`; the user always presses Submit. |
| 15 | Career recommendations | `/my-wilsy` has skills to learn next. |
