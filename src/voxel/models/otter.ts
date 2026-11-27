import { VoxelModel } from '../VoxelModel';

/** Colours for the otter, kept local so it reads as one character. */
const C = {
  fur: 0x6b4a32,
  furLight: 0x80593c,
  furDark: 0x4e3524,
  belly: 0xc9b089,
  nose: 0x241812,
  eye: 0x15100c,
  whisker: 0xe8dcc0,
};

export interface OtterParts {
  body: VoxelModel;
  tail: VoxelModel;
  leg: VoxelModel;
}

/**
 * A small river otter built from separate parts so it can trot and wag its tail. Faces +z.
 * Units are voxels (1/16 tile). Body pivot sits on the ground under its middle.
 */
export function otter(): OtterParts {
  // Long, low body (17 voxels nose to rump, 6 wide) with the head at the front (+z).
  const body = new VoxelModel(6, 7, 17, { x: 3, y: 0, z: 8.5 });
  body.box(0, 1, 1, 5, 4, 12, (x, y) => (y === 4 ? C.furLight : x === 0 || x === 5 ? C.furDark : C.fur));
  body.box(1, 1, 2, 4, 1, 11, C.belly);
  for (const [x, z] of [[0, 1], [5, 1], [0, 12], [5, 12]]) {
    body.grid.clear(x, 4, z);
    body.grid.clear(x, 1, z);
  }
  // Head, slightly narrower than the body.
  body.box(1, 2, 12, 4, 5, 15, (_x, y) => (y === 5 ? C.furLight : C.fur));
  body.box(1, 2, 15, 4, 3, 15, C.belly); // chin and cheeks
  body.box(2, 2, 16, 3, 4, 16, C.belly); // muzzle
  body.set(2, 4, 16, C.nose);
  body.set(3, 4, 16, C.nose);
  body.set(1, 4, 15, C.eye);
  body.set(4, 4, 15, C.eye);
  body.set(1, 6, 13, C.furDark); // ears
  body.set(4, 6, 13, C.furDark);
  body.set(0, 3, 15, C.whisker); // whiskers
  body.set(5, 3, 15, C.whisker);

  // Long tapering tail, pivot at its base; it points back (-z).
  const tail = new VoxelModel(2, 2, 10, { x: 1, y: 1, z: 10 });
  tail.box(0, 0, 5, 1, 1, 9, C.fur);
  tail.box(0, 0, 2, 1, 0, 4, C.furDark);
  tail.box(0, 0, 0, 0, 0, 1, C.furDark);

  // Short leg with a dark paw; pivot at the hip (top).
  const leg = new VoxelModel(2, 2, 2, { x: 1, y: 2, z: 1 });
  leg.box(0, 1, 0, 1, 1, 1, C.fur);
  leg.box(0, 0, 0, 1, 0, 1, C.furDark);

  return { body, tail, leg };
}
