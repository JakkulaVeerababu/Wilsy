import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {clean,english,parseDate,tidyTitle,categoryFor,parseIsroList,parseIsroDetail,parseBarcList,readIsro,readBarc,plan,coverageNote,main,ISRO_LIST,BARC_LIST} from '../government.mjs';

// Trimmed copies of the official markup (12 Nov 2026).
const isroRow = (n, post, advt, open, close, href) => `<div class="col-md-1 subthemed-grid-col"> <span class="slno"> ${n} </span> </div> <div class="col-md-3 subthemed-grid-col"> <span class="post"> ${post} </span> </div> <div class="col-md-2 subthemed-grid-col"> <span class="advtNum"> ${advt} </span> </div> <div class="col-md-2 subthemed-grid-col"> <span class="opendate"> ${open} </span> </div> <div class="col-md-2 subthemed-grid-col"> <span class="closedate"> ${close} </span> </div> <div class="col-md-2 subthemed-grid-col text-center"> <span class="Details"> <a href="${href}" class="fa fa-eye btn bg-gradient-blue" title="View More Details"> </a> </span> </div>`;
const ISRO_HTML = `<div class="row list">
  ${isroRow(1, 'Recruitment to the posts of Technician - B/ Heavy Vehicle Driver - A/ Staff Car Driver- A', 'URSC:04:2026', 'October 24, 2026', 'November 13, 2026', 'URSCRecruitment13.html')}
  ${isroRow(2, 'Application for the posts of Group-A and Group-B', 'A.26011/1/2025-I', 'Oct 15, 2026', '', 'DOSRecruitment10.html')}
  ${isroRow(3, 'Recruitment to the post of Scientist/Engineer &#39;SC&#39;', 'ISRO:ICRB:03:2026', 'October 30, 2026', 'November 20, 2026', 'ICRBRecruitment9.html')}
  ${isroRow(4, 'Recruitment of Graduate Apprentice Trainee', 'VSSC:01:2026', '14/02/2026', '06/03/2026', 'VSSCRecruitment5.html')}
</div>`;
const detail = ({advt, date, last = '', centre, area, status = 'Open / खुला', location = 'बेंगलूर / Bengaluru', pdf = '/media_isro/pdf/recruitmentNotice/2026/Oct/advt.pdf'}) => `<table class="table common-table"> <tr> <td> <b> विज्ञापन संख्‍या / <br>Advertisement Number </b> </td> <td>${advt} </td> <td> <b> विज्ञापन दिनांक /<br> Advertisement Date </b> </td> <td> ${date} </td> </tr> <tr> <td><b>ऑनलाइन आवेदन जमा करने की अंतिम तिथि / <br>Last Date for Submission of Applications online</b></td> <td>${last}</td> <td> <b>इसरो केंद्र /<br>ISRO Centre</b> </td> <td>${centre}</td> </tr> <tr> <td><b>कार्यक्षेत्र / Area of Work</b></td> <td>${area}</td> <td><b>स्थिति / Status: </b></td> <td>${status}</td> </tr> <tr> <td><b>स्‍थान / Location: </b></td> <td colspan="3">${location}</td> </tr> </table> <p> <a href="${pdf}" title="Advertisement" target="_blank"> Bilingual Advertisement </a> </p>`;
const ISRO_DETAILS = {
  'https://www.isro.gov.in/URSCRecruitment13.html': detail({advt: 'URSC:04:2026', date: 'October 24, 2026', last: 'November 13, 2026', centre: 'यू.आर. राव उपग्रह केंद्र, (यू.आर.एस.सी.) /<br> U. R. Rao Satellite Centre (URSC)', area: 'Technician - B/ Heavy Vehicle Driver - A'}),
  'https://www.isro.gov.in/DOSRecruitment10.html': detail({advt: 'A.26011/1/2025-I', date: 'Oct 15, 2026', centre: 'अंतरिक्ष विभाग (अं.वि.) / Department of Space (DOS)', area: 'Group-A and Group-B', status: 'Open'}),
  'https://www.isro.gov.in/ICRBRecruitment9.html': detail({advt: 'ISRO:ICRB:03:2026', date: 'October 30, 2026', last: 'November 20, 2026', centre: 'इसरो केंद्रीकृत भर्ती बोर्ड / ISRO Centralised Recruitment Board (ICRB)', area: 'Scientist/Engineer', location: 'बेंगलूर / Bengaluru'})
};
const BARC_HTML = `<table class="table table-bordered"> <thead> <tr class='text-center'> <th>Advertisement No.</th> <th>Title</th> <th>Last Date</th> <th>Details</th> </tr> </thead> <tbody>
<tr><td class='text-center'>RMC/15(1)a/Locum/225300</td><td>Walk-in-interview for the post of Scientific Assistant/B</td><td class='text-nowrap text-center'>05-Nov-2026</td><td class='text-center'><a href='vacancy24.pdf' target='_blank' class='btn btn-warning'><i class='fas fa-check'></i> </a></td></tr><tr><td class='text-center'>MD</td><td>Walk-⁠in-⁠Interview for the post of Radiographer <br><b><font color=blue><a href="vacancyform27.pdf" target="_blank"><br/>Click Here</a> to Download Form</td><td class='text-nowrap text-center'>16-Nov-2026</td><td class='text-center'><a href='vacancy27.pdf' target='_blank' class='btn btn-warning'><i class='fas fa-check'></i> </a></td></tr><tr><td class='text-center'>MD</td><td>Walk-in-interview for the post of Medical Officer (Pathology) On Adhoc/Locum Basis <b><font color=blue><a href="vacancyform28.pdf" target="_blank"><br/>Click Here</a> to Download Form</font></b></td><td class='text-nowrap text-center'>23-Nov-2026</td><td class='text-center'><a href='vacancy28.pdf' target='_blank' class='btn btn-warning'><i class='fas fa-check'></i> </a></td></tr>
</tbody> </table> <div class="text-center text-sm mb-md-0">Last Updated on <i class="far fa-clock mr-2"></i> 06 November 2026 </div>`;

