// The jobs data lives in its own Postgres database (Heroku) once JOBS_DATABASE_URL is set. The collectors were
// written against Supabase's REST API (PostgREST paths such as `jobs?select=id&status=eq.published`), so this
// turns the small part of that syntax they use into parameterised SQL, keeping every collector unchanged.
// Only the job tables and functions below can be reached; names are checked, and every value is a parameter.
// The reviewed company profiles (public.companies) stay on Supabase, where the company directory reads them.

export const JOB_TABLES = new Set(['jobs', 'job_locations', 'job_categories', 'company_watchlist_10k',
  'company_watchlist_11k', 'dedicated_company_watchlist', 'job_ingestion_runs', 'featured_job_orders',
  'wilsy_public_jobs']);
export const JOB_RPCS = new Set(['wilsy_ingest_board', 'wilsy_ingest_partner', 'wilsy_apply_discovery', 'wilsy_search_jobs',
  'wilsy_job_facets', 'wilsy_job_history']);

/** True when a REST path belongs in the jobs database. */
export function isJobPath(path) {
  const [target] = String(path).split('?');
  return target.startsWith('rpc/') ? JOB_RPCS.has(target.slice(4)) : JOB_TABLES.has(target);
}

const NAME = /^[a-z_][a-z0-9_]*$/;
const quote = name => { if (!NAME.test(name)) throw new Error(`Unsupported name: ${name}`); return `"${name}"`; };

// A column, optionally followed by JSON steps: metadata->enrich->>v
function column(text) {
  const parts = text.split(/(->>?)/);
  let sql = quote(parts[0]);
  for (let i = 1; i < parts.length; i += 2) {
    if (!NAME.test(parts[i + 1] || '')) throw new Error(`Unsupported JSON key in ${text}`);
    sql += `${parts[i]}'${parts[i + 1]}'`;
  }
  return sql;
}

// Values of in.(a,b,"c,d")
function listValues(text) {
  if (!text.startsWith('(') || !text.endsWith(')')) throw new Error('Unsupported in list');
  const values = []; let current = '', quoted = false;
  for (const ch of text.slice(1, -1)) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { values.push(current); current = ''; }
    else current += ch;
  }
  values.push(current);
  return values;
}

// Splits a,b,c at top level, leaving commas inside brackets alone.
function topLevel(text) {
  const out = []; let depth = 0, current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(current); current = ''; } else current += ch;
  }
  out.push(current);
  return out;
}

