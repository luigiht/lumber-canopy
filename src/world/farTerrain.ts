import * as THREE from 'three';
import { PALETTE as P } from '@/voxel/palette';
import { patchToonShadows, toonMaterial } from '@/engine/toon';
import { valueNoise2 } from '@/voxel/rng';
import { roadOffset, type RoadConfig } from '@/config/world';
import { landHeight, type Terrain } from './terrain';

/** Surface kinds; the shader picks palette and texture per kind, like the detailed terrain does. */
const enum Kind {
  GrassTop = 0,
  RockTop = 1,
  Water = 2,
  BankTop = 3,
  GrassLip = 4,
  Soil = 5,
  RockSide = 6,
  RoadTop = 7,
}

const enum FarMat {
  Grass,
  Rock,
  Water,
  Bank,
  Road,
}

const SHADE = { top: 1, px: 0.9, nx: 0.8, pz: 0.84, nz: 0.76 };
/** Texture cells per tile; matches the detailed terrain's 1/8-tile voxels. */
const TEX = 8;

// Palette order must match the shader below.
const PAL = [
  P.grassDark, P.grass, P.grassLight, // 0-2
  P.moss, P.mossDark, P.stone, P.stoneLight, P.stoneDark, // 3-7
  P.waterDeep, P.water, P.waterLight, // 8-10
  P.dirtDark, P.dirt, P.soil, P.soilDark, // 11-14
  P.gravel, P.asphalt, P.asphaltDark, P.roadLine, // 15-18
];

/**
 * Heightmap ring around the detailed terrain. Geometry is coarse (1/4-tile columns, heights in
 * 1/8 steps, flat runs merged), but the shader paints a 1/8-tile voxel texture with the same
 * palette rules as the playable terrain, so the surroundings match it without the triangle cost.
 * The square covered by the detailed terrain is left empty.
 */
export class FarTerrain {
  readonly res: number;
  readonly n: number;
  readonly half: number;
  readonly inner: number;
  readonly bottom: number;
  readonly height: Float32Array;
  readonly mat: Uint8Array;

  constructor(private readonly terrain: Terrain) {
    const cfg = terrain.cfg;
    this.res = cfg.farRes;
    this.half = cfg.farSize / 2;
    this.inner = cfg.size / 2;
    this.n = cfg.farSize * this.res;
    this.bottom = -cfg.slabDepth;
    this.height = new Float32Array(this.n * this.n);
    this.mat = new Uint8Array(this.n * this.n);
    this.layout();
  }

  private colToWorld(i: number) {
    return -this.half + (i + 0.5) / this.res;
  }

  private isHole(i: number, k: number) {
    return Math.abs(this.colToWorld(i)) < this.inner && Math.abs(this.colToWorld(k)) < this.inner;
  }

  private layout() {
    const t = this.terrain;
    const { stream, ledge, seed } = t.cfg;
    const q = (v: number) => Math.round(v * TEX) / TEX;
    for (let k = 0; k < this.n; k++)
      for (let i = 0; i < this.n; i++) {
        const c = i + k * this.n;
        const x = this.colToWorld(i);
        const z = this.colToWorld(k);
        const sd = t.distToStream(x, z);
        const level = t.waterLevelAt(z);
        if (sd < stream.halfWidth) {
          this.mat[c] = FarMat.Water;
          this.height[c] = level;
          continue;
        }
        const land = q(landHeight(t.cfg, x, z, sd));
        const ledgeNoise = (valueNoise2(x * 0.7, z * 0.7, seed + 2) - 0.5) * ledge.noise;
        if (z < ledge.zBelow && sd < stream.halfWidth + ledge.reach + ledgeNoise) {
          // Half-tile rock blocks, like the ledge in the play area.
          const bi = Math.floor(x * 2);
          const bk = Math.floor(z * 2);
          const step = Math.floor(valueNoise2(bi * 0.9, bk * 0.9, seed + 4) * 3) * 0.5;
          this.mat[c] = FarMat.Rock;
          this.height[c] = Math.max(land, level + 0.5 + step);
          continue;
        }
        // Columns touching the road; the shader paints the exact road edge inside them.
        const road = roadOffset(x, z, t.cfg.road) < t.cfg.road.halfWidth + 0.2;
        this.mat[c] = road ? FarMat.Road : sd < stream.halfWidth + 0.35 ? FarMat.Bank : FarMat.Grass;
        this.height[c] = land;
      }
  }

