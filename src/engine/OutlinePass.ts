import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Ink outlines for the illustrated look: wherever the depth jumps (silhouettes, one shape in front
 * of another) the nearer pixel is darkened toward an ink tone tinted by its own colour, the way the
 * reference illustrations draw coloured line art. Lines fade into the mist.
 */
export class OutlinePass extends Pass {
  readonly uniforms = {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2() },
    near: { value: 1 },
    far: { value: 220 },
    threshold: { value: 0.3 },
    thickness: { value: 1.5 },
    strength: { value: 0.85 },
    ink: { value: new THREE.Color(0x1d1626) },
    fogColor: { value: new THREE.Color(0xffffff) },
    fogNear: { value: 14 },
    fogFar: { value: 34 },
    projInv: { value: new THREE.Matrix4() },
    camWorld: { value: new THREE.Matrix4() },
  };
  private readonly quad: FullScreenQuad;

  constructor(private readonly camera: THREE.OrthographicCamera) {
    super();
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          uniform sampler2D tDepth;
          uniform vec2 texel;
          uniform float near, far, threshold, thickness, strength;
          uniform vec3 ink, fogColor;
          uniform float fogNear, fogFar;
          uniform mat4 projInv, camWorld;
          varying vec2 vUv;
          // Orthographic depth is linear: map straight to view distance.
          float viewZ(vec2 uv) { return near + texture2D(tDepth, uv).x * (far - near); }
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float d = viewZ(vUv);
            vec2 o = texel * thickness;
            // Only the nearer side of a depth jump gets the line, so outlines sit on the object.
            float jump = 0.0;
            jump = max(jump, viewZ(vUv + vec2(o.x, 0.0)) - d);
            jump = max(jump, viewZ(vUv - vec2(o.x, 0.0)) - d);
            jump = max(jump, viewZ(vUv + vec2(0.0, o.y)) - d);
            jump = max(jump, viewZ(vUv - vec2(0.0, o.y)) - d);
            jump = max(jump, viewZ(vUv + o) - d);
            jump = max(jump, viewZ(vUv - o) - d);
            jump = max(jump, viewZ(vUv + vec2(o.x, -o.y)) - d);
            jump = max(jump, viewZ(vUv + vec2(-o.x, o.y)) - d);
            float edge = smoothstep(threshold, threshold * 1.8, jump);
            // Fade lines with the same radial mist the scene uses, so distant trees stay soft.
            vec4 ndc = vec4(vUv * 2.0 - 1.0, texture2D(tDepth, vUv).x * 2.0 - 1.0, 1.0);
            vec4 wp = camWorld * (projInv * ndc);
            float fog = smoothstep(fogNear * 0.85, fogNear + (fogFar - fogNear) * 0.45, length(wp.xz));
            vec3 line = mix(c.rgb * 0.28, ink, 0.45);
            gl_FragColor = vec4(mix(c.rgb, line, edge * strength * (1.0 - fog)), c.a);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.texel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    u.near.value = this.camera.near;
    u.far.value = this.camera.far;
    u.projInv.value.copy(this.camera.projectionMatrixInverse);
    u.camWorld.value.copy(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  dispose() {
    this.quad.material.dispose();
    this.quad.dispose();
  }
}
