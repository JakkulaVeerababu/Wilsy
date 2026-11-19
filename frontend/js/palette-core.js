// Quick search (Ctrl/⌘ K): ranking for the static index of pages, companies and guides, plus the
// recently viewed jobs list. Pure functions; palette.js draws the dialog.

export const RECENT_KEY = 'wilsy-recent-jobs';
export const RECENT_LIMIT = 8;
const fold = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * How well an entry matches the typed words: every word must appear in its name or keywords.
 * Exact name 100, name starts with the query 80, a name word starts with each query word 60,
 * the name contains it 40, keywords only 20. Zero means no match.
 */
export function score(entry, query) {
  const q = fold(query); if(!q) return 0;
  const name = fold(entry.t), keys = fold(entry.k), words = q.split(' ');
  if(!words.every(w => name.includes(w) || keys.includes(w))) return 0;
  if(name === q) return 100;
  if(name.startsWith(q)) return 80;
  const nameWords = name.split(' ');
  if(words.every(w => nameWords.some(n => n.startsWith(w)))) return 60;
  if(words.every(w => name.includes(w))) return 40;
  return 20;
}
/** The best matches per group, best first; ties keep the index order (which puts popular items first). */
export function search(index, query, perGroup = {page: 5, company: 5, guide: 4}) {
  const groups = {};
  index.forEach((entry, i) => { const s = score(entry, query); if(s) (groups[entry.g] ||= []).push({entry, s, i}); });
  return Object.fromEntries(Object.entries(groups).map(([g, list]) => [g, list.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, perGroup[g] ?? 4).map(x => x.entry)]));
}

const localJobPath = value => /^\/jobs\/\d+-[a-z0-9-]*$/.test(String(value || '')) ? value : '';
const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
export function readRecent(storage) {
  try {
    const list = JSON.parse(storage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter(j => /^\d+$/.test(String(j?.id)) && localJobPath(j.path)).map(j => ({id: String(j.id), title: clean(j.title, 160), company: clean(j.company, 100), path: j.path})).slice(0, RECENT_LIMIT) : [];
  } catch { return []; }
}
/** Put a job at the front of the recently viewed list (no duplicates, newest first). */
export function rememberJob(storage, job) {
  const path = localJobPath(job?.path);
  if(!/^\d+$/.test(String(job?.id)) || !path) return;
  const entry = {id: String(job.id), title: clean(job.title, 160), company: clean(job.company, 100), path};
  try { storage.setItem(RECENT_KEY, JSON.stringify([entry, ...readRecent(storage).filter(j => j.id !== entry.id)].slice(0, RECENT_LIMIT))); } catch {}
}
