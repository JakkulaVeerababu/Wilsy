// Use Google's published CMP. This is a revocation control, not a replacement CMP.
window.googlefc = window.googlefc || {};
window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
  if (typeof window.googlefc.showRevocationMessage !== 'function') return;
  document.querySelectorAll('[data-privacy-choices]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      window.googlefc.showRevocationMessage();
    });
  });
}});

document.querySelectorAll('[data-copy-email]').forEach(button => {
  button.addEventListener('click', async () => {
    const status = document.querySelector('#contact-status');
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
      status.textContent = 'Email address copied.';
    } catch {
      status.textContent = 'Select the email address above to copy it, or use the email link.';
    }
  });
});
