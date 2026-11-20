import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {agePlan, ageResult, exactAge, birthday, yearsBefore, limitsTable, MAX_OTHER_YEARS} from '../js/age-core.js';
import {PASSAGES, DURATIONS, words, testText, wordErrors, typingScore, benchmarks, liveMarks, bestAfter, shareText, typingResult, clock} from '../js/typing-core.js';
import {settlement, settlementResult, wagesDue, relievingLink} from '../js/settlement-core.js';
import {noticePlan, noticeResult, settlementLink} from '../js/notice-core.js';
import {QUESTIONS, composeAnswer, answerChecks, exampleText, exampleValues, spokenSeconds, cleanAnswers, answersText, questionForm, shortName} from '../js/interview-core.js';
import {TOOLS, toolsBody, ageBody, typingBody, settlementBody, interviewBody, searchIndex} from '../scripts/feature-pages.mjs';
import {header, footer} from '../scripts/page-shell.mjs';

test('Age: the UPSC and SSC rule gives the birth dates SSC printed, and relaxations raise the limit', () => {
  // SSC CGL 2025: ages 18 to 27 on 1 August 2025 meant born from 2 August 1998 to 1 August 2007.
  const ssc = agePlan({birth: '2000-05-10', on: '2025-08-01', min: 18, max: 27});
  assert.equal(ssc.earliest, '1998-08-02');
  assert.equal(ssc.latest, '2007-08-01');
  assert.equal(agePlan({birth: '1998-08-02', on: '2025-08-01', min: 18, max: 27}).eligible, true);
  assert.equal(agePlan({birth: '2007-08-01', on: '2025-08-01', min: 18, max: 27}).eligible, true, 'turning 18 on the cut-off date counts');
  const exactly27 = agePlan({birth: '1998-08-01', on: '2025-08-01', min: 18, max: 27});
  assert.equal(exactly27.tooOld, true, 'reaching 27 on the cut-off date is over the limit');
  assert.equal(exactly27.crossed, '2025-08-01');
  assert.equal(agePlan({birth: '1998-08-01', on: '2025-08-01', min: 18, max: 27, rule: 'completed'}).eligible, true, 'some states allow you to be 27');
  assert.equal(agePlan({birth: '1997-08-02', on: '2025-08-01', min: 18, max: 27, rule: 'completed'}).eligible, true);
  assert.equal(agePlan({birth: '1997-08-01', on: '2025-08-01', min: 18, max: 27, rule: 'completed'}).eligible, false);
  const young = agePlan({birth: '2007-08-02', on: '2025-08-01', min: 18, max: 27});
  assert.equal(young.tooYoung, true);
  assert.equal(young.reachesMin, '2025-08-02');
  assert.equal(agePlan({birth: '1990-01-01', on: '2026-08-01', max: 27, category: 'obc'}).upper, 30);
  assert.equal(agePlan({birth: '1990-01-01', on: '2026-08-01', max: 27, category: 'sc', pwbd: true}).upper, 42);
  assert.equal(agePlan({birth: '1990-01-01', on: '2026-08-01', max: 27, category: 'ews'}).upper, 27, 'EWS gets no age relaxation');
  assert.equal(agePlan({birth: '1990-01-01', on: '2026-08-01', max: 27, other: 99}).upper, 27 + MAX_OTHER_YEARS);
  assert.equal(agePlan({birth: '1990-01-01', on: '2026-08-01', max: 27, category: 'obc', pwbd: true}).relaxYears, 13);
  assert.deepEqual(limitsTable(27).map(([, n]) => n), [27, 30, 32, 37, 40, 42]);
  // No maximum: only the minimum is checked. A maximum below the minimum is flagged, not used.
  assert.equal(agePlan({birth: '1960-01-01', on: '2026-08-01', min: 18, max: ''}).eligible, true);
  assert.equal(agePlan({birth: '2000-01-01', on: '2026-08-01', min: 30, max: 25}).badLimits, true);
  assert.equal(agePlan({birth: '2027-01-01', on: '2026-08-01'}).error, 'after');
  assert.equal(agePlan({birth: '', on: '2026-08-01'}), null);
});

