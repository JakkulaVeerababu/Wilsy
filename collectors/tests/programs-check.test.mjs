import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {datesOn,canonicalDate,fingerprint,checkProgram,pageText} from '../programs-check.mjs';

test('Dates are found in every common style and spelled one way',()=>{
  const html='<p>Applications open <b>March 16th</b>, close 31 March 2027.</p><script>var x="April 1"</script><li>Oct. 12, 2026</li><td>2026-01-14</td>';
  assert.deepEqual(datesOn(html),['2026-01-14','mar 16','mar 31 2027','oct 12 2026']);
  assert.equal(canonicalDate('21 April'),canonicalDate('April 21st'));
  assert.equal(canonicalDate('Sept. 3, 2027'),'sep 3 2027');
  assert.equal(pageText('<style>a{}</style>Hi&nbsp;there'),'Hi there');
});

test('The same dates in a different layout give the same fingerprint; new dates do not',()=>{
  const a=fingerprint(datesOn('<div>March 16</div><div>April 2</div>')),b=fingerprint(datesOn('<ul><li>16 March</li><li>2nd April</li></ul> 1,234 views'));
  assert.equal(a,b);
  assert.notEqual(a,fingerprint(datesOn('<div>March 17</div><div>April 2</div>')));
  assert.equal(fingerprint([]),null,'a page with no dates has no fingerprint, so it is never flagged');
});

test('A program is flagged only when its official dates change from every reviewed version',()=>{
  const now=new Date('2026-11-15T01:41:00Z'),seen=fingerprint(['mar 16']);
  const program={check:{reviewed:seen,seen,ok:true}};
  assert.equal(checkProgram(program,{ok:true,dates:['mar 16']},now).review,false);
  assert.equal(checkProgram(program,{ok:true,dates:['mar 18']},now).review,true);
  assert.equal(checkProgram({check:{reviewed:['x',seen]}},{ok:true,dates:['mar 16']},now).review,false,'any reviewed version is accepted');
  const failed=checkProgram(program,{ok:false},now);
  assert.deepEqual([failed.review,failed.check.ok,failed.check.seen,failed.check.reviewed],[false,false,seen,seen],'a failed read changes nothing but ok');
});

test('The daily workflow runs the check without letting it block the snapshot, and commits the file',async()=>{
  const workflow=await fs.readFile(new URL('../../.github/workflows/daily-snapshot.yml',import.meta.url),'utf8');
  const step=workflow.slice(workflow.indexOf('Check open-source programs'));
  assert.match(step.slice(0,400),/continue-on-error: true/);
  assert.match(workflow,/files="[^"]*frontend\/data\/open-source-programs\.json/);
});
