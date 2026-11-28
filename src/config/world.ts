import type { ModelKey } from '@/voxel/models';

/**
 * The starting clearing (Stage 0), laid out to match "Isometric Voxel Forest Clearing".
 * Coordinates are in tiles; the map spans [-size/2, size/2] on X and Z, ground level is y = 0.
 * With the default camera, +X+Z is the front (bottom) corner, -X-Z the back corner,
 * -X+Z the left corner and +X-Z the right corner.
 */

export interface Placement {
  model: ModelKey;
  x: number;
  z: number;
  /** Quarter turns around Y. */
  rot?: number;
  /** Lift above the sampled ground height, in tiles. */
  lift?: number;
  variant?: number;
}

export interface ScatterRule {
  model: ModelKey;
  count: number;
  /** Minimum distance to any other scattered item of a rule with spacing, in tiles. */
  spacing: number;
  /** Where the rule may place items. */
  zone:
    | 'forestBack'
    | 'forestEdges'
    | 'clearingRim'
    | 'anywhereGrass'
    | 'streamBank'
    /** Detailed terrain outside the play area. */
    | 'outerForest'
    | 'outerMeadow'
    /** Coarse far terrain, mostly swallowed by mist. */
    | 'farForest';
}

export interface WaterStep {
  /** Stream points with z below this use `level` (tiles). Checked in order. */
  zBelow: number;
  level: number;
}

/** A wave in the road's centre line: amplitude (tiles), frequency (per tile of z), phase. */
export type RoadWave = [amp: number, freq: number, phase: number];

export interface RoadConfig {
  /** Centre line x = base + Σ amp·sin(freq·z + phase): winds gently, nearest the bridge near z = 0. */
  base: number;
  waves: RoadWave[];
  halfWidth: number;
  /** Dirt footpaths (polylines of [x, z]): road → bridge, and bridge → cabin clearing. */
  paths: [number, number][][];
  pathHalfWidth: number;
}

