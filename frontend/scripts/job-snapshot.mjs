import {jobsRequest} from './jobs-db.mjs';
import {plainJobText} from '../js/job-text.js';
import {applyUrl} from '../js/jobs-core.js';

// Reads the jobs database (Heroku when JOBS_DATABASE_URL is set, else Supabase).
const searchJobs = (filters, offset = 0) => jobsRequest('rpc/wilsy_search_jobs', {body: {filters, page_size: 20, page_offset: offset}});
const jobFacets = () => jobsRequest('rpc/wilsy_job_facets', {body: {}});

// Public search results only. Never read ingestion payloads or private tables.
export async function fetchJobSnapshot() {
  const [facets, fresh, pay] = await Promise.all([jobFacets(), searchJobs({}), searchJobs({salary:'yes',country:'India'})]);
  if (!Array.isArray(fresh.jobs) || !Number.isSafeInteger(facets.total) || facets.total < 0) throw new Error('Invalid public job response');
  const compact = job => ({
    ...job,
    description: plainJobText(job.description).slice(0, 2000),
  });
  const publicRows = rows => rows.filter(job => /^\d+$/.test(String(job.id)) && applyUrl(job.apply_url)).map(compact);
  const featured = [];
  for (const name of ['Stripe','Deepgram','OpenAI','Google','Microsoft','NVIDIA']) {
    const result = await searchJobs({company:name});
    if (result.jobs.length) featured.push({name, slug:result.jobs[0].company_slug, roles:result.total, verified:result.jobs[0].is_company_verified === true});
  }
  return {version:1, updatedAt:fresh.as_of, source:'WILSY public job search API', stats:{total:facets.total,companies:facets.companies_count,remote:facets.remote_count}, featured, jobs:publicRows(fresh.jobs), feed:publicRows(pay.jobs).slice(0,3)};
}
