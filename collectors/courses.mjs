// Free courses collector: NPTEL video courses and Microsoft Learn learning paths, stored in
// public.opportunities as kind 'course' (no schema change: the kind was allowed from the start).
//
// Sources and why they may be read:
// - Microsoft Learn: the official, documented Catalog API (learn.microsoft.com/api/catalog), meant for
//   listing Learn content elsewhere. Title, summary, level, length and link are kept.
// - NPTEL: the public course list at nptel.ac.in/courses (robots.txt allows every path). NPTEL's
//   lessons are CC BY-NC-SA and WILSY shows ads, so only facts are kept: title, institute, teacher,
//   discipline and the link. No descriptions or lesson content.
//
// Run once a day from the daily snapshot workflow; courses change slowly.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/courses.mjs [--dry-run]
import path from 'node:path';
import {row,collect} from './opportunities.mjs';
import {createClient} from './http.mjs';

export const SOURCES={microsoft:'Microsoft Learn',nptel:'NPTEL'};
const text=(value,max)=>{const t=String(value??'').replace(/\s+/g,' ').trim();return t?t.slice(0,max):null;};
const decode=s=>String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&nbsp;/g,' ');

// ---------- Topics ----------
// One topic per course, from the source's own subjects (Microsoft) or discipline (NPTEL), with the
// title deciding AI and data courses that sit under a broader discipline.
const TITLE_TOPICS=[
  ['ai',/\b(machine learning|deep learning|artificial intelligence|neural network|generative ai|reinforcement learning|computer vision|natural language|nlp|llm)s?\b/i],
  ['data',/\b(data science|data analytics|data analysis|big data|database|data mining|statistics for data|business analytics)\b/i],
  ['security',/\b(cyber ?security|cryptography|network security|information security|ethical hacking)\b/i],
  ['cloud',/\b(cloud computing|devops)\b/i],
];
const MICROSOFT_SUBJECTS=[
  ['ai',['artificial-intelligence','generative-ai','machine-learning','natural-language-processing','chatbots','bots']],
  ['data',['data-engineering','data-analytics','data-management','data-integration','data-modeling','data-storage','data-visualization','databases','business-reporting']],
  ['security',['security','threat-protection','cloud-security','identity-access','compliance','information-protection-governance','insider-risk','key-management']],
  ['cloud',['cloud-computing','devops','infrastructure','virtual-machine','containers','storage','networking','site-reliability-engineering','platform-engineering','migration','architecture','it-management-monitoring','virtualization','cache','resource-management']],
  ['programming',['app-development','custom-app-development','backend-development','frontend-development','cross-development','automation','process-workflow']],
];
export function microsoftTopic(path) {
  const title=String(path.title||'');
  for(const [topic,re] of TITLE_TOPICS)if(re.test(title))return topic;
  const subjects=new Set(path.subjects||[]);
  for(const [topic,list] of MICROSOFT_SUBJECTS)if(list.some(s=>subjects.has(s)))return topic;
  const roles=new Set(path.roles||[]);
  if(roles.has('developer'))return 'programming';
  if(roles.has('administrator')||roles.has('solution-architect'))return 'cloud';
  return 'business';
}
const NPTEL_DISCIPLINES=[
  ['programming',/computer science|information technology/i],
  ['electronics',/electronics|electrical|instrumentation/i],
  ['maths',/mathematics|statistics/i],
  ['business',/management|economics|commerce/i],
  ['humanities',/humanities|social sciences|law|languages|education|arts/i],
  ['science',/physics|chemistry|biology|biotechnology|bioscience|environmental|atmospheric|earth|nanotechnology|agriculture|health|medical|pharma/i],
];
export function nptelTopic(title,discipline) {
  for(const [topic,re] of TITLE_TOPICS)if(re.test(title))return topic;
  for(const [topic,re] of NPTEL_DISCIPLINES)if(re.test(discipline))return topic;
  return 'engineering';
}

