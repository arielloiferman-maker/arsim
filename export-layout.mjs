import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildResort,sportsBall} from './resort.js';

globalThis.FileReader=class {
 async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}
 async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onloadend?.();}
};
const scene=new THREE.Scene();
const {layout,pickups,jetSkis}=buildResort(scene);
layout.name='Coastal town and water park';
for(const {mesh,type} of pickups)mesh.name='PROP_'+type;
for(const ski of jetSkis)ski.name='PROP_jetski';
for(const [i,type] of ['ball','volley','beachball'].entries()){
 const ball=sportsBall(type);
 ball.name='PROP_'+type;
 ball.position.set(i*1.2-1,ball.position.y,2);
 layout.add(ball);
}
const data=await new GLTFExporter().parseAsync(scene,{binary:true});
fs.writeFileSync(process.argv[2],Buffer.from(data));
