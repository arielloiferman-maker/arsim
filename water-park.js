import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import rampAsset from './water-ramp.glb';
import sprayAsset from './water-spray.glb';
import dolphinAsset from './water-dolphin.glb';
import buoyAsset from './water-buoy.glb';
import jumpAsset from './water-jump.glb';
import sharkAsset from './water-shark.glb';
import fishAsset from './water-fish.glb';
import hoopAsset from './water-hoop.glb';
import arenaAsset from './indoor-arena.glb';

const rampLocations=[[-28,-48,.25],[22,-78,-.28],[0,-160,0],[-95,-235,.2],
 [108,-310,-.32],[-180,-448,.35],[55,-555,-.15],[230,-690,-.42],[-125,-810,.25],
 [-16,-105,.1,1.85],[68,-198,-.2,2],[-235,-345,.35,2.15],[210,-470,-.35,1.85],
 [-75,-640,.15,2.2],[315,-789,-.4,2.15],[-315,-870,.32,2]];
const dolphinLocations=[[-38,-56,.9],[16,-96,-.7],[-34,-167,1.1],[-102,-237,1.8],
 [95,-298,.5],[-163,-440,-1.2],[65,-538,.6],[202,-680,-.9],[-107,-795,.7],
 [-295,-430,.8],[330,-610,-.5],[-370,-851,1.1],[305,-850,-1.1]];
const rampHalfLength=4,rampHalfWidth=2.3,rampRise=1.64;
const rampWidthScale=1.65,rampLengthScale=1.75;
const arenaLocations=[[2,-58,0],[50,-122,-.18],[-70,-245,.2],[105,-523,.25],
 [-260,-1140,-.2],[480,-1870,.16],[-690,-2880,.24]];
const launchDeck=[[-7.2,.035],[-5.8,.052],[-4.8,.14],[-3.9,.39],[-3.12,.77],[-2.48,1.23],[-1.91,1.70]];
const landingDeck=[[2.22,1.45],[2.86,1.14],[3.6,.80],[4.53,.45],[5.61,.20],[6.67,.07],[7.55,.035]];
const seaRoutes=Array.from({length:24},(_,i)=>[
 (i%4-1.5)*720+Math.sin(i*2.1)*130,
 -1110-Math.floor(i/4)*420,
 Math.sin(i*.6)*.6,
 1.9+(i%3)*.3
]);
const freeHoops=Array.from({length:42},(_,i)=>[
 (i%6-2.5)*470+Math.sin(i*1.7)*75,
 -170-Math.floor(i/6)*450,
 i%3===0?5:1.65,
 Math.sin(i*.43)*.65
]);
// Wildlife uses its own distribution, independent of the stunt course.
const dolphinWaters=Array.from({length:169},(_,i)=>[
 (i%13-6)*270+Math.sin(i*1.91)*32,
 -78-Math.floor(i/13)*286+Math.cos(i*1.37)*18,
 Math.sin(i*.73)*Math.PI
]);

