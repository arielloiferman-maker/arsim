import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import {poseJetTrick} from './jet-tricks.js';
import mountain from './snow-mountain.glb';
import cabin from './snow-gondola.glb';
import skis from './snow-skis.glb';
import board from './snow-board.glb';
import {layout,snowHeight,trailAt,rampHeight,crossedRamp} from './alpine-layout.js';
export {snowHeight} from './alpine-layout.js';

const clamp=THREE.MathUtils.clamp;
const gearOptions=[
 {label:'סקי',price:35,maxSpeed:40,board:false},
 {label:'סנובורד',price:45,maxSpeed:35,board:true},
 {label:'סקי מרוץ',price:135,maxSpeed:57,board:false},
 {label:'סנובורד פריסטייל',price:145,maxSpeed:49,board:true}
];
const bottom=layout.base,top=layout.summit;
const {x:shopX,z:shopZ}=layout.shop;

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

export async function loadSnowResort(scene,{notify,credits,spend,earn,heading}){
 const [land,liftAsset,skiAsset,boardAsset]=await Promise.all(
  [mountain,cabin,skis,board].map(loadModel)
 );
 land.scene.traverse(node=>{if(node.isMesh)node.castShadow=node.receiveShadow=true;});
 scene.add(land.scene);
 sign(scene,'לאתר הסקי · E',layout.shuttle.x,2.7,layout.shuttle.z);
 sign(scene,'אתר הסקי ↑',-94,3,70);
 sign(scene,'רכבל · E',bottom.x,snowHeight(bottom)+3.1,bottom.z);
 sign(scene,'לחוף · E',bottom.x-15,snowHeight({x:bottom.x-15,z:bottom.z})+3.1,bottom.z);
 sign(scene,'חנות ציוד · B',shopX,snowHeight(layout.shop)+3.3,shopZ);
 sign(scene,'רכבל לפסגה · E',-100,snowHeight({x:-100,z:140})+3,140);
 for(const trail of layout.trails){
  const [x,z]=trail.points[3];
  sign(scene,(trail.id+1)+' · '+trail.name,x,snowHeight({x,z})+4,z);
 }
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
 let lift=null,ride=null,owned=null,shopOpen=false,selectedRoute=5;
 const status=document.createElement('div');status.className='panel';status.hidden=true;
 Object.assign(status.style,{position:'absolute',top:'115px',left:'18px',fontSize:'14px',whiteSpace:'pre-line',maxWidth:'340px'});
 document.querySelector('#hud').append(status);
 const spray=makeSnowSpray(scene);
 const purchased=new Set();
 function cabinAt(fraction){
  foot.set(THREE.MathUtils.lerp(bottom.x,top.x,fraction),0,THREE.MathUtils.lerp(bottom.z,top.z,fraction));
  foot.y=snowHeight(foot)+17.6;
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
  nextRoute(position){
   if(ride||lift||!near(position,-100,top.z,200))return false;
   selectedRoute=(selectedRoute+1)%layout.trails.length;
   const route=layout.trails[selectedRoute];
   notify((selectedRoute+1)+' · '+route.name+' · '+route.difficulty+' · '+route.length+' מ׳ · E להתחלה');
   return true;
  },
  get liftRiding(){return Boolean(lift);},
  get travelling(){return Boolean(ride||lift);},
  get shopOpen(){return shopOpen;},
  interact(position){
   if(lift)return true;
   if(ride){stop();notify('ירדת מהציוד');return true;}
   if(near(position,layout.shuttle.x,layout.shuttle.z,5)){
    position.set(bottom.x,0,bottom.z-7);position.y=snowHeight(position);
    heading(Math.PI);notify('הגעת לאתר הסקי · E לרכבל');return true;
   }
   if(near(position,bottom.x-15,bottom.z,5)){
    position.set(layout.shuttle.x,0,layout.shuttle.z-4);heading(0);notify('חזרת לחוף');return true;
   }
   const atBase=near(position,bottom.x,bottom.z,12)||near(position,-100,140,15);
   const atTop=near(position,top.x,top.z,5);
   if(atBase||atTop){
    shopOpen=false;showShop();
    lift={progress:0,up:atBase};
    cabinAt(atBase?0:1);
    heading(atBase?Math.PI:0);
    notify(atBase?'הרכבל עולה לפסגה':'הרכבל יורד לתחנת העמק');
    return true;
   }
   if(!near(position,-100,top.z,200)||position.z<1380)return false;
   if(owned===null){notify('קנה ציוד בחנות הפסגה · B');return true;}
   shopOpen=false;showShop();
   ride={mesh:sled,visual:pivot,snow:true,angle:0,board:gearOptions[owned].board,speed:0,flightTime:0,
    flightDuration:0,verticalSpeed:0,airborne:false,requestedJump:false};
   equipment.forEach((model,i)=>{model.visible=i===Number(ride.board);});
   sled.visible=true;
   const [x,z]=layout.trails[selectedRoute].points[3];
   position.set(x,snowHeight({x,z}),z);
   sled.position.copy(position);
   heading(0,true);
   notify('W האצה · A/D היגוי · S בלימה · רווח קפיצה · Z טריקים');
   return true;
  },
  shop(position){
   if(lift||ride||!near(position,shopX,shopZ,22))return false;
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
   spray(dt,ride,position);
   const atSummit=near(position,-100,top.z,200)&&position.z>1380;
   status.hidden=!(ride||lift||atSummit);
   if(ride){
    const route=trailAt(position);
    status.textContent=(route?route.name+' · '+route.difficulty:'גלישה חופשית')+'\n'+Math.round(ride.speed*3.6)+' קמ״ש · '+Math.round(position.y)+' מ׳\nZ טריקים · V מבט · E ירידה';
   }else if(lift)status.textContent='רכבל לפסגה · '+Math.round(lift.progress*100)+'%';
   else if(atSummit){
    const route=layout.trails[selectedRoute];
    status.textContent='מסלול '+(selectedRoute+1)+'/12 · '+route.name+'\n'+route.difficulty+' · '+route.length+' מ׳\nR מסלול הבא · E להתחלה · B חנות';
   }
   if(!alive){lift=null;stop();shopOpen=false;showShop();return false;}
   if(shopOpen&&!near(position,shopX,shopZ,22)){shopOpen=false;showShop();}
   if(lift){
    lift.progress=Math.min(1,lift.progress+dt/34);
    cabinAt(lift.up?lift.progress:1-lift.progress);
    position.copy(foot);
    if(lift.progress===1){
     position.set(lift.up?top.x:bottom.x,0,lift.up?top.z+12:bottom.z-10);
     position.y=snowHeight(position);
     notify(lift.up?'הגעת לפסגה · B ציוד · R בחירת מסלול · E התחלה':'הגעת לתחנה התחתונה');
     lift=null;
    }
    return true;
   }
   if(!ride)return false;
   const steer=Number(Boolean(keys.KeyD))-Number(Boolean(keys.KeyA));
   const maxSpeed=gearOptions[owned].maxSpeed;
   const downhill=snowHeight(position)>1&&position.z<1435;
   const target=keys.KeyS?0:keys.KeyW?maxSpeed:downhill?maxSpeed*.58:0;
   ride.speed=THREE.MathUtils.damp(ride.speed,target,keys.KeyS?5:1.4,dt);
   origin.copy(position);
   ride.angle=THREE.MathUtils.damp(ride.angle,steer*1.02,3.8,dt);
   position.x+=Math.sin(ride.angle)*ride.speed*dt;
   position.z-=Math.cos(ride.angle)*ride.speed*dt;
   const ramp=rampHeight(position);
   const lip=crossedRamp(origin,position);
   const ground=snowHeight(position);
   if(!ride.airborne&&(ride.requestedJump||Boolean(lip)&&ride.speed>6)){
    ride.airborne=true;
    ride.activeTrick=trick;
    ride.flightTime=0;
    ride.verticalSpeed=lip?6.3:4.8;
    position.y=Math.max(position.y,ground+(lip?lip.height:0));
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
     if(ride.activeTrick&&ride.flightTime-ride.trickStart>=ride.trickDuration){
      earn(100);
      notify('טריק שלג הושלם · 100+ מטבעות');
     }
     ride.activeTrick=null;
    }
   }else{
    position.y=ground+ramp;
   }
   sled.position.copy(position);
   const ahead={x:position.x+Math.sin(ride.angle)*2,z:position.z-Math.cos(ride.angle)*2};
   const slope=Math.atan2(ground-snowHeight(ahead),2);
   sled.rotation.set(ride.airborne?0:-clamp(slope,-.65,.75),-ride.angle,-steer*.13,'YXZ');
   const trickProgress=ride.activeTrick?(ride.flightTime-ride.trickStart)/ride.trickDuration:1;
   poseJetTrick(pivot,ride.activeTrick,trickProgress);
   if(position.z<=140){position.y=snowHeight(position);stop();notify('סיימת את המסלול · E ליד השלט לרכבל');}
   return true;
  }
 };
}

