/**
 * Named colours sampled from the reference images. Values are sRGB hex.
 * Every voxel model and the terrain pull from here so the whole diorama shares one palette.
 */
export const PALETTE = {
  // Woods
  walnut: 0x5a3a22,
  walnutDark: 0x3f2716,
  honey: 0xb07a45,
  honeyLight: 0xcf9a5f,
  bark: 0x6b4428,
  barkDark: 0x4a2e1a,
  stumpTop: 0xc9a36b,
  stumpRing: 0x9b7444,

  // Stone
  stone: 0x8f8f8a,
  stoneLight: 0xaaa9a2,
  stoneDark: 0x686864,
  moss: 0x5d6d36,
  mossDark: 0x46552a,

  // Foliage
  pineDark: 0x1b3020,
  pineMid: 0x274328,
  pineLight: 0x37552f,
  pineTip: 0x4f6a36,
  leafDark: 0x35502a,
  leaf: 0x4f6c30,
  leafLight: 0x6a843c,
  bushDark: 0x283f24,
  bush: 0x3e5a2e,

  // Ground
  grass: 0x4d6630,
  grassLight: 0x5c7536,
  grassDark: 0x3c5228,
  dirt: 0x75593e,
  dirtLight: 0x856749,
  dirtDark: 0x5a4330,
  soil: 0x6e4a2c,
  soilDark: 0x553821,
  earthDeep: 0x45301f,
  gravel: 0x7c786d,

  // Water
  water: 0x3b6a80,
  waterDeep: 0x29505f,
  waterLight: 0x6a98a8,
  foam: 0xd8e4e6,

  // Flowers
  flowerWhite: 0xdcdacd,
  flowerYellow: 0xbfae5c,
  flowerLilac: 0x9e92b0,
  flowerRed: 0xc2553f,
  flowerPink: 0xd98aa0,

  // Roof
  slate: 0x3c3e47,
  slateDark: 0x2a2b32,
  slateLight: 0x50535d,
  soot: 0x1d1a1a,
  string: 0xe0743a,
  brass: 0xd9b35a,
  mat: 0x7d4a33,
  matDark: 0x5e3524,

  // Road
  asphalt: 0x56575a,
  asphaltDark: 0x48494d,
  roadLine: 0xcfc59a,

  // Pots and plants
  terracotta: 0xa85d3a,
  terracottaDark: 0x86452a,
  terracottaLight: 0xc47a52,
  potSoil: 0x3d2a1a,
  variegated: 0xd9d48a,
  ceramic: 0xe2d8c3,
  ceramicDark: 0xc4b89d,
  ceramicLight: 0xf0e8d6,
  charcoal: 0x4b4c52,
  charcoalDark: 0x37383d,
  charcoalLight: 0x5e6067,
  leafDeep: 0x2b4523,
  leafBright: 0x86a347,

  // Light
  amber: 0xffb347,
} as const;

export type PaletteKey = keyof typeof PALETTE;
