import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import {poseJetTrick} from './jet-tricks.js';
import mountain from './snow-mountain.glb';
import cabin from './snow-gondola.glb';
import skis from './snow-skis.glb';
import board from './snow-board.glb';
import coast from './coast-renewal.glb';

const clamp=THREE.MathUtils.clamp;
const ramps=[-393,-345,-292,-240,-185,-132];
const gearOptions=[
 {label:'סקי',price:35,maxSpeed:34},
 {label:'סנובורד',price:45,maxSpeed:29}
];
const bottom={x:-86,z:57},top={x:-427,z:57};

export function snowHeight({x,z}){
 const rise=clamp((-x-75)/345,0,1)*clamp((x+490)/41,0,1);
 const bank=Math.max(0,1-Math.max(0,Math.abs(z-70)-22)/73);
 const rock=(Math.sin(x*.091)+Math.cos(z*.14))*3*clamp((Math.abs(z-70)-14)/26,0,1);
 return rise*bank**.77*(143+rock);
}

function sign(scene,label,x,y,z){
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=100;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#102c43';ctx.fillRect(0,0,512,100);
 ctx.fillStyle='#edf9ff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 38px Arial';
 ctx.fillText(label,256,50);
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 const marker=new THREE.Sprite(new THREE.SpriteMaterial({map}));
 marker.position.set(x,y,z);
 marker.scale.set(8,1.56,1);
 scene.add(marker);
}

