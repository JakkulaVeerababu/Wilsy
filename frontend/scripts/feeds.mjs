import {escapeHtml as e} from '../js/directory-core.js';
import {jobPath} from '../js/jobs-core.js';

// RSS 2.0 feed of the newest live jobs, rebuilt on every deploy. Feed readers, Telegram and Slack bots and
// college placement groups can follow it without an account.

const found = job => Date.parse(job.first_seen_at || job.discovered_at || job.posted_at || '') || 0;
const MODE = {remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'};
const date = time => new Date(time).toUTCString();

export function jobFeed(jobs, {origin, limit = 60, now = Date.now()} = {}) {
  const items = jobs.filter(j => /^\d+$/.test(String(j.id)) && j.title && j.company).sort((a, b) => found(b) - found(a)).slice(0, limit);
  const entries = items.map(job => {
    const link = origin + jobPath(job) + '?utm_source=rss&utm_medium=feed';
    const where = [job.location || [job.city, job.country].filter(Boolean).join(', '), MODE[job.work_mode]].filter(Boolean).join(' · ');
    return `<item><title>${e(`${job.title} at ${job.company}`)}</title><link>${e(link)}</link><guid isPermaLink="false">wilsy-job-${e(job.id)}</guid>${found(job) ? `<pubDate>${date(found(job))}</pubDate>` : ''}<description>${e(where || 'See the listing for the location.')}</description></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>WILSY: newest jobs</title><link>${e(origin)}/jobs</link><atom:link href="${e(origin)}/feed.xml" rel="self" type="application/rss+xml"/><description>The newest jobs WILSY found on employer career sites, with direct links to apply.</description><language>en-in</language><lastBuildDate>${date(now)}</lastBuildDate><ttl>60</ttl>
${entries.join('\n')}
</channel></rss>
`;
}
