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
  /** Inside faces of the outer walls. */
  minX: -4,
  maxX: 4,
  minZ: -3,
  maxZ: 3,
  wallThickness: 0.25,
  /** Top of the outer walls. */
  wallHeight: 6,
  /** Standing height of each floor. */
  floorY: [0.25, 3.0] as const,
  /** The loft covers the back half: z from minZ to here. */
  loftEdgeZ: 0,
  /** Living room left of this, kitchen right of it. */
  kitchenX: 0.6,
  /** Stairs run along the right wall, rising from the front (z = stairs.z1) to the loft edge. */
  stairs: { x0: 2.8, x1: 3.85, z0: 0, z1: 2.6, steps: 11 },
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
  { floor: 0, minX: -3.15, maxX: -0.85, minZ: -3, maxZ: -2.05 }, // sofa
  { floor: 0, minX: -2.65, maxX: -1.35, minZ: -1.05, maxZ: -0.3 }, // coffee table
  { floor: 0, minX: -4, maxX: -3.15, minZ: 0.15, maxZ: 1.05 }, // wood stove
  { floor: 0, minX: -0.85, maxX: 0.05, minZ: 1.0, maxZ: 1.85 }, // armchair
  { floor: 0, minX: -0.35, maxX: 0.45, minZ: -3, maxZ: -2.55 }, // bookshelf
  // Kitchen
  { floor: 0, minX: 0.9, maxX: 3.95, minZ: -3, maxZ: -2.35 }, // counter
  { floor: 0, minX: 0.9, maxX: 2.3, minZ: 0.15, maxZ: 1.05 }, // table
  { floor: 0, minX: 1.3, maxX: 1.9, minZ: -0.45, maxZ: 0.05 }, // chair
  { floor: 0, minX: 1.3, maxX: 1.9, minZ: 1.15, maxZ: 1.65 }, // chair
  { floor: 0, minX: 2.8, maxX: 4, minZ: 0, maxZ: 2.45 }, // stairs (the bottom step is the way up)
  // Bedroom loft
  { floor: 1, minX: -4, maxX: -3.5, minZ: -2.95, maxZ: -0.95 }, // low bookshelf on the left wall
  { floor: 1, minX: -2.7, maxX: -0.7, minZ: -3, maxZ: -0.85 }, // bed (walkway between it and the bookshelf)
  { floor: 1, minX: -0.55, maxX: 0.15, minZ: -3, maxZ: -2.35 }, // nightstand
  { floor: 1, minX: 1.15, maxX: 2.85, minZ: -3, maxZ: -2.4 }, // wardrobe
];

/** Where the stairs and the door are used from, per floor. */
export const INTERIOR_SPOTS = {
  stairsBottom: { x: 3.3, z: 2.6, floor: 0 as Floor },
  stairsTop: { x: 3.3, z: -0.95, floor: 1 as Floor },
  door: { x: -1.2, z: 2.5, floor: 0 as Floor },
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

/** Plant placeholders: three per room downstairs, four in the bedroom (two on the bookshelf). */
export const INTERIOR_SLOTS: InteriorSlot[] = [
  { room: 'living', floor: 0, x: -3.6, z: -2.6, y: G, spot: [-3.5, -1.7] },
  { room: 'living', floor: 0, x: -3.6, z: 2.6, y: G, spot: [-3.0, 2.2] },
  { room: 'living', floor: 0, x: 0.25, z: -2.0, y: G, spot: [0.25, -1.35] },
  { room: 'kitchen', floor: 0, x: 1.3, z: -2.7, y: G + 15 / 16, spot: [1.3, -1.9] },
  { room: 'kitchen', floor: 0, x: 1.6, z: 0.6, y: G + 12 / 16, spot: [0.6, 0.6] },
  { room: 'kitchen', floor: 0, x: 3.6, z: -1.7, y: G, spot: [3.1, -1.7] },
  { room: 'bedroom', floor: 1, x: -3.6, z: -0.45, y: L, spot: [-3.0, -0.45] },
  // On top of the low bookshelf, either side of the record player.
  { room: 'bedroom', floor: 1, x: -3.78, z: -2.55, y: L + 18 / 16, spot: [-3.1, -2.45] },
  { room: 'bedroom', floor: 1, x: 3.6, z: -2.6, y: L, spot: [3.3, -1.85] },
  { room: 'bedroom', floor: 1, x: -3.78, z: -1.35, y: L + 18 / 16, spot: [-3.1, -1.35] },
];

/** Is (x,z) open floor on this level (inside the walls, off the furniture)? */
export function interiorWalkable(floor: Floor, x: number, z: number) {
  const { minX, maxX, minZ, maxZ, loftEdgeZ } = INTERIOR;
  const pad = 0.15;
  if (x < minX + pad || x > maxX - pad || z < minZ + pad) return false;
  if (z > (floor === 0 ? maxZ - pad : loftEdgeZ - pad)) return false;
  return !FURNITURE_BLOCKS.some((b) => b.floor === floor && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
}
