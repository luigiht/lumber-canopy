import { WORLD, roadCenterX } from './world';
import { FIELD } from './field';
import { INTERIOR_SLOTS, INTERIOR_SPOTS, ROOM_NAMES, type Floor, type InteriorSlot } from './interior';

/**
 * Things the player can walk up to and use, plus the spots where finished plants are displayed.
 * Coordinates are in tiles (see config/world.ts). `spot` is where the player stands to use it and
 * `face` is the point they turn toward while working.
 */

export type StationKind =
  | 'fishing'
  | 'rocks'
  | 'compost'
  | 'potting'
  | 'workbench'
  | 'delivery'
  /** The cabin's front door (outside, once it's built). */
  | 'door'
  /** Inside: back out through the front door. */
  | 'exit'
  | 'stairsUp'
  | 'stairsDown'
  /** Inside: a spot for a plant. */
  | 'slot'
  /** Inside: the bed, to sleep until morning. */
  | 'bed'
  /** A broadleaf tree that now and then has seeds caught in its branches. */
  | 'tree'
  /** The garden field in front of the cabin. */
  | 'field';

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  /** One-line hint shown on the world marker. */
  hint: string;
  x: number;
  z: number;
  /** Quarter turns around Y for the model. */
  rot?: number;
  spot: [number, number];
  face: [number, number];
  /** Inside the cabin (interior coordinates) on this floor; outdoors when absent. */
  area?: 'inside';
  floor?: Floor;
  /** For 'slot' stations: index into DECOR_SLOTS. */
  slot?: number;
}

/** Loose stone piles: riverbanks, paths and the garden edge. Index = rock node index in saves. */
const ROCK_SPOTS: { x: number; z: number; spot: [number, number] }[] = [
  { x: 10.6, z: 5.2, spot: [11.3, 5.9] },
  { x: 6.0, z: 4.2, spot: [5.3, 4.9] },
  { x: 4.4, z: -5.6, spot: [3.7, -4.9] },
  { x: 4.6, z: 7.3, spot: [3.9, 8.0] },
  { x: -7.0, z: 0.8, spot: [-6.3, 1.5] },
];

/**
 * Broadleaf trees the player can pick seeds from: every broadleaf placed in the world. Index = seed
 * tree index in saves. The player stands a step from the trunk, on the side facing the clearing.
 */
const SEED_TREES = WORLD.placements
  .filter((p) => p.model === 'broadleaf')
  .map((p) => {
    const dx = WORLD.clearing.x - p.x;
    const dz = WORLD.clearing.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: p.x, z: p.z, spot: [p.x + (dx / d) * 0.8, p.z + (dz / d) * 0.8] as [number, number] };
  });

export const SEED_TREE_COUNT = SEED_TREES.length;

export const STATIONS: StationDef[] = [
  {
    id: 'fishing',
    kind: 'fishing',
    name: 'Fishing spot',
    hint: 'Fish floating debris from the river',
    x: 8.4,
    z: -0.35,
    spot: [8.4, -0.35],
    face: [8.4, 2.2],
  },
  ...ROCK_SPOTS.map(
    (r, i): StationDef => ({
      id: `rocks:${i}`,
      kind: 'rocks',
      name: 'Loose stones',
      hint: 'Stones the river left behind',
      x: r.x,
      z: r.z,
      spot: r.spot,
      face: [r.x, r.z],
    }),
  ),
  ...SEED_TREES.map(
    (t, i): StationDef => ({
      id: `tree:${i}`,
      kind: 'tree',
      name: 'Broadleaf tree',
      hint: 'Pick seeds caught in the branches',
      x: t.x,
      z: t.z,
      spot: t.spot,
      face: [t.x, t.z],
    }),
  ),
  {
    id: 'field',
    kind: 'field',
    name: 'Garden field',
    hint: 'Grow seeds into more seeds',
    x: FIELD.x,
    z: FIELD.z,
    spot: FIELD.spot,
    face: [FIELD.x, FIELD.z],
  },
  {
    id: 'compost',
    kind: 'compost',
    name: 'Compost heap',
    hint: 'Scoop soil for your pots',
    x: -6.2,
    z: -2.6,
    spot: [-5.5, -1.9],
    face: [-6.2, -2.6],
  },
  {
    id: 'potting',
    kind: 'potting',
    name: 'Potting table',
    hint: 'Plant seeds and cuttings',
    x: 3.5,
    z: 2.1,
    spot: [3.5, 3.0],
    face: [3.5, 2.1],
  },
  {
    id: 'workbench',
    kind: 'workbench',
    name: 'Workbench',
    hint: 'Upgrade tools and make pots',
    x: 3.5,
    z: -1.7,
    spot: [3.5, -0.8],
    face: [3.5, -1.7],
  },
  {
    id: 'delivery',
    kind: 'delivery',
    name: 'Delivery box',
    hint: 'Sell or trade your plants',
    // On the verge by the road, beside where the path meets it.
    x: roadCenterX(1.9) - 1.75,
    z: 1.9,
    spot: [roadCenterX(1.2) - 2.1, 1.2],
    face: [roadCenterX(1.9) - 1.75, 1.9],
  },
];

