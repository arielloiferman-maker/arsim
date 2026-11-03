import * as THREE from 'three';

export function waveHeight(x,z,t) {
 return .16*Math.sin(z*1.15+t*1.65+.55*Math.sin(x*.17))
  +.085*Math.sin(x*.73+z*.44-t*1.2)+.045*Math.sin(x*.23-z*.62+t*2.1);
}

export function makeOcean(scene) {
 const uniforms={
  time:{value:0}, wake:{value:new THREE.Vector4(0,0,0,1)}, wakePower:{value:0}
 };
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
   varying vec3 waterPoint;
   void main(){
    vec2 p=waterPoint.xz;
    float depth=max(0.,-19.-p.y);
    float swell=sin(p.y*1.15+time*1.65+.55*sin(p.x*.17));
    float ripples=sin(p.x*4.3+p.y*3.4-time*2.5)*sin(p.x*2.2-p.y*6.8+time*1.9);
    float glints=pow(max(0.,ripples),9.);
    float surfaceSlope=cos(p.y*1.15+time*1.65+.55*sin(p.x*.17));
    vec3 normal=normalize(vec3(-.15*cos(p.x*.73+p.y*.44-time*1.2),1.,-.22*surfaceSlope+.13*ripples));
    vec3 viewDir=normalize(cameraPosition-waterPoint);
    float fresnel=pow(1.-max(0.,dot(viewDir,normal)),4.);
    vec3 sunDir=normalize(vec3(-.47,.14,-.9));
    float reflection=pow(max(0.,dot(reflect(-sunDir,normal),viewDir)),45.);
    vec3 color=mix(vec3(.075,.62,.67),vec3(.018,.24,.40),smoothstep(0.,37.,depth));
    color+=vec3(.06,.14,.16)*swell*.32+vec3(.24,.34,.35)*glints*.45;
    color=mix(color,vec3(.49,.61,.70),fresnel*.49);
    color+=vec3(1.,.75,.45)*reflection*.62;
    float foam=(1.-smoothstep(.06,2.1,depth))*smoothstep(.22,.86,swell+.38*ripples);
    vec2 d=p-wake.xy;
    float behind=-dot(d,wake.zw), side=abs(d.x*wake.w-d.y*wake.z);
    float wash=smoothstep(0.,1.,behind)*(1.-smoothstep(6.,14.,behind))*(1.-smoothstep(.14,.8,abs(side-(.2+behind*.26))));
    foam=max(foam,wash*wakePower*(.65+.35*ripples));
    color=mix(color,vec3(.8,.95,.91),clamp(foam,0.,.87));
    float fog=smoothstep(48.,115.,distance(cameraPosition,waterPoint));
    if(cameraPosition.y<0.)color=mix(vec3(.075,.48,.56),vec3(.55,.82,.80),foam*.55+glints*.20);
    gl_FragColor=vec4(mix(color,vec3(.60,.70,.76),fog),1.);
   }`
 });
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(340,180,240,150),material);
 sea.rotation.x=-Math.PI/2;
 sea.position.set(0,.08,-109);
 scene.add(sea);
 return uniforms;
}
