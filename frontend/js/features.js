import {track, pageKind} from './analytics.js';
import {rememberJob} from './palette-core.js';

// Site-wide extras on every page: quick search (Ctrl/⌘ K), share buttons, campus referral links and the
// recently viewed jobs list. The quick-search dialog itself loads on first use.

export const REF_KEY = 'wilsy-ref';
/** Campus ambassador codes: lowercase letters, digits and hyphens, 2–24 characters (for example "iitb-07"). */
export const refCode = value => { const v = String(value ?? '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9-]{1,23}$/.test(v) ? v : ''; };
export const referralUrl = (code, origin = 'https://www.wilsy.in') => refCode(code) ? `${origin}/?ref=${refCode(code)}` : '';
export const whatsappUrl = (text, url) => 'https://wa.me/?text=' + encodeURIComponent(`${text} ${url}`.trim());

if(globalThis.document) {
  // Referral visits: remember the code for this visit, count it once, and drop it from the address bar.
  try {
    const url = new URL(location.href), code = refCode(url.searchParams.get('ref'));
    if(url.searchParams.has('ref')) {
      if(code && sessionStorage.getItem(REF_KEY) !== code) { sessionStorage.setItem(REF_KEY, code); track('referral', {code, page: pageKind(location.pathname)}); }
      url.searchParams.delete('ref');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {}

  // Quick search.
  let palette;
  const openPalette = () => (palette ||= import('./palette.js')).then(m => m.open()).catch(() => { location.href = '/jobs'; });
  document.addEventListener('keydown', event => {
    if((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
  });
  document.addEventListener('click', async event => {
    if(event.target.closest('[data-palette-open]')) { event.preventDefault(); openPalette(); return; }
    // Share: copy a link, or open the phone's share sheet.
    const copy = event.target.closest('[data-share-copy]');
    if(copy) {
      const url = copy.dataset.shareCopy || location.href, label = copy.querySelector('[data-label]') || copy;
      try { await navigator.clipboard.writeText(url); label.textContent = 'Link copied'; } catch { label.textContent = 'Copy the address bar link'; }
      track('share', {via: 'copy', page: pageKind(location.pathname)});
      return;
    }
    const native = event.target.closest('[data-share-native]');
    if(native) { try { await navigator.share({title: native.dataset.shareTitle || document.title, url: native.dataset.shareNative || location.href}); track('share', {via: 'native', page: pageKind(location.pathname)}); } catch {} return; }
    if(event.target.closest('a[data-share-whatsapp]')) track('share', {via: 'whatsapp', page: pageKind(location.pathname)});
  });
  // The phone share sheet only where the browser has one.
  if(typeof navigator.share === 'function') document.querySelectorAll('[data-share-native]').forEach(button => { button.hidden = false; });

  // Recently viewed jobs, for quick search: job pages carry their own details.
  const job = document.querySelector('[data-recent-job]');
  if(job) { try { rememberJob(localStorage, JSON.parse(job.dataset.recentJob)); } catch {} }

  // Campus referral link builder.
  const builder = document.querySelector('[data-ref-builder]');
  if(builder) {
    const field = builder.querySelector('input'), out = builder.querySelector('[data-ref-output]');
    const update = () => {
      const link = referralUrl(field.value, location.origin);
      out.hidden = !link;
      field.setAttribute('aria-invalid', String(!!field.value.trim() && !link));
      builder.querySelector('[data-ref-error]').hidden = !field.value.trim() || !!link;
      if(!link) return;
      out.querySelector('code').textContent = link;
      out.querySelector('[data-share-copy]').dataset.shareCopy = link;
      out.querySelector('[data-share-copy] [data-label]').textContent = 'Copy link';
      out.querySelector('a[data-share-whatsapp]').href = whatsappUrl('Find jobs, internships and hackathons for India on WILSY:', link);
    };
    builder.addEventListener('submit', event => { event.preventDefault(); update(); });
    field.addEventListener('input', update);
  }
}
