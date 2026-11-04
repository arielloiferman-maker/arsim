export function installInventory({canvas,camera,clearControls,resume,heldItem}){
 const panel=document.createElement('dialog');
 panel.id='inventory';
 panel.setAttribute('aria-label','אינבנטורי');
 panel.innerHTML=`<header><h2>התיק שלך</h2><button id="inventory-close">סגירה · T</button></header>
 <p>בחר ציוד ואז לחץ T כדי לחזור למשחק.</p>
 <div class="inventory-grid">
 <button id="equip-camera"><strong>📷 מצלמת טבע</strong><span>זום עד ×40 · צילום בלחיצה שמאלית</span></button>
 <button id="equip-hands"><strong>🤲 ידיים וחפצים</strong><span id="inventory-held">ללא חפץ</span></button>
 </div><p id="equipment-status" role="status"></p>
 <h3>התמונות שלך</h3><p id="photos-empty">צייד את המצלמה, סגור את התיק וצא לצלם.</p>
 <div id="photo-gallery"></div><small>עד 8 תמונות נשמרות כאן במהלך המשחק. לחץ על תמונה כדי להוריד אותה.</small>`;
 const view=document.createElement('div');
 view.id='photo-view';
 view.hidden=true;
 view.innerHTML='<div class="photo-frame"></div><strong id="photo-zoom">×1.0</strong><span>גלגלת לזום · קליק שמאלי לצילום · קליק ימני להורדה · T לתיק</span>';
 const style=document.createElement('style');
 style.textContent=`
 body.inventory-open,body.inventory-open *{cursor:auto!important}
 #inventory{width:min(720px,94vw);max-height:88vh;overflow:auto;color:#ecf9ff;background:#102c3bee;border:1px solid #8cc9dd88;border-radius:20px;padding:24px;box-shadow:0 24px 90px #0008}
 #inventory::backdrop{background:#03121aba;backdrop-filter:blur(7px)}
 #inventory header{display:flex;align-items:center;justify-content:space-between;gap:20px}
 #inventory h2{margin:0}#inventory p{color:#bdd6df;line-height:1.6}
 #inventory button{font:inherit;color:inherit;border:1px solid #8cc9dd66;background:#214556;border-radius:12px;padding:14px;cursor:pointer!important}
 #inventory button:focus-visible{outline:3px solid #ffd36c}
 .inventory-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
 .inventory-grid button{text-align:right;display:grid;gap:10px;min-height:116px}
 .inventory-grid strong{font-size:20px}.inventory-grid span{color:#b9dbe6;font-size:14px}
 #inventory button[aria-pressed=true]{border-color:#ffce6b;background:#345459}
 #photo-gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
 #photo-gallery a{color:#fff;cursor:pointer!important}#photo-gallery img{display:block;width:100%;border-radius:9px}
 #photo-view{position:fixed;inset:14% 16%;z-index:3;pointer-events:none;border:1px solid #ffffff77;border-radius:7px;box-shadow:0 0 0 160px #00111b24}
 #photo-view[hidden]{display:none}#photo-view strong{position:absolute;right:16px;top:12px;background:#051c2ca8;border-radius:6px;padding:6px 12px}
 #photo-view>span{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:white;text-shadow:0 2px 5px #000}
 .photo-frame{position:absolute;inset:30% 38%;border:1px solid #ffffff99}
 body.camera-equipped #reticle{display:none}
 @media(max-width:600px){.inventory-grid{grid-template-columns:1fr}#photo-view{inset:15% 5%}}
 `;
 document.head.append(style);
 document.body.append(panel,view);
 const find=id=>panel.querySelector('#'+id);
 const cameraButton=find('equip-camera'),handsButton=find('equip-hands');
 const zoomLabel=view.querySelector('#photo-zoom'),gallery=find('photo-gallery');
 const photos=[];
 let equipped=false,zoom=1,pending=false,saving=false,lastShot=0,closingResume=true;
 const baseFov=camera.fov,baseFar=camera.far;
 function updateLens(){
  camera.fov=2*Math.atan(Math.tan(baseFov*Math.PI/360)/(equipped?zoom:1))*180/Math.PI;
  camera.far=equipped?1400:baseFar;
  camera.updateProjectionMatrix();
  zoomLabel.textContent='×'+zoom.toFixed(1);
 }
 function equipment(active){
  equipped=active;
  pending=false;
  document.body.classList.toggle('camera-equipped',active);
  view.hidden=!active||panel.open;
  cameraButton.setAttribute('aria-pressed',String(active));
  handsButton.setAttribute('aria-pressed',String(!active));
  find('equipment-status').textContent=active?'מצלמת הטבע מצוידת. גלגלת משנה זום.':'הידיים והחפץ שלך מצוידים.';
  updateLens();
 }
 function open(){
  if(document.querySelector('dialog[open]'))return;
  clearControls();
  document.exitPointerLock?.();
  document.body.classList.add('inventory-open');
  find('inventory-held').textContent=heldItem();
  closingResume=true;
  panel.showModal();
  view.hidden=true;
 }
 function close(restore=true){
  closingResume=restore;
  panel.close();
 }
 panel.addEventListener('close',()=>{
  document.body.classList.remove('inventory-open');
  view.hidden=!equipped;
  clearControls();
  if(closingResume)resume();
 });
 panel.addEventListener('cancel',event=>{event.preventDefault();close();});
 find('inventory-close').onclick=()=>close();
 cameraButton.onclick=()=>equipment(true);
 handsButton.onclick=()=>equipment(false);
 equipment(false);
 const block=event=>{event.preventDefault();event.stopImmediatePropagation();};
 window.addEventListener('keydown',event=>{
  if(event.code==='KeyT'){
   block(event);
   if(!event.repeat){if(panel.open)close();else open();}
  }else if(panel.open)event.stopImmediatePropagation();
 },true);
 window.addEventListener('keyup',event=>{if(panel.open)event.stopImmediatePropagation();},true);
 window.addEventListener('mousedown',event=>{
  if(panel.open||event.target!==canvas||!equipped)return;
  block(event);
  if(event.button===2){equipment(false);return;}
  if(event.button===0){
   if(document.pointerLockElement!==canvas){resume();return;}
   if(!saving&&performance.now()-lastShot>350){
    pending=true;
    lastShot=performance.now();
   }
  }
 },true);
 window.addEventListener('wheel',event=>{
  if(!equipped||panel.open||document.pointerLockElement!==canvas)return;
  block(event);
  zoom=Math.max(1,Math.min(40,zoom*Math.exp(-Math.sign(event.deltaY)*.16)));
  updateLens();
 },{capture:true,passive:false});
 window.addEventListener('beach-lobby-open',()=>{if(panel.open)close(false);});
 return {
  get open(){return panel.open;},
  get cameraActive(){return equipped;},
  get viewDistance(){return equipped?Math.min(950,200+zoom*22):220;},
  get sensitivity(){return equipped?1/Math.sqrt(zoom):1;},
  afterRender(){
   if(!pending||saving)return;
   pending=false;
   saving=true;
   const shot=document.createElement('canvas');
   shot.width=canvas.width;
   shot.height=canvas.height;
   try{
    shot.getContext('2d').drawImage(canvas,0,0);
    shot.toBlob(blob=>{
     saving=false;
     if(!blob){find('equipment-status').textContent='הצילום לא נשמר. אפשר לנסות שוב.';return;}
     const url=URL.createObjectURL(blob);
     const link=document.createElement('a');
     link.href=url;
     link.download='beach-photo-'+Date.now()+'.png';
     link.setAttribute('aria-label','הורדת צילום');
     const thumbnail=document.createElement('img');
     thumbnail.src=url;
     thumbnail.alt='צילום מהמשחק';
     link.append(thumbnail);
     gallery.prepend(link);
     photos.unshift({url,link});
     if(photos.length>8){const old=photos.pop();old.link.remove();URL.revokeObjectURL(old.url);}
     find('photos-empty').hidden=true;
     find('equipment-status').textContent='התמונה נשמרה באלבום. לחץ עליה להורדה.';
     view.animate([{opacity:.2},{opacity:1}],{duration:190});
    },'image/png');
   }catch{
    saving=false;
    find('equipment-status').textContent='הצילום לא נשמר. אפשר לנסות שוב.';
   }
  }
 };
}
