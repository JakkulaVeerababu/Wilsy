// Read-only check that collectors are still publishing. Fails when the newest public job is too old.
import {databaseRequest} from '../js/data-client.js';
const maxHours=Number(process.env.MAX_JOB_AGE_HOURS||6);
const [newest]=await databaseRequest('wilsy_public_jobs?select=first_seen_at,discovered_at&order=first_seen_at.desc.nullslast&limit=1');
const seen=Date.parse(newest?.first_seen_at||newest?.discovered_at||'');
if(!Number.isFinite(seen))throw new Error('No public job has a discovery time');
const hours=(Date.now()-seen)/3600000;
console.log(`Newest public job was found ${hours.toFixed(1)} hours ago (limit ${maxHours}).`);
if(hours>maxHours){console.error('Job collection looks stalled.');process.exit(1);}