function makeSnowSpray(scene){
 const count=220,positions=new Float32Array(count*3),lives=new Float32Array(count),velocities=new Float32Array(count*3);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');
 const fade=ctx.createRadialGradient(16,16,0,16,16,16);fade.addColorStop(0,'rgba(230,243,255,.6)');fade.addColorStop(1,'rgba(230,243,255,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,32,32);
 const material=new THREE.PointsMaterial({color:0xeaf5ff,size:.5,map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.6,depthWrite:false});
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
 positions.fill(-10000);let cursor=0,budget=0;
 return (dt,ride,position)=>{
  if(ride&&!ride.airborne&&ride.speed>4){
   budget+=dt*ride.speed*(1+Math.abs(ride.angle)*4);
   while(budget>=1){
    budget--;const j=cursor++%count,i=j*3;lives[j]=.45+Math.random()*.4;
    positions[i]=position.x+(Math.random()-.5)*.8;positions[i+1]=position.y+.12;positions[i+2]=position.z+.6;
    velocities[i]=(Math.random()-.5)*4-Math.sin(ride.angle)*3;velocities[i+1]=1+Math.random()*2;velocities[i+2]=2+ride.speed*.12;
   }
  }
  let active=false;
  for(let j=0;j<count;j++){
   const i=j*3;
   if(lives[j]<=0)continue;
   lives[j]-=dt;
   if(lives[j]<=0){positions[i+1]=-10000;continue;}
   active=true;velocities[i+1]-=4*dt;
   for(let axis=0;axis<3;axis++)positions[i+axis]+=velocities[i+axis]*dt;
  }
  points.visible=active;geometry.attributes.position.needsUpdate=true;
 };
}
