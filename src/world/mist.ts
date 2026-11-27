import * as THREE from 'three';
import type { WorldConfig } from '@/config/world';
import { makeRng, range, type Rng } from '@/voxel/rng';
import type { Terrain } from './terrain';

/** Mist sits this far above the highest ground under it: at the pines' crowns (they're 3.4–4.9 tall). */
const TREETOP_MIN = 3.7;
const TREETOP_MAX = 4.6;
/** Half-size of a bank's footprint (slab offset plus half its largest size), in tiles. */
const BANK_REACH = 6;
/** Banks keep this far from the river and its pools. */
const WATER_CLEARANCE = 2.5;
/** Valley clouds float this far above the highest ground or water under them. */
const VALLEY_MIN = 2.6;
const VALLEY_MAX = 4.0;
/** Cells per tile: one per tile is plenty for a 6-tile footprint. */
const FLOOR_RES = 1;

interface Slab {
  ox: number;
  oz: number;
  dy: number;
  sx: number;
  sy: number;
  sz: number;
}

interface Bank {
  slabs: Slab[];
  /** Index of this bank's first slab in the instanced mesh. */
  first: number;
  angle: number;
  radius: number;
  y: number;
  phase: number;
  speed: number;
  /** Mist density at which this bank appears, so banks arrive and leave one by one. */
  threshold: number;
  alpha: number;
  face: number;
  /** Set once fully gone, so the bank returns somewhere new. */
  relocate: boolean;
  /** Height above the ground under the bank (treetop level). */
  lift: number;
  /** 'sheet': flat mist resting on the treetops. 'valley': a boxy cloud over the river or hills. */
  kind: 'sheet' | 'valley';
}

const SNAP = 1 / 8;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How much mist hangs over the valley at a given hour: thick from late afternoon through the
 * morning, burning off before noon, completely gone over midday, rolling back in after.
 */
export function mistDensity(hour: number) {
  // Never fully clear: a lighter layer hangs in the valley even at midday.
  const MIDDAY = 0.55;
  if (hour >= 11 && hour < 14) return MIDDAY;
  if (hour >= 9 && hour < 11) return 1 - smooth(9, 11, hour) * (1 - MIDDAY);
  if (hour >= 14 && hour < 17) return MIDDAY + smooth(14, 17, hour) * (1 - MIDDAY);
  return 1;
}

/**
 * Low banks of blocky mist drifting around the clearing: each bank is a few stacked translucent
 * slabs tinted to the sky. Banks fade individually (per-instance alpha), so the mist can thin out,
 * vanish completely and return. Banks between the camera and the clearing fade away so the play
 * area stays clear from every angle.
 */
export class Mist {
  readonly mesh: THREE.InstancedMesh;
  /** Override the time-of-day density (0..1); null follows the clock. */
  densityOverride: number | null = null;
  private readonly banks: Bank[] = [];
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly rng: Rng;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly white = new THREE.Color(0xffffff);
  private readonly night = new THREE.Color(0x5a6a90);
  private first = true;

  /** Highest ground (or water) anywhere under a bank centred on each cell. */
  private readonly floor: Float32Array;
  /** 1 where a bank centred on the cell would reach over the river or a pool. */
  private readonly wet: Uint8Array;
  private readonly floorN: number;
  private readonly floorHalf: number;

