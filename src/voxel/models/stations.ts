import { PALETTE as P } from '../palette';
import { VoxelModel, shades } from '../VoxelModel';
import { irange, makeRng, type Rng } from '../rng';
import type { SpeciesId } from '@/game/plants';
import { FIELD } from '@/config/field';

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
const PLANT_H = 32;
/** How much a wooden plant stand lifts the pot, in voxels. */
const STAND_H = 5;

/** Pots and stands a displayed plant can sit in. Each spot keeps one style, so a room mixes them. */
export type PotStyle = 'terracotta' | 'cream' | 'charcoal' | 'basket' | 'stand';
export const POT_STYLES: PotStyle[] = ['cream', 'terracotta', 'basket', 'charcoal', 'stand'];

/** The pot style for a display spot; spots on furniture skip the stand. */
export function potStyleFor(slot: number, onFurniture = false): PotStyle {
  const style = POT_STYLES[(slot * 3 + 1) % POT_STYLES.length];
  return onFurniture && style === 'stand' ? 'cream' : style;
}

const POT_COLORS: Record<Exclude<PotStyle, 'stand'>, { body: number; dark: number; rim: number }> = {
  terracotta: { body: P.terracotta, dark: P.terracottaDark, rim: P.terracottaLight },
  cream: { body: P.ceramic, dark: P.ceramicDark, rim: P.ceramicLight },
  charcoal: { body: P.charcoal, dark: P.charcoalDark, rim: P.charcoalLight },
  basket: { body: P.honey, dark: P.walnut, rim: P.walnut },
};

/** Draws the pot (on a stand if asked) and returns the soil height, where foliage starts. */
function pot(m: VoxelModel, style: PotStyle): number {
  const o = (PLANT_W - POT) / 2;
  let y0 = 0;
  if (style === 'stand') {
    // A little four-legged wooden stand with a slatted top.
    for (const [x, z] of [[o - 1, o - 1], [o + POT, o - 1], [o - 1, o + POT], [o + POT, o + POT]]) m.box(x, 0, z, x, STAND_H - 1, z, P.walnutDark);
    m.box(o - 1, STAND_H - 1, o - 1, o + POT, STAND_H - 1, o + POT, (x) => (x % 2 === 0 ? P.honey : P.honeyLight));
    m.box(o - 1, 1, o - 1, o + POT, 1, o - 1, P.walnut);
    m.box(o - 1, 1, o + POT, o + POT, 1, o + POT, P.walnut);
    y0 = STAND_H;
  }
  const c = POT_COLORS[style === 'stand' ? 'cream' : style];
  const basket = style === 'basket';
  m.box(o + 1, y0, o + 1, o + POT - 2, y0, o + POT - 2, c.dark); // foot
  m.box(o, y0 + 1, o, o + POT - 1, y0 + 3, o + POT - 1, (x, y, z) =>
    basket ? ((x + y + z) % 2 === 0 ? P.honey : P.honeyLight) : y === y0 + 2 && style !== 'terracotta' ? c.dark : c.body,
  );
  m.box(o - 1, y0 + 4, o - 1, o + POT, y0 + 4, o + POT, c.rim); // rim
  m.box(o, y0 + 4, o, o + POT - 1, y0 + 4, o + POT - 1, P.potSoil);
  return y0 + 5;
}

const C = PLANT_W / 2 - 0.5;
/** Soil line of a plain pot: foliage starts here (a stand lifts it by STAND_H). */
const TOP = 5;
/** Height of the soil surface inside a garden bed, in voxels. */
const BED_SOIL = 3;

const set = (m: VoxelModel, x: number, y: number, z: number, col: number) => m.set(x, Math.max(0, y), z, col);

