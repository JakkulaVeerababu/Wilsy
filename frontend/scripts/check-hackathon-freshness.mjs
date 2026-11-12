// Read-only check that the hackathon collector is still verifying events. Fails when the most
// recently verified public event is older than the limit.
import {databaseRequest} from '../js/data-client.js';
const maxHours=Number(process.env.MAX_HACKATHON_AGE_HOURS||8);
const [newest]=await databaseRequest('wilsy_public_hackathons?select=last_verified_at&order=last_verified_at.desc.nullslast&limit=1');
const verified=Date.parse(newest?.last_verified_at||'');
if(!Number.isFinite(verified))throw new Error('No public hackathon has a verification time');
const hours=(Date.now()-verified)/3600000;
console.log(`Newest hackathon verification was ${hours.toFixed(1)} hours ago (limit ${maxHours}).`);
if(hours>maxHours){console.error('Hackathon collection looks stalled.');process.exit(1);}
