// Optional, separate DSA backend. No key is read from WILSY's public jobs project.
(() => {
  const status=message=>{const el=document.getElementById('dsa-storage-status');if(el)el.textContent=message;};
  const report=error=>{if(error)status('Cloud progress could not sync. Your progress remains saved on this browser.');};
  window.dsaSupabase={
    client:null,
    async init(){
      const config=window.wilsyDsaConfig;
      if(!config?.enabled)return false;
      try{
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/dsa/supabase-sdk.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
        this.client=window.supabase.createClient(config.url,config.key,{auth:{storageKey:'wilsy-dsa-auth',flowType:'pkce'}});
        document.getElementById('btnShowAuth').hidden=false;
        return true;
      }catch{status('Cloud sign-in is unavailable. Browser-only learning and progress still work.');return false;}
    },
    async signUp(email,password){const {data,error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/dsa'}});if(error)throw error;return data;},
    async signIn(email,password){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;status('Signed in. Progress is synced to your DSA account.');return data;},
    async signOut(){if(!this.client)return;const {error}=await this.client.auth.signOut();if(error)throw error;status('Signed out. Showing guest progress saved on this browser.');},
    async getCurrentUser(){const {data}=await this.client.auth.getUser();return data?.user||null;},
    onAuthStateChange(callback){const {data}=this.client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>callback(event,session),0);});return ()=>data.subscription.unsubscribe();},
    async fetchProgress(userId){try{const {data,error}=await this.client.from('user_progress').select('pattern_id').eq('user_id',userId);report(error);return (data||[]).map(row=>row.pattern_id);}catch{report(true);return [];}},
    async addProgress(userId,patternId){try{const {error}=await this.client.from('user_progress').upsert({user_id:userId,pattern_id:patternId},{onConflict:'user_id,pattern_id'});report(error);}catch{report(true);}},
    async removeProgress(userId,patternId){try{const {error}=await this.client.from('user_progress').delete().eq('user_id',userId).eq('pattern_id',patternId);report(error);}catch{report(true);}},
    async syncProgress(userId,ids){if(!ids.length)return;try{const {error}=await this.client.from('user_progress').upsert(ids.map(pattern_id=>({user_id:userId,pattern_id})),{onConflict:'user_id,pattern_id'});report(error);}catch{report(true);}},
  };
})();
