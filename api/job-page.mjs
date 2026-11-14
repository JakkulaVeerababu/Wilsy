import {createJobPageHandler} from '../frontend/scripts/job-page-handler.mjs';

// Vercel Node.js function for /jobs/<id>-<slug> pages that were not pre-built at deploy time.
// vercel.json rewrites only that pattern here, and Vercel serves static files before rewrites.
// Named HTTP-method exports take a Web Request and return a Response (Vercel's documented Node signature).
const handle = createJobPageHandler();
export const GET = request => handle(request);
export const HEAD = request => handle(request);
