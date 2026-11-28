import { PALETTE as P } from '../palette';
import { VoxelModel } from '../VoxelModel';
import { hash3 as hash, irange, range, type Rng } from '../rng';

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

/**
 * Footbridge sizes, in voxels (1/16 tile). The model's pivot sits `sink` voxels up, at the top of
 * the bank, so the abutments and trestle posts reach down into the riverbed below it.
 */
export const BRIDGE = {
  length: 60,
  width: 24,
  sink: 7,
  /** Walkable deck width (planks run z 2..21). */
  deckWidth: 20,
  /** Height of the deck's walking surface above the pivot at the ends, and its rise mid-span. */
  deckTop: 3,
  arch: 2,
};

/**
 * Timber footbridge on stone abutments. Long axis along X. A gently arched plank deck rests on two
 * stringers, carried mid-river by two braced trestle bents. Stone pillars mark each end (a lantern on
 * the cabin side), and railings with posts, a handrail and a mid rail run between them.
 */
export function bridge(): VoxelModel {
  const { length: L, width: W, sink: S, arch: ARCH } = BRIDGE;
  const H = S + 30;
  const m = new VoxelModel(L, H, W, { x: L / 2, y: S, z: W / 2 });
  const G = S; // top layer of the bank
  const ABUT = 15; // abutment length at each end: they reach out to the water's edge
  const z0 = 2;
  const z1 = W - 3; // deck edges
  /** Plank layer height at x: rises ARCH voxels mid-span. */
  const deckY = (x: number) => G + 2 + Math.round(ARCH * Math.sin((Math.PI * Math.min(Math.max(x - 2, 0), L - 5)) / (L - 5)));

  // Stone abutments, sunk into each bank, with mortared courses and moss.
  for (const [ax0, ax1] of [[0, ABUT - 1], [L - ABUT, L - 1]])
    for (let y = 0; y <= G + 1; y++)
      for (let z = 0; z < W; z++)
        for (let x = ax0; x <= ax1; x++) {
          const course = y >> 1;
          const off = course % 2 ? 2 : 0;
          const bx = Math.floor((x + off + (ax0 ? 0 : 1)) / 4);
          const bz = Math.floor((z + off) / 4);
          const mortar = y % 2 === 1 && hash(x, y, z) < 0.25;
          const tone = hash(bx, course, bz);
          let col: number = mortar ? P.stoneDark : tone < 0.3 ? P.stoneLight : tone < 0.8 ? P.stone : P.stoneDark;
          if ((x + off) % 4 === 0 || (z + off) % 4 === 0) col = P.stoneDark; // joints
          if (y >= G && hash(x, 9, z) < 0.35) col = hash(x, 10, z) < 0.5 ? P.moss : P.mossDark;
          if (y <= 5 && y >= 4 && hash(x, y, z) < 0.5) col = P.mossDark; // waterline
          m.set(x, y, z, col);
        }
  // A few loose stones at the foot of each abutment.
  for (const [x, z, s] of [[ABUT, 1, 2], [ABUT, W - 4, 3], [L - ABUT - 2, 2, 2], [L - ABUT - 3, W - 3, 2], [ABUT + 1, 9, 2]])
    m.box(x, 2, z, x + s - 1, 2 + s, z + s - 1, hash(x, 1, z) < 0.5 ? P.stone : P.stoneLight);

  // Trestle bents in the river: two posts each side, a cap beam and an X brace.
  for (const bx of [Math.round(L / 3) - 1, Math.round((2 * L) / 3) - 1]) {
    const top = deckY(bx) - 3;
    for (const pz of [z0 + 1, z1 - 2])
      for (let y = 0; y < top; y++)
        m.box(bx, y, pz, bx + 1, y, pz + 1, y >= 3 && y <= 5 ? P.mossDark : y < 3 ? P.barkDark : (y + pz) % 4 ? P.walnut : P.walnutDark);
    m.box(bx - 1, top, z0 - 1, bx + 2, top, z1 + 1, P.walnutDark); // cap beam
    for (let i = 0; i <= z1 - z0 - 6; i++) {
      const y = 4 + Math.round(((top - 5) * i) / (z1 - z0 - 6));
      m.set(bx, y, z0 + 3 + i, P.honey);
      m.set(bx + 1, top - 1 - (y - 4), z0 + 3 + i, P.honey);
    }
  }

  // Stringers along both sides, following the arch.
  for (let x = 1; x < L - 1; x++)
    for (const sz of [z0 + 1, z1 - 2]) m.box(x, deckY(x) - 2, sz, x, deckY(x) - 1, sz + 1, P.walnutDark);

  // Deck planks across, with gaps, ragged ends, knots and nails over the stringers.
  for (let x = 2; x < L - 2; x++) {
    const y = deckY(x);
    const plank = Math.floor((x - 2) / 4);
    if ((x - 2) % 4 === 3) {
      m.box(x, y, z0, x, y, z1, P.walnutDark); // gap
      continue;
    }
    const t = hash(plank, 3, 7);
    const col = t < 0.3 ? P.honey : t < 0.6 ? P.honeyLight : t < 0.85 ? P.walnut : P.honey;
    const ends = [hash(plank, 1, 1) < 0.35 ? -1 : 0, hash(plank, 2, 2) < 0.35 ? 1 : 0];
    for (let z = z0 + ends[0]; z <= z1 + ends[1]; z++) {
      let c: number = col;
      if (hash(x, z, 5) < 0.04) c = P.walnutDark; // knot
      if ((x - 2) % 4 === 1 && (z === z0 + 1 || z === z1 - 1)) c = P.charcoal; // nail
      m.set(x, y, z, c);
    }
  }
  // Stone thresholds where the path meets the deck.
  for (const x of [0, 1, L - 2, L - 1]) m.box(x, G + 1, z0, x, G + 1, z1, x === 0 || x === L - 1 ? P.stoneDark : P.stone);

  // Stone pillars at the four corners where the path meets the bridge, with capstones and moss.
  const PIL = 4;
  for (const px of [0, L - PIL])
    for (const pz of [0, W - 3]) {
      const top = deckY(px) + 9;
      for (let y = G + 1; y <= top; y++)
        for (let x = px; x < px + PIL; x++)
          for (let z = pz; z < pz + 3; z++) {
            const course = (y - G - 1) >> 1;
            const tone = hash(px + (x >> 1), course, pz + (z >> 1));
            let col: number = tone < 0.35 ? P.stoneLight : tone < 0.8 ? P.stone : P.stoneDark;
            if (y % 2 === 0 && hash(x, y, z) < 0.3) col = P.stoneDark; // mortar
            if (y < G + 4 && hash(x, y + 50, z) < 0.3) col = P.mossDark;
            m.set(x, y, z, col);
          }
      m.box(px, top + 1, pz, px + PIL - 1, top + 1, pz + 2, (x, _y, z) => (hash(x, 3, z) < 0.25 ? P.moss : P.stoneLight)); // capstone
    }
  // A lantern on the cabin-side (west) pillar, facing the path.
  {
    const lz = W - 2;
    const ly = deckY(0) + 11;
    m.box(1, ly, lz - 1, 2, ly, lz, P.charcoal);
    m.box(1, ly + 1, lz - 1, 2, ly + 2, lz, P.amber);
    m.box(1, ly + 3, lz - 1, 2, ly + 3, lz, P.charcoal);
    m.set(1, ly + 4, lz - 1, P.charcoalDark);
  }

  // Railings between the pillars: posts bolted to the stringers' outside, a handrail and a mid rail.
  const posts: number[] = [];
  for (let x = PIL + 4; x < L - PIL - 4; x += 9) posts.push(x);
  for (const pz of [z0 - 1, z1 + 1]) {
    for (const px of posts) {
      const top = deckY(px) + 9;
      m.box(px, deckY(px) - 2, pz, px + 1, top, pz, P.walnut);
      m.box(px, deckY(px) - 2, pz, px, top, pz, P.walnutDark);
    }
    for (let x = PIL; x < L - PIL; x++) {
      m.set(x, deckY(x) + 9, pz, P.honeyLight); // handrail
      m.set(x, deckY(x) + 8, pz, P.honey);
      m.set(x, deckY(x) + 5, pz, P.walnut); // mid rail
    }
  }
  return m;
}