  constructor(
    private readonly cfg: WorldConfig,
    private readonly terrain: Terrain,
  ) {
    // Build the "mist floor" once: heights and water over the whole world, then widened by a
    // bank's reach, so each bank needs only one lookup per frame wherever it drifts.
    this.floorHalf = cfg.farSize / 2;
    this.floorN = Math.ceil(cfg.farSize * FLOOR_RES);
    const n = this.floorN;
    const raw = new Float32Array(n * n);
    const rawWet = new Uint8Array(n * n);
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / FLOOR_RES - this.floorHalf;
        const z = (k + 0.5) / FLOOR_RES - this.floorHalf;
        const inDetail = terrain.colAt(x, z) >= 0;
        const ground = inDetail ? Math.max(terrain.heightAt(x, z), terrain.waterHeightAt(x, z)) : terrain.outsideHeight(x, z);
        raw[i + k * n] = ground;
        rawWet[i + k * n] = terrain.distToStream(x, z) < cfg.stream.halfWidth + WATER_CLEARANCE ? 1 : 0;
      }
    this.floor = new Float32Array(n * n);
    this.wet = new Uint8Array(n * n);
    const r = Math.ceil(BANK_REACH * FLOOR_RES);
    // Separable max filter: rows, then columns.
    const tmpF = new Float32Array(n * n);
    const tmpW = new Uint8Array(n * n);
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++) {
        let mf = -Infinity;
        let mw = 0;
        for (let d = -r; d <= r; d++) {
          const ii = Math.min(n - 1, Math.max(0, i + d));
          mf = Math.max(mf, raw[ii + k * n]);
          mw |= rawWet[ii + k * n];
        }
        tmpF[i + k * n] = mf;
        tmpW[i + k * n] = mw;
      }
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++) {
        let mf = -Infinity;
        let mw = 0;
        for (let d = -r; d <= r; d++) {
          const kk = Math.min(n - 1, Math.max(0, k + d));
          mf = Math.max(mf, tmpF[i + kk * n]);
          mw |= tmpW[i + kk * n];
        }
        this.floor[i + k * n] = mf;
        this.wet[i + k * n] = mw;
      }

    this.rng = makeRng(cfg.seed + 99);
    let total = 0;
    const sheets = cfg.mist.banks;
    const count = sheets + cfg.mist.valleyBanks;
    for (let i = 0; i < count; i++) {
      const kind = i < sheets ? 'sheet' : 'valley';
      const slabs = kind === 'sheet' ? this.sheetSlabs() : this.cloudSlabs();
      const bank: Bank = {
        slabs,
        first: total,
        angle: 0,
        radius: 0,
        y: 0,
        phase: this.rng() * Math.PI * 2,
        // Valley clouds drift slowly so they stay over the river or hills they formed on.
        speed: (kind === 'sheet' ? range(this.rng, 0.004, 0.012) : range(this.rng, 0.0012, 0.003)) * (this.rng() < 0.5 ? -1 : 1),
        threshold: kind === 'sheet' ? (i + this.rng()) / sheets : (i - sheets + this.rng()) / cfg.mist.valleyBanks,
        alpha: 0,
        face: 1,
        relocate: false,
        lift: 0,
        kind,
      };
      this.place(bank);
      this.banks.push(bank);
      total += slabs.length;
    }

    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, fog: false });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alpha);
    this.mesh = new THREE.InstancedMesh(geo, this.material, total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'mist';
  }

  /** Flat, wide sheets of mist. */
  private sheetSlabs(): Slab[] {
    const rng = this.rng;
    const n = 2 + Math.floor(rng() * 2);
    return Array.from({ length: n }, (_, j) => ({
      dy: j * 0.25,
      ox: range(rng, -2.5, 2.5),
      oz: range(rng, -2.5, 2.5),
      sx: snap(range(rng, 3, 7) * (1 - j * 0.3)),
      sy: snap(range(rng, 0.25, 0.5)),
      sz: snap(range(rng, 3, 7) * (1 - j * 0.3)),
    }));
  }

  /** A chunky voxel cumulus: a wide base block with smaller blocks heaped on top and around. */
  private cloudSlabs(): Slab[] {
    const rng = this.rng;
    const slabs: Slab[] = [
      { dy: 0, ox: 0, oz: 0, sx: snap(range(rng, 2.5, 4)), sy: snap(range(rng, 0.6, 0.9)), sz: snap(range(rng, 2.2, 3.5)) },
    ];
    const extra = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < extra; j++) {
      const top = j < 2;
      slabs.push({
        dy: snap(top ? range(rng, 0.45, 0.9) : range(rng, 0, 0.3)),
        ox: snap(range(rng, -1.6, 1.6)),
        oz: snap(range(rng, -1.4, 1.4)),
        sx: snap(range(rng, 1, 2.2)),
        sy: snap(range(rng, 0.6, 1.2)),
        sz: snap(range(rng, 1, 2)),
      });
    }
    return slabs;
  }

  /** Valley clouds: mostly along the river beyond the walkable area, the rest over the back hills. */
  private placeValley(b: Bank) {
    const { cfg, rng } = this;
    const minEdge = cfg.playSize / 2 + 2;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 40; tries++) {
      if (rng() < 0.65) {
        // Follow the river up past the waterfall and down into the forest.
        z = (rng() < 0.6 ? -1 : 1) * range(rng, minEdge, cfg.mist.far - 5);
        x = this.terrain.streamXAt(z) + range(rng, -2.5, 2.5);
      } else {
        // The hills rise behind the clearing (toward -x, -z).
        const a = (5 * Math.PI) / 4 + range(rng, -0.7, 0.7);
        const r = range(rng, cfg.mist.bankNear + 2, cfg.mist.far - 4);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }
      if (Math.max(Math.abs(x), Math.abs(z)) >= minEdge && Math.hypot(x, z) < cfg.mist.far - 3) break;
    }
    b.angle = Math.atan2(z, x);
    b.radius = Math.hypot(x, z);
    b.lift = range(rng, VALLEY_MIN, VALLEY_MAX);
    b.y = this.floor[this.floorCell(x, z)] + b.lift;
  }

  private floorCell(x: number, z: number) {
    const n = this.floorN;
    const i = Math.min(n - 1, Math.max(0, Math.floor((x + this.floorHalf) * FLOOR_RES)));
    const k = Math.min(n - 1, Math.max(0, Math.floor((z + this.floorHalf) * FLOOR_RES)));
    return i + k * n;
  }

  /** Puts a bank somewhere around the clearing, resting on the treetops, away from the river. */
  private place(b: Bank) {
    if (b.kind === 'valley') return this.placeValley(b);
    const { cfg, rng } = this;
    // Keep bank centres clear of the play square so slabs only fringe its edges.
    const minEdge = cfg.playSize / 2 + 2.5;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 40; tries++) {
      b.angle = rng() * Math.PI * 2;
      b.radius = range(rng, cfg.mist.bankNear, cfg.mist.far - 4);
      x = Math.cos(b.angle) * b.radius;
      z = Math.sin(b.angle) * b.radius;
      if (Math.max(Math.abs(x), Math.abs(z)) >= minEdge && !this.wet[this.floorCell(x, z)]) break;
    }
    // Resting on the treetops: the highest ground under the whole bank, plus a pine's height.
    b.lift = range(rng, TREETOP_MIN, TREETOP_MAX);
    b.y = this.floor[this.floorCell(x, z)] + b.lift;
  }

  /** `camYaw` is the camera's yaw around the clearing (camera sits at sin/cos of it). */
  update(dt: number, time: number, hour: number, sky: THREE.Color, nightFactor: number, camYaw: number) {
    // A touch brighter than the sky by day, a cool faint blue at night.
    this.material.color.copy(sky).lerp(this.white, 0.6 * (1 - nightFactor)).lerp(this.night, nightFactor * 0.35);
    this.material.opacity = 0.5 - nightFactor * 0.18;
    const density = this.densityOverride ?? mistDensity(hour);
    const cx = Math.sin(camYaw);
    const cz = Math.cos(camYaw);
    // Slow, soft fades; a bank takes several seconds to dissolve or form.
    // On the first frame banks start at their target, so mist is there from the moment the game loads.
    const ease = this.first ? 1 : 1 - Math.exp(-dt * 0.6);
    const faceEase = this.first ? 1 : 1 - Math.exp(-dt * 3);
    this.first = false;

    for (const b of this.banks) {
      b.angle += b.speed * dt;
      // Follow the ground under the bank as it drifts; fade out (and move) if it reaches the river.
      const cell = this.floorCell(Math.cos(b.angle) * b.radius, Math.sin(b.angle) * b.radius);
      b.y += (this.floor[cell] + b.lift - b.y) * (this.first ? 1 : 1 - Math.exp(-dt * 0.8));
      // Sheets stay off the river; valley clouds float well above it.
      const present = b.kind === 'sheet' && this.wet[cell] ? 0 : smooth(b.threshold - 0.06, b.threshold + 0.06, density);
      b.alpha += (present - b.alpha) * ease;
      if (b.alpha < 0.01 && present === 0) {
        b.alpha = 0;
        b.relocate = true;
      } else if (b.relocate && present > 0) {
        this.place(b);
        b.relocate = false;
      }
      const facing = Math.cos(b.angle) * cx + Math.sin(b.angle) * cz;
      const away = Math.max(0, Math.min(1, (0.15 - facing) / 0.45));
      b.face += (away - b.face) * faceEase;
      const a = b.alpha * b.face;
      const shown = a < 0.005 ? 0 : 1;

      const bx = Math.cos(b.angle) * b.radius;
      const bz = Math.sin(b.angle) * b.radius;
      // Forming banks settle gently downward.
      const by = b.y + (1 - b.alpha) * 0.4 + Math.sin(time * 0.25 + b.phase) * 0.15;
      b.slabs.forEach((sl, j) => {
        const i = b.first + j;
        this.p.set(snap(bx + sl.ox), snap(by + sl.dy), snap(bz + sl.oz));
        // Invisible slabs collapse so they cost no overdraw.
        this.s.set(sl.sx * shown, sl.sy * shown, sl.sz * shown);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
        this.alpha.setX(i, a);
      });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}
