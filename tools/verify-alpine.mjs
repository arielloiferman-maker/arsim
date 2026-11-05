import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {layout,snowHeight,rampHeight,crossedRamp} from '../alpine-layout.js';
import {loadSnowResort} from '../snow-resort.js';

function noTexturesGLB(file){
 const input=fs.readFileSync(file),length=input.readUInt32LE(12),doc=JSON.parse(input.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.materials;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
 const bin=input.subarray(20+length),output=Buffer.alloc(20+json.length+bin.length);
 output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);
 output.writeUInt32LE(json.length,12);output.writeUInt32LE(0x4e4f534a,16);json.copy(output,20);bin.copy(output,20+json.length);
 return output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength);
}
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const land=await loader.parseAsync(noTexturesGLB('snow-mountain.glb'),'');
land.scene.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(land.scene);
assert(bounds.min.z>=109,'The mountain must be entirely inland');
assert(bounds.max.y>700,'New side peaks must be present');
const ground=[];
land.scene.traverse(n=>{if(n.isMesh&&(/Terrain/.test(n.name)||/Terrain/.test(n.parent?.name)))ground.push(n);});
assert(ground.length>0,'Terrain meshes survived compression');
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
let maxError=0;
for(const route of layout.trails){
 assert(route.length>1400);
 for(let i=12;i<route.points.length-12;i+=19){
  const [x,z]=route.points[i];ray.set(new THREE.Vector3(x,1400,z),down);
  const hit=ray.intersectObjects(ground,false)[0];assert(hit,'Every trail point has solid ground');
  const error=Math.abs(hit.point.y-snowHeight({x,z}));maxError=Math.max(maxError,error);
  assert(error<.15,`Collision and rendered terrain disagree by ${error}`);
 }
}
const rampMeshes=[];
land.scene.traverse(n=>{if(n.isMesh&&(/Snowpark/.test(n.name)||/Snowpark/.test(n.parent?.name)))rampMeshes.push(n);});
let rampError=0;
for(const r of layout.ramps){
 const start={x:r.x,z:r.z},end={x:r.x+r.dx*(r.length+1),z:r.z+r.dz*(r.length+1)};
 assert(crossedRamp(start,end));
 assert(!crossedRamp({x:start.x-r.dz*30,z:start.z+r.dx*30},{x:end.x-r.dz*30,z:end.z+r.dx*30}));
 const middle={x:r.x+r.dx*r.length*.5,z:r.z+r.dz*r.length*.5};
 ray.set(new THREE.Vector3(middle.x,1400,middle.z),down);
 const hit=ray.intersectObjects(rampMeshes,false)[0];assert(hit,'Ramp must have a visible surface');
 rampError=Math.max(rampError,Math.abs(hit.point.y-snowHeight(middle)-rampHeight(middle)));
}
assert(rampError<.15,`Ramp/collision mismatch ${rampError}`);
const town=await loader.parseAsync(noTexturesGLB('coast.blend.glb'),'');
let props=0,jets=0;town.scene.traverse(n=>{if(/^PROP_/.test(n.name))props++;if(/^PROP_jetski/.test(n.name))jets++;});
assert(props>40);assert(jets===2,'Existing mountable jet skis must remain');

const fakeContext=new Proxy({createRadialGradient(){return {addColorStop(){}};}},{get(target,key){return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
const elements=[];
globalThis.document={createElement(type){const node={style:{},hidden:false,textContent:'',append(){},getContext(){return fakeContext;}};elements.push(node);return node;},querySelector(){return {append(){}};}};
globalThis.__alpineModels={mountain:land};
let coins=1000,firstPerson=false;
const messages=[];
const resort=await loadSnowResort(new THREE.Scene(),{notify:m=>messages.push(m),credits:()=>coins,spend:n=>{coins-=n;return true;},earn:n=>coins+=n,heading:(angle,first)=>{if(first)firstPerson=true;}});
const p=new THREE.Vector3(layout.shuttle.x,0,layout.shuttle.z);
assert(resort.interact(p));assert(Math.hypot(p.x-layout.base.x,p.z-layout.base.z)<10);
assert(resort.interact(p));assert(resort.liftRiding);
for(let i=0;i<2100;i++)resort.step(1/60,p,{},null,true);
assert(!resort.liftRiding);assert(p.z>1440);assert(p.y>600);
assert(resort.shop(p));resort.buy(0);assert.equal(coins,965);
assert(resort.interact(p));assert(firstPerson);assert(resort.ride);
const beforeX=p.x,beforeZ=p.z;
for(let i=0;i<90;i++)resort.step(1/60,p,{KeyW:true,KeyA:true},null,true);
assert(p.x<beforeX,'A must move left while facing downhill');assert(p.z<beforeZ,'W must move downhill');
const left=p.x;
for(let i=0;i<120;i++)resort.step(1/60,p,{KeyW:true,KeyD:true},null,true);
assert(p.x>left,'D must move right');
resort.choose('backflip');let landed=false;
for(let i=0;i<900;i++){
 resort.step(1/60,p,{KeyS:true},'backflip',true);
 if(!resort.ride.airborne&&coins===1065){landed=true;break;}
}
assert(landed,'Completing a trick and landing must pay 100 coins');
for(let i=0;i<100;i++)resort.step(1/60,p,{KeyS:true},'backflip',true);
assert.equal(coins,1065,'Landing reward must not repeat');
resort.interact(p);
// Drive every route using the same W/A/D controls available to a real player.
for(let test=0;test<12;test++){
 p.set(-178,0,1452);p.y=snowHeight(p);resort.nextRoute(p);resort.interact(p);
 const selected=(6+test)%12,route=layout.trails[selected];let frames=0;
 while(resort.ride&&frames++<7200){
  const t=THREE.MathUtils.clamp((1440-p.z+22)/1300,0,1),index=Math.min(280,Math.round(t*280));
  const delta=route.points[index][0]-p.x;
  resort.step(1/60,p,{KeyW:true,KeyA:delta< -1,KeyD:delta>1},null,true);
  assert(Number.isFinite(p.y));assert(p.y>=snowHeight(p)-.01);
 }
 assert(!resort.ride,`Route ${selected+1} could not be completed`);
 assert(p.z<=140);
}
console.log(JSON.stringify({trails:12,ramps:layout.ramps.length,terrainCollisionMaxError:maxError,rampMaxError:rampError,mountainBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},preservedPickups:props,jetSkis:jets,shuttle:'passed',lift:'passed',shop:'passed',firstPerson:'passed',steering:'passed',landingReward:'passed',allRoutes:'passed'},null,2));
