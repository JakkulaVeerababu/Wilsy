import {createJobPageHandler} from '../frontend/scripts/job-page-handler.mjs';

// Vercel Node.js function for /jobs/<id>-<slug> pages that were not pre-built at deploy time.
// vercel.json rewrites only that pattern here, and Vercel serves static files before rewrites.
export default {fetch: createJobPageHandler()};
