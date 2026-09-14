import fs from 'node:fs/promises';
const families = [{name:'DM Sans',slug:'dm-sans'}, {name:'Manrope',slug:'manrope'}];
await fs.mkdir('assets/fonts',{recursive:true});
let css='';
for(const family of families){
  const url=`https://fonts.googleapis.com/css2?family=${family.name.replace(/ /g,'+')}:wght@400..800&display=swap`;
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Font CSS unavailable');
  const text=await r.text();
  const blocks=[...text.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)];
  if(!blocks.length)throw new Error('Latin font not found: '+family.name);
  const block=blocks.at(-1)[1];
  const source=block.match(/url\(([^)]+)\)/)[1];
  const font=await fetch(source,{signal:AbortSignal.timeout(20000)});
  if(!font.ok)throw new Error('Font unavailable');
  const bytes=Buffer.from(await font.arrayBuffer());
  const file=family.slug+'.woff2';
  await fs.writeFile('assets/fonts/'+file,bytes);
  css+=block.replace(source,'/assets/fonts/'+file)+'\n';
  console.log(family.name,bytes.length);
}
await fs.writeFile('assets/fonts/fonts.css',css);
for(const [file,url] of [
  ['DM-Sans-OFL.txt','https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt'],
  ['Manrope-OFL.txt','https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt']
]){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Font license unavailable');await fs.writeFile('assets/fonts/'+file,await r.text());}
