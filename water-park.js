import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import rampAsset from './water-ramp.glb';
import sprayAsset from './water-spray.glb';

const rampLocations=[[-28,-48,.25],[22,-78,-.28],[0,-160,0]];
const rampHalfLength=4,rampHalfWidth=2.3,rampRise=1.64;

export async function loadWaterPark(scene){
 const [ramp,spray]=await Promise.all([loadModel(rampAsset),loadModel(sprayAsset)]);
 const ramps=rampLocations.map(([x,z,yaw])=>{
  const model=ramp.scene.clone();
  model.position.set(x,0,z);
  model.rotation.y=yaw;
  scene.add(model);
  model.updateMatrixWorld(true);
  return model;
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
  spray(x,y,z,yaw,scale,burst=false){
   const plume=pool[next];
   next=(next+1)%pool.length;
   plume.model.position.set(x,y,z);
   plume.model.rotation.y=yaw;
   plume.model.scale.set(scale*(burst?1.65:1),scale,scale);
   plume.model.visible=true;
   plume.remaining=plume.duration;
   for(const action of plume.actions)action.reset().setLoop(THREE.LoopOnce,1).play();
   plume.mixer.update(0);
  },
  update(dt){
   for(const plume of pool){
    if(!plume.model.visible)continue;
    plume.remaining-=dt;
    if(plume.remaining<=0)plume.model.visible=false;
    else plume.mixer.update(dt);
   }
  }
 };
}
