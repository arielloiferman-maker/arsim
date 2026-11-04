import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import gull from './coastal-gull.glb';
import turtle from './sea-turtle.glb';
import crab from './shore-crab.glb';

export async function loadCoastalWildlife(scene){
 const [gullAsset,turtleAsset,crabAsset]=await Promise.all([gull,turtle,crab].map(loadModel));
 const animals=[];
 function add(asset,x,z,radius,height,speed,phase,scale){
  const model=asset.scene.clone();
  model.scale.setScalar(scale);
  model.visible=false;
  scene.add(model);
  const mixer=new THREE.AnimationMixer(model);
  for(const clip of asset.animations)mixer.clipAction(clip).play();
  mixer.update(phase);
  animals.push({model,mixer,x,z,radius,height,speed,phase});
 }
 for(let i=0;i<24;i++){
  const offshore=i>=12;
  const x=offshore?(i%4-1.5)*680:(i-5.5)*13;
  const z=offshore?-450-Math.floor((i-12)/4)*1000:-32-(i%4)*15;
  add(gullAsset,x,z,11+i%6,6+i%5,.35+i%3*.09,i*1.13,1+i%3*.08);
 }
 for(let i=0;i<12;i++)add(turtleAsset,(i-5.5)*17,-33-i%4*13,4,-.75,.26,i*.93,1);
 for(let i=0;i<10;i++)add(crabAsset,(i-4.5)*9,-15+i%3,1.2,.015,.65,i*1.7,.9);
 let time=0;
 return (dt,viewer,visibility)=>{
  time+=dt;
  for(const {model,mixer,x,z,radius,height,speed,phase} of animals){
   const angle=time*speed+phase;
   model.position.set(x+Math.sin(angle)*radius,height+Math.sin(angle*2)*Math.abs(height)*.25,z+Math.cos(angle)*radius);
   model.rotation.y=Math.atan2(Math.cos(angle),-Math.sin(angle));
   model.visible=model.position.distanceToSquared(viewer)<visibility**2;
   if(model.visible)mixer.update(dt);
  }
 };
}
