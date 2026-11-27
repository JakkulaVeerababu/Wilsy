const form = document.getElementById('profile'), status = document.getElementById('status');
const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'location', 'currentCompany', 'linkedin', 'github', 'website'];
chrome.storage.local.get('profile').then(({profile}) => { for (const k of FIELDS) form.elements[k].value = profile?.[k] || ''; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = Object.fromEntries(FIELDS.map(k => [k, form.elements[k].value.trim()]));
  for (const k of ['linkedin', 'github', 'website']) if (profile[k] && !/^https:\/\//i.test(profile[k])) { status.textContent = 'Links must start with https://'; return; }
  await chrome.storage.local.set({profile});
  status.textContent = 'Saved in this browser.';
});
document.getElementById('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove('profile'); form.reset(); status.textContent = 'Deleted.';
});
