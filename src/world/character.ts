import * as THREE from 'three';
import { meshModel, PROP_VOXEL } from '@/voxel/greedyMesh';
import { lumberjack } from '@/voxel/models/lumberjack';
import { hammerTool, pickaxeTool, rodTool, ROD_TIP } from '@/voxel/models/stations';
import type { ToolId } from '@/game/tools';
import type { NavGrid } from './nav';

/** How the player works while standing still: swinging a tool, or holding a fishing rod out. */
export type WorkMode = 'swing' | 'fish';

const V = PROP_VOXEL;
const SPEED = 2.2; // tiles per second
const STRIDE = 0.5; // tiles per full walk cycle

const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * The player character: a jointed voxel figure that walks along paths from the NavGrid with a
 * simple procedural walk cycle, and breathes and looks around while idle.
 */
export class Character {
  readonly group = new THREE.Group();
  x: number;
  z: number;
  private y: number;
  private yaw = Math.PI / 4;
  private path: [number, number][] = [];
  private phase = 0;
  private walkBlend = 0;
  private workBlend = 0;
  private workTarget: [number, number] | null = null;
  private workMode: WorkMode = 'swing';
  private fishBlend = 0;
  private readonly tools = new Map<ToolId, THREE.Mesh>();
  private readonly body = new THREE.Group();
  private readonly head: THREE.Object3D;
  private readonly legL: THREE.Object3D;
  private readonly legR: THREE.Object3D;
  private readonly armL: THREE.Object3D;
  private readonly armR: THREE.Object3D;

  constructor(
    private nav: NavGrid,
    x: number,
    z: number,
    material: THREE.Material,
  ) {
    this.x = x;
    this.z = z;
    this.y = nav.heightAt(x, z);
    const parts = lumberjack();
    const part = (geo: THREE.BufferGeometry, px: number, py: number, pz: number) => {
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.receiveShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(px * V, py * V, pz * V);
      pivot.add(m);
      this.body.add(pivot);
      return pivot;
    };
    part(meshModel(parts.torso), 0, 6, 0);
    this.head = part(meshModel(parts.head), 0, 12, 0);
    const legGeo = meshModel(parts.leg);
    this.legL = part(legGeo, 2, 6, 0);
    this.legR = part(legGeo, -2, 6, 0);
    this.armL = part(meshModel(parts.armL), 5, 12, 0);
    this.armR = part(meshModel(parts.armR), -5, 12, 0);
    // Tools are held in the right hand; only the selected one shows.
    for (const [id, model] of [['hammer', hammerTool()], ['rod', rodTool()], ['pickaxe', pickaxeTool()]] as const) {
      const tool = new THREE.Mesh(meshModel(model), material);
      tool.castShadow = true;
      tool.position.set(0, -4.5 * V, 1.5 * V);
      tool.visible = false;
      this.armR.add(tool);
      this.tools.set(id, tool);
    }

    this.group.add(this.body);
    this.group.name = 'lumberjack';
    this.sync();
  }

  get walking() {
    return this.path.length > 0;
  }

  walk(path: [number, number][]) {
    this.path = path.slice();
  }

  /** While set (and standing still), face this point and work: swing the tool, or fish. */
  setWorkTarget(target: [number, number] | null, mode: WorkMode = 'swing') {
    this.workTarget = target;
    this.workMode = mode;
  }

  /** Switches the surface the character walks on (outdoors, or a cabin floor). */
  setNav(nav: NavGrid) {
    this.nav = nav;
    this.path = [];
  }

  setTool(id: ToolId | null) {
    for (const [key, mesh] of this.tools) mesh.visible = key === id;
  }

  /** Puts the character at (x,z) right away, standing still. */
  place(x: number, z: number) {
    this.path = [];
    this.x = x;
    this.z = z;
    this.y = this.nav.heightAt(x, z);
    this.sync();
  }

  /** Turns to face (x,z) right away. */
  face(x: number, z: number) {
    this.yaw = Math.atan2(x - this.x, z - this.z);
    this.sync();
  }

  stop() {
    this.path = [];
  }

  /** World position of the fishing rod's tip. */
  rodTip(out: THREE.Vector3) {
    const rod = this.tools.get('rod')!;
    this.group.updateMatrixWorld(true);
    return rod.localToWorld(out.set(ROD_TIP.x * V, ROD_TIP.y * V, ROD_TIP.z * V));
  }

