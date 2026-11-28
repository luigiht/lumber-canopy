import { PALETTE as P } from '../palette';
import { VoxelModel, tint } from '../VoxelModel';
import { hash3 } from '../rng';
import type { StageId } from '@/config/cabin';

/*
 * The starter cabin, after the cozy forest cabin asset sheets (context/images/cabin), in 1/16-tile
 * voxels: a stone-block foundation, board-and-batten walls with honey timber framing, a steep slate
 * gable roof with a dormer, an outside stone chimney, a wrap-around porch on stone piers with
 * balustered railings, flower boxes, ivy, lanterns and a lamp post, and a woodpile under a lean-to.
 * Every build stage is its own model in one shared grid, so the stages line up and can be revealed
 * one after another. Glass is kept separate so windows can glow at night.
 */

const W = 64; // body width (x)
const D = 80; // body depth (z)
const OX = 12; // body starts here in x (room for the chimney and woodpile on -x)
const OZ = 4; // body starts here in z (room for the back roof overhang)
const SX = OX + W + 8; // room for the lamp post on +x
const SZ = OZ + D + 32;
const SY = 96;
const C = OX + W / 2 - 0.5; // ridge line x
const HALF_SPAN = W / 2 + 4;
/** Exactly one voxel up per voxel in: a 45° pitch gives an even stair, so the roof reads as one straight plane. */
const RISE = 1;
/** Top of the stone foundation; the floor sits on it and the walls start above the floor. */
const BASE = 8;
const WALL0 = BASE + 2;
const EAVE_Y = 40;

/** Top of the roof surface over column x. */
const roofH = (x: number) => Math.round(EAVE_Y + (HALF_SPAN - Math.abs(x - C)) * RISE);

export const CABIN_PIVOT = { x: OX + W / 2, y: 0, z: OZ + D / 2 };

/** Height of the porch deck and the cabin floor, in tiles (where porch plants stand). */
export const CABIN_DECK_Y = WALL0 / 16;

export interface CabinParts {
  /** Solid voxels per stage. */
  solid: Record<StageId, VoxelModel>;
  /** Glowing glass per stage (only some stages have any). */
  glow: Partial<Record<StageId, VoxelModel>>;
  /** Stakes and string marking the plot before building starts. */
  plot: VoxelModel;
  /** Chimney mouth, in voxels relative to the pivot. */
  chimneyTop: { x: number; y: number; z: number };
  /** Front door centre at porch height, in voxels relative to the pivot. */
  door: { x: number; y: number; z: number };
}

const STONE_TONES = [P.stoneLight, P.stone, P.stone, P.stoneDark];
const MORTAR = tint(P.stoneDark, -0.28);

/**
 * Dressed stone blocks with dark mortar lines: rows three voxels high, blocks five wide, every other
 * row offset, each block one flat tone. `u` runs along the wall face; mossy near the ground.
 */
function stoneBlock(u: number, y: number, salt = 0) {
  const row = Math.floor(y / 3);
  const shifted = u + (row % 2) * 3;
  if (y % 3 === 2 || shifted % 5 === 0) return MORTAR;
  const block = Math.floor(shifted / 5);
  if (row === 0 && hash3(block, row, salt + 3) < 0.35) return P.moss;
  return STONE_TONES[Math.floor(hash3(block, row, salt) * STONE_TONES.length)];
}

