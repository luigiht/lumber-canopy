/**
 * The cabin interior, shown as a cutaway once the cabin is built. It's its own little scene centred
 * on the origin (the outdoors is hidden while you're inside). Units are tiles.
 *
 *   Ground floor (y = FLOOR_Y[0]): living room on the left (x < KITCHEN_X), kitchen on the right,
 *   stairs along the right wall up to the bedroom loft over the back half (z < LOFT_EDGE_Z).
 *   The default camera looks from the front-right (+x, +z), so the back and left walls stay up.
 */

export type Floor = 0 | 1;
export type Room = 'living' | 'kitchen' | 'bedroom';

export const ROOM_NAMES: Record<Room, string> = { living: 'Living room', kitchen: 'Kitchen', bedroom: 'Bedroom' };

export const INTERIOR = {
  /** Inside faces of the outer walls: a roomy 10 × 8 tile open plan. */
  minX: -5,
  maxX: 5,
  minZ: -4,
  maxZ: 4,
  wallThickness: 0.25,
  /** Top of the outer walls; the gable ends rise higher to the roof peak (see `gableHeight`). */
  wallHeight: 6.5,
  /** Extra height of the back gable's triangle above the wall, under the roof beams. */
  gableHeight: 3,
  /** Standing height of each floor. */
  floorY: [0.25, 3.25] as const,
  /** The loft covers the back half: z from minZ to here. */
  loftEdgeZ: 0,
  /** Living room left of this, kitchen right of it. */
  kitchenX: 1.2,
  /** Stairs run along the right wall, rising from the front (z = stairs.z1) to the loft edge. */
  stairs: { x0: 3.85, x1: 4.9, z0: 0, z1: 3.0, steps: 12 },
  /** Front door opening in the +z wall. */
  door: { x0: -1.7, x1: -0.7, height: 2.2 },
};

export interface Block {
  floor: Floor;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Furniture footprints the player walks around. */
export const FURNITURE_BLOCKS: Block[] = [
  // Living room
  { floor: 0, minX: -3.65, maxX: -1.35, minZ: -4, maxZ: -3.05 }, // sofa
  { floor: 0, minX: -3.15, maxX: -1.85, minZ: -1.85, maxZ: -1.1 }, // coffee table
  { floor: 0, minX: -5, maxX: -3.95, minZ: -0.3, maxZ: 1.7 }, // stone fireplace
  { floor: 0, minX: -1.0, maxX: -0.1, minZ: 0.9, maxZ: 1.8 }, // armchair
  { floor: 0, minX: -0.75, maxX: 0.05, minZ: -4, maxZ: -3.55 }, // bookshelf
  { floor: 0, minX: -4.75, maxX: -4.25, minZ: 2.9, maxZ: 3.4 }, // side table
  // Kitchen
  { floor: 0, minX: 1.45, maxX: 4.95, minZ: -4, maxZ: -3.35 }, // counter
  { floor: 0, minX: 1.6, maxX: 3.0, minZ: 0.4, maxZ: 1.3 }, // table
  { floor: 0, minX: 2.0, maxX: 2.6, minZ: -0.2, maxZ: 0.3 }, // chair
  { floor: 0, minX: 2.0, maxX: 2.6, minZ: 1.4, maxZ: 1.9 }, // chair
  { floor: 0, minX: 3.85, maxX: 5, minZ: 0, maxZ: 2.85 }, // stairs (the bottom step is the way up)
  // Bedroom loft
  { floor: 1, minX: -5, maxX: -4.5, minZ: -3.95, maxZ: -1.95 }, // low bookshelf on the left wall
  { floor: 1, minX: -3.2, maxX: -1.2, minZ: -4, maxZ: -1.85 }, // bed (walkway between it and the bookshelf)
  { floor: 1, minX: -3.97, maxX: -3.33, minZ: -4, maxZ: -3.35 }, // left nightstand
  { floor: 1, minX: -1.05, maxX: -0.35, minZ: -4, maxZ: -3.35 }, // right nightstand
  { floor: 1, minX: 1.65, maxX: 3.15, minZ: -4, maxZ: -3.45 }, // sideboard under the back window
  { floor: 1, minX: 3.35, maxX: 5, minZ: -4, maxZ: -3.4 }, // wardrobe in the back-right corner
  { floor: 1, minX: 0.3, maxX: 1.2, minZ: -1.6, maxZ: -0.7 }, // reading chair
];

/** Where the stairs and the door are used from, per floor. */
export const INTERIOR_SPOTS = {
  stairsBottom: { x: 4.35, z: 3.35, floor: 0 as Floor },
  stairsTop: { x: 4.35, z: -0.65, floor: 1 as Floor },
  door: { x: -1.2, z: 3.5, floor: 0 as Floor },
};

export interface InteriorSlot {
  room: Room;
  floor: Floor;
  x: number;
  z: number;
  /** Height of the surface the pot sits on (floor, counter, table, nightstand). */
  y: number;
  /** Where the player stands to place or pick up the plant. */
  spot: [number, number];
}

const [G, L] = INTERIOR.floorY;

/** Plant placeholders: three per room downstairs, four in the bedroom (two on the bookshelf, one on the sideboard). */
export const INTERIOR_SLOTS: InteriorSlot[] = [
  { room: 'living', floor: 0, x: -4.6, z: -3.6, y: G, spot: [-4.3, -2.7] },
  { room: 'living', floor: 0, x: -4.6, z: 3.6, y: G, spot: [-3.8, 3.3] },
  { room: 'living', floor: 0, x: 0.6, z: -3.0, y: G, spot: [0.6, -2.3] },
  { room: 'kitchen', floor: 0, x: 2.0, z: -3.7, y: G + 15 / 16, spot: [2.0, -2.9] },
  { room: 'kitchen', floor: 0, x: 2.3, z: 0.85, y: G + 12 / 16, spot: [1.2, 0.85] },
  { room: 'kitchen', floor: 0, x: 4.6, z: -2.7, y: G, spot: [4.1, -2.7] },
  { room: 'bedroom', floor: 1, x: -4.6, z: -1.3, y: L, spot: [-4.0, -1.3] },
  // On top of the low bookshelf, either side of the record player.
  { room: 'bedroom', floor: 1, x: -4.78, z: -3.55, y: L + 18 / 16, spot: [-4.1, -3.45] },
  // On the sideboard under the back window.
  { room: 'bedroom', floor: 1, x: 2.4, z: -3.72, y: L + 12 / 16, spot: [2.4, -2.95] },
  { room: 'bedroom', floor: 1, x: -4.78, z: -2.35, y: L + 18 / 16, spot: [-4.1, -2.35] },
];

/** Is (x,z) open floor on this level (inside the walls, off the furniture)? */
export function interiorWalkable(floor: Floor, x: number, z: number) {
  const { minX, maxX, minZ, maxZ, loftEdgeZ } = INTERIOR;
  const pad = 0.15;
  if (x < minX + pad || x > maxX - pad || z < minZ + pad) return false;
  if (z > (floor === 0 ? maxZ - pad : loftEdgeZ - pad)) return false;
  return !FURNITURE_BLOCKS.some((b) => b.floor === floor && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
}
