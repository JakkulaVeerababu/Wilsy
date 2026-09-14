import fs from 'node:fs/promises';
await fs.mkdir('../.research',{recursive:true});
const {companies}=JSON.parse(await fs.readFile('data/companies.json','utf8'));
const output={};let cursor=0,done=0,found=0;
const ats=/(?:jobs|boards|careers)\.(?:ashbyhq|greenhouse|lever|workable|smartrecruiters|recruitee)|myworkdayjobs\.com/;
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
async function run(){while(cursor<companies.length){const c=companies[cursor++];try{if(c.featured)continue;const response=await fetch(c.website,{signal:AbortSignal.timeout(9000)});if(!response.ok)continue;const html=await response.text();const candidates=[];
for(const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
 const href=decode(m[1]),label=m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();let url;try{url=new URL(href,response.url);}catch{continue;}
 if(!['https:','http:'].includes(url.protocol)||/linkedin|indeed|glassdoor|wellfound|ycombinator/.test(url.hostname))continue;
 const same=url.hostname.replace(/^www\./,'')===new URL(response.url).hostname.replace(/^www\./,'');
 let score=0;if(/^careers?(?:\s|$)/i.test(label))score+=50;if(/^(?:jobs|join us|work with us|join our team)(?:\s|$)/i.test(label))score+=40;if(/(?:^|\/)(?:careers?|jobs|join-us)(?:\/|$|\?)/i.test(url.pathname))score+=20;if(ats.test(url.hostname))score+=15;if(same)score+=5;if(url.pathname==='/'&&same)score=0;if(/\/blog\/|\/news\/|\/press\//.test(url.pathname))score=0;
 if(score>=25)candidates.push({url:url.href,score,label});
}
candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];if(best){const r=await fetch(best.url,{signal:AbortSignal.timeout(8000),method:'HEAD'});if(r.ok){output[c.id]={careers:best.url,careersHost:'Company careers',discoveredOn:c.website,checkedAt:'2026-09-11',status:r.status};found++;}}
}catch{}finally{done++;if(done%100===0)console.log(JSON.stringify({checked:done,found,total:companies.length}));}}}
await Promise.all(Array.from({length:12},run));await fs.writeFile('../.research/career-links.json',JSON.stringify(output));console.log(JSON.stringify({checked:done,found}));