  update(dt: number, time: number) {
    let moved = 0;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - this.x;
      const dz = tz - this.z;
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist <= step) {
        this.x = tx;
        this.z = tz;
        moved = dist;
        this.path.shift();
      } else {
        this.x += (dx / dist) * step;
        this.z += (dz / dist) * step;
        moved = step;
      }
      if (dist > 1e-4) this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 14));
    }

    const working = !!this.workTarget && !this.walking;
    if (working) {
      const [wx, wz] = this.workTarget!;
      this.yaw += angleDelta(this.yaw, Math.atan2(wx - this.x, wz - this.z)) * (1 - Math.exp(-dt * 8));
    }
    const fishing = working && this.workMode === 'fish';
    this.workBlend += ((working && !fishing ? 1 : 0) - this.workBlend) * (1 - Math.exp(-dt * 8));
    this.fishBlend += ((fishing ? 1 : 0) - this.fishBlend) * (1 - Math.exp(-dt * 6));

    // Walk cycle driven by distance so feet don't slide.
    this.phase += (moved / STRIDE) * Math.PI * 2;
    this.walkBlend += ((this.walking ? 1 : 0) - this.walkBlend) * (1 - Math.exp(-dt * 10));
    const w = this.walkBlend;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * 0.7 * w;
    this.legR.rotation.x = -s * 0.7 * w;
    this.armL.rotation.x = -s * 0.6 * w;
    this.armR.rotation.x = s * 0.45 * w;
    // Building: raise the tool and bring it down in a steady rhythm, leaning into each strike.
    const wb = this.workBlend;
    const strike = Math.pow((Math.sin(time * 7) + 1) / 2, 2);
    this.armR.rotation.x = this.armR.rotation.x * (1 - wb) + (-2.4 + strike * 1.7) * wb;
    this.armL.rotation.x = this.armL.rotation.x * (1 - wb) + -0.5 * wb;
    // Fishing: both hands hold the rod out over the water, bobbing gently.
    const fb = this.fishBlend;
    const bob = Math.sin(time * 1.7) * 0.05;
    this.armR.rotation.x = this.armR.rotation.x * (1 - fb) + (-2.05 + bob) * fb;
    this.armL.rotation.x = this.armL.rotation.x * (1 - fb) + (-1.25 + bob) * fb;
    this.armL.rotation.z = 0.06;
    this.armR.rotation.z = -0.06;
    const breathe = Math.sin(time * 2.2) * 0.012 * (1 - w);
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * w + breathe;
    // Idle: glance around now and then; walking: look ahead.
    const glance = Math.sin(time * 0.45) * Math.max(0, Math.sin(time * 0.17)) * 0.6;
    this.head.rotation.y = glance * (1 - w) * (1 - this.workBlend);
    this.head.rotation.x = -0.05 * w + 0.15 * wb + 0.12 * fb;
    this.body.rotation.x = (1 - strike) * 0.12 * wb;

    const targetY = this.nav.heightAt(this.x, this.z);
    this.y += (targetY - this.y) * (1 - Math.exp(-dt * 16));
    this.sync();
  }

  private sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
  }
}

/** Amber square on the ground showing where the lumberjack is heading. */
export class TargetMarker {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, depthWrite: false });
  private age = 0;
  private fade = 0;

  constructor() {
    const size = 0.5;
    const t = V * 1.5;
    const bar = new THREE.BoxGeometry(size, V, t);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(bar, this.material);
      const a = (i * Math.PI) / 2;
      m.position.set(Math.sin(a) * (size / 2 - t / 2), V / 2, Math.cos(a) * (size / 2 - t / 2));
      m.rotation.y = a;
      this.group.add(m);
    }
    this.group.visible = false;
    this.group.renderOrder = 3;
  }

  show(x: number, y: number, z: number) {
    this.group.position.set(x, y + 0.01, z);
    this.age = 0;
    this.fade = 0;
    this.group.visible = true;
  }

  update(dt: number, arrived: boolean) {
    this.age += dt;
    this.fade = arrived ? this.fade + dt : 0;
    const fade = Math.max(0, 1 - this.fade * 1.5);
    this.material.opacity = 0.9 * fade;
    const pulse = 1 + Math.sin(this.age * 8) * 0.08;
    this.group.scale.set(pulse, 1, pulse);
    if (fade <= 0) this.group.visible = false;
  }
}
