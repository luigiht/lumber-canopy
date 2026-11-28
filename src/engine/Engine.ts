import * as THREE from 'three';
import { BRIDGE } from '@/voxel/models/ground';
import { IsoCamera } from './IsoCamera';
import { DayNight } from './DayNight';
import { Terrain } from '@/world/terrain';
import { Water } from '@/world/water';
import { Ground, Props } from '@/world/props';
import { FarTerrain } from '@/world/farTerrain';
import { Mist } from '@/world/mist';
import { installRadialFog } from './radialFog';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from './OutlinePass';
import { createGradePass } from './GradePass';
import { toonMaterial } from './toon';
import { DebugConsole } from './DebugConsole';
import { BODY, NavGrid, type Deck } from '@/world/nav';
import { Character, TargetMarker, type WorkMode } from '@/world/character';
import { Cabin } from '@/world/cabin';
import { Stations } from '@/world/stations';
import { Interior } from '@/world/interior';
import { Otter } from '@/world/otter';
import { INTERIOR_SPOTS, type Floor } from '@/config/interior';
import { CABIN } from '@/config/cabin';
import { ARRIVAL, GATE_X, TAXI_LANE, stationById } from '@/config/stations';
import type { BuildState } from '@/game/store';
import type { CabinSave } from '@/game/save';
import type { ToolId } from '@/game/tools';
import { WORLD, roadCenterX, roadSlope } from '@/config/world';

export interface EngineEvents {
  onHour?: (hour: number, day: number, elapsed: number) => void;
  onRotate?: (quarter: number) => void;
  onBuild?: (state: BuildState) => void;
  /** Pay for a cabin stage's materials. Return true if the player had them (and they were used). */
  payStage?: (stageIndex: number) => boolean;
  /** The player reached a station they were sent to. */
  onArrive?: (stationId: string) => void;
  /** The player clicked somewhere and started walking. */
  onWalk?: () => void;
  /** The player tried to go past the gate (cabin side) before it opened. */
  onGate?: () => void;
  /** The taxi intro finished and the player has control. */
  onArrivalDone?: () => void;
  /** The player went inside or outside the cabin, or changed floor. */
  onArea?: (inside: boolean, floor: Floor) => void;
  /** A timed task stopped early because the player walked away. */
  onTaskCancel?: () => void;
}

interface Task {
  stationId: string;
  face: [number, number];
  mode: WorkMode;
  duration: number;
  t: number;
  onDone?: () => void;
}

interface Arrival {
  phase: 'in' | 'stop' | 'out';
  t: number;
}

/** Where the player stands outside the front door (bottom of the porch steps). */
const CABIN_DOOR_SPOT: [number, number] = stationById('door')!.spot;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t ** 2.4;

