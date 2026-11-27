import { PALETTE as P } from '../palette';
import { VoxelModel, shades } from '../VoxelModel';
import { irange, makeRng, type Rng } from '../rng';
import type { SpeciesId } from '@/game/plants';

/* Voxel models for things the player uses: stone piles, the compost heap, the potting table,
 * the workbench, the delivery box, the taxi, potted houseplants and hand tools. 1 voxel = 1/16 tile. */

const STONES = [P.stone, P.stoneLight, P.stoneDark];

/** A low pile of loose, river-rounded stones. */
export function rockPile(rng: Rng): VoxelModel {
  const m = new VoxelModel(18, 8, 18);
  const n = irange(rng, 9, 12);
  for (let i = 0; i < n; i++) {
    const s = irange(rng, 2, 4);
    const x = irange(rng, 2, 15 - s);
    const z = irange(rng, 2, 15 - s);
    let y = 0;
    while (y < 6 && m.grid.filled(x + (s >> 1), y, z + (s >> 1))) y++;
    const col = STONES[irange(rng, 0, 2)];
    m.box(x, y, z, x + s - 1, y + Math.max(1, s - 2), z + s - 1, col);
    if (rng() < 0.3) m.set(x, y + Math.max(1, s - 2), z, P.moss);
  }
  return m;
}

/** What's left of a pile once it's gathered: a few pebbles. */
export function rockPileEmpty(rng: Rng): VoxelModel {
  const m = new VoxelModel(18, 2, 18);
  for (let i = 0; i < 4; i++) {
    const x = irange(rng, 3, 13);
    const z = irange(rng, 3, 13);
    m.box(x, 0, z, x + 1, 0, z, STONES[i % 3]);
  }
  return m;
}

/** Slatted wooden compost bin heaped with dark soil. */
export function compostHeap(): VoxelModel {
  const m = new VoxelModel(22, 12, 18);
  const soil = shades([P.soil, P.soilDark, P.earthDeep]);
  m.ellipsoid(11, 4, 9, 8, 7, 6.5, soil);
  for (let y = 0; y < 12; y++) for (let z = 0; z < 18; z++) for (let x = 0; x < 22; x++) if (y > 9) m.grid.clear(x, y, z);
  // Bits of greens on top.
  for (const [x, z] of [[7, 7], [12, 10], [15, 6], [9, 12]]) m.set(x, 10, z, P.leafLight);
  // Slats on three sides, open at the front (+z).
  for (let y = 0; y <= 8; y += 2) {
    const col = y % 4 === 0 ? P.walnut : P.honey;
    m.box(0, y, 0, 21, y, 0, col);
    m.box(0, y, 0, 0, y, 16, col);
    m.box(21, y, 0, 21, y, 16, col);
  }
  for (const [x, z] of [[0, 0], [21, 0], [0, 16], [21, 16]]) m.box(x, 0, z, x, 9, z, P.walnutDark);
  return m;
}

/** Table for potting plants, with a soil sack and spare pots on the lower shelf. Top at y = 12. */
export function pottingTable(): VoxelModel {
  const m = new VoxelModel(30, 14, 14);
  m.box(0, 10, 0, 29, 11, 13, (x) => (x % 5 === 4 ? P.walnut : P.honey));
  for (const [x, z] of [[1, 1], [27, 1], [1, 11], [27, 11]]) m.box(x, 0, z, x + 1, 9, z + 1, P.walnutDark);
  m.box(1, 3, 2, 28, 3, 11, P.walnut); // shelf
  m.box(4, 4, 4, 9, 8, 9, P.dirtLight); // soil sack
  m.box(5, 9, 5, 8, 9, 8, P.dirtDark);
  for (const x of [17, 22]) {
    m.box(x, 4, 5, x + 3, 6, 8, P.terracotta);
    m.box(x, 7, 5, x + 3, 7, 8, P.terracottaLight);
  }
  // Little trowel on top.
  m.box(25, 12, 9, 26, 12, 12, P.stoneLight);
  return m;
}

