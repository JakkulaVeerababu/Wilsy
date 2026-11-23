// Hand-curated opportunity sections: Open-source programs, Research internships, Scholarships and Startup grants.
// Each is a listing page plus one page per entry, built from a JSON file in data/ that a person keeps
// up to date from official pages. collectors/programs-check.mjs re-reads those pages every day and
// flags date changes for review. Rebuilt every day by the daily snapshot.
import {escapeHtml as e} from '../js/directory-core.js';
import {sectionTabs} from './opportunity-pages.mjs';

const day=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value));
export const entries=data=>data.items||data.programs||[];
// Open, opening or closed only when the official page has announced dates (entry.next);
// otherwise the usual timing is shown and nothing is guessed.
export function programStatus(program,now=Date.now()){
  // Schemes whose official page says they take applications all year (no rounds).
  if(program.rolling===true)return {key:'open',text:'Open all year'};
  const opens=Date.parse(program.next?.opens||''),closes=Date.parse(program.next?.closes||'');
  if(Number.isFinite(closes)&&closes<now)return {key:'closed',text:'Applications closed'};
  if(Number.isFinite(opens)&&opens>now)return {key:'soon',text:`Opens ${day(opens)}`};
  if(Number.isFinite(opens)||Number.isFinite(closes))return {key:'open',text:Number.isFinite(closes)?`Open until ${day(closes)}`:'Applications open'};
  return {key:'unknown',text:'Next dates not announced'};
}
// The entry's own short name when it has one (GSoC, SRFP), otherwise its initials.
const monoText=p=>p.short.length<=7?p.short:p.name.split(/\s+/).filter(w=>/^[A-Z]/.test(w)).map(w=>w[0]).join('').slice(0,3);
const external=(url,text,cls='')=>`<a${cls?` class="${cls}"`:''} href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(text)}</a>`;
const checkedDaily=p=>p.check?.auto!==false;

