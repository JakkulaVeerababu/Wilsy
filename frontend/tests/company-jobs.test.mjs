import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {roleRow} from '../js/company-jobs.js';

test('Company open-role rows link to the job, hide placeholder locations and escape text',()=>{
  const row=roleRow({id:42,title:'Engineer <b>',location:'na',city:'Bengaluru',country:'India',work_mode:'remote',posted_at:null});
  assert.match(row,/href="\/jobs\?job=42"/);
  assert.match(row,/Bengaluru, India · Remote/);
  assert.doesNotMatch(row,/>na</);
  assert.match(row,/Engineer &lt;b&gt;/);
  assert.match(roleRow({id:1,title:'X',location:'',work_mode:'unspecified'}),/Location not specified<\/span>/);
});
test('Every company profile has a hidden open-roles section wired to the live search',async()=>{
  const html=await fs.readFile('dist/companies/stripe.html','utf8');
  assert.match(html,/<section class="company-open-roles" data-company="Stripe"[^>]* hidden>/);
  assert.match(html,/src="\/js\/company-jobs.js"/);
  assert.match(html,/href="\/jobs\?company=Stripe"/);
});
