import crypto from 'node:crypto';
import {site} from '../js/site-config.js';
import {escapeHtml as e} from '../js/directory-core.js';
import {icon} from '../js/icons.js';
import {brandLink, themeToggle} from './brand.mjs';
import {browseRoles,browseStages} from './landing-pages.mjs';

// The page shell every WILSY page shares: head, header, footer and the CSS bundle.
// Used by the static build (build-site.mjs) and by the on-demand job-page function (api/job-page.mjs),
// so both produce the same page around their content.

export function header(active='') {
  const links=[['/jobs','Jobs','jobs'],['/government-jobs','Government','government-jobs'],['/companies#companies','Companies','companies'],['/hackathons','Hackathons','hackathons'],['/dsa','DSA','dsa'],['/guides','Guides','guides']];
  return `<header class="site-header"><div class="header-inner">${brandLink()}<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"><span class="nav-toggle-lines" aria-hidden="true"></span><span>Menu</span></button><nav class="main-nav" id="main-navigation" aria-label="Main navigation">${links.map(([url,name,key])=>`<a href="${url}"${key===active?' class="active" aria-current="page"':''}>${name}</a>`).join('')}${themeToggle}<a class="nav-cta" href="/jobs">Search jobs ${icon('arrow')}</a></nav></div></header>`;
}
export function footer() {
  return `<footer class="site-footer premium-footer"><div class="footer-main">
    <div class="footer-intro">${brandLink()}<p>A clearer view of your next move.</p><span>Jobs, internships, government notices and hackathons for India. Every listing links to its source.</span><div class="footer-newsletter"><p class="footer-label">FREE ACCOUNT</p><a href="/jobs?saved=1" data-account-open>Create a free account ${icon('arrow')}</a><small>Save jobs, hackathons and searches on every device. No password needed.</small></div></div>
    <nav aria-label="Explore Wilsy"><h2>EXPLORE</h2><a href="/">Home</a><a href="/jobs">Find jobs</a><a href="/government-jobs">Government jobs</a><a href="/hackathons">Hackathons</a><a href="/companies#companies">Company directory</a><a href="/companies/all">All companies A–Z</a></nav>
    <nav aria-label="Popular searches"><h2>POPULAR SEARCHES</h2>${[...browseRoles.slice(0,4),...browseStages.slice(0,3)].map(([url,name])=>`<a href="${url}">${e(name)}</a>`).join('')}</nav>
    <nav aria-label="About Wilsy"><h2>LEARN &amp; CONNECT</h2><a href="/dsa">DSA roadmap</a><a href="/guides">Career guides</a><a href="/about">About WILSY</a><a href="/methodology">Sources &amp; methodology</a><a href="/contact">Contact &amp; corrections</a><a href="mailto:${site.email}">${site.email}</a></nav>
    <nav aria-label="Policies"><h2>THE DETAILS</h2><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/disclosure">Ads &amp; affiliate disclosure</a><a href="/privacy#choices" data-privacy-choices>Privacy &amp; cookie choices</a></nav>
  </div><div class="footer-bottom"><span>© 2026 WILSY</span><p>Published salary examples, not guaranteed offers. Company logos belong to their respective owners.</p><span>Made for your next move</span></div></footer>`;
}
export const jsonld = value => `<script type="application/ld+json">${JSON.stringify(value).replace(/</g,'\\u003c')}</script>`;
// AdSense loads once the page is idle so it never competes with the content for bandwidth.
const adTag = `<meta name="google-adsense-account" content="${site.publisher}"><script>addEventListener('load',()=>(window.requestIdleCallback||setTimeout)(()=>{const s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.publisher}';document.head.append(s)},{timeout:4000}))</script>`;
export function documentPage({hero=true,title,description,route,body,active='',type='website',noindex=false,ads=true,structured,canonicalRoute=route}) {
  const url = site.origin+canonicalRoute;
  const isHome = route === '/';
  const legacy = isHome || active==='dsa' ? [] : ['editorial',...(active==='jobs'?['jobs']:active==='hackathons'?['hackathons']:active==='government-jobs'?['government-jobs']:[]),'polish', 'refined',...(active==='jobs'?['job-workspace']:[])];
  const pageCss = [...legacy,'tokens','electric','shell',...(isHome||active==='jobs'?['jobs-premium']:[]),...(isHome?['homepage']:active==='dsa'?['dsa']:[]),'premium','account'].map(name=>`<link rel="stylesheet" href="/css/${name}.css">`).join('');
  // Light mode by default; dark only when the visitor has chosen it with the toggle.
  const themeInit = "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark-theme')}catch{}";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><script>${themeInit}</script><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0866ff"><title>${e(title)} — WILSY</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${e(url)}"><meta property="og:type" content="${type}"><meta property="og:title" content="${e(title)} — WILSY"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(url)}"><meta property="og:site_name" content="WILSY"><meta property="og:locale" content="en_IN"><meta property="og:image" content="${site.origin}/assets/og-default.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="WILSY: find the work that moves you forward."><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${site.origin}/assets/og-default.png">${noindex?'<meta name="robots" content="noindex,follow">':''}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/assets/site.webmanifest"><link rel="preload" href="/assets/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/css/styles.css">${pageCss}<script src="/js/site.js" defer></script><script type="module" src="/js/account.js"></script>${ads?adTag:''}${structured?jsonld(structured):''}</head><body class="${hero?'has-hero ':''}${isHome?'home-page':active==='jobs'?'jobs-page':active==='dsa'?'dsa-page':active?active+'-page':'editorial-page'}"><a class="skip-link" href="#main-content">Skip to content</a>${header(active==='jobs-landing'?'jobs':active)}${body.replaceAll('href="/?company=','href="/jobs?company=')}${footer()}</body></html>`;
}

// Every page gets one minified, content-hashed stylesheet built from its /css/*.css links, in order.
// The file name depends only on the CSS sources, so the build and the job-page function agree on it.
// data-sources lists the source files so tests and readers can see what a bundle contains.
const stylesheetTag = () => /<link rel="stylesheet" href="\/css\/([a-z0-9-]+)\.css">/g;
export const minifyCss = source => source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').replace(/\s*([{};,])\s*/g,'$1').replace(/;}/g,'}').trim();
export const cssBundleFile = css => 'b-'+crypto.createHash('sha256').update(css).digest('hex').slice(0,12)+'.css';
/**
 * Replace a page's /css/<name>.css links with one bundle link.
 * read(name) returns a stylesheet's source; save(file, css) stores a new bundle (the build writes it to dist).
 * cache maps a list of names to its bundle file, so each bundle is built once.
 */
export async function bundleCss(html, {read, save=async()=>{}, cache=new Map()}) {
  const names = [...html.matchAll(stylesheetTag())].map(m=>m[1]);
  if(!names.length) return html;
  const key = names.join(' ');
  if(!cache.has(key)) {
    const css = minifyCss((await Promise.all(names.map(read))).join('\n'));
    const file = cssBundleFile(css);
    await save(file, css);
    cache.set(key, file);
  }
  let first = true;
  return html.replace(stylesheetTag(),()=>first?(first=false,`<link rel="stylesheet" href="/css/${cache.get(key)}" data-sources="${key}">`):'');
}
// Vercel Web Analytics is cookie-free and served only by Vercel deployments (VERCEL is set at build and run time).
export const analyticsTag = (env=process.env) => env.VERCEL ? `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>` : '';
