import * as THREE from 'three';
import { WORLD, type Placement, type ScatterRule, type WorldConfig } from '@/config/world';
import { MODELS, type ModelDef, type ModelKey } from '@/voxel/models';
import { meshModel } from '@/voxel/greedyMesh';
import { hash3, makeRng, type Rng } from '@/voxel/rng';
import { Mat, roadDist, type Terrain } from './terrain';
import { ARRIVAL, DECOR_SLOTS, STATIONS } from '@/config/stations';
import type { FarTerrain } from './farTerrain';
import { CABIN } from '@/config/cabin';

/** One placed prop. Kept so later milestones can chop trees, mine rocks, etc. by id. */
export interface PropInstance {
  id: number;
  model: ModelKey;
  variant: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Index inside the variant's InstancedMesh. */
  slot: number;
}

/** Ground queries spanning the detailed terrain and the far ring. */
export class Ground {
  constructor(
    readonly terrain: Terrain,
    readonly far: FarTerrain,
  ) {}
  inDetail(x: number, z: number) {
    return this.terrain.colAt(x, z) >= 0;
  }
  heightAt(x: number, z: number) {
    return this.inDetail(x, z) ? this.terrain.heightAt(x, z) : this.far.heightAt(x, z);
  }
}

/**
 * Generates every model variant once, greedy-meshes it, and draws all placements of that
 * variant through a single InstancedMesh.
 */
export class Props {
  readonly group = new THREE.Group();
  readonly instances: PropInstance[] = [];
  readonly meshes = new Map<string, THREE.InstancedMesh>();

