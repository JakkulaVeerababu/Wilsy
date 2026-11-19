import test from 'node:test';
import assert from 'node:assert/strict';
import {findSkills, roleFamily, indiaCity, SKILLS} from '../js/skills-core.js';
import {hiringTrends, trendsBody} from '../scripts/trends.mjs';
import {jobFeed} from '../scripts/feeds.mjs';
import {deadlineDay, deadlineIcs, googleCalendarUrl, calendarActions} from '../js/calendar-core.js';
import {cleanOffer, offerResult, leaders, summary, offersQuery, readOffers, offerTable, offerFields, DEFAULT_OFFERS} from '../js/offer-core.js';
import {matchResume, verdict, yearsAsked} from '../js/resume-core.js';
import {referralMessage, NOTE_LIMIT} from '../js/features.js';
import {readSeen, syncSeen, newSince, newLabel, SEEN_KEY} from '../js/job-workspace-core.js';
import {takeHome} from '../js/take-home-core.js';
import {fetchAllLiveJobs} from '../scripts/live-jobs.mjs';
import {offerBody, resumeBody, referralBox} from '../scripts/feature-pages.mjs';

test('Skills are found by their common spellings, not inside other words or phrases', () => {
  assert.deepEqual(findSkills('React Native and React, Node.js, PostgreSQL, C++ and C#, Spring Boot, CI/CD'), ['C++', 'C#', 'React Native', 'React', 'Node.js', 'Spring', 'PostgreSQL', 'CI/CD']);
  assert.deepEqual(findSkills('You excel at teamwork. Join for Spring 2027. We react to change. See GitHub.'), []);
  assert.deepEqual(findSkills('Advanced Excel and SQL'), ['SQL', 'Excel']);
  assert.ok(SKILLS.length >= 80);
  assert.equal(roleFamily('Senior Data Engineer'), 'Data & AI');
  assert.equal(roleFamily('Sales Engineer'), 'Sales & BD');
  assert.equal(roleFamily('DevOps Engineer'), 'Engineering');
  assert.equal(roleFamily('People Operations Partner'), 'People & HR');
  assert.equal(roleFamily('Chief Vibes Officer'), 'Other');
  assert.equal(indiaCity('Gurugram, Haryana'), 'Delhi NCR');
  assert.equal(indiaCity('Bangalore, India'), 'Bengaluru');
  assert.equal(indiaCity('Berlin'), '');
});

const NOW = Date.parse('2026-11-19T12:00:00Z');
const row = (id, extra = {}) => ({id: String(id), title: 'Engineer', company: 'Acme', company_slug: 'acme', work_mode: 'onsite', first_seen_at: '2026-11-18T10:00:00Z', family: 'Engineering', skills: ['Python'], pay: false, entry: false, ...extra});

test('Hiring trends count families, skills, companies, cities and new roles by day', () => {
  const jobs = [row(1, {work_mode: 'remote', skills: ['Python', 'SQL'], pay: true, location: 'Bengaluru, India'}), row(2, {company: 'Beta', company_slug: 'beta', family: 'Design', skills: [], location: 'Mumbai'}),
    row(3, {first_seen_at: '2026-11-01T00:00:00Z', entry: true, location: 'Gurgaon', family: 'Other'}), row(4, {work_mode: null, country_code: 'IN', location: 'India'})];
  const t = hiringTrends(jobs, {companies: [{id: 'acme', name: 'Acme Corp'}], now: NOW, asOf: '2026-11-19T11:00:00Z'});
  assert.equal(t.total, 4);
  assert.equal(t.companies, 2);
  assert.equal(t.remote, 1);
  assert.equal(t.recent, 3);
  assert.equal(t.pay, 1);
  assert.equal(t.entry, 1);
  assert.equal(t.india, 4);
  assert.deepEqual(t.skills, [['Python', 3], ['SQL', 1]]);
  assert.deepEqual(t.families.at(-1), ['Other', 1], '"Other" comes last');
  assert.deepEqual(t.topCompanies[0], ['Acme', 3, 'acme'], 'links to the company profile by slug');
  assert.deepEqual(t.cities.map(c => c[0]).sort(), ['Bengaluru', 'Delhi NCR', 'Mumbai']);
  assert.equal(t.perDay.length, 14);
  assert.deepEqual(t.perDay.at(-2), ['2026-11-18', 3]);
  assert.equal(t.modes.find(m => m[0] === 'Not stated')[1], 1);
  const html = trendsBody(t, {origin: 'https://www.wilsy.in'});
  assert.match(html, /<h1>What’s hiring right now\.<\/h1>/);
  assert.match(html, /title="Python: 3 jobs \(75%\)"/);
  assert.match(html, /href="\/companies\/acme">Acme<\/a>/);
  assert.match(html, /href="\/jobs\?mode=remote">Remote<\/a>/);
  assert.match(trendsBody(null, {origin: ''}), /nothing to show yet/);
});

