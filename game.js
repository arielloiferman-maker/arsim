import * as THREE from 'three';
import {loadCrew, attachCrew, animateCrew, crewFall, crewSandReaction, startCrewBoxing, advanceCrewBoxing} from './crew.js';
import {installBlenderWorld, blenderProp} from './blender-world.js';
import blenderLook from './blender-look.json';
import {buildResort, parasol, lounger, sportsBall, resortRoutes} from './resort.js';
import {makeOcean, waveHeight, oceanBounds} from './ocean.js';
import {addSeaLife, textureSand, sunsetSky, addWetSand} from './sea-life.js';
import {connectPlayers} from './online.js';
import {loadWaterPark} from './water-park.js';
import {loadFirstPersonFists, comboDuration} from './first-person.js';

const scene=new THREE.Scene();scene.background=new THREE.Color(0x7ed3ee);scene.fog=new THREE.Fog(0x7ed3ee,48,115);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.1,180);camera.position.set(0,2,0);scene.add(camera);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=2**blenderLook.exposure;document.querySelector('#game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(new THREE.Color(...blenderLook.worldColor),0xa47445,blenderLook.worldStrength*2.4));const sun=new THREE.DirectionalLight(new THREE.Color(...blenderLook.sunColor),blenderLook.sunEnergy);sun.position.set(...blenderLook.sunDirection).multiplyScalar(42);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-43;sun.shadow.camera.right=43;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;sun.shadow.normalBias=.035;scene.add(sun);const resort={layout:null,pickups:[],jetSkis:[],slides:resortRoutes()};
const mat=(c,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});const sand=mat(0xe8c887),water=new THREE.MeshPhysicalMaterial({color:0x159dc4,roughness:.14,metalness:.1,transparent:true,opacity:.86}),foam=mat(0xd8fbf2),red=mat(0xe8733d),navy=mat(0x263849),white=mat(0xf3f0dc),black=mat(0x22252c),skin=mat(0xd6a478),darkSkin=mat(0x956344),plastic=mat(0xf4d748,.45),pink=mat(0xff65a5),glass=new THREE.MeshPhysicalMaterial({color:0x4dc4a1,roughness:.05,transparent:true,opacity:.72}),wood=mat(0xc69656);
const plane=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),sand);plane.rotation.x=-Math.PI/2;plane.position.set(0,-.08,4981);plane.receiveShadow=true;scene.add(plane);
const ocean=makeOcean(scene);const sky=sunsetSky(scene);
const fallbackSea=new THREE.Group();scene.add(fallbackSea);const animateSeaLife=addSeaLife(fallbackSea);let blenderSea=null;
textureSand(sand);const fallbackWetSand=addWetSand(scene);
const seabed=new THREE.Mesh(new THREE.PlaneGeometry(340,180),sand);
seabed.rotation.x=-Math.PI/2;seabed.position.set(0,-5,-109);scene.add(seabed);
const umbrella=(x,z,color,sc=1)=>{const g=parasol(color);g.position.set(x,0,z);g.scale.setScalar(sc);scene.add(g);return g};
// Pickups model the beach items from the supplied references.
const props=resort.pickups.map(prop=>({...prop,taken:false}));function makeObject(type){const imported=blenderProp(type);if(imported)return imported;let o;if(type==='chair')return lounger();if(['ball','volley','beachball'].includes(type))return sportsBall(type);if(type==='cup'){o=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,.3,12),pink);o.position.y=.16}else if(type==='bottle'){o=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,.58,10),glass);o.position.y=.29}else if(type==='paddle'){o=new THREE.Group();let blade=new THREE.Mesh(new THREE.BoxGeometry(.52,.045,.72),wood),handle=new THREE.Mesh(new THREE.BoxGeometry(.15,.06,.42),black);blade.position.y=.12;handle.position.set(0,.1,-.52);o.add(blade,handle)}else if(type==='blanket'){o=new THREE.Group();let colors=[0x193ca4,0x3b7d32,0xf2cc28,0x193ca4,0x3b7d32];for(let i=0;i<5;i++){let strip=new THREE.Mesh(new THREE.BoxGeometry(.4,.035,1.55),mat(colors[i],.6));strip.position.set((i-2)*.4,.035,0);o.add(strip)}}else if(type==='chair'){o=new THREE.Group();let frame=mat(0xc6954e),fabric=mat(0x4a78be);let seat=new THREE.Mesh(new THREE.BoxGeometry(.72,.055,.95),fabric);seat.position.set(0,.52,0);seat.rotation.x=-.45;o.add(seat);for(const x of[-.42,.42])for(const z of[-.38,.38]){let leg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.25,7),frame);leg.position.set(x,.48,z);leg.rotation.x=z<0?.55:-.55;o.add(leg)}}else{o=new THREE.Mesh(new THREE.BoxGeometry(.58,.08,.48),plastic);o.position.y=.15}o.traverse(q=>{if(q.isMesh){q.castShadow=true;q.receiveShadow=true}});return o}function addProp(type,x,z){let o=makeObject(type);o.position.x=x;o.position.z=z;scene.add(o);props.push({mesh:o,type,taken:false});return o}
addProp('cup',-2,2);addProp('bottle',3,-1);addProp('ball',-6,-4);addProp('lid',6,3);addProp('beachball',-10,1);addProp('volley',7,4);addProp('paddle',-4,7);addProp('blanket',10,-6);addProp('chair',-11,-7);addProp('ball',1,8);addProp('lid',-12,-8);addProp('cup',8,-10);
const thrownObjects=[],visualParticles=[];
const portableUmbrella=umbrella(3,9,0xff6d6d,.72);props.push({mesh:portableUmbrella,type:'umbrella',taken:false});
const people=[];let nextId=1;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function person(team,x,z,isPlayer=false){
 const g=new THREE.Group(),shirt=team===2?mat([0xe78265,0x47a69f,0xe9bb57,0xa47db0][nextId%4]):team===0?white:black;const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.39,.64,5,10),shirt);torso.position.y=1.28;g.add(torso);
 const tone=Math.random()<.5?skin:darkSkin,head=new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),tone);head.position.y=2.1;g.add(head);const hair=new THREE.Mesh(new THREE.SphereGeometry(.275,14,8,0,Math.PI*2,0,Math.PI*.45),mat(0x261c1c));hair.position.y=2.2;g.add(hair);const shades=new THREE.Mesh(new THREE.BoxGeometry(.38,.1,.06),mat(0x111111,.2,.7));shades.position.set(0,2.1,.25);g.add(shades);
 const shorts=new THREE.Mesh(new THREE.BoxGeometry(.62,.4,.4),team===0?navy:mat(0x454950));shorts.position.y=.66;g.add(shorts);const legs=[],arms=[];
 for(const s of[-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.48,4,7),team===1?mat(0x282e39):tone);leg.position.set(s*.18,.3,0);g.add(leg);legs.push(leg);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.5,4,7),tone);arm.position.set(s*.47,1.3,0);arm.rotation.z=-s*.17;g.add(arm);arms.push(arm)}
 g.position.set(x,0,z);g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g);const p={id:nextId++,team,g,hp:100,isPlayer,bot:!isPlayer,held:null,cool:0,stun:0,attackT:0,drunk:Math.random()<.22?1:0,alive:true,torso,shorts,legs,arms,walkPhase:Math.random()*Math.PI*2,walking:false,hitT:0};people.push(p);attachCrew(p);return p
}
const player=person(0,0,6,true);for(let i=0;i<5;i++){person(0,-5+i*2.5,11+Math.random()*4);person(1,-5+i*2.5,-3-Math.random()*5)}
for(let i=0;i<10;i++){const x=(i%5-2)*7,z=i<5?-14:13;const visitor=person(2,x,z);visitor.stroll={x,z,phase:i*1.7};}
let yaw=0,pitch=0,health=100,blueScore=0,blackScore=0,keys={},locked=false,dragLook=false,lastMouseX=0,lastMouseY=0,punchT=0;const heldText=document.querySelector('#stats'),notice=document.querySelector('#center');const ray=new THREE.Raycaster();const forward=new THREE.Vector3(),right=new THREE.Vector3();
const viewHand=new THREE.Group();const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,5,8),skin),palm=new THREE.Mesh(new THREE.SphereGeometry(.14,12,10),skin);forearm.rotation.z=.62;forearm.position.set(.55,-.47,-.82);palm.position.set(.76,-.72,-.92);viewHand.add(forearm,palm);
for(let i=0;i<4;i++){const knuckle=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),skin);knuckle.position.set(.66+i*.065,-.78,-1.02);viewHand.add(knuckle)}const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.13,4,7),skin);thumb.position.set(.88,-.73,-.96);thumb.rotation.z=-.8;viewHand.add(thumb);viewHand.visible=true;camera.add(viewHand);
const leftHand=new THREE.Group(),leftArm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,5,8),skin),leftPalm=new THREE.Mesh(new THREE.SphereGeometry(.14,12,10),skin);leftArm.rotation.z=-.62;leftArm.position.set(-.48,-.49,-.82);leftPalm.position.set(-.68,-.73,-.94);leftHand.add(leftArm,leftPalm);for(let i=0;i<4;i++){const knuckle=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),skin);knuckle.position.set(-.58-i*.065,-.79,-1.03);leftHand.add(knuckle)}const leftThumb=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.13,4,7),skin);leftThumb.position.set(-.82,-.74,-.98);leftThumb.rotation.z=.8;leftHand.add(leftThumb);camera.add(leftHand);
let firstPersonFists=null,thirdPerson=false,waterPark=null;
const viewItem=new THREE.Group();
camera.add(viewItem);
function setViewItem(type){
 viewItem.clear();
 if(!type)return;
 const item=player.heldProp.mesh.clone(true);
 item.position.set(0,0,0);
 item.rotation.set(0,0,0);
 const bounds=new THREE.Box3().setFromObject(item,true);
 const size=bounds.getSize(new THREE.Vector3());
 const grip=bounds.getCenter(new THREE.Vector3());
 const large=['chair','blanket','surfboard','cooler','lid'].includes(type);
 if(large)grip.x=bounds.min.x+size.x*.16;
 if(type==='umbrella')grip.y=bounds.min.y+size.y*.28;
 if(type==='paddle')grip.z=bounds.min.z+size.z*.18;
 const maxSize=type==='umbrella'?1.1:large?.86:.48;
 const scale=Math.min(.78,maxSize/Math.max(size.x,size.y,size.z));
 item.scale.multiplyScalar(scale);
 item.position.copy(grip.multiplyScalar(-scale));
 item.traverse(part=>{if(part.isMesh)part.castShadow=false;});
 viewItem.add(item);
 viewItem.rotation.set(type==='umbrella'?0:.16,.18,.08);
}
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyV'&&!e.repeat){thirdPerson=!thirdPerson;return}if(skiRide&&rideModes[e.code]&&!e.repeat){skiRide.mode=rideModes[e.code];return}if(e.code==='KeyB'&&!e.repeat){toggleShop();return}if(shopOpen&&/^Digit[1-4]$/.test(e.code)&&!e.repeat){buy(Number(e.code.slice(-1))-1);return}if(e.code==='KeyE'&&!e.repeat&&!useJetSki()&&!boardSlide())pickup();if(e.code==='KeyF')throwItem();if(e.code==='KeyG'&&!e.repeat)throwSand();if(e.code==='Space'){e.preventDefault();if(!e.repeat){if(skiRide)skiRide.jumpRequested=true;else if(!slideRide&&player.g.position.z>=-19)melee()}}});document.addEventListener('keyup',e=>keys[e.code]=false);
let firstLockedMove=false;
const ridePitchMin=-.62,ridePitchMax=.22;
function look(dx,dy,maxDelta){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.max(Math.abs(dx),Math.abs(dy))>maxDelta)return;
 yaw=THREE.MathUtils.euclideanModulo(yaw-dx*.0024+Math.PI,2*Math.PI)-Math.PI;
 pitch=clamp(pitch-dy*.0019,skiRide?ridePitchMin:-.72,skiRide?ridePitchMax:.72);
}
async function requestMouseLock(){
 const canvas=renderer.domElement;
 try{
  await canvas.requestPointerLock?.({unadjustedMovement:true});
 }catch(error){
  if(error.name==='NotSupportedError'){
   try{await canvas.requestPointerLock?.();}catch{/* Drag look remains available. */}
  }
 }
}
renderer.domElement.addEventListener('mousedown',e=>{
 if(e.button===0){
  if(locked)melee();
  else{
   dragLook=true;
   lastMouseX=e.clientX;
   lastMouseY=e.clientY;
   requestMouseLock();
   say('הזז את העכבר כדי להסתכל');
  }
 }
 if(e.button===2){e.preventDefault();throwItem();}
});
document.addEventListener('mouseup',()=>dragLook=false);
window.addEventListener('blur',()=>dragLook=false);
document.addEventListener('pointerlockchange',()=>{
 locked=document.pointerLockElement===renderer.domElement;
 firstLockedMove=locked;
 dragLook=false;
 document.querySelector('#help').style.opacity=locked?'.25':'1';
});
document.addEventListener('mousemove',e=>{
 if(locked){
  if(!e.movementX&&!e.movementY)return;
  // The browser can report a cursor reposition as the first locked movement.
  look(e.movementX,e.movementY,firstLockedMove?96:640);
  firstLockedMove=false;
 }else if(dragLook){
  look(e.clientX-lastMouseX,e.clientY-lastMouseY,640);
  lastMouseX=e.clientX;
  lastMouseY=e.clientY;
 }
});
document.addEventListener('contextmenu',e=>e.preventDefault());
function say(message){notice.textContent=message;notice.style.opacity='1';clearTimeout(say.timer);say.timer=setTimeout(()=>notice.style.opacity='0',850)}
function pickup(){if(player.held){say('כבר יש לך חפץ ביד');return}let nearest=null,d=4.8;for(const q of props)if(!q.taken){let n=q.mesh.position.distanceTo(player.g.position);if(n<d){nearest=q;d=n}}if(!nearest){say('התקרב לחפץ ולחץ E');return}nearest.taken=true;player.held=nearest.type;player.heldProp=nearest;player.g.add(nearest.mesh);nearest.mesh.position.set(.48,1.18,-.38);nearest.mesh.rotation.set(.3,.5,.5);setViewItem(player.held);heldText.textContent=`❤️ ${health}　|　${icon(player.held)} ביד`;say(`${icon(player.held)} נאסף!`)}
function icon(t){return {cup:'🥤',bottle:'🍾',ball:'🏐',beachball:'🏖️',volley:'🏐',paddle:'🏓',blanket:'🟦',chair:'🪑',lid:'🧺',umbrella:'⛱️'}[t]||'🧺'}
function melee(){
 if(skiRide||!player.alive||player.cool>0)return;
 if(firstPersonFists&&!player.held){
  player.cool=comboDuration;
  firstPersonFists.punch(strike);
  if(thirdPerson)startCrewBoxing(player);
  return;
 }
 player.cool=.38;
 punchT=1;
 strike();
}
function strike(){const v=new THREE.Vector3();camera.getWorldDirection(v);v.y=0;v.normalize();if(hitOnline(v)){say("אגרוף לשחקן");return}let target=null,best=player.held==='umbrella'?4.2:player.held==='paddle'||player.held==='chair'?3.6:3.05;for(const p of people)if(p!==player&&p.alive&&p.team===1){const delta=p.g.position.clone().sub(player.g.position);delta.y=0;const dist=delta.length();if(dist<best&&delta.normalize().dot(v)>-.2){best=dist;target=p}}if(target){damage(target,player.held==='umbrella'?45:player.held==='paddle'?38:player.held?32:17,player.g.position);say(player.held==='umbrella'?'מכה עם שמשייה!':player.held?'פגיעה עם חפץ!':'אגרוף!')}else say(player.held?'אין יריב בטווח':'אגרוף באוויר')}
const grainGeometry=new THREE.SphereGeometry(.06,5,4);
const grainMaterial=mat(0xf1d497);
function throwSand(){
 if(skiRide||!player.alive||player.cool>0)return;
 player.cool=.55;
 punchT=.8;
 const direction=camera.getWorldDirection(new THREE.Vector3());
 const origin=attackOrigin().addScaledVector(direction,.6);
 const hitBots=new Set();
 for(let i=0;i<20;i++){
  const mesh=new THREE.Mesh(grainGeometry,grainMaterial);
  const spread=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(.3);
  const velocity=direction.clone().add(spread).normalize().multiplyScalar(8+Math.random()*5);
  mesh.position.copy(origin);
  scene.add(mesh);
  visualParticles.push({mesh,velocity,life:.42+Math.random()*.18,hitBots});
 }
}
function hitWithSand(particle){
 for(const bot of people){
  if(!bot.bot||!bot.alive||bot.team!==1||particle.hitBots.has(bot))continue;
  const face=bot.g.position.clone().add(new THREE.Vector3(0,1.6,0));
  if(face.distanceToSquared(particle.mesh.position)>.55**2)continue;
  particle.hitBots.add(bot);
  damage(bot,5);
  if(bot.alive){
   bot.walking=false;
   bot.attackT=0;
   bot.boxing=null;
   bot.sandT=crewSandReaction(bot);
  }
  say('חול בעיניים!');
  return true;
 }
 return false;
}
function emitImpact(position,color=0xf2d38a,count=15){for(let i=0;i<count;i++){const particle=new THREE.Mesh(new THREE.SphereGeometry(.045+Math.random()*.055,6,5),mat(color,.72));particle.position.copy(position);scene.add(particle);visualParticles.push({mesh:particle,velocity:new THREE.Vector3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.25+Math.random()*.32})}}
function throwItem(){if(skiRide)return;if(!player.held){say('אסוף חפץ עם E');return}const type=player.held,obj=player.heldProp.mesh;player.g.remove(obj);const dir=new THREE.Vector3();camera.getWorldDirection(dir);obj.visible=true;obj.position.copy(attackOrigin()).addScaledVector(dir,.9);obj.rotation.set(0,0,0);scene.add(obj);const speed=['chair','umbrella'].includes(type)?12.5:16;thrownObjects.push({mesh:obj,type,velocity:dir.multiplyScalar(speed),previous:obj.position.clone(),bounces:0,hit:false,damage:type==='umbrella'?45:type==='paddle'?38:36});player.held=null;player.heldProp=null;setViewItem(null);heldText.textContent=`❤️ ${health}　|　🧺 אין חפץ`;punchT=.8;say(`${icon(type)} נזרק!`)}
function damage(p,n,from){p.hp-=n;p.stun=.32;p.hitT=.2;p.g.rotation.x=-.16;p.g.scale.set(1.18,.78,1.18);if(from){const push=p.g.position.clone().sub(from);push.y=0;if(push.lengthSq())p.g.position.addScaledVector(push.normalize(),.22)}p.g.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive){o.material.emissive.setHex(0x772222);setTimeout(()=>o.material.emissive.setHex(0),180)}});emitImpact(p.g.position.clone().add(new THREE.Vector3(0,1.15,0)),0xffd078,10);if(p===player){health=Math.max(0,p.hp);heldText.textContent=`❤️ ${Math.ceil(health)}　|　${player.held?icon(player.held)+' ביד':'🧺 אין חפץ'}`;const flash=document.querySelector('#damageFlash');flash.style.opacity='.9';setTimeout(()=>flash.style.opacity='0',180)}if(p.hp<=0){if(p.team===1&&from===player.g.position){credits+=25;showShop()}p.alive=false;p.boxing=null;if(crewFall(p)){setTimeout(()=>{if(!p.alive)p.g.visible=false},1350)}else p.g.visible=false;if(p.team===0)blackScore++;else blueScore++;document.querySelector('#score').textContent=`🔵 ${blueScore}　—　${blackScore} ⚫`;setTimeout(()=>{p.hp=100;p.alive=true;p.g.visible=true;p.g.position.set(Math.random()*14-7,0,p.team===0?13:-11);p.g.scale.set(1,1,1);p.g.rotation.x=0;p.hitT=0;p.sandT=0;if(p===player){health=100;heldText.textContent='❤️ 100　|　🧺 אין חפץ'}},5500)}}
function updateThrown(dt){
 for(let i=thrownObjects.length-1;i>=0;i--){
  const q=thrownObjects[i],o=q.mesh;if(q.settled){thrownObjects.splice(i,1);continue}q.trailClock=(q.trailClock||0)-dt;q.previous.copy(o.position);
  if(q.velocity.lengthSq()>.01){q.velocity.y-=10.5*dt;o.position.addScaledVector(q.velocity,dt);o.rotation.x+=dt*5.8;o.rotation.y+=dt*7;o.rotation.z+=dt*3.4;if(!q.hit&&q.trailClock<=0){q.trailClock=.055;const puff=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),mat(q.type==='volley'?0x5573c8:0xf0d7a0,.8));puff.position.copy(o.position);scene.add(puff);visualParticles.push({mesh:puff,velocity:q.velocity.clone().multiplyScalar(-.035),life:.16})}}
  if(!q.hit){
   for(const p of people){if(p===player||!p.alive||p.team!==1)continue;const center=p.g.position.clone().add(new THREE.Vector3(0,1.05,0)),segment=o.position.clone().sub(q.previous),denom=segment.lengthSq(),t=denom?clamp(center.clone().sub(q.previous).dot(segment)/denom,0,1):0,closest=q.previous.clone().addScaledVector(segment,t);if(closest.distanceToSquared(center)<.64){q.hit=true;q.velocity.multiplyScalar(.32);emitImpact(o.position.clone(),q.type==='volley'?0xf2dc65:0xf3dfb5,22);damage(p,q.damage,q.previous);say('החפץ פגע!');break}}
  }
  const ball=['ball','beachball','volley'].includes(q.type);const restY={cup:.16,ball:.28,beachball:.48,volley:.38,lid:.15,chair:.15}[q.type]??0;if(o.position.y<restY){o.position.y=restY;if(q.bounces<(ball?3:1)&&Math.abs(q.velocity.y)>1.4){q.velocity.y=Math.abs(q.velocity.y)*(ball?.58:.32);q.velocity.x*=.62;q.velocity.z*=.62;q.bounces++;emitImpact(o.position.clone(),0xe5c78c,7)}else{q.velocity.set(0,0,0);q.settled=true;props.push({mesh:o,type:q.type,taken:false})}}
 }
 for(let i=visualParticles.length-1;i>=0;i--){
  const particle=visualParticles[i];
  particle.life-=dt;
  particle.velocity.y-=8*dt;
  particle.mesh.position.addScaledVector(particle.velocity,dt);
  if(particle.life<=0||(particle.hitBots&&hitWithSand(particle))){
   scene.remove(particle.mesh);
   visualParticles.splice(i,1);
   continue;
  }
  particle.mesh.scale.setScalar(Math.max(.1,particle.life*2));
 }
}
for(const part of player.g.children)part.visible=false;
let slideRide=null;
const rideModes={
 Digit1:{name:'ECO',speed:15,acceleration:2.2},
 Digit2:{name:'SPORT',speed:23,acceleration:2.5},
 Digit3:{name:'BOOST',speed:34,acceleration:3},
 Digit4:{name:'BOOST+',speed:55.6,acceleration:3.2}
};
const rideStatus=document.querySelector('#ride-status');
let skiRide=null;
let credits=120, shopOpen=false;
const storeItems=[
 {label:'כדור ים',type:'beachball',cost:20},
 {label:'מטקה',type:'paddle',cost:35},
 {label:'שמשייה',type:'umbrella',cost:60},
 {label:'עזרה ראשונה',cost:45}
];
const shopPanel=document.createElement('div');
shopPanel.className='panel';shopPanel.hidden=true;
Object.assign(shopPanel.style,{position:'absolute',top:'28%',right:'32%',minWidth:'260px',whiteSpace:'pre-line',lineHeight:'1.8'});
document.querySelector('#hud').append(shopPanel);
function nearShop(){return Math.hypot(player.g.position.x+15,player.g.position.z+14)<4;}
function toggleShop(){
 if(!shopOpen&&!nearShop()){say('החנות ליד בית הקפה על החוף');return}
 shopOpen=!shopOpen;
 showShop();
}
function showShop(){
 shopPanel.hidden=!shopOpen;
 shopPanel.textContent='חנות החוף · 🪙 '+credits+'\n'+storeItems.map((item,i)=>(i+1)+' · '+item.label+' · '+item.cost).join('\n')+'\nB לסגירה';
}
function buy(index){
 const item=storeItems[index];
 if(!item||!nearShop()||!player.alive)return;
 if(credits<item.cost){say('אין מספיק מטבעות');return}
 if(!item.type&&player.hp>=100){say('החיים כבר מלאים');return}
 credits-=item.cost;
 if(!item.type){player.hp=Math.min(100,player.hp+45);health=player.hp;}
 else {
  const x=player.g.position.x+.7,z=player.g.position.z;
  if(item.type==='umbrella')props.push({mesh:umbrella(x,z,0x51a6ad,.8),type:item.type,taken:false});
  else addProp(item.type,x,z);
  say('החפץ לידך · E לאיסוף');
 }
 showShop();
}
function useJetSki(){
 if(slideRide||!player.alive)return false;
 if(skiRide){
  if(skiRide.mesh.position.z < -23){say('חזור לחוף כדי לרדת');return true}
  player.g.position.set(skiRide.mesh.position.x,0,-17.7);
  skiRide=null;
  return true;
 }
 const ski=resort.jetSkis.find(mesh=>mesh.position.distanceTo(player.g.position)<3);
 if(!ski)return false;
 skiRide={mesh:ski,speed:0,lift:0,verticalSpeed:0,jumpRequested:false,crestReady:true,sprayTime:0,rampHeight:0,mode:rideModes.Digit1,steering:ski.getObjectByName('RiptideSteering')??null};
 yaw=ski.rotation.y;
 pitch=-.15;
 say('1 אקו · 2 ספורט · 3 בוסט · 4 בוסט פלוס');
 return true;
}
function updateJetSkis(dt){
 ocean.time.value+=dt;
 const time=ocean.time.value;
 let wakePower=0;
 const ride=skiRide;
 if(ride&&!player.alive)skiRide=null;
 if(ride&&skiRide){
  const ski=ride.mesh;
  const throttle=Number(!!keys.KeyW)-Number(!!keys.KeyS);
  const steer=Number(!!keys.KeyA)-Number(!!keys.KeyD);
  ride.speed=THREE.MathUtils.damp(ride.speed,throttle*(throttle>0?ride.mode.speed:3),ride.mode.acceleration,dt);
  const turn=steer*dt*(.6+Math.min(14,Math.abs(ride.speed))*.10);
  ski.rotation.y+=turn;
  yaw+=turn;
  const dx=-Math.sin(ski.rotation.y),dz=-Math.cos(ski.rotation.y);
  const edge=oceanBounds.halfWidth-12;
  const {x,z}=ski.position;
  ski.position.x=clamp(ski.position.x+dx*ride.speed*dt,-edge,edge);
  ski.position.z=clamp(ski.position.z+dz*ride.speed*dt,oceanBounds.farZ+12,oceanBounds.shoreZ-.1);
  ride.travelSpeed=dt>0?Math.hypot(ski.position.x-x,ski.position.z-z)/dt:0;
  ski.rotation.z=THREE.MathUtils.damp(ski.rotation.z,-steer*ride.speed*.021,5,dt);
  if(ride.steering)ride.steering.rotation.y=THREE.MathUtils.damp(ride.steering.rotation.y,steer*.33,10,dt);
  ocean.wake.value.set(ski.position.x,ski.position.z,dx,dz);
  const crest=waveHeight(ski.position.x,ski.position.z,time);
  const ramp=ride.lift===0?waterPark?.rampAt(ski,x,z):null;
  ride.rampHeight=ramp?.height??0;
  if(ramp?.launch){
   ride.rampHeight=0;
   ride.lift=Math.max(.01,.25+ramp.height-(ski.userData.waterY??.25+crest));
   ride.verticalSpeed=clamp(2+ride.travelSpeed*.16,2,8);
   ride.crestReady=false;
  }
  if(crest<.12)ride.crestReady=true;
  const crestJump=ride.travelSpeed>11&&crest>.19&&ride.crestReady;
  if(!ramp&&ride.lift===0&&ride.speed>0&&ride.travelSpeed>4&&(ride.jumpRequested||crestJump)){
   ride.verticalSpeed=2.4+ride.speed*.14;
   ride.lift=.01;
   ride.crestReady=false;
  }
  ride.jumpRequested=false;
  if(ride.lift>0){
   ride.verticalSpeed-=9.8*dt;
   ride.lift+=ride.verticalSpeed*dt;
   if(ride.lift<=0){
    ride.lift=0;
    ride.verticalSpeed=0;
    const {x,z}=ski.position;
    waterPark?.spray(x,.08+crest,z,ski.rotation.y,1.9,true);
    waterPark?.spray(x,.08+crest,z,ski.rotation.y+Math.PI,1.65,true);
    emitImpact(new THREE.Vector3(x,.08+crest,z),0xd6f6ff,18);
   }
  }
  if(ride.lift===0&&!ramp&&ride.travelSpeed>3){
   ride.sprayTime-=dt;
   if(ride.sprayTime<=0){
    const rearX=ski.position.x-dx*1.45,rearZ=ski.position.z-dz*1.45;
    const scale=clamp(.7+ride.travelSpeed*.025,.8,1.85);
    waterPark?.spray(rearX,.08+waveHeight(rearX,rearZ,time),rearZ,ski.rotation.y,scale);
    ride.sprayTime=.15-Math.min(ride.travelSpeed,55.6)*.0012;
   }
  }
  wakePower=ride.lift>0||ramp?0:Math.min(1,ride.travelSpeed/9);
 }
 ocean.wakePower.value=THREE.MathUtils.damp(ocean.wakePower.value,wakePower,9,dt);
 for(const ski of resort.jetSkis){
  const {x,z}=ski.position;
  const ridden=skiRide?.mesh===ski;
  const airborne=ridden?skiRide.lift:0;
  if(!ridden){
   ski.rotation.z=THREE.MathUtils.damp(ski.rotation.z,0,5,dt);
   const steering=ski.getObjectByName('RiptideSteering');
   if(steering)steering.rotation.y=THREE.MathUtils.damp(steering.rotation.y,0,10,dt);
  }
  const waterY=.25+waveHeight(x,z,time);
  ski.userData.waterY=THREE.MathUtils.damp(ski.userData.waterY??waterY,waterY,9,dt);
  const deckY=ridden&&skiRide.rampHeight>0?.25+skiRide.rampHeight:0;
  ski.position.y=Math.max(ski.userData.waterY,deckY)+airborne;
  const dx=-Math.sin(ski.rotation.y),dz=-Math.cos(ski.rotation.y);
  const slope=waveHeight(x+dx,z+dz,time)-waveHeight(x-dx,z-dz,time);
  const tilt=airborne>0?skiRide.verticalSpeed*.045:ridden&&skiRide.rampHeight>0?Math.atan(.2):slope*.45;
  ski.rotation.x=THREE.MathUtils.damp(ski.rotation.x,tilt,8,dt);
 }
 rideStatus.hidden=!skiRide;
 if(skiRide){
  player.g.position.copy(skiRide.mesh.position);
  player.g.position.y-=.42;
  const speed=Math.round((skiRide.travelSpeed??0)*3.6);
  const label=`${skiRide.mode.name} · ${speed} km/h`;
  if(rideStatus.textContent!==label)rideStatus.textContent=label;
 }
}
function boardSlide(){
 if(slideRide)return true;
 const {x,y,z}=player.g.position;
 const slide=resort.slides.find(entry=>y>4.8&&Math.abs(x-entry.x)<1.5&&Math.abs(z-entry.z)<1.15);
 if(!slide)return false;
 slideRide={slide,progress:0};
 say('גולשים!');
 return true;
}
function updateTraversal(move,dt){
 updateJetSkis(dt);
 if(skiRide)return;
 if(slideRide){
  const ride=slideRide;
  ride.progress=Math.min(1,ride.progress+dt*(.22+ride.progress*.24));
  const point=ride.slide.path.getPointAt(ride.progress);
  const direction=ride.slide.path.getTangentAt(ride.progress);
  player.g.position.copy(point);
  yaw=Math.atan2(-direction.x,-direction.z);
  pitch=-.15;
  if(ride.progress===1){
   emitImpact(point,0x86d7ee,24);
   slideRide=null;
   player.g.position.y=0;
  }
  return;
 }
 player.g.position.add(move);
 const pos=player.g.position;
 if(shopOpen&&!nearShop()){shopOpen=false;showShop();}
 if(pos.z<oceanBounds.shoreZ&&pos.z>oceanBounds.farZ&&Math.abs(pos.x)<oceanBounds.halfWidth){
  const depth=Math.min(4.2,(-19-pos.z)*.28);
  if(keys.ControlLeft||keys.ControlRight)pos.y-=2.7*dt;
  else if(keys.Space)pos.y+=2.7*dt;
  else if(depth<1)pos.y=THREE.MathUtils.damp(pos.y,-depth,7,dt);
  pos.y=clamp(pos.y,-depth,0);
  return;
 }
 let floor=0;
 for(const slide of resort.slides){
  const onStairs=Math.abs(pos.x-(slide.x-1.5))<.65&&pos.z<=slide.z+6.1&&pos.z>=slide.z-.25;
  if(onStairs)floor=Math.max(floor,clamp(slide.z+6-pos.z,0,6)*.91);
  const onDeck=Math.abs(pos.x-(slide.x-.5))<1.7&&Math.abs(pos.z-slide.z)<1.2;
  if(onDeck&&pos.y>4.6)floor=5.64;
 }
 pos.y=THREE.MathUtils.damp(pos.y,floor,16,dt);
}
let frameCost=1/60, qualityTime=0;
function adaptResolution(rawDt){
 if(rawDt>.25)return;
 frameCost=THREE.MathUtils.lerp(frameCost,rawDt,.035);
 qualityTime+=rawDt;
 if(qualityTime<2.2)return;
 qualityTime=0;
 const ratio=renderer.getPixelRatio();
 if(frameCost>1/38&&ratio>.67)renderer.setPixelRatio(Math.max(.65,ratio*.83));
}
const controls={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'};
window.addEventListener('beach-lobby-open',()=>{keys={};});
window.addEventListener('blur',()=>{keys={};});
const online=connectPlayers({
 spawn(snapshot){
  const peer=person(snapshot.team,snapshot.x,snapshot.z);
  people.pop();
  return peer;
 },
 remove(peer){scene.remove(peer.g);},
 state(){const {x,y,z}=player.g.position;return {x,y,z,yaw,alive:player.alive};},
 hit(){if(player.alive)damage(player,17);},
 status(message){document.querySelector('#status').textContent=message;}
});
function updateOnline(dt){
 online.tick();
 for(const peer of online.peers.values()){
  const s=peer.snapshot;
  attachCrew(peer);
  peer.g.visible=s.alive;
  peer.walking=Math.hypot(s.x-peer.g.position.x,s.z-peer.g.position.z)>.06;
  peer.g.position.lerp(new THREE.Vector3(s.x,s.y,s.z),1-Math.exp(-13*dt));
  peer.g.rotation.y=Math.PI+s.yaw;
  animateBody(peer,dt);
 }
}
function hitOnline(direction){
 let target=null,range=3;
 for(const [id,peer] of online.peers){
  if(peer.snapshot.team===online.team||!peer.snapshot.alive)continue;
  const delta=peer.g.position.clone().sub(player.g.position), distance=delta.length();
  if(distance<range&&delta.dot(direction)>0){target=id;range=distance;}
 }
 if(target){online.attack(target);return true}
 return false;
}
function animateBody(p,dt){if(animateCrew(p,dt))return;if(p.alive&&p.sandT>0){for(const arm of p.arms)arm.rotation.x=-1.5;return}p.gait=THREE.MathUtils.damp(p.gait??0,p.walking?1:0,9,dt);p.walkPhase+=dt*(2.2+7.8*p.gait);const stride=Math.sin(p.walkPhase)*.58*p.gait;p.legs[0].rotation.x=stride;p.legs[1].rotation.x=-stride;const armSwing=Math.sin(p.walkPhase)*.42*p.gait;p.arms[0].rotation.x=-armSwing;p.arms[1].rotation.x=armSwing;if(p.attackT>0){p.attackT=Math.max(0,p.attackT-dt);p.arms[1].rotation.x=-Math.sin(p.attackT/.32*Math.PI)*1.15}}
const rideEye=new THREE.Vector3(0,1.38,.64);
const shoulderOffset=new THREE.Vector3();
function attackOrigin(){
 if(!thirdPerson)return camera.position.clone();
 const eye=player.g.position.clone();
 eye.y+=1.68;
 return eye;
}
function updateCamera(){
 if(skiRide){
  const ski=skiRide.mesh;
  ski.localToWorld(camera.position.copy(rideEye));
  const ridePitch=clamp(pitch+ski.rotation.x*.6,ridePitchMin,ridePitchMax);
  camera.rotation.set(ridePitch,yaw,ski.rotation.z*.65);
 }else{
  camera.position.copy(player.g.position);
  camera.position.y+=1.68;
  camera.rotation.set(pitch,yaw,0);
 }
 if(thirdPerson){
  const floor=camera.position.y-.55;
  shoulderOffset.set(.58,.58,skiRide?5.4:3.6).applyQuaternion(camera.quaternion);
  camera.position.add(shoulderOffset);
  camera.position.y=Math.max(floor,camera.position.y);
 }
}
camera.rotation.order='YXZ';
const clock=new THREE.Clock();function update(dt){player.cool=Math.max(0,player.cool-dt);punchT=Math.max(0,punchT-dt*5.2);player.g.rotation.y=Math.PI+(skiRide?.mesh.rotation.y??yaw);updateCamera();const moving=keys[controls.forward]||keys[controls.back]||keys[controls.left]||keys[controls.right];player.walking=moving&&!skiRide;
if(player.character){
 const {root}=player.character;
 root.visible=thirdPerson;
}
if(player.heldProp)player.heldProp.mesh.visible=thirdPerson&&!skiRide;
const useFists=Boolean(firstPersonFists&&player.alive&&!skiRide);
viewItem.visible=Boolean(player.held&&player.alive&&!skiRide&&!thirdPerson);
if(viewItem.visible&&!useFists)viewItem.position.set(.82,-.66,-1.03);
firstPersonFists?.update(dt,useFists,moving,punchT,viewItem.visible?viewItem:null,!thirdPerson);
viewHand.visible=leftHand.visible=player.alive&&!useFists&&!skiRide&&!thirdPerson;
viewHand.rotation.x=-.32*punchT;viewHand.rotation.z=moving?Math.sin(performance.now()*.012)*.045:0;viewHand.position.z=-.38*punchT;viewHand.position.y=moving?Math.abs(Math.sin(performance.now()*.012))*.035:0;leftHand.position.z=-.13*punchT;leftHand.position.y=moving?Math.abs(Math.sin(performance.now()*.012+1))*.025:0;updateThrown(dt);
camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.set(1,0,0).applyQuaternion(camera.quaternion);right.y=0;right.normalize();const move=new THREE.Vector3();if(keys[controls.forward])move.add(forward);if(keys[controls.back])move.sub(forward);if(keys[controls.right])move.add(right);if(keys[controls.left])move.sub(right);if(move.lengthSq())move.normalize().multiplyScalar((keys.ShiftLeft?7.3:4.8)*dt);updateTraversal(move,dt);
waterPark?.update(dt);
firstPersonFists?.ride(thirdPerson?null:skiRide?.steering??null);
if(player.character){
 const root=player.character.root;
 if(!root.userData.standingPosition)root.userData.standingPosition=root.position.clone();
 root.position.copy(root.userData.standingPosition);
 if(skiRide){root.position.y+=.87;root.position.z-=.54;}
 root.rotation.z=skiRide?skiRide.mesh.rotation.z*.6:0;
}updateOnline(dt);const diving=camera.position.y<.15;if(blenderSea)blenderSea(dt,diving);else {fallbackSea.visible=diving;if(diving)animateSeaLife(ocean.time.value);}
for(const p of people){if(p.hitT>0){p.hitT=Math.max(0,p.hitT-dt);const k=p.hitT/.2;p.g.scale.set(1+.18*k,1-.22*k,1+.18*k);p.g.rotation.x=-.16*k}else{p.g.scale.set(1,1,1);p.g.rotation.x=0}animateBody(p,dt);if(!p.bot||!p.alive)continue;if(p.stroll){const route=p.stroll;route.phase+=dt*.38;const x=route.x+Math.cos(route.phase)*3,z=route.z+Math.sin(route.phase)*2;p.g.rotation.y=Math.atan2(x-p.g.position.x,z-p.g.position.z);p.g.position.set(x,Math.abs(Math.sin(p.walkPhase))*.028,z);p.walking=true;continue}p.cool-=dt;p.stun=Math.max(0,p.stun-dt);if(p.sandT>0){p.sandT=Math.max(0,p.sandT-dt);continue}
const inArena=player.alive&&Math.abs(player.g.position.x)<10&&player.g.position.z>-9&&player.g.position.z<10;
if(p.boxing){
 const boxing=p.boxing, target=boxing.target;
 if(!advanceCrewBoxing(p,boxing,()=>{
  if(!inArena||p.stun>0||!target.alive)return;
  const delta=target.g.position.clone().sub(p.g.position);
  const yaw=p.g.rotation.y;
  if(delta.lengthSq()<=1.45**2&&delta.x*Math.sin(yaw)+delta.z*Math.cos(yaw)>=0){
   damage(target,p.drunk?8:11,p.g.position);
  }
 }))p.boxing=null;
 continue;
}
if(p.stun>0){p.walking=false;continue}const enemies=inArena?people.filter(q=>q.team<2&&q.team!==p.team&&q.alive):[];if(!enemies.length){p.walking=false;continue}let target=enemies.reduce((a,b)=>p.g.position.distanceTo(a.g.position)<p.g.position.distanceTo(b.g.position)?a:b);let delta=target.g.position.clone().sub(p.g.position);delta.y=0;let d=delta.length();if(d>1.25){p.walking=true;delta.normalize();let wobble=p.drunk?Math.sin(performance.now()*.003+p.id)*.36:0;const speed=p.drunk?1.65:2.25;p.g.position.addScaledVector(new THREE.Vector3(delta.x+wobble,0,delta.z).normalize(),dt*speed);p.g.rotation.y=Math.atan2(delta.x,delta.z);p.g.position.y=Math.abs(Math.sin(performance.now()*.009+p.id))*.045}else{p.walking=false;if(p.cool<=0){p.g.rotation.y=Math.atan2(delta.x,delta.z);
 const boxing=startCrewBoxing(p);
 if(boxing){
  p.boxing={...boxing,target};
  p.cool=boxing.action.getClip().duration+.25+Math.random()*.35;
 }else{
  p.cool=.9+Math.random()*.5;
  p.attackT=.32;
  damage(target,p.drunk?8:11,p.g.position);
 }}}}
heldText.textContent=`❤️ ${Math.max(0,Math.ceil(player.hp))}　|　${player.held?icon(player.held)+' ביד':'🧺 אין חפץ'}`;
// keep the shoreline animated
}
function frame(){requestAnimationFrame(frame);const rawDt=clock.getDelta();adaptResolution(rawDt);let dt=Math.min(rawDt,.04);update(dt);updateCamera();const underwater=camera.position.y<-.13;sky.visible=!underwater;if(underwater)scene.background.setHex(0x276d7c);else scene.background.setRGB(...blenderLook.worldColor);scene.fog.color.copy(scene.background);scene.fog.near=underwater?1:48;scene.fog.far=underwater?19:115;sky.position.copy(camera.position);renderer.render(scene,camera)}frame();
installBlenderWorld(scene,resort,props).then(tick=>{document.querySelector("#build-status").textContent="גרסה 27 · חוף וטקסטורות Blender נטענו";blenderSea=tick;scene.remove(fallbackSea,fallbackWetSand,seabed);plane.position.y=-.25;renderer.shadowMap.needsUpdate=true}).catch(error=>{console.warn('Could not load Blender world:',error);document.querySelector('#build-status').textContent='גרסה 27 · טעינת Blender נכשלה (מפה חלופית)';Object.assign(resort,buildResort(scene));for(const prop of resort.pickups)props.push({...prop,taken:false});renderer.shadowMap.needsUpdate=true});
loadFirstPersonFists(camera).then(fists=>{firstPersonFists=fists}).catch(error=>console.warn('Could not load Blender fists:',error));
loadWaterPark(scene).then(park=>{waterPark=park;renderer.shadowMap.needsUpdate=true}).catch(error=>console.warn('Could not load water park:',error));
loadCrew().then(()=>people.forEach(attachCrew)).catch(error=>console.warn('Could not load Blender crew:',error));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
