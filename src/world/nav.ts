import { MODELS, type ModelDef } from '@/voxel/models';
import { Mat, type Terrain } from './terrain';
import type { PropInstance } from './props';

/** A walkable surface over the terrain, such as the bridge deck. */
export interface Deck {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/** What a nav grid is built over: its size and, per point, the standing height and whether it's open. */
export interface NavSurface {
  /** Side of the square area covered, in tiles, centred on the origin. */
  size: number;
  heightAt(x: number, z: number): number;
  walkable(x: number, z: number): boolean;
}

const RES = 4; // cells per tile
const MAX_STEP = 0.3; // tallest step the lumberjack can take, in tiles
const BODY = 0.14; // character radius, in tiles
const EDGE = 1; // keep this far from the edge of the detailed terrain

type Pt = [number, number];

/**
 * Walkability grid with A* pathfinding over a surface: the outdoor terrain (water, map edges and
 * anything with a collision radius blocked; decks such as the bridge walkable at their height), or
 * one floor of the cabin interior.
 */
export class NavGrid {
  readonly n: number;
  readonly half: number;
  private readonly walk: Uint8Array;
  private readonly h: Float32Array;

  constructor(
    private readonly surface: NavSurface,
    instances: PropInstance[] = [],
  ) {
    this.half = surface.size / 2;
    this.n = surface.size * RES;
    this.walk = new Uint8Array(this.n * this.n);
    this.h = new Float32Array(this.n * this.n);

    for (let k = 0; k < this.n; k++)
      for (let i = 0; i < this.n; i++) {
        const c = i + k * this.n;
        const [x, z] = this.center(c);
        this.h[c] = this.heightAt(x, z);
        this.walk[c] = surface.walkable(x, z) ? 1 : 0;
      }

    for (const inst of instances) {
      const r = (MODELS[inst.model] as ModelDef).collide ?? 0;
      if (r <= 0) continue;
      const reach = r + BODY;
      const i0 = Math.floor((inst.x - reach + this.half) * RES);
      const i1 = Math.floor((inst.x + reach + this.half) * RES);
      const k0 = Math.floor((inst.z - reach + this.half) * RES);
      const k1 = Math.floor((inst.z + reach + this.half) * RES);
      for (let k = Math.max(0, k0); k <= Math.min(this.n - 1, k1); k++)
        for (let i = Math.max(0, i0); i <= Math.min(this.n - 1, i1); i++) {
          const [x, z] = this.center(i + k * this.n);
          if (Math.hypot(x - inst.x, z - inst.z) < reach) this.walk[i + k * this.n] = 0;
        }
    }
  }

  /** Marks a world-space rectangle (plus the character's body radius) as unwalkable. */
  blockRect(r: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    for (let k = 0; k < this.n; k++)
      for (let i = 0; i < this.n; i++) {
        const [x, z] = this.center(i + k * this.n);
        if (x > r.minX - BODY && x < r.maxX + BODY && z > r.minZ - BODY && z < r.maxZ + BODY) this.walk[i + k * this.n] = 0;
      }
  }

  /** The walkable point nearest (x,z), or the point itself if nothing is close. */
  snap(x: number, z: number): Pt {
    const c = this.nearestWalkable(x, z);
    return c < 0 ? [x, z] : c === this.cell(x, z) ? [x, z] : this.center(c);
  }

  /** The outdoor grid: terrain, bridge decks, and props with a collision radius. */
  static forWorld(terrain: Terrain, instances: PropInstance[], decks: Deck[]) {
    const half = terrain.cfg.size / 2;
    const deckAt = (x: number, z: number) => decks.find((d) => x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ);
    return new NavGrid(
      {
        size: terrain.cfg.size,
        heightAt: (x, z) => deckAt(x, z)?.y ?? terrain.heightAt(x, z),
        walkable: (x, z) =>
          Math.max(Math.abs(x), Math.abs(z)) <= half - EDGE && !(terrain.matAt(x, z) === Mat.Bed && !deckAt(x, z)),
      },
      instances,
    );
  }

  /** Height of the surface the player stands on at (x,z). */
  heightAt(x: number, z: number) {
    return this.surface.heightAt(x, z);
  }

  private cell(x: number, z: number) {
    const i = Math.floor((x + this.half) * RES);
    const k = Math.floor((z + this.half) * RES);
    if (i < 0 || k < 0 || i >= this.n || k >= this.n) return -1;
    return i + k * this.n;
  }

  private center(c: number): Pt {
    return [(c % this.n) / RES - this.half + 0.5 / RES, Math.floor(c / this.n) / RES - this.half + 0.5 / RES];
  }

