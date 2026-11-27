import type { ItemId } from '@/game/items';

/** The starter cabin: where it stands, where the player works on it, and its build stages. */
export const CABIN = {
  /** Centre of the cabin body on the ground, in tiles. */
  x: -1.2,
  z: -1.0,
  /** Where the player stands to build: beside the log pile, in front of the porch. */
  workSpot: { x: -2.0, z: 4.9 },
  /** Ground the scatter must leave empty (whole site, porch and steps included), in tiles. */
  keepOut: { minX: -4.0, maxX: 1.2, minZ: -3.9, maxZ: 3.6 },
  /**
   * Build stages in order; `seconds` of work each while the player is on site (at hammer level 1).
   * `cost` is the reclaimed material each stage uses, paid when work on that stage begins.
   */
  stages: [
    { id: 'footing', name: 'Stone footing', seconds: 3, cost: { stone: 4 } },
    { id: 'floor', name: 'Floor platform', seconds: 2.5, cost: { driftwood: 4, scrapWood: 2 } },
    { id: 'frame', name: 'Timber frame', seconds: 4.5, cost: { driftwood: 6, nails: 2 } },
    { id: 'walls', name: 'Walls and windows', seconds: 5, cost: { scrapWood: 6, glass: 2 } },
    { id: 'chimney', name: 'Stone chimney', seconds: 3.5, cost: { stone: 8 } },
    { id: 'roof', name: 'Roof shingles', seconds: 5, cost: { scrapWood: 4, metal: 3 } },
    { id: 'porch', name: 'Porch and railing', seconds: 4.5, cost: { driftwood: 4, rope: 2 } },
  ],
} as const satisfies {
  stages: readonly { id: string; name: string; seconds: number; cost: Partial<Record<ItemId, number>> }[];
  [k: string]: unknown;
};

export type StageId = (typeof CABIN.stages)[number]['id'];
