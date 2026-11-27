import { PALETTE as P } from '../palette';
import { VoxelModel, shades } from '../VoxelModel';
import { hash3 } from '../rng';

/* Voxel models for the cabin interior (1 voxel = 1/16 tile). Each is pivoted at the centre of its
 * footprint on the floor, unless noted. Colours are kept local so the inside reads warm and cosy. */

const C = {
  plank: 0xb98552,
  plankLight: 0xcf9a62,
  plankDark: 0x936338,
  plankSeam: 0x6e4527,
  wall: 0x8f5d36,
  wallLight: 0xa56d40,
  wallDark: 0x744a2a,
  trim: P.honey,
  glass: 0x9cc9e0,
  glassLight: 0xd3ecf6,
  tile: 0xd8d2c4,
  tileDark: 0x9f9a8e,
  rust: 0xa5523a,
  rustDark: 0x7c3a28,
  rustLight: 0xc46c4e,
  teal: 0x4d7a76,
  tealDark: 0x365956,
  cream: 0xeee3c8,
  creamDark: 0xd2c4a0,
  iron: 0x34363c,
  ironLight: 0x51545c,
  fire: 0xffa040,
  fireHot: 0xffd27a,
  white: 0xf2efe6,
  blanket: 0x5b7aa6,
  blanketDark: 0x405d86,
  book: [0x9c3b2e, 0x3f6a8a, 0xc49a3a, 0x4f7a3a, 0x6b4a8a],
};

const T = 16; // voxels per tile

// ---- Structure ------------------------------------------------------------------------------

/** Ground floor: wide planks in the living room, stone tiles in the kitchen. */
export function groundFloor(kitchenFromX: number): VoxelModel {
  const m = new VoxelModel(8 * T, 4, 6 * T);
  m.box(0, 0, 0, 8 * T - 1, 3, 6 * T - 1, (x, _y, z) => {
    if (x >= kitchenFromX) {
      const edge = x % 8 === 0 || z % 8 === 0;
      return edge ? C.tileDark : ((x >> 3) + (z >> 3)) % 2 ? C.tile : C.creamDark;
    }
    const row = Math.floor(z / 6);
    const off = (row * 23) % 40;
    if (z % 6 === 5 || (x + off) % 40 === 0) return C.plankSeam;
    return [C.plank, C.plankLight, C.plankDark][Math.floor(hash3(Math.floor((x + off) / 40), row, 3) * 3)];
  });
  return m;
}

/** Loft floor over the back half, with beams below. The stairs arrive at its front edge. */
export function loftFloor(): VoxelModel {
  const m = new VoxelModel(8 * T, 4, 3 * T);
  m.box(0, 0, 0, 8 * T - 1, 3, 3 * T - 1, (x, y, z) => {
    if (y === 0) return x % 24 < 3 ? C.plankSeam : C.plankDark; // beams underneath
    return z % 6 === 5 ? C.plankSeam : [C.plank, C.plankLight][Math.floor(hash3(x >> 5, z >> 3, 5) * 2)];
  });
  return m;
}

/** Railing along the loft edge. Long axis along x. */
export function railing(length: number): VoxelModel {
  const m = new VoxelModel(length, 14, 2);
  for (let x = 0; x < length; x++) {
    m.box(x, 12, 0, x, 13, 1, C.trim);
    m.set(x, 6, 0, C.plankDark);
    if (x % 12 < 2 || x === length - 1) m.box(x, 0, 0, x, 11, 1, C.plankSeam);
  }
  return m;
}

/** Staircase rising toward -z: bottom step at the +z end. */
export function stairs(width: number, depth: number, rise: number, steps: number): VoxelModel {
  const m = new VoxelModel(width, rise, depth);
  for (let i = 0; i < steps; i++) {
    const zFront = Math.round(depth - (i * depth) / steps) - 1;
    const zBack = Math.round(depth - ((i + 1) * depth) / steps);
    const top = Math.round(((i + 1) * rise) / steps) - 1;
    m.box(0, 0, zBack, width - 1, top, zFront, (x, y, z) =>
      y === top ? (z === zFront ? C.plankDark : C.plankLight) : x === 0 || x === width - 1 ? C.plankSeam : C.plank,
    );
  }
  return m;
}

export interface WallOpening {
  /** Along the wall, in voxels from its start. */
  from: number;
  to: number;
  /** Height range in voxels above the floor. */
  bottom: number;
  top: number;
  door?: boolean;
}

/**
 * A plank wall, `length` long (along x), with windows and doors. Pivot at the centre of the base;
 * rotate it into place. Windows get a honey frame, glass and a cross mullion.
 */
