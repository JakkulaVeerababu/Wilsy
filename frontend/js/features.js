import {track, pageKind} from './analytics.js';
import {rememberJob} from './palette-core.js';
import {deadlineIcs, eventIcs} from './calendar-core.js';
import {readTracker, writeTracker, trackJob, STAGES} from './tracker-core.js';
import {escapeHtml as e} from './directory-core.js';

// Site-wide extras on every page: quick search (Ctrl/⌘ K), share buttons, campus referral links, the
// recently viewed jobs list, calendar reminders, the referral-request writer on job pages, and "Mark as
// applied" / "Did you apply?" for the application tracker. The quick-search dialog loads on first use.

export const PENDING_KEY = 'wilsy-apply-pending';
/** The job a [data-track-job] / [data-apply-job] attribute describes, or null. */
export const readJob = value => { try { const job = JSON.parse(value); return /^\d+$/.test(String(job?.id)) ? job : null; } catch { return null; } };
const stageName = id => STAGES.find(([key]) => key === id)?.[1] || '';
const trackedStage = id => { try { return readTracker(localStorage).items[String(id)]?.stage || null; } catch { return null; } };
/** Put a job on the tracker under Applied (or leave it where it is if it's further on); its stage, or null if storage is blocked. */
function markApplied(job) {
  try { const next = trackJob(readTracker(localStorage), job, 'applied'); writeTracker(localStorage, next); return next.items[String(job.id)]?.stage || null; } catch { return null; }
}

