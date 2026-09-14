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

// Reveal a small number of editorial sections once; live results keep their own states.
// Content is visible by default, including when JavaScript or animation APIs are unavailable.
function mountSectionMotion(){
  if(!window.matchMedia||!window.IntersectionObserver||typeof window.Element?.prototype.animate!=='function')return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets=[...document.querySelectorAll('.platform-path,.tier-section,.guides-heading,.guide-card,.jobs-explainer article,.hack-principles article,.related-grid>a,.editorial-cta')];
  const played=new WeakSet(),running=new Set();
  const observer=new window.IntersectionObserver(entries=>{
    let order=0;
    for(const entry of entries){
      if(!entry.isIntersecting||played.has(entry.target))continue;
      observer.unobserve(entry.target);played.add(entry.target);
      if(preference.matches||document.hidden||entry.target.contains(document.activeElement))continue;
      const animation=entry.target.animate(
        [{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:440,delay:(order++%3)*45,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}
      );
      running.add(animation);
      const release=()=>running.delete(animation);animation.finished.then(release,release);
    }
  },{rootMargin:'0px 0px 32px 0px',threshold:.01});
  const update=()=>{
    observer.disconnect();
    if(preference.matches){for(const animation of running)animation.cancel();running.clear();return;}
    for(const target of targets)if(!played.has(target))observer.observe(target);
  };
  preference.addEventListener?.('change',update);update();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const animation of running)animation.cancel();running.clear();}});
}
mountSectionMotion();
