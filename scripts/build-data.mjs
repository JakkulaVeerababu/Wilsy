import fs from 'node:fs/promises';

const snapshot = '2026-09-11';
const input = JSON.parse(await fs.readFile('.research/yc.json', 'utf8'));
const featured = JSON.parse(await fs.readFile('data/featured.json', 'utf8'));
const previous = JSON.parse(await fs.readFile('data/companies.json','utf8').catch(()=>'{}'));
const cached = new Map((previous.companies||[]).map(c=>[c.id,c]));
const careers = JSON.parse(await fs.readFile('.research/career-links.json','utf8').catch(()=>'{}'));
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const safeUrl = (s) => { try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
export function parseSalary(s) {
  if (!s || !/^\$/.test(s) || /CAD|AUD|SGD|NZD|HKD|month|hour|week|day|OTE/i.test(s)) return null;
  const clean = s.replace(/,/g, '').trim();
  const m = clean.match(/^\$([\d.]+)(K)?(?:\s*[-–]\s*\$?([\d.]+)(K)?)?(?:\s*(?:USD|\/\s*year|annually))?$/i);
  if (!m) return null;
  const min = Math.round(Number(m[1]) * (m[2] ? 1000 : 1));
  const max = m[3] ? Math.round(Number(m[3]) * (m[4] ? 1000 : 1)) : min;
  return min >= 15000 && max >= min && max <= 1000000 ? { min, max } : null;
}
const tier = (salary) => { const mid = (salary.min + salary.max) / 2; return mid >= 200000 ? 1 : mid >= 150000 ? 2 : mid >= 100000 ? 3 : 4; };
function sector(c) {
  const t = [...(c.tags || []), c.subindustry || ''].join(' ').toLowerCase();
  if (/security|cyber|fraud|identity/.test(t)) return 'Security';
  if (/developer|infrastructure|open.source|devops|database/.test(t)) return 'Developer tools';
  if (c.industry === 'Fintech') return 'Fintech';
  if (c.industry === 'Healthcare') return 'Healthtech';
  if (/robot|hardware|semiconductor|space|manufactur|aerospace/.test(t)) return 'Hardware & robotics';
  if (/artificial intelligence|machine learning|generative ai|\bai\b/.test(t)) return 'AI & data';
  if (c.industry === 'Consumer') return 'Consumer & commerce';
  if (c.industry === 'Education') return 'Education';
  return 'Cloud & software';
}
function listedJobs(c) {
  return (c.jobs || []).filter(j => j.type === 'Full-time' && !/intern|contract/i.test(j.title)).flatMap(j => {
    const salary = parseSalary(j.salary_range);
    if (!salary || !safeUrl(j.url)) return [];
    return [{ title: j.title.trim(), role: j.role || 'Other', location: j.location || 'See employer listing', experience: j.experience || 'See employer listing', salary, equity: j.equity_range || 'Not disclosed', bonus: 'Not disclosed', payKind: 'Advertised salary', source: j.url, skills: (j.skills || []).slice(0,8), remote: /remote/i.test(j.location || '') }];
  });
}
const jobsByRole = { Engineering: 0, Product: 1, Design: 2, Science: 3, Operations: 4, Sales: 5 };
const featuredKeys = new Set(featured.map(c=>key(c.name)));
const candidates = input.filter(c => ['Active','Public'].includes(c.status) && !c.nonprofit && safeUrl(c.website) && safeUrl(c.logo_url || c.small_logo_thumb_url) && !featuredKeys.has(key(c.name))).map(c=>({c,jobs:listedJobs(c)})).filter(x=>x.jobs.length);
candidates.sort((a,b) => Number(b.c.top_company) - Number(a.c.top_company) || (b.c.team_size || 0) - (a.c.team_size || 0) || a.c.name.localeCompare(b.c.name));
const seen = new Set();
const companies = featured.map((c,i) => ({ id: c.slug, name:c.name, description:c.description, website:c.website, careers:c.careers, careersHost:'Company careers', source:c.source, sourceName:'Employer careers website', logo:`assets/logos/${c.slug}.svg`, logoKey:c.logoKey, sector:c.sector, location:c.location, regions:[c.location], tags:c.tags, stage:'Established', teamSize:null, featured:true, tier:tier(c), salary:{min:c.min,max:c.max}, payKind:c.payKind, role:'Engineering', sample:{title:c.title,role:'Engineering',location:c.jobLocation,experience:c.experience,salary:{min:c.min,max:c.max},equity:c.equity,bonus:c.bonus,payKind:c.payKind,source:c.source,remote:false}, jobs:[], remote:false, checkedAt:snapshot, order:i }));
for (const {c,jobs} of candidates) {
  if(companies.length >= 1000) break;
  const domain = new URL(c.website).hostname.replace(/^www\./,'');
  if(seen.has(domain) || seen.has(key(c.name))) continue;
  seen.add(domain); seen.add(key(c.name));
  const priority = Math.min(...jobs.map(j=>jobsByRole[j.role] ?? 6));
  const eligible = jobs.filter(j=>(jobsByRole[j.role]??6)===priority).sort((a,b)=>(a.salary.min+a.salary.max)-(b.salary.min+b.salary.max));
  const sample = eligible[Math.floor((eligible.length-1)/2)];
  const profile = safeUrl(c.url);
  const careers = `${profile.replace(/\/$/,'')}/jobs`;
  companies.push({id:c.slug,name:c.name,description:(c.one_liner || `${c.industry} technology company.`).slice(0,210),website:safeUrl(c.website),careers,careersHost:'Company jobs on YC',source:profile,sourceName:'Employer profile on Y Combinator',logo:c.logo_url||c.small_logo_thumb_url,sector:sector(c),location:c.all_locations || 'Location not listed',regions:c.regions || [],tags:(c.tags||[]).slice(0,5),stage:c.status==='Public'?'Established':c.stage==='Growth'?'Growth':'Startup',teamSize:c.team_size||null,featured:false,tier:tier(sample.salary),salary:sample.salary,payKind:sample.payKind,role:sample.role,sample,jobs:[sample,...jobs.filter(j=>j.source!==sample.source)].slice(0,6),remote:jobs.some(j=>j.remote),checkedAt:snapshot,order:companies.length});
}
if(companies.length!==1000) throw new Error(`Expected 1,000 unique companies, found ${companies.length}`);
for(const c of companies){
  const old=cached.get(c.id);
  if(old?.logoSource&&old.logo.startsWith('assets/')){c.logo=old.logo;c.logoSource=old.logoSource;}
  if(careers[c.id])Object.assign(c,careers[c.id]);
  c.regions=c.regions.map(r=>r==='United States of America'?'United States':r);
  if(/workatastartup\.com|ycombinator\.com/.test(new URL(c.careers).hostname))c.careersHost='Company jobs on YC';
}
const output={version:1,updatedAt:snapshot,currency:'USD',total:companies.length,selection:'Established technology employers followed by active/public YC companies with a published annual USD salary, prioritising YC top-company designation and reported team size. This is a curated directory, not an independent ranking of the world’s 1,000 largest or best companies.',salaryMethod:'One example full-time advertised role per company. Engineering roles are preferred; when several exist the middle salary midpoint is selected. Base salary is labelled when the employer explicitly identifies it. Pay may differ by role, level and location. No currency conversion, equity valuation, bonus estimate or company-wide total compensation estimate is performed.',tierMethod:'Pay tiers use the midpoint of the example role’s advertised USD annual salary: Tier 1 ≥ $200,000; Tier 2 $150,000–$199,999; Tier 3 $100,000–$149,999; Tier 4 < $100,000. Tiers do not measure company quality and do not control for seniority or geography.',sources:[{name:'Employer careers websites',url:'https://www.google.com/about/careers/'},{name:'Employer profiles and jobs on Y Combinator',url:'https://www.ycombinator.com/companies'},{name:'YC directory data mirror',url:'https://github.com/devasheeshg/yc-api'}],companies};
await fs.writeFile('data/companies.json',JSON.stringify(output));
console.log(JSON.stringify({companies:companies.length,tiers:companies.reduce((o,c)=>(o[c.tier]=(o[c.tier]||0)+1,o),{}),roles:companies.reduce((o,c)=>(o[c.role]=(o[c.role]||0)+1,o),{}),bytes:JSON.stringify(output).length}));