export const WORLD = {
  seed: 1337,
  /** The playable clearing, in tiles. */
  playSize: 24,
  /** Detailed terrain (1/8-tile voxels) extends past the play area so the land keeps going. */
  size: 40,
  /** Coarse terrain ring beyond that, faded out by mist. */
  farSize: 96,
  farRes: 4,
  /** Terrain columns per tile (terrain voxels are 1/8 tile; props are 1/16). */
  terrainRes: 8,
  slabDepth: 1.25,

  clearing: { x: -1.2, z: 0, rx: 5.8, rz: 5.2, noise: 1.1 },

  stream: {
    halfWidth: 0.85,
    bedDepth: 0.375,
    /** Water surface sits this far below the bank. */
    surfaceDrop: 0.125,
    points: [
      // Upstream: meanders back into the hills.
      [4.5, -50],
      [4.0, -46],
      [1.6, -42],
      [0.2, -38],
      [1.4, -34],
      [4.2, -31],
      [5.6, -27.5],
      [4.4, -24],
      [1.8, -21],
      [1.4, -18],
      [3.0, -15],
      // Play area.
      [4.6, -12.6],
      [4.7, -9.6],
      [5.0, -7.6],
      [6.6, -5.2],
      [8.2, -2.6],
      [8.4, 1.0],
      [8.0, 5.0],
      [7.2, 8.6],
      [7.0, 12.6],
      // Downstream: winds away through the forest.
      [5.6, 15.5],
      [3.8, 18],
      [3.6, 21],
      [5.4, 24],
      [7.6, 27],
      [8.0, 30.5],
      [6.2, 34],
      [3.8, 37.5],
      [3.2, 41.5],
      [4.8, 45.5],
      [6.4, 50],
    ] as [number, number][],
    /** Two-step waterfall: upstream (negative z) sections sit higher. */
    steps: [
      { zBelow: -10, level: 1.875 },
      { zBelow: -7.9, level: 0.875 },
      { zBelow: Infinity, level: -0.125 },
    ] as WaterStep[],
  },

  /** Rocky ledge the stream tumbles down from, in the back-right. */
  ledge: { zBelow: -7.2, reach: 2.6, noise: 1.2 },

  /** Land rises into forested hills behind the clearing, beyond the play area. */
  hills: { start: 19, slope: 0.32, noise: 1.6, valley: 4 },

  /**
   * Road on the far (east) side of the river where the taxi drops the player off, and the dirt path
   * from the road to the bridge. Both are flattened and kept clear of trees.
   */
  road: {
    base: 15.2,
    waves: [
      [1.6, 0.13, -1.57],
      [0.7, 0.31, -1.0],
    ],
    halfWidth: 1.05,
    paths: [
      // Road verge to the east end of the bridge.
      [
        [12.5, 0.05],
        [11.5, -0.2],
        [10.8, -0.55],
        // Straight onto the abutment, in line with the deck.
        [9.95, -0.625],
      ],
      // West end of the bridge, curving up into the cabin clearing.
      [
        [6.85, -0.625],
        [6.0, -0.55],
        [5.2, -0.25],
        [4.7, 0.15],
        [3.4, 0.4],
        [2.1, 0.75],
      ],
    ],
    pathHalfWidth: 0.55,
  } as RoadConfig,

  /** Radial mist around the clearing (tiles from the centre). */
  // Clear far enough out that the road and the land past the walkable area stay visible.
  // `bankNear`: mist banks drift from here outward, just past the edge of the play area.
  // `valleyBanks`: chunky boxy clouds floating over the river and the hills (on top of the sheets).
  mist: { near: 18, far: 40, banks: 110, bankNear: 14.5, valleyBanks: 64 },

  placements: [
    // z on a nav-cell centre line, so the walkable lane between the railings is even.
    { model: 'bridge', x: 8.4, z: -0.625, rot: 0 },
    { model: 'logPile', x: -3.6, z: 6.6, rot: 0 },
    { model: 'stump', x: -0.9, z: 4.6 },
    { model: 'stump', x: 4.0, z: -3.6 },
    { model: 'stump', x: -9.0, z: 2.6 },
    { model: 'boulders', x: -9.4, z: 8.4 },
    { model: 'boulders', x: -10.2, z: 6.6, rot: 1 },
    { model: 'smallBoulders', x: -7.6, z: 9.8 },
    { model: 'boulders', x: -8.8, z: -3.6, rot: 2 },
    { model: 'boulders', x: -3.4, z: -8.6, rot: 1 },
    { model: 'smallBoulders', x: -2.2, z: -9.2 },
    { model: 'smallBoulders', x: 5.4, z: 9.6 },
    { model: 'smallBoulders', x: 10.6, z: -3.2, rot: 3 },
    { model: 'smallBoulders', x: 9.9, z: 3.4 },
    { model: 'broadleaf', x: -8.6, z: -6.4 },
    { model: 'broadleaf', x: 1.2, z: -9.2 },
    { model: 'broadleaf', x: -10.6, z: 3.8 },
    // Behind the bridge from the default camera, so it never hides the crossing.
    { model: 'broadleaf', x: 10.6, z: -4.8 },
    { model: 'pine', x: 10.6, z: -10.6 },
    { model: 'pine', x: 10.8, z: -7.4 },
    { model: 'pine', x: -10.8, z: 10.6 },
  ] as Placement[],

  scatter: [
    { model: 'pine', count: 58, spacing: 1.55, zone: 'forestBack' },
    { model: 'bush', count: 16, spacing: 1.0, zone: 'clearingRim' },
    { model: 'bush', count: 18, spacing: 1.0, zone: 'forestEdges' },
    { model: 'bush', count: 8, spacing: 1.0, zone: 'streamBank' },
    { model: 'pebble', count: 22, spacing: 0, zone: 'streamBank' },
    { model: 'pebble', count: 12, spacing: 0, zone: 'anywhereGrass' },
    { model: 'grassTuft', count: 110, spacing: 0, zone: 'anywhereGrass' },
    { model: 'flowerTuft', count: 70, spacing: 0, zone: 'anywhereGrass' },
    { model: 'flowerTuft', count: 30, spacing: 0, zone: 'streamBank' },
    { model: 'pineOuter', count: 300, spacing: 1.45, zone: 'outerForest' },
    { model: 'bush', count: 50, spacing: 0.9, zone: 'outerMeadow' },
    { model: 'grassTuft', count: 140, spacing: 0, zone: 'outerMeadow' },
    { model: 'flowerTuft', count: 50, spacing: 0, zone: 'outerMeadow' },
    { model: 'pineFar', count: 1150, spacing: 1.6, zone: 'farForest' },
  ] as ScatterRule[],
};

export type WorldConfig = typeof WORLD;

/** x of the road's centre line at z. */
export function roadCenterX(z: number, road: RoadConfig = WORLD.road) {
  return road.waves.reduce((x, [a, f, p]) => x + a * Math.sin(f * z + p), road.base);
}

/** dx/dz of the road's centre line at z. */
export function roadSlope(z: number, road: RoadConfig = WORLD.road) {
  return road.waves.reduce((s, [a, f, p]) => s + a * f * Math.cos(f * z + p), 0);
}

/** Approximate perpendicular distance from (x,z) to the road's centre line. */
export function roadOffset(x: number, z: number, road: RoadConfig = WORLD.road) {
  return Math.abs(x - roadCenterX(z, road)) / Math.hypot(1, roadSlope(z, road));
}

/** Distance from (x,z) to the nearest dirt path's centre line. */
export function pathDist(x: number, z: number, road: RoadConfig = WORLD.road) {
  let best = Infinity;
  for (const line of road.paths)
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
    }
  return best;
}