const OPS = {eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike'};

// One condition such as status=eq.published, given as the column and the operator text.
function condition(col, expr, values) {
  const target = column(col);
  let negate = false, rest = expr;
  if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.');
  const op = rest.slice(0, dot), value = rest.slice(dot + 1);
  let sql;
  if (op === 'is') {
    const word = {null: 'null', true: 'true', false: 'false'}[value];
    if (!word) throw new Error(`Unsupported is.${value}`);
    sql = `${target} is ${word}`;
  } else if (op === 'in') {
    values.push(listValues(value));
    sql = `${target}::text = any($${values.length}::text[])`;
  } else if (OPS[op]) {
    values.push(op.endsWith('like') ? value.replaceAll('*', '%') : value);
    // An untyped parameter takes the column's type, so ids, dates and text all compare as they would in PostgREST.
    sql = `${target} ${OPS[op]} $${values.length}`;
  } else throw new Error(`Unsupported operator ${op}`);
  return negate ? `not (${sql})` : sql;
}

// or=(a.eq.1,b.ilike.x)
function orGroup(text, values) {
  if (!text.startsWith('(') || !text.endsWith(')')) throw new Error('Unsupported or group');
  return '(' + topLevel(text.slice(1, -1)).map(part => {
    const match = part.match(/^([a-z_][a-z0-9_]*(?:->>?[a-z_0-9]+)*)\.(.+)$/);
    if (!match) throw new Error(`Unsupported or part ${part}`);
    return condition(match[1], match[2], values);
  }).join(' or ') + ')';
}

/** Parses the query part of a table path into select list, where clause, order, limit and offset. */
export function parseQuery(search, values = []) {
  const params = new URLSearchParams(search);
  let select = '*', order = '', limit = '', offset = '';
  const where = [];
  for (const [key, value] of params) {
    if (key === 'select') select = value.split(',').map(c => column(c.trim())).join(', ');
    else if (key === 'order') order = ' order by ' + value.split(',').map(part => {
      const [col, ...mods] = part.split('.');
      const dir = mods.includes('desc') ? ' desc' : '';
      const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
      return column(col) + dir + nulls;
    }).join(', ');
    else if (key === 'limit') { if (!/^\d{1,6}$/.test(value)) throw new Error('Bad limit'); limit = ` limit ${value}`; }
    else if (key === 'offset') { if (!/^\d{1,7}$/.test(value)) throw new Error('Bad offset'); offset = ` offset ${value}`; }
    else if (key === 'or') where.push(orGroup(value, values));
    else where.push(condition(key, value, values));
  }
  return {select, where: where.length ? ' where ' + where.join(' and ') : '', order, limit, offset, values};
}

const returning = prefer => /return=representation/.test(prefer || '');

/** SQL for one REST call against the jobs database, or throws for anything unsupported. */
export function toSql(path, {body, method = body ? 'POST' : 'GET', prefer} = {}) {
  const [target, search = ''] = String(path).split('?');
  if (target.startsWith('rpc/')) {
    const name = target.slice(4);
    if (!JOB_RPCS.has(name)) throw new Error(`Unsupported function ${name}`);
    const values = [], args = [];
    for (const [arg, value] of Object.entries(body || {})) {
      values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
      args.push(`${quote(arg)} => $${values.length}${value !== null && typeof value === 'object' ? '::jsonb' : ''}`);
    }
    return {text: `select public.${quote(name)}(${args.join(', ')}) as result`, values, rpc: true};
  }
  if (!JOB_TABLES.has(target)) throw new Error(`Unsupported table ${target}`);
  const table = `public.${quote(target)}`;
  if (method === 'GET') {
    const q = parseQuery(search);
    return {text: `select ${q.select} from ${table}${q.where}${q.order}${q.limit}${q.offset}`, values: q.values};
  }
  if (method === 'PATCH') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('PATCH needs an object');
    const values = [];
    const sets = Object.entries(body).map(([col, value]) => {
      values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
      return `${quote(col)} = $${values.length}`;
    });
    const q = parseQuery(search, values);
    if (!q.where) throw new Error('PATCH without a filter is not allowed');
    return {text: `update ${table} set ${sets.join(', ')}${q.where}${returning(prefer) ? ' returning *' : ''}`, values};
  }
  if (method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length || rows.some(r => !r || typeof r !== 'object')) throw new Error('POST needs rows');
    const cols = [...new Set(rows.flatMap(Object.keys))];
    // json_populate_recordset gives each value its column's type, so one parameter carries every row.
    const list = cols.map(quote).join(', ');
    const conflict = /resolution=ignore-duplicates/.test(prefer || '') ? ' on conflict do nothing' : '';
    return {text: `insert into ${table} (${list}) select ${list} from json_populate_recordset(null::${table}, $1::json)${conflict}${returning(prefer) ? ' returning *' : ''}`,
      values: [JSON.stringify(rows)]};
  }
  throw new Error(`Unsupported method ${method}`);
}

let pool;
async function defaultConnect(url) {
  if (!pool) {
    const {default: pg} = await import('pg');
    // Two connections per process: the database allows 20, shared by up to five collector shards and the website.
    pool = new pg.Pool({connectionString: url, ssl: {rejectUnauthorized: false}, max: 2, idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000, statement_timeout: 60000});
    pool.on('error', () => {});
  }
  return pool;
}

/** A REST-shaped caller backed by Postgres: same arguments and results as the Supabase one for job paths. */
export function createPgRest({url, connect = defaultConnect}) {
  return async function pgRest(path, options = {}) {
    const call = toSql(path, options);
    const db = await connect(url);
    const {rows} = await db.query({text: call.text, values: call.values});
    if (call.rpc) return rows[0]?.result ?? null;
    if ((options.method || (options.body ? 'POST' : 'GET')) === 'GET' || returning(options.prefer)) return rows;
    return null;
  };
}

/** Sends job paths to Postgres when JOBS_DATABASE_URL is set, and everything else to the given REST caller. */
export function routeJobs(rest, {env = process.env, connect} = {}) {
  const url = env.JOBS_DATABASE_URL;
  if (!url) return rest;
  const pgRest = createPgRest({url, connect});
  return (path, options) => isJobPath(path) ? pgRest(path, options) : rest(path, options);
}
