import type { ModelFactory } from '../VoxelModel';
import { pine, broadleaf, bush } from './trees';
import { boulderCluster, smallBoulders, pebble, stump, logPile, grassTuft, flowerTuft, bridge } from './ground';

export interface ModelDef {
  factory: ModelFactory;
  /** How many seeded variants to generate; instances pick one each. */
  variants: number;
  castShadow: boolean;
  /** World size of one voxel; defaults to 1/16 tile. Distant LOD models use bigger voxels. */
  voxelSize?: number;
  /** Horizontal reach from the anchor (canopy radius for trees), in tiles. Keeps props off structures. */
  clearance: number;
  /** Structures (bridge, later the cabin) claim their whole footprint; nothing may overlap it. */
  structure?: boolean;
  /** Radius the lumberjack can't walk into, in tiles (0 or absent: walk through, like grass). */
  collide?: number;
}

/** Registry of every prop model. World config refers to these by key. */
export const MODELS = {
  pine: { factory: pine, variants: 5, castShadow: true, clearance: 0.95, collide: 0.75 },
  /** Full-detail pine for the forest just outside the play area (no shadows, to save the shadow pass). */
  pineOuter: { factory: pine, variants: 5, castShadow: false, clearance: 0.95, collide: 0.75 },
  /** Half-resolution pine for the misty far forest. */
  pineFar: { factory: (r) => pine(r, 8), variants: 4, castShadow: false, clearance: 0.95, voxelSize: 1 / 8 },
  broadleaf: { factory: broadleaf, variants: 3, castShadow: true, clearance: 1.3, collide: 0.35 },
  bush: { factory: bush, variants: 4, castShadow: true, clearance: 0.55, collide: 0.4 },
  boulders: { factory: (r) => boulderCluster(r), variants: 3, castShadow: true, clearance: 1.0, collide: 0.95 },
  smallBoulders: { factory: smallBoulders, variants: 3, castShadow: true, clearance: 0.6, collide: 0.55 },
  pebble: { factory: pebble, variants: 4, castShadow: false, clearance: 0.25 },
  stump: { factory: stump, variants: 3, castShadow: true, clearance: 0.4, collide: 0.3 },
  logPile: { factory: logPile, variants: 1, castShadow: true, clearance: 1.4, collide: 1.25 },
  grassTuft: { factory: grassTuft, variants: 4, castShadow: false, clearance: 0.25 },
  flowerTuft: { factory: flowerTuft, variants: 4, castShadow: false, clearance: 0.25 },
  bridge: { factory: () => bridge(), variants: 1, castShadow: true, clearance: 0, structure: true },
} satisfies Record<string, ModelDef>;

export type ModelKey = keyof typeof MODELS;
