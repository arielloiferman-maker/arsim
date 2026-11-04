export const seaSunDirection=[-.606,.14,-.783];
export const seaSunColor=[1,.86,.64];
export const seaHorizon=[.47,.69,.88];

// Shared by the sky and the reflection on the water.
export const seaAtmosphereGLSL=`
 vec3 clearSky(vec3 direction,vec3 lightDirection){
  float elevation=max(0.,direction.y);
  float sun=max(0.,dot(direction,lightDirection));
  vec3 color=mix(vec3(.47,.69,.88),vec3(.026,.144,.39),pow(elevation,.43));
  color+=vec3(.24,.29,.26)*pow(sun,5.)*(1.-smoothstep(.05,.5,elevation));
  return color+vec3(1.,.58,.26)*pow(sun,42.)*.48;
 }
`;
