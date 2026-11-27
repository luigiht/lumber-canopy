import * as THREE from 'three';

let installed = false;

/**
 * Replaces three.js' depth fog with mist measured as horizontal distance from the clearing's centre.
 * With an orthographic camera, depth fog would grey out the back of the play area; radial fog keeps
 * the clearing crisp and dissolves the surrounding land into mist, as in the Misty Mountain reference.
 * Must run before any material compiles.
 */
export function installRadialFog() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogHeight;
#endif`;
  C.fog_vertex = `
#ifdef USE_FOG
  vec4 fogWP = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    fogWP = batchingMatrix * fogWP;
  #endif
  #ifdef USE_INSTANCING
    fogWP = instanceMatrix * fogWP;
  #endif
  fogWP = modelMatrix * fogWP;
  vFogDepth = length( fogWP.xz );
  vFogHeight = fogWP.y;
#endif`;
  C.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogHeight;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  // Mist pools low: valleys fill first while treetops poke through a little longer.
  fogFactor = clamp( fogFactor * ( 1.12 - 0.22 * clamp( vFogHeight / 5.0, 0.0, 1.0 ) ), 0.0, 1.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}
