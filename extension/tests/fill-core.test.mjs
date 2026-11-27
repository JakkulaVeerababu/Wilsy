import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(fs.readFileSync(new URL('../fill-core.js', import.meta.url), 'utf8'), {globalThis: context});
const {pickField, valueFor} = context.WilsyFill;
const pick = (label, extra = {}) => pickField({type: 'text', label, ...extra});

test('Greenhouse, Lever and Ashby style labels map to the right detail', () => {
  assert.equal(pick('First Name *'), 'firstName');
  assert.equal(pick('Last Name'), 'lastName');
  assert.equal(pick('Full name'), 'fullName');
  assert.equal(pick('Name'), 'fullName');
  assert.equal(pick('Email', {type: 'email'}), 'email');
  assert.equal(pick('Phone'), 'phone');
  assert.equal(pick('', {name: 'urls[LinkedIn]'}), 'linkedin');
  assert.equal(pick('GitHub URL'), 'github');
  assert.equal(pick('Portfolio'), 'website');
  assert.equal(pick('Current company'), 'currentCompany');
  assert.equal(pick('Location (City)'), 'location');
  assert.equal(pickField({type: 'text', autocomplete: 'section-x given-name'}), 'firstName');
});

test('Fields about someone else, sensitive questions and non-text inputs are left alone', () => {
  for(const label of ['Company name', 'Referrer name', 'School name', 'Emergency contact name', 'Hiring manager', 'Preferred name',
    'Expected salary (CTC)', 'Notice period', 'Do you need visa sponsorship?', 'Gender', 'Date of birth', 'Why do you want to work here?', 'Cover letter'])
    assert.equal(pick(label), null, label);
  for(const type of ['password', 'file', 'checkbox', 'radio', 'hidden', 'submit']) assert.equal(pickField({type, label: 'Email'}), null, type);
});

test('Values come only from the saved profile; a full name joins first and last', () => {
  const profile = {firstName: ' Asha ', lastName: 'Rao', email: 'asha@example.com'};
  assert.equal(valueFor('fullName', profile), 'Asha Rao');
  assert.equal(valueFor('email', profile), 'asha@example.com');
  assert.equal(valueFor('github', profile), '');
  assert.equal(valueFor('fullName', null), '');
});

test('The extension asks for no host access and never submits', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined, 'runs only when clicked');
  const fill = fs.readFileSync(new URL('../fill.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fill, /\.submit\(|requestSubmit|type="?submit"?\]?'?\)?\.click/);
});
