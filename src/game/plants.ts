/** Houseplants the player can propagate. Growth is measured in in-game hours. */

export type SpeciesId = 'pothos' | 'spider' | 'fern' | 'snake' | 'monstera';

export interface Species {
  id: SpeciesId;
  name: string;
  /** In-game hours from a fresh cutting to a mature plant. Seeds take longer (see SEED_FACTOR). */
  hours: number;
  /** Coins when sold at the delivery box. */
  price: number;
  /** Materials offered instead of coins at the delivery box. */
  trade: Partial<Record<string, number>>;
  /** Cuttings you get each time you propagate a mature plant. */
  cuttings: number;
  blurb: string;
}

export const SPECIES: Record<SpeciesId, Species> = {
  pothos: {
    id: 'pothos',
    name: 'Pothos',
    hours: 6,
    price: 8,
    trade: { metal: 2 },
    cuttings: 2,
    blurb: 'Trailing vines that root happily in a jar of water.',
  },
  spider: {
    id: 'spider',
    name: 'Spider plant',
    hours: 5,
    price: 6,
    trade: { rope: 2 },
    cuttings: 3,
    blurb: 'Sends out baby plantlets you can pot straight away.',
  },
  fern: {
    id: 'fern',
    name: 'Boston fern',
    hours: 8,
    price: 10,
    trade: { glass: 2, nails: 2 },
    cuttings: 2,
    blurb: 'Loves the misty air by the river.',
  },
  snake: {
    id: 'snake',
    name: 'Snake plant',
    hours: 10,
    price: 14,
    trade: { metal: 3, copper: 1 },
    cuttings: 2,
    blurb: 'Tough and upright; grows from a single leaf cutting.',
  },
  monstera: {
    id: 'monstera',
    name: 'Monstera',
    hours: 14,
    price: 22,
    trade: { copper: 2 },
    cuttings: 2,
    blurb: 'Big split leaves. The pride of any cabin.',
  },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

/** Seeds take this much longer than cuttings to reach maturity. */
export const SEED_FACTOR = 1.5;

export type GrowthStage = 1 | 2 | 3;

export const STAGE_NAMES: Record<GrowthStage, string> = { 1: 'Newly planted', 2: 'Growing', 3: 'Mature' };

/** A plant growing in a pot on the potting table. */
export interface Pot {
  id: number;
  species: SpeciesId;
  /** In-game elapsed hours when planted. */
  plantedAt: number;
  /** In-game hours until mature. */
  hours: number;
  from: 'seed' | 'cutting';
}

export function potProgress(pot: Pot, elapsed: number) {
  return Math.max(0, Math.min(1, (elapsed - pot.plantedAt) / pot.hours));
}

export function potStage(pot: Pot, elapsed: number): GrowthStage {
  const p = potProgress(pot, elapsed);
  return p >= 1 ? 3 : p >= 0.3 ? 2 : 1;
}

/** In-game hours left until mature. */
export function potHoursLeft(pot: Pot, elapsed: number) {
  return Math.max(0, pot.plantedAt + pot.hours - elapsed);
}
