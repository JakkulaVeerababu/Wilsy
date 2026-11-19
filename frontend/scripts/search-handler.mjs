import {databaseRequest, searchFromQuery} from '../js/data-client.js';

// GET /api/search: the public job search behind a shared edge cache. The same search from many visitors
// (the homepage, company pages, popular filters) is answered from Vercel's cache for a minute, and a stale
// copy is served for up to five more minutes while a fresh one is fetched. Only public filters are accepted.
const json = (status, body, cache) => new Response(JSON.stringify(body), {status, headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': cache,
  ...(cache.startsWith('public') ? {'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'} : {}),
  'X-Content-Type-Options': 'nosniff',
}});

export function createSearchHandler({request = databaseRequest} = {}) {
  return async function handle(incoming) {
    const url = new URL(incoming.url);
    const search = searchFromQuery(url.searchParams);
    if(!search) return json(400, {error: 'Unsupported search filters'}, 'no-store');
    try {
      const result = await request('rpc/wilsy_search_jobs', {body: {filters: search.filters, page_size: 20, page_offset: search.offset}});
      if(!Array.isArray(result?.jobs)) throw new Error('Invalid public job response');
      return json(200, result, 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    } catch {
      return json(502, {error: 'Job search unavailable'}, 'no-store');
    }
  };
}
