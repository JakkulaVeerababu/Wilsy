import {CERTS_KEY, MAX_CERTS, STATUSES, CATALOG, catalogItem, cleanCert, readCerts, certNote, certSummary, sortCerts, skillsToAdd} from './certs-core.js';
import {PROFILE_KEY, MAX_SKILLS, readProfile} from './my-wilsy-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /certifications: the list lives in this browser's localStorage and never leaves the device.
const root = document.querySelector('[data-certs]');

if(root) {
  const $ = selector => root.querySelector(selector);
  const form = $('[data-cert-form]'), list = $('[data-cert-list]'), status = $('[data-cert-status]'), submit = $('[data-cert-submit]'), cancel = $('[data-cert-cancel]');
  const field = name => form.elements.namedItem(name);
  let certs = [], editing = '', counted = false;
  try { certs = readCerts(localStorage.getItem(CERTS_KEY)); } catch {}

  const save = message => {
    try { localStorage.setItem(CERTS_KEY, JSON.stringify(certs)); status.textContent = message || 'Saved on this device.'; }
    catch { status.textContent = 'Your browser is not keeping data, so this list lasts for this visit only.'; }
  };
  const statusName = id => (STATUSES.find(([key]) => key === id) || STATUSES[0])[1];
  const dateText = value => value ? new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z')) : '';

  const showDates = () => {
    const earned = field('status').value === 'earned';
    root.querySelectorAll('[data-when="earned"]').forEach(el => { el.hidden = !earned; });
    root.querySelectorAll('[data-when="planned"]').forEach(el => { el.hidden = earned; });
  };

  const render = () => {
    const sorted = sortCerts(certs), sum = certSummary(certs);
    let profileSkills = [];
    try { profileSkills = readProfile(localStorage.getItem(PROFILE_KEY)).skills; } catch {}
    const add = skillsToAdd(certs, profileSkills);
    if(!certs.length) { list.innerHTML = '<p class="match-empty">Nothing tracked yet. Add a certification above, or pick one from the list below.</p>'; return; }
    list.innerHTML = `<p class="certs-summary">${sum.total} tracked: ${sum.studying} studying, ${sum.planned} planned, ${sum.earned} earned${sum.attention ? `. <strong>${sum.attention} need${sum.attention === 1 ? 's' : ''} attention.</strong>` : '.'}</p>
      ${add.length ? `<p class="certs-skills">Your earned certifications show ${e(add.join(', '))}. <button class="text-button" type="button" data-add-skills>Add to My WILSY skills</button></p>` : ''}
      <ul class="certs-list">${sorted.map(cert => {
        const note = certNote(cert), official = catalogItem(cert.catalog)?.[3];
        const dates = cert.status === 'earned'
          ? [cert.earned && `Earned ${dateText(cert.earned)}`, cert.expires && `Valid until ${dateText(cert.expires)}`].filter(Boolean).join(' · ')
          : cert.target ? `Target ${dateText(cert.target)}` : 'No target date';
        return `<li class="cert-item is-${e(cert.status)}"><div class="cert-main"><span class="cert-status">${e(statusName(cert.status))}</span><strong>${e(cert.name)}</strong>
          <span class="cert-meta">${[cert.issuer, dates].filter(Boolean).map(e).join(' · ')}</span>${note ? `<span class="cert-note is-${e(note.kind)}">${e(note.text)}</span>` : ''}</div>
          <div class="cert-actions">${official ? `<a href="${e(official)}" target="_blank" rel="noopener">Official page</a>` : ''}${cert.credential ? `<a href="${e(cert.credential)}" target="_blank" rel="noopener nofollow">Credential</a>` : ''}
          <button class="text-button" type="button" data-edit="${e(cert.id)}">Edit</button><button class="text-button" type="button" data-remove="${e(cert.id)}">Remove</button></div></li>`;
      }).join('')}</ul>`;
  };

  const resetForm = () => { form.reset(); editing = ''; submit.textContent = 'Add certification'; cancel.hidden = true; showDates(); };
  const fill = cert => {
    for(const name of ['name', 'issuer', 'status', 'target', 'earned', 'expires', 'credential']) field(name).value = cert[name] || '';
    field('catalog').value = cert.catalog || '';
    showDates();
  };

  form.addEventListener('input', event => {
    if(event.target.name === 'name') {
      const match = CATALOG.find(c => c[1].toLowerCase() === event.target.value.trim().toLowerCase());
      field('catalog').value = match ? match[0] : '';
      if(match && !field('issuer').value) field('issuer').value = match[2];
    }
    if(event.target.name === 'status') showDates();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const raw = Object.fromEntries(['name', 'issuer', 'status', 'target', 'earned', 'expires', 'credential', 'catalog'].map(name => [name, field(name).value]));
    if(raw.credential && !/^https:\/\//i.test(raw.credential.trim())) { status.textContent = 'The credential link must start with https://'; return; }
    const cert = cleanCert({...raw, id: editing || `${raw.catalog || 'cert'}-${Date.now().toString(36)}`});
    if(!cert) { status.textContent = 'Give the certification a name.'; field('name').focus(); return; }
    if(!editing && certs.length >= MAX_CERTS) { status.textContent = `You can track up to ${MAX_CERTS} certifications.`; return; }
    certs = editing ? certs.map(c => c.id === editing ? cert : c) : [...certs, cert];
    save(editing ? 'Updated. Saved on this device.' : 'Added. Saved on this device.');
    if(!counted) { counted = true; track('tool_use', {tool: 'certifications'}); }
    resetForm(); render();
  });
  cancel.addEventListener('click', () => { resetForm(); status.textContent = ''; });

  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if(!target) return;
    if(target.dataset.edit) {
      const cert = certs.find(c => c.id === target.dataset.edit);
      if(cert) { editing = cert.id; fill(cert); submit.textContent = 'Save changes'; cancel.hidden = false; form.scrollIntoView({behavior: 'smooth', block: 'start'}); field('name').focus({preventScroll: true}); }
    } else if(target.dataset.remove) {
      const cert = certs.find(c => c.id === target.dataset.remove);
      if(cert && confirm(`Remove “${cert.name}” from your list?`)) { certs = certs.filter(c => c.id !== cert.id); if(editing === cert.id) resetForm(); save('Removed.'); render(); }
    } else if(target.dataset.trackCert) {
      const item = catalogItem(target.dataset.trackCert);
      if(!item) return;
      resetForm(); fill({name: item[1], issuer: item[2], catalog: item[0], status: 'planned'});
      form.scrollIntoView({behavior: 'smooth', block: 'start'}); field('target').focus({preventScroll: true});
      status.textContent = `Set a target date if you like, then add “${item[1]}”.`;
    } else if(target.hasAttribute('data-add-skills')) {
      try {
        const profile = readProfile(localStorage.getItem(PROFILE_KEY));
        const skills = [...profile.skills, ...skillsToAdd(certs, profile.skills)].slice(0, MAX_SKILLS);
        localStorage.setItem(PROFILE_KEY, JSON.stringify({...profile, skills}));
        status.innerHTML = 'Added to your skills. <a href="/my-wilsy">See your matches in My WILSY</a>';
      } catch { status.textContent = 'Your browser is not keeping data, so the skills could not be added.'; }
      render();
    }
  });

  showDates();
  render();
}