export async function loadSnowResort(scene,{notify,credits,spend,heading}){
 const [land,liftAsset,skiAsset,boardAsset,coastAsset]=await Promise.all(
  [mountain,cabin,skis,board,coast].map(loadModel)
 );
 land.scene.traverse(node=>{if(node.isMesh)node.receiveShadow=true;});
 coastAsset.scene.traverse(node=>{if(node.isMesh)node.castShadow=node.receiveShadow=true;});
 scene.add(land.scene,coastAsset.scene);
 sign(scene,'← אתר הסקי',-16,2.7,9);
 sign(scene,'← אתר הסקי',-45,2.6,34);
 sign(scene,'רכבל · E',bottom.x,snowHeight(bottom)+3.1,bottom.z);
 sign(scene,'חנות ציוד · B',-431,snowHeight(top)+3.3,80);
 sign(scene,'התחלת מסלול · E',-425,snowHeight(top)+2.8,70);
 const cabinModel=liftAsset.scene;
 scene.add(cabinModel);
 const sled=new THREE.Group(),pivot=new THREE.Group();
 const equipment=[skiAsset.scene,boardAsset.scene];
 sled.add(pivot);
 pivot.add(...equipment);
 sled.visible=false;
 scene.add(sled);
 const hud=document.createElement('div');
 hud.className='panel';
 hud.hidden=true;
 Object.assign(hud.style,{position:'absolute',top:'26%',right:'32%',whiteSpace:'pre-line'});
 document.querySelector('#hud').append(hud);
 const foot=new THREE.Vector3(),origin=new THREE.Vector3();
 const near=(p,x,z,r)=>Math.hypot(p.x-x,p.z-z)<r;
 let lift=null,ride=null,owned=null,shopOpen=false;
 const purchased=new Set();
 function cabinAt(fraction){
  foot.set(THREE.MathUtils.lerp(bottom.x,top.x,fraction),0,57);
  foot.y=snowHeight(foot)+5.6;
  cabinModel.position.copy(foot);
 }
 cabinAt(0);
 function stop(){
  ride=null;
  sled.visible=false;
  poseJetTrick(pivot,null,1);
 }
 function showShop(){
  hud.hidden=!shopOpen;
  if(shopOpen)hud.textContent='חנות הפסגה · 🪙 '+credits()+'\n'+gearOptions.map((g,i)=>(i+1)+' · '+g.label+' · '+g.price).join('\n')+'\nB לסגירה · E בתחילת המסלול';
 }
 return {
  get ride(){return ride;},
  get liftRiding(){return Boolean(lift);},
  get travelling(){return Boolean(ride||lift);},
  get shopOpen(){return shopOpen;},
  interact(position){
   if(lift)return true;
   if(ride){stop();notify('ירדת מהציוד');return true;}
   const atBase=near(position,bottom.x,bottom.z,5);
   const atTop=near(position,top.x,top.z,5);
   if(atBase||atTop){
    shopOpen=false;showShop();
    lift={progress:0,up:atBase};
    cabinAt(atBase?0:1);
    heading(atBase?Math.PI/2:-Math.PI/2);
    notify(atBase?'הרכבל עולה לפסגה':'הרכבל יורד לחוף');
    return true;
   }
   if(!near(position,-425,70,8))return false;
   if(owned===null){notify('קנה ציוד בחנות הפסגה · B');return true;}
   shopOpen=false;showShop();
   ride={mesh:sled,visual:pivot,snow:true,board:owned===1,speed:0,flightTime:0,
    flightDuration:0,verticalSpeed:0,airborne:false,requestedJump:false};
   equipment.forEach((model,i)=>{model.visible=i===owned;});
   sled.visible=true;
   sled.position.copy(position);
   heading(-Math.PI/2);
   notify('W האצה · A/D היגוי · S בלימה · רווח קפיצה · H טריקים');
   return true;
  },
  shop(position){
   if(lift||ride||!near(position,-431,81,10))return false;
   shopOpen=!shopOpen;showShop();
   return true;
  },
  buy(index){
   const gear=gearOptions[index];
   if(!shopOpen||!gear)return;
   if(!purchased.has(index)&&!spend(gear.price)){notify('אין מספיק מטבעות');return;}
   purchased.add(index);
   owned=index;
   notify(gear.label+' מוכן · לחץ E בתחילת המסלול');
   showShop();
  },
  jump(){if(ride)ride.requestedJump=true;},
  choose(trick){
   if(!ride||!trick)return;
   const remaining=ride.flightDuration-ride.flightTime;
   if(ride.airborne&&!ride.activeTrick&&remaining>.4){
    ride.activeTrick=trick;
    ride.trickStart=ride.flightTime;
    ride.trickDuration=remaining*.72;
   }else if(!ride.airborne)ride.requestedJump=true;
  },
  step(dt,position,keys,trick,alive){
   if(!alive){lift=null;stop();shopOpen=false;showShop();return false;}
   if(shopOpen&&!near(position,-431,81,10)){shopOpen=false;showShop();}
   if(lift){
    lift.progress=Math.min(1,lift.progress+dt/15);
    cabinAt(lift.up?lift.progress:1-lift.progress);
    position.copy(foot);
    if(lift.progress===1){
     position.set(lift.up?-428:-85,0,lift.up?68:62);
     position.y=snowHeight(position);
     notify(lift.up?'הגעת לפסגה · B בחנות · E בתחילת המסלול':'הגעת לתחנה התחתונה');
     lift=null;
    }
    return true;
   }
   if(!ride)return false;
   const steer=Number(Boolean(keys.KeyD))-Number(Boolean(keys.KeyA));
   const maxSpeed=gearOptions[owned].maxSpeed;
   const downhill=snowHeight(position)>1&&position.x> -420;
   const target=keys.KeyS?0:keys.KeyW?maxSpeed:downhill?maxSpeed*.58:0;
   ride.speed=THREE.MathUtils.damp(ride.speed,target,keys.KeyS?5:1.4,dt);
   origin.copy(position);
   position.x+=ride.speed*dt;
   position.z=clamp(position.z+steer*Math.min(11,ride.speed*.46)*dt,41,99);
   const ramp=ramps.find(x=>Math.abs(position.z-70)<4&&position.x>=x&&position.x<x+6);
   const lip=ramps.find(x=>Math.abs(position.z-70)<4&&origin.x<x+6&&position.x>=x+6);
   const ground=snowHeight(position);
   if(!ride.airborne&&(ride.requestedJump||lip!==undefined&&ride.speed>6)){
    ride.airborne=true;
    ride.activeTrick=trick;
    ride.flightTime=0;
    ride.verticalSpeed=lip!==undefined?6.3:4.8;
    ride.flightDuration=ride.verticalSpeed*2/9.8+.28;
    ride.trickStart=0;
    ride.trickDuration=ride.flightDuration*.72;
   }
   ride.requestedJump=false;
   if(ride.airborne){
    ride.flightTime+=dt;
    ride.verticalSpeed-=9.8*dt;
    position.y+=ride.verticalSpeed*dt;
    if(ride.verticalSpeed<0&&position.y<=ground){
     position.y=ground;
     ride.airborne=false;
     ride.flightDuration=0;
     if(ride.activeTrick)notify('טריק שלג · נחיתה!');
     ride.activeTrick=null;
    }
   }else{
    position.y=ground+(ramp===undefined?0:(position.x-ramp)*1.6/6);
   }
   sled.position.copy(position);
   sled.rotation.set(ride.airborne?0:downhill?.37:0,-Math.PI/2-steer*.27,-steer*.13,'YXZ');
   const trickProgress=ride.activeTrick?(ride.flightTime-ride.trickStart)/ride.trickDuration:1;
   poseJetTrick(pivot,ride.activeTrick,trickProgress);
   if(position.x>=-73){stop();notify('סיימת את המסלול · הרכבל ליד התחנה התחתונה');}
   return true;
  }
 };
}
