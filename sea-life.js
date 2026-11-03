import * as T from 'three';

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
  vertexShader:`varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 ray;void main(){
   vec3 d=normalize(ray);
   vec3 c=mix(vec3(.97,.68,.45),vec3(.27,.43,.62),smoothstep(-.08,.66,d.y));
   float clouds=sin(d.x*17.+d.y*31.)*sin(d.z*12.-d.y*51.)+sin(d.x*37.+d.z*38.)*.34;
   c=mix(c,vec3(.78,.63,.62),smoothstep(.25,.94,clouds)*smoothstep(.02,.12,d.y)*.55);
   float sun=max(0.,dot(d,normalize(vec3(-.47,.10,-.9))));
   c+=vec3(.40,.25,.08)*pow(sun,22.)+vec3(.62,.50,.24)*smoothstep(.9993,.9998,sun);
   gl_FragColor=vec4(c,1.);
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
}
