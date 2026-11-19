import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.join(process.cwd(),'dist');
const port=Number(process.env.PORT)||4173;
// Like vercel.json: /jobs/<id>-<slug> without a built file goes to the job-page function (live public search).
let jobPage, searchHandler;
async function renderJobPage(req,res){
  jobPage??=await import('../../api/job-page.mjs');
  const response=await (req.method==='HEAD'?jobPage.HEAD:jobPage.GET)(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method}));
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
// Like api/search.mjs: the public job search the jobs widget (/embed.js) reads.
async function search(req,res){
  searchHandler??=(await import('./search-handler.mjs')).createSearchHandler();
  const response=await searchHandler(new Request(`http://127.0.0.1:${port}${req.url}`));
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
http.createServer(async(req,res)=>{
  if(new URL(req.url,'http://localhost').pathname==='/api/search'){try{await search(req,res);}catch(error){console.error(error);res.writeHead(502);res.end();}return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let relative=pathname==='/'?'index.html':pathname.slice(1).replace(/\/$/,'');
    if(relative.split('/').some(segment=>segment.startsWith('.'))){res.writeHead(403);res.end();return;}
    if(!path.extname(relative))relative+='.html';
    const target=path.resolve(root,relative);
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const content=await fs.readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(content);
  }catch{
    if(/^\/jobs\/\d+-[^/]+$/.test(new URL(req.url,'http://localhost').pathname)){try{await renderJobPage(req,res);return;}catch(error){console.error(error);}}
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
    res.end(await fs.readFile(path.join(root,'404.html')).catch(()=>'Page not found'));
  }
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
