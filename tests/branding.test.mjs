import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {hackathonBranding} from '../brand-assets.js';
const branding=JSON.parse(await fs.readFile('data/hackathon-branding.json','utf8'));
test('Event branding uses sourced local assets and never another event’s image',async()=>{
  const entries=Object.entries(branding.events);assert.ok(entries.length>0);
  for(const [id,asset] of entries){
    assert.match(asset.sourceUrl,/^https:\/\//);assert.match(asset.imageUrl,/^https:\/\//);
    assert.ok((await fs.stat(asset.logo.slice(1))).size>100);
    assert.equal(hackathonBranding({id,source_url:asset.sourceUrl},branding),asset);
    assert.equal(hackathonBranding({id,source_url:'https://different-event.example/'},branding),null);
  }
  assert.equal(hackathonBranding({id:'missing'},branding),null);
  assert.equal(hackathonBranding({id:'1',source_url:'https://event.example/'},{events:{1:{sourceUrl:'https://event.example/',logo:'https://tracker.example/pixel'}}}),null);
});
