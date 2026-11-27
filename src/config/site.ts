/**
 * What the game is, in words: used for page metadata (SEO), the share card, structured data for
 * search and AI assistants (GEO), the web app manifest and llms.txt. Keep it in step with the game.
 */

/** The public address. Set NEXT_PUBLIC_SITE_URL once deployed; falls back to localhost for dev. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE = {
  name: 'Lumber & Canopy',
  shortName: 'Lumber & Canopy',
  tagline: 'A cozy eco-friendly voxel cabin and houseplant game',
  description:
    'Lumber & Canopy is a free, cozy voxel game you play in your browser. Build a cabin in a misty forest valley from reclaimed materials, fill it with houseplants, propagate them to earn upgrades, and befriend a river otter, all without cutting a single tree.',
  /** Longer description for structured data and llms.txt. */
  about:
    'Arrive by taxi at a misty forest valley and build a cabin using only what nature has let go of: driftwood and scrap fished from the river, and loose stones the river leaves behind. Grow houseplants from seeds and cuttings at a potting table, propagate them, and place them in the living room, kitchen and bedroom of your cabin, or sell and trade them for tool upgrades. Feed seeds to a shy river otter until it becomes your friend; it follows you and dives for treasures. Sleep through the night and wake at sunrise. No trees are cut and no wildlife is harmed: every resource comes from reuse, recycling and regrowth.',
  genres: ['Cozy game', 'Simulation', 'Building game', 'Casual game'],
  keywords: [
    'cozy game',
    'voxel game',
    'browser game',
    'free online game',
    'cabin building game',
    'houseplant game',
    'plant propagation',
    'eco-friendly game',
    'sustainable game',
    'isometric game',
    'pixel art game',
    'relaxing game',
    'otter',
  ],
  features: [
    'Build a cabin stage by stage from reclaimed driftwood, scrap and loose river stones',
    'Fish floating debris (never fish) from the bridge in a timing minigame',
    'Grow pothos, spider plants, Boston ferns, snake plants and monsteras from seeds and cuttings',
    'Propagate mature plants for more cuttings, and place them in and around your cabin',
    'Explore a cutaway two-floor cabin interior: living room, kitchen and bedroom loft',
    'Sell or trade plants to upgrade your hammer, fishing rod and pickaxe',
    'Befriend a river otter that follows you and dives for rare finds',
    'A full day and night cycle with drifting valley mist; sleep until sunrise',
    'Save your progress to your account and continue on any device',
  ],
  locale: 'en_GB',
  language: 'en',
  themeColor: '#1d2a1f',
  shareImageAlt:
    'Lumber & Canopy: a voxel log cabin with a porch and smoking chimney beside a forest river and wooden bridge, with the game’s title.',
} as const;