// ---------- Microsoft Learn ----------
const LEVELS={beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'};
// Paths written only for school teachers, school leaders or parents are not career courses.
const SCHOOL_ROLES=new Set(['k-12-educator','school-leader','parent-guardian','higher-ed-educator']);
const cleanUrl=url=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='learn.microsoft.com')return null;u.searchParams.delete('WT.mc_id');return u.toString();}catch{return null;}};
export function normaliseMicrosoft(p) {
  const roles=p.roles||[],url=cleanUrl(p.url);
  return {
    open:p.type==='learningPath'&&!!url&&!(roles.length&&roles.every(r=>SCHOOL_ROLES.has(r))),
    row:row({kind:'course',subtype:microsoftTopic(p),source_name:SOURCES.microsoft,external_id:String(p.uid||'').slice(0,80),title:p.title,organizer:'Microsoft',
      description:text(p.summary,600),tags:[...(p.levels||[]).map(l=>LEVELS[l]).filter(Boolean),'Self-paced'],participation_mode:'online',official_url:url,
      duration_minutes:Number(p.duration_in_minutes)>0?Math.round(Number(p.duration_in_minutes)):null})
  };
}
export async function readMicrosoft(get) {
  const body=await get('https://learn.microsoft.com/api/catalog/?locale=en-us&type=learningPaths');
  if(!Array.isArray(body?.learningPaths)||!body.learningPaths.length)throw new Error('Unexpected Microsoft Learn response');
  return body.learningPaths.map(normaliseMicrosoft);
}

// ---------- NPTEL ----------
// Each course on nptel.ac.in/courses is a card: link, name, discipline, then teacher and institute.
export function parseNptel(html) {
  const cards=[...String(html).matchAll(/<a href="\/courses\/(\d{6,12})"[^>]*>[\s\S]*?<div class="name[^"]*">([^<]+)<\/div>\s*<div class="discipline[^"]*">([^<]*)<\/div>\s*<div class="meta-data[^"]*">\s*<span[^>]*>([^<]*)<\/span>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)];
  if(!cards.length)throw new Error('NPTEL course cards not found');
  return cards.map(([,id,name,discipline,teacher,institute])=>{
    const title=decode(name).replace(/^NOC\s*:\s*/i,'').trim(),field=decode(discipline).trim();
    return {
      open:!!title,
      row:row({kind:'course',subtype:nptelTopic(title,field),source_name:SOURCES.nptel,external_id:id,title,organizer:text(decode(institute),200),
        tags:[field,text(decode(teacher),60),'Video lectures'].filter(Boolean),participation_mode:'online',official_url:`https://nptel.ac.in/courses/${id}`})
    };
  });
}
export async function readNptel(page) {
  return parseNptel((await page('https://nptel.ac.in/courses')).text);
}

// The course list shows the newest rows first, and every course is new on the first run. Writing the
// topics job seekers look for most last puts them at the top of the first page.
const TOPIC_ORDER=['humanities','science','maths','business','engineering','electronics','security','cloud','data','programming','ai'];
export const firstPageLast=items=>[...items].sort((a,b)=>TOPIC_ORDER.indexOf(a.row.subtype)-TOPIC_ORDER.indexOf(b.row.subtype));

async function main() {
  const client=createClient({timeoutMs:60000});
  const readers=[[SOURCES.microsoft,async()=>firstPageLast(await readMicrosoft(client.json))],[SOURCES.nptel,async()=>firstPageLast(await readNptel(client.page))]];
  if(process.argv.includes('--dry-run')){
    for(const [name,read] of readers){
      const items=await read(),open=items.filter(i=>i.open);
      const topics=Object.fromEntries(Object.entries(Object.groupBy(open,i=>i.row.subtype)).map(([k,v])=>[k,v.length]));
      console.log(JSON.stringify({source:name,read:items.length,listed:open.length,topics}));
    }
    return;
  }
  await collect({label:'Free courses',kinds:['course'],readers});
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
