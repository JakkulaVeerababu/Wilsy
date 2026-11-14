// Google Search Console ownership: the meta tag's content value comes from WILSY_GSC_TOKEN
// (set in Vercel). No token is committed; without one, no tag is added. Pasting the whole
// <meta> tag works too. A malformed value is skipped with a warning rather than failing the deploy.
export function searchConsoleTag(token = '', warn = console.warn) {
  let value = String(token ?? '').trim();
  value = (/content\s*=\s*["']([^"']*)["']/i.exec(value) || [, value])[1].trim();
  if(!value) return '';
  if(!/^[A-Za-z0-9_-]{20,100}$/.test(value)) { warn('WILSY_GSC_TOKEN is not a Search Console verification code; no verification tag was added.'); return ''; }
  return `<meta name="google-site-verification" content="${value}">`;
}
