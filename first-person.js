import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import fistsAsset from './characters/fists.glb';

export const punchDuration = .38;

export async function loadFirstPersonFists(camera){
 const {scene:model,cameras,animations}=await loadModel(fistsAsset);
 const punches=[
  {clip:THREE.AnimationClip.findByName(animations,'FPS | Left Jab'),contactFrame:8},
  {clip:THREE.AnimationClip.findByName(animations,'FPS | Right Cross'),contactFrame:9}
 ];
 if(!cameras[0]||punches.some(punch=>!punch.clip))throw new Error('First-person rig is incomplete');
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
 let hand=0,action,contactTime,onContact;
 function play(clip){
  action?.stop();
  action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;
  action.setDuration(punchDuration).play();
 }
 function guard(){
  onContact=null;
  play(punches[0].clip);
  action.paused=true;
  mixer.update(0);
 }
 guard();
 return {
  punch(strike){
   const {clip,contactFrame}=punches[hand];
   hand=1-hand;
   // Contact is the frame of maximum reach in each 30 fps Blender action.
   contactTime=contactFrame/30;
   onContact=strike;
   play(clip);
  },
  update(dt,visible,moving,throwMotion){
   if(!visible&&mount.visible)guard();
   mount.visible=visible;
   if(!visible)return;
   mount.scale.x=Math.min(1,camera.aspect/1.25);
   mount.position.y=moving?Math.sin(performance.now()*.012)*.015:0;
   mount.position.z=-.12*throwMotion;
   mixer.update(dt);
   if(onContact&&action.time>=contactTime){
    const strike=onContact;
    onContact=null;
    strike();
   }
  }
 };
}
