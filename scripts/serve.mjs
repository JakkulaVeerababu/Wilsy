import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.join(process.cwd(),'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
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
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
    res.end(await fs.readFile(path.join(root,'404.html')).catch(()=>'Page not found'));
  }
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