/** Workbench with a vise and a pegboard of tools. */
export function workbench(): VoxelModel {
  const m = new VoxelModel(30, 28, 16);
  m.box(0, 10, 2, 29, 12, 15, (x) => (x % 6 === 5 ? P.walnut : P.honeyLight));
  for (const [x, z] of [[1, 3], [27, 3], [1, 13], [27, 13]]) m.box(x, 0, z, x + 1, 9, z + 1, P.walnutDark);
  m.box(1, 3, 4, 28, 3, 13, P.walnut);
  // Pegboard at the back.
  m.box(0, 13, 0, 29, 27, 1, P.walnut);
  for (let y = 15; y <= 25; y += 3) for (let x = 2; x <= 27; x += 3) m.set(x, y, 2, P.walnutDark);
  // Hung tools: a saw outline and a wrench.
  m.box(4, 18, 2, 12, 21, 2, P.stoneLight);
  m.box(3, 18, 2, 3, 22, 2, P.honey);
  m.box(17, 16, 2, 17, 24, 2, P.stone);
  m.box(16, 24, 2, 18, 25, 2, P.stone);
  // Vise.
  m.box(23, 13, 10, 27, 15, 14, P.slateLight);
  m.box(24, 16, 11, 26, 16, 13, P.slate);
  // Planks waiting on top.
  m.box(5, 13, 6, 18, 13, 9, P.honey);
  m.box(7, 14, 7, 16, 14, 8, P.walnut);
  return m;
}

/** Wooden crate by the road with a sign post, where buyers collect plants. */
export function deliveryBox(): VoxelModel {
  const m = new VoxelModel(22, 26, 14);
  m.box(0, 0, 0, 13, 11, 13, (_x, y) => (y % 4 === 3 ? P.walnut : P.honey));
  m.box(0, 12, 0, 13, 12, 13, P.walnutDark); // lid
  for (const x of [0, 13]) m.box(x, 0, 0, x, 11, 0, P.walnutDark);
  // Leaf mark on the front.
  m.box(6, 4, 14, 7, 7, 14, P.leaf);
  m.set(5, 6, 14, P.leaf);
  m.set(8, 5, 14, P.leaf);
  // Post with a little sign.
  m.box(17, 0, 6, 18, 23, 7, P.walnutDark);
  m.box(15, 18, 8, 21, 23, 8, P.honeyLight);
  m.box(16, 20, 9, 20, 21, 9, P.leafDark);
  return m;
}

const TAXI = { body: 0xe7b52c, bodyDark: 0xb98e1e, glass: 0x3e4f63, tyre: 0x1f1d1d, hub: 0x9a9a9a, light: 0xfff0b0, tail: 0xb8352b };

/** A boxy taxi, long axis along z, nose toward +z. */
export function taxi(): VoxelModel {
  const m = new VoxelModel(22, 21, 44);
  m.box(1, 3, 1, 20, 9, 42, TAXI.body);
  m.box(1, 3, 1, 20, 3, 42, TAXI.bodyDark);
  // Checker stripe.
  for (let z = 2; z <= 41; z++) for (const x of [1, 20]) m.set(x, 7, z, (z >> 1) % 2 ? 0x1d1a1a : 0xf3f2ec);
  // Cabin with windows.
  m.box(3, 10, 11, 18, 16, 32, TAXI.body);
  m.box(3, 11, 12, 18, 15, 31, (x, _y, z) => (x === 3 || x === 18 || z === 12 || z === 31 ? TAXI.glass : TAXI.body));
  for (const z of [21, 22]) for (const x of [3, 18]) m.box(x, 11, z, x, 15, z, TAXI.body);
  m.box(4, 16, 12, 17, 16, 31, TAXI.bodyDark);
  // Roof sign.
  m.box(7, 17, 19, 14, 19, 24, 0xf3f2ec);
  m.box(8, 18, 18, 13, 18, 25, TAXI.body);
  // Wheels.
  for (const z0 of [6, 31]) for (const x of [0, 21]) {
    m.box(x, 0, z0, x, 4, z0 + 6, TAXI.tyre);
    m.box(x, 1, z0 + 2, x, 3, z0 + 4, TAXI.hub);
  }
  // Lights.
  for (const x of [2, 3, 18, 19]) {
    m.set(x, 7, 43, TAXI.light);
    m.set(x, 6, 43, TAXI.light);
    m.set(x, 7, 0, TAXI.tail);
  }
  return m;
}

