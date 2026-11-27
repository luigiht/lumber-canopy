import * as THREE from 'three';
import { meshModel } from '@/voxel/greedyMesh';
import { makeRng } from '@/voxel/rng';
import { VoxelModel } from '@/voxel/VoxelModel';
import {
  GROUND_PLANT_SINK,
  compostHeap,
  deliveryBox,
  fieldBed,
  fieldFence,
  groundPlant,
  pottedPlant,
  pottingTable,
  rockPile,
  rockPileEmpty,
  taxi,
  workbench,
} from '@/voxel/models/stations';
import { ARRIVAL, DECOR_SLOTS, STATIONS, TABLE_SLOTS, type StationDef } from '@/config/stations';
import { FIELD, FIELD_BEDS } from '@/config/field';
import type { GrowthStage, SpeciesId } from '@/game/plants';
import type { NavGrid } from './nav';

const TABLE_TOP = 12 / 16;
const PORCH_DECK = 6 / 16;

/** How high above a station its world marker floats, in tiles. */
const MARKER_LIFT: Partial<Record<StationDef['kind'], number>> = {
  fishing: 0.9,
  rocks: 0.8,
  compost: 1.1,
  potting: 1.5,
  workbench: 2.1,
  delivery: 2.0,
  door: 2.6,
  tree: 1.7,
  field: 0.7,
};

/** Plants in the field are a little smaller than potted ones, to fit their beds. */
const BED_PLANT_SCALE = 0.75;

/**
 * Everything the player uses in the world, plus the plants on display: stone piles (full or
 * gathered), the compost heap, potting table (with growing pots on top), workbench, delivery box,
 * decoration slots around the cabin, the taxi and the fishing bobber.
 */
export class Stations {
  readonly group = new THREE.Group();
  /** Meshes that can be clicked; each has `userData.stationId`. */
  readonly pickables: THREE.Object3D[] = [];
  readonly taxi: THREE.Mesh;
  readonly bobber: THREE.Mesh;
  readonly line: THREE.Line;
  private readonly geoCache = new Map<string, THREE.BufferGeometry>();
  private readonly rocksFull: THREE.Mesh[] = [];
  private readonly rocksEmpty: THREE.Mesh[] = [];
  private readonly decor: THREE.Mesh[] = [];
  private readonly tablePots: THREE.Mesh[] = [];
  private readonly beds: THREE.Mesh[] = [];
  private readonly bedPlants: THREE.Mesh[] = [];
  private fieldKey = '';
  private readonly positions = new Map<string, THREE.Vector3>();
  private decorKey = '';
  private tableKey = '';

