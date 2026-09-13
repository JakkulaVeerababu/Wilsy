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
