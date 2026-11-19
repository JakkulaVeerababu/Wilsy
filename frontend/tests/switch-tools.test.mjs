import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {lastWorkingDay, monthsLater, noticePlan, noticeResult, letterLink, isDay} from '../js/notice-core.js';
import {LETTERS, LETTER_FIELDS, letterText, fieldValue, mailtoLink, valuesFromUrl} from '../js/letters-core.js';
import {cleanDraft, emptyDraft, resumeHtml, resumeText, resumeChecks, isEmptyDraft, linkOf, lines, entryForm, EXAMPLE, MAX_ENTRIES} from '../js/resume-builder-core.js';
import {closesAt, staticDeadlines, liveDeadline, upcoming, daysLeft, bucketOf, daysLeftLabel, closingTime, deadlineList, deadlineRow, kindCounts} from '../js/deadlines-core.js';
import {TOOLS, toolsBody, noticeBody, lettersBody, resumeBuilderBody, deadlinesBody, searchIndex} from '../scripts/feature-pages.mjs';
import {header} from '../scripts/page-shell.mjs';

test('Notice period: days count the resignation day; months end the day before the same date', () => {
  assert.equal(lastWorkingDay({resigned: '2026-03-01', amount: 60}), '2026-04-29');
  assert.equal(lastWorkingDay({resigned: '2026-03-01', amount: 1}), '2026-03-01', 'a one-day notice ends the day you resign');
  assert.equal(lastWorkingDay({resigned: '2026-01-15', amount: 1, unit: 'months'}), '2026-02-14');
  assert.equal(lastWorkingDay({resigned: '2026-01-31', amount: 1, unit: 'months'}), '2026-02-28', 'a shorter month ends on its last day');
  assert.equal(lastWorkingDay({resigned: '2024-01-31', amount: 1, unit: 'months'}), '2024-02-29');
  assert.equal(lastWorkingDay({resigned: '2026-01-01', amount: 1, unit: 'months'}), '2026-01-31');
  assert.equal(lastWorkingDay({resigned: '2026-11-30', amount: 3, unit: 'months'}), '2027-02-28');
  assert.equal(monthsLater('2026-12-10', 2), '2027-02-09');
  for(const bad of [{resigned: '2026-02-30', amount: 30}, {resigned: '2026-03-01', amount: 0}, {resigned: '2026-03-01', amount: 366}, {resigned: '2026-03-01', amount: 13, unit: 'months'}, {resigned: '', amount: 30}])
    assert.equal(lastWorkingDay(bad), '', JSON.stringify(bad));
  assert.equal(isDay('2026-02-29'), false);
  assert.equal(noticePlan({resigned: 'nope', amount: 30}), null);
});

test('Notice period: waivers, the next-day rule, an early release and the buyout', () => {
  const plan = noticePlan({resigned: '2026-11-20', amount: 60, waived: 5, joining: '2026-12-15', monthly: 60000});
  assert.equal(plan.last, '2027-01-18');
  assert.equal(plan.length, 60);
  assert.equal(plan.end, '2027-01-13', 'five waived days come off the end');
  assert.equal(plan.served, 55);
  assert.equal(plan.nextDayRule, '2027-01-14');
  assert.equal(plan.perDay, 2000, 'a day is a 30th of the monthly pay');
  assert.deepEqual(plan.release, {joining: '2026-12-15', wanted: '2026-12-14', short: 30, cost: 60000});
  assert.equal(noticePlan({resigned: '2026-11-20', amount: 30, waived: 400}).waived, 29, 'a waiver leaves at least one day');
  assert.equal(noticePlan({resigned: '2026-11-20', amount: 30, joining: '2027-02-01'}).release.short, 0);
  assert.equal(noticePlan({resigned: '2026-11-20', amount: 30, joining: '2026-11-20'}).release.early, true);
  const html = noticeResult(plan, {today: '2026-11-20'});
  assert.match(html, /Wed, 13 Jan 2027/);
  assert.match(html, /54 days from today/);
  assert.match(html, /30 days early/);
  assert.match(html, /₹60,000/);
  assert.match(html, /href="\/career-letters\?letter=early-release&amp;last=2027-01-13&amp;notice=60\+days&amp;join=2026-12-15"/);
  assert.match(noticeResult(null), /up to 365 days or 12 months/);
  assert.match(noticeResult(noticePlan({resigned: '2026-11-20', amount: 30, joining: '2026-12-15'})), /Add your monthly pay/);
  assert.equal(letterLink('resignation', noticePlan({resigned: '2026-11-20', amount: 30})), '/career-letters?letter=resignation&last=2026-12-19&notice=30+days');
  assert.equal(noticePlan({resigned: '2026-11-20', amount: 3, unit: 'months'}).notice, '3 months', 'a notice in months reaches the letter in months');
});