  constructor(
    private readonly nav: NavGrid,
    private readonly material: THREE.Material,
    private readonly cabinGroundY: number,
  ) {
    let rockIndex = 0;
    for (const def of STATIONS) {
      if (def.area === 'inside') continue; // see Interior
      const y = def.kind === 'door' ? cabinGroundY + PORCH_DECK : nav.heightAt(def.x, def.z);
      this.positions.set(def.id, new THREE.Vector3(def.x, y, def.z));
      // The bridge, the cabin door and the seed trees are already in the world.
      if (def.kind === 'fishing' || def.kind === 'door' || def.kind === 'tree') continue;
      if (def.kind === 'field') {
        // The fence is always up; the beds inside appear as the field is built.
        this.mesh('fieldFence', fieldFence, def, y);
        continue;
      }
      if (def.kind === 'rocks') {
        const i = rockIndex++;
        const full = this.mesh(`rocks:${i}`, () => rockPile(makeRng(400 + i)), def, y);
        const empty = this.mesh(`rocksEmpty:${i}`, () => rockPileEmpty(makeRng(500 + i)), def, y);
        empty.visible = false;
        this.rocksFull.push(full);
        this.rocksEmpty.push(empty);
        continue;
      }
      const factories: Partial<Record<StationDef['kind'], () => VoxelModel>> = {
        compost: compostHeap,
        potting: pottingTable,
        workbench,
        delivery: deliveryBox,
      };
      const factory = factories[def.kind];
      if (factory) this.mesh(def.kind, factory, def, y);
    }

    for (const slot of DECOR_SLOTS) {
      const m = new THREE.Mesh(undefined, material);
      if (slot.interior) {
        this.decor.push(m); // keeps indices aligned; interior plants are drawn by Interior
        continue;
      }
      const y = slot.porch ? cabinGroundY + PORCH_DECK : nav.heightAt(slot.x, slot.z);
      m.position.set(slot.x, y, slot.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      this.decor.push(m);
      this.group.add(m);
    }

    const table = STATIONS.find((s) => s.kind === 'potting')!;
    const tableY = this.positions.get(table.id)!.y + TABLE_TOP;
    for (const [ox, oz] of TABLE_SLOTS) {
      const m = new THREE.Mesh(undefined, material);
      m.position.set(table.x + ox, tableY, table.z + oz);
      m.scale.setScalar(0.85);
      m.castShadow = true;
      m.visible = false;
      this.tablePots.push(m);
      this.group.add(m);
    }

    const fieldY = nav.heightAt(FIELD.x, FIELD.z);
    for (const [ox, oz] of FIELD_BEDS) {
      const bed = new THREE.Mesh(this.geo('fieldBed', fieldBed), material);
      bed.position.set(FIELD.x + ox, fieldY, FIELD.z + oz);
      bed.castShadow = true;
      bed.receiveShadow = true;
      bed.visible = false;
      bed.userData.stationId = 'field';
      this.beds.push(bed);
      this.pickables.push(bed);
      const plant = new THREE.Mesh(undefined, material);
      plant.position.set(FIELD.x + ox, fieldY - (GROUND_PLANT_SINK / 16) * BED_PLANT_SCALE, FIELD.z + oz);
      plant.scale.setScalar(BED_PLANT_SCALE);
      plant.castShadow = true;
      plant.visible = false;
      this.bedPlants.push(plant);
      this.group.add(bed, plant);
    }

    this.taxi = new THREE.Mesh(this.geo('taxi', taxi), material);
    this.taxi.castShadow = true;
    this.taxi.position.set(ARRIVAL.taxiStop.x, nav.heightAt(ARRIVAL.taxiStop.x, 0), ARRIVAL.taxiFrom);
    this.taxi.visible = false;
    this.group.add(this.taxi);

    const bob = new VoxelModel(2, 3, 2, { x: 1, y: 1, z: 1 });
    bob.box(0, 0, 0, 1, 0, 1, 0xf3f2ec);
    bob.box(0, 1, 0, 1, 2, 1, 0xc0392b);
    this.bobber = new THREE.Mesh(meshModel(bob), material);
    this.bobber.visible = false;
    this.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xe8e2d0, transparent: true, opacity: 0.8 }),
    );
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.group.add(this.bobber, this.line);
  }

  private geo(key: string, factory: () => VoxelModel) {
    let g = this.geoCache.get(key);
    if (!g) {
      g = meshModel(factory());
      this.geoCache.set(key, g);
    }
    return g;
  }

  private mesh(key: string, factory: () => VoxelModel, def: StationDef, y: number) {
    const m = new THREE.Mesh(this.geo(key, factory), this.material);
    m.position.set(def.x, y, def.z);
    m.rotation.y = ((def.rot ?? 0) * Math.PI) / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.stationId = def.id;
    m.name = `station-${def.id}`;
    this.group.add(m);
    this.pickables.push(m);
    return m;
  }

  /**
   * Ground rectangles of the furniture-like stations (potting table, workbench, compost heap,
   * delivery box) and the garden field, so the player and the otter walk around them instead of
   * over them. The field's fence encloses its beds, built or not.
   */
  footprints() {
    const solid = new Set(['potting', 'workbench', 'compost', 'delivery', 'field']);
    const box = new THREE.Box3();
    return this.pickables
      .filter((m) => solid.has(STATIONS.find((s) => s.id === m.userData.stationId)?.kind ?? ''))
      .map((m) => {
        m.updateMatrixWorld(true);
        box.setFromObject(m);
        return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
      });
  }

  /** Where a station's world marker floats. */
  markerPoint(id: string, out: THREE.Vector3) {
    const p = this.positions.get(id);
    const def = STATIONS.find((s) => s.id === id);
    if (!p || !def) return null;
    return out.set(p.x, p.y + (MARKER_LIFT[def.kind] ?? 1), p.z);
  }

  /** Shows each pile full, half gathered or empty. */
  setRocks(nodes: { left: number; max: number }[]) {
    nodes.forEach((n, i) => {
      const full = this.rocksFull[i];
      const empty = this.rocksEmpty[i];
      if (!full || !empty) return;
      full.visible = n.left > 0;
      empty.visible = n.left <= 0;
      full.scale.set(1, n.left <= n.max / 2 ? 0.6 : 1, 1);
    });
  }

  /** Plants on display around the cabin; porch slots only show once the cabin is finished. */
  setDecor(decor: (SpeciesId | null)[], cabinDone: boolean) {
    const key = `${decor.join(',')}|${cabinDone}`;
    if (key === this.decorKey) return;
    this.decorKey = key;
    decor.forEach((sp, i) => {
      const m = this.decor[i];
      if (!m) return;
      const show = !!sp && !DECOR_SLOTS[i].interior && (!DECOR_SLOTS[i].porch || cabinDone);
      m.visible = show;
      if (show) m.geometry = this.geo(`plant:${sp}:3`, () => pottedPlant(sp!, 3));
    });
  }

  /** The garden field: an empty fenced patch until it's built, then its open beds and what grows in them. */
  setField(openBeds: number, beds: ({ species: SpeciesId; stage: GrowthStage } | null)[]) {
    const key = `${openBeds}|${beds.map((b) => (b ? `${b.species}${b.stage}` : '-')).join(',')}`;
    if (key === this.fieldKey) return;
    this.fieldKey = key;
    this.beds.forEach((bed, i) => {
      const open = i < openBeds;
      bed.visible = open;
      const b = open ? beds[i] : null;
      const plant = this.bedPlants[i];
      plant.visible = !!b;
      if (b) plant.geometry = this.geo(`ground:${b.species}:${b.stage}`, () => groundPlant(b.species, b.stage));
    });
  }

  /** Pots growing on the potting table. */
  setTablePots(pots: { species: SpeciesId; stage: GrowthStage }[]) {
    const key = pots.map((p) => `${p.species}${p.stage}`).join(',');
    if (key === this.tableKey) return;
    this.tableKey = key;
    this.tablePots.forEach((m, i) => {
      const p = pots[i];
      m.visible = !!p;
      if (p) m.geometry = this.geo(`plant:${p.species}:${p.stage}`, () => pottedPlant(p.species, p.stage));
    });
  }
}
