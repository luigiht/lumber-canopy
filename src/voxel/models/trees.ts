import { PALETTE as P } from '../palette';
import { VoxelModel } from '../VoxelModel';
import { hash3, irange, range, type Rng } from '../rng';

/**
 * Tall conifer built from stacked, jagged cone tiers, dark inside and lighter on the sunny tips.
 * `vox` is voxels per tile: 16 for props near the camera, 8 or 4 for distant forest (cheaper meshes).
 */
export function pine(rng: Rng, vox = 16): VoxelModel {
  const k = vox / 16;
  const detailed = vox >= 16;
  const H = irange(rng, Math.round(54 * k), Math.round(78 * k));
  const R = Math.max(2, Math.round(H * range(rng, 0.17, 0.2)));
  const S = R * 2 + Math.max(3, Math.round(5 * k));
  const c = Math.floor(S / 2);
  const m = new VoxelModel(S, H + 4, S, { x: c + 0.5, y: 0, z: c + 0.5 });
  const salt = Math.floor(rng() * 1000);

  // Trunk with a small root flare.
  const bark = P.bark;
  m.cylinderY(c, c, Math.max(0.5, 1.6 * k), 0, Math.floor(H * 0.75), bark);
  m.cylinderY(c, c, Math.max(0.8, 2.4 * k), 0, detailed ? 1 : 0, bark);
  if (detailed)
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) if (rng() < 0.7) m.set(c + dx, 0, c + dz, P.barkDark);

  // Foliage tiers.
  const start = Math.floor(H * range(rng, 0.2, 0.26));
  const tiers = irange(rng, 5, 7);
  const span = H - start;
  const outerBand = Math.max(1, 2 * k);
  let y0 = start;
  for (let t = 0; t < tiers; t++) {
    const frac = t / tiers;
    const th = Math.max(Math.max(2, Math.round(5 * k)), Math.round((span / tiers) * range(rng, 1.15, 1.4)));
    const rb = R * (1 - frac * 0.82);
    const y1 = Math.min(H, y0 + th);
    for (let y = y0; y <= y1; y++) {
      const ky = (y - y0) / Math.max(1, y1 - y0);
      const r = rb * (1 - ky * 0.62);
      for (let z = 0; z < S; z++)
        for (let x = 0; x < S; x++) {
          const dx = x - c;
          const dz = z - c;
          const d = Math.sqrt(dx * dx + dz * dz);
          // Gentle scallops rather than per-voxel noise: cleaner silhouettes for ink outlines.
          const ang = Math.atan2(dz, dx);
          const rough = (Math.sin(ang * 7 + salt + t * 1.7) * 0.6 + (hash3(x + salt, y, z) - 0.5) * 0.4) * k;
          if (d > r + rough) continue;
          const outer = d > r - outerBand;
          // Illustrated banding: lit upper face of each tier, mid body, dark underside.
          let col: number;
          if (ky < 0.22) col = P.pineDark;
          else if (outer && ky > 0.62) col = P.pineTip;
          else if (outer && ky > 0.35) col = P.pineLight;
          else col = P.pineMid;
          m.set(x, y, z, col);
        }
    }
    // Drooping tips under the tier edge.
    if (detailed)
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2;
        const r = rb - 0.5;
        m.set(c + Math.round(Math.cos(a) * r), y0 - 1, c + Math.round(Math.sin(a) * r), P.pineMid);
      }
    y0 = y0 + Math.round(th * 0.62);
  }
  // Spire, attached to the top of the highest tier.
  let top = H + 3;
  while (top > 0 && !m.grid.filled(c, top, c)) top--;
  for (let y = top + 1; y <= top + Math.max(1, Math.round(3 * k)); y++) m.set(c, y, c, P.pineTip);
  if (detailed) {
    m.set(c + 1, top, c, P.pineLight);
    m.set(c, top, c + 1, P.pineLight);
  }
  return m;
}

/** Broadleaf tree: branching trunk with clumped, light-green canopy blobs. */
export function broadleaf(rng: Rng): VoxelModel {
  const H = irange(rng, 44, 58);
  const S = 40;
  const c = S / 2;
  const m = new VoxelModel(S, H + 6, S, { x: c + 0.5, y: 0, z: c + 0.5 });
  const salt = Math.floor(rng() * 1000);
  const bark = P.bark;
  const trunkTop = Math.floor(H * 0.6);
  m.cylinderY(c, c, 1.6, 0, trunkTop, bark);
  m.cylinderY(c, c, 2.5, 0, 1, bark);

  const blobs: [number, number, number, number][] = [[c, H - 8, c, range(rng, 8, 10)]];
  const branches = irange(rng, 3, 4);
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + rng();
    const len = range(rng, 7, 11);
    const by = trunkTop - irange(rng, 4, 12);
    const ex = c + Math.cos(a) * len;
    const ez = c + Math.sin(a) * len;
    const ey = by + range(rng, 8, 14);
    for (let s = 0; s <= 1; s += 0.08) m.set(c + (ex - c) * s, by + (ey - by) * s, c + (ez - c) * s, P.bark);
    blobs.push([ex, ey + 2, ez, range(rng, 6, 8)]);
  }
  for (const [bx, by, bz, r] of blobs) {
    m.ellipsoid(bx, by, bz, r, r * 0.78, r, (x, y, z) => {
      // Lit cap, mid body, shaded underside — flat bands like painted foliage.
      const up = (y - by) / r + (hash3(x + salt, y, z) - 0.5) * 0.12;
      if (up > 0.3) return P.leafLight;
      if (up < -0.3) return P.leafDark;
      return P.leaf;
    }, (x, y, z) => (hash3(x, y + salt, z) - 0.5) * 0.15);
  }
  return m;
}

/** Leafy shrub, sometimes dotted with small white flowers. */
export function bush(rng: Rng): VoxelModel {
  const S = 18;
  const m = new VoxelModel(S, 14, S, { x: S / 2, y: 0, z: S / 2 });
  const salt = Math.floor(rng() * 1000);
  const flowers = rng() < 0.35;
  const n = irange(rng, 2, 3);
  for (let i = 0; i < n; i++) {
    const r = range(rng, 3.5, 5.5);
    const cx = S / 2 + range(rng, -3, 3);
    const cz = S / 2 + range(rng, -3, 3);
    const cy = r * 0.7;
    m.ellipsoid(cx, cy, cz, r, r * 0.85, r, (x, y, z) => {
      const h = hash3(x + salt, y, z);
      if (flowers && y > cy + r * 0.2 && h > 0.95) return P.flowerWhite;
      if (y > cy + r * 0.35) return P.leafLight;
      if (y < cy - r * 0.2) return P.bushDark;
      return P.bush;
    }, (x, y, z) => (hash3(x, y, z + salt) - 0.5) * 0.2);
  }
  return m;
}
