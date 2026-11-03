const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const players = new Map();
const rooms = new Map();
const files = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/play.js', 'play.js']]);

http.createServer(async (req, res) => {
 const url = new URL(req.url, 'http://localhost');
 if (req.method === 'POST' && ['/join','/state','/leave'].includes(url.pathname)) {
  try {
   let body='';
   for await (const chunk of req) {
    body+=chunk;
    if (body.length>1024) {res.writeHead(413).end();return;}
   }
   const data=JSON.parse(body), now=Date.now();
   if(url.pathname==='/join'){
    let code=String(data.code||'').trim().toUpperCase();
    if(code&&!rooms.has(code)){res.writeHead(404).end();return;}
    if(players.size>=96){res.writeHead(503).end();return;}
    if(!code){
     do {code=randomBytes(3).toString('hex').toUpperCase();} while(rooms.has(code));
     rooms.set(code,new Set());
    }
    const room=rooms.get(code);
    if(room.size>=12){res.writeHead(409).end();return;}
    const id=randomUUID(), token=randomUUID();
    const white=[...room].filter(p=>p.team===0).length;
    const team=white<=room.size-white?0:1;
    const player={id,token,team,code,last:now,attack:0,hits:0,state:null};
    room.add(player);players.set(token,player);
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({token,id,code,team}));
    return;
   }
   const player=players.get(data.token);
   if(url.pathname==='/leave'){if(player)removePlayer(player);res.writeHead(204).end();return;}
   if(!player || ![data.x,data.y,data.z,data.yaw].every(v=>Number.isFinite(v)&&Math.abs(v)<10000)){
    res.writeHead(400).end();return;
   }
   if(now-player.last>=45){
    player.last=now;
    player.state={id:player.id,team:player.team,x:data.x,y:data.y,z:data.z,yaw:data.yaw,alive:data.alive===true};
    const enemy=[...rooms.get(player.code)].find(peer=>peer.id===data.target);
    if(enemy?.state?.alive && player.state.alive && enemy.team!==player.team && now-player.attack>370){
     const a=player.state,b=enemy.state,dx=b.x-a.x,dz=b.z-a.z;
     if(Math.hypot(dx,b.y-a.y,dz)<3.2 && -Math.sin(a.yaw)*dx-Math.cos(a.yaw)*dz>0){
      player.attack=now;
      enemy.hits++;
     }
    }
   }
   const snapshot=[...rooms.get(player.code)].filter(peer=>peer!==player).map(peer=>peer.state).filter(Boolean);
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({snapshot,hits:player.hits,count:rooms.get(player.code).size}));
   player.hits=0;
  } catch {res.writeHead(400).end();}
  return;
 }
 const file=req.method==='GET'&&files.get(url.pathname);
 if (!file) {res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
 fs.createReadStream(path.join(__dirname,file)).pipe(res);
}).listen(Number(process.env.PORT)||4183,'127.0.0.1',()=>console.log('Beach game ready on port '+(process.env.PORT||4183)));

function removePlayer(player){
 players.delete(player.token);
 const room=rooms.get(player.code);
 room.delete(player);
 if(!room.size)rooms.delete(player.code);
}
setInterval(()=>{
 for(const player of players.values())if(Date.now()-player.last>90000)removePlayer(player);
},10000).unref();
