import { create } from 'zustand';
import type { Engine } from '@/engine/Engine';
import type { Account } from '@/services/account';
import type { SpeciesId, Pot } from './plants';
import type { ToolId } from './tools';
import { newGameState, type NodeState, type Stats, type SaveState } from './save';

export interface BuildState {
  phase: 'plot' | 'building' | 'done';
  stageName: string;
  stageNumber: number;
  stageCount: number;
  progress: number;
  /** Building but the player isn't on site. */
  paused: boolean;
  /** The player is walking to the site to build. */
  heading: boolean;
  /** On site but missing the materials for the next stage. */
  waiting: boolean;
  /** The current stage's materials have been used (paid). */
  stagePaid: boolean;
}

/** Which screen is showing: onboarding steps, or the game itself. */
export type Screen =
  | 'loading'
  | 'start'
  | 'signup'
  | 'signin'
  | 'forgot'
  | 'confirm'
  | 'goal'
  | 'welcome'
  | 'playing';

export type Panel = 'inventory' | 'plants' | 'potting' | 'workbench' | 'delivery' | 'place' | 'otter' | 'bed' | null;

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'rare' | 'warn';
}

export interface FishingState {
  phase: 'waiting' | 'bite' | 'result';
  /** Catch zone on the 0..1 bar. */
  zoneStart: number;
  zoneWidth: number;
  result?: { ok: boolean; text: string };
  /** performance.now() until the next cast is allowed. */
  readyAt: number;
}

/** Progress the player keeps between sessions (mirrors SaveState minus what the engine owns). */
export interface Progress {
  inventory: Record<string, number>;
  coins: number;
  tools: Record<ToolId, number>;
  selectedTool: ToolId;
  pots: Pot[];
  nextPotId: number;
  decor: (SpeciesId | null)[];
  rocks: NodeState[];
  compost: NodeState;
  arrived: boolean;
  tutorial: { done: boolean; step: number };
  stats: Stats;
  otter: { feeds: number };
}

export interface Display {
  brightness: number;
  textScale: number;
}

interface GameState extends Progress {
  build: BuildState;
  engine: Engine | null;
  ready: boolean;
  hour: number;
  day: number;
  /** In-game hours played (drives plant growth and refills). */
  elapsed: number;
  speedIndex: number;
  quarter: number;
  settingsOpen: boolean;
  /** UI hidden for screenshots (H). */
  uiHidden: boolean;

  screen: Screen;
  account: Account | null;
  /** What the player asked us to call them. */
  playerName: string;
  /** The save loaded at sign-in, shown on the welcome-back summary before play starts. */
  loaded: SaveState | null;
  /** Signed up but waiting on email confirmation: playing, saved in this browser for now. */
  pendingEmail: string | null;
  saving: 'idle' | 'saving' | 'error';
  panel: Panel;
  /** Inside the cabin, and on which floor (0 ground, 1 bedroom loft). */
  inside: boolean;
  floor: 0 | 1;
  /** The plant spot the 'place' panel is for. */
  placeSlot: number | null;
  /** The otter is off diving for a find. */
  otterBusy: boolean;
  /** Sleeping: fading to black, or waking up (fading back in). */
  sleep: 'falling' | 'waking' | null;
  toasts: Toast[];
  fishing: FishingState | null;
  display: Display;
}

export const SPEEDS = [
  { label: 'II', hoursPerSec: 0 },
  { label: '1×', hoursPerSec: 24 / 600 },
  { label: '20×', hoursPerSec: (24 / 600) * 20 },
  { label: '120×', hoursPerSec: (24 / 600) * 120 },
] as const;

export function progressOf(save: SaveState): Progress {
  const { inventory, coins, tools, selectedTool, pots, nextPotId, decor, rocks, compost, arrived, tutorial, stats, otter } = save;
  return { inventory, coins, tools, selectedTool, pots, nextPotId, decor, rocks, compost, arrived, tutorial, stats, otter };
}

export const useGame = create<GameState>(() => ({
  ...progressOf(newGameState()),
  engine: null,
  build: {
    phase: 'plot',
    stageName: '',
    stageNumber: 1,
    stageCount: 0,
    progress: 0,
    paused: false,
    heading: false,
    waiting: false,
    stagePaid: false,
  },
  ready: false,
  hour: 8,
  day: 1,
  elapsed: 0,
  speedIndex: 1,
  quarter: 0,
  settingsOpen: false,
  uiHidden: false,
  screen: 'loading',
  account: null,
  playerName: '',
  loaded: null,
  pendingEmail: null,
  saving: 'idle',
  panel: null,
  inside: false,
  floor: 0,
  placeSlot: null,
  otterBusy: false,
  sleep: null,
  toasts: [],
  fishing: null,
  display: { brightness: 1, textScale: 1 },
}));