export interface DecorSlot {
  x: number;
  z: number;
  /** On the porch deck: only usable once the cabin is finished. */
  porch?: boolean;
  /** Inside the cabin (x/z are then unused; see the interior slot). */
  interior?: InteriorSlot;
}

/** Where finished plants go: the porch, around the cabin garden, then inside. Index = save slot. */
export const DECOR_SLOTS: DecorSlot[] = [
  { x: -2.85, z: 2.85, porch: true },
  { x: -2.25, z: 2.85, porch: true },
  { x: -0.15, z: 2.85, porch: true },
  { x: 0.45, z: 2.85, porch: true },
  { x: -3.4, z: 4.3 },
  { x: 0.7, z: 4.4 },
  { x: 1.5, z: 4.1 },
  { x: 1.9, z: -2.6 },
  { x: 1.9, z: -0.8 },
  { x: 1.9, z: 1.0 },
  { x: -4.7, z: -1.6 },
  { x: -4.7, z: 0.4 },
  { x: -4.7, z: 2.2 },
  ...INTERIOR_SLOTS.map((s) => ({ x: s.x, z: s.z, interior: s })),
];

/** Where a decor slot is, in words. */
export const slotPlace = (i: number) => {
  const s = DECOR_SLOTS[i];
  return s.interior ? ROOM_NAMES[s.interior.room] : s.porch ? 'Porch' : 'Garden';
};

/** Everything inside the cabin: the way out, the stairs and the plant spots. */
STATIONS.push(
  {
    id: 'door',
    kind: 'door',
    name: 'Cabin door',
    hint: 'Go inside',
    x: -1.2,
    z: 2.1,
    // At the foot of the porch steps, clear of the old stump.
    spot: [-1.6, 4.3],
    face: [-1.2, 2.0],
  },
  {
    id: 'exit',
    kind: 'exit',
    name: 'Front door',
    hint: 'Go outside',
    x: INTERIOR_SPOTS.door.x,
    z: 2.95,
    spot: [INTERIOR_SPOTS.door.x, INTERIOR_SPOTS.door.z],
    face: [INTERIOR_SPOTS.door.x, 3.2],
    area: 'inside',
    floor: 0,
  },
  {
    id: 'stairsUp',
    kind: 'stairsUp',
    name: 'Stairs',
    hint: 'Up to the bedroom',
    x: 3.3,
    z: 2.2,
    spot: [INTERIOR_SPOTS.stairsBottom.x, INTERIOR_SPOTS.stairsBottom.z],
    face: [3.3, 1.5],
    area: 'inside',
    floor: 0,
  },
  {
    id: 'stairsDown',
    kind: 'stairsDown',
    name: 'Stairs',
    hint: 'Down to the living room',
    x: 3.3,
    z: -0.35,
    spot: [INTERIOR_SPOTS.stairsTop.x, INTERIOR_SPOTS.stairsTop.z],
    face: [3.3, 0],
    area: 'inside',
    floor: 1,
  },
  {
    id: 'bed',
    kind: 'bed',
    name: 'Bed',
    hint: 'Sleep until morning',
    x: -1.7,
    z: -1.6,
    // Beside the bed, by the foot end, clear of the bedside table.
    spot: [-0.4, -1.5],
    face: [-1.7, -1.6],
    area: 'inside',
    floor: 1,
  },
  ...DECOR_SLOTS.flatMap((d, i): StationDef[] =>
    d.interior
      ? [
          {
            id: `slot:${i}`,
            kind: 'slot',
            name: `${ROOM_NAMES[d.interior.room]} plant spot`,
            hint: 'Place a plant here',
            x: d.interior.x,
            z: d.interior.z,
            spot: d.interior.spot,
            face: [d.interior.x, d.interior.z],
            area: 'inside',
            floor: d.interior.floor,
            slot: i,
          },
        ]
      : [],
  ),
);

export const ROCK_NODE_COUNT = ROCK_SPOTS.length;

export const stationById = (id: string) => STATIONS.find((s) => s.id === id);

/** Pots on the potting table: one per propagation slot, along the table top (offsets from its centre). */
export const TABLE_SLOTS: [number, number][] = [
  [-0.6, -0.12],
  [-0.2, -0.12],
  [0.2, -0.12],
  [0.6, -0.12],
  [-0.4, 0.18],
  [0.4, 0.18],
];

/** The taxi drives in the lane nearest the river, this far from the road's centre line. */
export const TAXI_LANE = -0.45;

/** Where the taxi stops (z along the road) and the player steps out, at the head of the path. */
export const ARRIVAL = {
  taxiStop: { x: roadCenterX(0.2) + TAXI_LANE, z: 0.2 },
  /** The taxi appears and disappears in the mist beyond the walkable area. */
  taxiFrom: -34,
  taxiTo: 34,
  spawn: { x: 11.5, z: -0.15 },
};

/** West of this x is the cabin side of the river, closed until the controls tutorial is done. */
export const GATE_X = 7.0;
