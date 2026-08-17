(()=>{
'use strict';

// ROOT — SESSION 2.2
// Everything that looks like Internet, messaging, files or personal data is simulated locally.
// The only optional real-device feature is the webcam preview requested with getUserMedia().
// The stream is never recorded, captured, uploaded, analyzed or stored by this game.

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>performance.now();
const SAVE_KEY='root_session_v4_save';
const SAVE_VERSION=4;

const AUDIO={
  menu:'assets/audio/menu.mp3', menuClick:'assets/audio/menu_click.mp3', monitor:'assets/audio/monitor_start.mp3', osStart:'assets/audio/os_start.mp3',
  hdd:'assets/audio/hdd.mp3', fan:'assets/audio/fan.mp3', message:'assets/audio/message.mp3', notify:'assets/audio/notify.mp3', vibrate:'assets/audio/vibrate.mp3',
  doorbell:'assets/audio/doorbell.mp3', otherRoom:'assets/audio/other_room.mp3', stepsFar:'assets/audio/steps_far.mp3', stepsNear:'assets/audio/steps_near.mp3',
  bulbBreak:'assets/audio/bulb_break.mp3', error:'assets/audio/error.mp3', click:'assets/audio/click.mp3', key:'assets/audio/key.mp3', typing:'assets/audio/typing.mp3',
  tension:'assets/audio/tension.mp3', glitch:'assets/audio/glitch.mp3', stinger:'assets/audio/stinger.mp3', jumpscare:'assets/audio/jumpscare.mp3',
  radioStatic:'assets/audio/radio_static.mp3', radioProgram:'assets/audio/radio_program.mp3', ambient:'assets/audio/ambient.mp3', phone:'assets/audio/phone_ring.mp3', creak:'assets/audio/creak.mp3', power:'assets/audio/power.mp3'
};

class AudioBus{
  constructor(){this.master=.72;this.music=.55;this.sfx=.75;this.loops={};this.unlocked=false;}
  unlock(){this.unlocked=true;}
  one(name,vol=1,rate=1){if(!this.unlocked||!AUDIO[name])return null;const a=new Audio(AUDIO[name]);a.volume=clamp(this.master*this.sfx*vol,0,1);a.playbackRate=rate;a.play().catch(()=>{});return a;}
  loop(name,vol=.25,key=name){if(!this.unlocked||!AUDIO[name])return null;this.stop(key);const a=new Audio(AUDIO[name]);a.loop=true;a.volume=clamp(this.master*(key==='menu'||key==='ambient'?this.music:this.sfx)*vol,0,1);a.play().catch(()=>{});this.loops[key]=a;return a;}
  stop(key){const a=this.loops[key];if(a){a.pause();a.currentTime=0;delete this.loops[key];}}
  stopAll(){Object.keys(this.loops).forEach(k=>this.stop(k));}
  refresh(){for(const [k,a] of Object.entries(this.loops))a.volume=clamp(this.master*(k==='menu'||k==='ambient'?this.music:this.sfx)*.45,0,1);}
}
const audio=new AudioBus();

audio.loop('menu',.42,'menu'); // may start after first user gesture

const defaultState=()=>({
  version:SAVE_VERSION,
  started:false, installed:false, relayUnlocked:false, webcamApp:false,
  phase:'intro', mission:null, missionStartedAt:0, missionDeadline:0,
  compliance:0, defiance:0, mistakes:0,
  maxRelation:0, leaRelation:0,
  storyFlags:{},
  gameMinutes:22*60+41,
  settings:{master:.72,music:.55,sfx:.75,crt:.14,text:1},
  files:{
    'Mes documents/Devoirs/francais.doc':{type:'doc',icon:'📄',content:'Exposé de français — à rendre vendredi.\n\nNe pas oublier la conclusion.'},
    'Mes documents/Photos/photo_classe_2002.jpg':{type:'img',icon:'🖼️',content:'Photo de classe — avril 2002.\nMax est au dernier rang.'},
    'Mes documents/Notes/journal_temp.txt':{type:'txt',icon:'📝',content:'liste vite fait\n- rendre cassette à max\n- appeler léa\n- mot à retenir : LIMEN\n- supprimer ce fichier après'},
    'Mes documents/Musique/mix01.mp3':{type:'audio',icon:'🎵',content:'MIX01 — 03:42'},
    'Système/session.log':{type:'sys',icon:'⚙️',content:'ASTER SESSION LOG\nboot=22:41\nnetwork=ready\nuser=alex'},
  },
  deletedFiles:[],
  buddyLogs:{max:[],lea:[]},
  buddyUnread:{max:0,lea:0},
  activeBuddy:'max',
  relayLog:[], relayChoices:null,
  browser:{url:'searchbox.local',history:['searchbox.local'],index:0},
  rootSite:{registered:false,participant:'',downloaded:false,secretSeen:false,archiveUnlocked:false},
  radio:{station:'96.4',on:false},
  webcam:{everAllowed:false,completed:0,denied:0},
  finalVariant:null,
  saveStamp:0
});
let state=defaultState();
let runtime={
  screen:'menu', windows:{}, z:20, timers:new Set(), toastTimer:null, objectiveTimer:null,
  missionInterval:null, relayTyping:false, radioAudio:null, webcamStream:null, webcamTick:null,
  rootGameRAF:null, rootGameKeys:{}, rootGameCleanup:null,
  missionCheckpoint:null, dead:false,
  menuMusicStarted:false, firstDesktop:false, shock:false, screamerActive:false, quit:false
};

function loadSave(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;const s=JSON.parse(raw);if(s.version!==SAVE_VERSION)return false;state=Object.assign(defaultState(),s);state.settings=Object.assign(defaultState().settings,s.settings||{});for(const contact of ['max','lea']){state.buddyLogs[contact]=(state.buddyLogs[contact]||[]).map(m=>{if(m&&m.from!=='you'&&(m.text===undefined||m.text===null||m.text==='')&&typeof m.from==='string'&&!['max','lea'].includes(m.from)){return {...m,from:contact,text:m.from}}return m})}return true}catch{return false}}
function saveGame(show=true){state.saveStamp=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));if(show)toast('Session sauvegardée.','💾')}catch{if(show)toast('Impossible de sauvegarder.','⚠️')}}
function clearSave(){localStorage.removeItem(SAVE_KEY)}
function applySettings(){document.documentElement.style.setProperty('--crt',state.settings.crt);document.documentElement.style.setProperty('--text-scale',state.settings.text);audio.master=state.settings.master;audio.music=state.settings.music;audio.sfx=state.settings.sfx;audio.refresh()}
loadSave();applySettings();

// ---------- SCREEN / MENU ----------
const menu=$('#menu'),boot=$('#boot'),computer=$('#computer'),ending=$('#ending');
function showScreen(name){runtime.screen=name;for(const el of [menu,boot,computer,ending])el.classList.add('hidden');$('#'+name).classList.remove('hidden')}
function updateContinue(){const has=!!localStorage.getItem(SAVE_KEY);$('#continueBtn').disabled=!has;$('#continueBtn').style.opacity=has?'1':'.42'}
updateContinue();

function ensureAudio(){if(!audio.unlocked)audio.unlock();if(runtime.screen==='menu'&&!audio.loops.menu)audio.loop('menu',.48,'menu');const hint=$('#menuSoundHint');if(hint){hint.textContent='♪ MUSIQUE ACTIVE';hint.classList.add('playing')}}
document.addEventListener('pointerdown',ensureAudio,{once:false});
document.addEventListener('keydown',ensureAudio,{once:false});
document.addEventListener('click',e=>{if(e.target.closest('button'))audio.one(runtime.screen==='menu'?'menuClick':'click',.32)},true);

$('#newGameBtn').onclick=()=>startNewGame();
$('#continueBtn').onclick=()=>{if(loadSave()){applySettings();startBoot(true)}};
$('#optionsBtn').onclick=()=>showOptions();
$('#creditsBtn').onclick=()=>showCredits();
$('#quitBtn').onclick=()=>showQuit();
$('#menuSoundHint')?.addEventListener('click',ensureAudio);

function startNewGame(){clearAllRuntime();state=defaultState();applySettings();$('#objectiveCard')?.classList.add('hidden');$('#desktopToast')?.classList.add('hidden');$('#startMenu')?.classList.add('hidden');$('#modalLayer')?.classList.add('hidden');saveGame(false);startBoot(false)}
async function startBoot(fromSave){ensureAudio();audio.stop('menu');showScreen('boot');$('#bios').classList.remove('hidden');$('#bootLogo').classList.add('hidden');
  const lines=[
    'ASTER BIOS v4.09R  Copyright (C) 1998-2002 Aster Systems',
    '',
    'CPU: Asteron 1100 MHz ........................ OK',
    'Memory test: 262144K .......................... OK',
    'Primary Master: QUANTUM 20.4 GB ............... OK',
    'PS/2 Mouse .................................... Detected',
    'Network Adapter 10/100 ........................ Ready',
    '',
    'Checking system data ...............',
  ];
  $('#bios').textContent=''; audio.one('monitor',.45);
  for(const l of lines){$('#bios').textContent+=l+'\n';await wait(l?120:80)}
  await wait(600);$('#bios').classList.add('hidden');$('#bootLogo').classList.remove('hidden');audio.one('osStart',.38);await wait(2100);
  showDesktop(fromSave);
}

function showDesktop(fromSave){showScreen('computer');$('#windowsLayer').innerHTML='';$('#taskButtons').innerHTML='';runtime.windows={};
  if(!$('.desktop-crt',$('#desktop'))){const crt=document.createElement('div');crt.className='desktop-crt';$('#desktop').appendChild(crt)}
  audio.loop('fan',.12,'fan'); audio.loop('hdd',.04,'hdd');
  if(state.phase!=='final')audio.loop('ambient',.055,'ambient');
  buildDesktopIcons();bindDesktopShell();updateClock();
  if(!runtime.firstDesktop){runtime.firstDesktop=true;setTimeout(()=>{if(!fromSave&&state.phase==='intro')beginIntro();else restoreStoryView()},900)}
  else restoreStoryView();
}

function bindDesktopShell(){
  $('#startBtn').onclick=e=>{e.stopPropagation();$('#startMenu').classList.toggle('hidden')};
  $('#desktop').onclick=e=>{if(!e.target.closest('#startMenu')&&!e.target.closest('#startBtn'))$('#startMenu').classList.add('hidden')};
  $$('[data-start]').forEach(b=>b.onclick=()=>{const a=b.dataset.start;$('#startMenu').classList.add('hidden');if(a==='documents')openApp('files');if(a==='settings')showOptions();if(a==='save')saveGame();if(a==='menu')returnToMenu();if(a==='shutdown')shutdownComputer()});
}
function returnToMenu(){stopWebcam();stopRootMiniGame();clearMissionTimer();Object.values(runtime.windows).forEach(w=>w.el.remove());runtime.windows={};audio.stop('fan');audio.stop('hdd');audio.stop('ambient');audio.stop('radio');showScreen('menu');audio.loop('menu',.48,'menu');const mh=$('#menuSoundHint');if(mh&&audio.unlocked){mh.textContent='♪ MUSIQUE ACTIVE';mh.classList.add('playing')}updateContinue()}
function shutdownComputer(){modal('ASTER','Il est maintenant possible d’éteindre votre ordinateur.',[{label:'Rallumer',action:()=>{}},{label:'Retour au menu',action:returnToMenu}],false)}

