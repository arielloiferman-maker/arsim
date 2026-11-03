import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import coast from './coast.blend.glb';
import marine from './marine.blend.glb';

const templates=new Map();
export function blenderProp(type){
 const template=templates.get(type);
 return template?.clone(true);
}

export async function installBlenderWorld(scene,resort,props){
 const loader=new GLTFLoader();
 const parse=bytes=>loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const [town,seaLife]=await Promise.all([parse(coast),parse(marine)]);
 const marked=[];
 town.scene.traverse(node=>{
  if(node.isMesh)node.castShadow=node.receiveShadow=true;
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
 scene.remove(resort.layout);
 scene.add(town.scene,seaLife.scene);
 town.scene.updateMatrixWorld(true);
 const skis=[];
 const added=new Set();
 for(const [node,type] of marked){
  scene.attach(node);
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
  const vehicle=resort.jetSkis[i];
  if(!vehicle){resort.jetSkis.push(ski);continue;}
  vehicle.clear();
  vehicle.add(...[...ski.children]);
  scene.attach(vehicle);
  ski.removeFromParent();
 }
 const mixer=new THREE.AnimationMixer(seaLife.scene);
 for(const clip of seaLife.animations)mixer.clipAction(clip).play();
 return dt=>mixer.update(dt);
}
