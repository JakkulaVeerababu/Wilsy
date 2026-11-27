import {createJobsRpcHandler} from '../frontend/scripts/jobs-rpc-handler.mjs';

// Vercel Node.js function for POST /api/jobs-rpc?fn=<name> (see frontend/scripts/jobs-rpc-handler.mjs).
const handle = createJobsRpcHandler();
export const POST = request => handle(request);
