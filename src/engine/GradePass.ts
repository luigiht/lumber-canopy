import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Final colour grade for the moody look: slightly desaturated, cooler shadows with warm highlights
 * kept (lamps, windows), a touch more contrast and a soft vignette. `brightness` is the player's
 * display setting. Runs after OutputPass, on display (sRGB) colours.
 */
export function createGradePass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      brightness: { value: 1 },
      saturation: { value: 0.68 },
      contrast: { value: 1.06 },
      vignette: { value: 0.32 },
      shadowTint: { value: new THREE.Vector3(0.94, 0.98, 1.06) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float brightness, saturation, contrast, vignette;
      uniform vec3 shadowTint;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 col = c.rgb;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        // Keep warm, bright light (lamps, windows) saturated; mute everything else.
        float warm = smoothstep(0.55, 0.9, l) * smoothstep(0.0, 0.25, col.r - col.b);
        col = mix(vec3(l), col, mix(saturation, 1.0, warm));
        col *= mix(shadowTint, vec3(1.0), smoothstep(0.2, 0.85, l));
        col = (col - 0.5) * contrast + 0.5;
        col *= brightness;
        vec2 d = vUv - 0.5;
        col *= 1.0 - vignette * smoothstep(0.3, 0.85, length(d * vec2(1.15, 1.0)));
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
      }
    `,
  });
  return pass;
}
