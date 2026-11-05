const tricks=[
 ['none','קפיצה רגילה',0,0,0],
 ['backflip','סלטה לאחור',1,0,0],
 ['frontflip','סלטה לפנים',-1,0,0],
 ['leftRoll','גלגול שמאלה',0,0,1],
 ['rightRoll','גלגול ימינה',0,0,-1],
 ['left360','סיבוב 360° שמאלה',0,1,0],
 ['right360','סיבוב 360° ימינה',0,-1,0],
 ['spin720','סיבוב 720°',0,2,0],
 ['corkscrew','בורג משולב',1,0,1],
 ['reverseCork','בורג הפוך',-1,0,-1],
 ['tailwhip','הצלפת זנב',0,1,0,.38],
 ['tabletop','הטיה הצידה',0,0,0,.95]
];
const byId=new Map(tricks.map(trick=>[trick[0],trick]));

export function poseJetTrick(pivot,id,progress){
 if(!pivot)return;
 const trick=byId.get(id);
 if(!trick||progress>=1){pivot.rotation.set(0,0,0);return;}
 const [, ,pitch,yaw,roll,lean=0]=trick;
 const t=Math.max(0,progress);
 const rotation=t*t*(3-2*t)*2*Math.PI;
 pivot.rotation.set(pitch*rotation,yaw*rotation,roll*rotation+lean*Math.sin(t*Math.PI),'YXZ');
}

export function installTrickMenu({clearControls,resume,choose}){
 const panel=document.createElement('dialog');
 panel.id='jet-tricks';
 panel.setAttribute('aria-label','תפריט טריקים');
 panel.innerHTML=`<header><h2>טריקים באוויר</h2><button data-close>סגירה · H</button></header>
 <p>בחר תרגיל בזמן רכיבה כדי לבצע אותו. אפשר גם לחזור על הטריק הנבחר עם רווח או קליק ימני.</p><div class="trick-grid">
 ${tricks.map(([id,label])=>`<button data-trick="${id}" aria-pressed="${id==='none'}">${label}</button>`).join('')}
 </div>`;
 const style=document.createElement('style');
 style.textContent=`
 body.tricks-open,body.tricks-open *{cursor:auto!important}
 #jet-tricks{width:min(660px,94vw);max-height:88vh;overflow:auto;color:#f0f9ff;background:#123144;border:1px solid #92bedc;border-radius:16px;padding:20px}
 #jet-tricks::backdrop{background:#07131cb5}
 #jet-tricks header{display:flex;justify-content:space-between;align-items:center;gap:12px}
 #jet-tricks h2{margin:0}
 #jet-tricks button{cursor:pointer!important;font:inherit;color:white;background:#214f64;border:1px solid #70a5ba;border-radius:8px;padding:9px}
 #jet-tricks button[aria-pressed=true]{border-color:#ffd569;background:#49616b}
 .trick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 `;
 document.head.append(style);
 document.body.append(panel);
 let selected=null,restore=true;
 function close(restoreMouse=true){restore=restoreMouse;panel.close();}
 panel.addEventListener('close',()=>{
  document.body.classList.remove('tricks-open');
  clearControls();
  if(restore)resume();
 });
 panel.querySelector('[data-close]').onclick=()=>close();
 const buttons=[...panel.querySelectorAll('[data-trick]')];
 for(const button of buttons)button.onclick=()=>{
  const {trick}=button.dataset;
  selected=trick==='none'?null:trick;
  for(const option of buttons)option.setAttribute('aria-pressed',String(option===button));
  choose(selected,byId.get(trick)[1]);
  close();
 };
 window.addEventListener('keydown',event=>{
  if(event.code==='KeyH'){
   event.preventDefault();
   event.stopImmediatePropagation();
   if(event.repeat)return;
   if(panel.open){close();return;}
   if(document.querySelector('dialog[open]'))return;
   clearControls();
   document.exitPointerLock?.();
   document.body.classList.add('tricks-open');
   restore=true;
   panel.showModal();
  }else if(panel.open)event.stopImmediatePropagation();
 },true);
 window.addEventListener('keyup',event=>{if(panel.open)event.stopImmediatePropagation();},true);
 window.addEventListener('beach-lobby-open',()=>{if(panel.open)close(false);});
 return {get selected(){return selected;}};
}
