import * as THREE from 'three';
import {loadModel} from './model-loader.js';
import materialAsset from './ocean-material.glb';
import {seaAtmosphereGLSL,seaHorizon,seaSunColor,seaSunDirection} from './sea-atmosphere.js';

export const oceanBounds={halfWidth:1800,shoreZ:-19,farZ:-3619};
export const seaLevel=.08;

export function waveHeight(x,z,t) {
 const shore=Math.max(0,Math.min(1,(-19-z)/48));
 const offshore=shore*shore*(3-2*shore);
 const phase=z*.39+x*.085+t*1.56+.4*Math.sin(x*.16-t*.32);
 const crest=.5+.5*Math.sin(phase+.38*Math.sin(phase));
 return (.14+1.31*offshore)*(crest**4-.2734375)
  +(.06+.23*offshore)*Math.sin(x*.23-z*.17-t*1.05)
  +(.045+.045*offshore)*Math.sin(x*.57+z*.71+t*2.12);
}

const waveGLSL=`
 vec3 swellField(vec2 p,float t){
  float offshore=smoothstep(0.,48.,-19.-p.y);
  float bend=p.x*.16-t*.32;
  float phase=p.y*.39+p.x*.085+t*1.56+.4*sin(bend);
  float steepPhase=phase+.38*sin(phase);
  float crest=.5+.5*sin(steepPhase);
  float amplitude=.14+1.31*offshore;
  float secondary=dot(p,vec2(.23,-.17))-t*1.05;
  float chop=dot(p,vec2(.57,.71))+t*2.12;
  float secondaryAmplitude=.06+.23*offshore;
  float chopAmplitude=.045+.045*offshore;
  float steepSlope=2.*crest*crest*crest*cos(steepPhase)*(1.+.38*cos(phase));
  vec2 gradient=amplitude*steepSlope*vec2(.085+.064*cos(bend),.39)
     +secondaryAmplitude*cos(secondary)*vec2(.23,-.17)
     +chopAmplitude*cos(chop)*vec2(.57,.71);
  float height=amplitude*(pow(crest,4.)-.2734375)
     +secondaryAmplitude*sin(secondary)+chopAmplitude*sin(chop);
  return vec3(height,gradient);
 }
`;

