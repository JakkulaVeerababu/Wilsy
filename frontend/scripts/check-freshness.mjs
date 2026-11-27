// Read-only check that the job collectors are running and still finding new roles. Fails when no
// public job has been re-confirmed recently, when the GitHub collector has not finished a run
// recently, or when no new job has appeared for too many weekday hours.
import path from 'node:path';
import {databaseRequest as supabaseRequest} from '../js/data-client.js';
import {routeJobs} from '../../collectors/pg-rest.mjs';

// The jobs database: Heroku when JOBS_DATABASE_URL is set, else Supabase.
const databaseRequest = routeJobs(supabaseRequest);

// The collectors run every hour and re-confirm each live job at least every 12 hours, so while they
// work some public job is always re-seen within the hour. Worker D (pg_cron) re-confirms jobs too, so
// this alone cannot show that the GitHub collector is running: its own runs are checked as well.
export const MAX_SEEN_HOURS=Number(process.env.MAX_SEEN_HOURS||3);
export const MAX_RUN_HOURS=Number(process.env.MAX_RUN_HOURS||3);
// Companies rarely post at weekends. From 10 October to 15 November 2026 the longest wait for a new
// job was 7 hours on weekdays but 30 hours across a weekend, so only Monday to Friday (UTC) counts.
export const MAX_WEEKDAY_HOURS=Number(process.env.MAX_WEEKDAY_HOURS||10);

const HOUR=3600000,DAY=24*HOUR;

// Hours between two times that fall on a Monday to Friday, in UTC.
export function weekdayHours(from,to) {
  let ms=0;
  for(let start=from;start<to;){
    const end=Math.min(to,(Math.floor(start/DAY)+1)*DAY);
    const day=new Date(start).getUTCDay();
    if(day>=1&&day<=5)ms+=end-start;
    start=end;
  }
  return ms/HOUR;
}

// lastRun: when the newest completed "Collect jobs" run started; undefined when it was not looked up.
export function freshness({firstSeen,lastSeen,lastRun,now=Date.now(),maxSeen=MAX_SEEN_HOURS,maxRun=MAX_RUN_HOURS,maxWeekday=MAX_WEEKDAY_HOURS}) {
  const newest=Date.parse(firstSeen||''),seen=Date.parse(lastSeen||'');
  if(!Number.isFinite(newest)||!Number.isFinite(seen))return {ok:false,lines:['No public job has a discovery time.']};
  const seenHours=(now-seen)/HOUR,newHours=(now-newest)/HOUR,newWeekday=weekdayHours(newest,now);
  const lines=[`A public job was last re-confirmed ${seenHours.toFixed(1)} hours ago (limit ${maxSeen}).`];
  let ok=true;
  if(seenHours>maxSeen){ok=false;lines.push('No collector has re-confirmed a job: the collectors look stopped.');}
  if(lastRun===undefined)lines.push('GitHub collector runs were not checked (no GitHub token).');
  else{
    const run=Date.parse(lastRun||''),runHours=(now-run)/HOUR;
    if(!Number.isFinite(run)){ok=false;lines.push('The GitHub job collector has no completed run.');}
    else{
      lines.push(`The GitHub job collector last started a completed run ${runHours.toFixed(1)} hours ago (limit ${maxRun}).`);
      if(runHours>maxRun){ok=false;lines.push('The GitHub job collector looks stopped.');}
    }
  }
  lines.push(`Newest public job was found ${newHours.toFixed(1)} hours ago, ${newWeekday.toFixed(1)} of them on weekdays (limit ${maxWeekday}).`);
  if(newWeekday>maxWeekday){ok=false;lines.push('The collectors are running but have found no new jobs.');}
  return {ok,lines};
}

// Inside GitHub Actions, the start time of the newest completed run of collect-jobs.yml.
async function lastCollectorRun() {
  const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
  if(!repo||!token)return undefined;
  const response=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect-jobs.yml/runs?status=completed&per_page=1`,{
    headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`GitHub API ${response.status}`);
  const run=(await response.json()).workflow_runs?.[0];
  return run?.run_started_at||run?.created_at||null;
}

async function main() {
  // No nullslast: both columns are NOT NULL, and with it the query skips the last_seen_at index.
  const newest=column=>databaseRequest(`wilsy_public_jobs?select=${column}&order=${column}.desc&limit=1`).then(rows=>rows?.[0]?.[column]);
  const [firstSeen,lastSeen,lastRun]=await Promise.all([newest('first_seen_at'),newest('last_seen_at'),lastCollectorRun()]);
  const {ok,lines}=freshness({firstSeen,lastSeen,lastRun});
  for(const line of lines)(ok?console.log:console.error)(line);
  if(!ok)process.exit(1);
}
if(process.argv[1]&&import.meta.filename===path.resolve(process.argv[1]))await main();
