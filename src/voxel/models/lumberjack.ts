import { VoxelModel } from '../VoxelModel';

/** Colours for the player character, kept local so they read as one palette. */
const C = {
  red: 0xc0392b,
  redDark: 0x7c1f19,
  black: 0x2a1715,
  denim: 0x3d5a8a,
  denimDark: 0x2e4670,
  boot: 0x4a2c18,
  bootSole: 0x2e1b0f,
  belt: 0x5a3a22,
  buckle: 0xe0b84a,
  skin: 0xe8b48a,
  cheek: 0xe8907a,
  eye: 0x2a1a12,
  hair: 0x7a4524,
  hairDark: 0x5e331a,
  mouth: 0xb8675a,
  beanie: 0xd9a03f,
  beanieDark: 0xb8832c,
  pompom: 0xf3ead2,
};

/** Buffalo check: black where both stripes cross, dark red where one does, red elsewhere. */
function plaid(u: number, v: number) {
  const a = (u >> 1) & 1;
  const b = (v >> 1) & 1;
  return a && b ? C.black : a || b ? C.redDark : C.red;
}

export interface LumberjackParts {
  torso: VoxelModel;
  head: VoxelModel;
  leg: VoxelModel;
  armL: VoxelModel;
  armR: VoxelModel;
}

/**
 * A friendly, gender-neutral chibi cabin-builder (tools are separate models, see stations.ts), built
 * from separate voxel parts so limbs can swing. Faces +z.
 * Units are voxels (1/16 tile). Pivots sit on the joints: hips, shoulders and the neck.
 */
export function lumberjack(): LumberjackParts {
  // Torso: 8 wide, 6 tall, 4 deep. Origin at the hips.
  const torso = new VoxelModel(8, 6, 4, { x: 4, y: 0, z: 2 });
  for (let y = 0; y < 6; y++)
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 8; x++) {
        let col = plaid(x + z, y + 1);
        if (y === 0) col = z === 3 && (x === 3 || x === 4) ? C.buckle : C.belt;
        // Collar.
        if (y === 5 && z === 3 && (x === 3 || x === 4)) col = C.skin;
        torso.grid.set(x, y, z, col);
      }

  // Head: 6 wide, 6 tall face plus a 4-tall beanie; 7 deep so the nose can poke out. A soft,
  // gender-neutral look: chin-length hair under the beanie, a side-swept fringe, no facial hair.
  const head = new VoxelModel(6, 10, 7, { x: 3, y: 0, z: 3 });
  head.box(0, 0, 0, 5, 5, 5, C.skin);
  head.box(0, 1, 0, 5, 5, 0, (_x, y) => (y === 1 ? C.hairDark : C.hair)); // back, down to the nape
  for (const x of [0, 5]) head.box(x, 1, 1, x, 5, 4, (_x, y, z) => (z === 4 && y < 3 ? C.hairDark : C.hair)); // sides to the chin
  head.box(0, 5, 5, 3, 5, 5, C.hair); // fringe swept to one side
  head.set(0, 4, 5, C.hair);
  head.set(4, 5, 5, C.hairDark);
  head.box(1, 3, 5, 1, 4, 5, C.eye); // eyes, two voxels tall
  head.box(4, 3, 5, 4, 4, 5, C.eye);
  head.set(2, 2, 6, C.skin); // small nose
  head.set(0, 2, 5, C.cheek);
  head.set(5, 2, 5, C.cheek);
  head.box(2, 1, 5, 3, 1, 5, C.mouth); // a small smile
  head.box(0, 6, 0, 5, 6, 5, C.beanieDark); // folded band
  head.box(0, 7, 0, 5, 7, 5, (x, _y, z) => ((x + z) % 2 ? C.beanie : C.beanieDark));
  head.box(1, 8, 1, 4, 8, 4, C.beanie);
  head.box(2, 9, 2, 3, 9, 3, C.pompom);
  head.grid.clear(0, 7, 0);
  head.grid.clear(5, 7, 0);
  head.grid.clear(0, 7, 5);
  head.grid.clear(5, 7, 5);

  // Leg: jeans over a boot. Origin at the hip (top), boot toe points forward.
  const leg = new VoxelModel(3, 6, 4, { x: 1.5, y: 6, z: 1.5 });
  leg.box(0, 2, 0, 2, 5, 2, (_x, y) => (y === 2 ? C.denimDark : C.denim));
  leg.box(0, 0, 0, 2, 1, 3, (_x, y) => (y === 0 ? C.bootSole : C.boot));

  // Arms: plaid sleeves with a hand. Origin at the shoulder (top).
  const arm = () => {
    const a = new VoxelModel(2, 6, 2, { x: 1, y: 6, z: 1 });
    a.box(0, 2, 0, 1, 5, 1, (x, y, z) => plaid(x + z, y));
    a.box(0, 2, 0, 1, 2, 1, C.redDark); // cuff
    a.box(0, 0, 0, 1, 1, 1, C.skin);
    return a;
  };

  return { torso, head, leg, armL: arm(), armR: arm() };
}
