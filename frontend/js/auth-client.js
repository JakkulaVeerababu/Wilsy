import {supabaseConfig} from './supabase-config.js';

// Minimal Supabase Auth client: email code or link, Google, refresh and sign-out. Links and
// OAuth use PKCE, so tokens never appear in URLs. Dependencies are injectable for tests.
export const SESSION_KEY='wilsy-auth';
const VERIFIER_KEY='wilsy-auth-verifier';
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export class AuthError extends Error {
  constructor(message,status){super(message);this.status=status;}
}
export function authMessage(status,data={}) {
  if(status===429)return 'Too many attempts. Wait a minute, then try again.';
  const text=String(data.msg||data.error_description||data.message||'');
  if(/expired|invalid/i.test(text)&&/otp|token|code|link/i.test(text))return 'That code or link has expired or was already used. Request a new one.';
  if(status>=500||!text)return 'Sign-in is unavailable right now. Try again shortly.';
  return text;
}
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export function createAuth({storage=globalThis.localStorage,fetcher=globalThis.fetch?.bind(globalThis),location=globalThis.location,history=globalThis.history,crypto=globalThis.crypto,now=Date.now}={}) {
  const root=`${supabaseConfig.url}/auth/v1`;
  let refreshing=null;
  async function request(path,{method='POST',body,token}={}) {
    const response=await fetcher(`${root}/${path}`,{method,
      headers:{apikey:supabaseConfig.publishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new AuthError(authMessage(response.status,data),response.status);
    return data;
  }
  function read() {
    try{const s=JSON.parse(storage.getItem(SESSION_KEY)||'null');return s?.access_token&&s?.refresh_token&&s?.user?.id?s:null;}catch{return null;}
  }
  function store(data) {
    const session={access_token:data.access_token,refresh_token:data.refresh_token,
      expires_at:data.expires_at||Math.floor(now()/1000)+Number(data.expires_in||3600),
      user:{id:data.user?.id,email:data.user?.email||''}};
    if(!session.access_token||!session.refresh_token||!session.user.id)throw new AuthError('Sign-in did not complete. Try again.',0);
    storage.setItem(SESSION_KEY,JSON.stringify(session));
    return session;
  }
  function clear(){try{storage.removeItem(SESSION_KEY);storage.removeItem(VERIFIER_KEY);}catch{}}
  async function challenge() {
    const verifier=base64url(crypto.getRandomValues(new Uint8Array(48)));
    storage.setItem(VERIFIER_KEY,verifier);
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    return {code_challenge:base64url(digest),code_challenge_method:'s256'};
  }
  const returnTo=()=>location.origin+location.pathname;

  return {
    session:read,
    async accessToken() {
      const s=read();
      if(!s)return null;
      if(s.expires_at*1000-now()>60000)return s.access_token;
      refreshing??=request('token?grant_type=refresh_token',{body:{refresh_token:s.refresh_token}})
        .then(store).catch(error=>{if(error.status>=400&&error.status<500)clear();throw error;})
        .finally(()=>{refreshing=null;});
      return (await refreshing).access_token;
    },
    async sendEmail(email) {
      email=String(email||'').trim().toLowerCase();
      if(!EMAIL.test(email))throw new AuthError('Enter a valid email address.',0);
      await request(`otp?redirect_to=${encodeURIComponent(returnTo())}`,{body:{email,create_user:true,...await challenge()}});
      return email;
    },
    async verifyCode(email,code) {
      code=String(code||'').replace(/\s/g,'');
      if(!/^\d{6,10}$/.test(code))throw new AuthError('Enter the code from your email.',0);
      return store(await request('verify',{body:{type:'email',email,token:code}}));
    },
    async googleUrl() {
      const pkce=await challenge();
      return `${root}/authorize?${new URLSearchParams({provider:'google',redirect_to:returnTo(),...pkce})}`;
    },
    async providers() {
      const settings=await request('settings',{method:'GET'});
      return {google:settings.external?.google===true};
    },
    // Finishes an email-link or Google sign-in when the page loads with ?code= or an auth error.
    async completeRedirect() {
      const url=new URL(location.href);
      const code=url.searchParams.get('code'),failure=url.searchParams.get('error_description');
      if(!code&&!failure)return null;
      for(const key of ['code','error','error_code','error_description'])url.searchParams.delete(key);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      if(failure)throw new AuthError(authMessage(400,{msg:failure}),400);
      const verifier=storage.getItem(VERIFIER_KEY);
      if(!verifier)throw new AuthError('Open the sign-in link in the same browser you requested it from, or use the code instead.',0);
      const session=store(await request('token?grant_type=pkce',{body:{auth_code:code,code_verifier:verifier}}));
      storage.removeItem(VERIFIER_KEY);
      return session;
    },
    async signOut() {
      const s=read();
      clear();
      if(s)await request('logout',{token:s.access_token}).catch(()=>{});
    }
  };
}
