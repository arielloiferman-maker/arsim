import * as T from 'three';

const materials = new Map();
function paint(color) {
 if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({color, roughness:.84, flatShading:true, side:T.DoubleSide}));
 return materials.get(color);
}
function mesh(parent, geometry, color, x=0,y=0,z=0) {
 const m=new T.Mesh(geometry,paint(color));
 m.position.set(x,y,z);
 m.castShadow=m.receiveShadow=true;
 parent.add(m);
 return m;
}
const box=(g,x,y,z,w,h,d,c)=>mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);
function beam(g,a,b,r,c) {
 const p=new T.Vector3(...a), q=new T.Vector3(...b), delta=q.clone().sub(p);
 const m=mesh(g,new T.CylinderGeometry(r,r,delta.length(),6),c);
 m.position.copy(p.lerp(q,.5));
 m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
 return m;
}
const timber=0x875437, cream=0xffedcc;
export const beerShop={x:-31,z:-2,halfWidth:3.8,halfDepth:2.7,doorHalfWidth:1.15};
export const beerShopSeats=[-2.5,2.5].map(offset=>({x:beerShop.x+offset,z:beerShop.z+3.55}));

export function insideBeerShop(position){
 return Math.abs(position.x-beerShop.x)<beerShop.halfWidth
     &&Math.abs(position.z-beerShop.z)<beerShop.halfDepth;
}

export function beerShopWall(x,z){
 const dx=Math.abs(x-beerShop.x),dz=z-beerShop.z;
 const {halfWidth,halfDepth,doorHalfWidth}=beerShop;
 if(dx>halfWidth+.25||Math.abs(dz)>halfDepth+.25)return false;
 const counter=dx<2.95&&Math.abs(dz+1.8)<.53;
 return counter||dx>halfWidth-.25||dz< -halfDepth+.25||(dz>halfDepth-.25&&dx>doorHalfWidth-.18);
}

export function beerBottle(){
 const bottle=new T.Group();
 mesh(bottle,new T.CylinderGeometry(.092,.096,.24,16),0x683210,0,.12);
 mesh(bottle,new T.CylinderGeometry(.044,.092,.076,16),0x683210,0,.278);
 mesh(bottle,new T.CylinderGeometry(.041,.044,.10,16),0x683210,0,.36);
 mesh(bottle,new T.CylinderGeometry(.048,.048,.019,16),0xd5af5c,0,.416);
 mesh(bottle,new T.CylinderGeometry(.095,.096,.105,16),0xede0aa,0,.14);
 return bottle;
}

