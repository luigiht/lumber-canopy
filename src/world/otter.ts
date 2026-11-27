import * as THREE from 'three';
import { meshModel, PROP_VOXEL } from '@/voxel/greedyMesh';
import { otter as otterModel } from '@/voxel/models/otter';
import type { NavGrid } from './nav';
import type { Terrain } from './terrain';

const V = PROP_VOXEL;
const SPEED = 2.7; // tiles per second: a little quicker than the player, so it keeps up
const STRIDE = 0.3;
/** Follow until this close, and start again past FOLLOW_FAR. */
const FOLLOW_NEAR = 1.1;
const FOLLOW_FAR = 1.7;

const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

export type OtterState = 'home' | 'following' | 'toWater' | 'diving' | 'returning' | 'waiting';

interface Dive {
  bank: [number, number];
  water: [number, number];
  t: number;
  duration: number;
}

/**
 * The river otter. Before friendship it sits at its spot on the bank; once it's your friend it
 * trots after you, and when fed it runs to the nearest bank, dives, and comes back with a find.
 */
export class Otter {
  readonly group = new THREE.Group();
  state: OtterState = 'home';
  x: number;
  z: number;
  private y: number;
  private yaw = -Math.PI / 2;
  private path: [number, number][] = [];
  private phase = 0;
  private walkBlend = 0;
  private repathAt = 0;
  private dive: Dive | null = null;
  private onReturn: (() => void) | null = null;
  /** Where to wait when the player is indoors (the porch steps). */
  private parkAt: [number, number] | null = null;
  private readonly body = new THREE.Group();
  private readonly tail: THREE.Object3D;
  private readonly legs: THREE.Object3D[] = [];

