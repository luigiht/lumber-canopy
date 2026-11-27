/** Small deterministic PRNG (mulberry32) so procedural models and scatter are reproducible. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const irange = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));
export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

/** Stable hash of integer coordinates to [0,1). Used for per-voxel colour variation. */
export function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Cheap 2D value noise in [0,1). */
export function valueNoise2(x: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash3(xi, seed, zi);
  const b = hash3(xi + 1, seed, zi);
  const c = hash3(xi, seed, zi + 1);
  const d = hash3(xi + 1, seed, zi + 1);
  const u = s(xf);
  const v = s(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
