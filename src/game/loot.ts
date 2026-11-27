import type { ItemId } from './items';
import { SPECIES_IDS } from './plants';
import { TOOL_STATS, levelIndex } from './tools';

/**
 * What the river brings down to the bridge. Only non-living debris: wood, scrap and the odd bottle
 * with a cutting or seeds inside. No fish are ever caught.
 */
const COMMON: [ItemId, number][] = [
  ['driftwood', 5],
  ['scrapWood', 4],
];
const UNCOMMON: [ItemId, number][] = [
  ['metal', 2],
  ['nails', 2],
  ['glass', 2],
  ['rope', 2],
];
const RARE: [ItemId, number][] = [
  ['copper', 3],
  ...SPECIES_IDS.map((s): [ItemId, number] => [`cutting:${s}`, 1]),
  ...SPECIES_IDS.map((s): [ItemId, number] => [`seed:${s}`, 1]),
];

const UNCOMMON_CHANCE = 0.24;

function weighted(table: [ItemId, number][], r: number): ItemId {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let t = r * total;
  for (const [id, w] of table) {
    t -= w;
    if (t <= 0) return id;
  }
  return table[table.length - 1][0];
}

export interface Catch {
  item: ItemId;
  amount: number;
  rarity: 'common' | 'uncommon' | 'rare';
}

/** One find from the river: `rare` is the chance of a rare item, `extra` adds to the amount. */
export function rollLoot(
  { rare, extra, rareTable = RARE }: { rare: number; extra: number; rareTable?: [ItemId, number][] },
  rnd: () => number = Math.random,
): Catch {
  const r = rnd();
  if (r < rare) return { item: weighted(rareTable, rnd()), amount: 1, rarity: 'rare' };
  if (r < rare + UNCOMMON_CHANCE) return { item: weighted(UNCOMMON, rnd()), amount: 1 + extra, rarity: 'uncommon' };
  return { item: weighted(COMMON, rnd()), amount: 1 + Math.floor(rnd() * 2) + extra, rarity: 'common' };
}

export function rollCatch(rodLevel: number, rnd: () => number = Math.random): Catch {
  const li = levelIndex(rodLevel);
  return rollLoot({ rare: TOOL_STATS.rod.rare[li], extra: TOOL_STATS.rod.extra[li] }, rnd);
}

/** The otter knows where seeds wash up: its rare finds favour seeds, so feeding it can pay for itself. */
const OTTER_RARE: [ItemId, number][] = [
  ['copper', 3],
  ...SPECIES_IDS.map((s): [ItemId, number] => [`seed:${s}`, 3]),
  ...SPECIES_IDS.map((s): [ItemId, number] => [`cutting:${s}`, 1]),
];

/** Seeds the wind leaves in the broadleaf trees: mostly the common, easy-growing kinds. */
const TREE_SEEDS: [ItemId, number][] = [
  ['seed:spider', 4],
  ['seed:pothos', 4],
  ['seed:fern', 2],
  ['seed:snake', 1],
  ['seed:monstera', 0.5],
];

/** Seeds picked from a tree: 1, sometimes 2. */
export function rollTreeSeed(rnd: () => number = Math.random): { item: ItemId; amount: number } {
  return { item: weighted(TREE_SEEDS, rnd()), amount: rnd() < 0.35 ? 2 : 1 };
}

export function rollOtterFind(level: { rare: number; extra: number }, rnd: () => number = Math.random): Catch {
  return rollLoot({ rare: level.rare, extra: level.extra, rareTable: OTTER_RARE }, rnd);
}
