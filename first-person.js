import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import fistsAsset from './characters/fists.glb';

export const comboDuration = 2.5;
// Blender markers at frames 15, 26 and 39, with the exported clip starting at frame 1.
const contactTimes = [14/30,25/30,38/30];

function poseBone(bone,position,direction){
 const y=direction.normalize();
 const x=y.clone().cross(new THREE.Vector3(0,1,0)).normalize();
 const z=x.clone().cross(y);
 const pose=new THREE.Matrix4().makeBasis(x,y,z).setPosition(position);
 bone.parent.updateWorldMatrix(true,false);
 pose.premultiply(bone.parent.matrixWorld.clone().invert());
 pose.decompose(bone.position,bone.quaternion,bone.scale);
}

function gripHandlebars(arms,steering){
 arms.removeFromParent();
 for(const [hand,gripName] of [['L','starboard'],['R','port']]){
  const grip=steering.getObjectByName('RiptideGrip_'+gripName).position;
  const side=Math.sign(grip.x);
  const wrist=grip.clone().add(new THREE.Vector3(side*.012,.032,-.075));
  const direction=new THREE.Vector3(side*.11,.18,1).normalize();
  const elbow=wrist.clone().addScaledVector(direction,-.42);
  poseBone(arms.getObjectByName('Forearm'+hand),elbow,direction);
  poseBone(arms.getObjectByName('Fist'+hand),wrist,new THREE.Vector3(-side*.12,-.12,1));
 }
 steering.add(arms);
}

export async function loadFirstPersonFists(camera){
 const {scene:model,cameras,animations}=await loadModel(fistsAsset);
 const combo=THREE.AnimationClip.findByName(animations,'FPS | Three Punch Combo');
 if(!cameras[0]||!combo)throw new Error('First-person rig is incomplete');
 model.updateMatrixWorld(true);
 const cameraTransform=cameras[0].matrixWorldInverse.clone();
 cameras[0].removeFromParent();
 const ridingArms=clone(model);
 model.matrix.copy(cameraTransform);
 model.matrixAutoUpdate=false;
 for(const arms of [model,ridingArms]){
  arms.traverse(part=>{if(part.isSkinnedMesh)part.frustumCulled=false;});
 }
 const mount=new THREE.Group();
 mount.visible=false;
 mount.add(model);
 camera.add(mount);

 const mixer=new THREE.AnimationMixer(model);
 const fist=model.getObjectByName('FistR');
 const fingers=['Finger0R','Finger1R','Finger2R','Finger3R','ThumbR'].map(name=>{
  const bone=model.getObjectByName(name);
  return {bone,rest:bone.quaternion.clone()};
 });
 const palm=new THREE.Vector3();
 let heldItem=null,gripTime=0;
 let action,nextContact,onContact;
 function play(){
  action?.stop();
  action=mixer.clipAction(combo).reset().setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;
  action.setDuration(comboDuration).play();
 }
 function guard(){
  onContact=null;
  play();
  action.paused=true;
  mixer.update(0);
 }
 guard();
 return {
  ride(steering){
   if(steering===ridingArms.parent)return;
   if(steering)gripHandlebars(ridingArms,steering);
   else ridingArms.removeFromParent();
  },
  punch(strike){
   nextContact=0;
   onContact=strike;
   play();
  },
  update(dt,visible,moving,throwMotion,item=null){
   if(!visible&&mount.visible)guard();
   mount.visible=visible;
   if(!visible)return;
   if(item!==heldItem){
    if(item)guard();
    heldItem=item;
    gripTime=0;
   }
   mount.scale.x=Math.min(1,camera.aspect/1.25);
   mount.position.y=moving?Math.sin(performance.now()*.012)*.015:0;
   mount.position.z=-.12*throwMotion;
   mixer.update(dt);
   gripTime+=dt;
   for(const [i,{bone,rest}] of fingers.entries()){
    const phase=THREE.MathUtils.clamp((gripTime-i*.014)/.32,0,1);
    const curl=item?Math.sin(Math.PI*phase)*.85+.22*phase:0;
    bone.quaternion.copy(rest);
    bone.rotateX(curl*(i===4?.45:1));
   }
   if(item){
    palm.set(0,.082,-.045);
    camera.worldToLocal(fist.localToWorld(palm));
    palm.y-=.16*Math.max(0,1-gripTime/.25)**2;
    item.position.copy(palm);
   }
   if(onContact&&action.time>=contactTimes[nextContact]){
    nextContact++;
    onContact();
    if(nextContact===contactTimes.length)onContact=null;
   }
  }
 };
}