const TODAY = '2026-11-12';
const pages = {[ISRO_LIST]: ISRO_HTML, [BARC_LIST]: BARC_HTML, ...ISRO_DETAILS};
const page = async url => { if (!(url in pages)) throw new Error(`HTTP 404 ${url}`); return {url, text: pages[url]}; };
const curated = (over = {}) => ({id: 'curated', rank: 1, title: 'Curated notice', organization: 'Org', ministryDepartment: 'Dept', category: 'Medical', level: 'L', gradeLevel: 'G', salaryPayBand: 'S', experienceEligibility: 'E', location: 'Mumbai', openingDate: '2026-11-06', deadline: '2026-11-23', status: 'Open', noticeNumber: 'N', officialNoticeUrl: 'https://www.barc.gov.in/careers/vacancy28.pdf', sourceUrl: BARC_LIST, sourceDomain: 'barc.gov.in', verificationNote: 'Checked by hand.', ...over});
const FIELDS = ['id', 'rank', 'title', 'organization', 'ministryDepartment', 'category', 'level', 'gradeLevel', 'salaryPayBand', 'experienceEligibility', 'location', 'openingDate', 'deadline', 'status', 'noticeNumber', 'officialNoticeUrl', 'sourceUrl', 'sourceDomain', 'verificationNote'];

test('Text helpers decode entities, drop joiners and keep the English half of bilingual cells', () => {
  assert.equal(clean(' Scientist/Engineer &#39;SC&#39; &amp; <b>more</b>&nbsp;'), "Scientist/Engineer 'SC' & more");
  assert.equal(clean('Walk-⁠in'), 'Walk-in');
  assert.equal(english('बेंगलूर / Bengaluru'), 'Bengaluru');
  assert.equal(english('Open / खुला'), 'Open');
  assert.equal(english('Open'), 'Open');
});

test('Dates in every format the portals print are read day-first and validated', () => {
  assert.equal(parseDate('October 24, 2026'), '2026-10-24');
  assert.equal(parseDate('Oct 15, 2026'), '2026-10-15');
  assert.equal(parseDate('Sept 3,2026'), '2026-09-03');
  assert.equal(parseDate('16-Nov-2026'), '2026-11-16');
  assert.equal(parseDate('06 November 2026'), '2026-11-06');
  assert.equal(parseDate('14/02/2026'), '2026-02-14');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate(''), null);
});

