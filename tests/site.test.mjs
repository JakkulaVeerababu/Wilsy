import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inr,usd,salaryRange} from '../pay-format.js';
const root=path.resolve('dist');
const files=new Set(await fs.readdir(root,{recursive:true}));
const htmlFiles=[...files].filter(f=>f.endsWith('.html'));
const pages=new Map(await Promise.all(htmlFiles.map(async f=>[f,await fs.readFile(path.join(root,f),'utf8')])));
const companyFiles=htmlFiles.filter(f=>f.startsWith('companies'+path.sep));

test('Every generated company has crawlable salary content and unique metadata',()=>{
  assert.equal(companyFiles.length,1000);
  const titles=new Set();
  for(const file of companyFiles){
    const html=pages.get(file);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    assert.match(html,/original USD/);assert.match(html,/INR estimate/);
    assert.match(html,/Open the salary source/);assert.match(html,/Before you apply/);
    assert.match(html,/https:\/\/www.wilsy.in\/companies\//);
    assert.doesNotMatch(html,/@type["']:\s*["']JobPosting/);
    assert.match(html,/mailto:veerababu@wilsy.in/);
  }
  assert.equal(titles.size,1000);
});
test('All generated internal links, local images, scripts, and styles resolve',()=>{
  for(const [file,html] of pages){
    for(const match of html.matchAll(/(?:href|src)="([^"]*)"/g)){
      const url=match[1].replace(/&amp;/g,'&');
      if(!url||/^(?:https?:|mailto:|data:|#)/.test(url))continue;
      const pathname=decodeURIComponent(new URL(url,'https://www.wilsy.in/'+file.replaceAll(path.sep,'/')).pathname);
      let target=pathname==='/'?'index.html':pathname.slice(1);
      if(!path.extname(target))target+='.html';
      assert.ok(files.has(target.replaceAll('/',path.sep)),`${file}: missing ${url}`);
    }
    assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,`${file}: one primary heading`);
  }
});
test('Sitemap covers exactly the public pages and excludes the error page',async()=>{
  const xml=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.equal(urls.length,1012);assert.equal(new Set(urls).size,1012);
  assert.ok(urls.every(url=>url.startsWith('https://www.wilsy.in/')));
  assert.ok(!urls.some(url=>url.endsWith('/404')));
  assert.match(pages.get('404.html'),/noindex,follow/);
  assert.doesNotMatch(pages.get('404.html'),/pagead2.googlesyndication/);
  const robots=await fs.readFile(path.join(root,'robots.txt'),'utf8');
  assert.match(robots,/Sitemap: https:\/\/www.wilsy.in\/sitemap.xml/);
});
test('Affiliate and privacy controls are real, disclosed, and consistent',async()=>{
  const home=pages.get('index.html');
  assert.match(home,/rel="sponsored noopener noreferrer"/);
  assert.match(home,/As an Amazon Associate I earn from qualifying purchases/);
  assert.match(home,/data-privacy-choices/);
  assert.match(pages.get('privacy.html'),/Google AdSense/);
  assert.match(pages.get('contact.html'),/mailto:veerababu@wilsy.in/);
  assert.doesNotMatch(home,/fonts.googleapis.com|m.media-amazon.com|onmouseover=/);
  assert.equal((home.match(/id="guides-heading"/g)||[]).length,1);
  assert.doesNotMatch(home,/id="guide-dialog"|data-guide(?:\s|>)/);
  assert.equal((await fs.readFile(path.join(root,'ads.txt'),'utf8')).trim(),'google.com, pub-5489149193350421, DIRECT, f08c47fec0942fa0');
});
test('INR is a dated estimate and USD stays intact',async()=>{
  const fx=JSON.parse(await fs.readFile(path.join(root,'data/exchange-rate.json'),'utf8'));
  assert.equal(fx.base,'USD');assert.equal(fx.quote,'INR');assert.ok(fx.rate>0);
  assert.match(fx.date,/^\d{4}-\d{2}-\d{2}$/);assert.match(fx.source,/frankfurter/);
  assert.equal(inr(100000,95.56),'₹95.56 L');
  assert.equal(inr(200000,95.56),'₹1.91 Cr');
  assert.equal(salaryRange({min:100000,max:200000},usd),'$100k – $200k');
  assert.match(pages.get('methodology.html'),new RegExp(String(fx.rate).replace('.','\\.')));
  assert.match(pages.get('companies'+path.sep+'google.html'),/\$147k – \$211k/);
});
