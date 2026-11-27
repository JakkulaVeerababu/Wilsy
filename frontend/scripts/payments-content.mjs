// Pricing, the cancellation and refund policy (Razorpay needs both public), and the Featured job payment form.
// Job seekers never pay. Only employers can buy a Featured job.
const UPDATED = '27 Nov 2026';

export function paymentPolicyPages(email) {
  const contact = `<a href="mailto:${email}">${email}</a>`;
  return [
    {slug:'pricing', updatedAt:UPDATED, seoTitle:'Pricing for employers', eyebrow:'PRICING', title:'Free for job seekers. Simple for employers.', description:'WILSY is free for everyone looking for work. Employers can feature a job at the top of WILSY search for 30 days for ₹999.', body:`<p class="article-lead">Searching, saving and applying for jobs on WILSY is free, and always will be. Employers can pay to give one job more visibility.</p>
<h2 id="job-seekers">Job seekers: free</h2><ul><li>Search every job, internship, hackathon and government notice.</li><li>Save jobs and searches, and use every calculator and guide.</li><li>Apply directly on the employer’s own website.</li></ul><p>WILSY never charges job seekers, and no job on WILSY needs a payment to apply. If anyone asks you to pay in WILSY’s name, report it to ${contact}.</p>
<h2 id="featured">Featured job: ₹999 for 30 days</h2><ul><li>The job appears above other matching jobs in WILSY search for 30 days.</li><li>It carries a “Featured” label, so job seekers know it is a paid placement.</li><li>One payment, no subscription and no automatic renewal.</li><li>Pay by UPI, card, net banking or wallet through Razorpay.</li></ul><p>The price is in Indian rupees and is the full amount you pay. A Featured job must already be live on WILSY, and must follow our <a href="/terms">terms</a>: jobs that ask applicants for money are refused and refunded.</p><p><a class="primary-button" href="/feature-job">Feature a job</a></p>
<h2 id="independence">What payment does not change</h2><p>A Featured placement changes only where a job appears in search. It does not change a company’s pay tier, salary data or profile, and it is never shown as a job offer or a recommendation.</p>
<h2>Questions</h2><p>For hiring help or a custom plan, email ${contact}. Refunds are explained in our <a href="/refund-policy">cancellation and refund policy</a>.</p>`},
    {slug:'refund-policy', updatedAt:UPDATED, seoTitle:'Cancellation and refund policy', eyebrow:'PAYMENTS', title:'Cancellation and refund policy', description:'How cancellations, refunds and service delivery work for paid Featured jobs on WILSY.', body:`<p class="article-lead">This policy covers payments for Featured jobs on WILSY. Job seekers never pay WILSY. Updated ${UPDATED}.</p>
<h2 id="delivery">When the service starts</h2><p>A Featured job is a digital service, and nothing is shipped. The placement starts as soon as Razorpay confirms the payment, usually within a minute, and runs for 30 days. If it has not started within 24 hours, email ${contact} with your payment ID and we will start it or refund you in full.</p>
<h2 id="cancellation">Cancellation</h2><p>You can cancel at any time by emailing ${contact} from the address you paid with. Before payment, nothing is charged. After payment, a cancellation is handled as a refund request below.</p>
<h2 id="refunds">Refunds</h2><ul><li><strong>Within 7 days of payment:</strong> a full refund, for any reason.</li><li><strong>If the job closes on the employer’s job board within 7 days:</strong> a full refund, or we move the placement to another live job of yours for the remaining days.</li><li><strong>If we remove the job</strong> because it breaks our <a href="/terms">terms</a>, such as asking applicants for money: a full refund.</li><li><strong>After 7 days:</strong> no refund, unless the placement did not run because of a fault on WILSY’s side.</li></ul>
<h2 id="how">How refunds are paid</h2><p>Refunds go back to the original payment method through Razorpay. We start an approved refund within 2 working days, and it usually reaches your account within 5 to 7 working days, depending on your bank.</p>
<h2 id="failed">Failed or double payments</h2><p>If money left your account but the payment failed, your bank or Razorpay reverses it automatically, usually within 5 to 7 working days. If you were charged twice for one job, email us and we refund the extra payment in full.</p>
<h2>Contact</h2><p>Email ${contact} with your company name, the job link and your Razorpay payment ID. Complaints can also go to our <a href="/grievance">Grievance Officer</a>.</p>`},
  ];
}

export function featureJobBody(email) {
  return `<main id="main-content" class="editorial-shell feature-job-shell">
<section class="feature-job" data-feature-job aria-labelledby="feature-job-title">
  <p class="eyebrow">FOR EMPLOYERS</p><h1 id="feature-job-title">Feature a job on WILSY</h1>
  <p class="feature-job-lead">Put one of your live WILSY jobs above other matching jobs in search for 30 days, with a “Featured” label. <strong>₹999, paid once.</strong> No subscription.</p>
  <p class="feature-job-mode" data-feature-mode hidden></p>
  <form class="feature-job-form" data-feature-form novalidate>
    <div class="calc-field"><label for="feature-job-link">Job link or job number on WILSY</label><input id="feature-job-link" name="job" required autocomplete="off" placeholder="https://www.wilsy.in/jobs/12345-software-engineer"></div>
    <div class="calc-field"><label for="feature-company">Company name</label><input id="feature-company" name="company" required maxlength="120" autocomplete="organization"></div>
    <div class="calc-field"><label for="feature-email">Work email, for the receipt</label><input id="feature-email" name="email" type="email" required maxlength="200" autocomplete="email"></div>
    <label class="feature-job-agree"><input type="checkbox" name="agree" required> I agree to the <a href="/terms">terms</a> and the <a href="/refund-policy">refund policy</a>.</label>
    <button class="primary-button" type="submit" data-feature-pay>Pay ₹999</button>
    <p class="feature-job-status" data-feature-status role="status" aria-live="polite"></p>
  </form>
  <noscript><p class="feature-job-status">Payment needs JavaScript. You can also email ${email}.</p></noscript>
  <p class="quiet-callout">Payments are processed by Razorpay; WILSY never sees your card or UPI details. Can’t find your job on WILSY? Email <a href="mailto:${email}">${email}</a>. See <a href="/pricing">pricing</a>.</p>
</section>
<script type="module" src="/js/feature-job.js"></script></main>`;
}
