import * as THREE from 'three';
import { WORLD, pathDist, roadOffset, type WorldConfig } from '@/config/world';
import { FIELD } from '@/config/field';
import { PALETTE as P } from '@/voxel/palette';
import { VoxelGrid } from '@/voxel/VoxelModel';
import { greedyMesh } from '@/voxel/greedyMesh';
import { hash3, valueNoise2 } from '@/voxel/rng';

export const enum Mat {
  Grass = 0,
  Dirt = 1,
  Bed = 2,
  Rock = 3,
  Bank = 4,
  Road = 5,
}

const ROCK_BLOCK = 4; // rock cubes are 4 terrain voxels (half a tile) on a side
const CHUNK = 64; // terrain columns per mesh chunk

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Catmull-Rom smoothing of the stream's control points so bends read as curves, not kinks.
 * Points must increase in z; the smoothed path keeps that order.
 */
function smoothPath(points: [number, number][], steps = 4): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const pt: [number, number] = [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
      if (!out.length || pt[1] > out[out.length - 1][1]) out.push(pt);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Natural ground height (tiles) outside the stream and rock ledge, shared by the detailed and far
 * terrain so they meet without a seam. Flat inside the play area; beyond it the land swells into
 * forested hills that rise behind the clearing, with a flat valley kept along the stream.
 */
/** Distance from (x,z) to the edge of the road or the bridge path (negative inside). */
export function roadDist(cfg: WorldConfig, x: number, z: number) {
  const { road } = cfg;
  return Math.min(roadOffset(x, z, road) - road.halfWidth, pathDist(x, z, road) - road.pathHalfWidth);
}

export function landHeight(cfg: WorldConfig, x: number, z: number, streamDist: number) {
  const { hills, playSize, stream } = cfg;
  const edge = Math.max(Math.abs(x), Math.abs(z)) - playSize / 2;
  if (edge <= 0.5) return 0;
  const back = -(x + z) / Math.SQRT2;
  const r = Math.hypot(x, z);
  let h = Math.max(0, back - hills.start) * hills.slope + Math.max(0, r - 28) * 0.12;
  h += (valueNoise2(x * 0.18, z * 0.18, cfg.seed + 21) - 0.3) * hills.noise * clamp01((edge - 0.5) / 6);
  h *= clamp01((streamDist - stream.halfWidth - 1) / hills.valley);
  // The road and its path stay flat, easing back into the land over a couple of tiles.
  h *= clamp01((roadDist(cfg, x, z) - 0.4) / 2.5);
  return Math.max(0, h);
}

/**
 * Column-based terrain slab. Terrain voxels are 1/res tiles. Column (i,k) covers
 * world x ∈ [-size/2 + i/res, ...). Ground level (world y = 0) is `ground` voxels above the slab bottom.
 */
export class Terrain {
  readonly cfg: WorldConfig;
  readonly res: number;
  readonly cols: number;
  readonly ground: number;
  readonly voxel: number;
  readonly height: Int16Array; // filled voxel count per column (top, exclusive)
  readonly mat: Uint8Array;
  readonly waterTop: Int16Array; // 0 = no water
  readonly streamDist: Float32Array; // distance to stream centreline in tiles
  readonly clearingE: Float32Array; // <1 inside the clearing
  readonly grid: VoxelGrid;
  readonly water: VoxelGrid;
  /** Smoothed stream centreline. */
  readonly path: [number, number][];

  constructor(cfg: WorldConfig = WORLD) {
    this.cfg = cfg;
    this.path = smoothPath(cfg.stream.points);
    this.res = cfg.terrainRes;
    this.cols = cfg.size * this.res;
    this.voxel = 1 / this.res;
    this.ground = Math.round(cfg.slabDepth * this.res);
    const n = this.cols * this.cols;
    this.height = new Int16Array(n);
    this.mat = new Uint8Array(n);
    this.waterTop = new Int16Array(n);
    this.streamDist = new Float32Array(n);
    this.clearingE = new Float32Array(n);

    this.layout();
    let maxH = 0;
    for (let c = 0; c < n; c++) maxH = Math.max(maxH, this.height[c], this.waterTop[c]);
    maxH += 1;
    this.grid = new VoxelGrid(this.cols, maxH, this.cols);
    this.water = new VoxelGrid(this.cols, maxH, this.cols);
    this.fill();
  }

  // ---- coordinate helpers -------------------------------------------------

  colToWorld(i: number) {
    return -this.cfg.size / 2 + (i + 0.5) / this.res;
  }
  worldToCol(x: number) {
    return Math.floor((x + this.cfg.size / 2) * this.res);
  }
  idx(i: number, k: number) {
    return i + k * this.cols;
  }
  /** Column at world (x,z) or -1 if off the map. */
  colAt(x: number, z: number) {
    const i = this.worldToCol(x);
    const k = this.worldToCol(z);
    if (i < 0 || k < 0 || i >= this.cols || k >= this.cols) return -1;
    return this.idx(i, k);
  }
  /** World y of the solid top surface at (x,z). */
  heightAt(x: number, z: number) {
    const c = this.colAt(x, z);
    return c < 0 ? 0 : (this.height[c] - this.ground) * this.voxel;
  }
  /** World y of the water surface at (x,z), or the ground if there's no water there. */
  waterHeightAt(x: number, z: number) {
    const c = this.colAt(x, z);
    if (c < 0 || !this.waterTop[c]) return this.heightAt(x, z);
    return (this.waterTop[c] - this.ground) * this.voxel;
  }
  matAt(x: number, z: number): Mat {
    const c = this.colAt(x, z);
    return c < 0 ? Mat.Grass : (this.mat[c] as Mat);
  }
  streamDistAt(x: number, z: number) {
    const c = this.colAt(x, z);
    return c < 0 ? Infinity : this.streamDist[c];
  }
  clearingAt(x: number, z: number) {
    const c = this.colAt(x, z);
    return c < 0 ? Infinity : this.clearingE[c];
  }

  waterLevelAt(z: number) {
    for (const s of this.cfg.stream.steps) if (z < s.zBelow) return s.level;
    return this.cfg.stream.steps[this.cfg.stream.steps.length - 1].level;
  }

  /** Stream centreline x at a given z (stream is monotonic in z). */
  streamXAt(z: number) {
    const pts = this.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      if (z >= z0 && z <= z1) return x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
    }
    return pts[pts.length - 1][0];
  }

  // ---- generation ---------------------------------------------------------

  distToStream(x: number, z: number) {
    const pts = this.path;
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      // The path runs monotonically in z, so segments far away in z can be skipped cheaply.
      if (z < az - best || z > bz + best) continue;
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const dx = x - (ax + vx * t);
      const dz = z - (az + vz * t);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }

  private layout() {
    const { cfg, res, ground } = this;
    const { stream, clearing, ledge, seed } = cfg;
    const toVox = (tiles: number) => Math.round(tiles * res);

    for (let k = 0; k < this.cols; k++) {
      for (let i = 0; i < this.cols; i++) {
        const c = this.idx(i, k);
        const x = this.colToWorld(i);
        const z = this.colToWorld(k);

        // Stream wobble keeps banks from looking ruled.
        const wob = (valueNoise2(x * 1.3, z * 1.3, seed) - 0.5) * 0.35;
        const sd = this.distToStream(x, z) + wob;
        this.streamDist[c] = sd;

        const cn = (valueNoise2(x * 0.45, z * 0.45, seed + 1) - 0.5) * clearing.noise;
        const e = ((x - clearing.x) / clearing.rx) ** 2 + ((z - clearing.z) / clearing.rz) ** 2 + cn;
        this.clearingE[c] = e;

        const level = this.waterLevelAt(z);
        const inStream = sd < stream.halfWidth;

        // Rock ledge around the upper stream.
        const ledgeNoise = (valueNoise2(x * 0.7, z * 0.7, seed + 2) - 0.5) * ledge.noise;
        const inLedge = z < ledge.zBelow && sd < stream.halfWidth + ledge.reach + ledgeNoise;

        if (inStream) {
          this.mat[c] = Mat.Bed;
          // Water surface at this step's level; bed a couple of voxels below.
          const wt = ground + toVox(level);
          this.waterTop[c] = wt;
          this.height[c] = wt - toVox(stream.bedDepth - stream.surfaceDrop);
          // Waterfall sheet: the first few columns below a step carry the upper level down.
          for (let s = 0; s < stream.steps.length - 1; s++) {
            const step = stream.steps[s];
            if (z >= step.zBelow && z < step.zBelow + 0.25) this.waterTop[c] = ground + toVox(step.level);
          }
        } else if (inLedge) {
          this.mat[c] = Mat.Rock;
          const bi = Math.floor(i / ROCK_BLOCK);
          const bk = Math.floor(k / ROCK_BLOCK);
          const stepTop = ground + toVox(level);
          const base = ground + ROCK_BLOCK * Math.ceil((stepTop - ground + 1) / ROCK_BLOCK);
          const extra = ROCK_BLOCK * Math.floor(hash3(bi, seed, bk) * 2.2);
          // Lower toward the outside of the ledge so it reads as a slope of stacked blocks.
          const outer = sd > stream.halfWidth + ledge.reach * 0.75 ? -ROCK_BLOCK : 0;
          this.height[c] = Math.max(ground + toVox(landHeight(cfg, x, z, sd)), base + extra + outer);
        } else {
          this.height[c] = ground + toVox(landHeight(cfg, x, z, sd));
          const bankW = 0.28 + hash3(i, 3, k) * 0.12;
          const onRoad = roadOffset(x, z, cfg.road) < cfg.road.halfWidth;
          // Footpaths are the same brown dirt as the cabin clearing, with a slightly ragged edge.
          const pd = pathDist(x, z, cfg.road) - cfg.road.pathHalfWidth;
          if (sd < stream.halfWidth + bankW) this.mat[c] = Mat.Bank;
          else if (onRoad) this.mat[c] = Mat.Road;
          else if (pd + (valueNoise2(x * 2.1, z * 2.1, seed + 9) - 0.5) * 0.3 < 0) this.mat[c] = Mat.Dirt;
          // The garden field's patch is bare ground, like around the cabin.
          else if (this.isFieldDirt(i, k)) this.mat[c] = Mat.Dirt;
          else if (this.isDirt(i, k, e)) this.mat[c] = Mat.Dirt;
          else this.mat[c] = Mat.Grass;
        }
      }
    }
  }

  /**
   * The garden field's bare patch: solid inside the fence, then loose pixels of soil scattered past
   * it that thin out over most of a tile, so its edge isn't a straight line.
   */
  private isFieldDirt(i: number, k: number) {
    const x = this.colToWorld(i);
    const z = this.colToWorld(k);
    const out = Math.max(Math.abs(x - FIELD.x) - FIELD.halfX, Math.abs(z - FIELD.z) - FIELD.halfZ);
    if (out < 0) return true;
    const reach = 0.85;
    // A wobbly band of bare ground first, then single pixels that get rarer with distance.
    const edge = out + (valueNoise2(x * 3.1, z * 3.1, this.cfg.seed + 17) - 0.5) * 0.45;
    if (edge < 0.18) return true;
    return edge < reach && hash3(i, 23, k) < 0.8 * (1 - edge / reach) ** 1.3;
  }

  private isDirt(i: number, k: number, e: number) {
    if (e > 1.08) return false;
    const x = this.colToWorld(i);
    const z = this.colToWorld(k);
    // Grass patches poking through the dirt, as in the reference.
    const patch = valueNoise2(x * 0.9, z * 0.9, this.cfg.seed + 5);
    if (patch > 0.86 - (1 - Math.min(1, e)) * 0.06) return false;
    if (e > 0.88) return hash3(i, 7, k) < (1.08 - e) / 0.2;
    return true;
  }

  /**
   * Painted-style ground colour: large, calm colour regions from low-frequency noise (like flat
   * illustration fills) instead of per-voxel speckle.
   */
  private columnColor(i: number, y: number, k: number, top: number, mat: Mat): number {
    const depth = top - 1 - y;
    const x = this.colToWorld(i);
    const z = this.colToWorld(k);
    // Very small jitter only softens the borders between regions.
    const j = (hash3(i, y, k) - 0.5) * 0.06;

    if (mat === Mat.Rock && y >= this.ground - 1) {
      // Each half-tile block is one flat tone; moss caps the tops in soft patches.
      const bi = Math.floor(i / ROCK_BLOCK);
      const by = Math.floor(y / ROCK_BLOCK);
      const bk = Math.floor(k / ROCK_BLOCK);
      const tone = hash3(bi, by, bk);
      const base = tone < 0.33 ? P.stoneLight : tone < 0.75 ? P.stone : P.stoneDark;
      if (depth <= 1) {
        const moss = valueNoise2(x * 1.4, z * 1.4, 31) + j;
        if (moss > 0.45) return depth === 0 ? P.moss : P.mossDark;
      }
      return base;
    }

    if (depth === 0) {
      switch (mat) {
        case Mat.Dirt: {
          const n = valueNoise2(x * 0.7, z * 0.7, 11) + j;
          return n < 0.3 ? P.dirtDark : n < 0.72 ? P.dirt : P.dirtLight;
        }
        case Mat.Road: {
          // Worn asphalt with gravel shoulders and a faded dashed centre line.
          const off = roadOffset(x, z, this.cfg.road);
          if (off > this.cfg.road.halfWidth - 0.14) return hash3(i, 5, k) < 0.5 ? P.gravel : P.stoneDark;
          if (off < 0.07 && ((z % 1.5) + 1.5) % 1.5 < 0.75) return P.roadLine;
          return valueNoise2(x * 1.1, z * 1.1, 19) + j < 0.45 ? P.asphaltDark : P.asphalt;
        }
        case Mat.Bed:
          return valueNoise2(x * 1.5, z * 1.5, 13) + j < 0.5 ? P.gravel : P.dirtDark;
        case Mat.Bank:
          return valueNoise2(x * 1.2, z * 1.2, 17) + j < 0.5 ? P.dirtDark : P.stone;
        default: {
          const n = valueNoise2(x * 0.45, z * 0.45, 9) + j;
          return n < 0.36 ? P.grassDark : n < 0.66 ? P.grass : P.grassLight;
        }
      }
    }
    if (depth === 1 && mat === Mat.Grass) return P.grassDark;
    // Earth in clean strata on exposed walls.
    if (y < 3) return P.earthDeep;
    if (y < 6) return P.soilDark;
    return P.soil;
  }

  private fill() {
    for (let k = 0; k < this.cols; k++)
      for (let i = 0; i < this.cols; i++) {
        const c = this.idx(i, k);
        const top = this.height[c];
        const mat = this.mat[c] as Mat;
        for (let y = 0; y < top; y++) this.grid.set(i, y, k, this.columnColor(i, y, k, top, mat));
        const wt = this.waterTop[c];
        for (let y = top; y < wt; y++) {
          const z = this.colToWorld(k);
          // Foam where the falls land and along the edges of the falls.
          let col: number = P.water;
          for (const s of this.cfg.stream.steps.slice(0, -1)) {
            // Vertical streaks per column, like painted falling water.
            if (z >= s.zBelow && z < s.zBelow + 0.9) col = hash3(i, 0, k >> 1) < 0.55 ? P.foam : P.waterLight;
          }
          if (col === P.water) {
            const edge = this.streamDist[c] > this.cfg.stream.halfWidth - 0.2;
            col = edge ? P.waterLight : valueNoise2(this.colToWorld(i) * 0.8, z * 0.8, 23) < 0.35 ? P.waterDeep : P.water;
          }
          this.water.set(i, y, k, col);
        }
      }
  }

  // ---- meshing ------------------------------------------------------------

  private offset(): [number, number, number] {
    return [-this.cfg.size / 2, -this.ground * this.voxel, -this.cfg.size / 2];
  }

  /** Height (tiles) of whatever land lies beyond the detailed grid; set by the far terrain. */
  outsideHeight: (x: number, z: number) => number = () => 0;

  /**
   * Out-of-grid cells count as solid only below the neighbouring far land, so edge walls are
   * hidden where the land continues but still drawn where this terrain stands taller.
   */
  private outsideXZ(i: number, y: number, k: number) {
    if (i >= 0 && k >= 0 && i < this.cols && k < this.cols) return false;
    return (y - this.ground + 0.5) * this.voxel < this.outsideHeight(this.colToWorld(i), this.colToWorld(k));
  }

  buildTerrainMeshes(material: THREE.Material): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (let ck = 0; ck < this.cols; ck += CHUNK)
      for (let ci = 0; ci < this.cols; ci += CHUNK) {
        const geo = greedyMesh(this.grid, {
          min: [ci, 0, ck],
          max: [Math.min(ci + CHUNK, this.cols), this.grid.sy, Math.min(ck + CHUNK, this.cols)],
          voxelSize: this.voxel,
          offset: this.offset(),
          occludes: (x, y, z) => this.outsideXZ(x, y, z) || this.grid.get(x, y, z) !== 0,
          skipFaces: { ny: true },
        });
        const mesh = new THREE.Mesh(geo, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.name = `terrain-${ci}-${ck}`;
        meshes.push(mesh);
      }
    return meshes;
  }

  buildWaterGeometry(): THREE.BufferGeometry {
    return greedyMesh(this.water, {
      min: [0, 0, 0],
      max: [this.cols, this.water.sy, this.cols],
      voxelSize: this.voxel,
      offset: this.offset(),
      occludes: (x, y, z) => this.outsideXZ(x, y, z) || this.water.get(x, y, z) !== 0 || this.grid.get(x, y, z) !== 0,
      skipFaces: { ny: true },
      faceShade: { px: 0.95, nx: 0.95, pz: 0.95, nz: 0.95 },
    });
  }
}
