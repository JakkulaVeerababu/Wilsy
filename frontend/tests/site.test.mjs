import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inr,usd,salaryRange} from '../js/pay-format.js';
const root=path.resolve('dist');
const files=new Set(await fs.readdir(root,{recursive:true}));
const htmlFiles=[...files].filter(f=>f.endsWith('.html'));
const pages=new Map(await Promise.all(htmlFiles.map(async f=>[f,await fs.readFile(path.join(root,f),'utf8')])));
const companyFiles=htmlFiles.filter(f=>f.startsWith('companies'+path.sep)&&f!=='companies'+path.sep+'all.html');

test('Every generated company has crawlable salary content and unique metadata',()=>{
  assert.equal(companyFiles.length,1000);
  const titles=new Set();
  for(const file of companyFiles){
    const html=pages.get(file);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    assert.match(html,/INR estimate/);assert.doesNotMatch(html,/original USD|profile-usd/);
    assert.match(html,/Open the salary source/);assert.match(html,/Before you apply/);
    assert.match(html,/https:\/\/www.wilsy.in\/companies\//);
    assert.doesNotMatch(html,/@type["']:\s*["']JobPosting/);
    assert.match(html,/mailto:contact@wilsy.in/);
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
  assert.equal(urls.length,1014);assert.equal(new Set(urls).size,1014);
  assert.ok(urls.every(url=>url.startsWith('https://www.wilsy.in/')));
  assert.ok(!urls.some(url=>url.endsWith('/404')));
  assert.ok(!urls.some(url=>url.endsWith('/jobs')),'The jobs alias uses the homepage canonical');
  assert.ok(urls.includes('https://www.wilsy.in/companies/all'));
  assert.match(pages.get('404.html'),/noindex,follow/);
  assert.doesNotMatch(pages.get('404.html'),/pagead2.googlesyndication/);
  const robots=await fs.readFile(path.join(root,'robots.txt'),'utf8');
  assert.match(robots,/Sitemap: https:\/\/www.wilsy.in\/sitemap.xml/);
});
test('Affiliate and privacy controls are real, disclosed, and consistent',async()=>{
  const home=pages.get('index.html');
  const directory=pages.get('companies.html');
  assert.match(directory,/rel="sponsored noopener noreferrer"/);
  assert.match(directory,/As an Amazon Associate I earn from qualifying purchases/);
  assert.match(home,/data-privacy-choices/);
  assert.match(pages.get('privacy.html'),/Google AdSense/);
  assert.match(pages.get('contact.html'),/mailto:contact@wilsy.in/);
  for(const html of pages.values())assert.doesNotMatch(html,/veerababu@wilsy\.in/);
  assert.doesNotMatch(home,/fonts.googleapis.com|m.media-amazon.com|onmouseover=/);
  assert.equal((directory.match(/id="guides-heading"/g)||[]).length,1);
  assert.doesNotMatch(home,/id="guide-dialog"|data-guide(?:\s|>)/);
  assert.equal((await fs.readFile(path.join(root,'ads.txt'),'utf8')).trim(),'google.com, pub-5489149193350421, DIRECT, f08c47fec0942fa0');
});
test('INR is a dated estimate and original source data stays intact',async()=>{
  const fx=JSON.parse(await fs.readFile(path.join(root,'data/exchange-rate.json'),'utf8'));
  assert.equal(fx.base,'USD');assert.equal(fx.quote,'INR');assert.ok(fx.rate>0);
  assert.match(fx.date,/^\d{4}-\d{2}-\d{2}$/);assert.match(fx.source,/frankfurter/);
  assert.equal(inr(100000,95.56),'₹95.56 L');
  assert.equal(inr(200000,95.56),'₹1.91 Cr');
  assert.equal(salaryRange({min:100000,max:200000},usd),'$100k – $200k');
  assert.match(pages.get('methodology.html'),new RegExp(String(fx.rate).replace('.','\\.')));
  assert.match(pages.get('companies'+path.sep+'google.html'),/₹1.4 Cr – ₹2.02 Cr/);
  const snapshot=JSON.parse(await fs.readFile(path.join(root,'data/companies.json'),'utf8'));
  assert.equal(snapshot.currency,'USD');assert.equal(snapshot.companies.find(c=>c.id==='google').salary.min,147000);
});
test('Jobs, hackathons and company research share the electric blue navigation',()=>{
  for(const html of pages.values()){
    assert.match(html,/href="\/hackathons"/);
    assert.match(html,/href="\/css\/electric.css"/);
    assert.match(html,/name="theme-color" content="#0866ff"/);
  }
  const home=pages.get('index.html'),jobs=pages.get('jobs.html');
  for(const html of [home,jobs]){
    assert.match(html,/id="job-search-form"/);
    assert.match(html,/id="job-results"/);
    assert.match(html,/src="\/js\/jobs.js"/);
    assert.match(html,/href="\/css\/jobs.css"/);
    assert.match(html,/<link rel="canonical" href="https:\/\/www.wilsy.in\/"/);
    assert.doesNotMatch(html,/class="platform-paths"|id="company-grid"|src="\/js\/app.js"/);
    assert.match(html,/href="\/companies#companies"/);
  }
  assert.match(pages.get('companies.html'),/id="company-grid"/);
  assert.match(pages.get('companies.html'),/src="\/js\/app.js"/);
  assert.match(pages.get('companies.html'),/<link rel="canonical" href="https:\/\/www.wilsy.in\/companies"/);
  const hacks=pages.get('hackathons.html');
  assert.match(hacks,/Build something/);assert.match(hacks,/href="\/css\/hackathons.css"/);
  assert.match(hacks,/src="\/js\/hackathons.js"/);assert.match(hacks,/Deadlines · next 30 days/);
  assert.match(pages.get('privacy.html'),/hackathon/);
});
