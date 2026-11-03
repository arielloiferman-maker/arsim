const routes = new Set(['/join', '/state', '/leave']);
const reply = (body, status=200) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});
const codePattern = /^[A-F0-9]{6}$/;

export default {
 async fetch(request, env) {
  const route = new URL(request.url).pathname;
  if(request.method!=='POST'||!routes.has(route))return reply({},404);
  try {
   const bytes=await request.text();
   if(bytes.length>1024)return reply({},413);
   const data=JSON.parse(bytes);
   const create=route==='/join'&&!data.code;
   const code=create?Array.from(crypto.getRandomValues(new Uint8Array(3)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase():data.code;
   if(!codePattern.test(code))return reply({},400);
   return env.ROOMS.getByName(code).fetch('https://room.internal'+route,{
    method:'POST',body:JSON.stringify({...data,code,create})
   });
  }catch{return reply({},400)}
 }
};

export class Room {
 constructor(ctx,env){
  this.ctx=ctx;
  this.env=env;
  this.players=new Map();
 }
 async fetch(request){
  const route=new URL(request.url).pathname, data=await request.json(), now=Date.now();
  const players=this.players;
  for(const [token,player] of players)if(now-player.last>90000)players.delete(token);
  if(route==='/join'){
   if(data.create?players.size>0:players.size===0)return reply({},data.create?409:404);
   if(players.size>=12)return reply({},409);
   const id=crypto.randomUUID(),token=crypto.randomUUID();
   const white=[...players.values()].filter(p=>p.team===0).length;
   const team=white<=players.size-white?0:1;
   players.set(token,{id,team,last:now,lastAttack:0,hits:0,state:null});
   if(data.create)this.ctx.waitUntil(this.recordRoom(data.code));
   return reply({id,token,team,code:data.code});
  }
  const player=players.get(data.token);
  if(route==='/leave'){players.delete(data.token);return new Response(null,{status:204});}
  if(!player||![data.x,data.y,data.z,data.yaw].every(v=>Number.isFinite(v)&&Math.abs(v)<10000))return reply({},400);
  player.last=now;
  player.state={id:player.id,team:player.team,x:data.x,y:data.y,z:data.z,yaw:data.yaw,alive:data.alive===true};
  const enemy=[...players.values()].find(peer=>peer.id===data.target);
  if(player.state.alive&&enemy?.state?.alive&&player.team!==enemy.team&&now-player.lastAttack>370){
   const dx=enemy.state.x-data.x,dz=enemy.state.z-data.z,dy=enemy.state.y-data.y;
   if(Math.hypot(dx,dy,dz)<3.2&&-Math.sin(data.yaw)*dx-Math.cos(data.yaw)*dz>0){
    player.lastAttack=now;enemy.hits++;
   }
  }
  const hits=player.hits;player.hits=0;
  return reply({hits,count:players.size,snapshot:[...players.values()].filter(peer=>peer!==player&&peer.state).map(peer=>peer.state)});
 }
 async recordRoom(code){
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=this.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return;
  try {
   const response=await fetch(new URL('/rest/v1/beach_room_events',SUPABASE_URL),{
    method:'POST',
    headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({room_code:code})
   });
   if(!response.ok)console.warn('Supabase room log failed',response.status);
  }catch{console.warn('Supabase room log unavailable');}
 }
}