/** A blade that arches out from the centre along (dx,dz): `col` along the edge, `mid` down the middle. */
function blade(m: VoxelModel, top: number, dx: number, dz: number, len: number, lift: number, col: number, mid = col, tip = col) {
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    const y = top + Math.round(lift * Math.sin(t * Math.PI * 0.9));
    const x = C + dx * i;
    const z = C + dz * i;
    set(m, x, y, z, i >= len - 1 ? tip : mid);
    // A second, offset row makes the blade two voxels wide until the tip.
    if (i < len - 1) set(m, x - dz, y, z + dx, col);
  }
}

/** A small leaf: a 2×2 patch with a light edge, the way the reference draws foliage clusters. */
function leaf(m: VoxelModel, x: number, y: number, z: number, col: number, light: number) {
  set(m, x, y, z, col);
  set(m, x + 1, y, z, light);
  set(m, x, y, z + 1, col);
  set(m, x + 1, y, z + 1, col);
}

/**
 * A houseplant at a growth stage, drawn after the pixel-art houseplant collection: layered leaves in
 * two or three greens with light edges, variegation, trailing vines and runners. Potted, it sits in
 * a pot of the given style; otherwise it grows straight from the soil, with the soil line at y = TOP
 * (see GROUND_PLANT_SINK).
 */
