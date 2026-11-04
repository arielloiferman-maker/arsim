import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import niko from './characters/niko.glb';
import avi from './characters/avi.glb';
import lior from './characters/lior.glb';

let crew=[];
const sandReaction='Hit Reaction | Sand in Eyes';
export async function loadCrew(){
 crew=await Promise.all([niko,avi,lior].map(loadModel));
}

export function attachCrew(person){
 if(!crew.length||person.character||person.isPlayer||person.team>1)return;
 const asset=crew[(person.id-1)%crew.length];
 const model=clone(asset.scene);
 const bounds=new THREE.Box3().setFromObject(model,true);
 const size=bounds.getSize(new THREE.Vector3()), center=bounds.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0)return;
 const root=new THREE.Group(), scale=1.97/size.y;
 root.scale.setScalar(scale);
 root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 root.add(model);
 model.traverse(part=>{
  if(!part.isMesh)return;
  const style=material=>{
   const result=material.clone();
   if(/Cotton.*Chalk White/i.test(result.name))result.color.setHex(person.team===0?0xf2f0e8:0x16191d);
   return result;
  };
  part.material=Array.isArray(part.material)?part.material.map(style):style(part.material);
  part.castShadow=false;
  part.receiveShadow=true;
  if(part.isSkinnedMesh)part.frustumCulled=false;
 });
 for(const child of person.g.children)child.visible=false;
 person.g.add(root);
 const mixer=new THREE.AnimationMixer(model);
 const actions=new Map(asset.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 person.character={mixer,actions,current:null,remaining:0,punchSide:false};
}

function play(character,name,once=false){
 const action=character.actions.get(name);
 if(!action||action===character.current&&!once)return;
 if(character.current!==action)character.current?.fadeOut(.12);
 action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
 action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
 action.clampWhenFinished=once;
 action.fadeIn(.12).play();
 character.current=action;
 character.remaining=once?action.getClip().duration:0;
}

export function crewFall(person){
 if(!person.character)return false;
 play(person.character,person.id%2?'Fall | Backward':'Fall | Forward',true);
 return true;
}

export function crewSandReaction(person){
 const character=person.character;
 if(!character?.actions.has(sandReaction))return 3.3;
 play(character,sandReaction,true);
 return character.remaining;
}

export function animateCrew(person,dt){
 const character=person.character;
 if(!character)return false;
 character.remaining=Math.max(0,character.remaining-dt);
 if(person.alive&&!person.sandT&&person.attackT>0&&!character.wasAttacking){
  character.punchSide=!character.punchSide;
  play(character,character.punchSide?'Punch | Right':'Punch | Left',true);
 }
 character.wasAttacking=person.attackT>0;
 person.attackT=Math.max(0,person.attackT-dt);
 if(person.alive&&!character.remaining){
  if(person.walking)play(character,'Walk | In Place');
  else if(character.current){
   character.current.fadeOut(.15);
   character.current=null;
  }
 }
 character.mixer.update(dt);
 return true;
}
