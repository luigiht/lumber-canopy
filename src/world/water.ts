import * as THREE from 'three';
import { PALETTE as P } from '@/voxel/palette';
import { toonMaterial } from '@/engine/toon';
import type { Terrain } from './terrain';

/**
 * Stream and waterfalls. The water is a greedy-meshed voxel volume; a small shader patch adds
 * drifting ripple bands and sparkles on top faces and falling streaks on vertical faces,
 * quantised to the voxel grid so it stays pixel-crisp.
 */
export class Water {
  readonly group = new THREE.Group();
  private readonly uniforms = { uTime: { value: 0 }, uFoam: { value: new THREE.Color(P.foam) } };
  private readonly splash: Splash;

  constructor(terrain: Terrain) {
    const material = toonMaterial();
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime;
uniform vec3 uFoam;
varying vec3 vWPos;
varying vec3 vWNrm;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  float top = step(0.5, vWNrm.y);
  vec3 col = diffuseColor.rgb;
  // Top: bands drifting downstream (+z) plus twinkling highlight voxels.
  vec2 cell = floor(vWPos.xz * 16.0);
  float band = sin((cell.y / 16.0 - uTime * 0.9) * 7.0 + sin(cell.x / 16.0 * 3.1) * 1.6);
  col *= mix(1.0, 1.0 + 0.18 * step(0.35, band), top);
  float tw = h21(cell + floor(uTime * 3.0) * 0.37);
  col = mix(col, uFoam, top * step(0.975, tw) * 0.85);
  // Sides: streaks falling down.
  vec2 sc = floor(vec2((vWPos.x + vWPos.z) * 16.0, (vWPos.y + uTime * 1.8) * 12.0));
  float s = h21(sc);
  col = mix(col, uFoam, (1.0 - top) * step(0.55, s) * 0.8);
  diffuseColor.rgb = col;
}`,
        );
    };

    const mesh = new THREE.Mesh(terrain.buildWaterGeometry(), material);
    mesh.receiveShadow = true;
    mesh.name = 'water';
    this.group.add(mesh);

    // Splash emitters where each fall lands.
    const steps = terrain.cfg.stream.steps;
    const emitters: THREE.Vector3[] = [];
    for (let s = 0; s < steps.length - 1; s++) {
      const z = steps[s].zBelow + 0.15;
      emitters.push(new THREE.Vector3(terrain.streamXAt(z), steps[s + 1].level, z));
    }
    this.splash = new Splash(emitters, terrain.cfg.stream.halfWidth);
    this.group.add(this.splash.mesh);
  }

  update(dt: number, time: number) {
    this.uniforms.uTime.value = time;
    this.splash.update(dt);
  }
}

/** Tiny voxel droplets hopping up from the base of each waterfall. */
class Splash {
  readonly mesh: THREE.InstancedMesh;
  private readonly count = 90;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly sc = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  constructor(
    private readonly emitters: THREE.Vector3[],
    private readonly spread: number,
  ) {
    const size = 1 / 16;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshLambertMaterial({ color: P.foam });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'splash';
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this.respawn(i, Math.random());
  }

  private respawn(i: number, age = 0) {
    const e = this.emitters[i % this.emitters.length];
    this.pos[i * 3] = e.x + (Math.random() - 0.5) * this.spread * 1.6;
    this.pos[i * 3 + 1] = e.y;
    this.pos[i * 3 + 2] = e.z + Math.random() * 0.2;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    this.vel[i * 3 + 1] = 0.8 + Math.random() * 1.0;
    this.vel[i * 3 + 2] = 0.2 + Math.random() * 0.6;
    this.life[i] = age;
  }

  update(dt: number) {
    if (!this.emitters.length) return;
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < this.count; i++) {
      this.life[i] += step * 1.4;
      this.vel[i * 3 + 1] -= 5.5 * step;
      this.pos[i * 3] += this.vel[i * 3] * step;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * step;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * step;
      const e = this.emitters[i % this.emitters.length];
      if (this.life[i] >= 1 || this.pos[i * 3 + 1] < e.y - 0.05) this.respawn(i);
      // Snap to the voxel grid so droplets read as voxels, not floating cubes.
      const g = 16;
      this.p.set(Math.round(this.pos[i * 3] * g) / g, Math.round(this.pos[i * 3 + 1] * g) / g, Math.round(this.pos[i * 3 + 2] * g) / g);
      const s = 1 - this.life[i] * 0.6;
      this.sc.set(s, s, s);
      this.m.compose(this.p, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