  isWalkable(x: number, z: number) {
    const c = this.cell(x, z);
    return c >= 0 && this.walk[c] === 1;
  }

  /** Nearest walkable cell to (x,z), searching outward a few tiles. */
  private nearestWalkable(x: number, z: number): number {
    const c0 = this.cell(x, z);
    if (c0 < 0) return -1;
    if (this.walk[c0]) return c0;
    const i0 = c0 % this.n;
    const k0 = Math.floor(c0 / this.n);
    for (let r = 1; r <= 3 * RES; r++) {
      let best = -1;
      let bestD = Infinity;
      for (let dk = -r; dk <= r; dk++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dk)) !== r) continue;
          const i = i0 + di;
          const k = k0 + dk;
          if (i < 0 || k < 0 || i >= this.n || k >= this.n || !this.walk[i + k * this.n]) continue;
          const d = di * di + dk * dk;
          if (d < bestD) {
            bestD = d;
            best = i + k * this.n;
          }
        }
      if (best >= 0) return best;
    }
    return -1;
  }

  private canStep(a: number, b: number) {
    return this.walk[b] === 1 && Math.abs(this.h[a] - this.h[b]) <= MAX_STEP;
  }

  /** Straight walk between two points without touching blocked cells or tall steps. */
  private lineClear(a: Pt, b: Pt) {
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(dist / (0.5 / RES));
    let prev = this.cell(a[0], a[1]);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const c = this.cell(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      if (c < 0 || (c !== prev && !this.canStep(prev, c))) return false;
      prev = c;
    }
    return true;
  }

  /** Path from `from` to the walkable spot nearest `to`, as world points; null if unreachable. */
  findPath(from: Pt, to: Pt): Pt[] | null {
    const start = this.cell(from[0], from[1]);
    const goal = this.nearestWalkable(to[0], to[1]);
    if (start < 0 || goal < 0) return null;
    const goalPt: Pt = goal === this.cell(to[0], to[1]) ? to : this.center(goal);
    if (start === goal) return [goalPt];

    const n = this.n;
    const g = new Float32Array(n * n).fill(Infinity);
    const came = new Int32Array(n * n).fill(-1);
    const closed = new Uint8Array(n * n);
    const heap = new MinHeap();
    const gi = goal % n;
    const gk = Math.floor(goal / n);
    const hfn = (c: number) => {
      const dx = Math.abs((c % n) - gi);
      const dz = Math.abs(Math.floor(c / n) - gk);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    g[start] = 0;
    heap.push(start, hfn(start));
    let found = false;
    while (heap.size) {
      const c = heap.pop();
      if (c === goal) {
        found = true;
        break;
      }
      if (closed[c]) continue;
      closed[c] = 1;
      const ci = c % n;
      const ck = Math.floor(c / n);
      for (let dk = -1; dk <= 1; dk++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dk) continue;
          const i = ci + di;
          const k = ck + dk;
          if (i < 0 || k < 0 || i >= n || k >= n) continue;
          const nb = i + k * n;
          if (closed[nb] || !this.canStep(c, nb)) continue;
          // No cutting corners past blocked cells.
          if (di && dk && (!this.walk[ci + di + ck * n] || !this.walk[ci + (ck + dk) * n])) continue;
          const cost = g[c] + (di && dk ? Math.SQRT2 : 1);
          if (cost < g[nb]) {
            g[nb] = cost;
            came[nb] = c;
            heap.push(nb, cost + hfn(nb));
          }
        }
    }
    if (!found) return null;

    const cells: Pt[] = [];
    for (let c = goal; c !== start && c >= 0; c = came[c]) cells.push(this.center(c));
    cells.reverse();
    cells[cells.length - 1] = goalPt;

    // String-pull: skip ahead to the farthest point that can be reached in a straight line.
    const out: Pt[] = [];
    let cur: Pt = from;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineClear(cur, cells[j])) j--;
      out.push(cells[j]);
      cur = cells[j];
      i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    const { items, keys } = this;
    items.push(item);
    keys.push(key);
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [items[p], items[i]] = [items[i], items[p]];
      [keys[p], keys[i]] = [keys[i], keys[p]];
      i = p;
    }
  }
  pop(): number {
    const { items, keys } = this;
    const top = items[0];
    const lastI = items.pop()!;
    const lastK = keys.pop()!;
    if (items.length) {
      items[0] = lastI;
      keys[0] = lastK;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && keys[l] < keys[m]) m = l;
        if (r < items.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        [keys[m], keys[i]] = [keys[i], keys[m]];
        i = m;
      }
    }
    return top;
  }
}
