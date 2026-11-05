import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import coast from './coast.blend.glb';
import marine from './marine.blend.glb';
import terrain from './terrain.blend.glb';
import riptide from './riptide.glb';

const templates=new Map();
function sharpenTextures(mesh){
 for(const material of [].concat(mesh.material)){
  for(const texture of [material.map,material.normalMap,material.roughnessMap]){
   if(texture)texture.anisotropy=8;
  }
 }
}
export function blenderProp(type){
 const template=templates.get(type);
 return template?.clone(true);
}

export async function installBlenderWorld(scene,resort,props){
 const [town,seaLife,shore,jetSki]=await Promise.all([
  loadModel(coast),loadModel(marine),loadModel(terrain),
  loadModel(riptide).catch(error=>{
   console.warn('Could not load the Riptide jet ski:',error);
   return null;
  })
 ]);
 const marked=[];
 town.scene.traverse(node=>{
  if(node.isMesh){
   node.castShadow=node.receiveShadow=true;
   sharpenTextures(node);
  }
  const match=/^PROP_([a-z]+)/i.exec(node.name);
  if(match)marked.push([node,match[1].toLowerCase()]);
 });
 if(!marked.some(([,type])=>type==='jetski')||!seaLife.animations.length){
  throw new Error('Missing Blender scene assets');
 }
 const outdated=new Set(resort.pickups.map(entry=>entry.mesh));
 for(let i=props.length-1;i>=0;i--){
  if(outdated.has(props[i].mesh)&&!props[i].taken)props.splice(i,1);
 }
 if(resort.layout)scene.remove(resort.layout);
 shore.scene.traverse(node=>{
  if(!node.isMesh)return;
  node.receiveShadow=true;
  sharpenTextures(node);
 });
 scene.add(town.scene,seaLife.scene,shore.scene);
 town.scene.updateMatrixWorld(true);
 const skis=[];
 const added=new Set();
 for(const [node,type] of marked){
  scene.attach(node);
  node.traverse(part=>{if(part.isMesh)part.castShadow=false;});
  if(type==='jetski'){skis.push(node);continue;}
  const origin=node.clone(true);
  origin.position.x=origin.position.z=0;
  if(!templates.has(type))templates.set(type,origin);
  props.push({mesh:node,type,taken:false});
  added.add(node);
 }
 for(const entry of props){
  if(entry.taken||added.has(entry.mesh))continue;
  const replacement=blenderProp(entry.type);
  if(!replacement)continue;
  replacement.position.x=entry.mesh.position.x;
  replacement.position.z=entry.mesh.position.z;
  entry.mesh.removeFromParent();
  entry.mesh=replacement;
  scene.add(replacement);
 }
 // Preserve the actual vehicles if the player mounted one before the assets loaded.
 for(const [i,ski] of skis.entries()){
  const vehicle=resort.jetSkis[i]??ski;
  if(jetSki){
   const model=jetSki.scene.clone(true);
   // The exported bow points toward +Z. Vehicles steer and accelerate toward -Z.
   model.rotation.y=Math.PI;
   model.position.y=-.25;
   model.traverse(part=>{
    if(!part.isMesh)return;
    part.receiveShadow=true;
    sharpenTextures(part);
   });
   vehicle.clear();
   vehicle.scale.setScalar(1);
   vehicle.add(model);
  }else if(vehicle!==ski){
   vehicle.clear();
   vehicle.add(...ski.children);
  }
  if(vehicle!==ski){
   scene.attach(vehicle);
   ski.removeFromParent();
  }
  const trickPivot=new THREE.Group();
  trickPivot.name='RiptideTrickPivot';
  trickPivot.add(...vehicle.children);
  vehicle.add(trickPivot);
  resort.jetSkis[i]=vehicle;
 }
 const mixer=new THREE.AnimationMixer(seaLife.scene);
 for(const clip of seaLife.animations)mixer.clipAction(clip).play();
 seaLife.scene.visible=false;
 return (dt,visible)=>{
  seaLife.scene.visible=visible;
  if(visible)mixer.update(dt);
 };
}
