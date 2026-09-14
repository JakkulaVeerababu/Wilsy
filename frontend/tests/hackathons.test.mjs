import test from 'node:test';
import assert from 'node:assert/strict';
import {readHackathonState,hackathonQuery,hackathonFilters,prizeValue,teamLabel,eventPhase,registrationLink,readSavedHackathons} from '../js/hackathon-core.js';
const fx={rate:95.56,date:'2026-09-11'};
test('Hackathon filters, pagination and saved detail URLs round-trip',()=>{
  const state=readHackathonState('?q=AI+build&mode=online&country=India&theme=AI&when=deadline&team=solo&cash=yes&saved=1&event=42&page=2&sort=deadline');
  assert.deepEqual(readHackathonState('?'+hackathonQuery(state)),state);
  assert.deepEqual(hackathonFilters(state,['42']).saved,['42']);
  assert.deepEqual(hackathonFilters(state,[]).saved,[]);
  assert.equal(readHackathonState('?event=javascript:alert(1)&page=-9').id,'');
  assert.equal(readHackathonState('?page=-9').page,1);
});
test('Prize values distinguish undisclosed, zero, bounded and non-cash awards',()=>{
  assert.equal(prizeValue({},fx).amount,'Prize not disclosed');
  assert.equal(prizeValue({min:0,max:0,currency:'INR'},fx).amount,'₹0');
  assert.equal(prizeValue({min:1000,max:2000,currency:'USD'},fx).amount,'₹95,560 – ₹1.91 L');
  assert.equal(prizeValue({max:100000,currency:'INR'},fx).amount,'Up to ₹1 L');
  assert.equal(prizeValue({raw:'Mentorship and cloud credits'},fx).amount,'Mentorship and cloud credits');
  assert.equal(prizeValue({min:1000,max:1000,currency:'EUR'},fx).amount,'1,000 EUR');
  assert.match(prizeValue({min:100,max:100},fx).amount,/currency not specified/);
});
test('Unknown eligibility and team sizes are not invented',()=>{
  assert.equal(teamLabel({}),'Team size not specified');
  assert.equal(teamLabel({team_size_min:1,team_size_max:1}),'Solo participation');
  assert.equal(teamLabel({team_size_min:2,team_size_max:4}),'2–4 people');
  assert.equal(teamLabel({team_size_max:4}),'Up to 4 people');
});
test('Elapsed and not-yet-open registrations use organizer guidance',()=>{
  const now=Date.parse('2026-09-12T12:00:00Z');
  const event={registration_url:'https://example.org/register',official_url:'https://example.org/event',starts_at:'2026-09-20',ends_at:'2026-09-22'};
  assert.equal(eventPhase(event,now),'Upcoming');
  assert.equal(registrationLink(event,now).label,'Official registration');
  const expired={...event,registration_deadline_at:'2026-09-10'};
  assert.equal(eventPhase(expired,now),'Registration ended');
  assert.equal(registrationLink(expired,now).url,event.official_url);
  assert.equal(registrationLink(expired,now).ended,true);
  assert.equal(registrationLink({...event,registration_opens_at:'2026-09-15'},now).notYet,true);
  assert.equal(registrationLink({registration_url:'javascript:alert(1)'},now).url,'');
});
test('Saved hackathon IDs tolerate unavailable storage and exclude unsafe values',()=>{
  assert.deepEqual(readSavedHackathons({getItem:()=>JSON.stringify(['4','4','javascript:1',7])}),['4','7']);
  assert.deepEqual(readSavedHackathons({getItem:()=>{throw Error('blocked');}}),[]);
});
