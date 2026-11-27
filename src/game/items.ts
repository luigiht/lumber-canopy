import { SPECIES, SPECIES_IDS, type SpeciesId } from './plants';

/** Plain materials. Plant items are `seed:<species>`, `cutting:<species>` and `plant:<species>`. */
export type MaterialId =
  | 'driftwood'
  | 'scrapWood'
  | 'metal'
  | 'nails'
  | 'glass'
  | 'rope'
  | 'copper'
  | 'stone'
  | 'soil'
  | 'pot';

export type PlantItemKind = 'seed' | 'cutting' | 'plant';
export type ItemId = MaterialId | `${PlantItemKind}:${SpeciesId}`;

export interface ItemDef {
  name: string;
  /** A pixel icon name from ui/pixelIcons.ts, or an emoji. */
  icon: string;
  /** Where it comes from, phrased for the ecofriendly framing. */
  source: string;
  use: string;
}

export const MATERIALS: Record<MaterialId, ItemDef> = {
  driftwood: {
    name: 'Driftwood',
    /** Pixel-art plank (see ui/ItemIcon.tsx). */
    icon: 'plank',
    source: 'Fished from the river at the bridge. No trees were cut.',
    use: 'Cabin floor, frame and porch.',
  },
  scrapWood: {
    name: 'Scrap wood',
    /** Pixel-art broken sticks (see ui/ItemIcon.tsx). */
    icon: 'sticks',
    source: 'Broken sticks and snapped boards fished from the river.',
    use: 'Walls, roof and pots.',
  },
  metal: {
    name: 'Metal scraps',
    icon: 'metal',
    source: 'Recycled bits fished from the river, or traded for plants.',
    use: 'Roof flashing and tool upgrades.',
  },
  nails: {
    name: 'Old nails',
    icon: 'nails',
    source: 'Straightened nails from river debris.',
    use: 'Timber frame.',
  },
  glass: {
    name: 'Glass shards',
    icon: 'glass',
    source: 'Recyclable glass fished from the river, kept out of the water.',
    use: 'Cabin windows.',
  },
  rope: {
    name: 'Rope',
    icon: 'rope',
    source: 'Tangled rope pulled out of the river.',
    use: 'Porch railing.',
  },
  copper: {
    name: 'Copper scrap',
    icon: 'copper',
    source: 'A rare find in the river, or a trade for prized plants.',
    use: 'Top-level tool upgrades.',
  },
  stone: {
    name: 'Stones',
    icon: 'stone',
    source: 'Loose stones carried by the river. The landscape is left untouched.',
    use: 'Footing and chimney.',
  },
  soil: {
    name: 'Soil',
    icon: 'soil',
    source: 'Scooped from the compost heap.',
    use: 'One per pot when planting.',
  },
  pot: {
    name: 'Planter pot',
    icon: 'pot',
    source: 'Made from scrap wood at the workbench.',
    use: 'One per plant at the potting table.',
  },
};

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export function parsePlantItem(id: string): { kind: PlantItemKind; species: SpeciesId } | null {
  const [kind, species] = id.split(':');
  if ((kind === 'seed' || kind === 'cutting' || kind === 'plant') && SPECIES_IDS.includes(species as SpeciesId))
    return { kind, species: species as SpeciesId };
  return null;
}

export function itemDef(id: string): ItemDef {
  const plant = parsePlantItem(id);
  if (!plant) return MATERIALS[id as MaterialId] ?? { name: id, icon: 'unknown', source: '', use: '' };
  const sp = SPECIES[plant.species];
  switch (plant.kind) {
    case 'seed':
      return {
        name: `${sp.name} seeds`,
        icon: 'seed',
        source: 'Caught in the branches of the broadleaf trees, or found sealed in bottles drifting down the river.',
        use: 'Plant at the potting table (slower than cuttings), or in the garden field to grow more seeds.',
      };
    case 'cutting':
      return {
        name: `${sp.name} cutting`,
        icon: 'sprout',
        source: 'Taken from a mature plant, never from the wild.',
        use: 'Plant at the potting table.',
      };
    case 'plant':
      return {
        name: sp.name,
        icon: 'potted',
        source: 'Grown by you at the potting table.',
        use: 'Place it around your cabin, or sell it at the delivery box.',
      };
  }
}

export type Cost = Partial<Record<ItemId | 'coins', number>>;

/** Human-readable list like "4 Stones, 2 Rope". */
export function formatCost(cost: Cost) {
  return Object.entries(cost)
    .filter(([, n]) => n)
    .map(([id, n]) => (id === 'coins' ? `${n} coins` : `${n} ${itemDef(id).name}`))
    .join(', ');
}
