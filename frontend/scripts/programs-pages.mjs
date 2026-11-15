// Open-source programs: the listing at /open-source-programs and one page per program, built from
// the hand-curated data/open-source-programs.json. Rebuilt every day by the daily snapshot.
import {escapeHtml as e} from '../js/directory-core.js';
import {sectionTabs} from './opportunity-pages.mjs';

const day=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value));
// Open, opening or closed only when the official page has announced dates (program.next);
// otherwise the usual timing is shown and nothing is guessed.
export function programStatus(program,now=Date.now()){
  const opens=Date.parse(program.next?.opens||''),closes=Date.parse(program.next?.closes||'');
  if(Number.isFinite(closes)&&closes<now)return {key:'closed',text:'Applications closed'};
  if(Number.isFinite(opens)&&opens>now)return {key:'soon',text:`Opens ${day(opens)}`};
  if(Number.isFinite(opens)||Number.isFinite(closes))return {key:'open',text:Number.isFinite(closes)?`Open until ${day(closes)}`:'Applications open'};
  return {key:'unknown',text:'Next dates not announced'};
}
// The program's own short name when it has one (GSoC, LFX), otherwise its initials.
const monoText=p=>p.short.length<=6?p.short:p.name.split(/\s+/).filter(w=>/^[A-Z]/.test(w)).map(w=>w[0]).join('').slice(0,3);
const external=(url,text,cls='')=>`<a${cls?` class="${cls}"`:''} href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(text)}</a>`;

function card(p){
  const status=programStatus(p);
  return `<article class="hack-card program-card"><div class="hack-card-top"><span class="event-logo event-mono mono" aria-hidden="true">${e(monoText(p))}</span><span class="hack-phase" data-status="${status.key}">${e(status.text)}</span></div><p class="hack-organizer">${e(p.organizer)}</p><h3><a href="/open-source-programs/${p.slug}">${e(p.name)}</a></h3><p class="hack-card-description">${e(p.summary)}</p><div class="hack-tags">${[p.format,...p.tags].map(t=>`<span>${e(t)}</span>`).join('')}</div><dl class="hack-card-dates"><div><dt>Who can apply</dt><dd>${e(p.who)}</dd></div><div><dt>Usual timing</dt><dd>${e(p.usual)}</dd></div></dl><div class="hack-card-footer"><a href="/open-source-programs/${p.slug}">Details</a>${external(p.url,'Official site')}</div></article>`;
}

export function programsPage(data){
  const india=data.programs.filter(p=>p.tags.includes('India')).length,paid=data.programs.filter(p=>p.stipend).length;
  return `<main id="main-content" class="hack-shell" data-section="open-source">
 ${sectionTabs('open-source')}
 <section class="hack-hero"><div><p class="eyebrow"><span></span> WILSY OPEN-SOURCE PROGRAMS</p><h1>Your first pull request<br><span>can open doors.</span></h1><p>Google Summer of Code, Outreachy, LFX Mentorship and more: who can apply, whether it pays, and when applications usually open, from each program’s official page.</p><div class="hack-hero-links"><a href="#programs">See the programs</a><a href="/guides">Read the career guides</a></div></div><aside class="hack-index" aria-label="Program index"><div class="hack-index-top"><span>PROGRAM INDEX</span></div><strong>${data.programs.length}</strong><p>programs tracked</p><div class="hack-index-bottom"><div><strong>${paid}</strong><span>pay a stipend</span></div><div><strong>${india}</strong><span>run from India</span></div></div></aside></section>
 <section id="programs" class="hack-workspace" aria-labelledby="programs-heading"><div class="hack-toolbar"><div><p class="eyebrow">CONTRIBUTE, LEARN, GET NOTICED</p><h2 id="programs-heading">${data.programs.length} programs</h2></div></div><p class="hack-connection">Facts from each program’s official page, reviewed ${e(day(data.reviewed_at))}. WILSY checks those pages every day for new dates.</p><div class="hack-results">${data.programs.map(card).join('')}</div></section>
 <section class="hack-principles"><div><p class="eyebrow">BEFORE YOU APPLY</p><h2>Start contributing<br>before the window opens.</h2></div><article><span>01</span><h3>Pick a project early</h3><p>Programs choose people who already know the project. Read its contributor guide and join its chat weeks before applications open.</p></article><article><span>02</span><h3>Make small contributions</h3><p>Fix a documentation typo or a beginner issue first. A merged pull request says more than a long proposal.</p></article><article><span>03</span><h3>Follow the official rules</h3><p>Eligibility, stipends and deadlines change between editions. Always confirm them on the program’s own site.</p></article></section>
 </main>`;
}

export function programArticle(p){
  const status=programStatus(p);
  const row=(term,value)=>value?`<div><dt>${e(term)}</dt><dd>${e(value)}</dd></div>`:'';
  return `<dl class="program-facts">${row('Status',status.text)}${row('Run by',p.organizer)}${row('Who can apply',p.who)}${row('Stipend',p.stipend||'No stipend is stated on the official site.')}${row('Format',p.format)}${row('Usual timing',p.usual)}${row('Latest edition',p.last_edition)}</dl>
<h2>What it is</h2><p>${e(p.summary)}</p>
<h2>When to apply</h2><p>${e(p.usual)}${p.next?'':' The next dates are not announced yet. WILSY checks the official page every day and updates this page when they are.'}</p>
<h2>Before you apply</h2><ul><li>Read the official rules and eligibility for this year’s edition.</li><li>Choose a project or organization and start with small contributions.</li><li>Keep your application specific: what you will build, how, and by when.</li></ul>
<div class="contact-box"><div class="contact-actions">${external(p.url,`Open the ${p.name} site`,'primary-button')}${p.check_url!==p.url?external(p.check_url,'Official timeline','secondary-button'):''}</div></div>
<p class="quiet-callout">These details come from the program’s official site. If something is out of date, <a href="mailto:contact@wilsy.in?subject=${encodeURIComponent('Program correction: '+p.name)}">let us know</a>.</p>`;
}
