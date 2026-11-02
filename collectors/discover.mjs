// Finds each real company's public job board, preferring the company's own links over guesses.
// Usage: node collectors/discover.mjs [--limit N] [--offset N] [--concurrency N] [--out file.json]
// Input is the reviewed company directory (frontend/data/companies.json). Results are JSON; nothing is
// written to the database here (see apply-discovery.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {ATS,findBoards,slugGuesses,normalizeName,isSyntheticName} from './ats.mjs';
import {createClient,pool} from './http.mjs';

const MAX_BOARDS_ON_PAGE=3; // more distinct boards than this suggests a portfolio or aggregator page

export async function readBoard(client,{ats,slug}) {
  const board=await ATS[ats].read(slug,client.json);
  return {ats,slug,boardName:board.name||'',jobs:board.jobs.length};
}

// Returns {status:'found'|'probable'|'unsupported'|'ambiguous'|'none'|'skipped', ats?, slug?, jobs?, evidence?}.
export async function discoverCompany(company,client) {
  if(isSyntheticName(company.name))return {status:'skipped',evidence:'synthetic_name'};
  const tried=new Set();let unsupported=null,ambiguous=false;
  async function confirm(candidates,evidence) {
    const supported=candidates.filter(c=>ATS[c.ats]);
    if(new Set(supported.map(c=>`${c.ats}:${c.slug.toLowerCase()}`)).size>MAX_BOARDS_ON_PAGE){ambiguous=true;return null;}
    for(const c of supported){
      const key=`${c.ats}:${c.slug.toLowerCase()}`;if(tried.has(key))continue;tried.add(key);
      try{return {status:'found',...await readBoard(client,c),evidence};}catch{}
    }
    unsupported??=candidates.find(c=>!ATS[c.ats])&&{status:'unsupported',...candidates.find(c=>!ATS[c.ats]),evidence};
    return null;
  }
  let result=await confirm(findBoards(company.careers||''),'careers_url');
  if(result)return result;

  const pages=[];
  const addPage=url=>{try{const u=new URL(url);if(u.protocol==='https:'&&!pages.includes(u.href))pages.push(u.href);}catch{}};
  addPage(company.careers);
  if(company.website){addPage(new URL('/careers',company.website).href);addPage(company.website);}
  for(const url of pages.slice(0,3)){
    try{const page=await client.page(url);result=await confirm(findBoards(`${page.url} ${page.text}`),'careers_page');if(result)return result;}catch{}
  }
  if(unsupported)return unsupported;
  if(ambiguous)return {status:'ambiguous',evidence:'many_boards_on_page'};

  // Last resort: guessed board names. Always 'probable' (recorded for review, never auto-approved):
  // a matching name can belong to a different company with the same name.
  for(const slug of slugGuesses(company.name,company.website)){
    for(const ats of ['greenhouse','ashby','lever','workable']){
      const key=`${ats}:${slug}`;if(tried.has(key))continue;tried.add(key);
      try{
        const board=await readBoard(client,{ats,slug});
        const nameMatches=!!board.boardName&&normalizeName(board.boardName)===normalizeName(company.name);
        return {status:'probable',...board,nameMatches,evidence:'name_probe'};
      }catch{}
    }
  }
  return {status:'none'};
}

async function main() {
  const {values:args}=parseArgs({options:{limit:{type:'string'},offset:{type:'string'},concurrency:{type:'string'},out:{type:'string'}}});
  const limit=Number(args.limit||Infinity),offset=Number(args.offset||0),concurrency=Number(args.concurrency||6);
  const root=path.resolve(import.meta.dirname,'..');
  const {companies}=JSON.parse(await fs.readFile(path.join(root,'frontend/data/companies.json'),'utf8'));
  const batch=companies.slice(offset,offset+limit).map(({id,name,website,careers})=>({id,name,website,careers}));
  const client=createClient();
  let done=0;const started=Date.now();
  const results=await pool(batch,concurrency,async company=>{
    const result=await discoverCompany(company,client).catch(error=>({status:'error',error:error.message}));
    if(++done%25===0)console.error(`${done}/${batch.length} checked`);
    return {...company,...result};
  });
  const summary={};for(const r of results)summary[r.status]=(summary[r.status]||0)+1;
  const byAts={};for(const r of results.filter(r=>r.status==='found'))byAts[r.ats]=(byAts[r.ats]||0)+1;
  const out=args.out||path.join(root,'.research',`discovery-${new Date().toISOString().slice(0,10)}.json`);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),offset,count:results.length,summary,byAts,results},null,1));
  console.log(JSON.stringify({checked:results.length,seconds:Math.round((Date.now()-started)/1000),summary,byAts,out}));
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