test('Titles lose the "recruitment to the posts of" preamble and walk-ins are labelled', () => {
  assert.equal(tidyTitle('Recruitment to the posts of Technician - B/ Heavy Vehicle Driver - A/ Staff Car Driver- A'), 'Technician-B / Heavy Vehicle Driver-A / Staff Car Driver-A');
  assert.equal(tidyTitle('Walk-in-interview for the post of Scientific Assistant/B'), 'Scientific Assistant/B, walk-in interview');
  assert.equal(tidyTitle('Application for the posts of Group-A and Group-B'), 'Group-A and Group-B');
  assert.equal(categoryFor('Radiographer, walk-in interview'), 'Medical');
  assert.equal(categoryFor('Graduate Apprentice Trainee'), 'Apprenticeship');
  assert.equal(categoryFor('Technician-B / Driver-A'), 'Technical');
  assert.equal(categoryFor("Scientist/Engineer 'SC'"), 'Scientific');
});

test('ISRO list and detail pages parse into rows with absolute links, status and location', () => {
  const rows = parseIsroList(ISRO_HTML);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {post: 'Recruitment to the posts of Technician - B/ Heavy Vehicle Driver - A/ Staff Car Driver- A', advt: 'URSC:04:2026', opening: '2026-10-24', closing: '2026-11-13', url: 'https://www.isro.gov.in/URSCRecruitment13.html'});
  assert.equal(rows[1].closing, null);
  const d = parseIsroDetail(ISRO_DETAILS['https://www.isro.gov.in/URSCRecruitment13.html'], 'https://www.isro.gov.in/URSCRecruitment13.html');
  assert.deepEqual([d.advt, d.advertised, d.deadline, d.centre, d.status, d.location], ['URSC:04:2026', '2026-10-24', '2026-11-13', 'U. R. Rao Satellite Centre (URSC)', 'Open', 'Bengaluru']);
  assert.equal(d.pdf, 'https://www.isro.gov.in/media_isro/pdf/recruitmentNotice/2026/Oct/advt.pdf');
});

test('ISRO reader checks only current or recent rows and reports open notices without a last date', async () => {
  const seen = [];
  const isro = await readIsro(async url => { seen.push(url); return page(url); }, TODAY);
  assert.ok(!seen.includes('https://www.isro.gov.in/VSSCRecruitment5.html'), 'closed February notice is not fetched');
  assert.equal(isro.listed.size, 4);
  const icrb = isro.checked.get('https://www.isro.gov.in/ICRBRecruitment9.html');
  assert.equal(icrb.open, true);
  assert.equal(icrb.row.title, "Scientist/Engineer 'SC'");
  assert.equal(icrb.row.organization, 'ISRO Centralised Recruitment Board (ICRB)');
  assert.equal(icrb.row.deadline, '2026-11-20');
  assert.equal(isro.checked.get('https://www.isro.gov.in/DOSRecruitment10.html').row, null, 'no last date, so no automatic row');
  assert.deepEqual(isro.skipped.map(s => s.url), ['https://www.isro.gov.in/DOSRecruitment10.html']);
});

test('BARC table parses the notice PDF, not the application form, and skips past walk-ins', async () => {
  const {updated, rows} = parseBarcList(BARC_HTML);
  assert.equal(updated, '2026-11-06');
  assert.deepEqual(rows.map(r => r.url), ['https://www.barc.gov.in/careers/vacancy24.pdf', 'https://www.barc.gov.in/careers/vacancy27.pdf', 'https://www.barc.gov.in/careers/vacancy28.pdf']);
  assert.equal(rows[1].post, 'Walk-in-Interview for the post of Radiographer');
  const barc = await readBarc(page, TODAY);
  assert.deepEqual(barc.rows.map(r => [r.title, r.deadline, r.category]), [
    ['Radiographer, walk-in interview', '2026-11-16', 'Medical'],
    ['Medical Officer (Pathology) On Adhoc/Locum Basis, walk-in interview', '2026-11-23', 'Medical']
  ]);
  assert.equal(barc.rows[0].openingDate, '2026-11-06');
});

