// Readers for Oracle Recruiting Cloud (Oracle HCM) and Rippling career sites. Both use the public JSON
// endpoints their own career pages read. Big Oracle sites list thousands of roles, so one read is capped:
// at most MAX_LIST postings and MAX_DETAILS detail pages. A capped read is marked partial, so the collector
// never closes roles it did not see (the daily recheck closes dead links instead).

export const MAX_LIST = 2000;
export const MAX_DETAILS = 150;
const ORACLE_PAGE = 200;
// A real hostname: dot-separated labels of letters, digits and inner hyphens.
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Oracle identifier "host/site" (e.g. "eiqg.fa.us2.oraclecloud.com/CX_1") from a career-site URL, or null. */
export function oracleId(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const site = parsed.pathname.match(/\/sites\/([A-Za-z0-9_-]+)/)?.[1];
  const host = parsed.hostname.toLowerCase();
  return site && HOST.test(host) ? `${host}/${site}` : null;
}

function oracleParts(id) {
  const m = String(id).match(/^([^/]+)\/([A-Za-z0-9_-]+)$/);
  if (!m || !HOST.test(m[1])) throw new Error(`Bad Oracle identifier ${id}`);
  const origin = `https://${m[1]}`;
  return {origin, site: m[2], api: `${origin}/hcmRestApi/resources/latest`};
}

export async function readOracle(id, get, {build, isTech, plainText, jobType, workMode, maxList = MAX_LIST, maxDetails = MAX_DETAILS}) {
  const {origin, site, api} = oracleParts(id);
  const postings = [];
  let total = Infinity;
  for (let offset = 0; offset < Math.min(total, maxList); offset += ORACLE_PAGE) {
    const data = await get(`${api}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations`
      + `&finder=findReqs;siteNumber=${site},limit=${ORACLE_PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`);
    const page = data?.items?.[0];
    if (!Array.isArray(page?.requisitionList)) throw new Error('Unexpected Oracle response');
    total = Number(page.TotalJobsCount) || 0;
    postings.push(...page.requisitionList.filter(r => r?.Id && r?.Title));
    if (page.requisitionList.length < ORACLE_PAGE) break;
  }
  let details = 0;
  const jobs = [];
  for (const r of postings) {
    const url = `${origin}/hcmUI/CandidateExperience/en/sites/${site}/job/${r.Id}`;
    const places = [r.PrimaryLocation, ...(r.secondaryLocations || []).map(l => l?.Name)].filter(Boolean);
    const base = {external_id: r.Id, title: r.Title, url, location: places.join('; '), job_type: jobType(r.JobSchedule || '', r.Title),
      work_mode: workMode(r.WorkplaceType, r.WorkplaceTypeCode, places.join(' ')), posted_at: r.PostedDate,
      description: plainText(r.ShortDescriptionStr) || null};
    if (!isTech(r.Title) || details >= maxDetails) { jobs.push(build(base)); continue; }
    details++;
    try {
      const d = (await get(`${api}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(r.Id)}%22,siteNumber=${site}`))?.items?.[0];
      if (!d) { jobs.push(build(base)); continue; }
      const text = [d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr].map(v => plainText(v)).filter(Boolean).join('\n\n');
      jobs.push(build({...base, description: text || base.description, department: d.Department || d.Organization,
        job_type: jobType(d.JobSchedule || d.JobType || '', r.Title), employment_type_raw: d.JobSchedule || d.JobType,
        work_mode: workMode(d.WorkplaceType, d.WorkplaceTypeCode, r.WorkplaceType, r.WorkplaceTypeCode, places.join(' ')),
        workplace_type_raw: d.WorkplaceType || r.WorkplaceType,
        posted_at: d.ExternalPostedStartDate || base.posted_at}));
    } catch (error) {
      if (error?.status === 404) continue;
      throw error;
    }
  }
  if (total > postings.length || postings.filter(r => isTech(r.Title)).length > maxDetails) jobs.partial = true;
  return jobs;
}