test('Age: exact ages, leap-day birthdays and the result panel', () => {
  assert.deepEqual(exactAge('2002-06-15', '2026-11-20'), {years: 24, months: 5, days: 5});
  assert.deepEqual(exactAge('2000-01-31', '2000-03-01'), {years: 0, months: 1, days: 1});
  assert.deepEqual(exactAge('2001-08-01', '2025-08-01'), {years: 24, months: 0, days: 0});
  assert.equal(exactAge('2026-01-02', '2026-01-01'), null);
  // A 29 February birthday turns a year older on 1 March in other years, and both ways of counting agree.
  assert.equal(birthday('2008-02-29', 18), '2026-03-01');
  assert.equal(yearsBefore('2024-02-29', 18), '2006-02-28');
  assert.deepEqual(exactAge('2008-02-29', '2026-02-28'), {years: 17, months: 11, days: 27});
  assert.equal(agePlan({birth: '2008-02-29', on: '2026-02-28', min: 18}).tooYoung, true);
  assert.equal(agePlan({birth: '2008-02-29', on: '2026-03-01', min: 18}).tooYoung, false);
  const html = ageResult(agePlan({birth: '2000-05-10', on: '2025-08-01', min: 18, max: 27, category: 'obc'}));
  assert.match(html, /25 years/);
  assert.match(html, /27 \+ 3 \(OBC\)/);
  assert.match(html, /born from 2 August 1995 to 1 August 2007/);
  assert.match(html, /is-yes/);
  assert.match(ageResult(agePlan({birth: '1990-01-01', on: '2025-08-01', min: 18, max: 27})), /is-no[^>]*>Over the limit/);
  assert.match(ageResult(null), /Enter your date of birth/);
});

test('Typing test: wrong words are counted by alignment, and speed follows the 5-key word', () => {
  assert.equal(wordErrors('the quick brwn fox', 'the quick brown fox jumps over'), 1, 'a misspelt word');
  assert.equal(wordErrors('the brown fox', 'the quick brown fox'), 1, 'a skipped word costs one, not every word after it');
  assert.equal(wordErrors('the quick quick brown', 'the quick brown fox'), 1, 'an extra word');
  assert.equal(wordErrors('the quick', 'the quick brown fox'), 0, 'words not reached yet are not mistakes');
  assert.equal(wordErrors('', 'the quick'), 0);
  const target = testText('first-job', 1), typed = words(target).slice(0, 40).join(' ');
  const clean = typingScore({typed, target, seconds: 60});
  assert.equal(clean.chars, typed.length);
  assert.equal(clean.gross, Math.round(typed.length / 5));
  assert.equal(clean.errors, 0);
  assert.equal(clean.accuracy, 100);
  assert.equal(clean.kdph, clean.net * 300);
  const sloppy = typingScore({typed: typed.replace('first', 'frist').replace('exciting', 'exiting'), target, seconds: 30});
  assert.equal(sloppy.errors, 2);
  assert.equal(sloppy.net, Math.max(0, Math.round(sloppy.chars / 5 / 0.5 - 2 / 0.5)));
  assert.ok(sloppy.accuracy < 100);
  assert.equal(typingScore({typed: 'Starting your fi', target, seconds: 60}).errors, 0, 'a word cut off by the timer is not a mistake while it matches');
  assert.equal(typingScore({typed: 'Starting your fx', target, seconds: 60}).errors, 1);
  assert.deepEqual(benchmarks({net: 35, kdph: 10500}).map(b => b.met), [true, true]);
  assert.deepEqual(benchmarks({net: 30, kdph: 9000}).map(b => b.met), [false, true]);
  assert.deepEqual(benchmarks({net: 26, kdph: 7800}).map(b => b.met), [false, false]);
  assert.deepEqual(liveMarks('Starting yuor ', words(target)), {marks: [true, false], index: 2, onTrack: true});
  assert.equal(liveMarks('Starting your fx', words(target)).onTrack, false);
  assert.equal(clock(65), '1:05');
});

test('Typing test: passages are original plain text, long enough for every test length', () => {
  assert.ok(PASSAGES.length >= 8);
  for(const p of PASSAGES) {
    assert.doesNotMatch(p.text, /[^\x20-\x7e]/, `${p.id} uses only keys on a plain keyboard`);
    assert.ok(words(p.text).length >= 170, `${p.id} is a full passage`);
  }
  assert.equal(new Set(PASSAGES.map(p => p.id)).size, PASSAGES.length);
  for(const [minutes] of DURATIONS) assert.ok(words(testText('library', minutes)).length >= minutes * 120, `${minutes} min`);
  assert.ok(testText('library', 1).startsWith('In a small village'));
  const first = bestAfter({}, 1, {net: 40, accuracy: 96, words: 50}, '2026-11-20');
  assert.equal(first.isBest, true);
  assert.equal(first.previous, null);
  const worse = bestAfter(first.bests, 1, {net: 38, accuracy: 99, words: 50});
  assert.equal(worse.isBest, false);
  assert.equal(worse.bests[1].net, 40);
  assert.equal(bestAfter(first.bests, 1, {net: 41, accuracy: 90, words: 50}).isBest, true);
  assert.equal(bestAfter(first.bests, 5, {net: 20, accuracy: 90, words: 50}).bests[1].net, 40, 'each length keeps its own best');
  assert.match(shareText({net: 42, accuracy: 97.5}, 1), /^I typed 42 words a minute with 97.5% accuracy in the 1-minute typing test on WILSY/);
  assert.match(typingResult({words: 0}), /No words typed/);
  const result = typingResult({words: 60, chars: 300, errors: 1, seconds: 60, gross: 60, net: 59, accuracy: 98.3, kdph: 17700}, {minutes: 1, best: {net: 70, accuracy: 99}});
  assert.match(result, /59 wpm/);
  assert.match(result, /Above<\/span>SSC English typing test/);
  assert.match(result, /Your best for 1 minute: <strong>70 wpm/);
});

