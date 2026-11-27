import { PALETTE as P } from '../palette';
import { VoxelModel } from '../VoxelModel';
import { irange, range, type Rng } from '../rng';

/** Stacked, mossy stone cubes with darker seams, as in the reference boulder clusters. */
function stoneBlock(m: VoxelModel, x0: number, y0: number, z0: number, s: number, salt: number) {
  const base = [P.stone, P.stoneLight, P.stoneDark][salt % 3];
  for (let y = y0; y < y0 + s; y++)
    for (let z = z0; z < z0 + s; z++)
      for (let x = x0; x < x0 + s; x++) {
        // One flat tone per block with a mossy cap; ink outlines supply the edges.
        let col: number = base;
        const top = y0 + s - 1;
        const moss = Math.sin((x - x0) * 0.9 + salt) + Math.cos((z - z0) * 0.8 + salt * 0.5);
        if (y === top && moss > -0.6) col = P.moss;
        else if (y === top - 1 && moss > 0.9) col = P.mossDark;
        m.grid.set(x, y, z, col);
      }
}

export function boulderCluster(rng: Rng, footprint = 30): VoxelModel {
  const m = new VoxelModel(footprint, footprint, footprint);
  const n = irange(rng, 4, 7);
  for (let i = 0; i < n; i++) {
    const s = irange(rng, 7, 11);
    const x = irange(rng, 0, footprint - s);
    const z = irange(rng, 0, footprint - s);
    // Drop the block onto whatever is already below it.
    let y = 0;
    for (let yy = footprint - 1; yy >= 0; yy--) {
      if (m.grid.filled(x + (s >> 1), yy, z + (s >> 1))) {
        y = yy + 1;
        break;
      }
    }
    if (y + s > footprint) continue;
    stoneBlock(m, x, y, z, s, irange(rng, 0, 99));
  }
  return m;
}

export const smallBoulders = (rng: Rng) => boulderCluster(rng, 18);

export function pebble(rng: Rng): VoxelModel {
  const m = new VoxelModel(8, 8, 8);
  const s = irange(rng, 3, 5);
  stoneBlock(m, 1, 0, 1, s, irange(rng, 0, 99));
  return m;
}

export function stump(rng: Rng): VoxelModel {
  const m = new VoxelModel(14, 10, 14, { x: 7, y: 0, z: 7 });
  const h = irange(rng, 4, 7);
  const r = range(rng, 3, 3.8);
  m.cylinderY(7, 7, r, 0, h, P.bark);
  // Cut face with growth rings.
  m.cylinderY(7, 7, r - 0.6, h, h, (x, _y, z) => {
    const d = Math.hypot(x - 7, z - 7);
    return Math.abs(d - r * 0.5) < 0.6 ? P.stumpRing : P.stumpTop;
  });
  // Roots.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (rng() < 0.85) {
      const len = irange(rng, 2, 3);
      for (let i = 0; i < len; i++) m.set(7 + dx * (r + i), i === 0 ? 1 : 0, 7 + dz * (r + i), P.barkDark);
    }
  }
  return m;
}

/** Stack of felled logs, axis along X, with pale cut ends. */
export function logPile(rng: Rng): VoxelModel {
  const L = 40;
  const r = 3.4;
  const m = new VoxelModel(L + 2, 20, 30, { x: (L + 2) / 2, y: 0, z: 15 });
  const bark = (_x: number, y: number) => (y % 7 < 3 ? P.bark : P.barkDark);
  const rows: [number, number][] = [
    [r, 15 - 2 * r - 0.5],
    [r, 15],
    [r, 15 + 2 * r + 0.5],
    [r * 2.7, 15 - r - 0.2],
    [r * 2.7, 15 + r + 0.2],
  ];
  for (const [cy, cz] of rows) {
    const off = irange(rng, -2, 2);
    m.cylinderX(cy, cz, r, 1 + off, L - 1 + off, bark);
    for (const ex of [1 + off, L - 1 + off]) {
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
          const d = Math.hypot(y - cy, z - cz);
          if (d <= r - 0.7) m.grid.set(ex, y, z, Math.abs(d - r * 0.45) < 0.6 ? P.stumpRing : P.stumpTop);
        }
    }
  }
  return m;
}

/** A clump of grass blades, optionally with flowers on top. */
export function tuft(rng: Rng, flowerColors: number[] = []): VoxelModel {
  const m = new VoxelModel(8, 8, 8);
  const blades = irange(rng, 5, 9);
  const greens = [P.grassLight, P.leaf, P.grass, P.leafLight];
  for (let i = 0; i < blades; i++) {
    const x = irange(rng, 1, 6);
    const z = irange(rng, 1, 6);
    const h = irange(rng, 2, 5);
    const col = greens[irange(rng, 0, greens.length - 1)];
    for (let y = 0; y < h; y++) m.set(x, y, z, col);
    if (flowerColors.length && rng() < 0.5) m.set(x, h, z, flowerColors[irange(rng, 0, flowerColors.length - 1)]);
  }
  return m;
}

export const grassTuft = (rng: Rng) => tuft(rng);
export const flowerTuft = (rng: Rng) => tuft(rng, [P.flowerWhite, P.flowerWhite, P.flowerYellow, P.flowerLilac]);

/** Simple plank footbridge. Long axis along X. */
export function bridge(): VoxelModel {
  const L = 50;
  const W = 20;
  const m = new VoxelModel(L, 8, W);
  // Support beams along each side.
  for (const z of [1, W - 3]) m.box(0, 0, z, L - 1, 1, z + 1, P.walnutDark);
  // Planks across.
  for (let x = 0; x < L; x += 4) {
    const col = [P.honey, P.walnut, P.honeyLight, P.honey][(x / 4) % 4];
    m.box(x, 2, 0, x + 2, 2, W - 1, col);
    m.box(x + 3, 2, 0, x + 3, 2, W - 1, P.walnutDark);
  }
  return m;
}