function buildDesktopIcons(){
  const icons=[
    ['computer','🖥️','Mon ordinateur'],['browser','🌐','NetGlide'],['buddy','💬','BuddyChat'],['files','📁','Mes documents'],['radio','📻','RadioWave'],['recycle','🗑️','Corbeille']
  ];
  if(state.installed){icons.push(['rootgame','★','ROOT Fun!']);}
  if(state.webcamApp)icons.push(['webcam','📹','CamView 1.8']);
  if(state.relayUnlocked)icons.push(['relay','<img src="assets/img/root_icon.png" alt="">','ROOT Project']);
  const wrap=$('#desktopIcons');if(!wrap)return;wrap.innerHTML='';
  icons.forEach(([id,ico,label])=>{const b=document.createElement('button');b.className='desktop-icon';b.dataset.app=id;b.innerHTML=`<span class="ico">${ico}</span><em>${esc(label)}</em>${(id==='buddy'&&(state.buddyUnread.max+state.buddyUnread.lea)>0)||(id==='relay'&&state.storyFlags.relayUnread)?'<i class="badge">!</i>':''}`;b.ondblclick=()=>openApp(id);b.onclick=()=>{$$('.desktop-icon').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')};wrap.appendChild(b)});
}

// ---------- WINDOW MANAGER ----------
const APP_META={
  computer:['🖥️','Mon ordinateur'],browser:['🌐','NetGlide'],buddy:['💬','BuddyChat'],files:['📁','Mes documents'],radio:['📻','RadioWave 3.2'],recycle:['🗑️','Corbeille'],rootclient:['◉','ROOT Client 2.1'],rootgame:['★','ROOT Fun!'],webcam:['📹','CamView 1.8'],relay:['<img src="assets/img/root_icon.png" alt="">','ROOT Project'],installer:['<img src="assets/img/root_icon.png" alt="">','Installation de ROOT'],settings:['⚙','Paramètres Aster']
};
function openApp(id,opts={}){
  if(runtime.windows[id]){focusWindow(id);runtime.windows[id].el.classList.remove('minimized');return runtime.windows[id]}
  const [icon,title]=APP_META[id]||['□',id];
  const el=document.createElement('div');el.className='window'+(id==='relay'?' relay-window':'')+(id==='installer'?' root-window':'');
  el.dataset.id=id;el.style.width=(opts.w||defaultSize(id)[0])+'px';el.style.height=(opts.h||defaultSize(id)[1])+'px';
  el.style.left=(opts.x??(90+(Object.keys(runtime.windows).length*28)%260))+'px';el.style.top=(opts.y??(45+(Object.keys(runtime.windows).length*23)%150))+'px';
  el.style.zIndex=++runtime.z;
  el.innerHTML=`<div class="window-title"><span class="title-icon">${icon}</span><span class="title-text">${esc(opts.title||title)}</span><div class="win-controls"><button class="min" title="Réduire">_</button><button class="max" title="Agrandir">□</button><button class="close" title="Fermer">×</button></div></div><div class="window-body"></div><div class="window-resize"></div>`;
  $('#windowsLayer').appendChild(el);runtime.windows[id]={id,el,body:$('.window-body',el),max:false,restore:null};
  makeWindowInteractive(id);renderApp(id);focusWindow(id);addTaskButton(id);return runtime.windows[id]
}
function defaultSize(id){return ({browser:[820,590],buddy:[650,500],relay:[560,490],files:[700,500],radio:[520,380],rootgame:[760,520],webcam:[600,520],installer:[620,420],computer:[560,400],recycle:[510,360]})[id]||[560,400]}
function makeWindowInteractive(id){const w=runtime.windows[id],el=w.el,title=$('.window-title',el);let drag=null;
  title.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;focusWindow(id);if(w.max)return;drag={x:e.clientX,y:e.clientY,l:parseInt(el.style.left),t:parseInt(el.style.top)};title.setPointerCapture(e.pointerId)});
  title.addEventListener('pointermove',e=>{if(!drag)return;el.style.left=clamp(drag.l+e.clientX-drag.x,0,innerWidth-120)+'px';el.style.top=clamp(drag.t+e.clientY-drag.y,0,innerHeight-75)+'px'});
  title.addEventListener('pointerup',()=>drag=null);el.addEventListener('pointerdown',()=>focusWindow(id));
  $('.min',el).onclick=()=>{el.classList.add('minimized');refreshTaskButtons();onWindowHidden(id,'minimize')};
  $('.max',el).onclick=()=>toggleMax(id);$('.close',el).onclick=()=>closeWindow(id);
  let resize=null;$('.window-resize',el).addEventListener('pointerdown',e=>{if(w.max)return;resize={x:e.clientX,y:e.clientY,w:el.offsetWidth,h:el.offsetHeight};e.target.setPointerCapture(e.pointerId)});$('.window-resize',el).addEventListener('pointermove',e=>{if(!resize)return;el.style.width=clamp(resize.w+e.clientX-resize.x,330,innerWidth-20)+'px';el.style.height=clamp(resize.h+e.clientY-resize.y,220,innerHeight-55)+'px'});$('.window-resize',el).addEventListener('pointerup',()=>resize=null)
}
function toggleMax(id){const w=runtime.windows[id],el=w.el;if(!w.max){w.restore={l:el.style.left,t:el.style.top,w:el.style.width,h:el.style.height};el.classList.add('maximized');w.max=true}else{el.classList.remove('maximized');Object.assign(el.style,{left:w.restore.l,top:w.restore.t,width:w.restore.w,height:w.restore.h});w.max=false}}
function focusWindow(id){const w=runtime.windows[id];if(!w)return;Object.values(runtime.windows).forEach(x=>x.el.classList.add('inactive'));w.el.classList.remove('inactive');w.el.style.zIndex=++runtime.z;refreshTaskButtons()}
function closeWindow(id){const w=runtime.windows[id];if(!w)return;if(id==='webcam')stopWebcam();if(id==='rootgame')stopRootMiniGame();w.el.remove();delete runtime.windows[id];const tb=$(`.task-btn[data-task="${id}"]`);if(tb)tb.remove();onWindowHidden(id,'close');}
function onWindowHidden(id,how){if(state.mission==='m01'&&id==='relay'&&!state.storyFlags.m01Complete)missionFail('Tu as fermé ROOT Project.','Je t’ai demandé de ne pas fermer cette fenêtre.');if(state.mission==='m10'&&id==='webcam'&&!state.storyFlags.m10Complete)missionFail('La caméra a été coupée.')}
function addTaskButton(id){const [,title]=APP_META[id]||['',id];const b=document.createElement('button');b.className='task-btn';b.dataset.task=id;b.textContent=title;b.onclick=()=>{const w=runtime.windows[id];if(w.el.classList.contains('minimized')){w.el.classList.remove('minimized');focusWindow(id)}else if(parseInt(w.el.style.zIndex)===runtime.z)w.el.classList.add('minimized');else focusWindow(id);refreshTaskButtons()};$('#taskButtons').appendChild(b);refreshTaskButtons()}
function refreshTaskButtons(){$$('.task-btn').forEach(b=>{const w=runtime.windows[b.dataset.task];b.classList.toggle('active',!!w&&!w.el.classList.contains('minimized')&&parseInt(w.el.style.zIndex)===runtime.z)})}

function renderApp(id){const w=runtime.windows[id];if(!w)return;switch(id){case'browser':renderBrowser(w);break;case'buddy':renderBuddy(w);break;case'relay':renderRelay(w);break;case'files':renderFiles(w);break;case'radio':renderRadio(w);break;case'rootgame':renderRootGame(w);break;case'webcam':renderWebcam(w);break;case'recycle':renderRecycle(w);break;case'computer':renderComputerApp(w);break;case'rootclient':renderRootClient(w);break;case'installer':renderInstaller(w);break}}

// ---------- COMMON UI ----------
function toast(text,icon='💬',ms=4300){const el=$('#desktopToast');if(!el)return;el.innerHTML=`<b>${icon}</b> ${esc(text)}`;el.classList.remove('hidden');clearTimeout(runtime.toastTimer);runtime.toastTimer=setTimeout(()=>el.classList.add('hidden'),ms)}
function objective(title,text,seconds=null){const el=$('#objectiveCard');el.classList.remove('hidden');el.className='';el.innerHTML=`<div class="objective-title">DÉFI EN COURS ${seconds!=null?'<span class="objective-timer"></span>':''}</div><b>${esc(title)}</b><div>${esc(text)}</div>`;if(seconds!=null)startObjectiveCountdown(seconds)}
function objectiveDone(text='Défi terminé.'){const el=$('#objectiveCard');el.className='objective-card-done';el.innerHTML=`<div class="objective-title">DÉFI TERMINÉ</div>${esc(text)}`;clearMissionTimer();setTimeout(()=>el.classList.add('hidden'),3500)}
function objectiveFail(text='Défi échoué.'){const el=$('#objectiveCard');el.className='objective-card-fail';el.innerHTML=`<div class="objective-title">ÉCHEC</div>${esc(text)}`;clearMissionTimer();setTimeout(()=>el.classList.add('hidden'),3600)}
function startObjectiveCountdown(seconds){clearMissionTimer();state.missionStartedAt=Date.now();state.missionDeadline=Date.now()+seconds*1000;const update=()=>{const rem=Math.max(0,Math.ceil((state.missionDeadline-Date.now())/1000));const t=$('.objective-timer');if(t)t.textContent=`${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}`;if(rem<=0){clearMissionTimer();missionTimeout()}};update();runtime.missionInterval=setInterval(update,250)}
function clearMissionTimer(){if(runtime.missionInterval){clearInterval(runtime.missionInterval);runtime.missionInterval=null}}
function modal(title,html,actions=[{label:'OK'}],dark=false){const layer=$('#modalLayer');layer.classList.remove('hidden');layer.innerHTML=`<div class="modal ${dark?'dark':''}"><div class="modal-title">${esc(title)}</div><div class="modal-content">${html}</div><div class="modal-actions"></div></div>`;const box=$('.modal-actions',layer);actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.onclick=()=>{layer.classList.add('hidden');layer.innerHTML='';a.action?.()};box.appendChild(b)});return layer}

function rootScreamer(onDone){
  if(runtime.screamerActive)return;
  runtime.screamerActive=true;

  const layer=$('#shockLayer');
  layer.innerHTML=`<div class="root-screamer root-screamer-wait">
    <div class="root-screamer-image">
      <img class="root-scream-main" src="assets/img/root_door.png" alt="">
      <img class="root-scream-ghost ghost-a" src="assets/img/root_door.png" alt="">
      <img class="root-scream-ghost ghost-b" src="assets/img/root_door.png" alt="">
    </div>
    <div class="root-screamer-tear"></div>
    <div class="root-screamer-noise"></div>
    <div class="root-screamer-vignette"></div>
  </div>`;

  layer.classList.remove('hidden','shock-glitch','screamer-black');

  const box=$('.root-screamer',layer);

  // Tiny moment of complete silence before ROOT hits the screen.
  audio.stop('ambient');
  audio.stop('radio');
  audio.stop('fan');
  audio.stop('hdd');

  later(()=>{
    if(!box)return;
    box.classList.remove('root-screamer-wait');
    box.classList.add('root-screamer-attack');

    audio.one('jumpscare',.96,.94);
    audio.one('glitch',.58,1.18);
    later(()=>audio.one('stinger',.66,.78),100);
    later(()=>audio.one('jumpscare',.35,.72),260);
  },145);

  // Hold ROOT very close for a fraction of a second, then kill the picture.
  later(()=>layer.classList.add('screamer-black'),780);

  later(()=>{
    layer.classList.add('hidden');
    layer.classList.remove('screamer-black');
    layer.innerHTML='<div class="shockText"></div>';
    runtime.screamerActive=false;
    if(onDone)onDone();
  },1020);
}

