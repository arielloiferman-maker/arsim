import {loadModel} from './model-loader.js';
import outfitAsset from './sport-outfits.glb';

export async function loadSportOutfits(){
 const {scene}=await loadModel(outfitAsset);
 let fitted=null;
 return (character,mode)=>{
  if(!character)return;
  if(!fitted||fitted.character!==character){
   const spine=character.root.getObjectByName('Spine');
   const head=character.root.getObjectByName('Head');
   if(!spine||!head)return;
   const fabrics=new Map();
   character.root.traverse(part=>{
    if(!part.isMesh)return;
    for(const material of [].concat(part.material)){
     if(/Trousers|Cotton/.test(material.name))fabrics.set(material,material.color.clone());
    }
   });
   const coat=scene.getObjectByName('SkiCoat').clone(true);
   const helmet=scene.getObjectByName('SkiHelmet').clone(true);
   const vest=scene.getObjectByName('WaterVest').clone(true);
   spine.add(coat,vest);
   head.add(helmet);
   fitted={character,coat,helmet,vest,fabrics,mode:undefined};
  }
  if(fitted.mode===mode)return;
  fitted.mode=mode;
  fitted.coat.visible=fitted.helmet.visible=mode==='snow';
  fitted.vest.visible=mode==='water';
  for(const [material,original] of fitted.fabrics){
   if(mode==='snow')material.color.setHex(/Cotton/.test(material.name)?0xc93424:0x25334d);
   else if(mode==='water')material.color.setHex(0x152b38);
   else material.color.copy(original);
  }
 };
}
