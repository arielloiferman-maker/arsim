import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import rampAsset from './water-ramp.glb';
import sprayAsset from './water-spray.glb';
import dolphinAsset from './water-dolphin.glb';
import buoyAsset from './water-buoy.glb';
import jumpAsset from './water-jump.glb';

const rampLocations=[[-28,-48,.25],[22,-78,-.28],[0,-160,0],[-95,-235,.2],
 [108,-310,-.32],[-180,-448,.35],[55,-555,-.15],[230,-690,-.42],[-125,-810,.25]];
const dolphinLocations=[[-38,-56,.9],[16,-96,-.7],[-34,-167,1.1],[-102,-237,1.8],
 [95,-298,.5],[-163,-440,-1.2],[65,-538,.6],[202,-680,-.9],[-107,-795,.7]];
const rampHalfLength=4,rampHalfWidth=2.3,rampRise=1.64;

export async function loadWaterPark(scene){
 const [ramp,spray,dolphin,buoy,jump]=await Promise.all(
  [rampAsset,sprayAsset,dolphinAsset,buoyAsset,jumpAsset].map(loadModel)
 );
 const jumpClip=jump.animations[0];
 const jumpPitch=jumpClip.tracks[0].createInterpolant();
 const ramps=rampLocations.map(([x,z,yaw])=>{
  const model=ramp.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  scene.add(model);
  model.updateMatrixWorld(true);
  for(const side of [-1,1]){
   const marker=buoy.scene.clone();
   model.localToWorld(marker.position.set(side*3.8,0,4.5));
   scene.add(marker);
  }
  return model;
 });
 const dolphins=dolphinLocations.map(([x,z,yaw],i)=>{
  const model=dolphin.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  scene.add(model);
  const mixer=new THREE.AnimationMixer(model);
  for(const clip of dolphin.animations)mixer.clipAction(clip).play();
  mixer.update(i*.47);
  return {model,mixer};
 });
 const pool=Array.from({length:16},()=>{
  const model=spray.scene.clone();
  const mixer=new THREE.AnimationMixer(model);
  const actions=spray.animations.map(clip=>mixer.clipAction(clip));
  const duration=Math.max(...spray.animations.map(clip=>clip.duration));
  model.visible=false;
  scene.add(model);
  return {model,mixer,actions,duration,remaining:0};
 });
 const before=new THREE.Vector3(),after=new THREE.Vector3();
 let next=0;
 return {
  jumpPitch(progress){
   const quaternion=jumpPitch.evaluate(THREE.MathUtils.clamp(progress,0,1)*jumpClip.duration);
   return 2*Math.atan2(quaternion[0],quaternion[3]);
  },
  rampAt(ski,previousX,previousZ){
   for(const model of ramps){
    model.worldToLocal(before.set(previousX,0,previousZ));
    model.worldToLocal(after.set(ski.position.x,0,ski.position.z));
    if(Math.abs(after.x)>rampHalfWidth)continue;
    if(after.z>=-rampHalfLength&&after.z<=rampHalfLength){
     return {height:.04+(rampHalfLength-after.z)*.2,launch:false};
    }
    if(after.z< -rampHalfLength&&before.z>=-rampHalfLength&&before.z<=rampHalfLength
      &&Math.abs(before.x)<=rampHalfWidth)return {height:rampRise,launch:true};
   }
   return null;
  },
  spray(x,y,z,yaw,scale,burst=false,stretch=1){
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
  update(dt,viewer){
   for(const {model,mixer} of dolphins){
    model.visible=model.position.distanceToSquared(viewer)<140**2;
    if(model.visible)mixer.update(dt);
   }
   for(const plume of pool){
    if(!plume.model.visible)continue;
    plume.remaining-=dt;
    if(plume.remaining<=0)plume.model.visible=false;
    else plume.mixer.update(dt);
   }
  }
 };
}