export function makeOcean(scene) {
 const flatNormal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
 const flatRoughness=new THREE.DataTexture(new Uint8Array([0,27,0,255]),1,1);
 flatNormal.needsUpdate=flatRoughness.needsUpdate=true;
 const uniforms={
  time:{value:0}, wake:{value:new THREE.Vector4(0,0,0,1)}, wakePower:{value:0},
  seaTint:{value:new THREE.Color(.009,.065,.19)},
  skyTint:{value:new THREE.Color(...seaHorizon)},
  sunTint:{value:new THREE.Color(...seaSunColor)},
  sunDirection:{value:new THREE.Vector3(...seaSunDirection).normalize()},
  submerged:{value:false},
  roughness:{value:.115},
  visibility:{value:210},
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
 }).catch(error=>console.warn('Could not load Blender ocean material:',error));
 const material=new THREE.ShaderMaterial({
  uniforms,
  side:THREE.DoubleSide,
  vertexShader:`
   uniform float time;
   varying vec3 waterPoint;
   ${waveGLSL}
   void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    p.y+=swellField(p.xz,time).x;
    waterPoint=p.xyz;
    gl_Position=projectionMatrix*viewMatrix*p;
   }`,
  fragmentShader:`
   uniform float time;
   uniform vec4 wake;
   uniform float wakePower;
   uniform vec3 seaTint,skyTint,sunTint,sunDirection;
   uniform float roughness;
   uniform float visibility;
   uniform bool submerged;
   uniform sampler2D normalMap,detailMap;
   varying vec3 waterPoint;
   ${waveGLSL}
   ${seaAtmosphereGLSL}
   void main(){
    vec2 p=waterPoint.xz;
    if(p.y> -19.)discard;
    float depth=max(0.,-19.-p.y);
    vec3 swell=swellField(p,time);
    float ripples=sin(p.x*4.3+p.y*3.4-time*2.5)*sin(p.x*2.2-p.y*6.8+time*1.9);
    float chop=sin(p.x*6.2-p.y*3.7+time*3.1)*sin(p.x*2.6+p.y*5.3-time*1.8);
    float glints=pow(max(0.,ripples),9.);
    vec2 flow=vec2(time*.018,-time*.027);
    vec2 uv=p*.12+flow;
    vec3 detailA=texture2D(normalMap,uv).xyz*2.-1.;
    vec3 detailB=texture2D(normalMap,p*.047-flow*.63).xyz*2.-1.;
    float distanceToEye=distance(cameraPosition,waterPoint);
    vec2 detail=(detailA.xy*.32+detailB.xy*.21)*(1.-smoothstep(70.,260.,distanceToEye)*.7);
    vec3 normal=normalize(vec3(-swell.y+detail.x,1.,-swell.z+detail.y));
    vec3 viewDir=normalize(cameraPosition-waterPoint);
    float fresnel=.0204+.9796*pow(1.-max(0.,dot(viewDir,normal)),5.);
    vec3 reflected=reflect(-viewDir,normal);
    vec3 skyReflection=clearSky(reflected,sunDirection);
    float sunAlignment=max(0.,dot(reflected,sunDirection));
    float sunGlare=pow(sunAlignment,mix(520.,130.,roughness));
    float sunPath=pow(sunAlignment,45.);
    vec3 color=mix(vec3(.045,.26,.32),seaTint,smoothstep(0.,43.,depth));
    float backlit=pow(max(0.,dot(viewDir.xz,-sunDirection.xz)),3.);
    color+=vec3(.012,.12,.19)*smoothstep(.35,1.03,swell.x)*(.2+.8*backlit);
    color+=vec3(.017,.036,.065)*glints;
    color=mix(color,skyReflection,clamp(fresnel*.88,.04,.88));
    color+=sunTint*(sunGlare*4.8+sunPath*.26);
    float foam=(1.-smoothstep(.06,3.1,depth))*smoothstep(.015,.13,swell.x+.064*ripples);
    vec2 d=p-wake.xy;
    float behind=-dot(d,wake.zw), side=abs(d.x*wake.w-d.y*wake.z);
    float wash=smoothstep(0.,1.,behind)*(1.-smoothstep(6.,14.,behind))*(1.-smoothstep(.14,.8,abs(side-(.2+behind*.26))));
    float churn=smoothstep(-.25,.72,ripples*.76+chop*.24);
    float centerWash=smoothstep(0.,.65,behind)*(1.-smoothstep(3.,11.,behind))
      *(1.-smoothstep(.08,.75+max(0.,behind)*.09,side));
    foam=max(foam,wakePower*max(wash*(.52+.42*churn),centerWash*churn*.84));
    float crestTexture=clamp((texture2D(detailMap,uv).g-.105)/.46,0.,1.);
    float breaking=smoothstep(.63,1.11,swell.x+.12*ripples);
    foam=max(foam,breaking*smoothstep(.28,.75,crestTexture*.62+churn*.62));
    color=mix(color,vec3(.73,.89,.99),clamp(foam,0.,.93));
    float fog=smoothstep(visibility*.53,visibility,distanceToEye);
    if(submerged){
     vec3 throughSurface=refract(-viewDir,-normal,1.333);
     float windowMask=smoothstep(.03,.30,length(throughSurface));
     vec3 windowSky=clearSky(normalize(throughSurface+vec3(0.,.001,0.)),sunDirection);
     color=mix(vec3(.004,.048,.17),windowSky*vec3(.34,.66,.92),windowMask*.82);
     color+=vec3(.03,.24,.46)*pow(sunAlignment,13.)*.45+vec3(.14,.28,.41)*foam*.46;
     gl_FragColor=vec4(mix(color,vec3(.008,.065,.16),smoothstep(4.,28.,distanceToEye)),1.);
    }else{
     gl_FragColor=vec4(mix(color,skyTint,fog),1.);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 // Keep the detailed surface around the viewer so enlarging the map adds no vertices.
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,600,240,300),material);
 sea.rotation.x=-Math.PI/2;
 sea.position.set(0,seaLevel,-200);
 sea.frustumCulled=false;
 scene.add(sea);
 uniforms.follow=(x,z,viewDistance=210)=>{
  const scale=Math.max(1,viewDistance/230);
  sea.scale.set(scale,scale,1);
  sea.position.x=Math.floor(x/10)*10;
  sea.position.z=Math.floor(z/10)*10;
  uniforms.visibility.value=viewDistance;
 };
 return uniforms;
}