export function wall(length: number, height: number, openings: WallOpening[]): VoxelModel {
  const m = new VoxelModel(length, height, 4);
  m.box(0, 0, 0, length - 1, height - 1, 3, (x, y) => {
    if (y % 6 === 5) return C.wallDark;
    return [C.wall, C.wallLight, C.wall][Math.floor(hash3(Math.floor((x + (Math.floor(y / 6) * 17)) / 32), Math.floor(y / 6), 9) * 3)];
  });
  // Skirting and a ceiling-height trim line.
  m.box(0, 0, 0, length - 1, 1, 3, C.plankSeam);
  for (const o of openings) {
    m.box(o.from - 1, o.bottom - 1, 0, o.to + 1, o.top + 1, 3, C.trim);
    for (let x = o.from; x <= o.to; x++)
      for (let y = o.bottom; y <= o.top; y++)
        for (let z = 0; z < 4; z++) {
          if (o.door) m.grid.clear(x, y, z);
          else {
            const mid = x === Math.floor((o.from + o.to) / 2) || y === Math.floor((o.bottom + o.top) / 2);
            if (z === 1 || z === 2) m.grid.set(x, y, z, mid ? C.trim : (x + y) % 9 === 0 ? C.glassLight : C.glass);
            else m.grid.clear(x, y, z);
          }
        }
    if (o.door) m.box(o.from - 1, 0, 0, o.to + 1, 0, 3, C.trim);
  }
  return m;
}

// ---- Furniture ------------------------------------------------------------------------------

/** Three-seat sofa; its back is on the -z side. */
export function sofa(): VoxelModel {
  const m = new VoxelModel(36, 14, 15);
  m.box(0, 0, 0, 35, 5, 14, C.rustDark);
  m.box(2, 6, 4, 33, 7, 14, (x) => (x % 11 === 0 ? C.rustDark : C.rust));
  m.box(0, 6, 0, 35, 13, 4, (x, y) => (y === 13 ? C.rustLight : x % 12 === 0 ? C.rustDark : C.rust));
  for (const x of [0, 1, 34, 35]) m.box(x, 6, 0, x, 10, 14, C.rustLight);
  m.box(4, 8, 5, 9, 11, 6, C.cream); // cushion
  m.box(26, 8, 5, 31, 11, 6, C.teal);
  return m;
}

export function coffeeTable(): VoxelModel {
  const m = new VoxelModel(20, 7, 12);
  m.box(0, 5, 0, 19, 6, 11, C.plankLight);
  for (const [x, z] of [[1, 1], [17, 1], [1, 9], [17, 9]]) m.box(x, 0, z, x + 1, 4, z + 1, C.plankSeam);
  m.box(12, 7 - 1, 4, 15, 6, 7, C.cream); // a book
  return m;
}

export function rug(w: number, d: number, main: number, border: number): VoxelModel {
  const m = new VoxelModel(w, 1, d);
  m.box(0, 0, 0, w - 1, 0, d - 1, (x, _y, z) => {
    const e = Math.min(x, z, w - 1 - x, d - 1 - z);
    if (e === 0) return border;
    if (e === 2) return C.cream;
    return (x + z) % 8 < 4 ? main : border;
  });
  return m;
}

/** Cast-iron wood stove with a glowing fire window. Back on the -x side. */
export function woodStove(): VoxelModel {
  const m = new VoxelModel(12, 14, 14);
  m.box(1, 2, 1, 11, 13, 13, C.iron);
  m.box(1, 13, 1, 11, 13, 13, C.ironLight);
  for (const [x, z] of [[1, 1], [10, 1], [1, 12], [10, 12]]) m.box(x, 0, z, x + 1, 1, z + 1, C.iron);
  m.box(11, 4, 4, 11, 9, 9, C.fire);
  m.box(11, 5, 5, 11, 7, 8, C.fireHot);
  m.box(0, 0, 0, 0, 0, 13, C.tileDark);
  return m;
}

export function stovePipe(height: number): VoxelModel {
  const m = new VoxelModel(4, height, 4);
  m.box(0, 0, 0, 3, height - 1, 3, (_x, y) => (y % 12 === 0 ? C.ironLight : C.iron));
  return m;
}

/** Armchair; back on the -z side. */
export function armchair(): VoxelModel {
  const m = new VoxelModel(14, 14, 14);
  m.box(0, 0, 0, 13, 5, 13, C.tealDark);
  m.box(2, 6, 4, 11, 7, 13, C.teal);
  m.box(0, 6, 0, 13, 13, 3, C.teal);
  for (const x of [0, 1, 12, 13]) m.box(x, 6, 0, x, 10, 13, C.tealDark);
  return m;
}

