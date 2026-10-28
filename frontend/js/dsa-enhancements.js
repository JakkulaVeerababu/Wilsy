document.addEventListener('DOMContentLoaded',()=>{
  const $=selector=>document.querySelector(selector);
  document.querySelector('.dsa-topic-nav').addEventListener('click',event=>{
    const button=event.target.closest('[data-dsa-topic]');if(!button)return;
    document.querySelectorAll('[data-dsa-topic]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
    document.dispatchEvent(new CustomEvent('dsa:topic',{detail:button.dataset.dsaTopic}));
  });
  $('#centralNode').addEventListener('click',()=>{document.querySelectorAll('[data-dsa-topic]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.dsaTopic==='all')));});

  // The source app uses a drawer. Add a real keyboard focus boundary and restore focus.
  for(const [selector,closeId,focusId] of [['#drawerContent','#closeDrawerBtn','#closeDrawerBtn'],['#authModalOverlay','#closeAuthBtn','#authEmail']]){
    const modal=$(selector),close=$(closeId);let previous,opened=false;
    const siblings=()=>[...document.body.children].filter(el=>el!==modal&&!el.matches('.drawer-overlay,script,link,noscript'));
    const sync=()=>{
      const active=modal.classList.contains('active');if(active===opened)return;opened=active;modal.inert=!active;
      if(active){previous=document.activeElement;for(const el of siblings())el.inert=true;document.body.classList.add('dsa-modal-open');($(focusId)||close).focus();}
      else{for(const el of siblings())el.inert=false;document.body.classList.remove('dsa-modal-open');if(previous?.isConnected)previous.focus({preventScroll:true});}
    };
    new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class']});
    modal.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close.click();return;}
      if(event.key!=='Tab')return;
      const focusable=[...modal.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    modal.addEventListener('click',event=>{if(selector==='#authModalOverlay'&&event.target===modal)close.click();});
  }
  // Label individual completion controls when the original renderer updates either view.
  const labelChecks=()=>document.querySelectorAll('.pattern-card,.tree-node.is-pattern').forEach(card=>{
    const checkbox=card.querySelector('input[type=checkbox]'),title=card.querySelector('.pattern-card-title,.node-title-group');
    if(checkbox&&title)checkbox.setAttribute('aria-label','Mark '+title.textContent.trim()+' mastered');
  });
  labelChecks();
  new MutationObserver(labelChecks).observe($('#patternsList'),{childList:true});
  new MutationObserver(labelChecks).observe($('#mindmapTreeWrapper'),{childList:true});
});
