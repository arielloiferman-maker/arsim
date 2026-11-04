import {Vector2} from 'three';

export function renderPhoto(renderer,scene,camera,width,height,exposure){
 const photo=document.createElement('canvas');
 photo.width=width;
 photo.height=height;
 const context=photo.getContext('2d',{alpha:false});
 const size=renderer.getSize(new Vector2());
 const ratio=renderer.getPixelRatio();
 const aspect=camera.aspect;
 const previousExposure=renderer.toneMappingExposure;
 // Tiles keep the WebGL drawing buffer within a modest size even for an 8K photo.
 const tile=Math.min(2048,renderer.capabilities.maxTextureSize);
 try{
  renderer.setPixelRatio(1);
  renderer.toneMappingExposure=previousExposure*2**exposure;
  for(let y=0;y<height;y+=tile){
   for(let x=0;x<width;x+=tile){
    const w=Math.min(tile,width-x),h=Math.min(tile,height-y);
    renderer.setSize(w,h,false);
    camera.setViewOffset(width,height,x,y,w,h);
    renderer.render(scene,camera);
    context.drawImage(renderer.domElement,x,y);
   }
  }
  return photo;
 }finally{
  camera.clearViewOffset();
  camera.aspect=aspect;
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure=previousExposure;
  renderer.setPixelRatio(ratio);
  renderer.setSize(size.x,size.y,false);
  renderer.render(scene,camera);
 }
}