function plantModel(species: SpeciesId, stage: 1 | 2 | 3, style: PotStyle | null = 'terracotta'): VoxelModel {
  const m = new VoxelModel(PLANT_W, PLANT_H, PLANT_W, { x: PLANT_W / 2, y: 0, z: PLANT_W / 2 });
  const top = style ? pot(m, style) : TOP;
  const rng = makeRng(species.length * 97 + stage);
  const s = [0.45, 0.72, 1][stage - 1];
  const dirs = (n: number, off = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + off) / n) * Math.PI * 2 + rng() * 0.35;
      return [Math.cos(a), Math.sin(a)] as const;
    });

  switch (species) {
    case 'pothos': {
      // A mound of small heart leaves, some splashed with cream, with vines spilling over the rim.
      const r = 2 + 2.4 * s;
      const n = Math.round(10 + 22 * s);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * r;
        const x = Math.round(C + Math.cos(a) * d - 0.5);
        const z = Math.round(C + Math.sin(a) * d - 0.5);
        const y = top + Math.round((1 - d / r) * (1 + 2.5 * s) + rng());
        const t = rng();
        leaf(m, x, y, z, t < 0.12 ? P.variegated : t < 0.55 ? P.leaf : P.leafBright, P.leafLight);
      }
      if (stage >= 2)
        for (const [dx, dz] of dirs(stage === 3 ? 6 : 3)) {
          const ex = Math.round(C + dx * 4);
          const ez = Math.round(C + dz * 4);
          const len = 3 + stage * 3;
          for (let k = 0; k < len; k++) {
            const y = top - k;
            const sway = k % 4 < 2 ? 0 : 1;
            const vx = ex + (dx > 0 ? sway : -sway);
            set(m, vx, y, ez, P.leafDark);
            // Leaves sit right beside the vine, alternating sides, so none float loose.
            if (k % 2 === 0) set(m, vx, y, ez + (k % 4 === 0 ? 1 : -1), k % 6 === 0 ? P.leafBright : P.leaf);
          }
        }
      break;
    }
    case 'spider': {
      // Arching striped blades with a cream centre; mature plants send out runners with babies.
      for (const [dx, dz] of dirs(stage * 2 + 6)) blade(m, top, dx, dz, Math.round(2 + 5.5 * s), 2 + 3 * s, P.leaf, P.variegated, P.leafLight);
      for (const [dx, dz] of dirs(4, 0.5)) blade(m, top, dx * 0.6, dz * 0.6, Math.round(2 + 3 * s), 3 + 4 * s, P.leafBright, P.leafLight);
      if (stage === 3)
        for (const [dx, dz] of dirs(3, 0.25)) {
          const ex = Math.round(C + dx * 7);
          const ez = Math.round(C + dz * 7);
          for (let y = top; y >= top - 4; y--) set(m, Math.round(C + dx * 6), y, Math.round(C + dz * 6), P.leafDark);
          set(m, ex, top - 5, ez, P.leafLight);
          set(m, ex + 1, top - 4, ez, P.variegated);
          set(m, ex - 1, top - 4, ez, P.leafLight);
          set(m, ex, top - 4, ez + 1, P.leafLight);
        }
      break;
    }
    case 'fern': {
      // Feathery fronds: a midrib with leaflets either side, light at the tips, drooping at the end.
      const fronds = stage * 3 + 5;
      for (const [dx, dz] of dirs(fronds)) {
        const len = Math.round(3 + 5 * s);
        const lift = 3 + 4 * s;
        for (let i = 0; i <= len; i++) {
          const t = i / len;
          const y = top + Math.round(lift * Math.sin(t * Math.PI * 0.95));
          const x = C + dx * i;
          const z = C + dz * i;
          set(m, x, y, z, P.pineMid);
          if (i > 0 && i < len) {
            const col = t > 0.6 ? P.pineTip : i % 2 ? P.leafLight : P.pineLight;
            set(m, x - dz, y, z + dx, col);
            set(m, x + dz, y, z - dx, col);
          }
        }
      }
      m.ellipsoid(C, top + 1, C, 1.5 + s, 1.2 * s + 0.6, 1.5 + s, shades([P.pineLight, P.pineMid, P.pineTip]));
      break;
    }
    case 'snake': {
      // Upright sword leaves, banded in dark green, with yellow margins and pointed tips.
      const blades = [[0, 0], [-2, 1], [2, -1], [1, 2], [-1, -2], [2, 2], [-2, -1]].slice(0, stage + 3);
      for (const [bx, bz] of blades) {
        const h = Math.round(4 + 10 * s * (0.75 + rng() * 0.35));
        const lean = bx === 0 && bz === 0 ? 0 : 0.12;
        for (let y = top; y < top + h; y++) {
          const k = y - top;
          const x = Math.round(C + bx + bx * lean * k);
          const z = Math.round(C + bz + bz * lean * k);
          const band = (y + bx * 2 + bz) % 3 === 0 ? P.pineDark : P.pineMid;
          const tip = k >= h - 1;
          set(m, x, y, z, tip ? P.variegated : band);
          if (k < h - 2) {
            set(m, x + 1, y, z, k % 3 === 1 ? P.leafLight : band);
            set(m, x + 2, y, z, P.variegated); // yellow margin on the outer edge
          }
        }
      }
      break;
    }
    case 'monstera': {
      // Stems rising out of the pot to big split leaves: deep green, a lighter rim and midrib,
      // and holes in the mature leaves.
      const leaves = stage + 2;
      const around = dirs(leaves);
      for (let i = 0; i < leaves; i++) {
        const [dx, dz] = around[i];
        const h = Math.round(3 + 7 * s + (i % 3));
        const reach = 2 + 3.5 * s;
        for (let k = 0; k <= h; k++) set(m, C + dx * k * (reach / h), top + k, C + dz * k * (reach / h), P.leafDark);
        const lx = C + dx * (reach + 1);
        const lz = C + dz * (reach + 1);
        const ly = top + h;
        const r = 1.8 + 2.4 * s;
        for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++)
          for (let oz = -Math.ceil(r); oz <= Math.ceil(r); oz++) {
            const d = Math.hypot(ox, oz) / r;
            if (d > 1) continue;
            const along = (ox * dx + oz * dz) / r; // towards the leaf tip
            const across = ox * -dz + oz * dx; // signed distance from the midrib
            // A flat leaf, its outer half dipping one voxel, so it stays one solid sheet.
            const y = along > 0.35 ? ly - 1 : ly;
            // Mature leaves are split: a few slits run in from the edge, between the veins.
            if (stage === 3 && d > 0.55 && d < 0.9 && Math.abs(across) > 1 && Math.round(Math.abs(across) + along * 2) % 3 === 0) continue;
            // Skip lone rim voxels that would stick out on their own.
            const onRim = (v: number) => Math.abs(v) === Math.ceil(r);
            if (d > 0.92 && onRim(ox) !== onRim(oz)) continue;
            const col = Math.abs(across) < 0.6 ? P.leafLight : d > 0.8 ? P.leafDark : (ox * 3 + oz) % 4 === 0 ? P.leafDeep : P.leaf;
            set(m, Math.round(lx + ox), y, Math.round(lz + oz), col);
          }
      }
      break;
    }
  }
  return m;
}

