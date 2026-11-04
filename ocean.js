import * as THREE from 'three';
import look from './blender-look.json';
import {loadModel} from './model-loader.js';
import materialAsset from './ocean-material.glb';

export const oceanBounds={halfWidth:1800,shoreZ:-19,farZ:-3619};

export function waveHeight(x,z,t) {
 return .16*Math.sin(z*1.15+t*1.65+.55*Math.sin(x*.17))
  +.085*Math.sin(x*.73+z*.44-t*1.2)+.045*Math.sin(x*.23-z*.62+t*2.1);
}

export function makeOcean(scene) {
 const flatNormal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
 const flatRoughness=new THREE.DataTexture(new Uint8Array([0,27,0,255]),1,1);
 flatNormal.needsUpdate=flatRoughness.needsUpdate=true;
 const uniforms={
  time:{value:0}, wake:{value:new THREE.Vector4(0,0,0,1)}, wakePower:{value:0},
  seaTint:{value:new THREE.Color(...look.waterColor)},
  skyTint:{value:new THREE.Color(...look.worldColor)},
  sunTint:{value:new THREE.Color(...look.sunColor)},
  sunDirection:{value:new THREE.Vector3(...look.sunDirection)},
  roughness:{value:.115},
  normalMap:{value:flatNormal},detailMap:{value:flatRoughness}
 };
 loadModel(materialAsset).then(asset=>{
  let material;
  asset.scene.traverse(part=>{if(part.isMesh)material=part.material;});
  if(!material?.normalMap||!material.roughnessMap)throw new Error('Missing Blender water maps');
  for(const texture of [material.normalMap,material.roughnessMap]){
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   texture.anisotropy=4;
  }
  uniforms.normalMap.value=material.normalMap;
  uniforms.detailMap.value=material.roughnessMap;
  uniforms.seaTint.value.copy(material.color);
 }).catch(error=>console.warn('Could not load Blender ocean material:',error));
 const material=new THREE.ShaderMaterial({
  uniforms,
  side:THREE.DoubleSide,
  vertexShader:`
   uniform float time;
   varying vec3 waterPoint;
   void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    p.y+=.16*sin(p.z*1.15+time*1.65+.55*sin(p.x*.17))
      +.085*sin(p.x*.73+p.z*.44-time*1.2)+.045*sin(p.x*.23-p.z*.62+time*2.1);
    waterPoint=p.xyz;
    gl_Position=projectionMatrix*viewMatrix*p;
   }`,
  fragmentShader:`
   uniform float time;
   uniform vec4 wake;
   uniform float wakePower;
   uniform vec3 seaTint,skyTint,sunTint,sunDirection;
   uniform float roughness;
   uniform sampler2D normalMap,detailMap;
   varying vec3 waterPoint;
   void main(){
    vec2 p=waterPoint.xz;
    if(p.y> -19.)discard;
    float depth=max(0.,-19.-p.y);
    float swell=sin(p.y*1.15+time*1.65+.55*sin(p.x*.17));
    float ripples=sin(p.x*4.3+p.y*3.4-time*2.5)*sin(p.x*2.2-p.y*6.8+time*1.9);
    float chop=sin(p.x*6.2-p.y*3.7+time*3.1)*sin(p.x*2.6+p.y*5.3-time*1.8);
    float glints=pow(max(0.,ripples),9.);
    float surfaceSlope=cos(p.y*1.15+time*1.65+.55*sin(p.x*.17));
    vec2 flow=vec2(time*.018,-time*.027);
    vec2 uv=p*.12+flow;
    vec3 detailA=texture2D(normalMap,uv).xyz*2.-1.;
    vec3 detailB=texture2D(normalMap,p*.047-flow*.63).xyz*2.-1.;
    vec2 detail=(detailA.xy*.27+detailB.xy*.19);
    vec3 normal=normalize(vec3(-.15*cos(p.x*.73+p.y*.44-time*1.2)+detail.x,1.,-.22*surfaceSlope+detail.y));
    vec3 viewDir=normalize(cameraPosition-waterPoint);
    float fresnel=.0204+.9796*pow(1.-max(0.,dot(viewDir,normal)),5.);
    vec3 reflected=reflect(-viewDir,normal);
    vec3 skyReflection=mix(skyTint*vec3(1.05,1.02,.99),vec3(.16,.31,.49),smoothstep(.02,.95,reflected.y));
    float sunGlare=pow(max(0.,dot(reflected,normalize(sunDirection))),mix(220.,65.,roughness));
    skyReflection+=sunTint*sunGlare*2.2;
    vec3 color=mix(vec3(.075,.31,.30),seaTint*.57,smoothstep(0.,46.,depth));
    color+=vec3(.012,.045,.04)*swell+vec3(.06,.08,.09)*glints;
    color=mix(color,skyReflection,clamp(fresnel,.04,.94));
    float foam=(1.-smoothstep(.06,2.1,depth))*smoothstep(.22,.86,swell+.38*ripples);
    vec2 d=p-wake.xy;
    float behind=-dot(d,wake.zw), side=abs(d.x*wake.w-d.y*wake.z);
    float wash=smoothstep(0.,1.,behind)*(1.-smoothstep(6.,14.,behind))*(1.-smoothstep(.14,.8,abs(side-(.2+behind*.26))));
    float churn=smoothstep(-.25,.72,ripples*.76+chop*.24);
    float centerWash=smoothstep(0.,.65,behind)*(1.-smoothstep(3.,11.,behind))
      *(1.-smoothstep(.08,.75+max(0.,behind)*.09,side));
    foam=max(foam,wakePower*max(wash*(.52+.42*churn),centerWash*churn*.84));
    float crestFoam=clamp((texture2D(detailMap,uv).g-.105)/.46,0.,1.);
    foam=max(foam,crestFoam*smoothstep(.13,.26,waterPoint.y)*.25);
    color=mix(color,vec3(.8,.95,.91),clamp(foam,0.,.87));
    float fog=smoothstep(48.,115.,distance(cameraPosition,waterPoint));
    if(cameraPosition.y<0.)color=mix(vec3(.075,.48,.56),vec3(.55,.82,.80),foam*.55+glints*.20);
    gl_FragColor=vec4(mix(color,skyTint,fog),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 // Keep the detailed surface around the viewer so enlarging the map adds no vertices.
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,600,240,300),material);
 sea.rotation.x=-Math.PI/2;
 sea.position.set(0,.08,-200);
 sea.frustumCulled=false;
 scene.add(sea);
 uniforms.follow=(x,z)=>{
  sea.position.x=Math.floor(x/10)*10;
  sea.position.z=Math.floor(z/10)*10;
 };
 return uniforms;
}
