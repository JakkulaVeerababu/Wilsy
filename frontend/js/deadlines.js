import {searchHackathons, searchOpportunities} from './data-client.js';
import {DEADLINE_KINDS, LIVE_LIMIT, BUCKET_ROWS, liveDeadline, upcoming, deadlineList, kindCounts} from './deadlines-core.js';
import {escapeHtml as e} from './directory-core.js';
import {track} from './analytics.js';

// /deadlines: the reviewed deadlines come with the page; the soonest hackathons and competitions load live.
const root = document.querySelector('[data-deadlines]');
if(root) {
  const list = root.querySelector('[data-dl-list]'), status = root.querySelector('[data-dl-status]');
  const chips = [...root.querySelectorAll('[data-dl-type]')];
  const kinds = new Set(DEADLINE_KINDS.map(([kind]) => kind));
  let base = [];
  try { base = JSON.parse(document.getElementById('deadline-data')?.textContent || '[]'); } catch {}
  let live = [], type = new URLSearchParams(location.search).get('type') || '', more = {};
  const expanded = new Set();
  if(!kinds.has(type)) type = '';

  const render = () => {
    const all = upcoming([...base, ...live]);
    const counts = kindCounts(all);
    for(const chip of chips) {
      const kind = chip.dataset.dlType;
      chip.setAttribute('aria-pressed', String(kind === type));
      chip.querySelector('span').textContent = kind ? counts[kind] : all.length;
    }
    const shown = type ? all.filter(item => item.kind === type) : all;
    const name = DEADLINE_KINDS.find(([kind]) => kind === type)?.[1].toLowerCase();
    const capped = Object.entries(more).filter(([kind]) => !type || kind === type);
    list.innerHTML = deadlineList(shown, {empty: type ? `No open deadlines for ${name} right now.` : 'No open deadlines right now.', open: expanded})
      + (capped.length ? `<p class="dl-more">Showing the ${LIVE_LIMIT} soonest ${capped.map(([kind]) => kind === 'hackathon' ? 'hackathons' : 'competitions').join(' and ')}. ${capped.map(([, [href, text]]) => `<a href="${e(href)}">${e(text)}</a>`).join(' · ')}</p>` : '');
  };
  let counted = false;
  for(const chip of chips) chip.addEventListener('click', () => {
    if(!counted) { counted = true; track('tool_use', {tool: 'deadlines'}); }
    type = chip.dataset.dlType;
    expanded.clear();
    const url = new URL(location.href);
    if(type) url.searchParams.set('type', type); else url.searchParams.delete('type');
    history.replaceState(null, '', url);
    render();
  });

  async function load() {
    status.textContent = 'Loading hackathons and competitions…';
    // Hackathons come 12 to a page; competitions 24 to a page.
    const [hack, comp] = await Promise.allSettled([
      Promise.all(Array.from({length: LIVE_LIMIT / 12}, (_, i) => searchHackathons({sort: 'deadline'}, i * 12))),
      Promise.all(Array.from({length: LIVE_LIMIT / 24}, (_, i) => searchOpportunities({kind: 'competition', sort: 'soon'}, {pageSize: 24, offset: i * 24}))),
    ]);
    live = [];
    more = {};
    if(hack.status === 'fulfilled') {
      live.push(...hack.value.flatMap(page => page.events || []).map(item => liveDeadline('hackathon', item)));
      if((hack.value[0]?.total || 0) > LIVE_LIMIT) more.hackathon = ['/hackathons', 'See every hackathon'];
    }
    if(comp.status === 'fulfilled') {
      live.push(...comp.value.flatMap(page => page.items || []).map(item => liveDeadline('competition', item)));
      if((comp.value[0]?.total || 0) > LIVE_LIMIT) more.competition = ['/competitions', 'See every competition'];
    }
    live = live.filter(Boolean);
    const failed = [hack, comp].filter(r => r.status === 'rejected').length;
    status.innerHTML = failed ? `${failed === 2 ? 'Couldn’t load hackathons and competitions' : `Couldn’t load ${hack.status === 'rejected' ? 'hackathons' : 'competitions'}`}. <button class="text-button" type="button" data-dl-retry>Try again</button>` : '';
    render();
  }
  root.addEventListener('click', event => {
    if(event.target.closest('[data-dl-retry]')) load();
    const expand = event.target.closest('[data-dl-expand]');
    if(expand) {
      const key = expand.dataset.dlExpand;
      expanded.add(key);
      render();
      // Keep the keyboard where it was: on the first row the button revealed.
      list.querySelector(`[aria-labelledby="dl-${key}"] .dl-item:nth-child(${BUCKET_ROWS + 1}) h3 a`)?.focus();
    }
  });
  render();
  load();
}