/** Bookshelf with rows of coloured books; back on the -z side. */
export function bookshelf(): VoxelModel {
  const m = new VoxelModel(13, 36, 7);
  m.box(0, 0, 0, 12, 35, 6, C.plankDark);
  for (const y0 of [2, 11, 20, 29]) {
    m.box(1, y0, 1, 11, y0 + 6, 6, C.plankSeam);
    for (let x = 1; x <= 11; x++) {
      const h = 4 + Math.floor(hash3(x, y0, 1) * 3);
      if (hash3(x, y0, 2) < 0.15) continue;
      m.box(x, y0, 2, x, y0 + h - 1, 6, C.book[Math.floor(hash3(x, y0, 3) * C.book.length)]);
    }
  }
  return m;
}

/** Floor lamp with a warm shade. */
export function floorLamp(): VoxelModel {
  const m = new VoxelModel(6, 30, 6);
  m.box(1, 0, 1, 4, 0, 4, C.iron);
  m.box(2, 1, 2, 3, 23, 3, C.iron);
  m.box(0, 24, 0, 5, 29, 5, C.cream);
  m.box(1, 23, 1, 4, 23, 4, C.fireHot);
  return m;
}

/** Kitchen counter along the back wall: cabinets, a sink and a little iron cooktop. Back on -z. */
export function counter(width: number): VoxelModel {
  const m = new VoxelModel(width, 15, 10);
  m.box(0, 0, 0, width - 1, 13, 9, (x, y) => (y < 1 ? C.plankSeam : x % 12 === 0 ? C.plankSeam : C.teal));
  for (let x = 2; x < width; x += 12) m.box(x + 4, 9, 9, x + 5, 9, 9, C.trim); // handles
  m.box(0, 14, 0, width - 1, 14, 9, C.plankLight);
  const sink = Math.floor(width * 0.35);
  m.box(sink, 13, 2, sink + 9, 14, 8, C.tileDark);
  m.box(sink + 1, 14, 3, sink + 8, 14, 7, C.glass);
  m.box(sink + 4, 15 - 1, 1, sink + 5, 14, 1, C.ironLight);
  const cook = width - 14;
  m.box(cook, 14, 1, cook + 11, 14, 8, C.iron);
  for (const [x, z] of [[cook + 2, 2], [cook + 7, 2], [cook + 2, 6], [cook + 7, 6]]) m.box(x, 14, z, x + 2, 14, z + 1, C.ironLight);
  return m;
}

/** Wall shelf with jars and a pot. */
export function wallShelf(width: number): VoxelModel {
  const m = new VoxelModel(width, 7, 5);
  m.box(0, 0, 0, width - 1, 0, 4, C.plankDark);
  for (let x = 2; x < width - 3; x += 6) {
    const col = [C.glass, C.creamDark, C.rust][(x / 6) % 3 | 0];
    m.box(x, 1, 1, x + 2, 4, 3, col);
    m.box(x, 5, 1, x + 2, 5, 3, C.plankSeam);
  }
  return m;
}

export function table(): VoxelModel {
  const m = new VoxelModel(22, 12, 14);
  m.box(0, 10, 0, 21, 11, 13, (x) => (x % 7 === 6 ? C.plankDark : C.plankLight));
  for (const [x, z] of [[1, 1], [19, 1], [1, 11], [19, 11]]) m.box(x, 0, z, x + 1, 9, z + 1, C.plankSeam);
  return m;
}

/** Chair facing +z (its back on -z). */
export function chair(): VoxelModel {
  const m = new VoxelModel(8, 14, 8);
  m.box(0, 6, 0, 7, 7, 7, C.plankLight);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) m.box(x, 0, z, x + 1, 5, z + 1, C.plankSeam);
  m.box(0, 8, 0, 7, 13, 1, (_x, y) => (y % 3 === 0 ? C.plankDark : C.plankLight));
  return m;
}

/** Bed with a headboard on the -z side, quilt and pillows. */
export function bed(): VoxelModel {
  const m = new VoxelModel(30, 14, 34);
  m.box(0, 0, 0, 29, 3, 33, C.plankDark);
  m.box(0, 0, 0, 29, 13, 2, (x, y) => (y === 13 || x % 10 === 0 ? C.plankSeam : C.plankDark));
  m.box(1, 4, 3, 28, 6, 32, C.white);
  m.box(1, 7, 12, 28, 7, 32, (x, _y, z) => ((x >> 2) + (z >> 2)) % 2 ? C.blanket : C.blanketDark);
  m.box(1, 4, 31, 28, 6, 32, C.blanketDark);
  m.box(3, 7, 4, 13, 9, 9, C.cream);
  m.box(16, 7, 4, 26, 9, 9, C.cream);
  return m;
}