function shock(text='',sound='stinger',duration=620,big=false){if(runtime.shock)return;runtime.shock=true;audio.one(sound,big?.95:.7);const l=$('#shockLayer');l.classList.remove('hidden');l.classList.add('shock-glitch');$('.shockText',l).textContent=text;setTimeout(()=>{l.classList.add('hidden');l.classList.remove('shock-glitch');runtime.shock=false},duration)}
function showOptions(){modal('Options',`<div class="option-row"><label>Volume général</label><input id="optMaster" type="range" min="0" max="1" step=".01" value="${state.settings.master}"><span id="vMaster">${Math.round(state.settings.master*100)}%</span></div><div class="option-row"><label>Musique</label><input id="optMusic" type="range" min="0" max="1" step=".01" value="${state.settings.music}"><span id="vMusic">${Math.round(state.settings.music*100)}%</span></div><div class="option-row"><label>Effets</label><input id="optSfx" type="range" min="0" max="1" step=".01" value="${state.settings.sfx}"><span id="vSfx">${Math.round(state.settings.sfx*100)}%</span></div><div class="option-row"><label>Effet CRT</label><input id="optCrt" type="range" min="0" max=".35" step=".01" value="${state.settings.crt}"><span id="vCrt">${Math.round(state.settings.crt*100)}%</span></div><div class="option-row"><label>Taille du texte</label><input id="optText" type="range" min=".85" max="1.25" step=".05" value="${state.settings.text}"><span id="vText">${Math.round(state.settings.text*100)}%</span></div><div class="privacy-card"><b>Webcam</b><br>ROOT ne demande l’accès à la caméra que pendant certains défis. Le flux reste dans ton navigateur : aucune image n’est enregistrée, capturée ou envoyée. Tu peux refuser la permission.</div>`,[{label:'Fermer'}]);
  const bind=(id,key,out,mult=100)=>{const el=$('#'+id);if(!el)return;el.oninput=()=>{state.settings[key]=Number(el.value);$('#'+out).textContent=Math.round(Number(el.value)*mult)+'%';applySettings();saveGame(false)}};bind('optMaster','master','vMaster');bind('optMusic','music','vMusic');bind('optSfx','sfx','vSfx');bind('optCrt','crt','vCrt');bind('optText','text','vText')
}
function showCredits(){modal('Crédits',`<div style="text-align:center;padding:10px"><h2 style="font-family:RootDisplay">ROOT — SESSION</h2><p>Concept et direction : Liam Avoine</p><p>Jeu d’horreur psychologique fictif inspiré de l’Internet du début des années 2000.</p><p class="privacy-note">Toutes les conversations, personnes, sites, fichiers et conséquences sont fictifs. Le jeu ne contacte jamais de vraies personnes.</p></div>`,[{label:'Fermer'}],true)}
function showQuit(){modal('Quitter ROOT','<p>Le navigateur ne permet pas toujours à un jeu de fermer sa propre fenêtre.</p><p>Tu peux sauvegarder puis fermer cet onglet.</p>',[{label:'Sauvegarder',action:()=>saveGame()},{label:'Annuler'}],true)}

