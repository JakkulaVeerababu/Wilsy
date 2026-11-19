import {LETTERS, LETTER_FIELDS, letterById, letterText, fieldLabel, mailtoLink, valuesFromUrl} from './letters-core.js';
import {track} from './analytics.js';

// /career-letters: the letter rewrites itself as you fill in your details, until you edit it by hand.
// Your details are kept in sessionStorage, so they last until the tab is closed and never leave the browser.
const form = document.querySelector('[data-letters-form]');
if(form) {
  const KEY = 'wilsy-letters';
  const $ = selector => form.querySelector(selector);
  const subject = $('[data-letter-subject]'), body = $('[data-letter-body]'), mail = $('[data-letter-mail]');
  const status = $('[data-letter-status]'), edited = $('[data-letter-edited]'), title = $('[data-letter-name]');
  const printCopy = document.querySelector('[data-letter-print-copy]');
  const keys = Object.keys(LETTER_FIELDS);
  const today = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'}).format(new Date());
  const usedVia = new Set();
  let dirty = false, chosen = LETTERS[0].id;

  const current = () => form.elements.letter.value || LETTERS[0].id;
  const values = () => Object.fromEntries(keys.map(key => [key, form.elements[key].value]));
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({letter: current(), values: values()})); } catch {} };
  const saved = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } };
  const used = via => { if(!usedVia.has(via)) { usedVia.add(via); track('tool_use', {tool: 'letters', via}); } };
  const say = text => { status.textContent = text; };

  const sync = () => {
    mail.href = mailtoLink({subject: subject.value, body: body.value});
    edited.hidden = !dirty;
    printCopy.textContent = `${today}\n\nSubject: ${subject.value}\n\n${body.value}`;
  };
  const fill = () => {
    if(!dirty) {
      const text = letterText(current(), values());
      subject.value = text.subject;
      body.value = text.body;
    }
    sync();
  };
  const show = () => {
    const letter = letterById(current());
    for(const box of form.querySelectorAll('[data-letter-field]')) {
      const key = box.dataset.letterField;
      box.hidden = !letter.fields.includes(key);
      box.querySelector('label').textContent = fieldLabel(letter, key);
    }
    title.textContent = letter.name;
    chosen = letter.id;
  };
  const pick = id => { const radio = [...form.elements.letter].find(r => r.value === id); if(radio) radio.checked = true; };

  // Start from this tab's saved details, then anything the notice period calculator sent over.
  const before = saved(), fromUrl = valuesFromUrl(location.search);
  for(const [key, value] of Object.entries({...(before.values || {}), ...fromUrl.values})) if(keys.includes(key) && typeof value === 'string') form.elements[key].value = value;
  pick(fromUrl.letter || (LETTERS.some(l => l.id === before.letter) ? before.letter : LETTERS[0].id));
  show();
  fill();

  form.addEventListener('change', event => {
    if(event.target.name !== 'letter') return;
    if(dirty && !confirm('Replace the letter you edited with the new one?')) { pick(chosen); return; }
    dirty = false;
    say('');
    show();
    fill();
    save();
  });
  form.addEventListener('input', event => {
    if(event.target === subject || event.target === body) { dirty = true; sync(); return; }
    if(event.target.closest('[data-letter-field]')) { fill(); save(); }
  });
  form.addEventListener('submit', event => event.preventDefault());
  $('[data-letter-reset]').addEventListener('click', () => { dirty = false; fill(); body.focus(); });

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.cssText = 'position:fixed;opacity:0';
      document.body.append(box);
      box.select();
      const done = document.execCommand('copy');
      box.remove();
      return done;
    }
  };
  for(const button of form.querySelectorAll('[data-letter-copy]')) button.addEventListener('click', async () => {
    const what = button.dataset.letterCopy;
    const done = await copy(what === 'subject' ? subject.value : body.value);
    say(done ? (what === 'subject' ? 'Subject copied.' : 'Letter copied. Fill in any [placeholders] before you send it.') : 'Couldn’t copy. Select the text and copy it yourself.');
    if(done) used('copy');
  });
  mail.addEventListener('click', () => { sync(); used('email'); });
  $('[data-letter-print]').addEventListener('click', () => { sync(); used('print'); window.print(); });
  window.addEventListener('beforeprint', sync);
}