// ---- Potted plants -------------------------------------------------------------------------

const POT = 6;
const PLANT_W = 18;
const PLANT_H = 26;

function pot(m: VoxelModel) {
  const o = (PLANT_W - POT) / 2;
  m.box(o + 1, 0, o + 1, o + POT - 2, 0, o + POT - 2, P.terracottaDark);
  m.box(o, 1, o, o + POT - 1, 3, o + POT - 1, P.terracotta);
  m.box(o - 1, 4, o - 1, o + POT, 4, o + POT, P.terracottaLight); // rim
  m.box(o, 4, o, o + POT - 1, 4, o + POT - 1, P.potSoil);
  for (let x = o; x < o + POT; x++) for (let z = o; z < o + POT; z++) if (x > o && x < o + POT - 1 && z > o && z < o + POT - 1) m.set(x, 4, z, P.potSoil);
}

const C = PLANT_W / 2 - 0.5;
const TOP = 5;

/** A leaf blade that arches out from the centre along (dx,dz). */
function arch(m: VoxelModel, dx: number, dz: number, len: number, lift: number, col: number, tip = col) {
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    const y = TOP + Math.round(lift * Math.sin(t * Math.PI * 0.85));
    m.set(C + dx * i, y, C + dz * i, i >= len - 1 ? tip : col);
  }
}

function plantModel(species: SpeciesId, stage: 1 | 2 | 3): VoxelModel {
  const m = new VoxelModel(PLANT_W, PLANT_H, PLANT_W, { x: PLANT_W / 2, y: 0, z: PLANT_W / 2 });
  pot(m);
  const rng = makeRng(species.length * 97 + stage);
  const s = [0.45, 0.72, 1][stage - 1];
  const dirs = (n: number, off = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + off) / n) * Math.PI * 2 + rng() * 0.3;
      return [Math.cos(a), Math.sin(a)] as const;
    });

  switch (species) {
    case 'pothos': {
      const leaf = shades([P.leaf, P.leafLight, P.variegated]);
      m.ellipsoid(C, TOP + 2 * s, C, 2 + 2.2 * s, 1 + 2 * s, 2 + 2.2 * s, leaf);
      if (stage >= 2)
        for (const [dx, dz] of dirs(stage === 3 ? 5 : 3)) {
          const ex = Math.round(C + dx * 4);
          const ez = Math.round(C + dz * 4);
          for (let y = TOP; y >= TOP - 2 - stage * 2; y--) m.set(ex, Math.max(0, y), ez, (y & 1) === 0 ? P.leaf : P.leafLight);
        }
      break;
    }
    case 'spider': {
      for (const [dx, dz] of dirs(stage + 5)) arch(m, dx, dz, Math.round(2 + 5 * s), 2 + 3 * s, P.leafLight, P.variegated);
      if (stage === 3)
        for (const [dx, dz] of dirs(3, 0.5)) m.box(Math.round(C + dx * 7), TOP - 1, Math.round(C + dz * 7), Math.round(C + dx * 7), TOP, Math.round(C + dz * 7), P.leafLight);
      break;
    }
    case 'fern': {
      for (const [dx, dz] of dirs(stage * 3 + 4)) arch(m, dx, dz, Math.round(2 + 5 * s), 3 + 4 * s, P.pineTip, P.leafLight);
      m.ellipsoid(C, TOP + 1, C, 1.5 + s, 1.5 * s + 0.5, 1.5 + s, P.pineLight);
      break;
    }
    case 'snake': {
      const blades = [[0, 0], [-2, 1], [2, -1], [1, 2], [-1, -2]].slice(0, stage + 2);
      for (const [bx, bz] of blades) {
        const h = Math.round(4 + 9 * s * (0.8 + rng() * 0.3));
        for (let y = TOP; y < TOP + h; y++) {
          const edge = y === TOP + h - 1 || (y + bx) % 4 === 0;
          m.set(C + bx, y, C + bz, edge ? P.variegated : P.pineMid);
          if (y < TOP + h - 2) m.set(C + bx + 1, y, C + bz, P.pineDark);
        }
      }
      break;
    }
    case 'monstera': {
      const leaves = stage + 1;
      for (let i = 0; i < leaves; i++) {
        const [dx, dz] = dirs(leaves)[i];
        const h = Math.round(3 + 7 * s + i);
        const lx = C + dx * (2 + 3 * s);
        const lz = C + dz * (2 + 3 * s);
        for (let y = TOP; y < TOP + h; y++) m.set(C + dx * (y - TOP) * 0.3, y, C + dz * (y - TOP) * 0.3, P.leafDark);
        const r = 1.5 + 2 * s;
        m.ellipsoid(lx, TOP + h, lz, r, 0.6, r, (x, _y, z) => ((x + z) % 3 === 0 && stage === 3 ? P.leaf : P.pineMid));
        if (stage === 3) m.grid.clear(Math.round(lx + 1), TOP + h, Math.round(lz));
      }
      break;
    }
  }
  return m;
}