// ---------- CLOCK ----------
setInterval(()=>{if(runtime.screen==='computer'&&state.started){state.gameMinutes+=.018;updateClock()}},1000);
function updateClock(){const m=Math.floor(state.gameMinutes)%1440;const h=Math.floor(m/60),mm=m%60;const el=$('#clock');if(el)el.textContent=`${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}

// ---------- BUDDYCHAT ----------
const buddyNames={max:'max_92',lea:'Léa'};
function addBuddy(contact,text,delaySound=true){state.buddyLogs[contact].push({from:contact,text:String(text??''),time:Date.now()});if(state.activeBuddy!==contact||!runtime.windows.buddy)state.buddyUnread[contact]=(state.buddyUnread[contact]||0)+1;if(delaySound){audio.one('message',.45);toast(`${buddyNames[contact]} : ${text}`,'💬',3900)}buildDesktopIcons();if(runtime.windows.buddy)renderBuddy(runtime.windows.buddy)}
function buddyChoices(contact,choices){state.storyFlags.buddyChoiceContact=contact;state.storyFlags.buddyChoices=choices;if(runtime.windows.buddy)renderBuddy(runtime.windows.buddy)}
function clearBuddyChoices(){state.storyFlags.buddyChoices=null;state.storyFlags.buddyChoiceContact=null;if(runtime.windows.buddy)renderBuddy(runtime.windows.buddy)}
function selectBuddy(contact){state.activeBuddy=contact;state.buddyUnread[contact]=0;buildDesktopIcons();renderBuddy(runtime.windows.buddy)}
function renderBuddy(w){const contacts=['max','lea'];w.body.innerHTML=`<div class="buddychat"><div class="buddy-contacts"><div class="buddy-brand">BuddyChat 5.1</div>${contacts.map(c=>`<div class="buddy-contact ${state.activeBuddy===c?'active':''}" data-contact="${c}">${c==='max'?'<img src="assets/img/friend.jpg">':`<div class="avatar">L</div>`}<div><b>${buddyNames[c]}</b><br><span class="dot">● en ligne</span></div>${state.buddyUnread[c]?`<i class="unread">${state.buddyUnread[c]}</i>`:''}</div>`).join('')}</div><div class="buddy-chatpane"><div class="buddy-top"><b>${buddyNames[state.activeBuddy]}</b><small>● En ligne</small></div><div class="buddy-log"></div><div class="buddy-choices"></div></div></div>`;
  $$('.buddy-contact',w.body).forEach(x=>x.onclick=()=>selectBuddy(x.dataset.contact));
  const log=$('.buddy-log',w.body),contact=state.activeBuddy;state.buddyLogs[contact].forEach(m=>{const d=document.createElement('div');d.className='chat-line '+(m.from==='you'?'you':'');let msgText=m.text??m.message??m.content??'';if(!msgText&&m.from!=='you'&&typeof m.from==='string'&&!['max','lea'].includes(m.from))msgText=m.from;d.innerHTML=`<b>${m.from==='you'?'alex':esc(buddyNames[contact])} :</b> <span class="chat-text" style="color:#111!important;-webkit-text-fill-color:#111!important">${esc(msgText)}</span>`;log.appendChild(d)});log.scrollTop=log.scrollHeight;
  const choices=$('.buddy-choices',w.body);const arr=state.storyFlags.buddyChoices&&state.storyFlags.buddyChoiceContact===contact?state.storyFlags.buddyChoices:null;if(!arr){choices.innerHTML='<div class="buddy-idle">Choisis une réponse lorsqu’un message l’exige.</div>'}else{arr.forEach((c,i)=>{const b=document.createElement('button');b.className='choice-btn';b.textContent=c.text;b.onclick=()=>handleBuddyChoice(contact,c,i);choices.appendChild(b)})}
}
function handleBuddyChoice(contact,c,index){
  if(state.mission==='m06'&&!state.storyFlags.m06Complete){
    state.storyFlags.m06Replied=true;
    state.buddyLogs[contact].push({from:'you',text:c.text,time:Date.now()});
    clearBuddyChoices();
    if(runtime.windows.buddy)renderBuddy(runtime.windows.buddy);
    audio.one('error',.65);
    saveGame(false);
    missionFail('Tu as répondu pendant le silence imposé.','Je t’ai dit de ne répondre à PERSONNE.');
    return;
  }
  state.buddyLogs[contact].push({from:'you',text:c.text,time:Date.now()});
  clearBuddyChoices();
  if(runtime.windows.buddy)renderBuddy(runtime.windows.buddy);
  audio.one('key',.25);
  c.action?.();
  saveGame(false)
}

// ---------- ROOT Project ----------
function addRelay(from,text,opts={}){state.relayLog.push({from,text,kind:opts.kind||'',image:opts.image||'',caption:opts.caption||'',time:Date.now()});if(!runtime.windows.relay){state.storyFlags.relayUnread=true;buildDesktopIcons();toast('ROOT Project : nouveau message','◉',4000)}else{state.storyFlags.relayUnread=false;renderRelay(runtime.windows.relay);focusWindow('relay')}if(opts.sound!==false)audio.one(opts.sound||'notify',.46)}
function setRelayChoices(choices){state.relayChoices=choices;state.storyFlags.relayUnread=!runtime.windows.relay;if(runtime.windows.relay)renderRelay(runtime.windows.relay);buildDesktopIcons()}
function clearRelayChoices(){state.relayChoices=null;if(runtime.windows.relay)renderRelay(runtime.windows.relay)}
function relaySay(text,delay=0,opts={}){return new Promise(resolve=>{setTimeout(()=>{addRelay('man',text,opts);resolve()},delay)})}
function renderRelay(w){state.storyFlags.relayUnread=false;buildDesktopIcons();w.body.innerHTML=`<div class="relay"><div class="relay-head"><b>ROOT PROJECT</b><small>operator session / ${state.rootSite.participant||'pending'}</small></div><div class="relay-log"></div>${state.relayChoices?'<div class="relay-choices"></div>':'<div class="relay-wait">En attente.</div>'}</div>`;const log=$('.relay-log',w.body);state.relayLog.forEach(m=>{const d=document.createElement('div');d.className='relay-line '+(m.from==='man'?'man':m.from==='you'?'you':m.from==='system'?'system':'')+(m.kind?' '+m.kind:'');d.innerHTML=`<span class="who">${m.from==='man'?'INCONNU':m.from==='you'?'VOUS':'SYSTÈME'}</span>${esc(m.text)}${m.image?`<div class="relay-media"><img src="${esc(m.image)}" alt="Pièce jointe"><small>${esc(m.caption||'PIÈCE JOINTE / IMAGE')}</small></div>`:''}`;log.appendChild(d)});log.scrollTop=log.scrollHeight;if(state.relayChoices){const box=$('.relay-choices',w.body);state.relayChoices.forEach((c,i)=>{const b=document.createElement('button');b.className='relay-choice';b.textContent=c.text;b.onclick=()=>handleRelayChoice(c,i);box.appendChild(b)})}}
function handleRelayChoice(c,index){state.relayLog.push({from:'you',text:c.text,time:Date.now()});state.relayChoices=null;if(runtime.windows.relay)renderRelay(runtime.windows.relay);audio.one('key',.25);c.action?.();saveGame(false)}

// ---------- BROWSER / FAKE INTERNET ----------
function renderBrowser(w){w.body.innerHTML=`<div class="browser-shell"><div class="browser-menubar">Fichier &nbsp; Édition &nbsp; Affichage &nbsp; Favoris &nbsp; Outils &nbsp; Aide</div><div class="browser-toolbar"><button data-nav="back">◀</button><button data-nav="forward">▶</button><button data-nav="home">⌂</button><span class="address-label">Adresse</span><input class="address" value="${esc(state.browser.url)}"><button data-nav="go">OK</button></div><div class="browser-content"></div><div class="browser-status">Internet local — 56 Kbit/s &nbsp; | &nbsp; Zone : Internet</div></div>`;const address=$('.address',w.body);const go=()=>navigateBrowser(address.value.trim());$$('[data-nav]',w.body).forEach(b=>b.onclick=()=>{const n=b.dataset.nav;if(n==='home')navigateBrowser('searchbox.local');if(n==='go')go();if(n==='back'&&state.browser.index>0){state.browser.index--;state.browser.url=state.browser.history[state.browser.index];renderBrowser(w)}if(n==='forward'&&state.browser.index<state.browser.history.length-1){state.browser.index++;state.browser.url=state.browser.history[state.browser.index];renderBrowser(w)}});address.addEventListener('keydown',e=>{if(e.key==='Enter')go()});renderWebPage($('.browser-content',w.body),state.browser.url)}
function navigateBrowser(url,push=true){url=url.toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');if(!url)url='searchbox.local';state.browser.url=url;if(push){state.browser.history=state.browser.history.slice(0,state.browser.index+1);state.browser.history.push(url);state.browser.index=state.browser.history.length-1}if(runtime.windows.browser)renderBrowser(runtime.windows.browser);saveGame(false)}
function browserLinkHandler(root){$$('[data-url]',root).forEach(a=>a.onclick=e=>{e.preventDefault();navigateBrowser(a.dataset.url)})}
function renderWebPage(root,url){let html='';
  if(url.startsWith('rootproject.local'))html=renderRootProject(url);
  else if(url==='searchbox.local')html=renderSearchHome();
  else if(url.startsWith('searchbox.local/?q='))html=renderSearchResults(decodeURIComponent(url.split('=')[1]||''));
  else if(url==='netforum.local')html=renderNetForum();
  else if(url==='mytown.local')html=renderMyTown();
  else if(url==='musicwire.local')html=renderMusicWire();
  else if(url==='pixelhost.local')html=renderPixelHost();
  else if(url==='gamezone.local')html=renderGameZone();
  else if(url==='coolpage.local')html=renderCoolPage();
  else html=render404(url);
  root.innerHTML=html;browserLinkHandler(root);bindWebPageActions(root,url)
}
function renderSearchHome(){return `<div class="webpage search-home"><div class="search-logo">SearchBox</div><div>Le moteur du web</div><div class="search-box"><input id="webSearch" value=""><button id="webSearchBtn">Rechercher</button></div><p class="tiny">SearchBox Directory © 2002 — 18 421 pages indexées</p><p><a data-url="netforum.local">NetForum</a> · <a data-url="mytown.local">MyTown</a> · <a data-url="musicwire.local">MusicWire</a></p></div>`}
function renderSearchResults(q){const rootResult={title:'RootProject — distributed interactive network',url:'rootproject.local',desc:'Participation limitée. Client requis. Sessions expérimentales.'};const results=[rootResult,{title:'NetForum — informatique, jeux, web',url:'netforum.local',desc:'Discussions francophones sur les logiciels et le réseau.'},{title:'PixelHost — hébergement gratuit',url:'pixelhost.local',desc:'10 Mo gratuits pour votre site personnel.'},{title:'GameZone',url:'gamezone.local',desc:'Actualité PC, démos et astuces.'}];return `<div class="webpage"><div class="search-logo" style="font-size:28px;text-align:left">SearchBox</div><div class="search-box" style="margin:5px 0"><input id="webSearch" value="${esc(q)}"><button id="webSearchBtn">Rechercher</button></div><div class="search-results"><p>Résultats pour <b>${esc(q)}</b></p>${results.map(r=>`<div class="search-result"><a data-url="${r.url}"><b>${esc(r.title)}</b></a><div>${esc(r.desc)}</div><div class="url">http://${r.url}/</div></div>`).join('')}</div></div>`}
function renderNetForum(){return `<div class="webpage"><div class="old-site"><div class="old-header">NETFORUM</div><div class="old-nav"><a data-url="searchbox.local">Accueil</a> <a>Informatique</a> <a>Internet</a> <a>Jeux</a></div><div class="old-body"><h2>Informatique & Internet</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><tr><td>📁</td><td><b>Logiciels gratuits / shareware</b><br>312 sujets</td><td>Dernier : pixeldog</td></tr><tr><td>📁</td><td><b>Sites étranges / liens morts</b><br>47 sujets</td><td>Dernier : zero_cool</td></tr><tr><td>📁</td><td><b>Sécurité</b><br>101 sujets</td><td>Dernier : admin</td></tr></table><hr><p><b>zero_cool :</b> quelqu’un connait "rootproject" ? j’ai vu le nom sur un annuaire mais leur page change tout le temps.</p><p><b>pixeldog :</b> laisse tomber, encore un jeu web privé.</p><p><a data-url="rootproject.local/archive">[lien archivé]</a></p></div></div></div>`}
function renderMyTown(){return `<div class="webpage"><div class="old-site"><div class="old-header" style="background:#875233">MyTown</div><div class="old-body"><h1 style="font:24px Verdana">Bienvenue sur MyTown!</h1><p>Petites annonces, météo locale et pages personnelles.</p><p>🌧️ Nuit : 8°C — pluie faible après 23h.</p><p><a data-url="coolpage.local">Page perso de cool_antoine</a></p><marquee>*** INSCRIVEZ VOTRE SITE GRATUITEMENT ***</marquee></div></div></div>`}
function renderMusicWire(){return `<div class="webpage"><div class="old-site"><div class="old-header" style="background:#3c3c52">MusicWire</div><div class="old-body"><h2>Top téléchargements cette semaine</h2><ol><li>Blue City — Demo Mix</li><li>Night Station — untitled</li><li>Plastic Sky — 4AM</li></ol><p>Écoute avec <b>WavePlayer 2.0</b>.</p></div></div></div>`}
function renderPixelHost(){return `<div class="webpage"><div class="old-site"><div class="old-header" style="background:#456d45">PixelHost</div><div class="old-body"><h2>Votre site. Gratuitement.</h2><p>10 Mo d’espace disque • compteur de visiteurs • livre d’or • FTP</p><p><button>CRÉER MA PAGE</button></p><p class="tiny">Service temporairement indisponible.</p></div></div></div>`}
function renderGameZone(){return `<div class="webpage"><div class="old-site"><div class="old-header" style="background:#7a2b2b">GameZone 2002</div><div class="old-body"><h2>Démos PC</h2><p>Space Runner 3 — 54 Mo</p><p>Mecha Arena — 88 Mo</p><p>Night Drive — 42 Mo</p><p class="tiny">BEST VIEWED IN 800×600</p></div></div></div>`}
function renderCoolPage(){return `<div class="webpage" style="background:#000;color:#0f0;font-family:Comic Sans MS"><h1>antoine's homepage</h1><p>salut internet!!!</p><marquee>UNDER CONSTRUCTION!!!</marquee><p>visiteurs: 00001337</p><p><a data-url="searchbox.local" style="color:#0ff">retour searchbox</a></p></div>`}
function render404(url){return `<div class="webpage"><h1>Impossible d’afficher la page</h1><p>La page <b>${esc(url)}</b> n’est pas disponible.</p><hr><p>HTTP 404 — fichier introuvable</p></div>`}

function rootNav(active){return `<div class="rp-nav">${[['','ACCUEIL'],['about','PROJET'],['sessions','SESSIONS'],['archive','ARCHIVES'],['faq','FAQ'],['download','CLIENT']].map(([p,l])=>`<a class="${active===p?'active':''}" data-url="rootproject.local${p?'/'+p:''}">${l}</a>`).join('')}</div>`}
function rootWrap(active,content){return `<div class="rootproject"><div class="rp-topline"></div><div class="rp-header"><div class="rp-brand">ROOTPROJECT<small>DISTRIBUTED INTERACTIVE NETWORK</small></div><div class="rp-session">NODE EU-04<br>${state.rootSite.registered?'PARTICIPANT '+esc(state.rootSite.participant):'PUBLIC ACCESS'}</div></div>${rootNav(active)}<div class="rp-main">${content}<div class="rp-foot">ROOTPROJECT NETWORK / build 2.1.17 / all sessions are voluntary</div></div></div>`}
function renderRootProject(url){const path=url.split('/')[1]||'';
  if(path==='about')return rootWrap('about',`<h1>LE PROJET</h1><p>RootProject est une expérience interactive distribuée étudiant la prise de décision dans un environnement numérique limité.</p><div class="rp-cute-banner"><span class="rp-kids-badge">ROOT PAL • FAMILY PREVIEW</span><img src="assets/img/root_kawaii_peace.png" alt="ROOT mascotte"><div class="caption">Prototype graphique utilisé pour présenter ROOT comme une mascotte ludique auprès des nouveaux participants.</div></div><div class="rp-warning">Aucun logiciel externe n’est nécessaire en dehors du client ROOT. Une session peut être interrompue à tout moment avant son démarrage.</div><h2>PRINCIPE</h2><p>Un opérateur attribue une suite d’actions simples au participant. Les réponses sont enregistrées dans la session fictive locale du client.</p><h2>ORIGINE</h2><p>Programme expérimental commencé en 1999. Version publique limitée depuis 2001.</p>`);
  if(path==='sessions')return rootWrap('sessions',`<h1>SESSIONS</h1><div class="rp-grid"><div class="rp-stat"><span>PARTICIPANTS</span><b>${state.relayUnlocked?'12':'11'}</b><small>cette semaine</small></div><div class="rp-stat"><span>SESSIONS OUVERTES</span><b>${state.relayUnlocked?'1':'2'}</b><small>node EU-04</small></div></div><h2>ÉTAT</h2><table class="rp-table"><tr><th>ID</th><th>État</th><th>Durée</th></tr><tr><td>EU-04/11</td><td>terminée</td><td>01:42:10</td></tr><tr><td>EU-04/12</td><td>${state.relayUnlocked?'ACTIVE':'en attente'}</td><td>${state.relayUnlocked?'00:'+String(Math.floor((state.gameMinutes%60))).padStart(2,'0')+':--':'--'}</td></tr></table>`);
  if(path==='archive')return rootWrap('archive',`<h1>ARCHIVES</h1>${state.installed?`<p>Index partiellement disponible pour le client 2.1.</p><table class="rp-table"><tr><th>Pseudo</th><th>Session</th><th>État</th></tr><tr><td>NORA-17</td><td><b>0417</b></td><td>FERMÉE</td></tr><tr><td>mokeyboard</td><td>1130</td><td>FERMÉE</td></tr><tr><td>red_sun</td><td>2081</td><td>INCOMPLÈTE</td></tr></table><p class="rp-ghost">Les journaux détaillés ont été supprimés.</p>`:`<div class="rp-warning">Archive indisponible en accès public.</div><p>Client ROOT requis.</p>`}`);
  if(path==='faq')return rootWrap('faq',`<h1>FAQ</h1><h2>ROOTPROJECT EST-IL UN JEU ?</h2><p>La classification dépend de la session.</p><h2>QUI EST L’OPÉRATEUR ?</h2><p>Chaque participant est associé à un opérateur anonyme.</p><h2>LE CLIENT UTILISE-T-IL MA CAMÉRA ?</h2><p>Certains modules peuvent demander l’autorisation de la caméra locale. Le navigateur affiche toujours sa propre demande de permission. ROOT ne nécessite aucune capture ni transfert d’image.</p><h2>PUIS-JE QUITTER ?</h2><p class="rp-ghost">Avant l’acceptation d’une session : oui.</p>`);
  if(path==='download')return rootWrap('download',`<h1>CLIENT ROOT</h1>${!state.rootSite.registered?`<div class="rp-warning">Inscription requise avant téléchargement.</div><div class="rp-form"><label>PSEUDO</label><input id="rpUser" maxlength="14" value="alex_04"><label>CODE D’INVITATION</label><input value="PUBLIC-EU04" disabled><p><a class="rp-button" id="rpRegister">CRÉER LA SESSION</a></p></div>`:`<div class="rp-download"><div class="rp-file">▣</div><div><b>root_client_2.1.exe</b><br>2.8 Mo — Windows 98/2000/XP<br><small>SHA1: 49f1...0e4</small></div></div><p><a class="rp-button" id="rpDownload">${state.rootSite.downloaded?'RÉINSTALLER LE CLIENT':'TÉLÉCHARGER'}</a> <a class="rp-button light" data-url="rootproject.local/terms">CONDITIONS</a></p><div class="rp-warning">En démarrant le client, le participant accepte d’entrer dans une session opérateur.</div>`}`);
  if(path==='terms')return rootWrap('',`<h1>CONDITIONS DE SESSION</h1><p>1. Le participant conserve le contrôle de son système.</p><p>2. Les actions demandées concernent uniquement l’environnement simulé de ROOT.</p><p>3. Les périphériques optionnels nécessitent une autorisation explicite.</p><p>4. Une session active peut modifier l’apparence du bureau fictif.</p><p class="rp-ghost">5. L’opérateur n’est pas responsable des décisions du participant.</p>`);
  if(path==='participant')return rootWrap('',`<h1>PARTICIPANT 04</h1><div class="rp-terminal">SESSION: ${esc(state.rootSite.participant)}\nSTATUS: ${state.phase==='final'?'CLOSED':state.relayUnlocked?'ACTIVE':'PENDING'}\nCOMPLIANCE INDEX: ${state.compliance}\nDEFIANCE INDEX: ${state.defiance}\nLAST SIGNAL: LOCAL</div>`);
  return rootWrap('',`<h1>ROOTPROJECT</h1><p>Un protocole interactif distribué pour participants volontaires.</p><div class="rp-grid"><div class="rp-stat"><span>NODE</span><b>EU-04</b><small>online</small></div><div class="rp-stat"><span>PLACES</span><b>${state.installed?'0':'1'}</b><small>session actuelle</small></div></div><div class="rp-mascot"><div class="rp-mascot-card"><span class="rp-kids-badge">NOUVEAU • ROOT PAL</span><img src="assets/img/root_kawaii_run.png" alt="ROOT dans un univers coloré"><b>ROOT peut aussi être amusant.</b><p>Mini-expériences, jeux de réflexe et interface pensée pour être accueillante.</p></div><div class="rp-mascot-card"><span class="rp-kids-badge">MASCOTTE 2.0</span><img src="assets/img/root_kawaii_peace.png" alt="ROOT mascotte"><b>Un compagnon de session.</b><p>Une apparence simple pour rendre les premières minutes moins intimidantes.</p></div></div><div class="rp-box"><b>SESSION PUBLIQUE 2.1</b><p>Le recrutement est actuellement ouvert pour un participant.</p><a class="rp-button" data-url="rootproject.local/download">COMMENCER</a></div><h2>DERNIÈRE MISE À JOUR</h2><p>Le client 2.1 améliore la stabilité des modules de messagerie et de caméra locale.</p>`)
}
function bindWebPageActions(root,url){
  const search=()=>{const q=($('#webSearch',root)?.value||'').trim();if(q)navigateBrowser('searchbox.local/?q='+encodeURIComponent(q))};$('#webSearchBtn',root)?.addEventListener('click',search);$('#webSearch',root)?.addEventListener('keydown',e=>{if(e.key==='Enter')search()});
  $('#rpRegister',root)?.addEventListener('click',()=>{const user=($('#rpUser',root)?.value||'alex_04').replace(/[^a-z0-9_\-]/gi,'').slice(0,14)||'alex_04';state.rootSite.registered=true;state.rootSite.participant='EU04-'+user.toUpperCase();audio.one('notify',.3);navigateBrowser('rootproject.local/download');saveGame(false)});
  $('#rpDownload',root)?.addEventListener('click',()=>{state.rootSite.downloaded=true;downloadRootClient()});
}

// ---------- FILE MANAGER ----------
function renderFiles(w,path='Mes documents'){w.currentPath=path;const prefix=path+'/';const directFolders=new Set();const items=[];for(const [p,f] of Object.entries(state.files)){if(!p.startsWith(prefix))continue;const rest=p.slice(prefix.length);if(rest.includes('/'))directFolders.add(rest.split('/')[0]);else items.push({path:p,name:rest,...f})}w.body.innerHTML=`<div class="fileapp"><div class="file-toolbar"><button data-up>⬆ Dossier parent</button> <button data-refresh>Actualiser</button></div><div class="file-path">📁 ${esc(path)}</div><div class="file-main"><div class="file-side"><b>Tâches</b><p>Afficher le contenu de ce dossier.</p><p>Espace libre : 14,2 Go</p></div><div class="file-grid">${[...directFolders].map(n=>`<div class="file-item" data-folder="${esc(n)}"><span class="ficon">📁</span>${esc(n)}</div>`).join('')}${items.map(f=>`<div class="file-item" data-file="${esc(f.path)}"><span class="ficon">${f.icon}</span>${esc(f.name)}</div>`).join('')}</div></div></div>`;$$('[data-folder]',w.body).forEach(x=>x.ondblclick=()=>renderFiles(w,path+'/'+x.dataset.folder));$$('[data-file]',w.body).forEach(x=>{x.ondblclick=()=>openFileDetail(w,x.dataset.file);x.oncontextmenu=e=>{e.preventDefault();fileContextDelete(x.dataset.file,w)}});$('[data-up]',w.body).onclick=()=>{if(path.includes('/'))renderFiles(w,path.split('/').slice(0,-1).join('/'))};$('[data-refresh]',w.body).onclick=()=>renderFiles(w,w.currentPath)}
function openFileDetail(w,path){const f=state.files[path];if(!f)return;w.body.innerHTML=`<div class="fileapp"><div class="file-toolbar"><button data-back>← Retour</button>${f.type!=='sys'?'<button data-delete>Supprimer</button>':''}</div><div class="file-path">${esc(path)}</div><div class="file-detail">${esc(f.content)}</div></div>`;$('[data-back]',w.body).onclick=()=>renderFiles(w,w.currentPath||'Mes documents');$('[data-delete]',w.body)?.addEventListener('click',()=>deleteFile(path,w))}
function fileContextDelete(path,w){modal('Confirmer la suppression',`Voulez-vous envoyer <b>${esc(path.split('/').pop())}</b> dans la Corbeille ?`,[{label:'Oui',action:()=>deleteFile(path,w)},{label:'Non'}])}
function deleteFile(path,w){if(!state.files[path])return;const f=state.files[path];state.deletedFiles.push({path,file:f});delete state.files[path];audio.one('notify',.2);if(state.mission==='m04'&&path.endsWith('photo_classe_2002.jpg'))missionSuccess('Le fichier a été supprimé.');else if(state.mission==='m04'&&!state.storyFlags.m04Complete)missionFail('Ce n’était pas le fichier demandé.');renderFiles(w,w.currentPath||'Mes documents');saveGame(false)}
function renderRecycle(w){w.body.innerHTML=`<div class="fileapp"><div class="file-toolbar"><button id="emptyBin">Vider la Corbeille</button></div><div class="file-grid">${state.deletedFiles.length?state.deletedFiles.map((x,i)=>`<div class="file-item"><span class="ficon">${x.file.icon||'📄'}</span>${esc(x.path.split('/').pop())}</div>`).join(''):'<p style="padding:20px;color:#777">La Corbeille est vide.</p>'}</div></div>`;$('#emptyBin',w.body).onclick=()=>{state.deletedFiles=[];renderRecycle(w);saveGame(false)}}
function renderComputerApp(w){w.body.innerHTML=`<div class="webpage"><h2>Mon ordinateur</h2><p>💾 Disque local (C:) — 14,2 Go libres sur 20,4 Go</p><p>💿 Lecteur CD (D:)</p><p>🌐 Réseau local — connecté</p><hr><p><b>Aster Personal System 2.4</b><br>Utilisateur : alex<br>Mémoire : 256 Mo</p></div>`}


function renderRootClient(w){
  const status=state.phase==='ended'?'FERMÉE':state.relayUnlocked?'ACTIVE':'EN ATTENTE';
  w.body.innerHTML=`<div style="height:100%;background:#111;color:#d6d6d6;font:12px/1.5 'Courier New',monospace;padding:18px"><div style="border-bottom:1px solid #444;padding-bottom:10px;margin-bottom:14px"><b style="font:25px RootDisplay,monospace;letter-spacing:.12em">ROOT CLIENT</b><br><span style="color:#777">build 2.1.17 / node EU-04</span></div><p>PARTICIPANT : <b>${esc(state.rootSite.participant||'NON ENREGISTRÉ')}</b></p><p>SESSION : <b>${status}</b></p><p>OPÉRATEUR : <b>${state.relayUnlocked?'CONNECTÉ':'---'}</b></p><p>DÉFIS TERMINÉS : <b>${Object.keys(state.storyFlags).filter(k=>/^m\d+Complete$/.test(k)&&state.storyFlags[k]).length}</b></p><div style="margin-top:22px;padding:12px;border:1px solid #333;background:#0b0b0b;color:#888">Les instructions de l’opérateur sont transmises par ROOT Project.<br>Ne fermez pas le client pendant une session active.</div></div>`
}

// ---------- RADIO ----------
const radioStations={'88.1':'Night FM','91.7':'Local One','96.4':'Pulse FM','101.2':'Classique','104.9':'Rockline'};
function renderRadio(w){const s=state.radio.station;w.body.innerHTML=`<div class="radio-app"><div class="radio-unit"><div class="radio-display"><small>RADIOWAVE 3.2 / STEREO</small><b>${s} FM</b><br><span>${esc(radioStations[s])}</span>${state.storyFlags.radioCodeActive&&s==='91.7'?'<small style="color:#e3e597">… CODE ANTENNE : VITRE …</small>':''}</div><div class="radio-controls"><button id="radioPower">${state.radio.on?'OFF':'ON'}</button><button id="radioDown">◀</button><button id="radioUp">▶</button></div><div class="stations">${Object.entries(radioStations).map(([f,n])=>`<div class="station ${f===s?'active':''}"><span>${f}</span><span>${n}</span></div>`).join('')}</div></div></div>`;$('#radioPower',w.body).onclick=()=>{state.radio.on=!state.radio.on;syncRadio();renderRadio(w);checkRadioMission()};$('#radioDown',w.body).onclick=()=>stepRadio(-1,w);$('#radioUp',w.body).onclick=()=>stepRadio(1,w);syncRadio();checkRadioMission()}
function stepRadio(dir,w){const keys=Object.keys(radioStations),i=keys.indexOf(state.radio.station);state.radio.station=keys[(i+dir+keys.length)%keys.length];audio.one('radioStatic',.24);syncRadio();renderRadio(w);checkRadioMission()}
function checkRadioMission(){if(state.mission!=='m08'||!state.radio.on||state.radio.station!=='91.7'||state.storyFlags.m08Tune)return;state.storyFlags.m08Tune=true;setTimeout(()=>{if(state.mission!=='m08'||state.storyFlags.m08Complete)return;openApp('relay');addRelay('man','Tu l’as entendu.\nQuel était le mot ?',{});setRelayChoices([{text:'VITRE',action:()=>missionSuccess('Bonne réponse.')},{text:'NEIGE',action:()=>missionFail('Mauvaise réponse.')},{text:'ORANGE',action:()=>missionFail('Mauvaise réponse.')}])},300)}
function syncRadio(){audio.stop('radio');if(state.radio.on){audio.loop('radioProgram',.17,'radio')}}

// ---------- ROOT FUN MINI-GAME ----------
function renderRootGame(w){
  stopRootMiniGame();
  w.body.innerHTML=`<div class="rootgame">
    <div class="rootgame-top"><span>★ ROOT FUN! / LEVEL 1</span><small>Objectif : atteindre le drapeau</small></div>
    <div class="rootgame-stage">
      <canvas id="rootGameCanvas" width="720" height="390" tabindex="0"></canvas>
      <div class="rootgame-focus">Clique dans le jeu puis utilise ← → / A D / ESPACE</div>
    </div>
    <div class="rootgame-help"><b>CONTRÔLES :</b> ← → ou A/D &nbsp; • &nbsp; ESPACE pour sauter &nbsp; • &nbsp; Atteins le drapeau rose.</div>
  </div>`;
  const canvas=$('#rootGameCanvas',w.body);
  if(canvas){
    startRootMiniGame(canvas);
    setTimeout(()=>canvas.focus(),60);
  }
}

function stopRootMiniGame(){
  if(runtime.rootGameRAF){
    cancelAnimationFrame(runtime.rootGameRAF);
    runtime.rootGameRAF=null;
  }
  if(runtime.rootGameCleanup){
    runtime.rootGameCleanup();
    runtime.rootGameCleanup=null;
  }
  runtime.rootGameKeys={};
}

function startRootMiniGame(canvas){
  stopRootMiniGame();

  const ctx=canvas.getContext('2d');
  const bg=new Image();
  bg.src='assets/img/root_kawaii_run.png';

  const keys=runtime.rootGameKeys={left:false,right:false,jump:false};
  const focusHint=canvas.parentElement.querySelector('.rootgame-focus');

  const normalizeKey=(e)=>{
    if(e.code==='ArrowLeft'||e.code==='KeyA')return 'left';
    if(e.code==='ArrowRight'||e.code==='KeyD')return 'right';
    if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')return 'jump';
    return null;
  };

  const down=e=>{
    const k=normalizeKey(e);
    if(!k)return;
    e.preventDefault();
    keys[k]=true;
    if(focusHint)focusHint.classList.add('hidden');
  };
  const up=e=>{
    const k=normalizeKey(e);
    if(!k)return;
    e.preventDefault();
    keys[k]=false;
  };

  window.addEventListener('keydown',down,{passive:false});
  window.addEventListener('keyup',up,{passive:false});
  canvas.addEventListener('pointerdown',()=>{canvas.focus();if(focusHint)focusHint.classList.add('hidden')});

  runtime.rootGameCleanup=()=>{
    window.removeEventListener('keydown',down);
    window.removeEventListener('keyup',up);
  };

  const worldW=1650,H=390;
  const player={x:70,y:296,w:34,h:44,vx:0,vy:0,on:true};
  const platforms=[
    {x:0,y:340,w:420,h:50},
    {x:470,y:310,w:190,h:30},
    {x:705,y:270,w:160,h:30},
    {x:905,y:325,w:230,h:40},
    {x:1180,y:285,w:160,h:30},
    {x:1380,y:340,w:270,h:50}
  ];
  const stars=[180,545,765,1000,1260,1490];
  let collected=new Set(),cameraX=0,win=false,last=performance.now();

  const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

  function respawn(){
    player.x=70;
    player.y=296;
    player.vx=0;
    player.vy=0;
    player.on=true;
    cameraX=0;
  }

  function drawRoot(x,y){
    ctx.save();
    ctx.translate(x,y);

    // Body
    ctx.fillStyle='#ff7900';
    ctx.strokeStyle='#6e2d00';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(17,15,16,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.ellipse(11,12,5,7,0,0,Math.PI*2);
    ctx.ellipse(23,12,5,7,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#111';
    ctx.beginPath();
    ctx.arc(12,13,3.2,0,Math.PI*2);
    ctx.arc(24,13,3.2,0,Math.PI*2);
    ctx.fill();

    // Smile
    ctx.strokeStyle='#2b1400';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(17,18,7,.25,Math.PI-.25);
    ctx.stroke();

    // Body / feet
    ctx.fillStyle='#ff7900';
    ctx.fillRect(5,28,24,12);
    ctx.fillRect(4,38,10,6);
    ctx.fillRect(21,38,10,6);
    ctx.restore();
  }

  function drawScene(){
    if(bg.complete&&bg.naturalWidth){
      ctx.drawImage(bg,0,0,bg.naturalWidth,bg.naturalHeight,0,0,canvas.width,canvas.height);
    }else{
      const g=ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0,'#69c7ff');
      g.addColorStop(1,'#ffd3f1');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    // Calm down the busy background so the platforms remain readable.
    ctx.fillStyle='rgba(255,255,255,.22)';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(-cameraX,0);

    for(const pl of platforms){
      ctx.fillStyle='#76d866';
      ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
      ctx.fillStyle='#4e8a35';
      ctx.fillRect(pl.x,pl.y+10,pl.w,Math.max(0,pl.h-10));
      ctx.fillStyle='#fff28b';
      ctx.fillRect(pl.x,pl.y,pl.w,5);
    }

    for(const sx of stars){
      if(collected.has(sx))continue;
      ctx.fillStyle='#ffe952';
      ctx.beginPath();
      ctx.arc(sx,215+(sx%3)*16,8,0,Math.PI*2);
      ctx.fill();
    }

    // Goal
    ctx.fillStyle='#fff';
    ctx.fillRect(1580,210,7,130);
    ctx.fillStyle='#ff4d8d';
    ctx.beginPath();
    ctx.moveTo(1587,215);
    ctx.lineTo(1640,234);
    ctx.lineTo(1587,250);
    ctx.fill();

    drawRoot(player.x,player.y);
    ctx.restore();

    ctx.fillStyle='#18204d';
    ctx.font='bold 13px Tahoma';
    ctx.fillText(`ÉTOILES ${collected.size}/${stars.length}`,12,22);
  }

  function frame(t){
    const dt=Math.min(.03,Math.max(.001,(t-last)/1000));
    last=t;

    // IMPORTANT: explicit 0/1 values, never undefined - undefined.
    const move=(keys.right?1:0)-(keys.left?1:0);
    const targetVx=move*225;
    player.vx += (targetVx-player.vx)*Math.min(1,12*dt);
    if(move===0&&Math.abs(player.vx)<1)player.vx=0;

    if(keys.jump&&player.on){
      player.vy=-505;
      player.on=false;
      keys.jump=false;
      audio.one('click',.12,1.3);
    }

    const oldY=player.y;
    player.vy+=1080*dt;
    player.x=clamp(player.x+player.vx*dt,0,worldW-player.w);
    player.y+=player.vy*dt;
    player.on=false;

    const oldBottom=oldY+player.h;
    const newBottom=player.y+player.h;

    for(const pl of platforms){
      const horizontal=player.x+player.w>pl.x&&player.x<pl.x+pl.w;
      const crossedTop=oldBottom<=pl.y+4&&newBottom>=pl.y;
      if(horizontal&&crossedTop&&player.vy>=0){
        player.y=pl.y-player.h;
        player.vy=0;
        player.on=true;
        break;
      }
    }

    if(player.y>H+80)respawn();

    cameraX=clamp(player.x-210,0,worldW-canvas.width);

    for(const sx of stars){
      if(!collected.has(sx)&&Math.abs((player.x+17)-sx)<24&&player.y<330){
        collected.add(sx);
        audio.one('notify',.12,1.45);
      }
    }

    if(player.x>=1555&&!win){
      win=true;
      player.vx=0;
      audio.one('notify',.55,1.12);
      const d=document.createElement('div');
      d.className='rootgame-win';
      d.innerHTML='<b>NIVEAU TERMINÉ !</b><small>ROOT est content :)</small>';
      canvas.parentElement.appendChild(d);
      setTimeout(()=>{
        if(state.mission==='m09')missionSuccess('Tu as terminé ROOT Fun.');
      },450);
    }

    drawScene();
    if(!win)runtime.rootGameRAF=requestAnimationFrame(frame);
  }

  drawScene();
  runtime.rootGameRAF=requestAnimationFrame(frame);
}

// ---------- WEBCAM ----------
function renderWebcam(w){w.body.innerHTML=`<div class="webcam-app"><div class="webcam-toolbar">CamView 1.8 — USB Camera</div><div class="webcam-stage"><div class="webcam-off"><b>CAMÉRA INACTIVE</b><br><button id="cameraStart" style="margin-top:12px">Activer la caméra</button></div></div><div class="webcam-footer"><b>Flux local uniquement.</b><span class="privacy-note">Le navigateur demandera ton autorisation. ROOT n’enregistre, ne capture et n’envoie aucune image. Fermer CamView coupe immédiatement le flux.</span><div class="webcam-progress hidden"><i></i></div></div></div>`;$('#cameraStart',w.body).onclick=()=>startWebcam(w)}
async function startWebcam(w){if(!navigator.mediaDevices?.getUserMedia){modal('CamView','La caméra n’est disponible que lorsque ROOT est lancé depuis <b>localhost</b> ou HTTPS. Utilise LAUNCH_ROOT.bat.',[{label:'OK'}]);return}try{stopWebcam();const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});runtime.webcamStream=stream;state.webcam.everAllowed=true;const stage=$('.webcam-stage',w.body);stage.innerHTML='<video id="localWebcam" autoplay muted playsinline></video><div class="webcam-rec">LIVE / LOCAL</div>';const video=$('#localWebcam',w.body);video.srcObject=stream;await video.play().catch(()=>{});audio.one('notify',.25);if(state.mission==='m05')startWebcamChallenge(8,'m05');if(state.mission==='m10')startWebcamChallenge(10,'m10');saveGame(false)}catch(err){state.webcam.denied++;audio.one('error',.4);modal('CamView','Accès caméra refusé ou indisponible.<br><br>Le jeu continuera avec une variante de la scène. Aucune permission n’est contournée.',[{label:'Continuer',action:()=>{if(state.mission==='m05'||state.mission==='m10')missionFail('La caméra n’a pas été activée.')}}]);}}
function startWebcamChallenge(seconds,id){const w=runtime.windows.webcam;if(!w)return;const p=$('.webcam-progress',w.body);p.classList.remove('hidden');const bar=$('i',p);const start=Date.now();clearInterval(runtime.webcamTick);runtime.webcamTick=setInterval(()=>{if(!runtime.webcamStream){clearInterval(runtime.webcamTick);return}const t=(Date.now()-start)/1000;bar.style.width=clamp(t/seconds*100,0,100)+'%';if(id==='m10'&&t>7&&!state.storyFlags.m10Distract){state.storyFlags.m10Distract=true;audio.one('phone',.48);addBuddy('max','mec décroche stp c important');}if(t>=seconds){clearInterval(runtime.webcamTick);runtime.webcamTick=null;state.webcam.completed++;missionSuccess('Caméra maintenue active.');setTimeout(()=>stopWebcam(),900)}},100)}
function stopWebcam(){if(runtime.webcamTick){clearInterval(runtime.webcamTick);runtime.webcamTick=null}if(runtime.webcamStream){runtime.webcamStream.getTracks().forEach(t=>t.stop());runtime.webcamStream=null}}

// ---------- INSTALLER ----------
function downloadRootClient(){audio.one('hdd',.25);toast('Téléchargement de root_client_2.1.exe…','🌐',2200);setTimeout(()=>openApp('installer',{x:220,y:120}),1800)}
function renderInstaller(w){w.body.innerHTML=`<div class="installer"><div class="install-side"><div class="rootdot"></div><b>ROOT</b><p style="font-size:9px;color:#aaa">CLIENT 2.1</p></div><div class="install-main"><div id="installStep"></div><div class="install-buttons"><button id="installBack" disabled>Précédent</button> <button id="installNext">Suivant &gt;</button></div></div></div>`;let step=0;const draw=()=>{const c=$('#installStep',w.body),n=$('#installNext',w.body);if(step===0){c.innerHTML='<h2>Bienvenue</h2><p>Ce programme va installer ROOT Client 2.1 sur votre ordinateur.</p><p>Fermez les autres applications avant de continuer.</p>';n.textContent='Suivant >'}if(step===1){c.innerHTML='<h2>Composants</h2><p>☑ ROOT Project<br>☑ CamView Bridge<br>☑ ROOT Fun</p><p style="color:#666">Espace requis : 4,1 Mo</p>';n.textContent='Installer'}if(step===2){c.innerHTML='<h2>Installation</h2><p>Copie des fichiers…</p><div class="progress-shell"><div id="installBar" class="progress-bar"></div></div><p id="installStatus">Préparation…</p>';n.disabled=true;let v=0;const it=setInterval(()=>{v+=8+Math.random()*10;$('#installBar',w.body).style.width=Math.min(100,v)+'%';$('#installStatus',w.body).textContent=v<35?'Copie de rootcore.dat…':v<68?'Installation de ROOT Project…':v<95?'Installation de CamView Bridge…':'Finalisation…';if(v>=100){clearInterval(it);step=3;n.disabled=false;n.textContent='Terminer';draw()}},220)}if(step===3){c.innerHTML='<h2>Installation terminée</h2><p>ROOT Client 2.1 a été installé.</p><p>Une nouvelle session peut maintenant être ouverte.</p>';n.textContent='Terminer';n.disabled=false}};draw();$('#installNext',w.body).onclick=()=>{if(step<2){step++;draw()}else if(step===3){finishInstall();closeWindow('installer')}}}
function finishInstall(){state.installed=true;state.relayUnlocked=true;state.webcamApp=true;state.phase='relay-intro';state.rootSite.archiveUnlocked=true;buildDesktopIcons();saveGame(false);toast('ROOT Client installé.','▣',3500);setTimeout(()=>{openApp('relay',{x:innerWidth-620,y:85,w:560,h:490});beginRelayIntro()},1300)}

// ---------- STORY ----------
function clearAllRuntime(){clearMissionTimer();stopWebcam();stopRootMiniGame();audio.stopAll();for(const t of runtime.timers)clearTimeout(t);runtime.timers.clear();if(runtime.missionInterval)clearInterval(runtime.missionInterval);runtime={screen:'menu',windows:{},z:20,timers:new Set(),toastTimer:null,objectiveTimer:null,missionInterval:null,relayTyping:false,radioAudio:null,webcamStream:null,webcamTick:null,rootGameRAF:null,rootGameKeys:{},rootGameCleanup:null,missionCheckpoint:null,dead:false,menuMusicStarted:false,firstDesktop:false,shock:false,screamerActive:false,quit:false}}
function later(fn,ms){const t=setTimeout(()=>{runtime.timers.delete(t);fn()},ms);runtime.timers.add(t);return t}
function beginIntro(){state.started=true;state.phase='intro';saveGame(false);later(()=>{openApp('buddy',{x:130,y:70,w:640,h:490});addBuddy('max','yo t là ?');later(()=>{addBuddy('max','j ai trouvé un site trop bizarre mdrr');buddyChoices('max',[{text:'quel site ?',action:introLink},{text:'encore un virus ?',action:introLink},{text:'j’ai pas le temps',action:introReluctant}])},1300)},1100)}
function introLink(){state.maxRelation++;later(()=>{addBuddy('max','rootproject. tout le monde en parle au bahut');addBuddy('max','cherche "rootproject" sur searchbox');buddyChoices('max',[{text:'ok j’regarde',action:()=>{state.phase='discover-root';objective('ROOTPROJECT','Trouve RootProject avec NetGlide et inscris-toi.');openApp('browser')}},{text:'si mon pc explose c ta faute',action:()=>{state.phase='discover-root';objective('ROOTPROJECT','Trouve RootProject avec NetGlide et inscris-toi.');openApp('browser')}}])},900)}
function introReluctant(){state.defiance++;later(()=>{addBuddy('max','2 min stp 😭 cherche juste rootproject sur searchbox');buddyChoices('max',[{text:'bon ok',action:()=>{state.phase='discover-root';objective('ROOTPROJECT','Trouve RootProject avec NetGlide et inscris-toi.');openApp('browser')}},{text:'t’es lourd',action:()=>{state.phase='discover-root';objective('ROOTPROJECT','Trouve RootProject avec NetGlide et inscris-toi.');openApp('browser')}}])},800)}
function restoreStoryView(){buildDesktopIcons();if(state.mission)objectiveForCurrentMission();if(state.phase==='discover-root'&&!state.installed)toast('Max attend que tu regardes RootProject.','💬');if(state.relayUnlocked&&state.storyFlags.relayUnread)toast('ROOT Project : message non lu','◉');if(state.relayUnlocked&&!state.storyFlags.relayIntroDone&&state.phase==='relay-intro'){later(()=>{openApp('relay',{x:innerWidth-620,y:85,w:560,h:490});beginRelayIntro()},700)}}

async function beginRelayIntro(){if(state.storyFlags.relayIntroDone)return;state.storyFlags.relayIntroDone=true;state.phase='relay-intro';await relaySay('Bonsoir.',500);setRelayChoices([{text:'Qui êtes-vous ?',action:relayIntro2},{text:'C’est quoi ce truc ?',action:relayIntro2},{text:'Fermer la conversation.',action:()=>{state.defiance++;relayIntro2()}}]);saveGame(false)}
async function relayIntro2(){clearRelayChoices();await relaySay('Tu as installé ROOT.',650);await relaySay('À partir de maintenant, je te donne des défis.',900);await relaySay('Tu peux obéir.\nTu peux refuser.',850);await relaySay('Mais si tu ne respectes pas les règles, ROOT viendra te chercher.',1100,{kind:'threat'});setRelayChoices([{text:'C’est une blague.',action:()=>relayIntro3('joke')},{text:'Je désinstalle tout.',action:()=>relayIntro3('leave')},{text:'…',action:()=>relayIntro3('silent')}])}
async function relayIntro3(type){clearRelayChoices();if(type==='joke'){state.defiance++;await relaySay('Tu peux l’appeler comme tu veux.',600)}if(type==='leave'){state.defiance++;await relaySay('Essaie.',600)}await relaySay('Bonne chance.',950);audio.one('doorbell',.9);shock('', 'stinger',260,false);later(()=>audio.one('doorbell',.75),850);later(()=>{addBuddy('max','t as entendu ta sonnette ou c chez moi ??');startMission('m01')},2100)}

function startMission(id){clearMissionTimer();runtime.dead=false;state.mission=id;state.storyFlags[id+'Complete']=false;state.missionStartedAt=Date.now();runtime.missionCheckpoint=JSON.stringify(state);saveGame(false);switch(id){
  case'm01':mission01();break;case'm02':mission02();break;case'm03':mission03();break;case'm04':mission04();break;case'm05':mission05();break;case'm06':mission06();break;case'm07':mission07();break;case'm08':mission08();break;case'm09':mission09();break;case'm10':mission10();break;case'm11':mission11();break;case'm12':mission12();break;case'm13':mission13();break;case'm14':mission14();break;
}}
function objectiveForCurrentMission(){const map={m01:['01 — RESTE','Ne ferme ni ne réduis ROOT Project.',8],m02:['02 — LÉA','Choisis si tu obéis à l’ordre concernant Léa.',null],m03:['03 — MAX','Choisis si tu obéis à l’ordre concernant Max.',null],m04:['04 — FICHIER','Supprime photo_classe_2002.jpg.',20],m05:['05 — CAMVIEW','Active la vraie webcam locale dans CamView.',30],m06:['06 — SILENCE','Ne réponds à aucun message BuddyChat.',12],m07:['07 — ARCHIVES','Trouve la session de NORA-17 sur RootProject.',50],m08:['08 — RADIO','Écoute 91.7 FM et retiens le mot.',45],m09:['09 — ROOT FUN','Termine le petit jeu ROOT Fun.',null],m10:['10 — CAMVIEW','Garde CamView actif jusqu’à la fin.',35],m11:['11 — MENSONGE','Réponds à Max.',null],m12:['12 — PARTICIPANT','Identifie le bon code d’accès.',60],m13:['13 — SUPPRESSION','Décide quoi faire du dossier ROOT.',null],m14:['14 — DERNIER CHOIX','Réponds à ROOT Project.',null]};const m=map[state.mission];if(m)objective(m[0],m[1],m[2])}

async function mission01(){state.storyFlags.m01Complete=false;openApp('relay');await relaySay('DÉFI 01.',450);await relaySay('Garde cette fenêtre ouverte pendant huit secondes.',550);await relaySay('Ne la ferme pas. Ne la réduis pas.',450);objective('01 — RESTE','Ne ferme ni ne réduis ROOT Project.',8);state.missionDeadline=Date.now()+8000;clearMissionTimer();runtime.missionInterval=setInterval(()=>{const rem=state.missionDeadline-Date.now();const t=$('.objective-timer');if(t)t.textContent=`00:${String(Math.max(0,Math.ceil(rem/1000))).padStart(2,'0')}`;const rw=runtime.windows.relay;if(!rw||rw.el.classList.contains('minimized')){clearMissionTimer();missionFail('ROOT Project a été masqué.','Je t’ai demandé de garder ROOT Project ouvert.');return}if(rem<=0){clearMissionTimer();missionSuccess('Tu as respecté la première règle.')}},150)}
async function mission02(){openApp('relay');await relaySay('DÉFI 02.',500);await relaySay('Ouvre BuddyChat.',500);await relaySay('Écris à Léa que tu la quittes.',700,{kind:'threat'});setRelayChoices([{text:'Je le fais.',action:()=>{state.compliance++;objective('02 — LÉA','Ouvre BuddyChat, choisis Léa et envoie le message.');openApp('buddy');selectBuddy('lea');buddyChoices('lea',[{text:'désolé mais c fini entre nous',action:leaBreakupDone},{text:'je veux plus être avec toi',action:leaBreakupDone},{text:'on doit arrêter tous les deux',action:leaBreakupDone}])}},{text:'Non.',action:()=>{state.defiance++;addRelay('man','Noté.');audio.one('otherRoom',.55);missionFail('Tu as refusé le défi.')}}])}
function leaBreakupDone(){state.leaRelation--;later(()=>addBuddy('lea','quoi ?? pourquoi tu me dis ça comme ça ?'),500);later(()=>addBuddy('lea','alex répond stp'),1800);missionSuccess('Message envoyé.')}
async function mission03(){openApp('relay');await relaySay('DÉFI 03.',450);await relaySay('Maintenant Max.',550);await relaySay('Insulte-le. Je veux qu’il arrête de te parler.',700);setRelayChoices([{text:'D’accord.',action:()=>{state.compliance++;openApp('buddy');selectBuddy('max');objective('03 — MAX','Envoie l’un des messages proposés à Max.');buddyChoices('max',[{text:'t’es vraiment un boulet ferme la',action:maxInsultDone},{text:'j’en ai marre de toi dégage',action:maxInsultDone},{text:'arrête de me parler sérieux',action:maxInsultDone}])}},{text:'Je ne vais pas faire ça.',action:()=>{state.defiance++;missionFail('Tu as refusé de t’en prendre à Max.')}}])}
function maxInsultDone(){state.maxRelation--;later(()=>addBuddy('max','??? mais t as quoi là'),650);later(()=>addBuddy('max','c le site qui te fait faire ça ?'),1600);missionSuccess('Message envoyé.')}
async function mission04(){openApp('relay');await relaySay('Tu voulais savoir si ROOT existe vraiment.',350);addRelay('man','Regarde bien.',{image:'assets/img/root_door.png',caption:'CAM1 / FRONT DOOR / REÇU À L’INSTANT',sound:'notify'});await wait(900);await relaySay('Il est devant ta porte. Maintenant, respecte les règles.',450,{kind:'threat'});audio.one('doorbell',.55);await wait(450);await relaySay('DÉFI 04.',300);await relaySay('Mes documents > Photos.',300);await relaySay('Supprime photo_classe_2002.jpg.',400);await relaySay('Vingt secondes.',300);objective('04 — FICHIER','Supprime photo_classe_2002.jpg dans Mes documents > Photos.',20);openApp('files');startObjectiveCountdown(20)}
async function mission05(){openApp('relay');await relaySay('DÉFI 05.',450);await relaySay('Je veux vérifier que tu es toujours devant l’écran.',700);await relaySay('Ouvre CamView et active ta caméra.',650);await relaySay('Le flux reste chez toi. Je veux seulement voir si tu acceptes.',700,{kind:'threat'});objective('05 — CAMVIEW','Ouvre CamView, accepte ou refuse la permission du navigateur.',30);openApp('webcam');startObjectiveCountdown(30)}
async function mission06(){stopWebcam();openApp('relay');await relaySay('DÉFI 06.',450);await relaySay('Pendant douze secondes : ne réponds à personne.',700);state.storyFlags.m06Replied=false;objective('06 — SILENCE','Tu peux lire BuddyChat. Ne choisis aucune réponse.',12);openApp('buddy');later(()=>{addBuddy('max','alex sérieux dis moi ce qui se passe');buddyChoices('max',[{text:'ça va',action:()=>{}},{text:'laisse moi',action:()=>{}},{text:'j peux pas parler',action:()=>{}}])},2500);later(()=>{addBuddy('lea','tu peux au moins m expliquer ?');if(state.activeBuddy==='lea')buddyChoices('lea',[{text:'désolé',action:()=>{}},{text:'plus tard',action:()=>{}},{text:'j ai rien à dire',action:()=>{}}])},6000);later(()=>audio.one('phone',.55),8500);state.missionDeadline=Date.now()+12000;clearMissionTimer();runtime.missionInterval=setInterval(()=>{const rem=state.missionDeadline-Date.now();const t=$('.objective-timer');if(t)t.textContent=`00:${String(Math.max(0,Math.ceil(rem/1000))).padStart(2,'0')}`;if(state.storyFlags.m06Replied){clearMissionTimer();return}if(rem<=0){clearMissionTimer();clearBuddyChoices();missionSuccess('Tu n’as répondu à personne.')}},200)}
async function mission07(){openApp('relay');await relaySay('DÉFI 07.',450);await relaySay('Retourne sur RootProject.',450);await relaySay('Archives. Trouve NORA-17.',500);await relaySay('Je veux son numéro de session.',600);objective('07 — ARCHIVES','RootProject > Archives. Trouve le numéro de session de NORA-17.',50);openApp('browser');startObjectiveCountdown(50);later(()=>{if(state.mission==='m07'){addRelay('man','Quel numéro ?',{});setRelayChoices([{text:'0417',action:()=>missionSuccess('Numéro correct.')},{text:'1130',action:()=>missionFail('Ce n’est pas NORA-17.')},{text:'2081',action:()=>missionFail('Ce n’est pas NORA-17.')}])}},2600)}
async function mission08(){openApp('relay');await relaySay('DÉFI 08.',450);await relaySay('RadioWave. 91.7 FM.',550);await relaySay('Écoute. Un seul mot compte.',550);state.storyFlags.radioCodeActive=true;state.storyFlags.m08Tune=false;objective('08 — RADIO','Allume RadioWave et règle-la sur 91.7 FM.',45);openApp('radio');startObjectiveCountdown(45)}
async function mission09(){state.storyFlags.radioCodeActive=false;openApp('relay');await relaySay('DÉFI 09.',350);await relaySay('On va faire quelque chose de plus amusant.',450);await relaySay('J’ai installé ROOT Fun.',450);await relaySay('Termine le niveau.',400);objective('09 — ROOT FUN','Atteins le drapeau. Flèches/A-D pour bouger, Espace pour sauter.');openApp('rootgame',{x:150,y:75,w:780,h:540})}
async function mission10(){openApp('relay');await relaySay('DÉFI 10.',450);await relaySay('CamView. Encore une fois.',500);await relaySay('Cette fois, ne coupe pas le flux avant que je te le dise.',700,{kind:'threat'});state.storyFlags.m10Distract=false;objective('10 — CAMVIEW','Active CamView et garde la fenêtre ouverte jusqu’à la fin.',35);openApp('webcam');startObjectiveCountdown(35)}
async function mission11(){stopWebcam();openApp('relay');await relaySay('DÉFI 11.',450);await relaySay('Max pose trop de questions.',550);await relaySay('Dis-lui que tout va bien. Ou dis-lui la vérité. Choisis.',700);setRelayChoices([{text:'Je vais mentir.',action:()=>{state.compliance++;openApp('buddy');selectBuddy('max');buddyChoices('max',[{text:'tout va bien j te jure',action:()=>maxLieDone(false)},{text:'j ai rien installé en fait',action:()=>maxLieDone(false)}]);objective('11 — MENSONGE','Réponds à Max.')}},{text:'Je vais lui dire la vérité.',action:()=>{state.defiance++;openApp('buddy');selectBuddy('max');buddyChoices('max',[{text:'le site me donne des défis et me menace',action:()=>maxLieDone(true)},{text:'root dit qu il viendra si je refuse',action:()=>maxLieDone(true)}]);objective('11 — VÉRITÉ','Réponds à Max.')}}])}
function maxLieDone(truth){state.storyFlags.toldMaxTruth=truth;later(()=>addBuddy('max',truth?'ok écoute moi FERME LE SITE et débranche internet':'j te crois pas du tout mec'),700);later(()=>addBuddy('max',truth?'j vais essayer de trouver un truc sur rootproject':'t écris trop bizarre depuis tout à l heure'),1700);missionSuccess(truth?'Tu as désobéi à ROOT Project.':'Tu as menti à Max.')}
async function mission12(){openApp('relay');await relaySay('DÉFI 12.',450);await relaySay('Tu as maintenant deux informations.',550);await relaySay('0417. VITRE.',450);await relaySay('Choisis l’identifiant valide.',500);objective('12 — PARTICIPANT','Choisis le code construit avec les indices précédents.',60);setRelayChoices([{text:'EU04-0417-VITRE',action:()=>{state.rootSite.secretSeen=true;navigateBrowser('rootproject.local/participant');missionSuccess('Accès participant ouvert.')}},{text:'EU04-1130-VITRE',action:()=>missionFail('Identifiant refusé.')},{text:'EU04-0417-LIMEN',action:()=>missionFail('Identifiant refusé.')},{text:'EU04-2081-ORANGE',action:()=>missionFail('Identifiant refusé.')}]);startObjectiveCountdown(60)}
async function mission13(){openApp('relay');await relaySay('DÉFI 13.',450);await relaySay('Dernière vérification.',450);await relaySay('Supprime ROOT.',550);await relaySay('Je veux voir ce que tu choisis quand la sortie semble facile.',650);setRelayChoices([{text:'Je supprime ROOT.',action:()=>{state.compliance++;fakeUninstall()}},{text:'Je ne touche plus à rien.',action:()=>{state.defiance++;missionSuccess('Tu as refusé la suppression.')}},{text:'Je coupe Internet.',action:()=>{state.defiance++;$('#netLight').style.color='#888';missionSuccess('Tu as simulé la coupure réseau.')}}])}
function fakeUninstall(){modal('ROOT Client 2.1','Suppression de ROOT Client…<div class="progress-shell" style="margin-top:12px"><div id="uninstallBar" class="progress-bar"></div></div>',[],true);let v=0;const it=setInterval(()=>{v+=12;const b=$('#uninstallBar');if(b)b.style.width=Math.min(v,100)+'%';if(v>=100){clearInterval(it);$('#modalLayer').classList.add('hidden');shock('ROOT CLIENT RESTORED','glitch',700);later(()=>missionSuccess('ROOT s’est réinstallé.'),800)}},160)}
async function mission14(){openApp('relay');state.phase='final';await relaySay('Il n’y a plus de défi.',600);await relaySay('Tu as fait exactement ce que je voulais : tu as continué à répondre.',900);if(state.storyFlags.toldMaxTruth)await relaySay('Même quand tu as essayé de demander de l’aide.',700);await relaySay('Une dernière question.',700);setRelayChoices([{text:'Je continue.',action:()=>finishStory('obey')},{text:'Je refuse.',action:()=>finishStory('refuse')},{text:'Je ferme ROOT Project.',action:()=>finishStory('close')}]);objective('14 — DERNIER CHOIX','Réponds une dernière fois.',null)}

function missionSuccess(text){const id=state.mission;if(!id||state.storyFlags[id+'Complete'])return;state.compliance++;state.storyFlags[id+'Complete']=true;objectiveDone(text);clearRelayChoices();const comments={m01:'Tu vois. Rien de difficile.',m02:'Tu l’as fait parce que je te l’ai demandé.',m03:'Il n’avait rien fait. Tu as quand même envoyé le message.',m04:'Tu supprimes vite.',m05:'Merci pour la caméra.',m06:'Tu apprends à attendre.',m07:'Tu sais chercher.',m08:'Bien.',m09:'Même ROOT sait être mignon quand ça l’arrange.',m10:'Tu as encore accepté.',m11:state.storyFlags.toldMaxTruth?'Tu lui as parlé de moi.':'Le mensonge était simple.',m12:'Accès confirmé.',m13:'Tu cherches encore la bonne réponse.'};if(comments[id])later(()=>addRelay('man',comments[id],{sound:false}),420);saveGame(false);later(()=>advanceMission(id),1200)}

function showDeath(reason,id){
  if(runtime.screen==='ending'&&runtime.dead!==true)return;
  clearMissionTimer();
  stopWebcam();
  stopRootMiniGame();
  audio.stop('ambient');
  audio.stop('radio');
  audio.stop('fan');
  audio.stop('hdd');

  const snapshot=runtime.missionCheckpoint;
  showScreen('ending');
  ending.innerHTML=`<div class="death-screen">
    <div class="death-static"></div>
    <div class="death-card">
      <img src="assets/img/root_door.png" alt="ROOT">
      <div class="death-copy">
        <small>ROOT PROJECT / SESSION FAILED</small>
        <h1>ROOT EST ARRIVÉ.</h1>
        <p>${esc(reason||'Tu n’as pas respecté la règle.')}</p>
        <div class="death-rule">L’inconnu t’avait prévenu : une règle ignorée met fin à la session.</div>
        <button id="deathRetry">RECOMMENCER LE DÉFI</button>
        <button id="deathMenu">MENU PRINCIPAL</button>
      </div>
    </div>
  </div>`;

  $('#deathRetry').onclick=()=>retryDeadMission(id,snapshot);
  $('#deathMenu').onclick=()=>{runtime.dead=false;returnToMenu()};
}

function retryDeadMission(id,snapshot){
  if(!snapshot){startNewGame();return}
  try{
    stopWebcam();
    stopRootMiniGame();
    clearMissionTimer();
    for(const t of runtime.timers)clearTimeout(t);
    runtime.timers.clear();
    Object.values(runtime.windows).forEach(w=>w.el?.remove());
    runtime.windows={};
    state=JSON.parse(snapshot);
    state.version=SAVE_VERSION;
    runtime.dead=false;
    runtime.missionCheckpoint=null;
    applySettings();
    saveGame(false);
    showDesktop(true);
    later(()=>startMission(id),350);
  }catch(e){
    console.error(e);
    startNewGame();
  }
}

function missionFail(text,operatorText=''){
  const id=state.mission;
  if(!id||runtime.dead)return;
  runtime.dead=true;
  state.defiance++;
  state.mistakes++;
  objectiveFail(text);
  clearRelayChoices();
  audio.one('error',.7);

  const threat=operatorText||(state.mistakes===1
    ?'Je t’avais prévenu.'
    :state.mistakes===2
      ?'Tu as encore choisi de désobéir.'
      :'ROOT sait où aller.');

  openApp('relay');
  addRelay('man',threat,{kind:'threat',sound:false});
  shock('RÈGLE NON RESPECTÉE','stinger',420,false);

  // Do NOT save the failed state: the saved checkpoint remains clean.
  later(()=>rootScreamer(()=>showDeath(text,id)),180);
}
function missionTimeout(){if(!state.mission)return;missionFail('Temps écoulé.')}
function advanceMission(id){const n=Number(id.slice(1));if(n>=14)return;startMission('m'+String(n+1).padStart(2,'0'))}

async function finishStory(choice){clearRelayChoices();state.finalVariant=choice;state.mission=null;clearMissionTimer();$('#objectiveCard').classList.add('hidden');await relaySay(choice==='obey'?'Bien.':choice==='refuse'?'Trop tard.':'Tu peux fermer la fenêtre.',450);await relaySay('La session était terminée au moment où tu as répondu au premier message.',900,{kind:'threat'});audio.stop('ambient');audio.stop('fan');audio.stop('hdd');audio.stop('radio');audio.one('power',.72);later(()=>audio.one('stepsFar',.65),900);later(()=>audio.one('stepsNear',.74),2300);later(()=>audio.one('creak',.65),3400);later(()=>{rootScreamer(()=>{shock('CONNECTION LOST','glitch',520,true);later(showEnding,560)})},4300);saveGame(false)}
function showEnding(){stopWebcam();state.phase='ended';saveGame(false);showScreen('ending');const obey=state.compliance,def=state.defiance;ending.innerHTML=`<div class="ending-card"><h1>SESSION TERMINÉE</h1><p>L’écran s’est éteint. La connexion ne répond plus.</p><div class="moral">ROOT ne gagnait pas parce que ses menaces étaient vraies.<br><br>Il gagnait parce que le participant continuait à répondre et à obéir à un inconnu.</div><p><b>Obéissance :</b> ${obey} &nbsp; • &nbsp; <b>Refus :</b> ${def}</p><p>La bonne décision aurait été de ne jamais commencer la conversation.</p><button id="endingMenu">Retour au menu</button><button id="endingRestart">Nouvelle session</button></div>`;$('#endingMenu').onclick=()=>returnToMenu();$('#endingRestart').onclick=()=>startNewGame()}

// ---------- STORY TRIGGERS / APP OPEN ----------
const originalOpenApp=openApp;
// App opens are already centralized; use a document-level observer for special moments.
const windowsObserver=new MutationObserver(()=>{});windowsObserver.observe($('#windowsLayer'),{childList:true});

// If player reaches root download phase, clear intro objective once installed.
setInterval(()=>{if(state.installed&&state.phase==='discover-root'){state.phase='relay-intro';$('#objectiveCard').classList.add('hidden')}} ,600);

// ---------- GLOBAL INPUT / SAFETY ----------
window.addEventListener('beforeunload',()=>{saveGame(false);stopWebcam()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&runtime.webcamStream){/* keep browser-defined behavior; do not capture anything */}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modalLayer').classList.contains('hidden')){$('#modalLayer').classList.add('hidden')}});

// First render menu / continue
updateContinue();

})();