test('Final settlement: salary, leave, gratuity and recoveries add up, with the legal due dates', () => {
  const plan = settlement({last: '2026-11-20', monthly: 60000, basic: 30000, leaveDays: 10, joined: '2020-11-01', shortDays: 5});
  assert.equal(plan.days, 20, 'days owed default to the date of the last day');
  assert.equal(plan.salary, 40000, '60,000 × 20 ÷ 30 days in November');
  assert.equal(plan.encashment, 10000, '30,000 × 10 ÷ 30');
  assert.equal(plan.gratuity, Math.round(30000 * 15 / 26 * 6), 'six years counted');
  assert.equal(plan.recovery, 10000, '5 days × 60,000 ÷ 30');
  assert.equal(plan.total, 40000 + 10000 + plan.gratuity - 10000);
  assert.equal(plan.wagesBy, '2026-11-24', 'Friday + two working days is Tuesday');
  assert.equal(settlement({last: '2026-11-20', saturdays: true}).wagesBy, '2026-11-23');
  assert.equal(plan.gratuityBy, '2026-12-20');
  assert.equal(wagesDue('2026-11-23'), '2026-11-25');
  // Options: a 30-day month never pays more than a month; leave on gross ÷ 30 or basic ÷ 26.
  assert.equal(settlement({last: '2026-12-31', monthly: 60000, payBasis: '30'}).salary, 60000);
  assert.equal(settlement({last: '2026-11-20', monthly: 60000, paidDays: 5}).salary, 10000);
  assert.equal(settlement({last: '2026-11-20', monthly: 60000, basic: 26000, leaveDays: 2, leaveBasis: 'basic-26'}).encashment, 2000);
  assert.equal(settlement({last: '2026-11-20', monthly: 60000, basic: 26000, leaveDays: 3, leaveBasis: 'gross-30'}).encashment, 6000);
  // Gratuity: five years for permanent staff, one year on a fixed-term contract.
  assert.equal(settlement({last: '2026-11-20', basic: 30000, joined: '2024-01-01'}).gratuity, 0);
  assert.match(settlementResult(settlement({last: '2026-11-20', basic: 30000, joined: '2026-05-01', fixedTerm: true})), /one year needed, you have 6 months, 20 days/);
  assert.equal(settlement({last: '2026-11-20', basic: 30000, joined: '2024-01-01', fixedTerm: true}).gratuity, Math.round(30000 * 15 / 26 * 3));
  const owe = settlement({last: '2026-11-20', monthly: 30000, paidDays: 0, shortDays: 60});
  assert.equal(owe.total, -60000);
  assert.match(settlementResult(owe), /You may owe your employer/);
  assert.match(settlementResult(plan), /Wages due by<\/span><strong>Tue 24 Nov/);
  assert.match(settlementResult(plan), /6 years counted/);
  assert.match(settlementResult(settlement({last: '2026-11-20', monthly: 1000})), /Add the date you joined/);
  assert.equal(relievingLink(plan), '/career-letters?letter=relieving&last=2026-11-20');
  assert.equal(settlement({last: 'soon'}), null);
});

test('Notice period links to the settlement, carrying the last day and any notice not served', () => {
  const served = noticePlan({resigned: '2026-11-20', amount: 30});
  assert.equal(settlementLink(served), '/full-and-final-settlement?last=2026-12-19');
  const early = noticePlan({resigned: '2026-11-20', amount: 60, joining: '2026-12-21'});
  assert.equal(settlementLink(early), `/full-and-final-settlement?last=2026-12-20&short=${early.release.short}`);
  assert.match(noticeResult(early), /href="\/full-and-final-settlement\?last=2026-12-20&amp;short=29"/);
});

