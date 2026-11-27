import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/**
 * Three flat light bands (shadow, mid, lit) for cel shading, like the flat tones of an illustration.
 * Shared by every toon material.
 */
export function toonGradient() {
  if (!gradient) {
    const tones = [110, 185, 255];
    gradient = new THREE.DataTexture(new Uint8Array(tones), tones.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** The marker three.js uses where a directional light's shadow is applied. */
const SHADOW_TEST = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow(';

/**
 * Faces turned away from the sun already sit in the darkest toon band, so skip the shadow map
 * there. Sampling it on those faces only produced shadow acne: noisy triangles along the greedy-
 * meshed quads. Lit faces keep crisp, blocky shadows from whatever stands between them and the sun.
 */
export function patchToonShadows(shader: { fragmentShader: string }) {
  const lights = THREE.ShaderChunk.lights_fragment_begin;
  if (!lights.includes(SHADOW_TEST)) return; // three.js changed; keep the default behaviour
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    lights.replace(
      SHADOW_TEST,
      'directLight.color *= ( directLight.visible && receiveShadow && dot( geometryNormal, directLight.direction ) > 0.02 ) ? getShadow(',
    ),
  );
}

/** Cel-shaded material for voxel geometry with baked vertex colours. */
export function toonMaterial(params: THREE.MeshToonMaterialParameters = {}) {
  const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), ...params });
  material.onBeforeCompile = patchToonShadows;
  return material;
}
