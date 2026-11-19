import {createSearchHandler} from '../frontend/scripts/search-handler.mjs';

// Vercel Node.js function for GET /api/search: the public job search with a shared one-minute edge cache.
// Browsers on wilsy.in call it first and fall back to the database directly if it fails (js/data-client.js).
const handle = createSearchHandler();
export const GET = request => handle(request);
