import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcile,readSyncState,SYNC_KEY} from '../js/account-sync.js';
import {createAuth,authMessage,SESSION_KEY} from '../js/auth-client.js';

const memory=(entries={})=>{const m=new Map(Object.entries(entries));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};};

test('First sync merges this device into the account',()=>{
  const plan=reconcile([],['1','2'],['2','3'],500);
  assert.deepEqual(plan.result,['1','2','3']);assert.deepEqual(plan.toAdd,['1']);assert.deepEqual(plan.toRemove,[]);
});
test('Removals on another device reach this one, local removals reach the account',()=>{
  assert.deepEqual(reconcile(['1','2'],['1','2'],['1'],500),{result:['1'],toAdd:[],toRemove:[]});
  assert.deepEqual(reconcile(['1','2'],['1'],['1','2','3'],500),{result:['1','3'],toAdd:[],toRemove:['2']});
});
test('Limits keep the newest local additions and trim the account to match',()=>{
  const plan=reconcile([],['new'],['a','b','c'],3);
  assert.deepEqual(plan.result,['new','a','b']);assert.deepEqual(plan.toAdd,['new']);assert.deepEqual(plan.toRemove,['c']);
});
test('Sync state belongs to one user',()=>{
  const storage=memory({[SYNC_KEY]:JSON.stringify({user:'a',job:['1'],hackathon:[],search:[]})});
  assert.deepEqual(readSyncState(storage,'a').job,['1']);
  assert.deepEqual(readSyncState(storage,'b'),{user:'b',job:[],hackathon:[],search:[]});
});

function fakeAuth({responses={},href='https://www.wilsy.in/jobs?role=data',storage=memory(),now=()=>1_000_000_000_000}={}) {
  const calls=[];let current=href;
  const fetcher=async(url,init)=>{
    const path=url.replace(/^.*\/auth\/v1\//,'');calls.push({path,body:init.body?JSON.parse(init.body):null,auth:init.headers.Authorization});
    const [status,data]=responses[path.split('?')[0]+(path.includes('grant_type=')?'?'+path.split('?')[1]:'')]||[200,{}];
    return {ok:status<300,status,json:async()=>data};
  };
  const location={get href(){return current;},get origin(){return new URL(current).origin;},get pathname(){return new URL(current).pathname;}};
  const history={state:null,replaceState:(_s,_t,url)=>{current=new URL(url,current).href;}};
  return {auth:createAuth({storage,fetcher,location,history,crypto:globalThis.crypto,now}),calls,storage,url:()=>current};
}
const session={access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'u1',email:'me@example.com'}};

test('Email sign-in sends a PKCE challenge and returns to the current page',async()=>{
  const {auth,calls,storage}=fakeAuth();
  await assert.rejects(auth.sendEmail('not-an-email'),/valid email/);
  assert.equal(await auth.sendEmail('  Me@Example.com '),'me@example.com');
  assert.match(calls[0].path,/^otp\?redirect_to=https%3A%2F%2Fwww.wilsy.in%2Fjobs$/);
  assert.equal(calls[0].body.code_challenge_method,'s256');assert.equal(calls[0].body.create_user,true);
  assert.ok(storage.getItem('wilsy-auth-verifier').length>=43);
});
test('A valid code signs in and stores only what the site needs',async()=>{
  const {auth,storage}=fakeAuth({responses:{verify:[200,{...session,user:{...session.user,phone:'x'}}]}});
  await assert.rejects(auth.verifyCode('me@example.com','12ab'),/code from your email/);
  const s=await auth.verifyCode('me@example.com','123 456');
  assert.deepEqual(JSON.parse(storage.getItem(SESSION_KEY)),s);
  assert.deepEqual(s.user,{id:'u1',email:'me@example.com'});assert.equal(s.expires_at,1_000_000_000+3600);
});
test('Links and Google finish with a code exchange and a clean URL',async()=>{
  const storage=memory({'wilsy-auth-verifier':'v'.repeat(64)});
  const {auth,calls,url}=fakeAuth({storage,href:'https://www.wilsy.in/jobs?role=data&code=abc#top',responses:{'token?grant_type=pkce':[200,session]}});
  const s=await auth.completeRedirect();
  assert.equal(s.user.id,'u1');assert.deepEqual(calls[0].body,{auth_code:'abc',code_verifier:'v'.repeat(64)});
  assert.equal(url(),'https://www.wilsy.in/jobs?role=data#top');assert.equal(storage.getItem('wilsy-auth-verifier'),null);
  const failed=fakeAuth({href:'https://www.wilsy.in/?error=access_denied&error_description=Email+link+is+invalid+or+has+expired'});
  await assert.rejects(failed.auth.completeRedirect(),/expired or was already used/);
  assert.equal(failed.url(),'https://www.wilsy.in/');
  assert.equal(await fakeAuth().auth.completeRedirect(),null);
  await assert.rejects(fakeAuth({href:'https://www.wilsy.in/?code=x'}).auth.completeRedirect(),/same browser/);
});
test('Tokens refresh before expiry, and a rejected refresh signs out',async()=>{
  const stored=memory({[SESSION_KEY]:JSON.stringify({access_token:'old',refresh_token:'r',expires_at:1_000_000_030,user:{id:'u1',email:''}})});
  const ok=fakeAuth({storage:stored,responses:{'token?grant_type=refresh_token':[200,{...session,access_token:'new'}]}});
  assert.equal(await ok.auth.accessToken(),'new');
  const fresh=memory({[SESSION_KEY]:JSON.stringify({access_token:'cur',refresh_token:'r',expires_at:1_000_009_000,user:{id:'u1',email:''}})});
  assert.equal(await fakeAuth({storage:fresh}).auth.accessToken(),'cur');
  const expired=memory({[SESSION_KEY]:JSON.stringify({access_token:'old',refresh_token:'r',expires_at:1,user:{id:'u1',email:''}})});
  const bad=fakeAuth({storage:expired,responses:{'token?grant_type=refresh_token':[400,{msg:'Invalid Refresh Token'}]}});
  await assert.rejects(bad.auth.accessToken());assert.equal(bad.auth.session(),null);
});
test('Sign-out clears the session even if the server is unreachable',async()=>{
  const storage=memory({[SESSION_KEY]:JSON.stringify({access_token:'a',refresh_token:'r',expires_at:2e9,user:{id:'u1',email:''}})});
  const {auth,calls}=fakeAuth({storage,responses:{logout:[503,{}]}});
  await auth.signOut();
  assert.equal(auth.session(),null);assert.equal(calls[0].auth,'Bearer a');
});
test('Auth errors read clearly',()=>{
  assert.match(authMessage(429),/Wait a minute/);
  assert.match(authMessage(500,{msg:'db down'}),/unavailable right now/);
  assert.match(authMessage(403,{msg:'Token has expired or is invalid'}),/expired or was already used/);
});