export const curatedSections={
  'open-source':{
    key:'open-source',label:'Open-source programs',path:'/open-source-programs',file:'data/open-source-programs.json',noun:'program',plural:'programs',
    title:'Open-source programs: GSoC, Outreachy, LFX and more',
    description:'Google Summer of Code, Outreachy, LFX Mentorship, Hacktoberfest and more: who can apply, stipends and when applications usually open, from official pages.',
    pageTitle:p=>`${p.name}: eligibility, stipend and dates`,
    pageDescription:p=>`${p.summary} Who can apply, stipend and usual timing for ${p.name}, from the official site.`,
    eyebrow:'WILSY OPEN-SOURCE PROGRAMS',heading:'Your first pull request<br><span>can open doors.</span>',
    lede:'Google Summer of Code, Outreachy, LFX Mentorship and more: who can apply, whether it pays, and when applications usually open, from each program’s official page.',
    heroLinks:[['#entries','See the programs'],['/guides','Read the career guides']],
    indexLabel:'PROGRAM INDEX',indexNoun:'programs tracked',
    index:items=>[[items.filter(p=>p.stipend).length,'pay a stipend'],[items.filter(p=>p.tags.includes('India')).length,'run from India']],
    toolbarEyebrow:'CONTRIBUTE, LEARN, GET NOTICED',
    cardRows:[['Who can apply','who'],['Usual timing','usual']],
    facts:[['Run by','organizer'],['Who can apply','who'],['Stipend','stipend','No stipend is stated on the official site.'],['Format','format'],['Usual timing','usual'],['Latest edition','last_edition']],
    articleEyebrow:'OPEN-SOURCE PROGRAM',
    tips:['Read the official rules and eligibility for this year’s edition.','Choose a project or organization and start with small contributions.','Keep your application specific: what you will build, how, and by when.'],
    principles:{eyebrow:'BEFORE YOU APPLY',heading:'Start contributing<br>before the window opens.',items:[['Pick a project early','Programs choose people who already know the project. Read its contributor guide and join its chat weeks before applications open.'],['Make small contributions','Fix a documentation typo or a beginner issue first. A merged pull request says more than a long proposal.'],['Follow the official rules','Eligibility, stipends and deadlines change between editions. Always confirm them on the program’s own site.']]},
    asideLinks:[['/hackathons','Hackathons'],['/contests','Coding contests']]
  },
  research:{
    key:'research',label:'Research internships',path:'/research-internships',file:'data/research-internships.json',noun:'internship',plural:'research internships',
    title:'Research internships: SRFP, SURGE, SRIP and more',
    description:'Summer research fellowships and internships for Indian students at IITs, national labs and science academies: who can apply, stipends, fees and when applications open, from official pages.',
    pageTitle:p=>`${p.name}: eligibility, stipend and dates`,
    pageDescription:p=>`${p.summary} Who can apply, stipend and usual timing for ${p.name}, from the official site.`,
    eyebrow:'WILSY RESEARCH INTERNSHIPS',heading:'Spend a summer<br><span>doing real research.</span>',
    lede:'Summer research fellowships at science academies, national labs and IITs: who can apply, what they pay, what they charge, and when applications usually open, from each program’s official page.',
    heroLinks:[['#entries','See the internships'],['/scholarships','Looking for funding? See scholarships']],
    indexLabel:'RESEARCH INDEX',indexNoun:'programs tracked',
    index:items=>[[items.filter(p=>programStatus(p).key==='open').length,'open now'],[items.filter(p=>p.tags.includes('Stipend')).length,'pay a stipend']],
    toolbarEyebrow:'LEARN HOW RESEARCH IS DONE',
    cardRows:[['Who can apply','who'],['Stipend','stipend']],
    facts:[['Run by','organizer'],['Who can apply','who'],['Stipend','stipend','No stipend is stated on the official site.'],['Fees','fees'],['Format','format'],['Usual timing','usual'],['Latest edition','last_edition']],
    articleEyebrow:'RESEARCH INTERNSHIP',
    tips:['Read this year’s eligibility on the official page: years of study and minimum marks differ between programs.','Write a short, specific statement of what you want to learn and which areas interest you.','Ask a teacher who knows your work early: most programs need a recommendation.'],
    principles:{eyebrow:'BEFORE YOU APPLY',heading:'Apply early.<br>Most close months before summer.',items:[['Mark the deadlines','The science academies’ fellowship closes in November, and others close between January and March.'],['Check the costs','Some programs charge application or hostel fees. They are listed on each page, as the official site states them.'],['From official pages','Every fact links to the program’s own site. Confirm the current year’s rules there before you apply.']]},
    asideLinks:[['/scholarships','Scholarships'],['/open-source-programs','Open-source programs']]
  },
  scholarships:{
    key:'scholarships',label:'Scholarships',path:'/scholarships',file:'data/scholarships.json',noun:'scholarship',plural:'scholarships',
    title:'Scholarships for college students in India',
    description:'Government and company scholarships for Indian college students: AICTE Pragati and Saksham, INSPIRE, PM Scholarship, Reliance Foundation and more. Who can apply, amounts and dates from official pages.',
    pageTitle:p=>`${p.name}: eligibility, amount and dates`,
    pageDescription:p=>`${p.summary} Who can apply, the amount and the usual timing for ${p.name}, from the official site.`,
    eyebrow:'WILSY SCHOLARSHIPS',heading:'Pay for college<br><span>without the guesswork.</span>',
    lede:'Government and company scholarships for college students: who can apply, how much they give and when applications open, from each scholarship’s official page or notice.',
    heroLinks:[['#entries','See the scholarships'],['/research-internships','See research internships']],
    indexLabel:'SCHOLARSHIP INDEX',indexNoun:'scholarships tracked',
    index:items=>[[items.filter(p=>programStatus(p).key==='open').length,'open now'],[items.filter(p=>p.tags.includes('Government')).length,'government schemes']],
    toolbarEyebrow:'FUND YOUR EDUCATION',
    cardRows:[['Who can apply','who'],['Amount','amount']],
    facts:[['Given by','organizer'],['Who can apply','who'],['Amount','amount'],['How to apply','format'],['Usual timing','usual'],['Latest round','last_edition']],
    articleEyebrow:'SCHOLARSHIP',
    tips:['Read the official guidelines for this year: income limits and eligible courses change.','Keep your marks sheets, income certificate and bank details ready before the portal opens.','Apply only on the official portal. Real scholarships never charge a fee to apply.'],
    principles:{eyebrow:'BEFORE YOU APPLY',heading:'Free to apply.<br>Always on the official portal.',items:[['Never pay to apply','Government and company scholarships do not charge application fees. Be wary of anyone who asks for money.'],['Renew on time','Most scholarships must be renewed every year, with minimum marks and attendance.'],['From official pages','Every fact links to the scholarship’s own site or notice. Confirm the current rules there before you apply.']]},
    asideLinks:[['/research-internships','Research internships'],['/jobs','Find jobs']]
  },
  grants:{
    key:'grants',label:'Startup grants',path:'/startup-grants',file:'data/startup-grants.json',noun:'grant',plural:'grants',
    title:'Startup grants in India: Seed Fund, BIRAC BIG, NIDHI-PRAYAS',
    description:'Government grants for Indian startups and student innovators: Startup India Seed Fund, BIRAC BIG, NIDHI-PRAYAS and state grants. Who can apply, how much and how, from official pages.',
    pageTitle:p=>`${p.name}: eligibility, amount and how to apply`,
    pageDescription:p=>`${p.summary} Who can apply, the amount and how to apply for ${p.name}, from the official site.`,
    eyebrow:'WILSY STARTUP GRANTS',heading:'Build the prototype<br><span>before you raise.</span>',
    lede:'Government grants that fund a proof of concept or a first product without taking a share of your company: who can apply, how much they give and how to apply, from each scheme’s official page.',
    heroLinks:[['#entries','See the grants'],['/hackathons','Test your idea at a hackathon']],
    indexLabel:'GRANT INDEX',indexNoun:'grants tracked',
    index:items=>[[items.filter(p=>p.tags.includes('Students')).length,'open to students'],[items.filter(p=>p.tags.includes('Any sector')).length,'any sector']],
    toolbarEyebrow:'FUND YOUR FIRST VERSION',
    cardRows:[['Who can apply','who'],['Amount','amount']],
    facts:[['Given by','organizer'],['Who can apply','who'],['Amount','amount'],['How to apply','format'],['Usual timing','usual'],['Latest round','last_edition']],
    articleEyebrow:'STARTUP GRANT',
    tips:['Read the scheme’s current guidelines: sectors, company age and recognition rules decide who qualifies.','Write down the milestone the money will reach (a prototype, a trial, a first customer) and what it will cost.','Apply only through the official portal or the scheme’s listed incubators. Government grants never charge a fee to apply or ask you to pay an agent.'],
    principles:{eyebrow:'BEFORE YOU APPLY',heading:'Grants, not equity.<br>Always from the source.',items:[['Never pay an agent','Government grant schemes are free to apply for. Be wary of consultants who promise approval for a fee.'],['Show the milestone','Grants pay for a defined step: a proof of concept, a prototype or a trial. Say exactly what yours will achieve.'],['From official pages','Every fact links to the scheme’s own site. Confirm the current rules and calls there before you apply.']]},
    asideLinks:[['/scholarships','Scholarships'],['/hackathons','Hackathons']]
  }
};

