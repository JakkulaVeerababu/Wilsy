// Runs in the application page when the person clicks "Fill this form" in the WILSY popup. Fills only empty
// fields it recognises, marks them, and never submits: the person checks everything and presses Submit.
(async function () {
  const {pickField, valueFor} = globalThis.WilsyFill;
  const {profile} = await chrome.storage.local.get('profile');
  if (!profile) return {filled: 0, reason: 'no-profile'};

  const labelOf = el => {
    const parts = [];
    if (el.id) for (const l of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) parts.push(l.textContent);
    const wrap = el.closest('label'); if (wrap) parts.push(wrap.textContent);
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    for (const id of (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)) parts.push(document.getElementById(id)?.textContent || '');
    if (!parts.length) { const box = el.closest('.field, .application-question, .form-group, [class*="field"], [class*="question"]'); const l = box?.querySelector('label, legend'); if (l) parts.push(l.textContent); }
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  };
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); // works with React-controlled inputs
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  };

  let filled = 0;
  for (const el of document.querySelectorAll('input, textarea')) {
    if (el.disabled || el.readOnly || el.value || el.offsetParent === null) continue;
    const key = pickField({type: el.type, label: labelOf(el), name: el.name, id: el.id, placeholder: el.placeholder, autocomplete: el.getAttribute('autocomplete')});
    const value = key && valueFor(key, profile);
    if (!value) continue;
    setValue(el, value);
    el.style.outline = '2px solid #2563eb'; el.style.outlineOffset = '2px';
    filled++;
  }

  document.getElementById('wilsy-fill-note')?.remove();
  const note = document.createElement('div');
  note.id = 'wilsy-fill-note';
  note.setAttribute('role', 'status');
  note.style.cssText = 'position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;max-width:520px;margin:auto;padding:12px 16px;border-radius:12px;background:#0f172a;color:#fff;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
  note.textContent = filled
    ? `WILSY filled ${filled} field${filled === 1 ? '' : 's'} (outlined in blue). Check each one, attach your resume and answer the questions yourself, then press Submit.`
    : 'WILSY found no empty field it recognises on this page. Fill the form yourself.';
  const close = document.createElement('button');
  close.textContent = 'Close'; close.type = 'button';
  close.style.cssText = 'margin-left:12px;padding:2px 10px;border:1px solid #fff;border-radius:8px;background:none;color:#fff;cursor:pointer';
  close.onclick = () => note.remove();
  note.append(close);
  document.body.append(note);
  return {filled};
})();
