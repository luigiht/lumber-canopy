import { PALETTE as P } from '../palette';
import { VoxelModel } from '../VoxelModel';
import { hash3 } from '../rng';
import type { StageId } from '@/config/cabin';

/*
 * The starter cabin from the Misty Mountain reference, in 1/16-tile voxels: a steep slate gable roof
 * with a dormer, dark plank walls with honey timber trim, a stone chimney, a railed porch with steps
 * and a woodpile. Every build stage is its own model in one shared grid, so the stages line up and
 * can be revealed one after another. Glass is kept separate so windows can glow at night.
 */

const W = 64; // body width (x)
const D = 80; // body depth (z)
const OX = 12; // body starts here in x (room for the chimney and woodpile on -x)
const OZ = 4; // body starts here in z (room for the back roof overhang)
const SX = OX + W + 6;
const SZ = OZ + D + 32;
const SY = 90;
const C = OX + W / 2 - 0.5; // ridge line x
const HALF_SPAN = W / 2 + 4;
const RISE = 1.1;
const EAVE_Y = 34;

/** Top of the roof surface over column x. */
const roofH = (x: number) => Math.round(EAVE_Y + (HALF_SPAN - Math.abs(x - C)) * RISE);

export const CABIN_PIVOT = { x: OX + W / 2, y: 0, z: OZ + D / 2 };

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
  const box = (m: VoxelModel, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: number | ((x: number, y: number, z: number) => number)) => {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) put(m, x, y, z, typeof col === 'number' ? col : col(x, y, z));
  };
  const stone = (x: number, y: number, z: number) => {
    const t = hash3(x >> 2, y >> 2, z >> 2);
    return t < 0.33 ? P.stoneLight : t < 0.75 ? P.stone : P.stoneDark;
  };

  // ---- Timber frame first: it shows through the finished walls as honey trim. -----------------
  const frame = model();
  const fz0 = OZ - 1;
  const fz1 = OZ + D;
  for (const x0 of [OX - 1, OX + W - 2])
    for (const z0 of [fz0, fz1 - 2]) box(frame, x0, 6, z0, x0 + 2, roofH(x0 + 1) - 4, z0 + 2, P.honey); // corner posts
  for (const zm of [OZ + 20, OZ + 40, OZ + 60])
    for (const x0 of [OX - 1, OX + W - 2]) box(frame, x0, 8, zm, x0 + 2, EAVE_Y - 1, zm + 1, P.honey); // side posts
  for (const x0 of [OX - 1, OX + W - 2]) {
    box(frame, x0, 6, fz0, x0 + 2, 7, fz1, P.honey); // sill plates
    box(frame, x0, EAVE_Y, fz0, x0 + 2, EAVE_Y + 1, fz1, P.honey); // top plates
  }
  box(frame, OX, 6, fz0, OX + W - 1, 7, fz0 + 1, P.honey);
  box(frame, OX, 6, fz1 - 1, OX + W - 1, 7, fz1, P.honey);
  // Rafters along the roof line: front and back gables (proud of the wall) and three inside.
  for (const [z0, z1] of [[OZ + D - 1, OZ + D], [OZ - 1, OZ], [OZ + 20, OZ + 21], [OZ + 40, OZ + 41], [OZ + 60, OZ + 61]])
    for (let x = OX - 4; x < OX + W + 4; x++) box(frame, x, roofH(x) - 4, z0, x, roofH(x) - 3, z1, P.honey);
  const ridge = roofH(Math.floor(C));
  box(frame, Math.floor(C) - 1, ridge - 5, OZ - 1, Math.ceil(C) + 1, ridge - 3, OZ + D, P.honey); // ridge beam
  box(frame, Math.floor(C), EAVE_Y, OZ + D - 1, Math.ceil(C), ridge - 5, OZ + D, P.honey); // king post
  for (let x = OX; x < OX + W; x++) if (roofH(x) - 3 >= 52) box(frame, x, 50, OZ + D - 1, x, 51, OZ + D, P.honey); // collar tie

  // ---- Chimney: stone column on the -x side, rising above the roof. -----------------------------
  const chimney = model();
  const chx0 = OX - 10;
  const chx1 = OX - 2;
  const chz0 = OZ + 52;
  const chz1 = OZ + 62;
  const chTop = ridge + 6;
  box(chimney, chx0 - 1, chTop - 2, chz0 - 1, chx1 + 1, chTop, chz1 + 1, (x, y, z) =>
    y === chTop && x > chx0 && x < chx1 && z > chz0 && z < chz1 ? P.soot : P.stoneDark,
  );
  box(chimney, chx0, 0, chz0, chx1, chTop - 3, chz1, stone);

  // ---- Glass (glows at night). Claimed before the walls so the walls leave the openings. --------
  const glassWalls = model();
  const windows: { axis: 'x' | 'z'; at: [number, number]; u0: number; v0: number; w: number; h: number }[] = [
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: 22, v0: 14, w: 10, h: 12 }, // front left
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: 56, v0: 14, w: 10, h: 12 }, // front right
    { axis: 'z', at: [OZ + D - 2, OZ + D - 1], u0: 39, v0: 40, w: 10, h: 12 }, // gable
    { axis: 'z', at: [OZ, OZ + 1], u0: 38, v0: 14, w: 12, h: 12 }, // back
    { axis: 'x', at: [OX + W - 2, OX + W - 1], u0: OZ + 16, v0: 14, w: 10, h: 12 }, // +x side
    { axis: 'x', at: [OX + W - 2, OX + W - 1], u0: OZ + 46, v0: 14, w: 10, h: 12 },
    { axis: 'x', at: [OX, OX + 1], u0: OZ + 36, v0: 14, w: 10, h: 12 }, // -x side
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
        const mullion = u === mu || v === mv;
        for (const a of win.at) {
          const [x, z] = win.axis === 'z' ? [u, a] : [a, u];
          if (border || mullion) put(trim, x, v, z, P.honey);
          else put(glassWalls, x, v, z, 0xffffff);
        }
      }
    // Sill sticking out under each window.
    const out = win.at[1] + 1 === OZ + D || win.at[1] + 1 === OX + W ? win.at[1] + 1 : win.at[0] - 1;
    for (let u = u0 - 2; u <= u0 + w + 1; u++) {
      const [x, z] = win.axis === 'z' ? [u, out] : [out, u];
      put(trim, x, v0 - 2, z, P.honey);
    }
  }
  // Front door with a honey frame and a little window.
  const dx0 = Math.floor(C) - 4;
  const dx1 = dx0 + 9;
  for (let y = 6; y <= 31; y++)
    for (let x = dx0 - 1; x <= dx1 + 1; x++)
      for (const z of [OZ + D - 2, OZ + D - 1]) {
        const edge = x === dx0 - 1 || x === dx1 + 1 || y === 31;
        if (edge) put(trim, x, y, z, P.honey);
        else if (y >= 22 && y <= 26 && x >= dx0 + 2 && x <= dx1 - 2) put(glassWalls, x, y, z, 0xffffff);
        else put(trim, x, y, z, x % 3 === 0 ? P.walnutDark : P.barkDark);
      }

  // ---- Walls: dark planks up to the roof line. ---------------------------------------------------
  const walls = model();
  const plank = (_x: number, y: number) => (y % 4 === 0 ? P.walnutDark : P.walnut);
  for (let x = OX; x < OX + W; x++) {
    const top = roofH(x) - 3;
    box(walls, x, 6, OZ, x, top, OZ + 1, plank); // back gable
    box(walls, x, 6, OZ + D - 2, x, top, OZ + D - 1, plank); // front gable
  }
  for (const x0 of [OX, OX + W - 2]) box(walls, x0, 6, OZ, x0 + 1, roofH(x0) - 3, OZ + D - 1, plank);
  // Window trim belongs with the walls stage.
  for (let i = 0; i < trim.grid.data.length; i++) if (trim.grid.data[i]) walls.grid.data[i] = trim.grid.data[i];

  // ---- Roof: slate shingles with honey bargeboards and a dormer on the +x side. -----------------
  const roof = model();
  const glassRoof = model();
  const dz = OZ + 40;
  const dxFront = Math.floor(C) + 26;
  // Dormer first, so the main roof flows around it.
  const dTop = 54;
  for (let o = -9; o <= 9; o++) {
    const h2 = dTop + Math.round((9 - Math.abs(o)) * 0.9);
    for (let x = Math.floor(C) + 4; x <= dxFront + 2; x++) box(roof, x, h2 - 2, dz + o, x, h2, dz + o, Math.abs(o) % 3 === 0 ? P.slateDark : P.slate);
  }
  for (let o = -7; o <= 7; o++)
    for (let y = roofH(dxFront) - 3; y <= dTop - 3; y++) {
      const win = Math.abs(o) <= 3 && y >= 44 && y <= 50;
      const frameCell = Math.abs(o) === 4 || y === 43 || y === 51;
      if (win && o !== 0) put(glassRoof, dxFront, y, dz + o, 0xffffff);
      else put(roof, dxFront, y, dz + o, win || (frameCell && Math.abs(o) <= 4) ? P.honey : y % 4 === 0 ? P.walnutDark : P.walnut);
      for (let x = Math.floor(C) + 6; x < dxFront; x++) put(roof, x, y, dz + o, P.walnut);
    }
  for (let z = OZ - 4; z < OZ + D + 4; z++)
    for (let x = OX - 4; x < OX + W + 4; x++) {
      const h = roofH(x);
      const edgeZ = z <= OZ - 3 || z >= OZ + D + 2;
      for (let y = h - 2; y <= h; y++) {
        const d = Math.abs(x - C);
        let col: number = d % 4 < 1 ? P.slateDark : P.slate;
        if (edgeZ && y === h - 2) col = P.honey; // bargeboard along the gable edge
        if (d < 1.5 && y === h) col = P.walnutDark; // ridge cap
        put(roof, x, y, z, col);
      }
    }

  // ---- Footing and floor. ------------------------------------------------------------------------
  const footing = model();
  box(footing, OX - 1, 0, OZ - 1, OX + W, 3, OZ + D, stone);
  const floor = model();
  box(floor, OX, 4, OZ, OX + W - 1, 5, OZ + D - 1, (x) => (x % 4 === 3 ? P.walnut : P.honey));

  // ---- Porch, steps, lanterns and woodpile. ---------------------------------------------------
  const porch = model();
  const glassPorch = model();
  const pz0 = OZ + D + 1;
  const pz1 = pz0 + 22;
  const px0 = OX - 2;
  const px1 = OX + W + 1;
  const gap0 = Math.floor(C) - 7;
  const gap1 = Math.floor(C) + 8;
  // Lanterns either side of the door.
  for (const lx of [dx0 - 5, dx1 + 4]) {
    box(porch, lx, 23, pz0, lx + 1, 23, pz0 + 1, P.walnutDark);
    box(porch, lx, 28, pz0, lx + 1, 28, pz0 + 1, P.walnutDark);
    box(glassPorch, lx, 24, pz0, lx + 1, 27, pz0 + 1, 0xffffff);
  }
  // Railing posts and rails (with a gap for the steps).
  const railAt = (x: number, z: number) => {
    const side = x <= px0 + 1 || x >= px1 - 1;
    const front = z >= pz1 - 1;
    if (front && x >= gap0 && x <= gap1) return;
    if (!side && !front) return;
    const post = (side && (z - pz0) % 10 < 2) || (front && (x - px0) % 10 < 2) || (front && side);
    if (post) box(porch, x, 6, z, x, 15, z, P.walnutDark);
    else {
      put(porch, x, 15, z, P.honey);
      put(porch, x, 10, z, P.walnut);
    }
  };
  for (let z = pz0 + 2; z <= pz1; z++) for (let x = px0; x <= px1; x++) railAt(x, z);
  box(porch, px0, 4, pz0, px1, 5, pz1, (x) => (x % 4 === 3 ? P.walnut : P.honeyLight)); // deck
  for (const x0 of [px0, px1 - 2, gap0 - 3, gap1 + 1]) box(porch, x0, 0, pz1 - 2, x0 + 2, 3, pz1, P.walnutDark); // piers
  box(porch, gap0, 2, pz1 + 1, gap1, 3, pz1 + 4, P.honey); // steps
  box(porch, gap0, 0, pz1 + 5, gap1, 1, pz1 + 8, P.honey);
  // Woodpile against the -x wall: log ends facing out.
  for (let z = OZ + 10; z <= OZ + 32; z++)
    for (let y = 0; y <= 13; y++) {
      const row = Math.floor(y / 4);
      const cz = OZ + 10 + ((z - OZ - 10 + (row % 2) * 2) % 4);
      const ring = Math.hypot(((z - OZ - 10 + (row % 2) * 2) % 4) - 1.5, (y % 4) - 1.5);
      void cz;
      for (let x = OX - 9; x <= OX - 2; x++) put(porch, x, y, z, x === OX - 9 ? (ring < 1.2 ? P.stumpTop : P.stumpRing) : P.bark);
    }

  // ---- Plot marker: stakes and string around the site. ------------------------------------------
  const plot = new VoxelModel(SX, SY, SZ, CABIN_PIVOT);
  const corners: [number, number][] = [[OX - 1, OZ - 1], [OX + W, OZ - 1], [OX + W, pz1], [OX - 1, pz1]];
  for (const [x, z] of corners) plot.box(x - 1, 0, z - 1, x, 9, z, P.honey);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) plot.grid.set(x, 7, z, P.string);
  }

  return {
    solid: { footing, floor, frame, walls, chimney, roof, porch },
    glow: { walls: glassWalls, roof: glassRoof, porch: glassPorch },
    plot,
    chimneyTop: { x: (chx0 + chx1) / 2 + 0.5 - CABIN_PIVOT.x, y: chTop + 1, z: (chz0 + chz1) / 2 + 0.5 - CABIN_PIVOT.z },
    door: { x: C + 0.5 - CABIN_PIVOT.x, y: 6, z: pz0 + 3 - CABIN_PIVOT.z },
  };
}
