import {createPayHandlers} from '../../frontend/scripts/pay-handler.mjs';

// Vercel Node.js function for POST /api/pay/create-order: starts a Razorpay payment for a Featured job.
const {createOrder} = createPayHandlers();
export const POST = request => createOrder(request);