const plantCache = new Map<string, VoxelModel>();

/** A potted plant at a growth stage (cached; models are shared by key). */
export function pottedPlant(species: SpeciesId, stage: 1 | 2 | 3): VoxelModel {
  const key = `${species}:${stage}`;
  let m = plantCache.get(key);
  if (!m) {
    m = plantModel(species, stage);
    plantCache.set(key, m);
  }
  return m;
}

// ---- Hand tools: origin at the grip, handle hanging down, head forward (+z). --------------------

const TOOL = { handle: 0x8a5a31, steel: 0xa9acb0, edge: 0xe2e4e6, line: 0xe8e2d0, reel: 0x3a3d45, cork: 0xc79a62 };

export function hammerTool(): VoxelModel {
  const m = new VoxelModel(1, 9, 5, { x: 0.5, y: 8, z: 1.5 });
  m.box(0, 2, 1, 0, 8, 1, TOOL.handle);
  m.box(0, 0, 0, 0, 2, 4, TOOL.steel);
  m.box(0, 0, 4, 0, 2, 4, TOOL.edge);
  return m;
}

export function pickaxeTool(): VoxelModel {
  const m = new VoxelModel(1, 10, 9, { x: 0.5, y: 9, z: 4.5 });
  m.box(0, 2, 4, 0, 9, 4, TOOL.handle);
  m.box(0, 1, 1, 0, 1, 7, TOOL.steel);
  m.box(0, 0, 0, 0, 0, 1, TOOL.edge);
  m.box(0, 0, 7, 0, 0, 8, TOOL.edge);
  return m;
}

/** Long rod: the tip is at the bottom (y = 0) so a raised arm points it out over the water. */
export function rodTool(): VoxelModel {
  const m = new VoxelModel(2, 22, 2, { x: 0.5, y: 18, z: 0.5 });
  m.box(0, 0, 0, 0, 15, 0, TOOL.handle);
  m.box(0, 16, 0, 0, 21, 0, TOOL.cork);
  m.box(1, 16, 0, 1, 17, 1, TOOL.reel);
  return m;
}

/** Where the rod tip sits relative to the grip, in voxels (matches rodTool's pivot). */
export const ROD_TIP = { x: 0, y: -18, z: 0 };
