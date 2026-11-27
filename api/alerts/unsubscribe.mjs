import {createUnsubscribeHandlers} from '../../frontend/scripts/unsubscribe-handler.mjs';

// Vercel Node.js function for /api/alerts/unsubscribe: GET shows a confirm button, POST (the button or
// Gmail's one-click unsubscribe) turns off every job alert of that person. Needs WILSY_UNSUBSCRIBE_SECRET
// and SUPABASE_SERVICE_ROLE_KEY.
const {get, post} = createUnsubscribeHandlers();
export const GET = request => get(request);
export const POST = request => post(request);
