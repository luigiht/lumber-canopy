import type { ItemId } from '@/game/items';

/**
 * The garden field in front of the cabin, where seeds are grown into more seeds. The player builds
 * it in steps; each step opens more beds. Coordinates are in tiles (see config/world.ts).
 */
export const FIELD = {
  /** Centre of the field. */
  x: 1.0,
  z: 6.0,
  /** Half-size of the fenced patch. Its ground is the same dirt as the cabin clearing. */
  halfX: 1.0625,
  halfZ: 0.75,
  /** Where the player stands to tend it: on the cabin side, facing the beds. */
  spot: [1.0, 4.85] as [number, number],
  /** Each build opens beds up to `beds`, paid when built. */
  builds: [
    { beds: 3, cost: { stone: 4, driftwood: 2 } },
    { beds: 6, cost: { stone: 6, scrapWood: 3, rope: 1 } },
  ] as { beds: number; cost: Partial<Record<ItemId, number>> }[],
};

/** Bed centres as offsets from the field centre: the front row first, then the back row. */
export const FIELD_BEDS: [number, number][] = [
  [-0.7, -0.35],
  [0, -0.35],
  [0.7, -0.35],
  [-0.7, 0.35],
  [0, 0.35],
  [0.7, 0.35],
];

/** Beds open at a field level (0 = not built yet). */
export const fieldBeds = (level: number) => (level > 0 ? FIELD.builds[Math.min(level, FIELD.builds.length) - 1].beds : 0);
