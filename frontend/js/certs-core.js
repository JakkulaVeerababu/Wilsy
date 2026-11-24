// Certification tracker: the certifications someone plans, is studying for or has earned, kept in this
// browser, plus a short list of widely asked-for certifications with their official pages. No prices or
// exam details are kept here: they change, and the official page has the current ones.

export const CERTS_KEY = 'wilsy-certifications';
export const MAX_CERTS = 50;
export const STATUSES = [['planned', 'Planned'], ['studying', 'Studying'], ['earned', 'Earned']];

// [id, name, issuer, official page, the WILSY skill it shows]
export const CATALOG = [
  ['aws-ccp', 'AWS Certified Cloud Practitioner', 'Amazon Web Services', 'https://aws.amazon.com/certification/certified-cloud-practitioner/', 'AWS'],
  ['aws-saa', 'AWS Certified Solutions Architect – Associate', 'Amazon Web Services', 'https://aws.amazon.com/certification/certified-solutions-architect-associate/', 'AWS'],
  ['az-900', 'Microsoft Azure Fundamentals (AZ-900)', 'Microsoft', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/', 'Azure'],
  ['dp-900', 'Microsoft Azure Data Fundamentals (DP-900)', 'Microsoft', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/', 'Azure'],
  ['pl-300', 'Microsoft Power BI Data Analyst (PL-300)', 'Microsoft', 'https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/', 'Power BI'],
  ['gcp-cdl', 'Google Cloud Digital Leader', 'Google Cloud', 'https://cloud.google.com/learn/certification/cloud-digital-leader', 'GCP'],
  ['gcp-ace', 'Google Cloud Associate Cloud Engineer', 'Google Cloud', 'https://cloud.google.com/learn/certification/cloud-engineer', 'GCP'],
  ['cka', 'Certified Kubernetes Administrator (CKA)', 'The Linux Foundation', 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/', 'Kubernetes'],
  ['terraform', 'HashiCorp Certified: Terraform Associate', 'HashiCorp', 'https://developer.hashicorp.com/certifications/infrastructure-automation', 'Terraform'],
  ['security-plus', 'CompTIA Security+', 'CompTIA', 'https://www.comptia.org/certifications/security', 'Cybersecurity'],
  ['mongodb', 'MongoDB Associate Developer', 'MongoDB', 'https://learn.mongodb.com/pages/certification-program', 'MongoDB'],
  ['sf-admin', 'Salesforce Certified Administrator', 'Salesforce', 'https://trailhead.salesforce.com/credentials/administrator', 'Salesforce'],
];
export const catalogItem = id => CATALOG.find(c => c[0] === id) || null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = value => DATE.test(String(value || '')) && Number.isFinite(Date.parse(value)) ? String(value) : '';
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const httpsUrl = value => { try { const u = new URL(String(value || '').trim()); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };

/** One tracked certification, cleaned; null when it has no name. */
export function cleanCert(raw) {
  if(!raw || typeof raw !== 'object') return null;
  const catalog = catalogItem(raw.catalog);
  const name = text(raw.name, 120) || catalog?.[1] || '';
  if(!name) return null;
  return {id: text(raw.id, 40) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    name, issuer: text(raw.issuer, 80) || catalog?.[2] || '', catalog: catalog ? catalog[0] : '',
    status: STATUSES.some(([id]) => id === raw.status) ? raw.status : 'planned',
    target: date(raw.target), earned: date(raw.earned), expires: date(raw.expires), credential: httpsUrl(raw.credential)};
}

/** The stored list (JSON text or an array), cleaned, without duplicate ids, at most MAX_CERTS. */
export function readCerts(stored) {
  let list = stored;
  if(typeof stored === 'string') { try { list = JSON.parse(stored); } catch { list = []; } }
  const seen = new Set(), out = [];
  for(const raw of Array.isArray(list) ? list : []) {
    const cert = cleanCert(raw);
    if(cert && !seen.has(cert.id)) { seen.add(cert.id); out.push(cert); }
    if(out.length >= MAX_CERTS) break;
  }
  return out;
}

const DAY = 864e5;
const daysUntil = (value, now) => Math.ceil((Date.parse(value + 'T00:00:00Z') - now) / DAY);

/** What to show beside one certification: expired, expires soon, exam date passed, exam soon. */
export function certNote(cert, {now = Date.now(), soon = 60} = {}) {
  if(cert.status === 'earned' && cert.expires) {
    const days = daysUntil(cert.expires, now);
    if(days < 0) return {kind: 'expired', text: 'Expired: renew it or mark it as planned again'};
    if(days <= soon) return {kind: 'soon', text: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`};
  }
  if(cert.status !== 'earned' && cert.target) {
    const days = daysUntil(cert.target, now);
    if(days < 0) return {kind: 'late', text: 'Target date has passed: set a new one'};
    if(days <= 30) return {kind: 'soon', text: days === 0 ? 'Target date is today' : `${days} day${days === 1 ? '' : 's'} to your target date`};
  }
  return null;
}

/** Counts by status, and how many need attention. */
export function certSummary(certs, {now = Date.now()} = {}) {
  const count = status => certs.filter(c => c.status === status).length;
  return {total: certs.length, planned: count('planned'), studying: count('studying'), earned: count('earned'),
    attention: certs.filter(c => ['expired', 'late', 'soon'].includes(certNote(c, {now})?.kind)).length};
}

/** Studying first, then planned, then earned; by the nearest date within each. */
export function sortCerts(certs) {
  const order = {studying: 0, planned: 1, earned: 2};
  const when = c => (c.status === 'earned' ? c.expires || c.earned : c.target) || '9999-12-31';
  return [...certs].sort((a, b) => order[a.status] - order[b.status] || when(a).localeCompare(when(b)) || a.name.localeCompare(b.name));
}

/** Skills from earned certifications that are not yet in the My WILSY profile. */
export const skillsToAdd = (certs, profileSkills = []) => [...new Set(certs.filter(c => c.status === 'earned').map(c => catalogItem(c.catalog)?.[4]).filter(Boolean))]
  .filter(skill => !profileSkills.includes(skill));
