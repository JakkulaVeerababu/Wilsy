import test from 'node:test';
import assert from 'node:assert/strict';
import {readState} from '../js/jobs-core.js';
import {readSearches,searchQuery,searchName,addSearch,toggleComparison} from '../js/job-workspace-core.js';

test('Saved searches retain filters but exclude stale pages, details and device-specific saved IDs',()=>{
  const state=readState('?q=C%2B%2B&mode=remote&country=India&sort=posted&page=4&job=123&saved=1');
  const query=searchQuery(state);
  assert.equal(query,'q=C%2B%2B&mode=remote&country=India&sort=posted');
  const reopened=readState('?'+query);
  assert.equal(reopened.page,1);assert.equal(reopened.id,'');assert.equal(reopened.saved,false);
  assert.equal(reopened.q,'C++');assert.equal(reopened.country,'India');
  assert.match(searchName(query),/C\+\+.*Remote.*India.*Latest posted/);
});
test('Saved searches reject corrupt storage, deduplicate canonical filters, and never evict another search',()=>{
  for(const data of ['null','{}','bad','[null,123,{}]'])assert.deepEqual(readSearches({getItem:()=>data}),[]);
  assert.deepEqual(readSearches({getItem:()=>{throw Error('blocked');}}),[]);
  assert.deepEqual(readSearches({getItem:()=>'["mode=remote&page=2","mode=remote&job=12","evil=1"]'}),['mode=remote']);
  const existing=Array.from({length:8},(_,i)=>`q=Role${i}`);
  assert.equal(addSearch(existing,readState('?q=new')).searches,existing);
  assert.match(addSearch(existing,readState('?q=new')).error,/eight/);
  assert.match(addSearch(['mode=remote'],readState('?mode=remote')).error,/already/);
  assert.match(addSearch([],readState()).error,/keyword or filter/);
});
test('Comparison keeps selected roles across result pages, removes by ID, and enforces three roles',()=>{
  const jobs=[{id:1,title:'Role one'},{id:2,title:'Role two'},{id:3,title:'Role three'}];
  assert.deepEqual(toggleComparison(jobs,{id:'2'}).jobs,[jobs[0],jobs[2]]);
  const limit=toggleComparison(jobs,{id:4,title:'Another page'});
  assert.equal(limit.jobs,jobs);assert.match(limit.error,/three/);
  const next=toggleComparison(jobs.slice(0,2),{id:4,title:'Another page'});
  assert.deepEqual(next.jobs.map(j=>j.id),[1,2,4]);assert.equal(next.error,'');
  assert.equal(toggleComparison(jobs,{id:'<script>'}).jobs,jobs);
});