export async function loadWaterPark(scene){
 const [ramp,spray,dolphin,buoy,jump,shark,fish,hoop,arena]=await Promise.all(
  [rampAsset,sprayAsset,dolphinAsset,buoyAsset,jumpAsset,sharkAsset,fishAsset,hoopAsset,arenaAsset].map(loadModel)
 );
 const jumpClip=jump.animations[0];
 const jumpPitch=jumpClip.tracks[0].createInterpolant();
 const hoops=[];
 const markers=[];
 const ramps=[...rampLocations,...seaRoutes].map(([x,z,yaw,height=1])=>{
  const model=ramp.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  model.scale.set(rampWidthScale,height*1.3,rampLengthScale);
  scene.add(model);
  model.updateMatrixWorld(true);
  for(const side of [-1,1]){
   const marker=buoy.scene.clone();
   model.localToWorld(marker.position.set(side*3.8,0,4.5));
   scene.add(marker);
   markers.push(marker);
  }
  if(height>1){
   const ring=hoop.scene.clone();
   model.localToWorld(ring.position.set(0,rampRise+1.55/height,-12));
   ring.rotation.y=yaw;
   ring.scale.setScalar(1.3);
   scene.add(ring);
   hoops.push(ring);
   const second=hoop.scene.clone();
   model.localToWorld(second.position.set(0,rampRise+.6/height,-18));
   second.rotation.y=yaw;
   second.scale.setScalar(1.45);
   scene.add(second);
   hoops.push(second);
  }
  return model;
 });
 for(const [x,z,y,yaw] of freeHoops){
  const ring=hoop.scene.clone();
  ring.position.set(x,y,z);
  ring.rotation.y=yaw;
  ring.scale.setScalar(1.3);
  scene.add(ring);
  hoops.push(ring);
 }
 const arenas=arenaLocations.map(([x,z,yaw])=>{
  const model=arena.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  model.scale.set(1.25,1.1,2.2);
  scene.add(model);
  model.updateMatrixWorld(true);
  return model;
 });
 const scenery=[...ramps,...markers,...hoops,...arenas];
 function swimmer(asset,x,z,yaw,phase,scale=1,splash=false){
  const model=asset.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  model.scale.setScalar(scale);
  scene.add(model);
  const mixer=new THREE.AnimationMixer(model);
  for(const clip of asset.animations)mixer.clipAction(clip).play();
  mixer.update(phase);
  return {model,mixer,splash,body:model.children[0],wasAbove:false};
 }
 const animals=[];
 [...dolphinLocations,...dolphinWaters].forEach(([x,z,yaw],i)=>{
  animals.push(swimmer(dolphin,x,z,yaw,i*.413,.9+(i%4)*.08,true));
 });
 const wildlifeLocations=[...dolphinLocations,...seaRoutes.map(([x,z,yaw])=>[x+28,z-15,yaw])];
 wildlifeLocations.forEach(([x,z,yaw],i)=>{
  if(i%2===0)animals.push(swimmer(shark,x+16,z-12,yaw-.85,i*.68,1.05,true));
  for(let j=0;j<4;j++){
   animals.push(swimmer(fish,x-8+j*.8,z+5+j*.65,yaw+.3,i*.37+j*.065,.75+j*.12,j===0));
  }
 });
 const mist=new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(1,0),
  new THREE.MeshStandardMaterial({color:0xc3f4ff,roughness:.24,metalness:.05}),
  192
 );
 mist.frustumCulled=false;
 const mistState=Array.from({length:192},()=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),life:0}));
 const mistTransform=new THREE.Object3D();
 mistTransform.scale.setScalar(0);
 mistTransform.updateMatrix();
 for(let i=0;i<192;i++)mist.setMatrixAt(i,mistTransform.matrix);
 scene.add(mist);
 let nextMist=0;
 const pool=Array.from({length:16},()=>{
  const model=spray.scene.clone();
  const mixer=new THREE.AnimationMixer(model);
  const actions=spray.animations.map(clip=>mixer.clipAction(clip));
  const duration=Math.max(...spray.animations.map(clip=>clip.duration));
  model.visible=false;
  scene.add(model);
  return {model,mixer,actions,duration,remaining:0};
 });
 const before=new THREE.Vector3(),after=new THREE.Vector3(),splashPoint=new THREE.Vector3();
 function sampleDeck(model,along,profile){
  for(let i=1;i<profile.length;i++){
   const [start,low]=profile[i-1], [end,high]=profile[i];
   if(along<start||along>end)continue;
   const slope=(high-low)/(end-start);
   return {height:(low+(along-start)*slope)*model.scale.y,
    tilt:Math.atan(slope*model.scale.y/model.scale.z),launch:false};
  }
  return null;
 }
 let next=0;
 return {
  jumpPitch(progress){
   const quaternion=jumpPitch.evaluate(THREE.MathUtils.clamp(progress,0,1)*jumpClip.duration);
   return 2*Math.atan2(quaternion[0],quaternion[3]);
  },
  rampAt(ski,previousX,previousZ){
   for(const model of arenas){
    model.worldToLocal(after.set(ski.position.x,0,ski.position.z));
    if(Math.abs(after.x)>1.9)continue;
    const along=-after.z;
    const deck=sampleDeck(model,along,launchDeck)??sampleDeck(model,along,landingDeck);
    if(deck)return deck;
    model.worldToLocal(before.set(previousX,0,previousZ));
    if(along> -1.91&&-before.z<= -1.91&&-before.z>=-7.2&&Math.abs(before.x)<=1.9){
     return {height:1.7*model.scale.y,launch:true};
    }
   }
   for(const model of ramps){
    model.worldToLocal(before.set(previousX,0,previousZ));
    model.worldToLocal(after.set(ski.position.x,0,ski.position.z));
    if(Math.abs(after.x)>rampHalfWidth)continue;
    if(after.z>=-rampHalfLength&&after.z<=rampHalfLength){
     return {
      height:(.04+(rampHalfLength-after.z)*.2)*model.scale.y,
      tilt:Math.atan(.2*model.scale.y/model.scale.z),
      launch:false
     };
    }
    if(after.z< -rampHalfLength&&before.z>=-rampHalfLength&&before.z<=rampHalfLength
      &&Math.abs(before.x)<=rampHalfWidth)return {height:rampRise*model.scale.y,launch:true};
   }
   return null;
  },
  landingAt(ski){
   for(const model of arenas){
    model.worldToLocal(after.set(ski.position.x,0,ski.position.z));
    if(Math.abs(after.x)>1.9)continue;
    const deck=sampleDeck(model,-after.z,landingDeck);
    if(deck)return deck;
   }
   return null;
  },
  crossHoop(from,to){
   for(const hoop of hoops){
    hoop.worldToLocal(before.copy(from));
    hoop.worldToLocal(after.copy(to));
    if(before.z<=0||after.z>0)continue;
    const t=before.z/(before.z-after.z);
    const x=THREE.MathUtils.lerp(before.x,after.x,t);
    const y=THREE.MathUtils.lerp(before.y,after.y,t);
    if(x*x+y*y<2.5**2){
     this.spray(hoop.position.x,hoop.position.y,hoop.position.z,hoop.rotation.y,1.5,true);
     return true;
    }
   }
   return false;
  },
  spray(x,y,z,yaw,scale,burst=false,stretch=1){
   for(let i=0;i<(burst?14:6);i++){
    const drop=mistState[nextMist];
    nextMist=(nextMist+1)%mistState.length;
    const speed=(burst?3:2.5+stretch*.65)*(1+Math.random()*.5);
    const angle=yaw+(Math.random()-.5)*(burst?Math.PI*2:.48);
    drop.position.set(x,y+.06,z);
    drop.velocity.set(Math.sin(angle)*speed,1.6+Math.random()*3.1,Math.cos(angle)*speed);
    drop.life=.5+Math.random()*.35;
   }
   const plume=pool[next];
   next=(next+1)%pool.length;
   plume.model.position.set(x,y,z);
   plume.model.rotation.y=yaw;
   plume.model.scale.set(scale*(burst?1.65:1),scale,scale*stretch);
   plume.model.visible=true;
   plume.remaining=plume.duration;
   for(const action of plume.actions)action.reset().setLoop(THREE.LoopOnce,1).play();
   plume.mixer.update(0);
  },
  update(dt,viewer,viewDistance=220){
   for(const model of scenery){
    model.visible=model.position.distanceToSquared(viewer)<viewDistance**2;
   }
   for(const animal of animals){
    const {model,mixer,body,splash}=animal;
    model.visible=model.position.distanceToSquared(viewer)<viewDistance**2;
    if(!model.visible)continue;
    mixer.update(dt);
    if(splash&&body){
     body.getWorldPosition(splashPoint);
     const above=splashPoint.y>.06;
     if(above!==animal.wasAbove)this.spray(splashPoint.x,.08,splashPoint.z,model.rotation.y,.65,true);
     animal.wasAbove=above;
    }
   }
   let mistMoved=false;
   for(const [i,drop] of mistState.entries()){
    if(!drop.life)continue;
    mistMoved=true;
    drop.life=Math.max(0,drop.life-dt);
    if(drop.life){
     drop.velocity.y-=9.8*dt;
     drop.position.addScaledVector(drop.velocity,dt);
    }
    mistTransform.position.copy(drop.position);
    const size=drop.life>0?.018+drop.life*.035:0;
    mistTransform.scale.set(size,size*1.8,size);
    mistTransform.updateMatrix();
    mist.setMatrixAt(i,mistTransform.matrix);
   }
   if(mistMoved)mist.instanceMatrix.needsUpdate=true;
   for(const plume of pool){
    if(!plume.model.visible)continue;
    plume.remaining-=dt;
    if(plume.remaining<=0)plume.model.visible=false;
    else plume.mixer.update(dt);
   }
  }
 };
}