function card(cfg,p){
  const status=programStatus(p);
  const rows=cfg.cardRows.filter(([,key])=>p[key]).map(([term,key])=>`<div><dt>${e(term)}</dt><dd>${e(p[key])}</dd></div>`).join('');
  return `<article class="hack-card program-card"><div class="hack-card-top"><span class="event-logo event-mono mono" aria-hidden="true">${e(monoText(p))}</span><span class="hack-phase" data-status="${status.key}">${e(status.text)}</span></div><p class="hack-organizer">${e(p.organizer)}</p><h3><a href="${cfg.path}/${p.slug}">${e(p.name)}</a></h3><p class="hack-card-description">${e(p.summary)}</p><div class="hack-tags">${[p.format,...p.tags].map(t=>`<span>${e(t)}</span>`).join('')}</div><dl class="hack-card-dates">${rows}</dl><div class="hack-card-footer"><a href="${cfg.path}/${p.slug}">Details</a>${external(p.url,'Official site')}</div></article>`;
}

// Links to the state scholarship portals, by name only: their schemes are too many to curate.
const statePortals=portals=>portals?.length?`<section class="contest-elsewhere" aria-labelledby="state-portals-title"><h2 id="state-portals-title">State scholarship portals</h2><p>Most states run their own portal for post-matric scholarships and fee reimbursement. Apply on your state’s official site.</p><div>${portals.map(s=>external(s.url,`${s.state}: ${s.name}`)).join('')}</div></section>`:'';

