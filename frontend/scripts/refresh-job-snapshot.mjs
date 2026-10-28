import fs from 'node:fs/promises';
import {fetchJobSnapshot} from './job-snapshot.mjs';

// Explicit maintenance command, not a schedule. Writes only reviewed public content.
const snapshot = await fetchJobSnapshot();
await fs.writeFile(new URL('../data/jobs-home.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Public snapshot refreshed: ${snapshot.jobs.length} previews, ${snapshot.stats.total} published roles as of ${snapshot.updatedAt}.`);