/** Owns the renderer, scene and frame loop. React only mounts it and talks to it through methods. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly iso: IsoCamera;
  readonly dayNight: DayNight;
  readonly terrain: Terrain;
  readonly props: Props;
  private readonly water: Water;
  private readonly composer: EffectComposer;
  private readonly outline: OutlinePass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  readonly mist: Mist;
  nav: NavGrid;
  readonly character: Character;
  readonly stations: Stations;
  private readonly marker = new TargetMarker();
  readonly cabin: Cabin;
  private headingToSite = false;
  private buildEmitAt = 0;
  private lastBuildKey = '';
  private paidStage = -1;
  private payRetryAt = 0;
  private buildSpeed = 1;
  private pending: string | null = null;
  private task: Task | null = null;
  private arrival: Arrival | null = null;
  private gate = false;
  readonly otter: Otter;
  /** Everything outdoors; hidden while inside the cabin. */
  private readonly outside = new THREE.Group();
  readonly interior: Interior;
  private navOutside!: NavGrid;
  private inside = false;
  private floor: Floor = 0;
  private outsideView: { x: number; z: number; zoom: number } | null = null;
  /** No clicks or keys move the player (during the taxi intro, or before the game starts). */
  inputLocked = true;
  private readonly pickables: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly timer = new THREE.Timer();
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private time = 0;
  private hourEmitAt = 0;
  private readonly debug: DebugConsole;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    private readonly events: EngineEvents = {},
  ) {
    installRadialFog();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Several passes render per frame; count them all and reset once per frame.
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    // The cabin rises layer by layer using clipping planes.
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Wide enough bounds to look over the road on the far side of the river.
    this.iso = new IsoCamera(15);
    this.iso.onRotate = (q) => this.events.onRotate?.(q);
    this.iso.attach(this.renderer.domElement);
    this.dayNight = new DayNight(this.scene, WORLD.mist.near, WORLD.mist.far);

    const voxelMaterial = toonMaterial();
    this.terrain = new Terrain();
    const far = new FarTerrain(this.terrain);
    this.terrain.outsideHeight = (x, z) => far.heightAt(x, z);
    this.outside.add(far.buildMesh());
    for (const m of this.terrain.buildTerrainMeshes(voxelMaterial)) {
      this.outside.add(m);
      this.pickables.push(m);
    }
    this.water = new Water(this.terrain);
    this.outside.add(this.water.group);
    this.pickables.push(this.water.group);
    this.props = new Props(new Ground(this.terrain, far), voxelMaterial);
    this.outside.add(this.props.group);

    // The player walks on the ground and across bridge decks.
    const decks: Deck[] = this.props.instances
      .filter((p) => p.model === 'bridge')
      .map((b) => {
        // Bridges run along x (rot 0); the deck is narrower than the abutments.
        const hx = BRIDGE.length / 32;
        const hz = BRIDGE.deckWidth / 32;
        return {
          minX: b.x - hx,
          maxX: b.x + hx,
          minZ: b.z - hz,
          maxZ: b.z + hz,
          y: b.y + BRIDGE.deckTop / 16,
          arch: BRIDGE.arch / 16,
          // Keep a body's width inside the railings; block the railings, pillars and the bank beside them.
          lane: hz - BODY - 0.05,
          fence: BRIDGE.width / 32 + BODY,
        };
      });
    for (const [key, mesh] of this.props.meshes) if (key.startsWith('bridge')) this.pickables.push(mesh);
    this.nav = NavGrid.forWorld(this.terrain, this.props.instances, decks);
    const cabinY = this.terrain.heightAt(CABIN.x, CABIN.z);
    this.cabin = new Cabin(cabinY);
    this.outside.add(this.cabin.group);
    this.stations = new Stations(this.nav, voxelMaterial, cabinY);
    // Benches, the compost heap, the delivery box and the garden field are solid: paths (the player's and the otter's) go around them.
    for (const r of this.stations.footprints()) this.nav.blockRect(r);
    this.otter = this.createOtter(voxelMaterial);
    this.outside.add(this.otter.group);
    this.outside.add(this.stations.group);
    const [sx, sz] = this.nav.snap(ARRIVAL.spawn.x, ARRIVAL.spawn.z);
    this.character = new Character(this.nav, sx, sz, voxelMaterial);
    this.character.group.visible = false;
    this.scene.add(this.character.group, this.marker.group);
    this.iso.onTap = (x, y) => this.onTap(x, y);
    this.mist = new Mist(WORLD, this.terrain);
    this.outside.add(this.mist.mesh);
    this.navOutside = this.nav;
    this.interior = new Interior(voxelMaterial);
    this.scene.add(this.outside, this.interior.group);

    // Illustrated look: render into a multisampled target with depth, ink the outlines, let lamps
    // bloom a little at night, then grade the colours for the moody atmosphere.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.iso.camera));
    this.outline = new OutlinePass(this.iso.camera);
    this.outline.uniforms.fogNear.value = WORLD.mist.near;
    this.outline.uniforms.fogFar.value = WORLD.mist.far;
    this.composer.addPass(this.outline);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.5, 0.55);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = createGradePass();
    this.composer.addPass(this.grade);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.debug = new DebugConsole(container, this.renderer, () => ({
      hour: this.dayNight.hour.toFixed(2),
      day: this.dayNight.day,
      night: this.dayNight.nightFactor.toFixed(2),
      camera: `quarter ${this.iso.quarter}  target ${this.iso.target.x.toFixed(1)}, ${this.iso.target.z.toFixed(1)}`,
      cabin: `${this.cabin.phase} ${Math.round(this.cabin.progress * 100)}%`,
      player: `${this.character.x.toFixed(2)}, ${this.character.z.toFixed(2)}${this.character.walking ? '  walking' : ''}`,
    }));
    this.loop();
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.outline.uniforms.thickness.value = 1.6 * this.renderer.getPixelRatio();
    this.composer.setSize(w, h);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.iso.resize(w, h);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.renderer.info.reset();
    this.time += dt;
    this.dayNight.update(dt);
    this.iso.update(dt);
    this.water.update(dt, this.time);
    this.updateArrival(dt);
    this.updatePending();
    this.updateBuild(dt);
    this.updateTask(dt);
    this.character.update(dt, this.time);
    // Indoors the otter waits on the porch; its own state machine handles walking there.
    this.otter.update(dt, this.time, this.inside ? { x: CABIN_DOOR_SPOT[0], z: CABIN_DOOR_SPOT[1] } : this.character);
    this.updateFishingLine();
    this.marker.update(dt, !this.character.walking);
    if (this.inside) this.interior.update(this.iso.yawAngle, this.dayNight.nightFactor);
    this.mist.update(dt, this.time, this.dayNight.hour, this.dayNight.background, this.dayNight.nightFactor, this.iso.yawAngle);
    this.outline.uniforms.fogColor.value.copy(this.dayNight.background);
    const glow = this.dayNight.nightFactor * 0.6;
    this.bloom.strength = glow;
    this.bloom.enabled = glow > 0.02;
    this.composer.render(dt);
    this.debug.frame(dt);

    if (this.time >= this.hourEmitAt) {
      this.hourEmitAt = this.time + 0.25;
      this.events.onHour?.(this.dayNight.hour, this.dayNight.day, this.dayNight.elapsed);
    }
  };

  // ---- Arrival by taxi ------------------------------------------------------------------------

  /** Plays the taxi drop-off on the road, then hands control to the player. */
  playArrival() {
    this.inputLocked = true;
    this.character.group.visible = false;
    this.stations.taxi.visible = true;
    this.placeTaxi(ARRIVAL.taxiFrom);
    this.iso.focus(ARRIVAL.taxiStop.x - 2.5, ARRIVAL.taxiStop.z);
    this.arrival = { phase: 'in', t: 0 };
  }

  /** Puts the taxi at `z` along the road, in its lane and facing along the curve. */
  private placeTaxi(z: number) {
    const taxi = this.stations.taxi;
    const slope = roadSlope(z);
    // Lane offset is perpendicular to the road, so it follows the bends.
    const n = Math.hypot(1, slope);
    const x = roadCenterX(z) + TAXI_LANE / n;
    taxi.position.set(x, this.terrain.heightAt(x, z) + this.groundOutside(x, z), z - (TAXI_LANE * slope) / n);
    taxi.rotation.y = Math.atan2(slope, 1);
  }

  /** Far-terrain height where the detailed terrain doesn't reach (the road continues into the mist). */
  private groundOutside(x: number, z: number) {
    return this.terrain.colAt(x, z) < 0 ? this.terrain.outsideHeight(x, z) : 0;
  }

  private updateArrival(dt: number) {
    const a = this.arrival;
    if (!a) return;
    a.t += dt;
    const taxi = this.stations.taxi;
    const { taxiFrom, taxiTo, taxiStop, spawn } = ARRIVAL;
    if (a.phase === 'in') {
      const t = Math.min(1, a.t / 4.2);
      this.placeTaxi(taxiFrom + (taxiStop.z - taxiFrom) * easeOut(t));
      if (t >= 1) Object.assign(a, { phase: 'stop', t: 0 });
    } else if (a.phase === 'stop') {
      if (a.t > 0.5 && !this.character.group.visible) {
        const [sx, sz] = this.nav.snap(spawn.x, spawn.z);
        this.character.place(sx, sz);
        this.character.face(GATE_X, ARRIVAL.spawn.z - 0.6);
        this.character.group.visible = true;
      }
      if (a.t > 1.3) Object.assign(a, { phase: 'out', t: 0 });
    } else {
      const t = Math.min(1, a.t / 3.4);
      this.placeTaxi(taxiStop.z + (taxiTo - taxiStop.z) * easeIn(t));
      if (t >= 1) {
        taxi.visible = false;
        this.arrival = null;
        this.inputLocked = false;
        this.events.onArrivalDone?.();
      }
    }
  }

  // ---- Saving and restoring -------------------------------------------------------------------

  /** Restores a saved game: clock, cabin, where the player stood. */
  restore(save: { clock: { hour: number; day: number; elapsed: number }; cabin: CabinSave; player: { x: number; z: number } | null }) {
    this.dayNight.day = save.clock.day;
    this.dayNight.elapsed = save.clock.elapsed;
    this.setHour(save.clock.hour);
    this.cabin.restore(save.cabin.phase, save.cabin.stageIndex, save.cabin.stageT);
    if (this.cabin.phase !== 'plot') this.nav.blockRect(this.cabin.footprint);
    this.paidStage = save.cabin.paidStage;
    const p = save.player ?? ARRIVAL.spawn;
    const [x, z] = this.nav.snap(p.x, p.z);
    this.character.place(x, z);
    this.character.group.visible = true;
    this.iso.focus(x - 2, z);
    this.inputLocked = false;
  }

  /** The parts of the save the engine owns. */
  snapshot() {
    return {
      clock: { hour: this.dayNight.hour, day: this.dayNight.day, elapsed: this.dayNight.elapsed },
      cabin: {
        phase: this.cabin.phase,
        stageIndex: this.cabin.stageIndex,
        stageT: this.cabin.stageT,
        paidStage: this.paidStage,
      } satisfies CabinSave,
      // Saved games always resume outdoors: just outside the door if you were inside.
      player: this.inside
        ? { x: CABIN_DOOR_SPOT[0], z: CABIN_DOOR_SPOT[1] }
        : this.character.group.visible
          ? { x: this.character.x, z: this.character.z }
          : null,
    };
  }

  // ---- Player commands ------------------------------------------------------------------------

  /** While on, the player can't cross to the cabin side of the river. */
  setGate(on: boolean) {
    this.gate = on;
  }

  setTool(id: ToolId | null) {
    this.character.setTool(id);
  }

  /** Cabin build speed from the hammer level. */
  setBuildSpeed(mult: number) {
    this.buildSpeed = mult;
  }

  /** Display brightness (1 = default). */
  setBrightness(value: number) {
    this.grade.uniforms.brightness.value = value;
  }

  private blockedByGate(x: number) {
    if (this.gate && !this.inside && x < GATE_X) {
      this.events.onGate?.();
      return true;
    }
    return false;
  }

  private walkPath(to: [number, number]) {
    const path = this.nav.findPath([this.character.x, this.character.z], to);
    if (!path) return false;
    this.character.walk(path);
    const [tx, tz] = path[path.length - 1];
    this.marker.show(tx, this.nav.heightAt(tx, tz), tz);
    return true;
  }

  /** Sends the player to a station; `onArrive` fires when they get there. */
  goTo(stationId: string) {
    const def = stationById(stationId);
    if (!def || this.inputLocked || this.blockedByGate(def.spot[0])) return false;
    // Stations belong to one place: outdoors, or one floor of the cabin.
    if ((def.area === 'inside') !== this.inside || (this.inside && (def.floor ?? 0) !== this.floor)) return false;
    this.stopTask();
    if (!this.walkPath(def.spot)) return false;
    this.pending = stationId;
    this.headingToSite = false;
    return true;
  }

  /** Sends the player to the cabin site to build. */
  goBuild() {
    if (this.inputLocked || this.inside || this.blockedByGate(CABIN.workSpot.x)) return;
    this.stopTask();
    this.pending = null;
    if (this.walkPath([CABIN.workSpot.x, CABIN.workSpot.z])) this.headingToSite = true;
  }

  /** Works at a station for `seconds` (swinging the held tool), then calls `onDone`. */
  work(stationId: string, seconds: number, onDone: () => void) {
    const def = stationById(stationId);
    if (!def) return;
    this.task = { stationId, face: def.face, mode: 'swing', duration: seconds, t: 0, onDone };
  }

  /** Holds the rod out over the water until `stopTask`. */
  fish(stationId: string) {
    const def = stationById(stationId);
    if (!def) return;
    this.task = { stationId, face: def.face, mode: 'fish', duration: Infinity, t: 0 };
  }

  stopTask() {
    this.task = null;
  }

  /** The current timed task, for progress bars. */
  get taskState() {
    const t = this.task;
    return t ? { stationId: t.stationId, mode: t.mode, progress: Number.isFinite(t.duration) ? t.t / t.duration : 0 } : null;
  }

  private updatePending() {
    if (!this.pending || this.character.walking) return;
    const id = this.pending;
    if (id === 'otter') {
      this.pending = null;
      const o = this.otter;
      if (Math.hypot(this.character.x - o.x, this.character.z - o.z) < 1.8) {
        this.character.face(o.x, o.z);
        this.events.onArrive?.('otter');
      }
      return;
    }
    const def = stationById(this.pending);
    this.pending = null;
    if (def && Math.hypot(this.character.x - def.spot[0], this.character.z - def.spot[1]) < 1.2) {
      this.character.face(def.face[0], def.face[1]);
      this.events.onArrive?.(id);
    }
  }

  private updateTask(dt: number) {
    const t = this.task;
    if (!t) return;
    if (this.character.walking) {
      this.task = null;
      this.events.onTaskCancel?.();
      return;
    }
    t.t += dt;
    if (t.t >= t.duration) {
      this.task = null;
      t.onDone?.();
    }
  }

  private updateFishingLine() {
    const { bobber, line } = this.stations;
    const fishing = this.task?.mode === 'fish';
    bobber.visible = fishing;
    line.visible = fishing;
    if (!fishing) return;
    const [fx, fz] = this.task!.face;
    const bob = Math.sin(this.time * 2.4) * 0.02;
    bobber.position.set(fx, this.terrain.waterHeightAt(fx, fz) + bob, fz);
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    this.character.rodTip(this.tmp);
    pos.setXYZ(0, this.tmp.x, this.tmp.y, this.tmp.z);
    pos.setXYZ(1, bobber.position.x, bobber.position.y + 0.1, bobber.position.z);
    pos.needsUpdate = true;
  }

  // ---- Cabin build ----------------------------------------------------------------------------

  private atSite() {
    const c = this.character;
    return !c.walking && Math.hypot(c.x - CABIN.workSpot.x, c.z - CABIN.workSpot.z) < 0.6;
  }

  /** Pays for, advances and reports the cabin build; being at the work spot is what builds. */
  private updateBuild(dt: number) {
    const cabin = this.cabin;
    const here = !this.inside && this.atSite() && !this.task && this.character.group.visible;
    // Each stage's materials are used when work on it begins.
    const unpaid = cabin.phase !== 'done' && this.paidStage < cabin.stageIndex;
    if (unpaid && here && this.time >= this.payRetryAt) {
      this.payRetryAt = this.time + 0.5;
      if (this.events.payStage?.(cabin.stageIndex)) this.paidStage = cabin.stageIndex;
    }
    const waiting = cabin.phase !== 'done' && this.paidStage < cabin.stageIndex;
    if (cabin.phase === 'plot' && here && !waiting) {
      cabin.start();
      this.nav.blockRect(cabin.footprint);
    }
    // "Heading to build" ends once they arrive or stop somewhere else.
    if (here || !this.character.walking) this.headingToSite = false;
    const working = cabin.phase === 'building' && here && !waiting;
    cabin.update(dt, this.time, this.dayNight.nightFactor, working, this.buildSpeed);
    if (this.task) this.character.setWorkTarget(this.task.face, this.task.mode);
    else this.character.setWorkTarget(working ? [CABIN.x, CABIN.z] : null);

    if (this.time < this.buildEmitAt) return;
    this.buildEmitAt = this.time + 0.1;
    const state: BuildState = {
      phase: cabin.phase,
      stageName: cabin.stage.name,
      stageNumber: Math.min(cabin.stageIndex + 1, cabin.stages.length),
      stageCount: cabin.stages.length,
      progress: cabin.progress,
      paused: cabin.phase === 'building' && !here,
      heading: this.headingToSite,
      waiting: waiting && here,
      stagePaid: this.paidStage >= cabin.stageIndex,
    };
    const key = JSON.stringify(state);
    if (key !== this.lastBuildKey) {
      this.lastBuildKey = key;
      this.events.onBuild?.(state);
    }
  }

  // ---- Screen anchors -------------------------------------------------------------------------

  /** Screen position (CSS px, relative to the canvas) of a world point, or null if off-screen. */
  toScreen(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.iso.camera);
    if (v.z < -1 || v.z > 1) return null;
    const el = this.renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight };
  }

  /** Where build prompts are anchored: above the work spot. */
  buildAnchor() {
    const { x, z } = CABIN.workSpot;
    return this.toScreen(x, this.nav.heightAt(x, z) + 1.9, z);
  }

  /** Where a station's marker floats on screen. */
  stationAnchor(id: string) {
    const p = this.inside ? this.interior.markerPoint(id, this.tmp) : this.stations.markerPoint(id, this.tmp);
    return p ? this.toScreen(p.x, p.y, p.z) : null;
  }

  /** Just above the player's head, for task progress. */
  // ---- Otter ----------------------------------------------------------------------------------

  /**
   * The otter's spot on the east bank just downstream of the bridge (reachable during the
   * tutorial), and dive points on both banks of the play area.
   */
  private createOtter(material: THREE.Material) {
    const { stream } = WORLD;
    const bankOffset = stream.halfWidth + 0.45;
    const bankAt = (z: number, side: 1 | -1): [number, number] =>
      this.nav.snap(this.terrain.streamXAt(z) + side * bankOffset, z);
    const home = bankAt(2.6, 1);
    // Only banks the otter can actually walk to (some are boxed in by the rock ledge or trees).
    const divePoints = [-5, -2.6, 2, 5.2, 9]
      .flatMap((z) =>
        ([1, -1] as const).map((side) => ({ bank: bankAt(z, side), water: [this.terrain.streamXAt(z), z] as [number, number] })),
      )
      .filter((d) => this.nav.findPath(home, d.bank) !== null);
    return new Otter(this.nav, this.terrain, material, home, divePoints);
  }

  /** Friendship on: the otter follows the player. */
  setOtterFriend(on: boolean) {
    this.otter.setFriend(on, this.character);
  }

  /** Sends the otter to fetch something from the river; `onReturn` fires when it's back. */
  otterFetch(onReturn: () => void) {
    this.otter.fetch(this.inside ? { x: CABIN_DOOR_SPOT[0], z: CABIN_DOOR_SPOT[1] } : this.character, onReturn);
  }

  /** Walks the player over to the otter; `onArrive('otter')` fires there. */
  goToOtter() {
    if (this.inputLocked || this.inside || this.otter.busy) return false;
    this.stopTask();
    const o = this.otter;
    if (Math.hypot(this.character.x - o.x, this.character.z - o.z) < 1.8) {
      this.pending = 'otter';
      return true;
    }
    if (this.blockedByGate(o.x) || !this.walkPath([o.x, o.z])) return false;
    this.pending = 'otter';
    this.headingToSite = false;
    return true;
  }

  /** Where the otter's marker floats, or null while it's out of sight. */
  otterAnchor() {
    const o = this.otter;
    if (this.inside || !o.group.visible) return null;
    return this.toScreen(o.x, o.group.position.y + 0.85, o.z);
  }

  playerAnchor() {
    const c = this.character;
    return c.group.visible ? this.toScreen(c.x, c.group.position.y + 1.75, c.z) : null;
  }

  // ---- Input ----------------------------------------------------------------------------------

  /** A click on a station walks to it; anywhere else walks to that ground point. */
  private onTap(clientX: number, clientY: number) {
    if (this.inputLocked) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.iso.camera);
    if (this.inside) return this.onTapInside();
    const hit = this.raycaster.intersectObjects([...this.otter.pickables, ...this.stations.pickables, ...this.pickables], true)[0];
    if (!hit) return;
    if (hit.object.userData.otter) {
      if (this.goToOtter()) this.events.onWalk?.();
      return;
    }
    const stationId = hit.object.userData.stationId as string | undefined;
    if (stationId) {
      if (this.goTo(stationId)) this.events.onWalk?.();
      return;
    }
    if (this.blockedByGate(hit.point.x)) return;
    this.stopTask();
    if (!this.walkPath([hit.point.x, hit.point.z])) return;
    this.pending = null;
    this.headingToSite = false;
    this.events.onWalk?.();
  }

  /** Clicks inside the cabin: walk on this floor, or head for the stairs to reach the other one. */
  private onTapInside() {
    const hit = this.raycaster.intersectObjects(this.interior.pickables, false)[0];
    if (!hit) return;
    const floor = hit.object.userData.floor as Floor;
    if (floor !== this.floor) {
      if (this.goTo(this.floor === 0 ? 'stairsUp' : 'stairsDown')) this.events.onWalk?.();
      return;
    }
    this.stopTask();
    if (!this.walkPath([hit.point.x, hit.point.z])) return;
    this.pending = null;
    this.events.onWalk?.();
  }

  get isInside() {
    return this.inside;
  }

  /** Steps through the front door into the cabin's cutaway interior. */
  enterInterior() {
    if (this.inside || this.cabin.phase !== 'done') return;
    this.stopTask();
    this.outsideView = { x: this.iso.target.x, z: this.iso.target.z, zoom: this.iso.zoomLevel };
    this.inside = true;
    this.outside.visible = false;
    this.interior.group.visible = true;
    this.dayNight.indoor = true;
    // Concentrate the shadow map on the cabin for crisp, blocky shadows.
    this.dayNight.setShadowExtent(9);
    this.otter.park(CABIN_DOOR_SPOT);
    // The room is roomy: pull back far enough to take it all in.
    this.iso.setZoom(1.5);
    this.setFloor(0, INTERIOR_SPOTS.door);
    this.character.face(INTERIOR_SPOTS.door.x, 0);
  }

  /** Back out through the front door onto the porch steps. */
  exitInterior() {
    if (!this.inside) return;
    this.stopTask();
    this.inside = false;
    this.floor = 0;
    this.outside.visible = true;
    this.interior.group.visible = false;
    this.dayNight.indoor = false;
    this.dayNight.setShadowExtent(19);
    this.otter.resume();
    this.nav = this.navOutside;
    this.character.setNav(this.nav);
    const [x, z] = this.nav.snap(CABIN_DOOR_SPOT[0], CABIN_DOOR_SPOT[1]);
    this.character.place(x, z);
    this.character.face(x, z + 1);
    const v = this.outsideView;
    this.iso.focus(v?.x ?? x - 2, v?.z ?? z);
    this.iso.setZoom(v?.zoom ?? 1);
    this.events.onArea?.(false, 0);
  }

  /** Puts the player on a cabin floor (via the stairs, or coming in the door). */
  setFloor(floor: Floor, at: { x: number; z: number } = floor === 1 ? INTERIOR_SPOTS.stairsTop : INTERIOR_SPOTS.stairsBottom) {
    if (!this.inside) return;
    this.floor = floor;
    this.nav = this.interior.navs[floor];
    this.character.setNav(this.nav);
    const [x, z] = this.nav.snap(at.x, at.z);
    this.character.place(x, z);
    this.iso.focus(0.3, floor === 1 ? -1.4 : 0.2);
    this.events.onArea?.(true, floor);
  }

  /** Sleeps until `wakeHour` (the next time the clock reaches it); returns the hours slept. */
  sleepUntil(wakeHour: number) {
    const hours = (wakeHour - this.dayNight.hour + 24) % 24 || 24;
    this.stopTask();
    this.character.stop();
    this.dayNight.advance(hours);
    this.events.onHour?.(this.dayNight.hour, this.dayNight.day, this.dayNight.elapsed);
    return hours;
  }

  setHour(h: number) {
    this.dayNight.setHour(h);
    this.events.onHour?.(this.dayNight.hour, this.dayNight.day, this.dayNight.elapsed);
  }

  setSpeed(hoursPerSec: number) {
    this.dayNight.paused = hoursPerSec === 0;
    if (hoursPerSec > 0) this.dayNight.speed = hoursPerSec;
  }

  /** Simple scene stats for the perf budget check. */
  info() {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.iso.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.outline.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.debug.dispose();
  }
}
