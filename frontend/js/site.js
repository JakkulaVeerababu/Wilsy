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

// Header state: a solid bar once the page scrolls, tucked away while reading down the page.
(function headerState(){
  const header=document.querySelector('.site-header');
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
})();