export const REF_KEY = 'wilsy-ref';
/** Campus ambassador codes: lowercase letters, digits and hyphens, 2–24 characters (for example "iitb-07"). */
export const refCode = value => { const v = String(value ?? '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9-]{1,23}$/.test(v) ? v : ''; };
export const referralUrl = (code, origin = 'https://www.wilsy.in') => refCode(code) ? `${origin}/?ref=${refCode(code)}` : '';
export const whatsappUrl = (text, url) => 'https://wa.me/?text=' + encodeURIComponent(`${text} ${url}`.trim());

// A polite referral request for someone who works at the company. "note" fits LinkedIn's 300-character
// connection note; "message" is the longer version with the job link. Nothing typed is sent anywhere.
export const NOTE_LIMIT = 300;
export function referralMessage({me = '', about = '', title = '', company = '', url = '', kind = 'note'} = {}) {
  const name = String(me).trim().slice(0, 60) || '[your name]', who = String(about).trim().slice(0, 120);
  const role = String(title).trim() || 'this', at = String(company).trim() || 'your company';
  if(kind === 'message') return [
    'Hi [Name],', '',
    `I hope you're doing well. I'm ${name}${who ? ', ' + who : ''}, and I'm applying for the ${role} role at ${at}${url ? ': ' + url : '.'}`, '',
    'Would you consider referring me, or pointing me to the right person? I\'m happy to share my resume and answer any questions.', '',
    'Thank you for your time,', name,
  ].join('\n');
  const notes = [
    `Hi [Name], I'm ${name}${who ? ', ' + who : ''}. I'm applying for the ${role} role at ${at} and would be grateful for a referral if you think I'd be a good fit. Happy to share my resume. Thank you!`,
    `Hi [Name], I'm ${name}. I'm applying for the ${role} role at ${at}. Would you be open to referring me? Happy to share my resume. Thanks!`,
  ];
  return notes.find(note => note.length <= NOTE_LIMIT) || notes[1].slice(0, NOTE_LIMIT - 1) + '…';
}

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
    // Deadline reminders: an .ics file for Apple Calendar and Outlook (the Google link is a plain link).
    const ics = event.target.closest('[data-ics]');
    if(ics) {
      let item; try { item = JSON.parse(ics.dataset.ics); } catch { return; }
      const text = item.start ? eventIcs(item) : deadlineIcs(item);
      if(!text) return;
      const url = URL.createObjectURL(new Blob([text], {type: 'text/calendar'})), link = document.createElement('a');
      link.href = url; link.download = `${String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'event'}-${item.start ? 'reminder' : 'deadline'}.ics`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      track('tool_use', {tool: 'calendar'});
    }
    if(event.target.closest('.cal-actions a')) track('tool_use', {tool: 'calendar'});
  });
  // The phone share sheet only where the browser has one.
  if(typeof navigator.share === 'function') document.querySelectorAll('[data-share-native]').forEach(button => { button.hidden = false; });

  // Recently viewed jobs, for quick search: job pages carry their own details.
  const job = document.querySelector('[data-recent-job]');
  if(job) { try { rememberJob(localStorage, JSON.parse(job.dataset.recentJob)); } catch {} }

  // Ask for a referral (job pages): rebuild the message as the visitor types; copy it to the clipboard.
  const asker = document.querySelector('[data-referral]');
  if(asker) {
    let job = {}; try { job = JSON.parse(asker.dataset.referral); } catch {}
    const text = asker.querySelector('[data-referral-text]'), count = asker.querySelector('[data-referral-count]');
    const value = name => asker.querySelector(`[name="${name}"]`);
    const kind = () => asker.querySelector('[name="referral-kind"]:checked')?.value || 'note';
    const update = () => {
      text.value = referralMessage({...job, me: value('me').value, about: value('about').value, kind: kind()});
      count.textContent = kind() === 'note' ? `${text.value.length} / ${NOTE_LIMIT} characters` : `${text.value.length} characters`;
    };
    asker.addEventListener('input', event => { if(event.target !== text) update(); else count.textContent = `${text.value.length}${kind() === 'note' ? ' / ' + NOTE_LIMIT : ''} characters`; });
    asker.addEventListener('change', event => { if(event.target.name === 'referral-kind') update(); });
    if(location.hash === '#ask-referral') { asker.open = true; asker.scrollIntoView({block: 'start'}); }
    asker.querySelector('[data-referral-copy]').addEventListener('click', async event => {
      const label = event.currentTarget;
      try { await navigator.clipboard.writeText(text.value); label.textContent = 'Message copied'; } catch { text.select(); label.textContent = 'Press Ctrl+C to copy'; }
      track('tool_use', {tool: 'referral'});
    });
    update();
  }

  // Mark as applied (job pages): puts the job on the tracker under Applied.
  const marker = document.querySelector('[data-track-job]');
  const markedJob = marker && readJob(marker.dataset.trackJob);
  const appliedLink = stage => Object.assign(document.createElement('a'), {className: 'secondary-button is-tracked', href: '/tracker', textContent: `${stageName(stage)} ✓ · Your tracker`});
  if(markedJob) {
    const stage = trackedStage(markedJob.id);
    if(stage && stage !== 'saved') marker.replaceWith(appliedLink(stage));
    else {
      marker.hidden = false;
      marker.addEventListener('click', () => {
        const done = markApplied(markedJob);
        if(done) { const link = appliedLink(done); marker.replaceWith(link); link.focus(); track('tool_use', {tool: 'mark_applied', via: 'button'}); }
      });
    }
  }

  // "Did you apply?": after the Apply link opens the employer's site, ask once when the visitor comes back.
  const remember = event => {
    if(event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest?.('a[data-apply-job]'), applied = link && readJob(link.dataset.applyJob);
    if(!applied) return;
    const stage = trackedStage(applied.id);
    if(stage && stage !== 'saved') return;
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({job: applied, at: Date.now()})); } catch {}
  };
  document.addEventListener('click', remember, true);
  document.addEventListener('auxclick', remember, true);
  let prompt;
  const closePrompt = () => { prompt?.remove(); prompt = null; };
  function ask(pending) {
    closePrompt();
    prompt = document.createElement('div');
    prompt.className = 'apply-prompt';
    prompt.setAttribute('role', 'dialog');
    prompt.setAttribute('aria-labelledby', 'apply-prompt-title');
    prompt.innerHTML = `<p id="apply-prompt-title"><strong>Did you apply?</strong><span>${e(pending.title)} at ${e(pending.company)}</span></p><div class="apply-prompt-actions"><button type="button" class="primary-button" data-applied>Yes, track it</button><button type="button" class="secondary-button" data-not-yet>Not yet</button></div><button type="button" class="apply-prompt-close" data-not-yet aria-label="Close">×</button>`;
    prompt.addEventListener('click', event => {
      if(event.target.closest('[data-not-yet]')) { closePrompt(); return; }
      if(!event.target.closest('[data-applied]')) return;
      const stage = markApplied(pending);
      if(!stage) { closePrompt(); return; }
      // Same job as this page's "Mark as applied" button: show it as tracked too.
      if(marker?.isConnected && String(markedJob?.id) === String(pending.id)) marker.replaceWith(appliedLink(stage));
      prompt.innerHTML = `<p id="apply-prompt-title" role="status"><strong>Added to your tracker</strong><span>Under ${e(stageName(stage))}. Add the interview date there when you hear back.</span></p><div class="apply-prompt-actions"><a class="primary-button" href="/tracker">Open the tracker</a></div><button type="button" class="apply-prompt-close" data-not-yet aria-label="Close">×</button>`;
      prompt.querySelector('a').focus({preventScroll: true});
      track('tool_use', {tool: 'mark_applied', via: 'prompt'});
      setTimeout(() => { if(prompt && !prompt.contains(document.activeElement)) closePrompt(); }, 12000);
    });
    prompt.addEventListener('keydown', event => { if(event.key === 'Escape') closePrompt(); });
    document.body.append(prompt);
    prompt.querySelector('[data-applied]').focus({preventScroll: true});
  }
  const askIfBack = () => {
    if(document.visibilityState !== 'visible') return;
    let pending; try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch {}
    const away = Date.now() - Number(pending?.at || 0);
    if(!readJob(JSON.stringify(pending?.job || null)) || away < 8000) return; // back within seconds: probably didn't apply yet
    try { sessionStorage.removeItem(PENDING_KEY); } catch {}
    const stage = trackedStage(pending.job.id);
    if(away < 6 * 36e5 && !(stage && stage !== 'saved')) ask(pending.job);
  };
  document.addEventListener('visibilitychange', askIfBack);
  addEventListener('pageshow', askIfBack);

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

// Back to top and a thin reading-progress bar, on every page. Both appear only once the page has been
// scrolled well past the first screen; the button moves focus to the top so keyboard users land there too.
if(globalThis.document) {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
  const top = document.createElement('button');
  top.type = 'button'; top.className = 'back-to-top'; top.hidden = true;
  top.setAttribute('aria-label', 'Back to top'); top.title = 'Back to top';
  top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.append(bar, top);
  let queued = false;
  const sync = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight, y = scrollY;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    top.hidden = y < innerHeight * 1.2;
  };
  addEventListener('scroll', () => { if(!queued) { queued = true; requestAnimationFrame(sync); } }, {passive: true});
  addEventListener('resize', sync); sync();
  top.addEventListener('click', () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({top: 0, behavior: reduce ? 'auto' : 'smooth'});
    const target = document.querySelector('#main-content') || document.body;
    if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll: true});
  });
}
