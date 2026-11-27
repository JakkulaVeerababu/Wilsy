// The popup: runs the filler in the current tab, only when the person clicks (activeTab permission).
const status = document.getElementById('status');
document.getElementById('fill').addEventListener('click', async () => {
  const {profile} = await chrome.storage.local.get('profile');
  if (!profile || !profile.email) { status.textContent = 'Add your details first: Edit my details.'; return; }
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab || !/^https:\/\//.test(tab.url || '')) { status.textContent = 'Open a job application page (https) first.'; return; }
  try {
    const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: false}, files: ['fill-core.js', 'fill.js']});
    const filled = result?.result?.filled ?? 0;
    status.textContent = filled ? `Filled ${filled} field${filled === 1 ? '' : 's'}. Check them, then press Submit yourself.` : 'No empty field it recognises here.';
  } catch {
    status.textContent = 'This page can’t be filled (browser pages and the Chrome Web Store are off limits).';
  }
});
