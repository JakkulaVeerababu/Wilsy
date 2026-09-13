const canonical=value=>{
  try{const url=new URL(value);if(url.protocol!=='https:')return '';return url.origin+url.pathname.replace(/\/amp\/?$/,'').replace(/\/+$/,'');}catch{return '';}
};
export function hackathonBranding(event,index){
  const asset=index?.events?.[String(event.id)];if(!asset)return null;
  const current=[event.source_url,event.official_url,event.registration_url].map(canonical).filter(Boolean);
  if(![asset.sourceUrl,asset.officialUrl].map(canonical).some(url=>url&&current.includes(url)))return null;
  if(!/^\/assets\/hackathons\/[a-zA-Z0-9.-]+\.(png|jpe?g|webp|gif)$/.test(asset.logo||''))return null;
  return asset;
}