  /** Ground height in world units (tiles) at (x,z), or 0 outside the ring. */
  heightAt(x: number, z: number) {
    const i = Math.floor((x + this.half) * this.res);
    const k = Math.floor((z + this.half) * this.res);
    if (i < 0 || k < 0 || i >= this.n || k >= this.n) return 0;
    return this.height[i + k * this.n];
  }

  isOpenGround(x: number, z: number) {
    const i = Math.floor((x + this.half) * this.res);
    const k = Math.floor((z + this.half) * this.res);
    if (i < 0 || k < 0 || i >= this.n || k >= this.n) return false;
    return this.mat[i + k * this.n] === FarMat.Grass;
  }

  buildMesh(): THREE.Mesh {
    const pos: number[] = [];
    const nrm: number[] = [];
    const shade: number[] = [];
    const kind: number[] = [];
    const idx: number[] = [];
    const s = 1 / this.res;

    const quad = (corners: number[][], normal: number[], sh: number, kd: Kind) => {
      const base = pos.length / 3;
      for (const p of corners) {
        pos.push(p[0], p[1], p[2]);
        nrm.push(normal[0], normal[1], normal[2]);
        shade.push(sh, sh, sh);
        kind.push(kd);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const topKind = (m: FarMat) =>
      m === FarMat.Rock ? Kind.RockTop : m === FarMat.Water ? Kind.Water : m === FarMat.Bank ? Kind.BankTop : m === FarMat.Road ? Kind.RoadTop : Kind.GrassTop;
    // Height of a neighbour; holes and the outer edge drop to the bottom so walls get drawn.
    const nh = (i: number, k: number) => {
      if (i < 0 || k < 0 || i >= this.n || k >= this.n || this.isHole(i, k)) return this.bottom;
      return this.height[i + k * this.n];
    };

    for (let k = 0; k < this.n; k++) {
      // Tops: merge runs of equal height and kind along x; the shader supplies the texture.
      for (let i = 0; i < this.n; ) {
        if (this.isHole(i, k)) {
          i++;
          continue;
        }
        const c = i + k * this.n;
        const h = this.height[c];
        const m = this.mat[c];
        let j = i + 1;
        while (j < this.n && !this.isHole(j, k) && this.height[j + k * this.n] === h && this.mat[j + k * this.n] === m) j++;
        const x0 = -this.half + i * s;
        const x1 = -this.half + j * s;
        const z0 = -this.half + k * s;
        const z1 = z0 + s;
        quad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], [0, 1, 0], SHADE.top, topKind(m));
        i = j;
      }

      // Walls wherever a neighbour is lower.
      for (let i = 0; i < this.n; i++) {
        if (this.isHole(i, k)) continue;
        const c = i + k * this.n;
        const h = this.height[c];
        const mat = this.mat[c] as FarMat;
        const x0 = -this.half + i * s;
        const z0 = -this.half + k * s;
        const x1 = x0 + s;
        const z1 = z0 + s;
        const wall = (lo: number, a: number[], b: number[], n: number[], sh: number) => {
          if (h <= lo) return;
          const face = (y0: number, y1: number, kd: Kind) =>
            quad([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], n, sh, kd);
          if (mat === FarMat.Rock) return face(lo, h, Kind.RockSide);
          if (mat === FarMat.Water) return face(lo, h, Kind.Water);
          // Grass on top, a darker lip, then soil — as on the detailed terrain's edges.
          const grassTo = Math.max(lo, h - 1 / TEX);
          const lipTo = Math.max(lo, h - 2 / TEX);
          face(grassTo, h, mat === FarMat.Bank ? Kind.BankTop : Kind.GrassTop);
          if (grassTo > lo) face(lipTo, grassTo, Kind.GrassLip);
          if (lipTo > lo) face(lo, lipTo, Kind.Soil);
        };
        wall(nh(i + 1, k), [x1, z1], [x1, z0], [1, 0, 0], SHADE.px);
        wall(nh(i - 1, k), [x0, z0], [x0, z1], [-1, 0, 0], SHADE.nx);
        wall(nh(i, k + 1), [x0, z1], [x1, z1], [0, 0, 1], SHADE.pz);
        wall(nh(i, k - 1), [x1, z0], [x0, z0], [0, 0, -1], SHADE.nz);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
    geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, texturedMaterial(this.terrain.cfg.road));
    mesh.receiveShadow = true;
    mesh.name = 'far-terrain';
    return mesh;
  }
}

/** Lambert material that paints the detailed terrain's voxel texture procedurally. */
function texturedMaterial(road: RoadConfig) {
  const material = toonMaterial();
  const pal = PAL.map((hex) => new THREE.Color(hex));
  const [w1, w2] = road.waves;
  material.onBeforeCompile = (shader) => {
    patchToonShadows(shader);
    shader.uniforms.uPal = { value: pal };
    // Same centre line as roadCenterX() in config/world.ts (two sine waves).
    shader.uniforms.uRoad = { value: new THREE.Vector2(road.base, road.halfWidth) };
    shader.uniforms.uRoadW1 = { value: new THREE.Vector3(...w1) };
    shader.uniforms.uRoadW2 = { value: new THREE.Vector3(...w2) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nvarying float vKind;\nvarying vec3 vTexPos;\nvarying vec3 vTexNrm;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvKind = aKind;\nvTexPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTexNrm = normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uPal[${PAL.length}];
uniform vec2 uRoad;
uniform vec3 uRoadW1, uRoadW2;
varying float vKind;
varying vec3 vTexPos;
varying vec3 vTexNrm;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = tHash(i), b = tHash(i + vec2(1.0, 0.0)), c = tHash(i + vec2(0.0, 1.0)), d = tHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 an = abs(vTexNrm);
  bool top = an.y > 0.5;
  // Nudge into the surface so cells on face boundaries resolve consistently.
  vec3 p = vTexPos - vTexNrm * 0.01;
  vec2 uv = top ? p.xz : (an.x > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y));
  vec2 cell = floor(uv * ${TEX}.0);
  float h = tHash(cell + vec2(floor(p.y * ${TEX}.0) * 7.0, 0.0));
  int k = int(vKind + 0.5);
  vec3 col;
  // Calm painted regions, matching the detailed terrain: low-frequency noise, tiny jitter.
  float j = (h - 0.5) * 0.06;
  vec2 wp = cell / ${TEX}.0;
  float roadOff = 1e3;
  if (k == 7) {
    vec2 rc = (cell + 0.5) / ${TEX}.0;
    float cx = uRoad.x + uRoadW1.x * sin(uRoadW1.y * rc.y + uRoadW1.z) + uRoadW2.x * sin(uRoadW2.y * rc.y + uRoadW2.z);
    float sl = uRoadW1.x * uRoadW1.y * cos(uRoadW1.y * rc.y + uRoadW1.z) + uRoadW2.x * uRoadW2.y * cos(uRoadW2.y * rc.y + uRoadW2.z);
    roadOff = abs(rc.x - cx) / sqrt(1.0 + sl * sl);
    // Outside the road edge the column is ordinary grass.
    if (roadOff >= uRoad.y) k = 0;
  }
  if (k == 7) {
    if (roadOff > uRoad.y - 0.14) col = h < 0.5 ? uPal[15] : uPal[7];
    else if (roadOff < 0.07 && mod(wp.y, 1.5) < 0.75) col = uPal[18];
    else col = tNoise(wp * 1.1) + j < 0.45 ? uPal[17] : uPal[16];
  } else if (k == 0) {
    float t = tNoise(wp * 0.45) + j;
    col = t < 0.36 ? uPal[0] : (t < 0.66 ? uPal[1] : uPal[2]);
  } else if (k == 1) {
    float tone = tHash(floor(wp * 2.0));
    col = tNoise(wp * 1.4) + j > 0.45 ? uPal[3] : (tone < 0.4 ? uPal[6] : uPal[5]);
  } else if (k == 2) {
    col = tNoise(wp * 0.8) < 0.35 ? uPal[8] : uPal[9];
  } else if (k == 3) {
    col = tNoise(wp * 1.2) + j < 0.5 ? uPal[11] : uPal[5];
  } else if (k == 4) {
    col = uPal[0];
  } else if (k == 5) {
    col = uPal[13];
  } else {
    float tone = tHash(floor(vec2(uv.x * 2.0, uv.y * 2.0)));
    col = tone < 0.33 ? uPal[6] : (tone < 0.75 ? uPal[5] : uPal[7]);
  }
  diffuseColor.rgb *= col;
}`,
      );
  };
  return material;
}
