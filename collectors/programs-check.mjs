// Open-source programs check: once a day (a step of the daily snapshot workflow) re-reads each
// program's official page in frontend/data/open-source-programs.json and notices when the dates
// printed there change, so a person can update the entry.
//
// It never edits the facts. It records, per program, whether the page loaded (check.ok), when it
// was checked, and a fingerprint of the dates on the page (check.seen). When check.seen differs from
// check.reviewed (one fingerprint, or a list of them), the run summary asks for a review; whoever
// updates the entry adds seen to reviewed. The pages read are the programs' own official pages, once a day.
// Usage: node collectors/programs-check.mjs [path/to/open-source-programs.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createClient,pool} from './http.mjs';

const MONTH='(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// Matches "March 16", "Oct. 12, 2026", "3 April 2026" and "2026-01-14".
const DATE=new RegExp(`\\b(?:${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+20\\d{2})?|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\.?(?:,?\\s+20\\d{2})?|20\\d{2}-\\d{2}-\\d{2})\\b`,'gi');

export const pageText=html=>String(html??'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
// One spelling per date ("21 April", "April 21st" and "Apr. 21" all become "apr 21"), so a page that
// is served with a different date style, layout or counter doesn't count as a change.
export function canonicalDate(match) {
  const d=match.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g,'$1').replace(/[.,\s]+/g,' ').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;
  const month=/[a-z]+/.exec(d)?.[0].slice(0,3),numbers=d.match(/\d+/g)||[];
  const year=numbers.find(n=>n.length===4),day=numbers.find(n=>n.length<=2);
  return `${month} ${Number(day)}${year?' '+year:''}`;
}
export function datesOn(html) {
  return [...new Set((pageText(html).match(DATE)||[]).map(canonicalDate))].sort();
}
export const fingerprint=dates=>dates.length?crypto.createHash('sha256').update(dates.join('|')).digest('hex').slice(0,16):null;

// Pure: the updated check record for one program, and whether it needs a person to look.
export function checkProgram(program,result,now=new Date()) {
  const previous=program.check||{};
  if(!result.ok)return {check:{...previous,checked_at:now.toISOString(),ok:false},review:false,dates:[]};
  const seen=fingerprint(result.dates);
  // reviewed may list several fingerprints: some sites serve more than one version of the same page.
  const accepted=[].concat(previous.reviewed??[]);
  return {check:{...previous,seen,checked_at:now.toISOString(),ok:true},review:!!seen&&!accepted.includes(seen),dates:result.dates};
}

async function main() {
  const file=path.resolve(process.argv[2]||'frontend/data/open-source-programs.json');
  const data=JSON.parse(await fs.readFile(file,'utf8'));
  const client=createClient({perHost:1});
  const now=new Date(),lines=[];
  const results=await pool(data.programs,3,async program=>{
    try{const {text}=await client.page(program.check_url);return {ok:true,dates:datesOn(text)};}
    catch(error){return {ok:false,error:error.message};}
  });
  // The file is rewritten only when a page's result changed, so a quiet day makes no commit.
  // check.checked_at is therefore when the result last changed.
  const result=programs=>JSON.stringify(programs.map(p=>[p.check?.seen??null,p.check?.ok??null]));
  const before=result(data.programs);
  let failed=0,toReview=0;
  data.programs.forEach((program,i)=>{
    const {check,review,dates}=checkProgram(program,results[i],now);
    program.check=check;
    if(!results[i].ok){failed++;lines.push(`| ${program.name} | could not load (${String(results[i].error).replace(/[|<>]/g,' ').slice(0,80)}) |`);}
    else if(review){toReview++;lines.push(`| ${program.name} | dates on the official page changed since the last review: ${dates.slice(0,6).join(', ').replace(/[|<>]/g,' ')} |`);}
  });
  if(result(data.programs)!==before)await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
  const summary=`### Open-source programs: ${data.programs.length} checked, ${toReview} to review, ${failed} unreachable\n\n${lines.length?`| Program | Note |\n|---|---|\n${lines.join('\n')}\n`:'No changes.\n'}`;
  console.log(summary);
  if(failed===data.programs.length)process.exitCode=1;
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
