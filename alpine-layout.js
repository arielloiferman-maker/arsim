import layout from './alpine-layout.json';

export {layout};
// Match the exact triangle split exported from Blender, including the mountain edges.
export function snowHeight({x,z}){
 const g=layout.terrain,fx=(x-g.x)/g.step,fz=(z-g.z)/g.step;
 if(fx<0||fz<0||fx>=g.cols-1||fz>=g.rows-1)return 0;
 const ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,i=iz*g.cols+ix;
 const a=g.heights[i],b=g.heights[i+1],c=g.heights[i+g.cols],d=g.heights[i+g.cols+1];
 return u>=v?a+(b-a)*u+(d-b)*v:a+(d-c)*u+(c-a)*v;
}

export function trailAt(position){
 let result=null,distance=Infinity;
 for(const trail of layout.trails){
  const points=trail.points;
  const t=Math.max(0,Math.min(points.length-1,(layout.summit.z-position.z)/(layout.summit.z-layout.finishZ)*(points.length-1)));
  const i=Math.min(points.length-2,Math.floor(t)),f=t-i;
  const x=points[i][0]+(points[i+1][0]-points[i][0])*f;
  const delta=Math.abs(position.x-x);
  if(delta<distance){distance=delta;result=trail;}
 }
 return distance<(result?.width??0)*1.8?result:null;
}

export function rampHeight(position){
 let height=0;
 for(const ramp of layout.ramps){
  const dx=position.x-ramp.x,dz=position.z-ramp.z;
  const along=dx*ramp.dx+dz*ramp.dz;
  const side=dx*-ramp.dz+dz*ramp.dx;
  if(along>=0&&along<=ramp.length&&Math.abs(side)<ramp.width/2){
   height=Math.max(height,along/ramp.length*ramp.height);
  }
 }
 return height;
}

export function crossedRamp(from,to){
 return layout.ramps.find(r=>{
  const previous=(from.x-r.x)*r.dx+(from.z-r.z)*r.dz;
  const next=(to.x-r.x)*r.dx+(to.z-r.z)*r.dz;
  if(previous>=r.length||next<r.length||next===previous)return false;
  const t=(r.length-previous)/(next-previous);
  const x=from.x+(to.x-from.x)*t-r.x,z=from.z+(to.z-from.z)*t-r.z;
  return Math.abs(-x*r.dz+z*r.dx)<r.width/2;
 });
}