test('Plan keeps curated wording, adds new official notices with every field, and re-ranks', async () => {
  const [isro, barc] = await Promise.all([readIsro(page, TODAY), readBarc(page, TODAY)]);
  const {jobs, added, dropped} = plan({snapshot: {jobs: [curated()]}, isro, barc, today: TODAY});
  assert.equal(dropped.length, 0);
  assert.equal(jobs[0].title, 'Curated notice', 'hand-written row is untouched');
  assert.ok(!added.some(job => job.officialNoticeUrl.endsWith('vacancy28.pdf')), 'curated notice is not duplicated');
  assert.deepEqual(added.map(job => job.deadline), ['2026-11-13', '2026-11-16', '2026-11-20']);
  assert.deepEqual(jobs.map(job => job.rank), [1, 2, 3, 4]);
  assert.equal(new Set(jobs.map(job => job.id)).size, jobs.length);
  for (const job of added) {
    for (const field of FIELDS) assert.ok(job[field], `${job.id}: ${field}`);
    assert.equal(job.status, 'Open');
    assert.equal(new URL(job.sourceUrl).hostname.replace(/^www\./, ''), job.sourceDomain);
    assert.ok(job.openingDate <= TODAY && job.deadline >= TODAY);
    assert.match(job.verificationNote, /Collected automatically on 12 Nov 2026/);
  }
});

test('Plan drops expired, delisted and closed notices, but never because a source failed', async () => {
  const [isro, barc] = await Promise.all([readIsro(page, TODAY), readBarc(page, TODAY)]);
  const snapshot = {jobs: [
    curated({id: 'expired', deadline: '2026-11-11'}),
    curated({id: 'delisted', officialNoticeUrl: 'https://www.barc.gov.in/careers/vacancy99.pdf'}),
    curated({id: 'dos', officialNoticeUrl: 'https://www.isro.gov.in/DOSRecruitment10.html', sourceUrl: 'https://www.isro.gov.in/DOSRecruitment10.html', sourceDomain: 'isro.gov.in', deadline: '2026-11-30'})
  ]};
  const result = plan({snapshot, isro, barc, today: TODAY});
  assert.deepEqual(result.dropped.map(d => [d.id, d.reason]), [['expired', 'deadline passed'], ['delisted', 'no longer on the BARC list']]);
  assert.ok(result.jobs.some(job => job.id === 'dos'), 'open DOS notice with a hand-entered deadline stays');

  const closedPages = {...pages, 'https://www.isro.gov.in/DOSRecruitment10.html': ISRO_DETAILS['https://www.isro.gov.in/DOSRecruitment10.html'].replace('<td>Open</td>', '<td>Closed</td>')};
  const closed = await readIsro(async url => ({url, text: closedPages[url]}), TODAY);
  assert.deepEqual(plan({snapshot, isro: closed, barc, today: TODAY}).dropped.map(d => d.id), ['expired', 'delisted', 'dos']);

  const offline = plan({snapshot, isro: null, barc: null, today: TODAY});
  assert.deepEqual(offline.jobs.map(job => job.id), ['delisted', 'dos'], 'only the date rule applies while sources are down');
});

test('Coverage note counts notices in words and names only the sources present', () => {
  assert.match(coverageNote([curated(), curated()], TODAY), /includes two open notices from the Bhabha Atomic Research Centre \(BARC\), checked on 12 Nov 2026/);
  assert.match(coverageNote([], TODAY), /includes no open notices, checked/);
});

test('main writes the dated snapshot, and refuses to touch it when both sources fail', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wilsy-gov-'));
  const file = path.join(dir, 'government-jobs.json');
  const base = {dataset: 'x', checkedAt: '2026-11-01', coverageNote: 'old', sourceHubs: [], jobs: [curated(), curated({id: 'old', deadline: '2026-11-02'})]};
  await fs.writeFile(file, JSON.stringify(base));
  const quiet = () => {};
  const result = await main({file, client: {page}, now: new Date('2026-11-12T08:00:00+05:30'), log: quiet});
  const written = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(written.checkedAt, TODAY);
  assert.equal(written.dataset, 'x');
  assert.deepEqual(result.dropped.map(d => d.id), ['old']);
  assert.equal(written.jobs.length, 4);
  assert.match(written.coverageNote, /four open notices from the Bhabha Atomic Research Centre \(BARC\) and ISRO/);

  const before = await fs.readFile(file, 'utf8');
  const down = {page: async () => { throw new Error('network down'); }};
  await assert.rejects(main({file, client: down, now: new Date('2026-11-13T08:00:00+05:30'), log: quiet}), /Neither official source/);
  assert.equal(await fs.readFile(file, 'utf8'), before);
  await fs.rm(dir, {recursive: true, force: true});
});