  constructor(
    private readonly nav: NavGrid,
    private readonly terrain: Terrain,
    material: THREE.Material,
    private readonly home: [number, number],
    private readonly divePoints: { bank: [number, number]; water: [number, number] }[],
  ) {
    [this.x, this.z] = home;
    this.y = nav.heightAt(this.x, this.z);
    const parts = otterModel();
    const part = (geo: THREE.BufferGeometry, px: number, py: number, pz: number) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.otter = true;
      const pivot = new THREE.Group();
      pivot.position.set(px * V, py * V, pz * V);
      pivot.add(mesh);
      this.body.add(pivot);
      return pivot;
    };
    part(meshModel(parts.body), 0, 0, 0);
    // Tail from the rump, legs under the shoulders and hips (voxels from the body's middle).
    this.tail = part(meshModel(parts.tail), 0, 3, -7.5);
    const legGeo = meshModel(parts.leg);
    for (const [lx, lz] of [[-2, 3], [2, 3], [-2, -5.5], [2, -5.5]]) this.legs.push(part(legGeo, lx, 2, lz));
    this.group.add(this.body);
    this.group.name = 'otter';
    this.sync();
  }

  /** Meshes that can be clicked. */
  get pickables() {
    return this.body.children.flatMap((p) => p.children);
  }

  get busy() {
    return this.state === 'toWater' || this.state === 'diving' || this.state === 'returning';
  }

  /** Makes friends (it starts following, appearing beside the player when it's a fresh load). */
  setFriend(on: boolean, near?: { x: number; z: number }) {
    if (!on) {
      this.state = 'home';
      this.place(this.home[0], this.home[1]);
      return;
    }
    if (this.state === 'home' && near) {
      const [x, z] = this.nav.snap(near.x + 0.8, near.z + 0.6);
      this.place(x, z);
    }
    if (!this.busy) this.state = 'following';
  }

  /** Runs to the nearest bank, dives and comes back; `onReturn` fires when it reaches the player. */
  fetch(from: { x: number; z: number }, onReturn: () => void) {
    const best = this.divePoints.reduce((a, b) =>
      Math.hypot(b.bank[0] - from.x, b.bank[1] - from.z) < Math.hypot(a.bank[0] - from.x, a.bank[1] - from.z) ? b : a,
    );
    this.onReturn = onReturn;
    this.dive = { ...best, t: 0, duration: 3.5 + Math.random() * 2 };
    this.state = 'toWater';
    this.goTo(best.bank);
  }

  /** The player went indoors: wait at this spot (unless off diving; it'll come here after). */
  park(at: [number, number]) {
    this.parkAt = at;
    if (this.state === 'following') {
      this.state = 'waiting';
      this.goTo(at);
    }
  }

  /** The player came back out. */
  resume() {
    this.parkAt = null;
    if (this.state === 'waiting') this.state = 'following';
  }

  private place(x: number, z: number) {
    this.path = [];
    this.x = x;
    this.z = z;
    this.y = this.nav.heightAt(x, z);
    this.group.visible = true;
    this.sync();
  }

  private goTo(to: [number, number]) {
    this.path = this.nav.findPath([this.x, this.z], to) ?? [];
  }

  update(dt: number, time: number, player: { x: number; z: number }) {
    const d = Math.hypot(player.x - this.x, player.z - this.z);
    switch (this.state) {
      case 'following':
        if (d > FOLLOW_FAR && time >= this.repathAt) {
          this.repathAt = time + 0.4;
          this.goTo([player.x, player.z]);
        }
        if (d < FOLLOW_NEAR) this.path = [];
        break;
      case 'toWater':
        if (!this.path.length && this.dive) this.state = 'diving';
        break;
      case 'diving':
        this.updateDive(dt);
        break;
      case 'returning': {
        const target = this.parkAt ?? ([player.x, player.z] as [number, number]);
        const td = Math.hypot(target[0] - this.x, target[1] - this.z);
        if (time >= this.repathAt && td > FOLLOW_NEAR) {
          this.repathAt = time + 0.5;
          this.goTo(target);
        }
        if (td < (this.parkAt ? 0.5 : FOLLOW_NEAR + 0.3)) {
          this.path = [];
          this.state = this.parkAt ? 'waiting' : 'following';
          const done = this.onReturn;
          this.onReturn = null;
          done?.();
        }
        break;
      }
    }

    // Walk along the path.
    let moved = 0;
    if (this.path.length && this.state !== 'diving') {
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
      if (dist > 1e-4) this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 12));
    } else if (this.state === 'following' || this.state === 'home' || this.state === 'waiting') {
      // Idle: turn to watch the player (or the river while at home).
      const lookX = this.state === 'home' ? this.x - 1 : player.x;
      const lookZ = this.state === 'home' ? this.z : player.z;
      this.yaw += angleDelta(this.yaw, Math.atan2(lookX - this.x, lookZ - this.z)) * (1 - Math.exp(-dt * 3));
    }

    // Trot: legs swing by distance. Idle: stands on all four, breathing, tail lifted and swaying.
    this.phase += (moved / STRIDE) * Math.PI * 2;
    const walking = moved > 0;
    this.walkBlend += ((walking ? 1 : 0) - this.walkBlend) * (1 - Math.exp(-dt * 10));
    const w = this.walkBlend;
    const s = Math.sin(this.phase);
    this.legs.forEach((leg, i) => (leg.rotation.x = (i % 2 === 0 ? s : -s) * (i < 2 ? 0.8 : -0.8) * w));
    this.tail.rotation.y = Math.sin(time * (walking ? 9 : 2.2)) * (walking ? 0.25 : 0.4);
    this.tail.rotation.x = 0.12 + (1 - w) * 0.12; // a little raised so it shows
    this.body.rotation.x = 0;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.03 * w + Math.sin(time * 2.6) * 0.008 * (1 - w);

    if (this.state !== 'diving') {
      const targetY = this.nav.heightAt(this.x, this.z);
      this.y += (targetY - this.y) * (1 - Math.exp(-dt * 14));
    }
    this.sync();
  }

  /** Slips into the water, swims out of sight for a while, then climbs back out with a find. */
  private updateDive(dt: number) {
    const dv = this.dive!;
    dv.t += dt;
    const waterY = this.terrain.waterHeightAt(dv.water[0], dv.water[1]);
    const enter = 0.7;
    const exit = 0.7;
    if (dv.t < enter) {
      const t = smooth(dv.t / enter);
      this.x = dv.bank[0] + (dv.water[0] - dv.bank[0]) * t;
      this.z = dv.bank[1] + (dv.water[1] - dv.bank[1]) * t;
      this.y = this.nav.heightAt(dv.bank[0], dv.bank[1]) * (1 - t) + (waterY - 0.35) * t;
      this.yaw += angleDelta(this.yaw, Math.atan2(dv.water[0] - dv.bank[0], dv.water[1] - dv.bank[1])) * 0.2;
    } else if (dv.t < enter + dv.duration) {
      this.group.visible = false;
    } else if (dv.t < enter + dv.duration + exit) {
      this.group.visible = true;
      const t = smooth((dv.t - enter - dv.duration) / exit);
      this.x = dv.water[0] + (dv.bank[0] - dv.water[0]) * t;
      this.z = dv.water[1] + (dv.bank[1] - dv.water[1]) * t;
      this.y = (waterY - 0.35) * (1 - t) + this.nav.heightAt(dv.bank[0], dv.bank[1]) * t;
      this.yaw += angleDelta(this.yaw, Math.atan2(dv.bank[0] - dv.water[0], dv.bank[1] - dv.water[1])) * 0.2;
    } else {
      this.dive = null;
      this.state = 'returning';
      this.repathAt = 0;
    }
  }

  private sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
  }
}
