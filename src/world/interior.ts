import * as THREE from 'three';
import { meshModel } from '@/voxel/greedyMesh';
import type { VoxelModel } from '@/voxel/VoxelModel';
import {
  armchair,
  bed,
  bookshelf,
  chair,
  coffeeTable,
  counter,
  floorLamp,
  groundFloor,
  loftFloor,
  nightstand,
  railing,
  rug,
  saucer,
  sofa,
  stairs,
  stovePipe,
  table,
  tableLamp,
  wall,
  wallShelf,
  wardrobe,
  woodStove,
  lowBookshelf,
  recordPlayer,
} from '@/voxel/models/interior';
import { pottedPlant } from '@/voxel/models/stations';
import { INTERIOR, interiorWalkable, type Floor } from '@/config/interior';
import { DECOR_SLOTS, STATIONS } from '@/config/stations';
import type { SpeciesId } from '@/game/plants';
import { NavGrid } from './nav';

const T = 16;
const V = 1 / T;
const { minX, maxX, minZ, maxZ, wallThickness: WT, wallHeight, floorY, loftEdgeZ, kitchenX, stairs: ST, door } = INTERIOR;

/** Marker heights above each inside station's floor. */
const MARKER_LIFT = 1.0;

interface Wall {
  mesh: THREE.Object3D;
  /** Outward normal on the ground plane. */
  nx: number;
  nz: number;
}

/**
 * The cabin interior: a cutaway two-floor room set (living room and kitchen downstairs, bedroom in
 * the loft) with furniture, warm lamps and plant spots. The walls between the camera and the room
 * hide automatically, like a dollhouse. Each floor has its own nav grid.
 */
export class Interior {
  readonly group = new THREE.Group();
  /** Floor meshes for click-to-walk; `userData.floor` says which level. */
  readonly pickables: THREE.Mesh[] = [];
  readonly navs: [NavGrid, NavGrid];
  private readonly walls: Wall[] = [];
  private readonly lamps: { light: THREE.PointLight; base: number; night: number }[] = [];
  private readonly slotPlants = new Map<number, THREE.Mesh>();
  private readonly slotSaucers = new Map<number, THREE.Mesh>();
  private readonly geoCache = new Map<string, THREE.BufferGeometry>();
  private decorKey = '';

  constructor(private readonly material: THREE.Material) {
    this.group.name = 'interior';
    this.group.visible = false;

    // Floors.
    const ground = this.add(groundFloor(Math.round((kitchenX - minX) * T)), 0, 0, 0);
    ground.userData.floor = 0;
    this.pickables.push(ground as THREE.Mesh);
    // The stairs' top step meets the loft edge, so the loft floor needs no opening.
    const loft = this.add(loftFloor(), 0, floorY[1] - 4 * V, (minZ + loftEdgeZ) / 2);
    loft.userData.floor = 1;
    this.pickables.push(loft as THREE.Mesh);
    const railLen = Math.round((ST.x0 - minX) * T);
    this.add(railing(railLen), minX + railLen / T / 2, floorY[1], loftEdgeZ - V);
    const sw = Math.round((ST.x1 - ST.x0) * T);
    const sd = Math.round((ST.z1 - ST.z0) * T);
    this.add(stairs(sw, sd, Math.round((floorY[1] - floorY[0]) * T), ST.steps), (ST.x0 + ST.x1) / 2, floorY[0], (ST.z0 + ST.z1) / 2);

    // Walls: back (-z), front (+z), left (-x), right (+x), with windows and the front door.
    const h = Math.round(wallHeight * T);
    const lenX = Math.round((maxX - minX + 2 * WT) * T);
    const lenZ = Math.round((maxZ - minZ) * T);
    const win = (centre: number, from: number, bottom: number, width = 18, height = 16) => {
      const c = Math.round((centre - from) * T);
      return { from: c - width / 2, to: c + width / 2, bottom: Math.round(bottom * T), top: Math.round(bottom * T) + height };
    };
    const xFrom = minX - WT;
    this.addWall(
      wall(lenX, h, [win(-2, xFrom, 1.3), win(2.4, xFrom, 1.8, 18, 12), win(-2, xFrom, 3.9), win(2, xFrom, 3.9)]),
      0,
      minZ - WT / 2,
      0,
      0,
      -1,
    );
    this.addWall(
      wall(lenX, h, [
        { ...win(door.x0 / 2 + door.x1 / 2, xFrom, floorY[0], Math.round((door.x1 - door.x0) * T), Math.round(door.height * T)), door: true },
        win(1.2, xFrom, 1.3),
        win(-3, xFrom, 1.3, 12),
      ]),
      0,
      maxZ + WT / 2,
      Math.PI,
      0,
      1,
    );
    // Side walls run along z; rotate a wall built along x by a quarter turn.
    const zFrom = minZ;
    // The loft window sits higher here, above the low bookshelf.
    this.addWall(wall(lenZ, h, [win(2.0, zFrom, 1.3), win(-1.5, zFrom, 4.4, 18, 14)]), minX - WT / 2, 0, Math.PI / 2, -1, 0);
    this.addWall(wall(lenZ, h, [win(-1.6, zFrom, 1.3), win(-1.5, zFrom, 3.9)]), maxX + WT / 2, 0, -Math.PI / 2, 1, 0);

    // Living room.
    const g = floorY[0];
    this.add(rug(48, 32, 0x7c3a28, 0x4d7a76), -2, g, -0.4);
    this.add(sofa(), -2, g, minZ + 15 / 32);
    this.add(coffeeTable(), -2, g, -0.67);
    this.add(woodStove(), minX + 12 / 32, g, 0.6);
    this.add(stovePipe(Math.round((wallHeight - 1.2) * T)), minX + 6 / 32 + 2 / 16, g + 14 / 16, 0.6);
    this.add(armchair(), -0.4, g, 1.42, -Math.PI / 2);
    this.add(bookshelf(), 0.05, g, minZ + 7 / 32);
    this.add(floorLamp(), -3.6, g, -1.6);
    this.lamp(-3.6, g + 1.6, -1.6, 0xffb060, 0.6, 5);
    this.lamp(minX + 0.9, g + 0.5, 0.6, 0xff8a3a, 1.2, 4); // the stove's glow

    // Kitchen.
    const cw = Math.round((3.95 - 0.9) * T);
    this.add(counter(cw), 0.9 + cw / T / 2, g, minZ + 10 / 32);
    this.add(wallShelf(36), 2.0, g + 2.05, minZ + 5 / 32);
    this.add(table(), 1.6, g, 0.6);
    this.add(chair(), 1.6, g, -0.2);
    this.add(chair(), 1.6, g, 1.4, Math.PI);
    this.lamp(2.0, g + 2.3, -0.8, 0xffc47a, 0.5, 4);

    // Bedroom loft.
    const l = floorY[1];
    const nsZ = minZ + 10 / 32;
    this.add(rug(32, 20, 0x405d86, 0xd2c4a0), 0.9, l, -1.5);
    this.add(bed(), -1.7, l, minZ + 34 / 32);
    this.add(nightstand(), -0.2, l, nsZ);
    this.add(tableLamp(), -0.2, l + 10 / 16, nsZ); // centred on the bedside table
    this.add(wardrobe(), 2.0, l, minZ + 9 / 32);
    this.lamp(-0.2, l + 1.0, nsZ + 0.3, 0xffb060, 0.4, 4);
    // Low bookshelf along the left wall, across the bed from the bedside table, with a record player on top.
    const shelfX = minX + 7 / 32;
    this.add(lowBookshelf(32), shelfX, l, -1.95, Math.PI / 2);
    this.add(recordPlayer(), shelfX, l + 18 / 16, -1.95, Math.PI / 2);

    // Plant spots: a saucer while empty, the plant once placed.
    DECOR_SLOTS.forEach((slot, i) => {
      if (!slot.interior) return;
      const s = slot.interior;
      const dish = new THREE.Mesh(this.geo('saucer', saucer), material);
      dish.position.set(s.x, s.y, s.z);
      dish.receiveShadow = true;
      this.group.add(dish);
      this.slotSaucers.set(i, dish);
      const plant = new THREE.Mesh(undefined, material);
      plant.position.set(s.x, s.y, s.z);
      plant.castShadow = true;
      plant.visible = false;
      this.group.add(plant);
      this.slotPlants.set(i, plant);
    });

    this.navs = [0, 1].map(
      (f) =>
        new NavGrid({
          size: 10,
          heightAt: () => floorY[f],
          walkable: (x, z) => interiorWalkable(f as Floor, x, z),
        }),
    ) as [NavGrid, NavGrid];
  }

