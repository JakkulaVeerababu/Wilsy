import {databaseRequest} from '../js/data-client.js';

// The jobs data lives in its own Postgres database (Heroku) once JOBS_DATABASE_URL is set; until then every
// call goes to Supabase as before. Only these read-only public functions can be called, with their argument
// names in order, so a caller can never run anything else.
export const JOB_FUNCTIONS = {
  wilsy_search_jobs: [['filters', 'jsonb'], ['page_size', 'integer'], ['page_offset', 'integer']],
  wilsy_job_facets: [],
  wilsy_job_history: [['job_id', 'bigint']],
};

export const IDLE_SESSION_MS = 20000;
// Worth one more try: the server refused a new connection (53300, all 20 in use), or closed this idle one
// (idle_session_timeout, 57P05) or dropped it. The site only calls read-only functions, so a retry is safe.
export const retryable = error => error?.code === '53300' || error?.code === '57P05' || error?.code === 'ECONNRESET'
  || /Connection terminated|terminating connection|Client has encountered a connection error/i.test(String(error?.message || ''));

let pool;
async function getPool(url) {
  if (!pool) {
    const {default: pg} = await import('pg');
    // One connection per function instance: the database allows 20 in all. A frozen Vercel instance never runs
    // the pool's idle timer, so its connection would stay open for minutes; idle_session_timeout makes the server
    // close a session idle for 20 s instead, and the next call reconnects (see the retry below).
    pool = new pg.Pool({connectionString: url, ssl: {rejectUnauthorized: false}, max: 1,
      idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, statement_timeout: 8000,
      options: `-c idle_session_timeout=${IDLE_SESSION_MS}`});
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
export function createJobsRequest({env = process.env, fallback = databaseRequest, connect = getPool, retryMs = 400} = {}) {
  return async function jobsRequest(path, options = {}) {
    const url = env.JOBS_DATABASE_URL;
    const name = String(path).replace(/^rpc\//, '');
    if (!url || !String(path).startsWith('rpc/') || !Object.hasOwn(JOB_FUNCTIONS, name)) return fallback(path, options);
    const call = functionCall(name, options.body || {});
    if (!call) throw new Error('Unsupported job function arguments');
    const db = await connect(url);
    // A refused connection (53300, the shared 20-connection limit is full) is retried briefly: the statement
    // never ran. Kept short so a visitor's search answers or fails quickly.
    let rows;
    for (let attempt = 1; ; attempt++) {
      try { ({rows} = await db.query(call)); break; }
      catch (error) { if (!retryable(error) || attempt >= 3) throw error; await new Promise(r => setTimeout(r, retryMs * attempt)); }
    }
    return rows[0]?.result ?? null;
  };
}

export const jobsRequest = createJobsRequest();

// Columns the deploy-time pass needs (live-jobs.mjs `keep` and job-pages.mjs `pageWorthy`).
export const BULK_COLUMNS = ['id', 'title', 'company', 'company_slug', 'location', 'city', 'country', 'country_code', 'work_mode', 'job_type',
  'posted_at', 'posted_at_precision', 'first_seen_at', 'discovered_at', 'skills', 'tech_stack', 'description', 'is_internship', 'is_fresher',
  'is_new_grad', 'salary_min', 'salary_max', 'salary_text', 'apply_url', 'deadline_at', 'expires_at'];

/**
 * Every live job straight from the public view, in id order, `batch` rows per query (deploy builds only).
 * The public search pages 50 rows at a time and stops at offset 100,000, which is too slow and too short
 * once there are 100,000+ jobs. Returns null when the jobs database is not set (the caller then pages the search).
 */
export function createBulkReader({env = process.env, connect = getPool, batch = 2000} = {}) {
  const url = env.JOBS_DATABASE_URL;
  if (!url) return null;
  const text = `select ${BULK_COLUMNS.join(', ')} from public.wilsy_public_jobs where id > $1 order by id limit $2`;
  // Each batch goes to onRows as it arrives, so the caller can trim it (descriptions are large). Returns the row count.
  return async function readAll(onRows) {
    const db = await connect(url);
    let count = 0;
    for (let after = 0; ;) {
      let rows;
      for (let attempt = 1; ; attempt++) {
        try { ({rows} = await db.query({text, values: [after, batch]})); break; }
        catch (error) { if (attempt >= 3) throw error; await new Promise(r => setTimeout(r, 1000 * attempt)); }
      }
      onRows(rows);
      count += rows.length;
      if (rows.length < batch) return count;
      after = rows[rows.length - 1].id;
    }
  };
}
