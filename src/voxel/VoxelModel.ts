import { hash3, type Rng } from './rng';

/**
 * Dense voxel grid. Each cell stores a 24-bit sRGB colour with bit 24 set as the "filled" flag,
 * so 0 means empty. Models are small (tens of voxels per side) so dense storage is fine.
 */
export const FILLED = 0x1000000;

export class VoxelGrid {
  readonly data: Uint32Array;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {
    this.data = new Uint32Array(sx * sy * sz);
  }

  inBounds(x: number, y: number, z: number) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  index(x: number, y: number, z: number) {
    return x + this.sx * (z + this.sz * y);
  }

  /** Returns the raw cell value (0 if empty or out of bounds). */
  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[this.index(x, y, z)];
  }

  set(x: number, y: number, z: number, color: number) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = (color & 0xffffff) | FILLED;
  }

  clear(x: number, y: number, z: number) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = 0;
  }

  filled(x: number, y: number, z: number) {
    return this.get(x, y, z) !== 0;
  }
}

/** Colour function: either a fixed colour or one computed per voxel. */
export type Paint = number | ((x: number, y: number, z: number) => number);

const resolve = (p: Paint, x: number, y: number, z: number) => (typeof p === 'number' ? p : p(x, y, z));

/**
 * A voxel model: a grid plus a pivot (in voxel units) that sits on the world anchor point.
 * By convention the pivot is the centre of the base footprint at y = 0.
 */
export class VoxelModel {
  readonly grid: VoxelGrid;

  constructor(
    sx: number,
    sy: number,
    sz: number,
    readonly pivot: { x: number; y: number; z: number } = { x: sx / 2, y: 0, z: sz / 2 },
  ) {
    this.grid = new VoxelGrid(sx, sy, sz);
  }

  set(x: number, y: number, z: number, paint: Paint) {
    this.grid.set(Math.round(x), Math.round(y), Math.round(z), resolve(paint, x, y, z));
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, paint: Paint) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.grid.set(x, y, z, resolve(paint, x, y, z));
  }

  /** Filled ellipsoid centred at (cx,cy,cz). `edge` lets callers roughen the surface. */
  ellipsoid(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    paint: Paint,
    edge: (x: number, y: number, z: number) => number = () => 0,
  ) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1 + edge(x, y, z)) this.grid.set(x, y, z, resolve(paint, x, y, z));
        }
  }

  /** Vertical cylinder (axis along Y). */
  cylinderY(cx: number, cz: number, r: number, y0: number, y1: number, paint: Paint) {
    for (let y = y0; y <= y1; y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x - cx;
          const dz = z - cz;
          if (dx * dx + dz * dz <= r * r) this.grid.set(x, y, z, resolve(paint, x, y, z));
        }
  }

  /** Horizontal cylinder with axis along X. */
  cylinderX(cy: number, cz: number, r: number, x0: number, x1: number, paint: Paint) {
    for (let x = x0; x <= x1; x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
          const dy = y - cy;
          const dz = z - cz;
          if (dy * dy + dz * dz <= r * r) this.grid.set(x, y, z, resolve(paint, x, y, z));
        }
  }
}

/**
 * Picks one of a few shades for a voxel by a stable hash, giving the dithered look of the references
 * while keeping the number of distinct colours small (so the greedy mesher can still merge faces).
 */
export function shades(colors: readonly number[], salt = 0) {
  return (x: number, y: number, z: number) => colors[Math.floor(hash3(x + salt * 131, y, z) * colors.length)];
}

/** Lighten (amt > 0) or darken (amt < 0) an sRGB hex colour by a fraction. */
export function tint(color: number, amt: number): number {
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return (f((color >> 16) & 255) << 16) | (f((color >> 8) & 255) << 8) | f(color & 255);
}

/** Pick a slightly tinted variant of a base colour from a small fixed set. */
export function jitter(base: number, amount = 0.05, steps = 3) {
  const variants = Array.from({ length: steps }, (_, i) => tint(base, ((i / (steps - 1)) * 2 - 1) * amount));
  return shades(variants);
}

export type ModelFactory = (rng: Rng) => VoxelModel;