  private geo(key: string, factory: () => VoxelModel) {
    let geo = this.geoCache.get(key);
    if (!geo) {
      geo = meshModel(factory());
      this.geoCache.set(key, geo);
    }
    return geo;
  }

  private add(model: VoxelModel, x: number, y: number, z: number, rotY = 0) {
    const mesh = new THREE.Mesh(meshModel(model), this.material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private addWall(model: VoxelModel, x: number, z: number, rotY: number, nx: number, nz: number) {
    const mesh = this.add(model, x, 0, z, rotY);
    // Walls don't cast shadows, so daylight still reaches the cutaway rooms.
    mesh.castShadow = false;
    this.walls.push({ mesh, nx, nz });
  }

  private lamp(x: number, y: number, z: number, color: number, base: number, night: number) {
    const light = new THREE.PointLight(color, base, 6, 1.6);
    light.position.set(x, y, z);
    this.group.add(light);
    this.lamps.push({ light, base, night });
  }

  /** Hides walls facing the camera; lamps glow brighter at night. */
  update(yaw: number, nightFactor: number) {
    const cx = Math.sin(yaw);
    const cz = Math.cos(yaw);
    for (const w of this.walls) w.mesh.visible = w.nx * cx + w.nz * cz < 0.2;
    for (const l of this.lamps) l.light.intensity = l.base + l.night * nightFactor;
  }

  /** Plants placed in the cabin; empty spots show a saucer. */
  setDecor(decor: (SpeciesId | null)[]) {
    const key = decor.join(',');
    if (key === this.decorKey) return;
    this.decorKey = key;
    for (const [i, mesh] of this.slotPlants) {
      const sp = decor[i];
      mesh.visible = !!sp;
      this.slotSaucers.get(i)!.visible = !sp;
      if (sp) mesh.geometry = this.geo(`plant:${sp}`, () => pottedPlant(sp, 3));
    }
  }

  /** Marker position for an inside station (stairs, door, plant spots). */
  markerPoint(id: string, out: THREE.Vector3) {
    const def = STATIONS.find((s) => s.id === id);
    if (!def || def.area !== 'inside') return null;
    const slot = def.slot !== undefined ? DECOR_SLOTS[def.slot]?.interior : undefined;
    const y = slot ? slot.y : floorY[def.floor ?? 0];
    return out.set(def.x, y + (slot ? 0.9 : MARKER_LIFT + 0.6), def.z);
  }
}
