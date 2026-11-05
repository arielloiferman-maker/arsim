import * as THREE from 'three';

const localY=new THREE.Vector3(0,1,0);
const turn=new THREE.Quaternion();
const direction=new THREE.Vector3(),axis=new THREE.Vector3(),pole=new THREE.Vector3();
const start=new THREE.Vector3(),bend=new THREE.Vector3(),end=new THREE.Vector3();

function aim(bone,target){
 direction.copy(target);
 bone.parent.worldToLocal(direction);
 direction.sub(bone.position).normalize();
 axis.copy(localY).applyQuaternion(bone.quaternion);
 bone.quaternion.premultiply(turn.setFromUnitVectors(axis,direction));
}

function poseLimb([upper,lower,tip],target,bendDirection){
 upper.getWorldPosition(start);
 end.copy(target).sub(start);
 const length=end.length();
 const scale=upper.getWorldScale(direction).x;
 const a=lower.position.length()*scale,b=tip.position.length()*scale;
 const distance=THREE.MathUtils.clamp(length,Math.abs(a-b)+.001,a+b-.001);
 end.divideScalar(Math.max(length,.001));
 pole.copy(bendDirection).addScaledVector(end,-bendDirection.dot(end)).normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance);
 bend.copy(start).addScaledVector(end,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
 aim(upper,bend);
 aim(lower,target);
}

const seat=new THREE.Vector3(),hip=new THREE.Vector3(),target=new THREE.Vector3(),bendDirection=new THREE.Vector3();
const tilt=new THREE.Quaternion();

export function poseRider(player,ride){
 const character=player.character;
 if(!character)return;
 const {root}=character;
 let pose=character.rider;
 if(!ride){
  if(!pose)return;
  player.g.add(root);
  root.position.copy(pose.standingPosition);
  root.rotation.set(0,0,0);
  for(const [bone,rest] of pose.joints)bone.quaternion.copy(rest);
  character.rider=null;
  return;
 }
 if(!pose){
  character.mixer.stopAllAction();
  character.current=null;
  character.remaining=0;
  const bone=name=>root.getObjectByName(name);
  const sides=['L','R'].map(side=>({
   arm:['UpperArm','Forearm','Hand'].map(name=>bone(name+side)),
   leg:['Thigh','Shin','Foot'].map(name=>bone(name+side))
  }));
  pose={standingPosition:root.position.clone(),pelvis:bone('Pelvis'),sides,joints:
   sides.flatMap(({arm,leg})=>[...arm,...leg]).map(joint=>[joint,joint.quaternion.clone()])};
  character.rider=pose;
 }
 const {steering,bench,snow,board}=ride;
 const mesh=ride.visual??ride.mesh;
 if(root.parent!==mesh)mesh.add(root);
 for(const [bone,rest] of pose.joints)bone.quaternion.copy(rest);
 const steer=steering?.rotation.y??0;
 const progress=ride.flightDuration?THREE.MathUtils.clamp(ride.flightTime/ride.flightDuration,0,1):0;
 const jumpFlex=Math.sin(progress*Math.PI);
 const compression=ride.landingCompression??0;
 const lean=bench?.08:.32+Math.min(.1,(ride.travelSpeed??0)*.001)+jumpFlex*.07+compression*.05;
 root.rotation.set(snow?.24:lean,snow&&board?Math.PI/2:Math.PI+steer*.55,0,'YXZ');
 root.position.set(0,0,0);
 pose.pelvis.getWorldPosition(hip);
 mesh.worldToLocal(hip);
 seat.set(0,snow?.89+jumpFlex*.07:bench?.65:.72+jumpFlex*.09-compression*.13,bench||snow?0:.15);
 root.position.copy(seat.sub(hip));
 mesh.getWorldQuaternion(tilt);
 for(const [index,{arm,leg}] of pose.sides.entries()){
  const side=index===0?1:-1;
  if(snow)mesh.localToWorld(target.set(side*(board?.06:.21),.14,board?side*.29:.09));
  else mesh.localToWorld(target.set(side*(bench?.17:.35),bench?.12:.43+jumpFlex*.025,bench?-.36:.34));
  bendDirection.set(side*.22,.22,-1).applyQuaternion(tilt);
  poseLimb(leg,target,bendDirection);
  leg[2].getWorldPosition(target).add(bendDirection.set(0,-.24,-1).applyQuaternion(tilt));
  aim(leg[2],target);
  const grip=steering?.getObjectByName('RiptideGrip_'+(index===0?'port':'starboard'));
  if(grip)grip.localToWorld(target.set(-side*.015,.025,-.065));
  else if(snow)mesh.localToWorld(target.set(side*.42,.97,-.26));
  else if(bench)mesh.localToWorld(target.set(side*.19,.68,-.27));
  else mesh.localToWorld(target.set(side*.34,.89,-.23));
  bendDirection.set(side*.8,-1,.15).applyQuaternion(tilt);
  poseLimb(arm,target,bendDirection);
  arm[2].getWorldPosition(target).add(bendDirection.set(-side*.1,-.12,-1).applyQuaternion(tilt));
  aim(arm[2],target);
 }
}
