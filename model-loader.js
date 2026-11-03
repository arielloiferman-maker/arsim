import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export function loadModel(source){
 if(typeof source==='string')return loader.loadAsync(source);
 return loader.parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');
}
