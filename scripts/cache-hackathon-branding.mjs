import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {databaseRequest} from '../data-client.js';
const events=[];
for(let offset=0;;offset+=500){
  const page=await databaseRequest(`wilsy_public_hackathons?select=id,title,organizer,official_url,source_url,registration_url&order=id&limit=500&offset=${offset}`);
  events.push(...page);if(page.length<500)break;
}
const old=JSON.parse(await fs.readFile('data/hackathon-branding.json','utf8').catch(()=>'{}'));
const result={checkedAt:new Date().toISOString(),events:{...old.events}};
await fs.mkdir('assets/hackathons',{recursive:true});
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&#x2F;','/');
function imageFromHtml(html){
  const eventLogo=[...html.matchAll(/<amp-img\s+[^>]*>/gi)].map(m=>m[0]).find(t=>/class=["']changeWidth["']/i.test(t));
  if(eventLogo)return {url:eventLogo.match(/src=["']([^"']+)/i)?.[1],kind:'event logo'};
  const metas=[...html.matchAll(/<meta\s+[^>]*>/gi)].map(m=>m[0]);
  const match=metas.find(t=>/(?:property|name)=["']twitter:image["']/i.test(t))||metas.find(t=>/(?:property|name)=["']og:image["']/i.test(t));
  return {url:match?.match(/content=["']([^"']+)/i)?.[1],kind:'event artwork'};
}
async function collect(event){
  const sources=[...new Set([event.source_url,event.official_url].filter(Boolean))];let error;
  for(const sourceUrl of sources){try{
    const source=new URL(sourceUrl);if(source.protocol!=='https:'||source.username||source.password)continue;
    const response=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`Source HTTP ${response.status}`);
    const html=await response.text(),identity=imageFromHtml(html),raw=identity.url;if(!raw)throw Error('No event image in source metadata');
    const imageUrl=new URL(decode(raw),source).href,imageHost=new URL(imageUrl).hostname;
    if(!imageUrl.startsWith('https://')||!(imageHost.endsWith('.cloudfront.net')||imageHost===source.hostname))throw Error('Image host needs review');
    const image=await fetch(imageUrl,{signal:AbortSignal.timeout(20000)});if(!image.ok)throw Error(`Image HTTP ${image.status}`);
    const type=image.headers.get('content-type')?.split(';')[0],ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'})[type];
    if(!ext)throw Error(`Unsupported image type ${type}`);
    const bytes=Buffer.from(await image.arrayBuffer());if(bytes.length>5_000_000||bytes.length<100)throw Error('Image size needs review');
    const file=`assets/hackathons/${event.id}-${createHash('sha256').update(bytes).digest('hex').slice(0,10)}.${ext}`;
    await fs.writeFile(file,bytes);
    result.events[String(event.id)]={title:event.title,logo:'/'+file,kind:identity.kind,sourceUrl,imageUrl,officialUrl:event.official_url,checkedAt:result.checkedAt};
    console.log(`${event.id}: ${event.title} — source artwork saved`);return;
  }catch(e){error=e.message;}}
  console.log(`${event.id}: ${event.title} — ${error||'No image source'}`);
}
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<events.length)await collect(events[next++]);}));
await fs.writeFile('data/hackathon-branding.json',JSON.stringify(result,null,2)+'\n');
console.log(`Current coverage: ${events.filter(e=>result.events[e.id]).length}/${events.length} events. Only sourced artwork is used.`);
