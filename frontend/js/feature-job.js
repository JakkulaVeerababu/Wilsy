// Featured job checkout: our server creates a Razorpay order, Razorpay Checkout takes the payment,
// and our server checks Razorpay's signature before the job is featured.
export function jobIdFrom(value) {
  const text = String(value || '').trim();
  const match = text.match(/^\d{1,15}$/) || text.match(/\/jobs\/(\d{1,15})(?:-|$|[/?#])/);
  return match ? Number(match[1] ?? match[0]) : null;
}

let checkoutScript;
function loadCheckout() {
  checkoutScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout did not load'));
    script.onerror = () => { checkoutScript = null; reject(new Error('Checkout did not load')); };
    document.head.append(script);
  });
  return checkoutScript;
}

async function post(url, body) {
  const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function init(root) {
  const form = root.querySelector('[data-feature-form]'), status = root.querySelector('[data-feature-status]');
  const button = root.querySelector('[data-feature-pay]'), mode = root.querySelector('[data-feature-mode]');
  const say = (text, kind = '') => { status.textContent = text; status.dataset.kind = kind; };
  const params = new URLSearchParams(location.search);
  if (params.get('job')) form.job.value = params.get('job');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const job_id = jobIdFrom(form.job.value), company = form.company.value.trim(), email = form.email.value.trim();
    if (!job_id) return say('Paste the job’s WILSY link, or its job number.', 'error');
    if (!company) return say('Enter your company name.', 'error');
    if (!form.email.checkValidity() || !email) return say('Enter a valid work email.', 'error');
    if (!form.agree.checked) return say('Please agree to the terms and refund policy.', 'error');
    button.disabled = true; say('Starting secure payment…');
    try {
      const [order, Razorpay] = await Promise.all([post('/api/pay/create-order', {job_id, company, email}), loadCheckout()]);
      if (order.mode === 'test') { mode.hidden = false; mode.textContent = 'Test mode: no real money is charged, and the job is not actually featured.'; }
      const checkout = new Razorpay({
        key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency,
        name: 'WILSY', description: `Featured job, 30 days: ${order.job.title}`.slice(0, 250),
        prefill: {email}, notes: {job_id: String(job_id)}, theme: {color: '#0866ff'},
        modal: {ondismiss: () => { button.disabled = false; say('Payment cancelled. Nothing was charged.'); }},
        handler: async result => {
          say('Confirming your payment…');
          try {
            const done = await post('/api/pay/verify', {order_id: result.razorpay_order_id, payment_id: result.razorpay_payment_id, signature: result.razorpay_signature});
            const until = new Date(done.ends_at).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
            say(`Paid. “${order.job.title}” is featured until ${until}. Payment ID: ${result.razorpay_payment_id}.`, 'success');
            form.reset();
          } catch (error) { say(`${error.message} Payment ID: ${result.razorpay_payment_id}.`, 'error'); }
          button.disabled = false;
        }
      });
      checkout.on('payment.failed', response => { button.disabled = false; say(`Payment failed: ${response.error?.description || 'please try again'}. Nothing was charged.`, 'error'); });
      checkout.open();
    } catch (error) { button.disabled = false; say(error.message, 'error'); }
  });
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-feature-job]').forEach(init);