test('The RSS feed lists the newest jobs first with escaped text and job links', () => {
  const xml = jobFeed([row(1, {title: 'R&D <Engineer>'}), row(2, {first_seen_at: '2026-11-19T09:00:00Z', location: 'Pune', work_mode: 'hybrid'}), {id: 'bad', title: 'x', company: 'y'}], {origin: 'https://www.wilsy.in', now: NOW});
  assert.match(xml, /^<\?xml version="1.0"/);
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.ok(xml.indexOf('wilsy-job-2') < xml.indexOf('wilsy-job-1'), 'newest first');
  assert.match(xml, /<title>R&amp;D &lt;Engineer&gt; at Acme<\/title>/);
  assert.match(xml, /<description>Pune · Hybrid<\/description>/);
  assert.match(xml, /<link>https:\/\/www\.wilsy\.in\/jobs\/2-[a-z0-9-]+\?utm_source=rss&amp;utm_medium=feed<\/link>/);
});

test('Deadline reminders: an all-day event with two alarms, and a Google Calendar link', () => {
  assert.equal(deadlineDay('2026-11-30'), '2026-11-30');
  assert.equal(deadlineDay('2026-11-30T20:00:00Z'), '2026-12-01', 'a timestamp counts on the India date');
  assert.equal(deadlineDay('2026-11-24T18:30:00Z'), '2026-11-24', 'midnight in India closes the day before');
  assert.equal(deadlineDay('soon'), '');
  const ics = deadlineIcs({id: 'gov-1', title: 'Clerk, ISRO', deadline: '2026-11-30', url: 'https://isro.gov.in/notice', note: 'Official notice'}, NOW);
  assert.match(ics, /DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201/);
  assert.match(ics, /SUMMARY:Deadline: Clerk\\, ISRO/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.ok(ics.split('\r\n').every(line => line.length <= 75));
  assert.ok(!deadlineIcs({title: 'x', deadline: 'x'}));
  assert.ok(!/URL:/.test(deadlineIcs({title: 'x', deadline: '2026-12-01', url: 'javascript:alert(1)'})), 'only https links');
  const google = new URL(googleCalendarUrl({title: 'Hack', deadline: '2026-12-31'}));
  assert.equal(google.searchParams.get('dates'), '20261231/20270101');
  assert.equal(calendarActions({title: 'x', deadline: ''}), '');
  assert.match(calendarActions({title: 'Hack', deadline: '2026-12-31'}), /data-ics="\{&quot;id&quot;/);
});

test('Offers compare in-hand pay, with the joining bonus taxed in year one', () => {
  const a = offerResult({name: 'Acme', ctc: 1200000});
  assert.equal(a.monthly, takeHome({ctc: 1200000}).monthly);
  const b = offerResult({name: 'Beta', ctc: 1500000, variable: 150000, joining: 100000});
  assert.ok(b.firstYear > b.annual && b.joiningNet < 100000, 'the bonus is taxed');
  assert.deepEqual(cleanOffer({ctc: -5, variable: 9e9, pt: 7}, 1), {name: 'Offer B', ctc: 0, variable: 0, joining: 0, equity: 0, pt: 2400});
  const lead = leaders([a, b]);
  assert.equal(lead.monthly, 1);
  assert.equal(lead.tax, 0, 'lower tax leads');
  assert.equal(lead.equity, undefined, 'no equity, no leader');
  assert.match(summary([a, b]), /^Beta puts ₹[\d,]+ more in your account each month than Acme/);
  assert.equal(summary([a]), 'Enter the CTC of at least two offers to compare them.');
  const round = readOffers(offersQuery([{name: 'A~|B', ctc: 1e6}, {name: 'C', ctc: 2e6, equity: 50000}]));
  assert.equal(round[0].name, 'A B');
  assert.equal(round[1].equity, 50000);
  assert.equal(readOffers('only~1'), null);
  assert.match(offerTable(DEFAULT_OFFERS), /class="is-best"/);
  assert.match(offerFields(DEFAULT_OFFERS), /data-offer-add/);
  assert.doesNotMatch(offerFields([...DEFAULT_OFFERS, {ctc: 1}]), /data-offer-add/, 'three offers at most');
});

test('Resume match lists the skills shown and missing, and the years asked', () => {
  const m = matchResume('Built APIs in Python and Django; deployed on AWS with Docker.', 'We need Python, Django, PostgreSQL and Kubernetes. 3+ years of experience.');
  assert.deepEqual(m.matched, ['Python', 'Django']);
  assert.deepEqual(m.close, [['Kubernetes', 'Docker']]);
  assert.deepEqual(m.missing, ['PostgreSQL']);
  assert.deepEqual(m.extra, ['AWS', 'Docker']);
  assert.equal(m.score, 63, '2 shown and 1 close out of 4');
  assert.equal(m.years, 3);
  assert.equal(verdict(50), 'Good match');
  assert.equal(matchResume('anything', 'a friendly team').score, null);
  const near = matchResume('Shipped LLM features with RAG', 'Generative AI and distributed systems');
  assert.deepEqual(near.close, [['Generative AI', 'LLMs']]);
  assert.deepEqual(near.missing, ['Distributed systems']);
  assert.equal(near.score, 25, 'a related skill is half credit');
  assert.equal(yearsAsked('2-4 years of relevant experience, or 5+ yrs experience'), 2);
  assert.equal(yearsAsked('Founded 12 years ago'), null);
});

test('Referral notes fit LinkedIn’s limit and the full message carries the link', () => {
  const note = referralMessage({me: 'Asha', about: 'final-year CSE student at VIT', title: 'Software Engineer', company: 'Stripe'});
  assert.ok(note.length <= NOTE_LIMIT);
  assert.match(note, /^Hi \[Name\], I'm Asha, final-year CSE student at VIT\./);
  assert.ok(referralMessage({title: 'x'.repeat(400), company: 'Acme'}).length <= NOTE_LIMIT);
  assert.match(referralMessage({kind: 'message', title: 'SDE', company: 'Acme', url: 'https://www.wilsy.in/jobs/1-sde-acme'}), /applying for the SDE role at Acme: https:\/\/www\.wilsy\.in\/jobs\/1-sde-acme/);
  const box = referralBox({title: 'SDE', company: 'A&B'}, 'https://www.wilsy.in/jobs/1');
  assert.match(box, /id="ask-referral"/);
  assert.match(box, /keywords=A%26B/);
});

test('Saved searches count the jobs found since they were last opened', () => {
  const storage = {getItem: () => JSON.stringify({'q=data': '2026-11-18T00:00:00Z', 'q=bad': 'nope', other: 5})};
  assert.deepEqual(readSeen(storage), {'q=data': '2026-11-18T00:00:00Z'});
  assert.equal(SEEN_KEY, 'wilsy-search-seen-v1');
  const synced = syncSeen({'q=data': '2026-11-18T00:00:00Z', 'q=gone': '2026-11-01T00:00:00Z'}, ['q=data', 'q=new'], NOW);
  assert.deepEqual(synced, {'q=data': '2026-11-18T00:00:00Z', 'q=new': new Date(NOW).toISOString()});
  const jobs = [{first_seen_at: '2026-11-19T00:00:00Z'}, {first_seen_at: '2026-11-17T00:00:00Z'}];
  assert.deepEqual(newSince(jobs, '2026-11-18T00:00:00Z'), {count: 1, more: false});
  assert.deepEqual(newSince(Array(20).fill(jobs[0]), '2026-11-18T00:00:00Z'), {count: 20, more: true});
  assert.equal(newLabel({count: 20, more: true}), '20+ new');
  assert.equal(newLabel({count: 0}), '');
});

test('The live job pass keeps the family, skills, pay and entry-level flags', async () => {
  const request = async () => ({total: 1, as_of: 'now', jobs: [{id: 9, title: 'Data Analyst Intern', company: 'Acme', is_internship: true, salary_min: 1, description: 'SQL and Tableau dashboards'}]});
  const {jobs: [job]} = await fetchAllLiveJobs({request});
  assert.equal(job.family, 'Data & AI');
  assert.deepEqual(job.skills, ['SQL', 'Tableau']);
  assert.equal(job.entry, true);
  assert.equal(job.pay, true);
  assert.ok(!('description' in job));
});

test('Tool pages render their first view on the server', () => {
  assert.match(offerBody(), /data-offers[\s\S]*<script type="module" src="\/js\/offer-compare.js">/);
  assert.match(resumeBody(), /never uploaded or sent to WILSY/);
});
