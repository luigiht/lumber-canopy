import { ROCK_NODE_COUNT, DECOR_SLOTS, SEED_TREE_COUNT } from '@/config/stations';
import { FIELD, FIELD_BEDS } from '@/config/field';
import { SPECIES_IDS, type Bed, type Pot, type SpeciesId } from './plants';
import type { ToolId } from './tools';

/** Rock piles and the compost heap: how much is left and when (elapsed in-game hours) it refills. */
export interface NodeState {
  left: number;
  refillAt: number;
}

export const ROCK_MAX = 6;
export const ROCK_REFILL_HOURS = 8;
export const COMPOST_MAX = 4;
export const COMPOST_REFILL_HOURS = 6;
/** A picked tree has seeds again after this many in-game hours (random in the range). */
export const TREE_REGROW_HOURS = [10, 16] as const;

/** The garden field: how far it's built (0 = an empty plot) and what grows in each bed. */
export interface FieldSave {
  level: number;
  /** One entry per FIELD_BEDS bed; only the first `fieldBeds(level)` are open. */
  beds: (Bed | null)[];
}

export interface CabinSave {
  phase: 'plot' | 'building' | 'done';
  stageIndex: number;
  stageT: number;
  /** Highest stage whose materials have been paid (-1 = none). */
  paidStage: number;
}

export interface Stats {
  fished: number;
  gathered: number;
  planted: number;
  propagated: number;
  sold: number;
  /** Garden field beds harvested. */
  harvested: number;
}

/** Everything needed to restore a player's game. Stored as JSON (Supabase `progress.state`). */
export interface SaveState {
  version: 1;
  inventory: Record<string, number>;
  coins: number;
  tools: Record<ToolId, number>;
  selectedTool: ToolId;
  pots: Pot[];
  nextPotId: number;
  /** One entry per DECOR_SLOTS slot. */
  decor: (SpeciesId | null)[];
  rocks: NodeState[];
  compost: NodeState;
  /** Per seed tree: elapsed in-game hours when it has seeds again (0 = has seeds now). */
  seedTrees: { readyAt: number }[];
  field: FieldSave;
  cabin: CabinSave;
  clock: { hour: number; day: number; elapsed: number };
  player: { x: number; z: number } | null;
  /** The taxi intro has played. */
  arrived: boolean;
  tutorial: { done: boolean; step: number };
  stats: Stats;
  /** Seeds fed to the river otter (friendship comes from this, see game/otter.ts). */
  otter: { feeds: number };
  savedAt: string;
}

export function newGameState(): SaveState {
  return {
    version: 1,
    // Starter kit handed over by the taxi driver.
    // A few seeds too: to plant, or to make friends with the otter by the river.
    inventory: { pot: 2, soil: 2, 'cutting:pothos': 2, 'cutting:spider': 1, 'seed:spider': 2, 'seed:pothos': 1 },
    coins: 5,
    tools: { hammer: 1, rod: 1, pickaxe: 1 },
    selectedTool: 'rod',
    pots: [],
    nextPotId: 1,
    decor: DECOR_SLOTS.map(() => null),
    rocks: Array.from({ length: ROCK_NODE_COUNT }, () => ({ left: ROCK_MAX, refillAt: 0 })),
    compost: { left: COMPOST_MAX, refillAt: 0 },
    seedTrees: Array.from({ length: SEED_TREE_COUNT }, () => ({ readyAt: 0 })),
    field: { level: 0, beds: FIELD_BEDS.map(() => null) },
    cabin: { phase: 'plot', stageIndex: 0, stageT: 0, paidStage: -1 },
    clock: { hour: 8, day: 1, elapsed: 0 },
    player: null,
    arrived: false,
    tutorial: { done: false, step: 0 },
    stats: { fished: 0, gathered: 0, planted: 0, propagated: 0, sold: 0, harvested: 0 },
    otter: { feeds: 0 },
    savedAt: new Date().toISOString(),
  };
}

/** Fills in anything missing from an older or partial save so the game never reads undefined. */
export function normalizeSave(raw: unknown): SaveState | null {
  if (!raw || typeof raw !== 'object') return null;
  const base = newGameState();
  const s = raw as Partial<SaveState>;
  const fit = <T,>(arr: T[] | undefined, fallback: T[]) => fallback.map((f, i) => arr?.[i] ?? f);
  return {
    ...base,
    ...s,
    version: 1,
    inventory: { ...(s.inventory ?? base.inventory) },
    tools: { ...base.tools, ...s.tools },
    pots: Array.isArray(s.pots) ? s.pots : [],
    decor: fit(s.decor, base.decor),
    rocks: fit(s.rocks, base.rocks),
    compost: s.compost ?? base.compost,
    seedTrees: fit(s.seedTrees, base.seedTrees).map((t) => ({ readyAt: Math.max(0, Number(t?.readyAt) || 0) })),
    field: {
      level: Math.max(0, Math.min(FIELD.builds.length, Math.floor(Number(s.field?.level) || 0))),
      beds: fit(s.field?.beds, base.field.beds).map(validBed),
    },
    cabin: { ...base.cabin, ...s.cabin },
    clock: { ...base.clock, ...s.clock },
    tutorial: { ...base.tutorial, ...s.tutorial },
    stats: { ...base.stats, ...s.stats },
    otter: { feeds: Math.max(0, Number(s.otter?.feeds) || 0) },
  };
}

function validBed(b: Bed | null | undefined): Bed | null {
  if (!b || !SPECIES_IDS.includes(b.species)) return null;
  const plantedAt = Number(b.plantedAt);
  const hours = Number(b.hours);
  return Number.isFinite(plantedAt) && hours > 0 ? { species: b.species, plantedAt, hours } : null;
}
