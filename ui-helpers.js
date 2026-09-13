// Source content is displayed as plain text, with readable paragraph boundaries.
// No employer or organizer markup is inserted into the page.
export function sourceText(value){
  return String(value||'')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<li\b[^>]*>/gi,'\n• ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(p|div|h[1-6]|ul|ol|section)>/gi,'\n\n')
    .replace(/<[^>]*>/g,'')
    .replace(/&(amp|quot|apos|lt|gt|nbsp|#39|#x27);/gi,(_,entity)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ','#39':"'",'#x27':"'"})[entity.toLowerCase()])
    .replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[\t ]+/g,' ').trim()).join('\n')
    .replace(/\n{3,}/g,'\n\n').trim();
}

export async function copyPageLink(button,href,clipboard){
  let message='Copy the address bar link';
  try{
    if(typeof clipboard?.writeText==='function'){
      await clipboard.writeText(href);message='Link copied ✓';
    }
  }catch{}
  if(button?.isConnected)button.textContent=message;
}

export function isEditing(element){
  return !!element&&(['INPUT','TEXTAREA','SELECT'].includes(element.tagName)||!!element.isContentEditable);
}

let noticeTimer;
export function savedNotice(message,href){
  let notice=document.querySelector('#saved-notice');
  const hide=()=>{clearTimeout(noticeTimer);notice.hidden=true;};
  const schedule=()=>{clearTimeout(noticeTimer);noticeTimer=setTimeout(hide,7000);};
  if(!notice){
    notice=document.createElement('div');notice.id='saved-notice';notice.className='saved-notice';
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    notice.addEventListener('mouseenter',()=>clearTimeout(noticeTimer));
    notice.addEventListener('focusin',()=>clearTimeout(noticeTimer));
    notice.addEventListener('mouseleave',schedule);notice.addEventListener('focusout',schedule);
    document.body.append(notice);
  }
  const text=document.createElement('span');text.textContent=message;
  const link=document.createElement('a');link.textContent='View saved';
  link.href=href.startsWith('/')&&!href.startsWith('//')?href:'/';
  const close=document.createElement('button');close.type='button';close.textContent='×';
  close.setAttribute('aria-label','Dismiss saved notification');close.addEventListener('click',hide);
  (document.querySelector('dialog[open]')||document.body).append(notice);
  notice.replaceChildren(text,link,close);notice.hidden=false;schedule();
}