export function nightstand(): VoxelModel {
  const m = new VoxelModel(10, 10, 10);
  m.box(0, 0, 0, 9, 9, 9, C.plankDark);
  m.box(1, 2, 9, 8, 4, 9, C.plank);
  m.box(1, 6, 9, 8, 8, 9, C.plank);
  m.box(4, 3, 9, 5, 3, 9, C.trim);
  m.box(4, 7, 9, 5, 7, 9, C.trim);
  return m;
}

/** Wardrobe with two doors; back on -z. */
export function wardrobe(): VoxelModel {
  const m = new VoxelModel(26, 36, 9);
  m.box(0, 0, 0, 25, 35, 8, C.plankDark);
  m.box(1, 2, 8, 12, 33, 8, C.plank);
  m.box(13, 2, 8, 24, 33, 8, C.plank);
  m.box(11, 16, 8, 11, 20, 8, C.trim);
  m.box(14, 16, 8, 14, 20, 8, C.trim);
  m.box(0, 35, 0, 25, 35, 8, C.plankSeam);
  return m;
}

/** Low bookshelf (waist height) packed with books in three bays; back on -z, top free for pots. */
export function lowBookshelf(length: number): VoxelModel {
  const m = new VoxelModel(length, 18, 7);
  m.box(0, 0, 0, length - 1, 16, 6, C.plankDark);
  m.box(0, 17, 0, length - 1, 17, 6, C.plankLight); // top board
  m.box(0, 0, 0, length - 1, 0, 6, C.plankSeam); // plinth
  const dividers = [0, Math.round(length / 3), Math.round((2 * length) / 3), length - 1];
  for (const [y0, y1] of [
    [2, 8],
    [10, 15],
  ]) {
    for (let b = 0; b < dividers.length - 1; b++) {
      const x0 = dividers[b] + 1;
      const x1 = dividers[b + 1] - 1;
      m.box(x0, y0, 1, x1, y1, 6, C.plankSeam); // shadowed bay
      // Books fill each bay: varied heights and colours, the odd one leaning.
      for (let x = x0; x <= x1; x++) {
        const h = y1 - y0 - Math.floor(hash3(x, y0, 7) * 3);
        const col = C.book[Math.floor(hash3(x, y0, 8) * C.book.length)];
        m.box(x, y0, 2, x, y0 + h, 6, col);
        if (hash3(x, y0, 9) < 0.25) m.set(x, y0 + h, 6, C.cream); // a light spine
      }
    }
  }
  return m;
}

/** Record player: walnut plinth, black platter with a red label, silver tonearm. */
export function recordPlayer(): VoxelModel {
  const m = new VoxelModel(10, 4, 9);
  m.box(0, 0, 0, 9, 1, 8, P.walnut);
  m.box(0, 0, 8, 9, 1, 8, P.walnutDark);
  for (let x = 0; x < 10; x++)
    for (let z = 0; z < 9; z++) {
      const d = Math.hypot(x - 3.5, z - 4);
      if (d <= 3.6) m.set(x, 2, z, d < 1 ? 0xc0392b : d > 2.2 && d < 2.8 ? 0x3a3a40 : 0x1b1a1d);
    }
  m.box(8, 2, 1, 8, 3, 1, 0xd8dade); // tonearm post
  m.box(8, 3, 2, 8, 3, 5, 0xc9ccd2); // arm
  m.box(7, 3, 5, 7, 3, 5, 0xc9ccd2); // headshell
  m.set(8, 2, 7, 0xe0b84a); // speed knob
  return m;
}

/** Small table lamp. */
export function tableLamp(): VoxelModel {
  const m = new VoxelModel(5, 9, 5);
  m.box(1, 0, 1, 3, 1, 3, C.iron);
  m.box(2, 2, 2, 2, 4, 2, C.iron);
  m.box(0, 5, 0, 4, 8, 4, C.cream);
  return m;
}

/** Empty spot waiting for a plant: a terracotta saucer with a little soil. */
export function saucer(): VoxelModel {
  const m = new VoxelModel(8, 2, 8);
  m.box(1, 0, 1, 6, 0, 6, P.terracottaDark);
  m.box(0, 1, 0, 7, 1, 7, P.terracotta);
  m.box(1, 1, 1, 6, 1, 6, P.terracottaLight);
  m.box(2, 1, 2, 5, 1, 5, P.potSoil);
  m.grid.clear(0, 1, 0);
  m.grid.clear(7, 1, 0);
  m.grid.clear(0, 1, 7);
  m.grid.clear(7, 1, 7);
  return m;
}

/** Shades for any extra trim. */
export const woodShades = shades([C.plank, C.plankLight, C.plankDark]);