test('Letters: every letter fills in, and blanks stay as placeholders instead of invented details', () => {
  assert.ok(LETTERS.length >= 10);
  assert.equal(new Set(LETTERS.map(l => l.id)).size, LETTERS.length, 'letter ids are unique');
  const full = {me: 'Asha Rao', to: 'Vikram', company: 'Acme Labs', role: 'Backend engineer', notice: '60', last: '2027-01-13', join: '2026-12-15', date: '2026-11-18', amount: '₹16 LPA', reason: 'another offer', about: 'a backend engineer', detail: 'how the team ships'};
  for(const letter of LETTERS) {
    for(const key of letter.fields) assert.ok(LETTER_FIELDS[key], `${letter.id}: ${key} is a known field`);
    const blank = letterText(letter.id, {}), filled = letterText(letter.id, full);
    for(const text of [blank, filled]) assert.doesNotMatch(text.subject + text.body, /undefined|null|NaN|\[object/, letter.id);
    assert.match(blank.body, /\[[^\]]+\]/, `${letter.id} shows placeholders when blank`);
    assert.doesNotMatch(filled.body, /\[[^\]]+\]/, `${letter.id} has no placeholders when filled`);
    assert.match(filled.body, /Asha Rao\s*(\n.*)?$/, `${letter.id} is signed`);
  }
  const resignation = letterText('resignation', {me: 'Asha Rao', notice: '60', last: '2027-01-13'});
  assert.match(resignation.body, /notice period of 60 days, my last working day will be 13 January 2027/);
  assert.match(resignation.body, /Dear \[Manager’s name\]/);
  assert.equal(resignation.subject, 'Resignation – Asha Rao');
  assert.match(letterText('early-release', {join: '2026-12-15'}).body, /last working day on 14 December 2026/);
  assert.match(letterText('joining-date', {last: '2027-01-13'}).body, /to 14 January 2027\?/);
  assert.match(letterText('thank-you', {}).body, /speak with me today/);
  assert.equal(letterText('nope').subject, letterText(LETTERS[0].id).subject, 'an unknown letter falls back to the first');
});

test('Letters: fields are cleaned, and only dates and the notice come in from the URL', () => {
  assert.equal(fieldValue('last', '2027-02-30'), '');
  assert.equal(fieldValue('notice', '0'), '');
  assert.equal(fieldValue('notice', '45'), '45 days');
  assert.equal(fieldValue('notice', '3 months'), '3 months');
  assert.equal(fieldValue('me', '  Asha   Rao '), 'Asha Rao');
  assert.equal(fieldValue('me', 'x'.repeat(200)).length, LETTER_FIELDS.me.max);
  assert.deepEqual(valuesFromUrl('?letter=early-release&last=2027-01-13&notice=60&join=2026-12-15&me=Spoof'), {letter: 'early-release', values: {last: '2027-01-13', join: '2026-12-15', notice: '60 days'}});
  assert.equal(valuesFromUrl('?notice=3+months').values.notice, '3 months');
  assert.equal(valuesFromUrl('?notice=Pay+me+now').values.notice, undefined, 'only a number of days or months comes in from a link');
  assert.deepEqual(valuesFromUrl('?letter=<script>&last=bad'), {letter: '', values: {}});
  assert.equal(mailtoLink({subject: 'A & B', body: 'one\ntwo'}), 'mailto:?subject=A%20%26%20B&body=one%0D%0Atwo');
});

test('Resume builder: the draft is cleaned and capped, and the example is complete', () => {
  const d = cleanDraft({name: 'x'.repeat(500), experience: Array.from({length: 20}, () => ({role: 'r', extra: 'dropped'})), educationFirst: 'yes', evil: 1});
  assert.equal(d.name.length, 80);
  assert.equal(d.experience.length, MAX_ENTRIES);
  assert.deepEqual(Object.keys(d.experience[0]), ['role', 'company', 'place', 'dates', 'points']);
  assert.equal(d.educationFirst, false, 'only true turns it on');
  assert.equal(d.evil, undefined);
  assert.deepEqual(cleanDraft(null), {...emptyDraft(), experience: [], projects: [], education: []});
  assert.ok(isEmptyDraft(emptyDraft()));
  assert.ok(!isEmptyDraft(EXAMPLE));
  assert.deepEqual(resumeChecks(EXAMPLE), [{level: 'ok', text: 'Looks good. Check it against a job description to find missing keywords.'}]);
  assert.deepEqual(lines('- one\n• two\n\n3. three\n  four  '), ['one', 'two', 'three', 'four']);
  assert.match(EXAMPLE.email, /@example\.com$/, 'the example uses a reserved example address');
  assert.doesNotMatch(EXAMPLE.phone, /\d{10}/, 'and no real-looking phone number');
});

