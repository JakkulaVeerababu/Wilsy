// Read-only checks; the frontend uses this same public credential and API.
import assert from 'node:assert/strict';
import {searchHackathons,hackathonFacets,databaseRequest} from '../data-client.js';
const [collection,facets,saved]=await Promise.all([searchHackathons({}),hackathonFacets(),searchHackathons({saved:[]})]);
assert.ok(Number.isInteger(collection.total)&&collection.total>=0);
assert.ok(Array.isArray(collection.events));assert.equal(saved.total,0);
for(const event of collection.events){
  assert.ok(['live','published'].includes(event.status)&&event.last_verified_at);
  assert.ok(!('metadata' in event)&&!('source_payload' in event));
  assert.ok(Array.isArray(event.prizes));
  assert.ok(event.prizes.every(p=>!('metadata' in p)));
  const detail=await searchHackathons({id:String(event.id)});
  assert.equal(detail.total,1);
}
for(const path of ['hackathons?select=metadata&limit=1','hackathons?select=source_payload&limit=1','hackathon_prizes?select=metadata&limit=1','hackathon_ingestion_runs?select=*&limit=1']){
  await assert.rejects(()=>databaseRequest(path),undefined,`Private data must be inaccessible: ${path}`);
}
assert.ok(Array.isArray(facets.themes)&&Array.isArray(facets.countries));
console.log(`Hackathon API passed: ${collection.total} public events, search/facets connected, private payloads and ingestion logs denied.`);
