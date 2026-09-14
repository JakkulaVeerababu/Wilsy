import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initialState,stateSearch,findCompanies,pageSlice,payTier,safeHref,escapeHtml} from '../js/directory-core.js';
const data=JSON.parse(await fs.readFile(new URL('../data/companies.json',import.meta.url),'utf8'));
const companies=data.companies;

test('Exactly 1,000 distinct employers have traceable salaries, recruiting URLs and real local logo files',async()=>{
  assert.equal(companies.length,1000);
  assert.equal(new Set(companies.map(c=>c.id)).size,1000);
  assert.equal(new Set(companies.map(c=>c.name.toLowerCase().trim())).size,1000);
  for(const c of companies){
    assert.ok(c.salary.min>=15000 && c.salary.max>=c.salary.min,`${c.name}: valid annual range`);
    assert.equal(c.tier,payTier(c.salary),`${c.name}: pay tier`);
    assert.deepEqual(c.salary,c.sample.salary);
    assert.ok(c.sample.title && c.sample.source && c.sample.location,`${c.name}: salary provenance`);
    for(const url of [c.website,c.careers,c.sample.source,c.logoSource])assert.match(url,/^https?:\/\//,`${c.name}: source URL`);
    assert.match(c.logo,/^assets\/logos\/[a-z\d-]+\.(svg|png|jpg|webp)$/i);
    const bytes=await fs.readFile(new URL('../'+c.logo,import.meta.url));
    assert.ok(bytes.length>80,`${c.name}: nonempty downloaded logo`);
  }
});
test('Search and combined filters find the right company and safely handle no matches',()=>{
  assert.deepEqual(findCompanies(companies,{...initialState(),query:'google'}).filter(c=>c.name==='Google').map(c=>c.name),['Google']);
  const state={...initialState(),sectors:['AI & data'],stages:['Startup'],tier:1,region:'United States',role:'Engineering',remote:true};
  const found=findCompanies(companies,state);assert.ok(found.length>0);
  assert.ok(found.every(c=>c.sector==='AI & data'&&c.stage==='Startup'&&c.tier===1&&c.regions.includes('United States')&&c.role==='Engineering'&&c.remote));
  assert.equal(findCompanies(companies,{...initialState(),query:'not-a-company-!@#$%'}).length,0);
});
test('Pagination reaches every company exactly once and clamps stale page numbers',()=>{
  const first=pageSlice(companies,1);assert.equal(first.pages,84);assert.equal(first.items.length,12);
  const seen=[];for(let page=1;page<=first.pages;page++)seen.push(...pageSlice(companies,page).items.map(c=>c.id));
  assert.equal(seen.length,1000);assert.equal(new Set(seen).size,1000);
  assert.equal(pageSlice(companies,10000).page,84);assert.equal(pageSlice(companies,84).items.length,4);
  assert.deepEqual(pageSlice([],22),{page:1,pages:1,items:[]});
});
test('Pay sorting compares numeric salary midpoints, including ties',()=>{
  const sorted=findCompanies(companies,{...initialState(),sort:'pay-desc'});
  for(let i=1;i<sorted.length;i++)assert.ok(sorted[i-1].salary.min+sorted[i-1].salary.max>=sorted[i].salary.min+sorted[i].salary.max);
  assert.equal(findCompanies(companies,{...initialState(),sort:'name'})[0].name,[...companies].sort((a,b)=>a.name.localeCompare(b.name))[0].name);
});
test('Filters survive URL sharing and untrusted text cannot create executable markup',()=>{
  const s={...initialState(),query:'AI & cloud',sectors:['AI & data','Developer tools'],stages:['Growth'],role:'Engineering',tier:2,remote:true,region:'Europe',sort:'pay-desc',page:3,view:'list'};
  assert.deepEqual(initialState(stateSearch(s)),s);
  assert.equal(safeHref('javascript:alert(1)'),'#');assert.equal(safeHref('data:text/html,hi'),'#');
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(initialState('?tier=99&sort=garbage&page=-9').tier,0);
});
test('Pay tier boundaries are explicit and no stock value is mixed into salary',()=>{
  for(const [value,tier] of [[99999,4],[100000,3],[149999,3],[150000,2],[199999,2],[200000,1]])assert.equal(payTier({min:value,max:value}),tier);
  const google=companies.find(c=>c.id==='google');assert.equal(google.salary.max,211000);assert.match(google.sample.bonus,/15%/);
});
