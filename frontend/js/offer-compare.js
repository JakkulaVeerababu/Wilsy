import {offerTable, offerFields, offersQuery, readOffers, cleanOffer, DEFAULT_OFFERS, MAX_OFFERS} from './offer-core.js';
import {track} from './analytics.js';

// /offer-compare: the comparison updates as you type and lives in the address bar, so it can be shared.
const root = document.querySelector('[data-offers]');
if(root) {
  const form = root.querySelector('[data-offer-form]'), result = root.querySelector('[data-offer-result]'), status = root.querySelector('[data-offer-status]');
  let offers = readOffers(new URLSearchParams(location.search).get('offers')) || DEFAULT_OFFERS, counted = false;
  const read = () => [...form.querySelectorAll('[data-offer]')].map((set, i) => cleanOffer(Object.fromEntries(['name', 'ctc', 'variable', 'joining', 'equity', 'pt'].map(k => [k, set.querySelector(`[name="${k}"]`)?.value])), i));
  const update = () => {
    result.innerHTML = offerTable(offers);
    const url = new URL(location.href); url.searchParams.set('offers', offersQuery(offers));
    history.replaceState(history.state, '', url.pathname + url.search);
  };
  const redraw = focus => { form.innerHTML = offerFields(offers); update(); form.querySelector(focus)?.focus(); };
  redraw();
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => {
    offers = read(); update();
    if(!counted) { counted = true; track('tool_use', {tool: 'offer_compare'}); }
  });
  form.addEventListener('click', event => {
    if(event.target.closest('[data-offer-add]') && offers.length < MAX_OFFERS) { offers = [...read(), cleanOffer({}, offers.length)]; redraw(`#offer-name-${offers.length - 1}`); status.textContent = 'Third offer added.'; }
    const remove = event.target.closest('[data-offer-remove]');
    if(remove) { offers = read().filter((_, i) => i !== Number(remove.dataset.offerRemove)).map((o, i) => cleanOffer(o, i)); redraw('#offer-name-0'); status.textContent = 'Offer removed.'; }
  });
  root.querySelector('[data-offer-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied. It opens this comparison.'; }
    catch { status.textContent = 'Copy the address bar link to share this comparison.'; }
  });
}
