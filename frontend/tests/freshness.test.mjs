import test from 'node:test';
import assert from 'node:assert/strict';
import {weekdayHours,freshness} from '../scripts/check-freshness.mjs';

const at=s=>Date.parse(s);

test('Only Monday to Friday hours (UTC) count towards the wait for a new job',()=>{
  assert.equal(weekdayHours(at('2026-11-14T00:09:00Z'),at('2026-11-15T23:59:00Z')),0,'a whole weekend counts for nothing');
  assert.equal(weekdayHours(at('2026-11-13T20:00:00Z'),at('2026-11-16T03:00:00Z')),7,'Friday evening to Monday morning');
  assert.equal(weekdayHours(at('2026-10-15T06:36:00Z'),at('2026-10-15T13:36:00Z')),7,'the longest weekday gap seen');
  assert.equal(weekdayHours(at('2026-11-16T00:00:00Z'),at('2026-11-23T00:00:00Z')),120,'a whole week');
  assert.equal(weekdayHours(at('2026-11-17T10:00:00Z'),at('2026-11-17T09:00:00Z')),0,'a reversed range is empty');
});

test('A quiet weekend passes, but stopped collectors or a weekday stall fail',()=>{
  const live={lastSeen:'2026-11-15T06:36:00Z',lastRun:'2026-11-15T06:07:00Z'};
  // 15 Nov 2026, the Sunday that first raised the old 6-hour alarm.
  const sunday=freshness({...live,firstSeen:'2026-11-15T00:09:09Z',now:at('2026-11-15T06:50:00Z')});
  assert.equal(sunday.ok,true,sunday.lines.join(' '));
  assert.match(sunday.lines.join(' '),/6\.7 hours ago, 0\.0 of them on weekdays/);

  const stopped=freshness({firstSeen:'2026-11-17T09:00:00Z',lastSeen:'2026-11-17T09:00:00Z',lastRun:'2026-11-17T09:00:00Z',now:at('2026-11-17T12:30:00Z')});
  assert.equal(stopped.ok,false);assert.match(stopped.lines.join(' '),/collectors look stopped/);

  // Worker D keeps re-confirming jobs, but the GitHub collector has not run for four hours.
  const github=freshness({firstSeen:'2026-11-17T08:00:00Z',lastSeen:'2026-11-17T10:36:00Z',lastRun:'2026-11-17T07:07:00Z',now:at('2026-11-17T11:10:00Z')});
  assert.equal(github.ok,false);assert.match(github.lines.join(' '),/GitHub job collector looks stopped/);
  assert.equal(freshness({firstSeen:'2026-11-17T08:00:00Z',lastSeen:'2026-11-17T10:36:00Z',lastRun:null,now:at('2026-11-17T11:10:00Z')}).ok,false);
  const local=freshness({firstSeen:'2026-11-17T08:00:00Z',lastSeen:'2026-11-17T10:36:00Z',now:at('2026-11-17T11:10:00Z')});
  assert.equal(local.ok,true);assert.match(local.lines.join(' '),/were not checked/);

  const stalled=freshness({firstSeen:'2026-11-17T00:00:00Z',lastSeen:'2026-11-17T10:40:00Z',lastRun:'2026-11-17T10:07:00Z',now:at('2026-11-17T11:00:00Z')});
  assert.equal(stalled.ok,false);assert.match(stalled.lines.join(' '),/found no new jobs/);

  const both=freshness({firstSeen:'2026-11-17T00:00:00Z',lastSeen:'2026-11-17T06:00:00Z',lastRun:'2026-11-17T06:07:00Z',now:at('2026-11-17T11:00:00Z')});
  assert.equal(both.ok,false);assert.match(both.lines.join(' '),/look stopped.*found no new jobs/);

  assert.equal(freshness({firstSeen:null,lastSeen:null}).ok,false);
});

test('After a quiet weekend the alarm waits until about mid-morning Monday (UTC)',()=>{
  const check=(firstSeen,now)=>freshness({firstSeen,lastSeen:now,lastRun:now,now:at(now)}).ok;
  // Friday's last job at 22:00 leaves 2 weekday hours on Friday, so 8 more are allowed on Monday.
  assert.equal(check('2026-11-13T22:00:00Z','2026-11-16T07:59:00Z'),true);
  assert.equal(check('2026-11-13T22:00:00Z','2026-11-16T08:00:00Z'),true,'exactly at the limit still passes');
  assert.equal(check('2026-11-13T22:00:00Z','2026-11-16T08:01:00Z'),false);
  // Today's newest job (Sunday 00:09) would first fail at Monday 10:00.
  assert.equal(check('2026-11-15T00:09:09Z','2026-11-16T09:50:00Z'),true);
  assert.equal(check('2026-11-15T00:09:09Z','2026-11-16T10:50:00Z'),false);
});