test('Resume builder: the HTML escapes everything and links only to https and mailto', () => {
  const html = resumeHtml({name: '<b>x</b>', email: 'a@b.co', links: 'javascript:alert(1)\ngithub.com/me\nhttps://x.dev/"onmouseover', experience: [{role: '<script>', company: 'C', points: '<img src=x onerror=1>'}], projects: [{name: 'P', link: 'javascript:alert(2)'}]});
  assert.doesNotMatch(html, /<script|<img|<b>/);
  assert.doesNotMatch(html, /href="javascript/i);
  assert.match(html, /href="https:\/\/github\.com\/me"/);
  assert.match(html, /href="mailto:a@b\.co"/);
  assert.equal(linkOf('javascript:alert(1)'), null);
  assert.equal(linkOf('mailto:x@y.z'), null);
  assert.deepEqual(linkOf('https://x.dev/a/'), ['https://x.dev/a/', 'x.dev/a']);
  assert.match(resumeHtml(emptyDraft()), /Your resume appears here/);
  const first = resumeHtml({...EXAMPLE, educationFirst: true}), second = resumeHtml({...EXAMPLE, educationFirst: false});
  assert.ok(first.indexOf('>Education<') < first.indexOf('>Experience<'));
  assert.ok(second.indexOf('>Experience<') < second.indexOf('>Education<'));
  assert.doesNotMatch(entryForm('projects', {name: '"><script>'}, 0), /"><script>/);
});

test('Resume builder: plain text for application forms, and checks that catch common problems', () => {
  const text = resumeText(EXAMPLE);
  assert.match(text, /^ASHA RAO\n/);
  assert.match(text, /\nEXPERIENCE\nBackend intern, Acme Payments \(example\), Bengaluru \(May 2026 – Jul 2026\)\n- Built/);
  assert.match(text, /\nACHIEVEMENTS AND CERTIFICATIONS\n- Finalist/);
  const checks = resumeChecks({name: 'A', email: 'nope', experience: [{points: 'Responsible for things\nWorked on stuff\nI made a page'}]}).map(c => c.text).join('\n');
  for(const want of [/your phone number/, /email address: it doesn’t look complete/, /Add your skills/, /Add your education/, /2 points start/, /Add numbers/, /“I” and “my”/]) assert.match(checks, want);
});

test('Deadlines: dates close at the end of the day in India, soonest first and once each', () => {
  assert.equal(closesAt('2026-11-30'), Date.parse('2026-11-30T18:29:59Z'));
  assert.ok(Number.isNaN(closesAt('')));
  const now = Date.parse('2026-11-20T06:00:00Z');
  const items = staticDeadlines({
    government: [{id: 'g1', title: 'Posts', organization: 'Dept', deadline: '2026-11-23', officialNoticeUrl: 'https://gov.example/n'}, {id: 'g2', title: 'Closed', deadline: '2026-11-19'}, {id: 'g3', title: 'No date'}],
    scholarships: [{slug: 's1', name: 'Scholarship', organizer: 'AICTE', url: 'https://aicte.example', next: {closes: '2026-11-30T18:29:59Z'}}, {slug: 's2', name: 'Usual timing only'}],
    research: [{slug: 'r1', name: 'SRFP', next: {opens: '2026-10-01T00:00:00Z'}}],
  });
  assert.deepEqual(items.map(i => i.id), ['government-g1', 'government-g2', 'scholarship-s1']);
  const live = liveDeadline('hackathon', {id: 7, title: 'Hack', organizer: 'Org', registration_deadline_at: '2026-11-21T12:00:00Z', registration_url: 'https://hack.example'});
  assert.equal(live.url, '/hackathons?event=7');
  assert.equal(liveDeadline('competition', {id: 9, title: 'Case', registration_deadline_at: '2026-12-01T00:00:00Z'}).url, '/competitions?item=9');
  assert.equal(liveDeadline('hackathon', {id: 8, title: 'No deadline'}), null);
  const open = upcoming([...items, live, live], now);
  assert.deepEqual(open.map(i => i.id), ['hackathon-7', 'government-g1', 'scholarship-s1'], 'closed and repeated deadlines drop out');
  assert.equal(daysLeft('2026-11-20', now), 0);
  assert.equal(daysLeft('2026-11-21T12:00:00Z', now), 1);
  assert.equal(daysLeft('2026-11-30T18:30:00Z', now), 10, 'midnight belongs to the day before');
  assert.equal(bucketOf('2026-11-20', now), 'today');
  assert.equal(bucketOf('2026-11-27', now), 'week');
  assert.equal(bucketOf('2026-12-20', now), 'month');
  assert.equal(bucketOf('2027-01-30', now), 'later');
  assert.deepEqual([0, 1, 5].map(daysLeftLabel), ['Closes today', 'Closes tomorrow', '5 days left']);
  assert.equal(closingTime('2026-11-21T11:30:00Z'), 'by 5:00 pm IST');
  assert.equal(closingTime('2026-11-30T18:29:59Z'), '', 'the end of the day needs no time');
  assert.equal(closingTime('2026-11-30'), '');
  assert.deepEqual(kindCounts(open), {hackathon: 1, competition: 0, government: 1, scholarship: 1, research: 0});
});

test('Deadlines: rows link inside WILSY, escape titles and offer a calendar reminder', () => {
  const now = Date.parse('2026-11-20T06:00:00Z');
  const row = deadlineRow({id: 'hackathon-1', kind: 'hackathon', title: '<b>Hack</b>', org: 'Org', deadline: '2026-11-21T12:00:00Z', url: '/hackathons?event=1', source: 'javascript:alert(1)'}, now);
  assert.doesNotMatch(row, /<b>Hack/);
  assert.match(row, /href="\/hackathons\?event=1"/);
  assert.match(row, /is-urgent/);
  assert.match(row, /Closes tomorrow/);
  assert.match(row, /Google Calendar/);
  assert.doesNotMatch(row, /javascript:alert/, 'an unsafe source link is never used');
  const list = deadlineList(upcoming([{id: 'a', kind: 'government', title: 'A', deadline: '2026-11-20', url: '/government-jobs', source: ''}, {id: 'b', kind: 'research', title: 'B', deadline: '2027-03-01', url: '/research-internships/b', source: ''}], now), {now});
  assert.match(list, /Closing today <span>1<\/span>/);
  assert.match(list, /Later <span>1<\/span>/);
  assert.match(deadlineList([], {empty: 'Nothing here.'}), /Nothing here\./);
  const many = Array.from({length: 15}, (_, i) => ({id: 'h' + i, kind: 'hackathon', title: 'H' + i, deadline: '2026-11-20T15:00:00Z', url: '/hackathons?event=' + i, source: ''}));
  const collapsed = deadlineList(many, {now, open: new Set()});
  assert.equal(collapsed.match(/class="dl-item/g).length, 8, 'a long group shows its first rows');
  assert.match(collapsed, /data-dl-expand="today">Show all 15</);
  assert.equal(deadlineList(many, {now, open: new Set(['today'])}).match(/class="dl-item/g).length, 15);
  assert.equal(deadlineList(many.slice(0, 10), {now, open: new Set()}).match(/class="dl-item/g).length, 10, 'no "Show all" for a couple more rows');
});

test('The four new tools are on the tools hub, in quick search, highlighted in the header and built', async () => {
  const urls = ['/notice-period-calculator', '/career-letters', '/resume-builder', '/deadlines'];
  for(const url of urls) {
    assert.ok(TOOLS.some(t => t[0] === url), url);
    assert.ok(toolsBody().includes(`href="${url}"`), url);
    assert.ok(searchIndex({companies: []}).some(i => i.u === url), url);
    assert.match(header(url.slice(1)), /href="\/tools" class="active"/, url);
    const html = await fs.readFile(`dist${url}.html`, 'utf8');
    assert.match(html, /<h1>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.wilsy\.in/);
  }
  assert.match(toolsBody(), /Switch jobs/);
  assert.match(noticeBody({today: '2026-11-20'}), /data-notice-result[^>]*>[\s\S]*Last working day/);
  assert.match(lettersBody(), /name="letter" value="resignation" checked/);
  assert.match(resumeBuilderBody(), /data-rb-preview/);
  const page = deadlinesBody({items: [{id: 'x', kind: 'government', title: '</script><script>alert(1)</script>', deadline: '2099-01-01', url: '/government-jobs', source: ''}], now: Date.parse('2026-11-20T00:00:00Z')});
  assert.doesNotMatch(page.match(/<script type="application\/json" id="deadline-data">([\s\S]*?)<\/script>/)[1], /<\//, 'the data block cannot close its script tag');
  const built = await fs.readFile('dist/deadlines.html', 'utf8');
  assert.match(built, /id="deadline-data">\[/);
  for(const file of ['notice-core.js', 'notice-period.js', 'letters-core.js', 'career-letters.js', 'resume-builder-core.js', 'resume-builder.js', 'deadlines-core.js', 'deadlines.js']) await fs.access(`dist/js/${file}`);
});
