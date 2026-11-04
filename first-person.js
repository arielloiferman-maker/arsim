import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import fistsAsset from './characters/fists.glb';

export const comboDuration = 2.5;
// Blender markers at frames 15, 26 and 39, with the exported clip starting at frame 1.
const contactTimes = [14/30,25/30,38/30];

export async function loadFirstPersonFists(camera){
 const {scene:model,cameras,animations}=await loadModel(fistsAsset);
 const combo=THREE.AnimationClip.findByName(animations,'FPS | Three Punch Combo');
 if(!cameras[0]||!combo)throw new Error('First-person rig is incomplete');
 model.updateMatrixWorld(true);
 model.matrix.copy(cameras[0].matrixWorldInverse);
 model.matrixAutoUpdate=false;
 cameras[0].removeFromParent();
 model.traverse(part=>{if(part.isSkinnedMesh)part.frustumCulled=false;});
 const mount=new THREE.Group();
 mount.visible=false;
 mount.add(model);
 camera.add(mount);

 const mixer=new THREE.AnimationMixer(model);
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
  punch(strike){
   nextContact=0;
   onContact=strike;
   play();
  },
  update(dt,visible,moving,throwMotion){
   if(!visible&&mount.visible)guard();
   mount.visible=visible;
   if(!visible)return;
   mount.scale.x=Math.min(1,camera.aspect/1.25);
   mount.position.y=moving?Math.sin(performance.now()*.012)*.015:0;
   mount.position.z=-.12*throwMotion;
   mixer.update(dt);
   if(onContact&&action.time>=contactTimes[nextContact]){
    nextContact++;
    onContact();
    if(nextContact===contactTimes.length)onContact=null;
   }
  }
 };
}