/** Rippling boards are small: the list, then details for each tech role (description, type, date). */
export async function readRippling(slug, get, {build, isTech, plainText, jobType, workMode, maxDetails = MAX_DETAILS}) {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) throw new Error(`Bad Rippling identifier ${slug}`);
  const api = `https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs`;
  const list = await get(api);
  if (!Array.isArray(list)) throw new Error('Unexpected Rippling response');
  let details = 0;
  const jobs = [];
  for (const j of list.filter(j => j?.uuid && j?.name && j?.url)) {
    const base = {external_id: j.uuid, title: j.name, url: j.url, location: j.workLocation?.label, department: j.department?.label,
      job_type: jobType('', j.name), work_mode: workMode(j.workLocation?.label)};
    if (!isTech(j.name) || details >= maxDetails) { jobs.push(build(base)); continue; }
    details++;
    try {
      const d = await get(`${api}/${encodeURIComponent(j.uuid)}`);
      const places = (d?.workLocations || []).filter(Boolean);
      jobs.push(build({...base, description: [plainText(d?.description?.role), plainText(d?.description?.company)].filter(Boolean).join('\n\n') || null,
        location: places.join('; ') || base.location, department: d?.department?.base_department || base.department, team: d?.department?.name,
        job_type: jobType(d?.employmentType?.id || '', j.name), employment_type_raw: d?.employmentType?.id,
        work_mode: workMode(places.join(' '), base.location), posted_at: d?.createdOn}));
    } catch (error) {
      if (error?.status === 404) continue;
      throw error;
    }
  }
  if (list.filter(j => isTech(j?.name)).length > maxDetails) jobs.partial = true;
  return jobs;
}

// Phenom career sites put the search results in the page itself (phApp.ddo). A board is "host/locale",
// e.g. "careers.allianz.com/us/en". Phenom sites list every kind of role, so the reader asks the site's own
// search for a few tech words (one page each, up to PHENOM_SIZE results) instead of paging through all of
// them. It never sees the full list, so every read is partial: missing roles are closed by the daily recheck.
export const PHENOM_WORDS = ['software', 'developer', 'data', 'engineer'];
const PHENOM_SIZE = 100;

/** Phenom identifier "host/locale" from a career-site URL such as https://jobs.x.com/us/en/search-results, or null. */
export function phenomId(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const locale = parsed.pathname.match(/^\/([a-z]{2,6}\/[a-z]{2}(?:[_-][a-z]{2})?)(?:\/|$)/i)?.[1];
  const host = parsed.hostname.toLowerCase();
  return locale && HOST.test(host) ? `${host}/${locale.toLowerCase()}` : null;
}

/** The phApp.ddo object from a Phenom page, read by matching braces (the page carries more script after it). */
export function phenomData(html) {
  const at = String(html).indexOf('phApp.ddo = ');
  if (at < 0) return null;
  const s = html.slice(at + 12);
  let depth = 0, inString = false, escaped = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (inString) {
      if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(0, k + 1)); } catch { return null; }
    }
  }
  return null;
}

export async function readPhenom(id, page, {build, plainText, jobType, workMode, words = PHENOM_WORDS}) {
  const m = String(id).match(/^([^/]+)\/([a-z]{2,6}\/[a-z]{2}(?:[_-][a-z]{2})?)$/i);
  if (!m || !HOST.test(m[1])) throw new Error(`Bad Phenom identifier ${id}`);
  const base = `https://${m[1]}/${m[2]}`;
  const seen = new Map();
  for (const word of words) {
    const {text} = await page(`${base}/search-results?keywords=${encodeURIComponent(word)}&size=${PHENOM_SIZE}`);
    const result = phenomData(text)?.eagerLoadRefineSearch;
    const list = result?.data?.jobs;
    if (!Array.isArray(list)) throw new Error('Unexpected Phenom page');
    for (const j of list) if (j?.jobId && j?.title && !seen.has(String(j.jobId))) seen.set(String(j.jobId), j);
  }
  const jobs = [...seen.values()].map(j => {
    const places = Array.isArray(j.multi_location) && j.multi_location.length ? j.multi_location : [j.location || j.cityStateCountry].filter(Boolean);
    return build({external_id: String(j.jobId), title: j.title, url: `${base}/job/${encodeURIComponent(j.jobId)}`,
      location: places.join('; '), department: j.category || j.department, description: plainText(j.descriptionTeaser) || null,
      job_type: jobType(j.type || j.employmentType || '', j.title), employment_type_raw: j.type || j.employmentType,
      work_mode: workMode(j.remote, j.workLocationType, j.psRemoteStatus, places.join(' ')),
      workplace_type_raw: j.remote || j.workLocationType, posted_at: j.postedDate || j.dateCreated});
  });
  jobs.partial = true;
  return jobs;
}
