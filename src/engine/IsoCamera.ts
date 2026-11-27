import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(35);
const BASE_YAW = Math.PI / 4;
const QUARTER = Math.PI / 2;
const DIST = 80;

/**
 * Orthographic isometric camera. Yaw snaps to 90° steps (drag rotates freely, release snaps),
 * scroll/pinch zooms, WASD / right-drag / two-finger drag pans.
 */
export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(0, 1.2, 0);
  private readonly targetGoal = this.target.clone();
  private yaw = BASE_YAW;
  private yawGoal = BASE_YAW;
  private zoom = 1;
  private zoomGoal = 1;
  private aspect = 1;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** Where each pointer went down, to tell a tap from a drag. */
  private readonly downs = new Map<number, { x: number; y: number; t: number; button: number }>();
  private multiTouch = false;
  /** Called with client coordinates when the canvas is tapped or clicked without dragging. */
  onTap?: (clientX: number, clientY: number) => void;
  private dragMode: 'rotate' | 'pan' | null = null;
  private pinchDist = 0;
  private readonly cleanup: (() => void)[] = [];
  onRotate?: (quarter: number) => void;
  /** Off while a UI overlay (e.g. settings) has focus, so keys don't move the camera behind it. */
  keyboardEnabled = true;

  constructor(
    private readonly bounds = 10,
    private readonly minZoom = 0.7,
    private readonly maxZoom = 3.5,
  ) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  }

  /** Current (animated) yaw in radians. */
  get yawAngle() {
    return this.yaw;
  }

  /** Quarter turns from the default view, 0..3. */
  get quarter() {
    return (((Math.round((this.yawGoal - BASE_YAW) / QUARTER) % 4) + 4) % 4);
  }

  resize(width: number, height: number) {
    this.aspect = width / Math.max(1, height);
    this.applyProjection();
  }

  rotate(dir: 1 | -1) {
    this.yawGoal = BASE_YAW + (Math.round((this.yawGoal - BASE_YAW) / QUARTER) + dir) * QUARTER;
    this.onRotate?.(this.quarter);
  }

  /** Current zoom target (1 = default). */
  get zoomLevel() {
    return this.zoomGoal;
  }

  setZoom(zoom: number) {
    this.zoomGoal = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
  }

  zoomBy(factor: number) {
    this.zoomGoal = THREE.MathUtils.clamp(this.zoomGoal * factor, this.minZoom, this.maxZoom);
  }

  /** Pan in screen-aligned ground directions (right, forward) measured in tiles. */
  pan(right: number, forward: number) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    // Screen right on the ground plane is (cos, -sin); screen up is (-sin, -cos).
    this.targetGoal.x += right * c - forward * s;
    this.targetGoal.z += -right * s - forward * c;
    this.targetGoal.x = THREE.MathUtils.clamp(this.targetGoal.x, -this.bounds, this.bounds);
    this.targetGoal.z = THREE.MathUtils.clamp(this.targetGoal.z, -this.bounds, this.bounds);
  }

  /** Smoothly moves the view centre to (x,z). */
  focus(x: number, z: number) {
    this.targetGoal.x = THREE.MathUtils.clamp(x, -this.bounds, this.bounds);
    this.targetGoal.z = THREE.MathUtils.clamp(z, -this.bounds, this.bounds);
  }

  /** World units visible vertically at zoom 1, chosen so the whole diorama fits. */
  private viewHeight() {
    return Math.max(25, 38 / this.aspect) / this.zoom;
  }

  private applyProjection() {
    const h = this.viewHeight() / 2;
    const w = h * this.aspect;
    this.camera.left = -w;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    // Keyboard pan.
    const speed = (12 / this.zoom) * dt;
    let r = 0;
    let f = 0;
    if (!this.keyboardEnabled) this.keys.clear();
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) r -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) r += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (r || f) this.pan(r * speed, f * speed);

    const k = 1 - Math.exp(-dt * 10);
    if (this.dragMode !== 'rotate') this.yaw += (this.yawGoal - this.yaw) * k;
    this.zoom += (this.zoomGoal - this.zoom) * k;
    this.target.lerp(this.targetGoal, k);

    const cp = Math.cos(PITCH);
    this.camera.position.set(
      this.target.x + DIST * cp * Math.sin(this.yaw),
      this.target.y + DIST * Math.sin(PITCH),
      this.target.z + DIST * cp * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.target);
    this.applyProjection();
  }

  attach(el: HTMLElement) {
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };

    on(el, 'contextmenu', (e: Event) => e.preventDefault());

    on(el, 'pointerdown', (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button });
      if (this.pointers.size > 1) this.multiTouch = true;
      if (this.pointers.size === 2) {
        this.dragMode = 'pan';
        this.pinchDist = this.pointerSpread();
        this.snapYaw();
      } else {
        this.dragMode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'rotate';
      }
    });

    on(el, 'pointermove', (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.dragMode) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (this.pointers.size === 2) {
        // Two-finger: average move pans, spread change zooms.
        prev.x = e.clientX;
        prev.y = e.clientY;
        const d = this.pointerSpread();
        if (this.pinchDist > 0) this.zoomBy(d / this.pinchDist);
        this.pinchDist = d;
        this.panByPixels(dx / 2, dy / 2, el);
        return;
      }
      prev.x = e.clientX;
      prev.y = e.clientY;
      if (this.dragMode === 'rotate') {
        this.yaw -= dx * 0.006;
        this.yawGoal = this.yaw;
      } else this.panByPixels(dx, dy, el);
    });

    const end = (e: PointerEvent) => {
      const down = this.downs.get(e.pointerId);
      this.downs.delete(e.pointerId);
      if (
        e.type === 'pointerup' &&
        down &&
        down.button === 0 &&
        !this.multiTouch &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 &&
        performance.now() - down.t < 500
      )
        this.onTap?.(e.clientX, e.clientY);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.multiTouch = false;
      if (this.dragMode === 'rotate') this.snapYaw();
      this.dragMode = this.pointers.size === 1 ? 'pan' : null;
      if (this.pointers.size === 0) this.dragMode = null;
    };
    on(el, 'pointerup', end);
    on(el, 'pointercancel', end);

    on(el, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    on(window, 'keydown', (e: KeyboardEvent) => {
      if (!this.keyboardEnabled || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'KeyQ') this.rotate(-1);
      if (e.code === 'KeyE') this.rotate(1);
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoomBy(1.2);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoomBy(1 / 1.2);
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
  }

  private snapYaw() {
    this.yawGoal = BASE_YAW + Math.round((this.yaw - BASE_YAW) / QUARTER) * QUARTER;
    this.onRotate?.(this.quarter);
  }

  private pointerSpread() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private panByPixels(dx: number, dy: number, el: HTMLElement) {
    const unitsPerPx = this.viewHeight() / el.clientHeight;
    // Screen-vertical drag maps to ground distance stretched by the pitch.
    this.pan(-dx * unitsPerPx, (dy * unitsPerPx) / Math.sin(PITCH));
  }

  dispose() {
    this.cleanup.forEach((f) => f());
    this.cleanup.length = 0;
  }
}
