const esbuild=require('esbuild');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const output=path.resolve(__dirname,'../../work/verify-alpine-bundle.mjs');
esbuild.build({entryPoints:[path.join(__dirname,'verify-alpine.mjs')],bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{
 name:'headless-models',setup(build){
  build.onLoad({filter:/model-loader\.js$/},()=>({contents:`import * as THREE from 'three';export async function loadModel(name){return name.includes('snow-mountain')?{scene:globalThis.__alpineModels.mountain.scene.clone(true)}:{scene:new THREE.Group()};}`,resolveDir:path.resolve(__dirname,'..')}));
  build.onLoad({filter:/\.glb$/},args=>({contents:`export default ${JSON.stringify(path.basename(args.path))};`,loader:'js'}));
 }
}]}).then(()=>{const result=spawnSync(process.execPath,[output],{cwd:path.resolve(__dirname,'..'),stdio:'inherit'});process.exitCode=result.status??1;});
