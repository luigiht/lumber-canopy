import type { Cost } from './items';

export type ToolId = 'hammer' | 'rod' | 'pickaxe';

export const TOOL_IDS: ToolId[] = ['hammer', 'rod', 'pickaxe'];
export const MAX_TOOL_LEVEL = 3;

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  key: string;
  use: string;
  /** What each level does, index 0 = level 1. */
  effects: string[];
  /** Cost to reach level 2 and level 3. */
  upgrades: [Cost, Cost];
}

export const TOOLS: Record<ToolId, ToolDef> = {
  hammer: {
    id: 'hammer',
    name: 'Hammer',
    icon: 'hammer',
    key: '1',
    use: 'Builds the cabin and makes pots at the workbench.',
    effects: ['Builds at normal speed', 'Builds 35% faster', 'Builds 75% faster'],
    upgrades: [
      { coins: 12, metal: 2, scrapWood: 3 },
      { coins: 35, metal: 4, copper: 1 },
    ],
  },
  rod: {
    id: 'rod',
    name: 'Fishing rod',
    icon: 'rod',
    key: '2',
    use: 'Fishes floating debris from the bridge. Never fish.',
    effects: [
      'Rare debris 8%, 1–2 per catch',
      'Rare debris 12%, wider catch zone',
      'Rare debris 18%, +1 per catch, quicker recast',
    ],
    upgrades: [
      { coins: 10, rope: 2, metal: 1 },
      { coins: 30, metal: 3, copper: 1 },
    ],
  },
  pickaxe: {
    id: 'pickaxe',
    name: 'Pickaxe',
    icon: 'pickaxe',
    key: '3',
    use: 'Gathers loose stones faster. Never breaks big rocks.',
    effects: ['1 stone per gather', '2 stones per gather, faster', '2–3 stones per gather, fastest'],
    upgrades: [
      { coins: 10, metal: 2, driftwood: 2 },
      { coins: 30, metal: 3, copper: 1 },
    ],
  },
};

/** Numbers behind each tool level (index 0 = level 1). */
export const TOOL_STATS = {
  hammer: { buildSpeed: [1, 1.35, 1.75] },
  rod: { zone: [0.16, 0.22, 0.28], rare: [0.08, 0.12, 0.18], extra: [0, 0, 1], cooldown: [2.5, 1.8, 1.2] },
  pickaxe: { seconds: [1.6, 1.1, 0.75], amount: [1, 2, 2], bonusChance: [0, 0, 0.5] },
  /** Gathering stones without the pickaxe. */
  hands: { seconds: 2.4, amount: 1 },
};

export const levelIndex = (level: number) => Math.max(0, Math.min(MAX_TOOL_LEVEL, level) - 1);
