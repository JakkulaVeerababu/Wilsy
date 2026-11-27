import crypto from 'node:crypto';
import {site} from '../js/site-config.js';
import {escapeHtml as e} from '../js/directory-core.js';
import {icon} from '../js/icons.js';
import {brandLink, themeToggle} from './brand.mjs';
import {browseRoles,browseStages} from './landing-pages.mjs';
import {searchConsoleTag} from './search-console.mjs';

// The page shell every WILSY page shares: head, header, footer and the CSS bundle.
// Used by the static build (build-site.mjs) and by the on-demand job-page function (api/job-page.mjs),
// so both produce the same page around their content.

// Pages that sit under "Tools" in the main navigation.
const TOOL_PAGES = new Set(['tools','my-wilsy','tracker','salaries','salary-calculator','offer-compare','resume-match','copy-check','apply-kit','hiring-trends','scam-check','salary-hike-calculator','gratuity-calculator','notice-period-calculator','career-letters','resume-builder','deadlines','age-calculator','typing-test','full-and-final-settlement','interview-answers','government-salary-calculator','epf-calculator','cgpa-calculator','experience-calculator','skills','embed']);
export function header(active='') {
  const links=[['/jobs','Find jobs','jobs'],['/government-jobs','Gov jobs','government-jobs'],['/companies#companies','Companies','companies'],['/hackathons','Hackathons','hackathons'],['/tools','Tools','tools'],['/dsa','DSA roadmap','dsa'],['/guides','Career guides','guides']];
  const current = key => key===active || (key==='tools' && TOOL_PAGES.has(active));
  return `<header class="site-header"><div class="header-inner">${brandLink()}<button class="nav-search" type="button" data-palette-open aria-label="Quick search" aria-keyshortcuts="Control+K Meta+K">${icon('search')}<span class="nav-search-label">Search</span></button><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"><span class="nav-toggle-lines" aria-hidden="true"></span><span>Menu</span></button><nav class="main-nav" id="main-navigation" aria-label="Main navigation">${links.map(([url,name,key])=>`<a href="${url}"${current(key)?` class="active"${key===active?' aria-current="page"':''}`:''}>${name}</a>`).join('')}${themeToggle}<a class="nav-cta" href="/jobs">Start searching ${icon('arrow')}</a></nav></div></header>`;
}
// The footer: a large line on the left, link columns on the right (the copyright and salary note sit under the account link),
// and a large "wilsy.in" to close the page (decorative, so hidden from screen readers).
export function footer() {
  return `<footer class="site-footer premium-footer"><div class="footer-main">
    <div class="footer-intro"><p>A clearer view of <em>your next move.</em></p><span>Jobs, internships, government notices and hackathons for India. Every listing links to its source.</span><div class="footer-newsletter"><p class="footer-label">Free account</p><a href="/jobs?saved=1" data-account-open>Create a free account ${icon('arrow')}</a><small>Save jobs, hackathons and searches on every device. No password needed.</small></div><p class="footer-legal">© 2026 WILSY. Published salary examples, not guaranteed offers. Company logos belong to their respective owners.</p></div>
    <div class="footer-col"><nav aria-label="Jobs"><h2>Jobs</h2><a href="/jobs">Find jobs</a><a href="/government-jobs">Government jobs</a>${[...browseRoles.slice(0,4),...browseStages.slice(0,3)].map(([url,name])=>`<a href="${url}">${e(name)}</a>`).join('')}<a href="/skills">Jobs by skill</a><a href="/companies#companies">Company directory</a><a href="/companies/all">All companies A–Z</a></nav></div>
    <div class="footer-col"><nav aria-label="Opportunities"><h2>Opportunities</h2><a href="/hackathons">Hackathons</a><a href="/competitions">Competitions</a><a href="/contests">Coding contests</a><a href="/events">Workshops &amp; events</a><a href="/open-source-programs">Open-source programs</a><a href="/research-internships">Research internships</a><a href="/scholarships">Scholarships</a><a href="/free-courses">Free courses</a><a href="/startup-grants">Startup grants</a><a href="/deadlines">Deadlines calendar</a></nav></div>
    <div class="footer-col"><nav aria-label="Prepare"><h2>Prepare</h2><a href="/resume-builder">Resume builder</a><a href="/resume-match">Resume match</a><a href="/copy-check">Copy check</a><a href="/apply-kit">Apply kit</a><a href="/tracker">Application tracker</a><a href="/interview-answers">Interview answers</a><a href="/dsa">DSA roadmap</a><a href="/guides">Career guides</a><a href="/career-letters">Resignation and offer letters</a><a href="/scam-check">Job scam check</a><a href="/cgpa-calculator">CGPA to percentage</a><a href="/typing-test">Typing speed test</a><a href="/age-calculator">Age calculator</a><a href="/tools">All career tools</a></nav></div>
    <div class="footer-col"><nav aria-label="Salary and pay"><h2>Salary &amp; pay</h2><a href="/salaries">Salary explorer</a><a href="/hiring-trends">Hiring trends</a><a href="/salary-calculator">In-hand salary calculator</a><a href="/salary-hike-calculator">Salary hike calculator</a><a href="/offer-compare">Compare job offers</a><a href="/government-salary-calculator">Government salary calculator</a><a href="/epf-calculator">EPF calculator</a><a href="/gratuity-calculator">Gratuity calculator</a><a href="/notice-period-calculator">Notice period calculator</a><a href="/full-and-final-settlement">Full and final settlement</a><a href="/experience-calculator">Work experience calculator</a></nav></div>
    <div class="footer-col"><nav aria-label="Company"><h2>Company</h2><a href="/">Home</a><a href="/about">About WILSY</a><a href="/methodology">Sources &amp; methodology</a><a href="/employers">For employers</a><a href="/campus">Campus ambassadors</a><a href="/embed">Jobs widget for your site</a><a href="/feed.xml">New jobs RSS feed</a><a href="/contact">Contact &amp; corrections</a><a href="mailto:${site.email}">${site.email}</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/pricing">Pricing for employers</a><a href="/refund-policy">Cancellation &amp; refunds</a><a href="/disclosure">Ads &amp; affiliate disclosure</a><a href="/grievance">Grievance officer</a><a href="/content-removal">Content removal</a><a href="/privacy#choices" data-privacy-choices>Privacy &amp; cookie choices</a></nav></div>
  </div><div class="footer-base" aria-hidden="true"><div class="footer-giant">wilsy<span>.in</span></div></div></footer>`;
}
export const jsonld = value => `<script type="application/ld+json">${JSON.stringify(value).replace(/</g,'\\u003c')}</script>`;
// Ads run only on pages of original writing (guides, About, methodology, interview answers, scam check,
// government jobs). Directory, listing, calculator and policy pages stay ad-free: AdSense rejects ads on
// template-generated pages. The script sits in the head, as Google recommends, so its reviewers detect it.
// Every page, ad-free ones included, carries the AdSense account tag: Google reads it on the homepage to
// confirm the site belongs to the account. It shows no ads; adTag (the script) is what loads them.
const adsAccount = `<meta name="google-adsense-account" content="${site.publisher}">`;
const adTag = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.publisher}" crossorigin="anonymous"></script>`;
export function documentPage({hero=true,title,description,route,body,active='',type='website',noindex=false,ads=false,structured,canonicalRoute=route}) {
  const url = site.origin+canonicalRoute;
  const isHome = route === '/';
  const legacy = isHome || active==='dsa' ? [] : ['editorial',...(active==='jobs'?['jobs']:['hackathons','competitions','events','contests','open-source','research','scholarships','courses','grants'].includes(active)?['hackathons']:active==='government-jobs'?['government-jobs']:[]),'polish', 'refined',...(active==='jobs'?['job-workspace']:[])];
  const pageCss = [...legacy,'tokens','electric','shell',...(isHome||active==='jobs'?['jobs-premium']:[]),...(isHome?['homepage']:active==='dsa'?['dsa']:[]),'premium','account','features'].map(name=>`<link rel="stylesheet" href="/css/${name}.css">`).join('');
  // Light mode by default; dark only when the visitor has chosen it with the toggle.
  const themeInit = "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark-theme')}catch{}";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><script>${themeInit}</script><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0866ff"><title>${e(title)} — WILSY</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${e(url)}"><link rel="alternate" type="application/rss+xml" title="WILSY: newest jobs" href="/feed.xml"><meta property="og:type" content="${type}"><meta property="og:title" content="${e(title)} — WILSY"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(url)}"><meta property="og:site_name" content="WILSY"><meta property="og:locale" content="en_IN"><meta property="og:image" content="${site.origin}/assets/og-default.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="WILSY: find the work that moves you forward."><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${site.origin}/assets/og-default.png">${noindex?'<meta name="robots" content="noindex,follow">':''}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/assets/site.webmanifest"><link rel="preload" href="/assets/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/css/styles.css">${pageCss}<script src="/js/site.js" defer></script><script type="module" src="/js/account.js"></script>${adsAccount}${ads?adTag:''}${structured?jsonld(structured):''}</head><body class="${hero?'has-hero ':''}${isHome?'home-page':active==='jobs'?'jobs-page':active==='dsa'?'dsa-page':active?active+'-page':'editorial-page'}"><a class="skip-link" href="#main-content">Skip to content</a>${header(active==='jobs-landing'?'jobs':active)}${body.replaceAll('href="/?company=','href="/jobs?company=')}${footer()}</body></html>`;
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

// A short id for this deployment. VERCEL_DEPLOYMENT_ID is set both while building and in functions,
// so static pages and job-page function pages of one deploy name the same build. Empty elsewhere.
export const deploymentBuildId = (env=process.env) => env.VERCEL_DEPLOYMENT_ID
  ? crypto.createHash('sha256').update(String(env.VERCEL_DEPLOYMENT_ID)).digest('hex').slice(0,12) : '';
// Worked out once per token, so a malformed one warns once rather than for every page.
const gsc = new Map();
const gscTag = token => { if(!gsc.has(token)) gsc.set(token, searchConsoleTag(token)); return gsc.get(token); };
/**
 * What every page's head ends with, in the static build and in the job-page function alike:
 * the build id the service worker compares (when known), the Search Console tag, the worker registration
 * (js/pwa.js) and analytics. A page without a build id still works; the worker fetches its files fresh.
 */
export function finishHead(html, {env=process.env, buildId=deploymentBuildId(env)}={}) {
  const build = /^[0-9a-f]{6,64}$/.test(buildId) ? `<meta name="wilsy-build" content="${buildId}">` : '';
  return html.replace('<meta charset="utf-8">', match => match + build)
    .replace('</head>', () => `${gscTag(env.WILSY_GSC_TOKEN)}<script type="module" src="/js/pwa.js"></script><script type="module" src="/js/features.js"></script>${analyticsTag(env)}</head>`);
}
