import {JOB_FUNCTIONS, jobsRequest} from './jobs-db.mjs';

// POST /api/jobs-rpc?fn=<name>: the browser's job calls other than the cached search (filter lists, saved-job
// lists, a job's earlier postings). Only the read-only functions in JOB_FUNCTIONS are accepted.
export const JOBS_RPC_PATH = '/api/jobs-rpc';
const MAX_BODY = 20000;

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});

export function createJobsRpcHandler({request = jobsRequest} = {}) {
  return async function handle(incoming) {
    const name = new URL(incoming.url).searchParams.get('fn') || '';
    if (!Object.hasOwn(JOB_FUNCTIONS, name)) return json(404, {error: 'Unknown function'});
    let body;
    try {
      const text = await incoming.text();
      if (text.length > MAX_BODY) return json(413, {error: 'Request too large'});
      body = text ? JSON.parse(text) : {};
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad body');
    } catch {
      return json(400, {error: 'Invalid request'});
    }
    try {
      return json(200, await request(`rpc/${name}`, {body}));
    } catch {
      return json(502, {error: 'Job data unavailable'});
    }
  };
}
