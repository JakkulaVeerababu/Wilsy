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

const menuButton=document.querySelector('.nav-toggle');
const navigation=document.querySelector('#main-navigation');
function closeNavigation(){
  navigation?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded','false');
}
menuButton?.addEventListener('click',()=>{
  const open=navigation.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded',String(open));
});
navigation?.addEventListener('click',event=>{if(event.target.closest('a'))closeNavigation();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menuButton?.getAttribute('aria-expanded')==='true'){
    closeNavigation();menuButton.focus();
  }
});
document.addEventListener('click',event=>{
  if(!event.target.closest('.header-inner'))closeNavigation();
});


document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    // The control is an icon; its label always names the theme it switches to.
    const sync = () => {
      const isDark = document.documentElement.classList.contains('dark-theme');
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggle.title = isDark ? 'Light mode' : 'Dark mode';
    };
    sync();
    toggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark-theme');
      try{localStorage.setItem('theme', isDark ? 'dark' : 'light');}catch{}
      sync();
    });
  }
});

// Premium motion: header states, scroll reveals, card spotlight and counters.
// Content stays visible without JavaScript or when the visitor prefers reduced motion.
(function premiumMotion(){
  const root=document.documentElement,header=document.querySelector('.site-header');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let lastY=window.scrollY,ticking=false;
  const onScroll=()=>{
    ticking=false;
    const y=window.scrollY,menuOpen=document.querySelector('#main-navigation.is-open');
    header?.classList.toggle('is-scrolled',y>24);
    if(header&&!reduced&&!menuOpen&&!header.contains(document.activeElement)){
      if(y>420&&y-lastY>6)header.classList.add('is-hidden');
      else if(lastY-y>6||y<=420)header.classList.remove('is-hidden');
    }
    lastY=y;
  };
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
  onScroll();
  if(reduced||!('IntersectionObserver' in window))return;
  root.classList.add('js-motion');

  const heroes='.jobs-page-heading,.gov-jobs-hero,.hack-hero,.dsa-intro,.page-shell>.intro,.editorial-hero,.profile-hero,.home-hero';
  const auto=[
    'main section>:is(h2,[class*=heading],[class*=kicker],header)',
    '.guide-card','.tier-card','.related-grid>a','.gov-jobs-metrics>div','.gov-exam-browse-grid>*','.gov-jobs-notice',
    '.hack-principles article','.hack-principles>div','.dsa-start article','.dsa-workspace','.dsa-library',
    '.profile-pay-panel','.profile-sidebar>*','.prose>h2','.contact-box','.article-aside','.footer-main>*','.footer-giant'
  ].join(',');
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList.add('is-in');observer.unobserve(entry.target);}
  },{rootMargin:'0px 0px -6% 0px',threshold:.06});
  const mount=()=>{
    const seen=new Map();
    document.querySelectorAll(auto).forEach(el=>{
      if(el.closest(heroes)||el.classList.contains('reveal'))return;
      const order=seen.get(el.parentElement)||0;seen.set(el.parentElement,order+1);
      el.classList.add('reveal');el.style.transitionDelay=`${Math.min(order,5)*70}ms`;
    });
    document.querySelectorAll('.reveal:not(.is-in)').forEach(el=>{
      // Anything already on screen appears immediately rather than waiting for a scroll.
      if(el.getBoundingClientRect().top<innerHeight*.9){requestAnimationFrame(()=>el.classList.add('is-in'));return;}
      observer.observe(el);
    });
  };

  // A soft light follows the pointer across cards.
  const spot='.guide-card,.company-card,.related-grid>a,.hack-card,.job-result-card,.tier-card,.home-guide-card,.home-featured-company,.home-studio-grid a,.gov-jobs-metrics>div';
  let lit=null;
  document.addEventListener('pointermove',event=>{
    const card=event.pointerType==='mouse'&&event.target.closest?.(spot);
    if(lit&&lit!==card){lit.classList.remove('spot-on');lit=null;}
    if(!card)return;
    const box=card.getBoundingClientRect();
    card.style.setProperty('--mx',`${event.clientX-box.left}px`);card.style.setProperty('--my',`${event.clientY-box.top}px`);
    if(!lit){card.classList.add('spot-on');lit=card;}
  },{passive:true});

  // Static hero figures count up once when they first appear.
  const countUp=el=>{
    const text=el.textContent.trim();if(!/^[\d,]+$/.test(text))return;
    const end=Number(text.replace(/,/g,'')),pad=text.length,began=performance.now(),indian=text.includes(',');
    const fmt=n=>indian?n.toLocaleString('en-IN'):String(n).padStart(pad,'0');
    const tick=now=>{const p=Math.min(1,(now-began)/1200),eased=1-Math.pow(1-p,4);el.textContent=fmt(Math.round(end*eased));if(p<1)requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  };
  const counters=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){counters.unobserve(entry.target);countUp(entry.target);}},{threshold:.4});
  const mountCounters=()=>document.querySelectorAll('.gov-jobs-hero-panel>strong,.gov-jobs-metrics strong,.dsa-intro-note dd,.employer-preview-heading strong,.note-number').forEach(el=>counters.observe(el));

  const start=()=>{mount();mountCounters();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
