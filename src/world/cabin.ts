import * as THREE from 'three';
import { CABIN, type StageId } from '@/config/cabin';
import { cabin as buildCabinModels } from '@/voxel/models/cabin';
import { greedyMesh, PROP_VOXEL } from '@/voxel/greedyMesh';
import type { VoxelModel } from '@/voxel/VoxelModel';
import { toonMaterial } from '@/engine/toon';

const V = PROP_VOXEL;

export type CabinPhase = 'plot' | 'building' | 'done';

interface Stage {
  id: StageId;
  name: string;
  seconds: number;
  meshes: THREE.Mesh[];
  plane: THREE.Plane;
  minY: number;
  maxY: number;
}

/** Meshes only the occupied part of a model, positioned so its pivot sits at the origin. */
function meshTight(model: VoxelModel) {
  const g = model.grid;
  const min = [g.sx, g.sy, g.sz];
  const max = [0, 0, 0];
  for (let y = 0; y < g.sy; y++)
    for (let z = 0; z < g.sz; z++)
      for (let x = 0; x < g.sx; x++)
        if (g.data[x + g.sx * (z + g.sz * y)]) {
          min[0] = Math.min(min[0], x);
          min[1] = Math.min(min[1], y);
          min[2] = Math.min(min[2], z);
          max[0] = Math.max(max[0], x + 1);
          max[1] = Math.max(max[1], y + 1);
          max[2] = Math.max(max[2], z + 1);
        }
  if (max[0] === 0) return null;
  const geo = greedyMesh(g, {
    min: min as [number, number, number],
    max: max as [number, number, number],
    voxelSize: V,
    offset: [-model.pivot.x * V, -model.pivot.y * V, -model.pivot.z * V],
  });
  return { geo, minY: min[1] * V, maxY: max[1] * V };
}

/**
 * The starter cabin. Starts as a staked-out plot; once building begins, each stage rises one voxel
 * layer at a time (a clipping plane sweeping upward) while the lumberjack works. When finished the
 * windows glow at night, a porch light warms the front, and the chimney smokes.
 */
export class Cabin {
  readonly group = new THREE.Group();
  phase: CabinPhase = 'plot';
  stageIndex = 0;
  stageT = 0;
  readonly stages: Stage[] = [];
  /** World-space footprint of everything at ground level, for blocking the lumberjack's routes. */
  readonly footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly center: THREE.Vector3;
  private readonly plot: THREE.Mesh;
  private readonly glowMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly porchLight: THREE.PointLight;
  private readonly smoke: Smoke;
  private readonly dayGlass = new THREE.Color(0x4a6278);
  private readonly nightGlass = new THREE.Color(0xffc062);

