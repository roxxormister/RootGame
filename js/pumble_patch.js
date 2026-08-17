/* PUMBLE rebrand patch — preserves the stable V4.6 game logic. */
(()=>{
  'use strict';
  const IMG={
    'assets/img/root_icon.png':'assets/img/pumble_icon.webp',
    'assets/img/root_door.png':'assets/img/pumble_door.webp',
    'assets/img/root_kawaii_run.png':'assets/img/pumble_kawaii_run.webp',
    'assets/img/root_kawaii_peace.png':'assets/img/pumble_kawaii_peace.webp',
    'assets/img/friend.jpg':'assets/img/arth.webp'
  };
  const swapText=s=>String(s)
    .replace(/rootproject\.local/gi,'pumbleproject.local')
    .replace(/ROOTPROJECT/g,'PUMBLEPROJECT')
    .replace(/RootProject/g,'PumbleProject')
    .replace(/ROOT Project/g,'PumbleProject')
    .replace(/ROOT Fun!/g,'Pumble Fun!')
    .replace(/ROOT FUN/g,'PUMBLE FUN')
    .replace(/ROOT Client/g,'Pumble Client')
    .replace(/ROOT PAL/g,'PUMBLE PAL')
    .replace(/\bROOT\b/g,'PUMBLE')
    .replace(/\bRoot\b/g,'Pumble')
    .replace(/max_92/gi,'ARTH')
    .replace(/\bMax\b/g,'ARTH');

  document.documentElement.classList.add('pumble-edition');
  const style=document.createElement('style');
  style.textContent=`
    #menu{background-image:url('assets/img/pumble_menu.webp')!important}
    .buddy-contact img,.buddy-avatar img{object-fit:cover!important}
  `;
  document.head.appendChild(style);
  document.title='PUMBLE — SESSION';

  const mapSrc=v=>{
    if(!v)return v;
    for(const [old,nw] of Object.entries(IMG)) if(String(v).includes(old)) return nw;
    return v;
  };

  const srcDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(srcDesc&&srcDesc.set&&srcDesc.get){
    Object.defineProperty(HTMLImageElement.prototype,'src',{
      configurable:true,enumerable:srcDesc.enumerable,
      get(){return srcDesc.get.call(this)},
      set(v){return srcDesc.set.call(this,mapSrc(v))}
    });
  }

  const nativeSet=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    if(this instanceof HTMLImageElement && String(name).toLowerCase()==='src') value=mapSrc(value);
    return nativeSet.call(this,name,value);
  };

  function patchOne(el){
    if(!el)return;
    if(el.nodeType===Node.TEXT_NODE){
      if(el.parentElement && !/^(SCRIPT|STYLE)$/i.test(el.parentElement.tagName)){
        const n=swapText(el.nodeValue); if(n!==el.nodeValue) el.nodeValue=n;
      }
      return;
    }
    if(el.nodeType!==Node.ELEMENT_NODE && el.nodeType!==Node.DOCUMENT_NODE && el.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    if(el instanceof HTMLImageElement){const raw=el.getAttribute('src');const n=mapSrc(raw);if(n&&n!==raw)nativeSet.call(el,'src',n)}
    if(el instanceof HTMLInputElement && el.classList.contains('address') && /rootproject\.local/i.test(el.value)) el.value=el.value.replace(/rootproject\.local/gi,'pumbleproject.local');
    if(el.nodeType===Node.ELEMENT_NODE){
      for(const a of ['title','alt','aria-label']) if(el.hasAttribute(a)){const v=el.getAttribute(a),n=swapText(v);if(v!==n)nativeSet.call(el,a,n)}
    }
    for(const c of el.childNodes||[]) patchOne(c);
  }

  const obs=new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes)patchOne(n);if(m.type==='characterData')patchOne(m.target)}});
  const start=()=>{patchOne(document.body);obs.observe(document.body,{subtree:true,childList:true,characterData:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  // Keep the original internal fake-domain routing intact while showing PumbleProject to the player.
  const internalize=el=>{if(el&&el.matches?.('input.address')&&/pumbleproject\.local/i.test(el.value))el.value=el.value.replace(/pumbleproject\.local/gi,'rootproject.local')};
  document.addEventListener('keydown',e=>{if(e.key==='Enter')internalize(e.target)},true);
  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-nav="go"]');if(b)internalize(b.closest('.browser-shell')?.querySelector('input.address'))},true);

  // Turn the original simple mini-game mascot drawing into a pink teddy bear without changing physics.
  const C=CanvasRenderingContext2D.prototype;
  const fill=Object.getOwnPropertyDescriptor(C,'fillStyle');
  const stroke=Object.getOwnPropertyDescriptor(C,'strokeStyle');
  if(fill?.set&&fill?.get)Object.defineProperty(C,'fillStyle',{configurable:true,get(){return fill.get.call(this)},set(v){if(this.canvas?.id==='rootGameCanvas'&&v==='#ff7900')v='#ff5da8';return fill.set.call(this,v)}});
  if(stroke?.set&&stroke?.get)Object.defineProperty(C,'strokeStyle',{configurable:true,get(){return stroke.get.call(this)},set(v){if(this.canvas?.id==='rootGameCanvas'&&v==='#6e2d00')v='#7b204f';return stroke.set.call(this,v)}});
  const arc=C.arc,moveTo=C.moveTo;
  C.arc=function(x,y,r,a,b,ccw){
    const out=arc.call(this,x,y,r,a,b,ccw);
    if(this.canvas?.id==='rootGameCanvas'&&x===17&&y===15&&r===16){
      moveTo.call(this,5,-2);arc.call(this,5,3,7,0,Math.PI*2,false);
      moveTo.call(this,29,-2);arc.call(this,29,3,7,0,Math.PI*2,false);
    }
    return out;
  };
})();
