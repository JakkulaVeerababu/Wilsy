import {createPayHandlers} from '../../frontend/scripts/pay-handler.mjs';

// Vercel Node.js function for POST /api/pay/verify: checks the Razorpay signature and records the payment.
const {verify} = createPayHandlers();
export const POST = request => verify(request);