  constructor(groundY: number) {
    const parts = buildCabinModels();
    this.group.position.set(CABIN.x, groundY, CABIN.z);
    this.center = this.group.position.clone();

    let fp = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const cfg of CABIN.stages) {
      const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e3);
      const stage: Stage = { ...cfg, meshes: [], plane, minY: Infinity, maxY: -Infinity };
      const add = (model: VoxelModel | undefined, glow: boolean) => {
        if (!model) return;
        const m = meshTight(model);
        if (!m) return;
        const material = glow
          ? new THREE.MeshBasicMaterial({ color: this.dayGlass.clone() })
          : toonMaterial({ side: THREE.DoubleSide });
        material.clippingPlanes = [plane];
        material.clipShadows = true;
        if (glow) this.glowMaterials.push(material as THREE.MeshBasicMaterial);
        const mesh = new THREE.Mesh(m.geo, material);
        mesh.castShadow = !glow;
        mesh.receiveShadow = true;
        mesh.visible = false;
        mesh.name = `cabin-${cfg.id}${glow ? '-glass' : ''}`;
        stage.minY = Math.min(stage.minY, m.minY);
        stage.maxY = Math.max(stage.maxY, m.maxY);
        stage.meshes.push(mesh);
        this.group.add(mesh);
        if (!glow && m.minY < 0.5) {
          const bb = m.geo.boundingBox!;
          fp = {
            minX: Math.min(fp.minX, bb.min.x),
            maxX: Math.max(fp.maxX, bb.max.x),
            minZ: Math.min(fp.minZ, bb.min.z),
            maxZ: Math.max(fp.maxZ, bb.max.z),
          };
        }
      };
      add(parts.solid[cfg.id], false);
      add(parts.glow[cfg.id], true);
      this.stages.push(stage);
    }
    this.footprint = {
      minX: fp.minX + CABIN.x,
      maxX: fp.maxX + CABIN.x,
      minZ: fp.minZ + CABIN.z,
      maxZ: fp.maxZ + CABIN.z,
    };

    const plot = meshTight(parts.plot)!;
    this.plot = new THREE.Mesh(plot.geo, toonMaterial());
    this.plot.castShadow = true;
    this.group.add(this.plot);

    this.porchLight = new THREE.PointLight(0xffa64d, 0, 7, 1.5);
    this.porchLight.position.set(parts.door.x * V, parts.door.y * V + 1.1, parts.door.z * V + 0.3);
    this.group.add(this.porchLight);

    this.smoke = new Smoke(new THREE.Vector3(parts.chimneyTop.x * V, parts.chimneyTop.y * V, parts.chimneyTop.z * V));
    this.group.add(this.smoke.mesh);
  }

  get stage() {
    return this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
  }

  /** Overall progress 0..1, weighted by each stage's work time. */
  get progress() {
    const total = this.stages.reduce((s, st) => s + st.seconds, 0);
    let done = 0;
    for (let i = 0; i < this.stageIndex && i < this.stages.length; i++) done += this.stages[i].seconds;
    if (this.phase === 'building') done += this.stage.seconds * this.stageT;
    return this.phase === 'done' ? 1 : done / total;
  }

  start() {
    if (this.phase !== 'plot') return;
    this.phase = 'building';
    this.plot.visible = false;
    this.reveal(this.stages[0], 0);
  }

  /** Jumps straight to a saved state: earlier stages finished, the current one partly built. */
  restore(phase: CabinPhase, stageIndex: number, stageT: number) {
    if (phase === 'plot') return;
    this.phase = phase;
    this.plot.visible = false;
    const upTo = phase === 'done' ? this.stages.length : Math.min(stageIndex, this.stages.length);
    for (let i = 0; i < upTo; i++) this.finish(this.stages[i]);
    this.stageIndex = upTo;
    this.stageT = phase === 'building' ? Math.max(0, Math.min(0.999, stageT)) : 0;
    if (phase === 'building') this.reveal(this.stage, this.stageT);
  }

  /** Clip a stage so only voxel layers up to `t` (0..1) of its height show. */
  private reveal(stage: Stage, t: number) {
    const layers = Math.round((stage.maxY - stage.minY) / V);
    const shown = Math.ceil(t * layers);
    stage.plane.constant = this.group.position.y + stage.minY + shown * V + 1e-4;
    for (const m of stage.meshes) m.visible = shown > 0;
  }

  private finish(stage: Stage) {
    for (const m of stage.meshes) {
      m.visible = true;
      (m.material as THREE.Material).clippingPlanes = null;
      (m.material as THREE.Material).needsUpdate = true;
    }
  }

  /** `working`: the player is on site, so work moves forward at `speed` (hammer level). */
  update(dt: number, time: number, nightFactor: number, working: boolean, speed = 1) {
    if (this.phase === 'building' && working) {
      const stage = this.stage;
      this.stageT += (dt * speed) / stage.seconds;
      if (this.stageT >= 1) {
        this.finish(stage);
        this.stageIndex++;
        this.stageT = 0;
        if (this.stageIndex >= this.stages.length) this.phase = 'done';
        else this.reveal(this.stage, 0);
      } else this.reveal(stage, this.stageT);
    }

    for (const m of this.glowMaterials) m.color.copy(this.dayGlass).lerp(this.nightGlass, nightFactor);
    this.porchLight.intensity = this.phase === 'done' ? nightFactor * 6 : 0;
    this.smoke.update(dt, time, this.phase === 'done', nightFactor);
  }
}

/** Voxel smoke puffs drifting up from the chimney once the cabin is finished. */
class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private readonly count = 28;
  private readonly age: Float32Array;
  private readonly seed: Float32Array;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(private readonly origin: THREE.Vector3) {
    this.material = new THREE.MeshBasicMaterial({ color: 0xd9d6d0, transparent: true, depthWrite: false });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    geo.setAttribute('aAlpha', this.alpha);
    this.mesh = new THREE.InstancedMesh(geo, this.material, this.count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.age = new Float32Array(this.count);
    this.seed = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.age[i] = i / this.count;
      this.seed[i] = Math.random();
    }
  }

  update(dt: number, time: number, on: boolean, nightFactor: number) {
    this.mesh.visible = on;
    if (!on) return;
    this.material.color.setHex(0xd9d6d0).lerp(new THREE.Color(0x6d7389), nightFactor * 0.6);
    const life = 6;
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt / life;
      if (this.age[i] >= 1) {
        this.age[i] -= 1;
        this.seed[i] = Math.random();
      }
      const a = this.age[i];
      const drift = Math.sin(time * 0.4 + this.seed[i] * 6) * 0.15;
      // Snap to the 1/16 grid so puffs read as voxels.
      const snap = (v: number) => Math.round(v * 16) / 16;
      this.p.set(
        snap(this.origin.x + a * 1.4 + drift),
        snap(this.origin.y + a * 3.2),
        snap(this.origin.z + (this.seed[i] - 0.5) * 0.3 - a * 0.4),
      );
      const size = snap(0.18 + a * 0.45 + this.seed[i] * 0.08);
      this.s.set(size, size, size);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.alpha.setX(i, Math.min(1, a * 6) * (1 - a) * 0.75);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}