export function buildBeerShop(scene){
 const shop=new T.Group();
 const {x,z,halfWidth,halfDepth,doorHalfWidth}=beerShop;
 shop.position.set(x,0,z);
 const wall=0xb77649,roof=0x224854,trim=0xe4ae69;
 box(shop,0,-.025,0,halfWidth*2,.06,halfDepth*2,0xb59466);
 box(shop,0,1.42,-halfDepth,halfWidth*2,2.84,.18,wall);
 for(const side of [-1,1]){
  box(shop,side*halfWidth,1.42,0,.18,2.84,halfDepth*2,wall);
  box(shop,side*(halfWidth+doorHalfWidth)/2,1.42,halfDepth,halfWidth-doorHalfWidth,2.84,.18,wall);
  box(shop,side*doorHalfWidth,1.10,halfDepth,.13,2.2,.25,trim);
 }
 box(shop,0,2.56,halfDepth,doorHalfWidth*2,.64,.18,wall);
 box(shop,0,2.94,0,8.2,.22,6.12,roof);
 box(shop,0,.49,-1.8,5.6,.98,.72,0x70472e);
 box(shop,0,1.02,-1.8,5.75,.12,.88,trim);
 box(shop,0,1.72,-2.49,5.5,.085,.34,trim);
 for(const seat of beerShopSeats){
  const seatX=seat.x-x,seatZ=seat.z-z;
  box(shop,seatX,.49,seatZ,1.7,.15,.55,trim);
  box(shop,seatX,.77,seatZ-.28,1.7,.36,.11,wall);
  for(const side of [-1,1])box(shop,seatX+side*.63,.23,seatZ,.13,.46,.40,roof);
 }
 for(let i=0;i<9;i++){
  const bottle=beerBottle();
  bottle.position.set((i-4)*.53,1.77,-2.45);
  shop.add(bottle);
 }
 const sign=document.createElement('canvas');
 sign.width=512;sign.height=128;
 const ctx=sign.getContext('2d');
 ctx.fillStyle='#193c49';ctx.fillRect(0,0,512,128);
 ctx.strokeStyle='#e1b765';ctx.lineWidth=5;ctx.strokeRect(9,9,494,110);
 ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='#fff0ba';ctx.fillText('חנות בירה',256,65);
 const label=new T.CanvasTexture(sign);
 label.colorSpace=T.SRGBColorSpace;
 const face=new T.Mesh(new T.PlaneGeometry(2.8,.7),new T.MeshBasicMaterial({map:label}));
 face.position.set(0,2.56,halfDepth+.11);
 shop.add(face);
 scene.add(shop);
 return shop;
}
export function parasol(color) {
 const g=new T.Group();
 beam(g,[0,0,0],[0,2.64,0],.045,0xede4d2);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,b=a+Math.PI/4;
  const at=(angle,r,y)=>[Math.cos(angle)*r,y,Math.sin(angle)*r];
  const A=at(a,.88,2.43), B=at(b,.88,2.43), C=at(a,1.56,2.11), D=at(b,1.56,2.11);
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute([[0,2.63,0],A,B,A,C,D,A,D,B,C,D,at(b,1.56,1.97),C,at(b,1.56,1.97),at(a,1.56,1.97)].flat(),3));
  geo.computeVertexNormals();
  mesh(g,geo,i%2?cream:color);
  beam(g,[0,2.6,0],C,.012,0xe4d6bf);
 }
 mesh(g,new T.SphereGeometry(.075,8,6),cream,0,2.65,0);
 return g;
}
export function lounger(color=0x2f8eab) {
 const g=new T.Group();
 for(const x of [-.39,.39]){
  beam(g,[x,.07,.68],[x,.48,-.36],.045,timber);
  beam(g,[x,.06,-.68],[x,1.15,-.64],.042,timber);
  beam(g,[x,.41,.57],[x,1.22,-.72],.05,timber);
  box(g,x,.64,.07,.11,.065,.63,timber);
 }
 for(let i=0;i<7;i++){
  const x=(i-3)*.101, c=i%3===0?cream:color;
  box(g,x,.43,.23,.103,.027,.71,c);
  const back=box(g,x,.83,-.48,.103,.031,.89,c);
  back.rotation.x=1.12;
 }
 for(const [y,z] of [[.42,.61],[1.2,-.67],[.12,-.65]]) beam(g,[-.43,y,z],[.43,y,z],.035,timber);
 return g;
}
function palm(g,x,z,h) {
 for(let i=0;i<9;i++){
  const y=h*i/9, u=i/9;
  const trunk=mesh(g,new T.CylinderGeometry(.19-u*.07,.22-u*.07,h/9+.025,7),i%3?0x825437:0x9b6543,x+u*u*.48,y+h/18,z);
  trunk.rotation.z=-u*.13;
 }
 for(let i=0;i<8;i++){
  const leaf=new T.BufferGeometry();
  leaf.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.9,.5,-.49,1.3,.72,0,0,0,0,1.3,.72,0,.9,.5,.49,.9,.5,-.49,2.65,-.32,0,1.3,.72,0,.9,.5,.49,1.3,.72,0,2.65,-.32,0],3));
  leaf.computeVertexNormals();
  mesh(g,leaf,[0x426c27,0x678b31,0x315924][i%3],x+.48,h,z).rotation.y=i*.785+x;
 }
}
function hotel(g,x,z,w,h,c) {
 box(g,x,h/2,z,w,h,5,c);
 box(g,x,h+.15,z,w+.42,.3,5.4,cream);
 for(let y=1.8;y<h;y+=1.9){
  box(g,x,y-.72,z-2.54,w,.15,.23,cream);
  for(let dx=-w/2+1;dx<w/2-.4;dx+=1.65){
   box(g,x+dx,y,z-2.54,1,.98,.12,cream);
   box(g,x+dx,y,z-2.62,.82,.8,.08,0x427483);
   box(g,x+dx,y,z-2.68,.065,.8,.03,cream);
  }
 }
}
const px=29,pz=-7;
export function resortRoutes(){
 const path=new T.CatmullRomCurve3([[px-4,5.64,pz-4],[px-4,4.7,pz-2],[px-4,1.25,pz],[px-4,.43,pz+3]].map(p=>new T.Vector3(...p)));
 const spiral=[new T.Vector3(px+4,5.64,pz-4)];
 for(let i=0;i<=52;i++){
  const t=i/52,a=t*Math.PI*3.3;
  spiral.push(new T.Vector3(px+4+Math.sin(a)*1.85,5.6-t*5.15,pz-3+Math.cos(a)*1.85));
 }
 spiral.push(new T.Vector3(px+4,.43,pz+.9));
 return [{x:px-4,z:pz-4,path},{x:px+4,z:pz-4,path:new T.CatmullRomCurve3(spiral)}];
}
export function buildResort(scene) {
 const g=new T.Group(); scene.add(g);
 const pickups=[];
 const jetSkis=[];
 for(let i=0;i<10;i++){
  const x=-85+i*19,z=-78-(i%3)*9;
  mesh(g,new T.ConeGeometry(16+i%3*4,24+i%4*6,5),i%2?0x75806a:0x818b82,x,12,z).rotation.y=i*.9;
 }
 box(g,0,.035,17,83,.13,4.6,0xd7c5ac);
 box(g,0,.025,20.8,83,.10,3,0x656572);
 for(let x=-39;x<40;x+=4) box(g,x,.085,20.8,1.7,.012,.07,cream);
 [[-29,27,11,9,0xedaf92],[-15,27,12,12,0xf1d3a6],[0,27,12,8,0x8bb7c2],[15,27,12,10,0xd98c7d],[30,27,11,8,0xc7abc7]].forEach(([x,z,w,h,c])=>hotel(g,x,z,w,h,c));
 for(let i=0;i<19;i++){
  const x=(i-9)*7.8,z=39+(i%3)*7,h=10+(i*13%27);
  const color=[0x9cb9c4,0xd8d4c7,0x829ba8,0xc2c9c6][i%4];
  box(g,x,h/2,z,6.6,h,6.3,color);
  box(g,x,h+.15,z,5.1,.3,5.2,cream);
  for(let y=1.7;y<h-.5;y+=1.35)box(g,x,y,z-3.17,5.7,.72,.065,0x507687);
  for(let dx=-2.2;dx<3;dx+=1.12)box(g,x+dx,h/2,z-3.22,.09,h-.6,.07,color);
 }
 for(let i=0;i<32;i++){
  const x=(i%16-7.5)*4.9+Math.sin(i*4.12)*1.65, z=(i<16?-17:14)+Math.cos(i*2.31)*1.6;
  palm(g,x,z,3.4+(i*17%13)*.18);
 }
 for(let i=0;i<12;i++){
  const x=(i%6-2.5)*5.6+Math.sin(i*2.39)*1.1,z=(i<6?-9:9)+Math.cos(i*3.11)*1.2;
  if(Math.abs(x)<4&&z>0)continue;
  const color=[0xe9a436,0x61a9a9,0xdc7486,0x4278ad][i%4];
  const shade=parasol(color);shade.position.set(x,0,z);shade.rotation.y=i*.47;shade.scale.setScalar(1+Math.sin(i*1.81)*.10);g.add(shade);pickups.push({mesh:shade,type:'umbrella'});
  for(const dx of [-.9,.9]){
   const chair=lounger(color);chair.position.set(x+dx,0,z+.42+Math.sin(i+dx)*.33);chair.rotation.y=dx*.16+Math.sin(i*2+dx)*.35;g.add(chair);pickups.push({mesh:chair,type:'chair'});
  }
  const cooler=new T.Group();cooler.position.set(x+1.9,0,z+.4);g.add(cooler);
  box(cooler,0,.23,0,.58,.42,.43,0x427c9a);
  box(cooler,0,.46,0,.62,.07,.46,cream);
  pickups.push({mesh:cooler,type:'cooler'});
  const towel=box(g,x-1.95,.024,z+1.6,.82,.04,1.66,color);towel.rotation.y=.23;
  pickups.push({mesh:towel,type:'blanket'});
 }
 // Timber pier, stilt hut and boards on the west side of the bay.
 for(let i=0;i<26;i++) box(g,-27,.44,-16-i*.33,3.3,.13,.31,i%3===0?0x9d6b49:timber);
 for(const x of [-28.46,-25.54])for(let i=0;i<5;i++)box(g,x,.34,-16-i*1.85,.2,1,.21,0x644631);
 const hut=new T.Group();hut.position.set(-27,.52,-23.1);g.add(hut);
 box(hut,0,1.18,0,4.9,2.36,4,0xe4ceb0);
 for(let i=0;i<13;i++)box(hut,-2.35+i*.39,1.18,2.025,.03,2.34,.035,0xc6a98b);
 for(const x of [-1.48,1.48]){box(hut,x,1.48,2.05,1.03,.93,.11,timber);box(hut,x,1.48,2.12,.84,.75,.06,0x427483);}
 box(hut,0,.97,2.09,.8,1.94,.13,timber);
 for(const side of [-1,1])box(hut,side*1.32,2.78,0,3.1,.17,4.52,0x92593c).rotation.z=-side*.47;
 for(let i=0;i<4;i++){
  const board=mesh(g,new T.CapsuleGeometry(.34,1.5,4,10),[0xefd24a,0x47a7ac,0xd86e64,0x4278ad][i],-22+i*.66,1.08,-15);
  board.scale.set(.7,1,.23);pickups.push({mesh:board,type:'surfboard'});
 }
 for(const [x,z,color] of [[-18,-19,0xe6533f],[-22,-20,0x459eb1]]){
  const ski=new T.Group();ski.position.set(x,.17,z);ski.rotation.y=.7;g.add(ski);jetSkis.push(ski);
  mesh(ski,new T.CapsuleGeometry(.48,1.5,5,12),cream).rotation.x=Math.PI/2;
  box(ski,0,.31,0,.78,.24,1.55,color);
  box(ski,0,.47,.33,.48,.16,.84,0x252a30);
  box(ski,0,.52,-.56,.56,.33,.39,color).rotation.x=.26;
  beam(ski,[-.33,.81,-.48],[.33,.81,-.48],.035,0x252a30);
  ski.scale.y=.65;
 }
 // Beach café with a striped canopy and outdoor tables.
 box(g,-15,1.3,-16,4.1,2.6,2.25,0xf0d5a9);
 box(g,-15,1.63,-14.84,3.2,1.15,.09,0x334b52);
 box(g,-15,1.03,-14.61,3.65,.13,.57,timber);
 for(let i=0;i<10;i++)box(g,-17+i*.44,2.32,-14.32,.44,.075,1.22,i%2?cream:0xdc715b).rotation.x=.16;
 for(const x of [-18,-15,-12]){
  beam(g,[x,0,-12.2],[x,.73,-12.2],.07,timber);
  mesh(g,new T.CylinderGeometry(.61,.61,.075,10),cream,x,.76,-12.2);
 }
 // Pool, open flume and spiral tube with timber stair towers.
 box(g,px,.07,pz,15,.15,14,0xbaa68e);
 box(g,px,.18,pz+2,12,.16,7,cream);
 box(g,px,.27,pz+2,11.45,.035,6.45,0x77c6cc);
 for(const tx of [px-4,px+4]){
  for(const dx of [-1.05,1.05])for(const dz of [-1,1])beam(g,[tx+dx,0,pz-4+dz],[tx+dx,5.6,pz-4+dz],.09,timber);
  box(g,tx-.5,5.55,pz-4,3.4,.18,2.4,timber);
  for(let i=0;i<24;i++)box(g,tx-1.5,i*.23+.12,pz+2-i*.26,1,.17,.34,timber);
 }
 const slides=resortRoutes();
 const path=slides[0].path;
 for(let i=0;i<33;i++){
  const p=path.getPoint(i/33), tangent=path.getTangent(i/33), angle=Math.atan2(-tangent.y,tangent.z);
  box(g,p.x,p.y,p.z,2.05,.09,.29,cream).rotation.x=angle;
  for(const dx of [-1.06,1.06])box(g,p.x+dx,p.y+.14,p.z,.11,.3,.29,0x4977a0).rotation.x=angle;
 }
 const tubePath=slides[1].path;
 mesh(g,new T.TubeGeometry(tubePath,84,.47,10,false),0xe95136);
 for(let i=0;i<23;i++)box(g,px-7.5+i*.66,.56,pz+7,.47,1.03,.08,cream);
 for(const y of [.27,.86])box(g,px,y,pz+7,15.4,.09,.07,cream);
 return {layout:g,pickups,jetSkis,slides};
}

export function sportsBall(type) {
 const radius={ball:.28,beachball:.48,volley:.38}[type];
 const colors={ball:[0xffd64c,0xfff2bd],beachball:[0xff624e,0xffe376,0x4bb8bc,0xfff5de,0x548adb,0xf484a8],volley:[0xf2ce52,0x365b9c,0xffe77f,0x264e89]}[type];
 const ball=new T.Group();
 colors.forEach((color,i)=>{
  const angle=2*Math.PI/colors.length;
  const panel=mesh(ball,new T.SphereGeometry(radius,12,22,i*angle,angle),color);
  panel.material=new T.MeshPhysicalMaterial({color,roughness:.36,clearcoat:.48,clearcoatRoughness:.28});
  const seam=[];
  for(let j=0;j<=24;j++){
   const p=j*Math.PI/24,r=radius*1.002;
   seam.push(new T.Vector3(-r*Math.cos(i*angle)*Math.sin(p),r*Math.cos(p),r*Math.sin(i*angle)*Math.sin(p)));
  }
  mesh(ball,new T.TubeGeometry(new T.CatmullRomCurve3(seam),24,.004,4,false),0x706768);
 });
 ball.position.y=radius;
 return ball;
}