export function cabin(): CabinParts {
  const claimed = new Uint8Array(SX * SY * SZ);
  const idx = (x: number, y: number, z: number) => x + SX * (z + SZ * y);
  const model = () => new VoxelModel(SX, SY, SZ, CABIN_PIVOT);
  // Each cell belongs to one part only; later parts skip cells already claimed (no z-fighting).
  const put = (m: VoxelModel, x: number, y: number, z: number, col: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) return;
    const i = idx(x, y, z);
    if (claimed[i]) return;
    claimed[i] = 1;
    m.grid.set(x, y, z, col);
  };
  const box = (
    m: VoxelModel,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    col: number | ((x: number, y: number, z: number) => number),
  ) => {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) put(m, x, y, z, typeof col === 'number' ? col : col(x, y, z));
  };
  /** Stone blocks on whichever face a cell is on (u runs along x on ±z faces, along z on ±x faces). */
  const stone = (x: number, y: number, z: number) => stoneBlock(x + z, y);

  const ridge = roofH(Math.floor(C));
  const front = OZ + D - 1; // outer face of the front wall
  const dx0 = Math.floor(C) - 4; // door
  const dx1 = dx0 + 9;
  const DOOR_TOP = WALL0 + 25;

  // ---- Timber frame first: it shows through the finished walls as honey trim. -----------------
  const frame = model();
  const fz0 = OZ - 1;
  const fz1 = OZ + D;
  for (const x0 of [OX - 1, OX + W - 2])
    for (const z0 of [fz0, fz1 - 2]) box(frame, x0, BASE, z0, x0 + 2, roofH(x0 + 1) - 4, z0 + 2, P.honey); // corner posts
  for (const zm of [OZ + 20, OZ + 40, OZ + 60])
    for (const x0 of [OX - 1, OX + W - 2]) box(frame, x0, WALL0, zm, x0 + 2, EAVE_Y - 1, zm + 1, P.honey); // side posts
  for (const x0 of [OX - 1, OX + W - 2]) {
    box(frame, x0, WALL0, fz0, x0 + 2, WALL0 + 1, fz1, P.honey); // sill plates
    box(frame, x0, EAVE_Y, fz0, x0 + 2, EAVE_Y + 1, fz1, P.honey); // top plates
  }
  for (const [z0, z1] of [[fz0, fz0 + 1], [fz1 - 1, fz1]]) {
    box(frame, OX, WALL0, z0, OX + W - 1, WALL0 + 1, z1, P.honey); // sills
    box(frame, OX, EAVE_Y, z0, OX + W - 1, EAVE_Y + 1, z1, P.honey); // tie beam across each gable
    // Posts either side of the door, framing the porch wall into bays.
    for (const px of [dx0 - 6, dx1 + 5]) box(frame, px, WALL0, z0, px + 1, EAVE_Y - 1, z1, P.honey);
  }
  // Rafters along the roof line: front and back gables (proud of the wall) and three inside.
  for (const [z0, z1] of [[OZ + D - 1, OZ + D], [OZ - 1, OZ], [OZ + 20, OZ + 21], [OZ + 40, OZ + 41], [OZ + 60, OZ + 61]])
    for (let x = OX - 4; x < OX + W + 4; x++) box(frame, x, roofH(x) - 4, z0, x, roofH(x) - 3, z1, P.honey);
  box(frame, Math.floor(C) - 1, ridge - 5, OZ - 1, Math.ceil(C) + 1, ridge - 3, OZ + D, P.honey); // ridge beam
  for (const [z0, z1] of [[fz0, fz0 + 1], [fz1 - 1, fz1]]) {
    box(frame, Math.floor(C), EAVE_Y + 2, z0, Math.ceil(C), ridge - 5, z1, P.honey); // king post
    for (let x = OX; x < OX + W; x++) if (roofH(x) - 3 >= 60) box(frame, x, 58, z0, x, 59, z1, P.honey); // collar tie
    // Diagonal braces from the tie beam up to the king post: the A-frame look of the gable.
    for (let t = 0; t <= 14; t++) {
      box(frame, Math.floor(C) - 16 + t, EAVE_Y + 2 + t, z0, Math.floor(C) - 16 + t, EAVE_Y + 2 + t, z1, P.honey);
      box(frame, Math.ceil(C) + 16 - t, EAVE_Y + 2 + t, z0, Math.ceil(C) + 16 - t, EAVE_Y + 2 + t, z1, P.honey);
    }
  }

  // ---- Chimney: stone blocks on the -x side, a wider firebox at the bottom, a capped top. -------
  const chimney = model();
  const chx0 = OX - 10;
  const chx1 = OX - 2;
  const chz0 = OZ + 52;
  const chz1 = OZ + 62;
  const chTop = ridge + 6;
  box(chimney, chx0 - 1, chTop - 2, chz0 - 1, chx1 + 1, chTop, chz1 + 1, (x, y, z) =>
    y === chTop && x > chx0 && x < chx1 && z > chz0 && z < chz1 ? P.soot : y === chTop - 2 ? MORTAR : P.stoneLight,
  );
  box(chimney, chx0 - 1, 0, chz0 - 1, chx1, WALL0 + 8, chz1 + 1, stone); // firebox base
  box(chimney, chx0 - 1, WALL0 + 9, chz0 - 1, chx1, WALL0 + 9, chz1 + 1, P.stoneLight); // its sloped shoulder
  box(chimney, chx0, 0, chz0, chx1, chTop - 3, chz1, stone);

  // ---- Glass (glows at night). Claimed before the walls so the walls leave the openings. --------
  const glassWalls = model();
  const windows: { axis: 'x' | 'z'; at: [number, number]; u0: number; v0: number; w: number; h: number }[] = [
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: 18, v0: WALL0 + 9, w: 10, h: 15 }, // front left
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: 60, v0: WALL0 + 9, w: 10, h: 15 }, // front right
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: Math.floor(C) - 6, v0: EAVE_Y + 5, w: 14, h: 11 }, // gable
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: Math.floor(C) - 2, v0: 62, w: 5, h: 4 }, // attic
    { axis: 'z', at: [OZ, OZ + 1], u0: Math.floor(C) - 7, v0: WALL0 + 9, w: 14, h: 14 }, // back
    { axis: 'x', at: [OX + W - 2, OX + W - 1], u0: OZ + 14, v0: WALL0 + 9, w: 12, h: 14 }, // +x side
    { axis: 'x', at: [OX + W - 2, OX + W - 1], u0: OZ + 46, v0: WALL0 + 9, w: 12, h: 14 },
    { axis: 'x', at: [OX, OX + 1], u0: OZ + 40, v0: WALL0 + 9, w: 10, h: 14 }, // -x side
  ];
  // Window frames and cross mullions are honey; they're claimed first so the glass fills around them.
  const trim = model();
  for (const win of windows) {
    const { u0, v0, w, h } = win;
    const mu = u0 + Math.floor(w / 2);
    const mv = v0 + Math.floor(h / 2);
    for (let v = v0 - 1; v <= v0 + h; v++)
      for (let u = u0 - 1; u <= u0 + w; u++) {
        const border = u === u0 - 1 || u === u0 + w || v === v0 - 1 || v === v0 + h;
        const mullion = (u === mu && w > 6) || (v === mv && h > 6);
        for (const a of win.at) {
          const [x, z] = win.axis === 'z' ? [u, a] : [a, u];
          if (border || mullion) put(trim, x, v, z, P.honey);
          else put(glassWalls, x, v, z, 0xffffff);
        }
      }
    // A sill under each window and a lintel over it, both sticking out.
    const out = win.at[1] + 1 === OZ + D || win.at[1] + 1 === OX + W ? win.at[1] + 1 : win.at[0] - 1;
    for (let u = u0 - 2; u <= u0 + w + 1; u++) {
      const [x, z] = win.axis === 'z' ? [u, out] : [out, u];
      put(trim, x, v0 - 2, z, P.honeyLight);
      put(trim, x, v0 + h + 1, z, P.walnutDark);
    }
  }
  // Front door: vertical planks, a honey frame, a little window and a brass handle.
  for (let y = WALL0; y <= DOOR_TOP; y++)
    for (let x = dx0 - 1; x <= dx1 + 1; x++)
      for (const z of [OZ + D - 2, OZ + D - 1]) {
        const edge = x === dx0 - 1 || x === dx1 + 1 || y === DOOR_TOP;
        if (edge) put(trim, x, y, z, P.honey);
        else if (y >= DOOR_TOP - 8 && y <= DOOR_TOP - 4 && x >= dx0 + 2 && x <= dx1 - 2) put(glassWalls, x, y, z, 0xffffff);
        else if (x === dx1 - 1 && (y === WALL0 + 11 || y === WALL0 + 12) && z === front) put(trim, x, y, z, P.brass);
        else if (y === WALL0 + 5 || y === DOOR_TOP - 11) put(trim, x, y, z, P.honey); // cross battens
        else put(trim, x, y, z, x % 3 === 0 ? P.walnutDark : P.barkDark);
      }

  // ---- Walls: board-and-batten, dark boards with darker battens, up to the roof line. ------------
  const walls = model();
  const board = (u: number) => (u % 6 === 0 ? P.walnutDark : hash3(Math.floor(u / 6), 5, 9) < 0.5 ? P.walnut : P.bark);
  for (let x = OX; x < OX + W; x++) {
    const top = roofH(x) - 3;
    box(walls, x, WALL0, OZ, x, top, OZ + 1, () => board(x)); // back gable
    box(walls, x, WALL0, OZ + D - 2, x, top, OZ + D - 1, () => board(x)); // front gable
  }
  for (const x0 of [OX, OX + W - 2]) box(walls, x0, WALL0, OZ, x0 + 1, roofH(x0) - 3, OZ + D - 1, (_x, _y, z) => board(z));
  // Window trim belongs with the walls stage.
  for (let i = 0; i < trim.grid.data.length; i++) if (trim.grid.data[i]) walls.grid.data[i] = trim.grid.data[i];

  // ---- Roof: slate shingles with honey bargeboards and a dormer on the +x side. -----------------
  const roof = model();
  const glassRoof = model();
  const dz = OZ + 40;
  const dxFront = Math.floor(C) + 26;
  // Shingles: small staggered tiles, two voxels down the slope by three along it, each a flat shade
  // only a touch off the base slate, so the plane has texture but no stripes, seams or blotches.
  const SLATE_TONES = [tint(P.slate, -0.1), P.slate, P.slate, tint(P.slate, 0.08)];
  const shingle = (x: number, z: number) => {
    const course = Math.floor((HALF_SPAN - Math.abs(x - C)) / 2);
    const tile = Math.floor((z + (course % 2) * 1.5) / 3);
    return SLATE_TONES[Math.floor(hash3(course, tile, x < C ? 1 : 2) * SLATE_TONES.length)];
  };
  // Dormer first, so the main roof flows around it.
  const dTop = EAVE_Y + 20;
  const dWin = roofH(dxFront) + 2;
  for (let o = -9; o <= 9; o++) {
    const h2 = dTop + Math.round((9 - Math.abs(o)) * 0.9);
    // Its little gable roof: shingles, with a honey bargeboard along the front edge.
    for (let x = Math.floor(C) + 4; x <= dxFront + 2; x++)
      box(roof, x, h2 - 2, dz + o, x, h2, dz + o, (_x, y) =>
        x >= dxFront + 1 && y < h2 ? P.honey : SLATE_TONES[Math.floor(hash3(Math.abs(o) >> 1, Math.floor(x / 3), 7) * SLATE_TONES.length)],
      );
  }
  for (let o = -7; o <= 7; o++)
    for (let y = roofH(dxFront) - 3; y <= dTop - 3; y++) {
      const win = Math.abs(o) <= 3 && y >= dWin && y <= dWin + 6;
      const frameCell = Math.abs(o) === 4 || y === dWin - 1 || y === dWin + 7;
      if (win && o !== 0 && y !== dWin + 3) put(glassRoof, dxFront, y, dz + o, 0xffffff);
      else put(roof, dxFront, y, dz + o, win || (frameCell && Math.abs(o) <= 4) ? P.honey : board(dz + o + 3));
      for (let x = Math.floor(C) + 6; x < dxFront; x++) put(roof, x, y, dz + o, P.walnut);
    }
  for (let z = OZ - 4; z < OZ + D + 4; z++)
    for (let x = OX - 4; x < OX + W + 4; x++) {
      const h = roofH(x);
      const edgeZ = z <= OZ - 3 || z >= OZ + D + 2;
      const eave = x <= OX - 4 || x >= OX + W + 3;
      for (let y = h - 2; y <= h; y++) {
        const d = Math.abs(x - C);
        let col: number = shingle(x, z);
        if (edgeZ && y < h) col = P.honey; // bargeboard: a solid diagonal board along each gable
        if (eave && y < h) col = P.walnutDark; // fascia along the eaves
        if (d < 1.5 && y >= h - 1) col = P.slateDark; // ridge cap
        put(roof, x, y, z, col);
      }
    }
  // Rafter tails poking out under the eaves.
  for (let z = OZ; z < OZ + D; z += 8)
    for (const [x0, x1] of [[OX - 3, OX - 1], [OX + W, OX + W + 2]])
      for (let x = x0; x <= x1; x++) box(roof, x, roofH(x) - 4, z, x, roofH(x) - 3, z + 1, P.honey);

  // ---- Footing (stone foundation) and floor. -------------------------------------------------------
  const footing = model();
  box(footing, OX - 1, 0, OZ - 1, OX + W, BASE - 1, OZ + D, stone);
  const floor = model();
  box(floor, OX, BASE, OZ, OX + W - 1, BASE + 1, OZ + D - 1, (x) => (x % 4 === 3 ? P.walnut : P.honey));

  // ---- Porch, steps, lanterns, plantings and woodpile. --------------------------------------
  const porch = model();
  const glassPorch = model();
  const pz0 = OZ + D + 1;
  const pz1 = pz0 + 22;
  const px0 = OX - 2;
  const px1 = OX + W + 1;
  const gap0 = Math.floor(C) - 7;
  const gap1 = Math.floor(C) + 8;
  const DECK = WALL0; // standing height on the porch
  // Lanterns either side of the door.
  for (const lx of [dx0 - 4, dx1 + 3]) {
    box(porch, lx, DECK + 17, pz0, lx + 1, DECK + 17, pz0 + 1, P.walnutDark);
    box(porch, lx, DECK + 22, pz0, lx + 1, DECK + 22, pz0 + 1, P.walnutDark);
    box(glassPorch, lx, DECK + 18, pz0, lx + 1, DECK + 21, pz0 + 1, 0xffffff);
  }
  // Railings: thick honey posts with dark caps, a top and bottom rail, and balusters between.
  const RAIL = DECK + 10;
  const railAt = (x: number, z: number) => {
    const side = x <= px0 + 1 || x >= px1 - 1;
    const atFront = z >= pz1 - 1;
    if (atFront && x >= gap0 && x <= gap1) return;
    if (!side && !atFront) return;
    const along = side ? z - pz0 : x - px0;
    const post = (side && (z - pz0) % 10 < 2) || (atFront && (x - px0) % 10 < 2) || (atFront && side) || (atFront && (x === gap0 - 1 || x === gap0 - 2 || x === gap1 + 1 || x === gap1 + 2));
    if (post) {
      box(porch, x, DECK, z, x, RAIL, z, P.honey);
      put(porch, x, RAIL + 1, z, P.walnutDark);
    } else {
      put(porch, x, RAIL, z, P.honeyLight);
      put(porch, x, RAIL - 1, z, P.honey);
      put(porch, x, DECK + 1, z, P.walnut);
      if (along % 3 === 0) box(porch, x, DECK + 2, z, x, RAIL - 2, z, P.walnut);
    }
  };
  for (let z = pz0 + 2; z <= pz1; z++) for (let x = px0; x <= px1; x++) railAt(x, z);
  box(porch, px0, BASE, pz0, px1, DECK - 1, pz1, (x) => (x % 4 === 3 ? P.walnut : P.honeyLight)); // deck
  // Stone piers under the deck, with a dark board skirt between them.
  for (const x0 of [px0, px1 - 3, gap0 - 4, gap1 + 1, Math.floor((px0 + gap0) / 2), Math.floor((gap1 + px1) / 2)])
    box(porch, x0, 0, pz1 - 3, x0 + 3, BASE - 1, pz1, stone);
  for (let x = px0; x <= px1; x++)
    for (let y = 1; y < BASE; y++) if (x % 3 !== 2) put(porch, x, y, pz1 - 1, P.walnutDark);
  // Four broad steps down from the deck, with dark stringers.
  for (let i = 0; i < 4; i++) {
    const top = BASE - 1 - i * 2;
    box(porch, gap0, 0, pz1 + 1 + i * 2, gap1, top, pz1 + 2 + i * 2, (x, y) =>
      x === gap0 || x === gap1 ? P.walnutDark : y === top ? P.honeyLight : P.honey,
    );
  }
  // Flower boxes under the two front windows, with a few blooms.
  for (const u0 of [18, 60]) {
    const z0 = OZ + D;
    const y0 = WALL0 + 4;
    box(porch, u0 - 1, y0, z0, u0 + 10, y0 + 2, z0 + 2, (x, y) => (y === y0 + 2 ? P.honey : x % 4 === 0 ? P.walnutDark : P.walnut));
    for (let x = u0; x <= u0 + 9; x++)
      for (let z = z0; z <= z0 + 2; z++) {
        const t = hash3(x, 41, z);
        put(porch, x, y0 + 3, z, t < 0.22 ? P.flowerRed : t < 0.34 ? P.flowerWhite : t < 0.42 ? P.flowerYellow : t < 0.7 ? P.leaf : P.leafLight);
        if (t > 0.78) put(porch, x, y0 + 4, z, t > 0.92 ? P.flowerPink : P.leafLight);
      }
  }
  // A bench under the right window and a crate and barrel by the left one.
  const bx0 = 58;
  const bz = pz0 + 1;
  box(porch, bx0, DECK, bz + 3, bx0 + 1, DECK + 2, bz + 3, P.walnutDark);
  box(porch, bx0 + 12, DECK, bz + 3, bx0 + 13, DECK + 2, bz + 3, P.walnutDark);
  box(porch, bx0, DECK + 3, bz, bx0 + 13, DECK + 3, bz + 3, (x) => (x % 3 === 0 ? P.honey : P.honeyLight)); // seat
  box(porch, bx0, DECK + 4, bz, bx0 + 13, DECK + 8, bz, (_x, y) => (y % 2 === 0 ? P.honey : P.walnut)); // backrest
  box(porch, 13, DECK, pz0 + 1, 19, DECK + 6, pz0 + 6, (x, y, z) =>
    x === 13 || x === 19 || y === DECK + 6 || y === DECK || z === pz0 + 6 ? P.walnut : (y + x) % 3 === 0 ? P.honey : P.honeyLight,
  );
  for (let y = DECK; y <= DECK + 9; y++)
    for (let z = pz0 + 1; z <= pz0 + 6; z++)
      for (let x = 21; x <= 26; x++) {
        if (Math.hypot(x - 23.5, z - (pz0 + 3.5)) > 3) continue;
        put(porch, x, y, z, y === DECK + 2 || y === DECK + 7 ? P.walnutDark : y === DECK + 9 ? P.barkDark : P.bark);
      }
  // Doormat in front of the door.
  box(porch, dx0, DECK, pz0, dx1, DECK, pz0 + 3, (x, _y, z) => ((x + z) % 2 === 0 ? P.mat : P.matDark));

  // Lamp post by the steps: a stone base, a dark post, an arm and a hanging lantern.
  const lpx = OX + W + 5;
  const lpz = pz1 + 4;
  box(porch, lpx - 1, 0, lpz - 1, lpx + 2, 1, lpz + 2, stone);
  box(porch, lpx, 2, lpz, lpx + 1, 34, lpz + 1, P.walnutDark);
  box(porch, lpx - 5, 33, lpz, lpx - 1, 34, lpz + 1, P.walnutDark);
  box(porch, lpx - 5, 31, lpz, lpx - 4, 32, lpz + 1, P.charcoal);
  box(glassPorch, lpx - 5, 27, lpz, lpx - 4, 30, lpz + 1, 0xffffff);
  box(porch, lpx - 5, 26, lpz, lpx - 4, 26, lpz + 1, P.charcoal);

  // Ivy climbing the front corners and the +x side, thickest near the ground and under the eaves.
  const ivy = (u: number, y: number, salt: number) => {
    const t = hash3(u, y, salt);
    return t < 0.35 ? P.leafDark : t < 0.75 ? P.leaf : P.leafLight;
  };
  const ivyAt = (dist: number, y: number, salt: number, u: number) => {
    const near = Math.max(0, 1 - dist / 7);
    const up = y > EAVE_Y - 6 ? 0.25 : 0;
    return hash3(u, y, salt + 50) < near * 0.75 + up * near;
  };
  for (let y = WALL0; y <= EAVE_Y + 2; y++) {
    for (let x = OX - 2; x <= OX + 7; x++) if (ivyAt(x - (OX - 2), y, 1, x)) put(porch, x, y, front + 1, ivy(x, y, 1));
    for (let x = OX + W - 8; x <= OX + W + 1; x++) if (ivyAt(OX + W + 1 - x, y, 2, x)) put(porch, x, y, front + 1, ivy(x, y, 2));
    for (let z = OZ + D - 10; z <= OZ + D; z++) if (ivyAt(OZ + D - z, y, 3, z)) put(porch, OX + W + 1, y, z, ivy(z, y, 3));
  }
  // Shrubs and flowers along the foundation on the +x side.
  for (let z = OZ + 2; z < OZ + D - 2; z++)
    for (let y = 0; y <= 5; y++)
      for (let x = OX + W + 1; x <= OX + W + 3; x++) {
        const clump = Math.sin(z * 0.45) * 1.6 + 3.2; // height of the shrub here
        if (y > clump - (x - (OX + W + 1)) * 0.8) continue;
        const t = hash3(x, y, z);
        put(porch, x, y, z, y >= clump - 1.5 && t < 0.18 ? (t < 0.08 ? P.flowerWhite : P.flowerPink) : t < 0.4 ? P.bushDark : P.bush);
      }

  // Woodpile against the -x wall: round logs stacked in staggered rows, ends facing out. Each end
  // shows a bark rim around a pale face with a dark pith; some logs stick out further.
  const LOG = 5; // log diameter in voxels
  const pileX1 = OX - 2;
  for (let row = 0; row < 3; row++) {
    const y0 = row * LOG;
    const shift = row % 2 ? 2 : 0;
    for (let col = -1; col * LOG + shift < 23; col++) {
      const z0 = OZ + 10 + col * LOG + shift;
      const h = hash3(row, col, 7);
      const front = OX - 9 - (h < 0.25 ? 1 : 0) + (h > 0.85 ? 1 : 0); // uneven ends
      const light = hash3(row, col, 8) < 0.5; // fresher logs have paler ends
      for (let dy = 0; dy < LOG; dy++)
        for (let dz = 0; dz < LOG; dz++) {
          const z = z0 + dz;
          if (z < OZ + 10 || z > OZ + 32) continue;
          const edgeY = dy === 0 || dy === LOG - 1;
          const edgeZ = dz === 0 || dz === LOG - 1;
          if (edgeY && edgeZ) {
            put(porch, front + 2, y0 + dy, z, P.walnutDark); // the dark gap between round logs
            continue;
          }
          const rim = edgeY || edgeZ;
          for (let x = front; x <= pileX1; x++) {
            let col: number;
            if (x === front) {
              if (rim) col = hash3(x, dy + y0, z) < 0.6 ? P.bark : P.barkDark;
              else if (dy === 2 && dz === 2) col = P.stumpRing; // pith
              else col = light ? P.honeyLight : P.stumpTop;
            } else {
              // Bark along the log: dark furrows and lighter ridges.
              col = (x + dy + z) % 3 === 0 ? P.barkDark : hash3(x >> 1, dy + y0, z) < 0.15 ? P.walnut : P.bark;
            }
            put(porch, x, y0 + dy, z, col);
          }
        }
    }
  }
  // A few split halves lying on top of the pile, pale faces up.
  for (const [z0, len] of [[OZ + 13, 6], [OZ + 24, 5]] as const)
    for (let x = OX - 8; x < OX - 8 + len; x++)
      for (let dz = 0; dz < 3; dz++) put(porch, x, 15, z0 + dz, dz === 1 ? P.stumpTop : x === OX - 8 ? P.stumpRing : P.bark);
  // A chopping stump with an axe between the woodpile and the chimney, and some kindling.
  const sx = OX - 7;
  const sz = OZ + 42;
  for (let x = sx - 2; x <= sx + 2; x++)
    for (let z = sz - 2; z <= sz + 2; z++) {
      const d = Math.hypot(x - sx, z - sz);
      if (d > 2.4) continue;
      for (let y = 0; y <= 5; y++)
        put(porch, x, y, z, y === 5 ? (d < 0.5 ? P.walnut : Math.abs(d - 1.2) < 0.4 ? P.stumpRing : d > 1.9 ? P.bark : P.stumpTop) : (x + z + y) % 3 ? P.bark : P.barkDark);
    }
  put(porch, sx, 6, sz, P.stoneLight); // axe head bitten into the stump
  put(porch, sx, 7, sz, P.charcoal);
  for (let i = 1; i <= 6; i++) put(porch, sx + Math.round(i * 0.5), 6 + i, sz + Math.round(i * 0.35), P.honey); // handle
  for (const [x, z] of [[sx + 3, sz + 2], [sx + 4, sz], [sx - 3, sz + 3], [sx + 2, sz + 4]]) put(porch, x, 0, z, P.stumpTop);
  // A little slate lean-to keeps the woodpile dry.
  for (let z = OZ + 8; z <= OZ + 34; z++)
    for (let x = OX - 11; x <= OX - 1; x++) {
      const y = 16 + Math.floor((x - (OX - 11)) / 3);
      put(porch, x, y, z, z === OZ + 8 || z === OZ + 34 ? P.honey : shingle(x, z));
    }
  for (const z of [OZ + 9, OZ + 33]) box(porch, OX - 11, 0, z, OX - 10, 15, z, P.walnutDark);

  // ---- Plot marker: stakes and string around the site. ------------------------------------------
  const plot = new VoxelModel(SX, SY, SZ, CABIN_PIVOT);
  const corners: [number, number][] = [[OX - 1, OZ - 1], [OX + W, OZ - 1], [OX + W, pz1], [OX - 1, pz1]];
  for (const [x, z] of corners) plot.box(x - 1, 0, z - 1, x, 9, z, P.honey);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz2] = corners[(i + 1) % 4];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      for (let z = Math.min(az, bz2); z <= Math.max(az, bz2); z++) plot.grid.set(x, 7, z, P.string);
  }

  return {
    solid: { footing, floor, frame, walls, chimney, roof, porch },
    glow: { walls: glassWalls, roof: glassRoof, porch: glassPorch },
    plot,
    chimneyTop: { x: (chx0 + chx1) / 2 + 0.5 - CABIN_PIVOT.x, y: chTop + 1, z: (chz0 + chz1) / 2 + 0.5 - CABIN_PIVOT.z },
    door: { x: C + 0.5 - CABIN_PIVOT.x, y: DECK, z: pz0 + 3 - CABIN_PIVOT.z },
  };
}
