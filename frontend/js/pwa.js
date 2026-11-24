import {track} from './analytics.js';

// Installable app: register the service worker once the page has loaded, and offer a quiet
// "Install app" entry only after the browser says it can install WILSY. No popups or banners.
let deferred = null, prompted = false;
const entries = () => document.querySelectorAll('[data-install-app]');
function showEntries() {
  if(entries().length) { entries().forEach(el => { el.hidden = false; }); return; }
  const make = className => Object.assign(document.createElement('button'), {type:'button', className:'install-app '+className, textContent:'Install app'});
  // In the footer's Company list on every screen, and in the header menu on small screens.
  const footer = document.querySelector('.site-footer nav[aria-label="Company"]');
  const menu = document.querySelector('#main-navigation .nav-cta');
  for(const [place, button] of [[footer, make('footer-install')], [menu, make('nav-install')]]) {
    if(!place) continue;
    button.setAttribute('data-install-app', '');
    if(place.matches('nav')) place.append(button); else place.before(button);
  }
}
const hideEntries = () => entries().forEach(el => { el.hidden = true; });

addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); // keeps the browser's own mini-infobar from appearing
  deferred = event;
  showEntries();
});
document.addEventListener('click', async event => {
  if(!event.target.closest('[data-install-app]') || !deferred) return;
  const prompt = deferred;deferred = null;prompted = true;hideEntries();
  prompt.prompt();
  await prompt.userChoice.catch(() => null);
});
addEventListener('appinstalled', () => {
  hideEntries();deferred = null;
  track('app_install', {via: prompted ? 'wilsy_button' : 'browser'});
});

// The offline page retries the address the visitor asked for.
document.addEventListener('click', event => { if(event.target.closest('[data-retry-page]')) location.reload(); });

if('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
  if(document.readyState === 'complete') register(); else addEventListener('load', register, {once: true});
}
