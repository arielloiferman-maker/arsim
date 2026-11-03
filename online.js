export function connectPlayers({spawn, remove, state, hit, status}) {
 const peers=new Map();
 let session=null,last=0,pending=false,target=null,joining=false;
 const lobby=document.createElement('dialog');
 lobby.id='lobby';
 lobby.innerHTML=`<form method="dialog">
  <header><strong>לובי קרב החוף</strong><button value="close">סגור</button></header>
  <p id="room-status" role="status">צור חדר או הזן קוד שקיבלת מחבר.</p>
  <div id="room-entry"><button type="button" id="room-create">צור חדר</button>
  <input id="room-code" aria-label="קוד חדר" placeholder="קוד חדר" maxlength="6" dir="ltr">
  <button type="button" id="room-join">הצטרף</button></div>
  <div id="room-invite" hidden><input id="room-url" aria-label="קישור הזמנה" readonly dir="ltr">
  <button type="button" id="room-copy">העתק קישור</button>
  <button type="button" id="room-leave">עזוב חדר</button></div>
 </form>`;
 const open=document.createElement('button');
 open.id='lobby-open';open.textContent='לובי · L';
 document.body.append(open,lobby);
 const find=id=>lobby.querySelector('#room-'+id);
 const code=find('code'),message=find('status'),invite=find('invite'),entry=find('entry');
 const post=(route,body)=>fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(6000)});
 function clear(){
  for(const peer of peers.values())remove(peer);
  peers.clear();session=null;target=null;entry.hidden=false;invite.hidden=true;
  status('משחק מקומי · L ללובי');
 }
 function show(){
  document.exitPointerLock?.();
  window.dispatchEvent(new Event('beach-lobby-open'));
  if(!lobby.open)lobby.showModal();
 }
 open.onclick=show;
 window.addEventListener('keydown',event=>{
  if(event.code==='KeyL'&&!lobby.open&&!event.repeat){event.preventDefault();event.stopPropagation();show();}
  else if(lobby.open)event.stopPropagation();
 },true);
 window.addEventListener('keyup',event=>{if(lobby.open)event.stopPropagation();},true);
 async function join(roomCode){
  if(joining||session)return;
  if(location.protocol==='file:'){message.textContent='פתח את קישור השרת כדי לשחק עם חברים.';return;}
  joining=true;message.textContent='מתחבר…';
  try {
   const response=await post('/join',{code:roomCode});
   if(!response.ok)throw new Error(response.status===404?'קוד החדר לא נמצא.':response.status===409?'החדר מלא.':'השרת אינו זמין.');
   session=await response.json();
   const url=new URL(location.href);
   url.searchParams.set('room',session.code);
   find('url').value=url.href;
   history.replaceState(null,'',url);
   entry.hidden=true;invite.hidden=false;
   message.textContent='חדר '+session.code+' · אפשר להעתיק את הקישור ולהזמין חברים.';
  } catch(error){message.textContent=error.message||'החיבור נכשל.';}
  finally {joining=false;}
 }
 find('create').onclick=()=>join('');
 find('join').onclick=()=>{
  const value=code.value.trim().toUpperCase();
  if(!/^[0-9A-F]{6}$/.test(value)){message.textContent='הזן קוד חדר בן 6 תווים.';return;}
  join(value);
 };
 find('copy').onclick=async()=>{
  const field=find('url');
  try {await navigator.clipboard.writeText(field.value);message.textContent='קישור ההזמנה הועתק · '+session.code;}
  catch {field.select();message.textContent='הקישור מסומן להעתקה.';}
 };
 find('leave').onclick=()=>{
  if(session)post('/leave',{token:session.token,code:session.code}).catch(()=>{});
  clear();
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  message.textContent='יצאת מהחדר.';
 };
 const initial=new URL(location.href).searchParams.get('room');
 if(initial&&/^[0-9a-f]{6}$/i.test(initial)){code.value=initial.toUpperCase();show();join(code.value);}
 else if(location.protocol!=='file:')show();
 return {peers, get team(){return session?.team??0}, attack(key){target=key;}, async tick(){
  if(!session||pending||performance.now()-last<85)return;
  last=performance.now();pending=true;
  const current=session, payload={token:current.token,code:current.code,...state(),target};target=null;
  try {
   const response=await post('/state',payload);
   if(session!==current)return;
   if(response.status===400){clear();message.textContent='החדר נותק. הצטרף מחדש.';return;}
   if(!response.ok)throw new Error('Disconnected');
   const {snapshot,hits,count}=await response.json();
   if(session!==current)return;
   const seen=new Set();
   for(const player of snapshot){
    seen.add(player.id);
    if(!peers.has(player.id))peers.set(player.id,spawn(player));
    peers.get(player.id).snapshot=player;
   }
   for(const [key,peer] of peers)if(!seen.has(key)){remove(peer);peers.delete(key);}
   for(let i=0;i<Math.min(hits,12);i++)hit();
   status('חדר '+current.code+' · '+count+' שחקנים');
  } catch {status('החיבור לחדר מתחדש…');}
  finally {pending=false;}
 }};
}
