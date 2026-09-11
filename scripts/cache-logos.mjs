import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('data/companies.json','utf8'));
const assets=JSON.parse(await fs.readFile('data/logo-sources.json','utf8'));
await fs.mkdir('assets/logos',{recursive:true});
const selected=process.argv.includes('--featured')?data.companies.filter(c=>c.featured):data.companies;
let index=0,done=0;const failures=[];
async function worker(){while(index<selected.length){const c=selected[index++];const source=c.logoSource || (c.featured?assets.find(a=>a.name===c.name)?.assetUrl:c.logo);try{if(!source?.startsWith('https://'))throw new Error('No verified logo URL');if(c.logo.startsWith('assets/')&&c.logoSource){await fs.access(c.logo);done++;continue;}const r=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const type=r.headers.get('content-type')||'';const ext=type.includes('svg')?'svg':type.includes('png')?'png':type.includes('webp')?'webp':/jpeg|jpg/.test(type)?'jpg':null;if(!ext)throw new Error('Not an image: '+type);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<80)throw new Error('Image too small');const filename=`assets/logos/${c.id.replace(/[^a-z0-9-]/gi,'-')}.${ext}`;await fs.writeFile(filename,bytes);c.logoSource=source;c.logo=filename;done++;}catch(e){failures.push({name:c.name,source,error:e.message});}if((done+failures.length)%100===0)console.log(JSON.stringify({done,failed:failures.length,total:selected.length}));}}
await Promise.all(Array.from({length:8},worker));
await fs.writeFile('data/companies.json',JSON.stringify(data));
await fs.writeFile('.research/logo-failures.json',JSON.stringify(failures,null,2));
console.log(JSON.stringify({cached:done,failed:failures.length,failures}));