  constructor(ground: Ground, material: THREE.Material, cfg: WorldConfig = WORLD) {
    const terrain = ground.terrain;
    const rng = makeRng(cfg.seed);
    // Structures claim their footprint first; nothing else may overlap them.
    const keepOut = cfg.placements.filter((p) => (MODELS[p.model] as ModelDef).structure).map(footprint);
    // The cabin site is reserved too, so nothing grows through the floor once it's built.
    const k = CABIN.keepOut;
    keepOut.push({
      distance: (x: number, z: number) =>
        Math.hypot(Math.max(0, k.minX - x, x - k.maxX), Math.max(0, k.minZ - z, z - k.maxZ)),
    });
    // Stations, plant slots and the taxi drop-off get room to stand and walk around.
    const spots = [
      // Outdoor stations only (the bridge and cabin door are part of their structures).
      ...STATIONS.filter((s) => s.area !== 'inside' && s.kind !== 'fishing' && s.kind !== 'door').flatMap((s) => [
        { x: s.x, z: s.z, r: 1.0 },
        { x: s.spot[0], z: s.spot[1], r: 0.5 },
      ]),
      ...DECOR_SLOTS.filter((d) => !d.interior).map((d) => ({ x: d.x, z: d.z, r: 0.45 })),
      { x: ARRIVAL.spawn.x, z: ARRIVAL.spawn.z, r: 1.2 },
    ];
    for (const sp of spots) keepOut.push({ distance: (x: number, z: number) => Math.max(0, Math.hypot(x - sp.x, z - sp.z) - sp.r) });
    const clear = (p: Placement) => {
      const def = MODELS[p.model] as ModelDef;
      const reach = def.clearance;
      // Anything solid, or tall enough to hide the road, stays off the road and the bridge path.
      if ((def.collide || def.castShadow) && roadDist(cfg, p.x, p.z) < reach + 0.2) return false;
      return keepOut.every((r) => r.distance(p.x, p.z) >= reach + 0.15);
    };
    const placed: Placement[] = cfg.placements.filter((p) => {
      if ((MODELS[p.model] as ModelDef).structure || clear(p)) return true;
      console.warn(`[props] ${p.model} at (${p.x}, ${p.z}) overlaps a structure and was skipped`);
      return false;
    });
    const spaced = new SpacingGrid();
    for (const p of placed) spaced.add(p.x, p.z, (MODELS[p.model] as ModelDef).structure ? 0 : 1.1);
    for (const rule of cfg.scatter) placed.push(...scatter(rule, ground, rng, spaced, clear));

    // Assign variants and group by mesh.
    const byKey = new Map<string, PropInstance[]>();
    placed.forEach((p, id) => {
      const def: ModelDef = MODELS[p.model];
      const variant = p.variant ?? Math.floor(rng() * def.variants);
      const rot = p.rot ?? Math.floor(rng() * 4);
      const y = p.model === 'bridge' ? this.bridgeY(terrain, p) : ground.heightAt(p.x, p.z) + (p.lift ?? 0);
      const inst: PropInstance = { id, model: p.model, variant, x: p.x, y, z: p.z, rot, slot: 0 };
      const key = `${p.model}:${variant}`;
      const list = byKey.get(key) ?? [];
      inst.slot = list.length;
      list.push(inst);
      byKey.set(key, list);
      this.instances.push(inst);
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, list] of byKey) {
      const [model, v] = key.split(':') as [ModelKey, string];
      const def: ModelDef = MODELS[model];
      const geo = meshModel(def.factory(makeRng(cfg.seed * 977 + hashKey(model) * 31 + Number(v))), def.voxelSize);
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((inst, i) => {
        q.setFromAxisAngle(up, (inst.rot * Math.PI) / 2);
        m.compose(new THREE.Vector3(inst.x, inst.y, inst.z), q, one);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = def.castShadow;
      mesh.receiveShadow = true;
      mesh.name = key;
      this.meshes.set(key, mesh);
      this.group.add(mesh);
    }
  }

  /** The bridge rests on whichever bank is higher. */
  private bridgeY(terrain: Terrain, p: Placement) {
    return Math.max(terrain.heightAt(p.x - 1.5, p.z), terrain.heightAt(p.x + 1.5, p.z)) - 1 / 16 + (p.lift ?? 0);
  }
}

function hashKey(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Bucketed points for fast "is anything too close?" checks while scattering. */
class SpacingGrid {
  private readonly cells = new Map<number, { x: number; z: number; r: number }[]>();
  private readonly size = 2;
  private key(ci: number, ck: number) {
    return (ci + 512) * 4096 + (ck + 512);
  }
  add(x: number, z: number, r: number) {
    const k = this.key(Math.floor(x / this.size), Math.floor(z / this.size));
    const list = this.cells.get(k) ?? [];
    list.push({ x, z, r });
    this.cells.set(k, list);
  }
  /** True when a neighbour is closer than `limit(neighbour radius)`. */
  blocked(x: number, z: number, limit: (r: number) => number) {
    const ci = Math.floor(x / this.size);
    const ck = Math.floor(z / this.size);
    for (let dk = -1; dk <= 1; dk++)
      for (let di = -1; di <= 1; di++) {
        const list = this.cells.get(this.key(ci + di, ck + dk));
        if (list) for (const s of list) if (Math.hypot(s.x - x, s.z - z) < limit(s.r)) return true;
      }
    return false;
  }
}

/** Half-extent of the square a rule samples positions from. */
function sampleHalf(rule: ScatterRule, cfg: WorldConfig) {
  switch (rule.zone) {
    case 'outerForest':
    case 'outerMeadow':
      return cfg.size / 2 - 0.3;
    case 'farForest':
      return cfg.mist.far + 2;
    default:
      return cfg.playSize / 2 - 0.5;
  }
}

/** Trees in front of the clearing would hide it, so the front side stays sparse. */
function frontSparse(x: number, z: number, keep: number) {
  if (x + z < 4) return true;
  if (x + z > 24) return false;
  return hash3(Math.floor(x * 7), 17, Math.floor(z * 7)) < keep;
}

function inZone(rule: ScatterRule, g: Ground, x: number, z: number): boolean {
  const t = g.terrain;
  const cfg = t.cfg;
  const hw = cfg.stream.halfWidth;
  const playHalf = cfg.playSize / 2;
  const cheb = Math.max(Math.abs(x), Math.abs(z));

  if (rule.zone === 'farForest') {
    if (g.inDetail(x, z) || Math.hypot(x, z) > cfg.mist.far + 2) return false;
    return (
      g.far.isOpenGround(x, z) &&
      t.distToStream(x, z) > hw + 1.2 &&
      roadDist(cfg, x, z) > 1.1 &&
      frontSparse(x, z, 0.35)
    );
  }

  const mat = t.matAt(x, z);
  const sd = t.streamDistAt(x, z);
  const e = t.clearingAt(x, z);
  const nearEdge = cheb > playHalf - 2.2;
  switch (rule.zone) {
    case 'forestBack':
      return mat === Mat.Grass && e > 1.45 && sd > hw + 0.9 && (x + z < -6.5 || x - z < -15 || (x - z > 15 && z < -6));
    case 'forestEdges':
      return mat === Mat.Grass && e > 1.3 && sd > hw + 0.8 && nearEdge && !(x + z < -6.5);
    case 'clearingRim':
      return mat === Mat.Grass && e > 1.05 && e < 1.55 && sd > hw + 0.6;
    case 'streamBank':
      return (mat === Mat.Grass || mat === Mat.Bank) && sd > hw + 0.05 && sd < hw + 1.0 && t.heightAt(x, z) === 0;
    case 'anywhereGrass':
      return mat === Mat.Grass && sd > hw + 0.3;
    case 'outerForest':
      return cheb > playHalf + 0.6 && mat === Mat.Grass && sd > hw + 0.9 && frontSparse(x, z, 0.25);
    case 'outerMeadow':
      return cheb > playHalf + 0.3 && mat === Mat.Grass && sd > hw + 0.3;
  }
}

/** Axis-aligned footprint of a structure placement, from its voxel model's size and rotation. */
function footprint(p: Placement) {
  const def: ModelDef = MODELS[p.model];
  const g = def.factory(makeRng(0)).grid;
  const vs = def.voxelSize ?? 1 / 16;
  const quarter = ((p.rot ?? 0) % 2) !== 0;
  const hx = ((quarter ? g.sz : g.sx) * vs) / 2;
  const hz = ((quarter ? g.sx : g.sz) * vs) / 2;
  return {
    /** Distance from (x,z) to the footprint rectangle; 0 inside it. */
    distance(x: number, z: number) {
      const dx = Math.max(0, Math.abs(x - p.x) - hx);
      const dz = Math.max(0, Math.abs(z - p.z) - hz);
      return Math.hypot(dx, dz);
    },
  };
}

function scatter(rule: ScatterRule, g: Ground, rng: Rng, spaced: SpacingGrid, clear: (p: Placement) => boolean): Placement[] {
  const out: Placement[] = [];
  const half = sampleHalf(rule, g.terrain.cfg);
  let attempts = 0;
  while (out.length < rule.count && attempts++ < rule.count * 60) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    if (!inZone(rule, g, x, z) || !clear({ model: rule.model, x, z })) continue;
    if (rule.spacing > 0) {
      if (spaced.blocked(x, z, (r) => Math.max(rule.spacing, r))) continue;
      spaced.add(x, z, rule.spacing);
    } else if (spaced.blocked(x, z, (r) => r * 0.5)) continue;
    out.push({ model: rule.model, x, z });
  }
  return out;
}
