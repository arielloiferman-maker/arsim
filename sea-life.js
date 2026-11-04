import * as T from 'three';
import {seaAtmosphereGLSL,seaSunDirection} from './sea-atmosphere.js';

export function addSeaLife(scene) {
 const life=[];
 const body=new T.SphereGeometry(1,16,10);
 const finGeometry=new T.BufferGeometry();
 finGeometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,1,.45,0,0,.92],3));
 finGeometry.computeVertexNormals();
 const palette=[0x3c7286,0x4d8594,0xf2be62,0x64b6ad,0x718caa].map(color=>new T.MeshStandardMaterial({color,roughness:.48,side:T.DoubleSide}));
 for(let i=0;i<31;i++){
  const shark=i<3, fish=new T.Group(), material=palette[shark?i%2:2+i%3];
  const hull=new T.Mesh(body,material);
  hull.scale.set(.28,.29,1);fish.add(hull);
  const dorsal=new T.Mesh(finGeometry,material);
  dorsal.position.set(0,.19,-.27);dorsal.scale.set(1,shark?.58:.26,.65);fish.add(dorsal);
  for(const side of [-1,1]){
   const fin=new T.Mesh(finGeometry,material);
   fin.position.set(side*.19,-.13,-.26);fin.rotation.z=-side*1.23;fin.scale.setScalar(.57);fish.add(fin);
  }
  const tail=new T.Group();tail.position.z=.79;
  for(const side of [-1,1]){
   const f=new T.Mesh(finGeometry,material);f.scale.set(1,side*(shark?.47:.37),.6);tail.add(f);
  }
  fish.add(tail);fish.scale.setScalar(shark?1.55:.22+(i%4)*.09);
  scene.add(fish);
  life.push({fish,tail,i,shark});
 }
 return time=>{
  for(const {fish,tail,i,shark} of life){
   const a=time*(shark?.23:.48)+i*.81;
   const rx=shark?10:4+(i%4), rz=shark?7:3+(i%3);
   fish.position.set(-15+(i%6)*6+Math.cos(a)*rx,-(shark?2.2:1.1+(i%6)*.38)+Math.sin(a*2)*.19,-35-(i%4)*4+Math.sin(a)*rz);
   fish.rotation.y=Math.atan2(Math.sin(a)*rx,-Math.cos(a)*rz);
   fish.rotation.z=Math.sin(a*2)*.1;
   tail.rotation.y=Math.sin(time*(shark?5:10)+i)*.57;
  }
 };
}

export function textureSand(material){
 const size=128, bytes=new Uint8Array(size*size*4);
 for(let i=0;i<size*size;i++){
  const grit=Math.sin(i*127.31)*Math.cos(i*31.53);
  const shade=222+Math.round(26*grit);
  bytes.set([shade,shade,shade,255],i*4);
 }
 const map=new T.DataTexture(bytes,size,size);
 map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
 map.repeat.set(3200,3200);map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;material.map=map;
}

export function sunsetSky(scene){
 const sky=new T.Mesh(new T.SphereGeometry(145,32,16),new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,
  uniforms:{sunDirection:{value:new T.Vector3(...seaSunDirection).normalize()}},
  vertexShader:`varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 ray;uniform vec3 sunDirection;
  ${seaAtmosphereGLSL}
  float cloudHash(vec2 p){
   vec3 h=fract(vec3(p.xyx)*.1031);
   h+=dot(h,h.yzx+33.33);
   return fract((h.x+h.y)*h.z);
  }
  float cloudNoise(vec2 p){
   vec2 cell=floor(p),f=fract(p);
   f=f*f*(3.-2.*f);
   return mix(mix(cloudHash(cell),cloudHash(cell+vec2(1,0)),f.x),
              mix(cloudHash(cell+vec2(0,1)),cloudHash(cell+vec2(1,1)),f.x),f.y);
  }
  float cloudField(vec2 p){
   return cloudNoise(p)*.52+cloudNoise(p*2.04+6.)*.27
        +cloudNoise(p*4.12-9.)*.14+cloudNoise(p*8.23+4.)*.07;
  }
  void main(){
   vec3 d=normalize(ray);
   vec3 c=clearSky(d,sunDirection);
   vec2 cloudUV=d.xz/(max(.02,d.y)+.21)*2.3;
   float field=cloudField(cloudUV);
   float density=smoothstep(.43,.67,field);
   float cloudBand=smoothstep(-.012,.037,d.y)*(1.-smoothstep(.26,.58,d.y));
   float edgeLight=clamp(.54+(field-cloudField(cloudUV+sunDirection.xz*.24))*3.,0.,1.);
   float sun=max(0.,dot(d,sunDirection));
   vec3 cloudColor=mix(vec3(.11,.22,.35),vec3(.93,.96,1.),edgeLight);
   cloudColor+=vec3(.62,.41,.18)*pow(sun,7.)*edgeLight;
   c=mix(c,cloudColor,density*cloudBand);
   c+=vec3(5.3,3.7,2.1)*smoothstep(.99983,.99992,sun)*(1.-density*cloudBand*.91);
   gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`
 }));
 sky.renderOrder=-1000;
 scene.add(sky);
 return sky;
}

export function addWetSand(scene, sand) {
 const vertices=[];
 for(let i=0;i<150;i++){
  const x=-150+i*2, next=x+2;
  const edge=v=>-17.4+Math.sin(v*.23)*.38+Math.sin(v*.63)*.18;
  vertices.push(x,-.073,-19.05,x,-.073,edge(x),next,-.073,-19.05,
   next,-.073,-19.05,x,-.073,edge(x),next,-.073,edge(next));
 }
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 geo.computeVertexNormals();
 const mat=new T.MeshStandardMaterial({color:0xa98366,roughness:.38,side:T.DoubleSide});
 const shore=new T.Mesh(geo,mat);
 shore.receiveShadow=true;scene.add(shore);
 return shore;
}