const plantCache = new Map<string, VoxelModel>();

/** A potted plant at a growth stage, in a pot of the given style (cached; models are shared by key). */
export function pottedPlant(species: SpeciesId, stage: 1 | 2 | 3, style: PotStyle = 'terracotta'): VoxelModel {
  const key = `${species}:${stage}:${style}`;
  let m = plantCache.get(key);
  if (!m) {
    m = plantModel(species, stage, style);
    plantCache.set(key, m);
  }
  return m;
}

/** A plant growing in a garden bed (cached like potted ones). */
export function groundPlant(species: SpeciesId, stage: 1 | 2 | 3): VoxelModel {
  const key = `ground:${species}:${stage}`;
  let m = plantCache.get(key);
  if (!m) {
    m = plantModel(species, stage, null);
    plantCache.set(key, m);
  }
  return m;
}

/** How far to lower a ground plant (voxels) so its soil line meets a bed's soil. */
export const GROUND_PLANT_SINK = TOP - BED_SOIL;

// ---- Garden field --------------------------------------------------------------------------

const FIELD_W = Math.round(FIELD.halfX * 32);
const FIELD_D = Math.round(FIELD.halfZ * 32);

/**
 * A low rope fence around the garden field: wooden posts at the corners and halfway along each
 * side, with rope strung between them. Only the fence: the ground inside is the terrain's own dirt.
 */
export function fieldFence(): VoxelModel {
  const m = new VoxelModel(FIELD_W, 8, FIELD_D);
  const xs = [0, Math.floor(FIELD_W / 2), FIELD_W - 1];
  const zs = [0, Math.floor(FIELD_D / 2), FIELD_D - 1];
  for (const x of xs)
    for (const z of zs) if (x !== xs[1] || z !== zs[1]) if (x === 0 || x === FIELD_W - 1 || z === 0 || z === FIELD_D - 1) m.box(x, 0, z, x, 7, z, P.walnut);
  // Rope between the posts, sagging a voxel midway along each span.
  const rope = (t: number, span: number) => (Math.abs(t - span / 2) < span / 4 ? 5 : 6);
  for (let x = 1; x < FIELD_W - 1; x++) {
    if (xs.includes(x)) continue;
    const y = rope(x % (FIELD_W / 2), FIELD_W / 2);
    m.set(x, y, 0, P.honeyLight);
    m.set(x, y, FIELD_D - 1, P.honeyLight);
  }
  for (let z = 1; z < FIELD_D - 1; z++) {
    if (zs.includes(z)) continue;
    const y = rope(z % (FIELD_D / 2), FIELD_D / 2);
    m.set(0, y, z, P.honeyLight);
    m.set(FIELD_W - 1, y, z, P.honeyLight);
  }
  return m;
}

/** A raised bed edged with reclaimed boards, filled with dark soil. */
export function fieldBed(): VoxelModel {
  const n = 9;
  const m = new VoxelModel(n, BED_SOIL + 1, n);
  for (let y = 0; y <= BED_SOIL - 1; y++) {
    const col = y === BED_SOIL - 1 ? P.honey : P.walnut;
    m.box(0, y, 0, n - 1, y, 0, col);
    m.box(0, y, n - 1, n - 1, y, n - 1, col);
    m.box(0, y, 0, 0, y, n - 1, col);
    m.box(n - 1, y, 0, n - 1, y, n - 1, col);
  }
  m.box(1, 0, 1, n - 2, BED_SOIL - 1, n - 2, P.potSoil);
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
