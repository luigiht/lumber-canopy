import * as THREE from 'three';
import { VoxelModel } from './VoxelModel';

export interface VoxelSource {
  /** Raw cell value, 0 = empty. Must return 0 out of bounds. */
  get(x: number, y: number, z: number): number;
}

export interface MeshOptions {
  /** Inclusive-exclusive cell range to emit faces for. */
  min: [number, number, number];
  max: [number, number, number];
  /** World size of one voxel. */
  voxelSize: number;
  /** World-space offset added to every vertex (after scaling). */
  offset?: [number, number, number];
  /** Returns true when the neighbour cell hides the face. Defaults to "neighbour is filled". */
  occludes?: (x: number, y: number, z: number) => boolean;
  /** Skip faces pointing in these directions, e.g. the underside of the terrain slab. */
  skipFaces?: Partial<Record<FaceDir, boolean>>;
  /** Multiply colour per face direction for a crisp, hand-shaded look. */
  faceShade?: Partial<Record<FaceDir, number>>;
}

export type FaceDir = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

const DEFAULT_SHADE: Record<FaceDir, number> = { py: 1, ny: 0.62, px: 0.9, nx: 0.8, pz: 0.84, nz: 0.76 };
const FACE_KEYS: FaceDir[][] = [
  ['nx', 'px'],
  ['ny', 'py'],
  ['nz', 'pz'],
];

const linearCache = new Map<number, [number, number, number]>();
const tmpColor = new THREE.Color();
function toLinear(hex: number): [number, number, number] {
  let c = linearCache.get(hex);
  if (!c) {
    tmpColor.setHex(hex); // converts sRGB hex into the linear working colour space
    c = [tmpColor.r, tmpColor.g, tmpColor.b];
    linearCache.set(hex, c);
  }
  return c;
}

/**
 * Greedy mesher: merges coplanar, same-colour faces into larger quads.
 * Faces are only merged when their colours match exactly, so per-voxel colour variation survives.
 */
export function greedyMesh(src: VoxelSource, opts: MeshOptions): THREE.BufferGeometry {
  const { min, max, voxelSize: s } = opts;
  const off = opts.offset ?? [0, 0, 0];
  const occludes = opts.occludes ?? ((x, y, z) => src.get(x, y, z) !== 0);
  const shade = { ...DEFAULT_SHADE, ...opts.faceShade };

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const pos = [0, 0, 0];
  const nb = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = max[u] - min[u];
    const dv = max[v] - min[v];
    const mask = new Int32Array(du * dv);

    for (const dir of [-1, 1] as const) {
      const faceKey = FACE_KEYS[d][dir > 0 ? 1 : 0];
      if (opts.skipFaces?.[faceKey]) continue;
      const faceShade = shade[faceKey];

      for (let i = min[d]; i < max[d]; i++) {
        // Build the mask of visible faces on this slice.
        let n = 0;
        for (let b = min[v]; b < max[v]; b++) {
          for (let a = min[u]; a < max[u]; a++) {
            pos[d] = i;
            pos[u] = a;
            pos[v] = b;
            const c = src.get(pos[0], pos[1], pos[2]);
            if (c === 0) {
              mask[n++] = 0;
              continue;
            }
            nb[0] = pos[0];
            nb[1] = pos[1];
            nb[2] = pos[2];
            nb[d] += dir;
            mask[n++] = occludes(nb[0], nb[1], nb[2]) ? 0 : c;
          }
        }

        // Greedily merge rectangles of equal colour.
        n = 0;
        for (let b = 0; b < dv; b++) {
          for (let a = 0; a < du; ) {
            const c = mask[n];
            if (c === 0) {
              a++;
              n++;
              continue;
            }
            let w = 1;
            while (a + w < du && mask[n + w] === c) w++;
            let h = 1;
            outer: for (; b + h < dv; h++) {
              for (let k = 0; k < w; k++) if (mask[n + k + h * du] !== c) break outer;
            }

            // Emit quad.
            const plane = i + (dir > 0 ? 1 : 0);
            const p0 = [0, 0, 0];
            p0[d] = plane;
            p0[u] = min[u] + a;
            p0[v] = min[v] + b;
            const eu = [0, 0, 0];
            const ev = [0, 0, 0];
            eu[u] = w;
            ev[v] = h;
            const corners = [
              p0,
              [p0[0] + eu[0], p0[1] + eu[1], p0[2] + eu[2]],
              [p0[0] + eu[0] + ev[0], p0[1] + eu[1] + ev[1], p0[2] + eu[2] + ev[2]],
              [p0[0] + ev[0], p0[1] + ev[1], p0[2] + ev[2]],
            ];
            const base = positions.length / 3;
            const [r, g, bl] = toLinear(c & 0xffffff);
            const nrm = [0, 0, 0];
            nrm[d] = dir;
            for (const cr of corners) {
              positions.push(cr[0] * s + off[0], cr[1] * s + off[1], cr[2] * s + off[2]);
              normals.push(nrm[0], nrm[1], nrm[2]);
              colors.push(r * faceShade, g * faceShade, bl * faceShade);
            }
            if (dir > 0) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            else indices.push(base, base + 2, base + 1, base, base + 3, base + 2);

            for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) mask[n + k + hh * du] = 0;
            a += w;
            n += w;
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(positions.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** World units per voxel for props: 1 tile = 16 voxels. */
export const PROP_VOXEL = 1 / 16;

/** Meshes a whole model with its pivot at the origin. */
export function meshModel(model: VoxelModel, voxelSize = PROP_VOXEL): THREE.BufferGeometry {
  const g = model.grid;
  return greedyMesh(g, {
    min: [0, 0, 0],
    max: [g.sx, g.sy, g.sz],
    voxelSize,
    offset: [-model.pivot.x * voxelSize, -model.pivot.y * voxelSize, -model.pivot.z * voxelSize],
  });
}