test('Interview answers: every example fits its question, and the checks catch common problems', () => {
  assert.equal(QUESTIONS.length, 15);
  assert.equal(new Set(QUESTIONS.map(q => q.id)).size, 15);
  for(const q of QUESTIONS) {
    assert.equal(q.example.length, q.fields.length, `${q.id}: one example part per field`);
    const seconds = spokenSeconds(exampleText(q));
    assert.ok(seconds >= q.target[0] && seconds <= q.target[1], `${q.id}: the example takes ${seconds} s`);
    assert.deepEqual(answerChecks(q, exampleValues(q)).map(c => c[0]), ['ok'], `${q.id}: the example passes its own checks`);
    assert.notEqual(shortName(q), q.q);
  }
  const about = QUESTIONS.find(q => q.id === 'about-yourself');
  assert.equal(composeAnswer(about, {now: 'I study CSE', next: 'I want this role!'}), 'I study CSE. I want this role!');
  assert.match(answerChecks(about, {now: 'Hi'})[0][1], /^Short/);
  const long = 'word '.repeat(130);
  assert.equal(answerChecks(about, {now: long, before: long, next: long})[0][0], 'fix', 'about 390 words is far too long');
  assert.match(answerChecks(about, {}).at(0)[1], /Fill in the parts/);
  const star = QUESTIONS.find(q => q.id === 'challenge');
  const story = {...exampleValues(star), result: 'It worked out well in the end.', action: 'We fixed it and we shipped it.'};
  const tips = answerChecks(star, story).map(c => c[1]).join(' ');
  assert.match(tips, /Add a number/);
  assert.match(tips, /use “I” for your part/);
  assert.match(answerChecks(QUESTIONS.find(q => q.id === 'weakness'), {weakness: 'I am a perfectionist and I work too hard on every single thing I do.'}).map(c => c[1]).join(' '), /Perfectionist/);
  assert.equal(answerChecks(QUESTIONS.find(q => q.id === 'why-leave'), {reason: 'My manager is toxic and the work is boring.'}).some(c => c[0] === 'fix'), true);
  assert.match(answerChecks(QUESTIONS.find(q => q.id === 'salary'), {number: 'Whatever is standard for the role, I am flexible.'}).map(c => c[1]).join(' '), /Give a number/);
});

test('Interview answers: saved answers are cleaned, copied as text and escaped in the form', () => {
  const saved = cleanAnswers({'about-yourself': {now: 'I study.', evil: 'x', next: 42}, 'not-a-question': {a: 'b'}, salary: 'nope'});
  assert.deepEqual(saved, {'about-yourself': {now: 'I study.'}});
  assert.deepEqual(cleanAnswers('junk'), {});
  assert.equal(answersText(saved), 'Tell me about yourself.\nI study.');
  const form = questionForm(QUESTIONS[0], {now: '</textarea><script>alert(1)</script>'});
  assert.doesNotMatch(form, /<script>/);
  assert.match(form, /&lt;\/textarea&gt;/);
});

test('The four new tools are on the tools hub, in quick search and the footer, highlighted and built', async () => {
  const urls = ['/age-calculator', '/typing-test', '/full-and-final-settlement', '/interview-answers'];
  const foot = footer();
  for(const url of urls) {
    assert.ok(TOOLS.some(t => t[0] === url), url);
    assert.ok(toolsBody().includes(`href="${url}"`), url);
    assert.ok(searchIndex({companies: []}).some(i => i.u === url), url);
    assert.ok(foot.includes(`href="${url}"`), url);
    assert.match(header(url.slice(1)), /href="\/tools" class="active"/, url);
    const html = await fs.readFile(`dist${url}.html`, 'utf8');
    assert.match(html, /<h1>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.wilsy\.in/);
  }
  assert.match(toolsBody(), /Prepare for interviews and tests/);
  assert.match(ageBody({today: '2026-11-20'}), /data-age-result[^>]*>[\s\S]*Age on Fri, 20 Nov 2026/);
  assert.match(ageBody({today: '2026-11-20'}), /data-day="2027-01-01"[^>]*>1 Jan 2027/);
  assert.match(ageBody({today: '2026-11-20'}), /data-day="2027-08-01"[^>]*>1 Aug 2027/);
  assert.match(typingBody(), /data-ty-passage><span class="is-current">Starting<\/span>/);
  assert.match(settlementBody({today: '2026-11-20'}), /Estimated settlement, before tax/);
  assert.match(interviewBody(), /name="ia-q" value="about-yourself" checked/);
  assert.equal((interviewBody().match(/data-ia-open=/g) || []).length, 15);
  for(const file of ['age-core.js', 'age-calculator.js', 'typing-core.js', 'typing-test.js', 'settlement-core.js', 'final-settlement.js', 'interview-core.js', 'interview-answers.js']) await fs.access(`dist/js/${file}`);
});
