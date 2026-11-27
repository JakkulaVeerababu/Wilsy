import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.join(process.cwd(),'dist');
const port=Number(process.env.PORT)||4173;
// Like vercel.json: /jobs/<id>-<slug> without a built file goes to the job-page function (live public search).
let jobPage, searchHandler, payHandlers, unsubscribeHandlers, jobsRpcHandler;
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
// Like api/pay/*.mjs: Razorpay Featured job payments (needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and SUPABASE_SERVICE_ROLE_KEY in the environment).
async function pay(req,res,name){
  payHandlers??=(await import('./pay-handler.mjs')).createPayHandlers();
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const response=await payHandlers[name](new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:{'Content-Type':'application/json'},body:req.method==='POST'?Buffer.concat(chunks):undefined}));
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
http.createServer(async(req,res)=>{
  // Collapse leading slashes so a request like "//" is not read as a protocol-relative URL (that threw and killed the server).
  req.url='/'+String(req.url||'/').replace(/^\/+/,'');
  const payRoute={'/api/pay/create-order':'createOrder','/api/pay/verify':'verify'}[new URL(req.url,'http://localhost').pathname];
  if(payRoute){try{await pay(req,res,payRoute);}catch(error){console.error(error);res.writeHead(502);res.end();}return;}
  // Like api/alerts/unsubscribe.mjs (needs WILSY_UNSUBSCRIBE_SECRET and SUPABASE_SERVICE_ROLE_KEY in the environment).
  if(new URL(req.url,'http://localhost').pathname==='/api/alerts/unsubscribe'){
    try{
      unsubscribeHandlers??=(await import('./unsubscribe-handler.mjs')).createUnsubscribeHandlers();
      const response=await unsubscribeHandlers[req.method==='POST'?'post':'get'](new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method==='POST'?'POST':'GET'}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){console.error(error);res.writeHead(502);res.end();}
    return;
  }
  // Like api/jobs-rpc.mjs (reads JOBS_DATABASE_URL when set, else Supabase).
  if(new URL(req.url,'http://localhost').pathname==='/api/jobs-rpc'&&req.method==='POST'){
    try{
      jobsRpcHandler??=(await import('./jobs-rpc-handler.mjs')).createJobsRpcHandler();
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const response=await jobsRpcHandler(new Request(`http://127.0.0.1:${port}${req.url}`,{method:'POST',body:Buffer.concat(chunks)}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){console.error(error);res.writeHead(502);res.end();}
    return;
  }
  if(new URL(req.url,'http://localhost').pathname==='/api/search'){try{await search(req,res);}catch(error){console.error(error);res.writeHead(502);res.end();}return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let relative=pathname==='/'?'index.html':pathname.slice(1).replace(/\/$/,'');
    if(relative.split('/').some(segment=>segment.startsWith('.')&&segment!=='.well-known')){res.writeHead(403);res.end();return;}
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
