import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data/companies.json','utf8'));
const results=[];let cursor=0;
async function inspect(c){
  try{
    let r=await fetch(c.careers,{method:'HEAD',signal:AbortSignal.timeout(10000)});
    if([404,405,410].includes(r.status)){r=await fetch(c.careers,{signal:AbortSignal.timeout(10000)});await r.body?.cancel();}
    return {id:c.id,name:c.name,url:c.careers,status:r.status,finalUrl:r.url};
  }catch(e){return {id:c.id,name:c.name,url:c.careers,status:0,error:e.name};}
}
async function worker(){while(cursor<data.companies.length){const c=data.companies[cursor++];results.push(await inspect(c));if(results.length%100===0)console.log(`Checked ${results.length}/1000 careers links`);}}
await Promise.all(Array.from({length:16},worker));
await fs.mkdir('.research',{recursive:true});await fs.writeFile('.research/careers-audit.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({total:results.length,ok:results.filter(x=>x.status>=200&&x.status<400).length,unavailable:results.filter(x=>[404,410].includes(x.status)),blockedOrTimeout:results.filter(x=>x.status===0||x.status>=400&&![404,410].includes(x.status)).length}));