export function curatedListing(cfg,data){
  const items=entries(data),[a,b]=cfg.index(items),daily=items.filter(checkedDaily).length;
  const checks=daily===items.length?'WILSY checks those pages every day for new dates.':`WILSY checks ${daily} of those pages every day for new dates.`;
  return `<main id="main-content" class="hack-shell" data-section="${cfg.key}">
 ${sectionTabs(cfg.key)}
 <section class="hack-hero"><div><p class="eyebrow"><span></span> ${cfg.eyebrow}</p><h1>${cfg.heading}</h1><p>${cfg.lede}</p><div class="hack-hero-links">${cfg.heroLinks.map(([url,text])=>`<a href="${url}">${e(text)}</a>`).join('')}</div></div><aside class="hack-index" aria-label="${cfg.indexLabel.toLowerCase().replace(/^./,c=>c.toUpperCase())}"><div class="hack-index-top"><span>${cfg.indexLabel}</span></div><strong>${items.length}</strong><p>${cfg.indexNoun}</p><div class="hack-index-bottom"><div><strong>${a[0]}</strong><span>${a[1]}</span></div><div><strong>${b[0]}</strong><span>${b[1]}</span></div></div></aside></section>
 <section id="entries" class="hack-workspace" aria-labelledby="entries-heading"><div class="hack-toolbar"><div><p class="eyebrow">${cfg.toolbarEyebrow}</p><h2 id="entries-heading">${items.length} ${cfg.plural}</h2></div></div><p class="hack-connection">Facts from each official page, reviewed ${e(day(data.reviewed_at))}. ${checks}</p><div class="hack-results">${items.map(p=>card(cfg,p)).join('')}</div></section>
 ${statePortals(data.state_portals)}
 <section class="hack-principles"><div><p class="eyebrow">${cfg.principles.eyebrow}</p><h2>${cfg.principles.heading}</h2></div>${cfg.principles.items.map(([title,text],i)=>`<article><span>0${i+1}</span><h3>${e(title)}</h3><p>${e(text)}</p></article>`).join('')}</section>
 </main>`;
}

export function curatedArticle(cfg,p){
  const status=programStatus(p);
  const row=(term,value)=>value?`<div><dt>${e(term)}</dt><dd>${e(value)}</dd></div>`:'';
  const later=checkedDaily(p)?' WILSY checks the official page every day and updates this page when they are.':' WILSY updates this page when they are.';
  return `<dl class="program-facts">${row('Status',status.text)}${cfg.facts.map(([term,key,fallback])=>row(term,p[key]||fallback)).join('')}</dl>
<h2>What it is</h2><p>${e(p.summary)}</p>
<h2>When to apply</h2><p>${e(p.usual)}${p.next||p.rolling?'':` The next dates are not announced yet.${later}`}</p>
<h2>Before you apply</h2><ul>${cfg.tips.map(t=>`<li>${e(t)}</li>`).join('')}</ul>
<div class="contact-box"><div class="contact-actions">${external(p.url,`Open the ${p.name} site`,'primary-button')}${p.check_url!==p.url&&checkedDaily(p)?external(p.check_url,'Official timeline','secondary-button'):''}</div></div>
<p class="quiet-callout">These details come from the official site. If something is out of date, <a href="mailto:contact@wilsy.in?subject=${encodeURIComponent(`${cfg.noun[0].toUpperCase()+cfg.noun.slice(1)} correction: ${p.name}`)}">let us know</a>.</p>`;
}
