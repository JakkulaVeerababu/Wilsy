export const PAGE_SIZE = 12;
export function initialState(search = '') {
  const p = new URLSearchParams(search);
  return { query: p.get('q') || '', tier: [1,2,3,4].includes(Number(p.get('tier'))) ? Number(p.get('tier')) : 0, sectors: p.getAll('sector'), stages: p.getAll('stage'), region: p.get('region') || '', role: p.get('role') || '', remote: p.get('remote') === '1', sort: ['directory','pay-desc','pay-asc','name'].includes(p.get('sort')) ? p.get('sort') : 'directory', page: Math.max(1, Math.floor(Number(p.get('page')) || 1)), view: p.get('view') === 'list' ? 'list' : 'grid' };
}
export function stateSearch(s) {
  const p = new URLSearchParams();
  if(s.query) p.set('q',s.query);
  if(s.tier) p.set('tier',s.tier);
  s.sectors.forEach(x=>p.append('sector',x));
  s.stages.forEach(x=>p.append('stage',x));
  for(const k of ['region','role']) if(s[k]) p.set(k,s[k]);
  if(s.remote) p.set('remote','1');
  if(s.sort !== 'directory') p.set('sort',s.sort);
  if(s.page > 1) p.set('page',s.page);
  if(s.view === 'list') p.set('view','list');
  return p.toString();
}
export function findCompanies(companies,s) {
  const words = s.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const found = companies.filter(c => {
    if(s.tier && c.tier !== s.tier) return false;
    if(s.sectors.length && !s.sectors.includes(c.sector)) return false;
    if(s.stages.length && !s.stages.includes(c.stage)) return false;
    if(s.region && !c.regions.includes(s.region)) return false;
    if(s.role && c.role !== s.role) return false;
    if(s.remote && !c.remote) return false;
    if(words.length) {
      const text = [c.name,c.description,c.sector,c.location,c.role,...c.tags,...(c.sample.skills||[])].join(' ').toLocaleLowerCase();
      if(!words.every(w=>text.includes(w))) return false;
    }
    return true;
  });
  const midpoint = c => (c.salary.min+c.salary.max)/2;
  found.sort(s.sort==='name' ? (a,b)=>a.name.localeCompare(b.name) : s.sort==='pay-desc' ? (a,b)=>midpoint(b)-midpoint(a)||a.order-b.order : s.sort==='pay-asc' ? (a,b)=>midpoint(a)-midpoint(b)||a.order-b.order : (a,b)=>a.order-b.order);
  return found;
}
export function pageSlice(companies,page) {
  const pages = Math.max(1,Math.ceil(companies.length/PAGE_SIZE));
  const current = Math.min(Math.max(1,page),pages);
  return {page:current,pages,items:companies.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE)};
}
export function payTier({min,max}) { const midpoint=(min+max)/2; return midpoint>=200000?1:midpoint>=150000?2:midpoint>=100000?3:4; }
export function safeHref(value) {
  try { const url=new URL(value, 'https://wilsy.in/'); return ['https:','http:'].includes(url.protocol)? value:'#'; } catch { return '#'; }
}
export function escapeHtml(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
