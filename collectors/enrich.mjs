// Reads what each live job asks for from its title and description (frontend/js/job-facts.js): skills,
// years of experience, the lowest degree it accepts, graduation years, fresher / new-grad flags and
// seniority. Search filters (skill, experience, fresher, new grad) and My WILSY work from these fields.
// Only empty fields, or fields this script filled before (metadata.enrich.f), are written, so details
// that came from the employer are never replaced.
//
// Hourly, after the collectors: jobs this version has not read yet, at most --limit of them.
// Daily (--all): every live job again, writing only the ones whose text now says something different.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node collectors/enrich.mjs [--all] [--limit 3000]
//        node collectors/enrich.mjs --plan   (counts what would change with the public key; writes nothing)
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createDb} from './collect.mjs';
import {pool} from './http.mjs';
import {FACTS_VERSION,factsPatch} from '../frontend/js/job-facts.js';

const PAGE=200;
export const MAX_FAILURE_RATE=0.1;
export const SELECT='id,title,description,job_type,is_internship,skills,experience_min,experience_max,experience_text,education,'
  +'graduation_years,is_fresher,is_new_grad,seniority_level,career_stage,metadata';

/** Path of one page of live jobs after `after` (by id); without all, only jobs this version has not read. */
export function pagePath(after,{all=false}={}) {
  const unread=all?'':`&or=(metadata->enrich->>v.is.null,metadata->enrich->>v.neq.${FACTS_VERSION})`;
  return `jobs?select=${SELECT}&status=eq.published&closed_at=is.null&id=gt.${after}${unread}&order=id.asc&limit=${PAGE}`;
}

/** Reads live jobs page by page and writes each job's changes. Returns counts. */
export async function enrich(db,{all=false,plan=false,limit=Infinity,concurrency=3}={}) {
  const result={read:0,changed:0,written:0,failed:0,filled:{}};
  for(let after=0;result.read<limit;){
    const rows=await db(pagePath(after,{all}));
    if(!Array.isArray(rows))throw new Error('Unexpected jobs response');
    if(!rows.length)break;
    after=rows.at(-1).id;
    const batch=rows.slice(0,Math.max(0,limit-result.read));
    result.read+=batch.length;
    const changes=batch.map(job=>[job,factsPatch(job)]).filter(([,patch])=>patch);
    result.changed+=changes.length;
    for(const [,patch] of changes)for(const key of Object.keys(patch))if(key!=='metadata')result.filled[key]=(result.filled[key]||0)+1;
    if(!plan)await pool(changes,concurrency,async([job,patch])=>{
      try{await db(`jobs?id=eq.${job.id}&status=eq.published`,{method:'PATCH',prefer:'return=minimal',body:patch});result.written++;}
      catch{result.failed++;}
    });
    if(rows.length<PAGE)break;
  }
  return result;
}

export function summaryMarkdown(r,{all,plan}={}) {
  const fields=Object.entries(r.filled).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`- ${k}: ${n}`).join('\n');
  return `## Job details ${plan?'(plan, nothing written)':all?'(all live jobs)':'(new jobs)'}\n\n| Read | Changed | Written | Failed |\n|---|---|---|---|\n`
    +`| ${r.read} | ${r.changed} | ${r.written} | ${r.failed} |\n\n${fields?`Fields set:\n${fields}\n`:''}`;
}

async function main() {
  const {values:args}=parseArgs({options:{all:{type:'boolean'},plan:{type:'boolean'},limit:{type:'string'},out:{type:'string'}}});
  const all=!!args.all,plan=!!args.plan,limit=args.limit?Number(args.limit):Infinity;
  if(!(limit>0))throw new Error('--limit must be a positive number.');
  const url=process.env.SUPABASE_URL||'https://pnkthqatdlozrojwefnc.supabase.co';
  let key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(plan&&!key)key=(await import('../frontend/js/supabase-config.js')).supabaseConfig.publishableKey;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --plan.');
  const result=await enrich(createDb({url,key}),{all,plan,limit});
  console.log(JSON.stringify({mode:plan?'plan':all?'all':'new',...result}));
  if(args.out)await fs.writeFile(path.resolve(args.out),JSON.stringify(result,null,1));
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summaryMarkdown(result,{all,plan})).catch(()=>{});
  const attempts=result.written+result.failed;
  if(attempts&&result.failed/attempts>MAX_FAILURE_RATE)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
