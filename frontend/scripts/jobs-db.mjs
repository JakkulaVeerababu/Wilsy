import {databaseRequest} from '../js/data-client.js';

// The jobs data lives in its own Postgres database (Heroku) once JOBS_DATABASE_URL is set; until then every
// call goes to Supabase as before. Only these read-only public functions can be called, with their argument
// names in order, so a caller can never run anything else.
export const JOB_FUNCTIONS = {
  wilsy_search_jobs: [['filters', 'jsonb'], ['page_size', 'integer'], ['page_offset', 'integer']],
  wilsy_job_facets: [],
  wilsy_job_history: [['job_id', 'bigint']],
};

let pool;
async function getPool(url) {
  if (!pool) {
    const {default: pg} = await import('pg');
    // One connection per function instance: the database allows 20 in all, and Vercel runs few instances.
    pool = new pg.Pool({connectionString: url, ssl: {rejectUnauthorized: false}, max: 1,
      idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, statement_timeout: 8000});
    pool.on('error', () => { pool = undefined; });
  }
  return pool;
}

/** SQL and values for one allowed function call; null when the name or arguments are not allowed. */
export function functionCall(name, body = {}) {
  const args = Object.hasOwn(JOB_FUNCTIONS, name) ? JOB_FUNCTIONS[name] : null;
  if (!args) return null;
  const values = [];
  const parts = [];
  for (const [arg, type] of args) {
    if (!(arg in body)) continue;
    const value = body[arg];
    if (type === 'jsonb' ? (value === null || typeof value !== 'object' || Array.isArray(value)) : !Number.isSafeInteger(value)) return null;
    values.push(type === 'jsonb' ? JSON.stringify(value) : value);
    parts.push(`${arg} => $${values.length}::${type}`);
  }
  return {text: `select public.${name}(${parts.join(', ')}) as result`, values};
}

// Same shape as databaseRequest('rpc/<name>', {body}), so callers do not change.
export function createJobsRequest({env = process.env, fallback = databaseRequest, connect = getPool} = {}) {
  return async function jobsRequest(path, options = {}) {
    const url = env.JOBS_DATABASE_URL;
    const name = String(path).replace(/^rpc\//, '');
    if (!url || !String(path).startsWith('rpc/') || !Object.hasOwn(JOB_FUNCTIONS, name)) return fallback(path, options);
    const call = functionCall(name, options.body || {});
    if (!call) throw new Error('Unsupported job function arguments');
    const db = await connect(url);
    const {rows} = await db.query(call);
    return rows[0]?.result ?? null;
  };
}

export const jobsRequest = createJobsRequest();
