import * as THREE from 'three';

interface Key {
  h: number;
  sky: number; // background + fog
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunI: number;
}

/** Colour script for a day, from the misty white of the references to a deep blue night. */
const KEYS: Key[] = [
  // Moody and overcast: muted grey-blue days, a short amber dusk and deep blue nights.
  { h: 0, sky: 0x0d1220, hemiSky: 0x33456e, hemiGround: 0x11161e, hemi: 0.5, sun: 0x8fa4e8, sunI: 0.4 },
  { h: 4.5, sky: 0x111829, hemiSky: 0x33456e, hemiGround: 0x11161e, hemi: 0.5, sun: 0x8fa4e8, sunI: 0.3 },
  { h: 5.8, sky: 0x5a5a6e, hemiSky: 0x7a7c94, hemiGround: 0x30302a, hemi: 0.8, sun: 0xe0946a, sunI: 0.35 },
  { h: 7, sky: 0xb4b2ad, hemiSky: 0xc4c2bb, hemiGround: 0x4a4836, hemi: 1.3, sun: 0xf0c49a, sunI: 1.4 },
  { h: 9, sky: 0xbec3c3, hemiSky: 0xcdd2d4, hemiGround: 0x4e4f3c, hemi: 1.45, sun: 0xeef0ea, sunI: 1.8 },
  { h: 15.5, sky: 0xbac0c1, hemiSky: 0xcbd0d2, hemiGround: 0x4e4f3c, hemi: 1.42, sun: 0xeeeee6, sunI: 1.75 },
  { h: 17.6, sky: 0xb3a597, hemiSky: 0xc4b4a4, hemiGround: 0x473c30, hemi: 1.15, sun: 0xf0a878, sunI: 1.4 },
  { h: 18.8, sky: 0x7a6d70, hemiSky: 0x8f8088, hemiGround: 0x27221f, hemi: 0.75, sun: 0xe88a64, sunI: 0.4 },
  { h: 20, sky: 0x171c33, hemiSky: 0x3a4a75, hemiGround: 0x13181f, hemi: 0.55, sun: 0x8fa4e8, sunI: 0.3 },
  { h: 24, sky: 0x0d1220, hemiSky: 0x33456e, hemiGround: 0x11161e, hemi: 0.5, sun: 0x8fa4e8, sunI: 0.4 },
];

const ca = new THREE.Color();
const cb = new THREE.Color();
function mixHex(out: THREE.Color, a: number, b: number, t: number) {
  ca.setHex(a);
  cb.setHex(b);
  return out.copy(ca).lerp(cb, t);
}

export class DayNight {
  /** In-game hour, 0..24. */
  hour = 8;
  /** Days played, starting at 1. Only advances as time passes, not when scrubbing the clock. */
  day = 1;
  /** In-game hours passed while playing; only moves forward (scrubbing the clock doesn't change it). */
  elapsed = 0;
  /** In-game hours per real second. Default: one day per 10 real minutes. */
  speed = 24 / 600;
  paused = false;
  /** Inside the cabin: a dark, warm backdrop instead of the sky. */
  indoor = false;
  private readonly indoorDay = new THREE.Color(0x2a2420);
  private readonly indoorNight = new THREE.Color(0x120f0e);
  /** 0 in full day, 1 at deep night. Later milestones use it for lanterns, windows and fireflies. */
  nightFactor = 0;

  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  readonly key = new THREE.DirectionalLight(0xffffff, 2);
  readonly background = new THREE.Color();
  readonly fog: THREE.Fog;

  constructor(
    private readonly scene: THREE.Scene,
    mistNear: number,
    mistFar: number,
  ) {
    this.fog = new THREE.Fog(0xffffff, mistNear, mistFar);
    scene.fog = this.fog;
    scene.background = this.background;

    const k = this.key;
    k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048);
    const sc = k.shadow.camera;
    sc.left = -19;
    sc.right = 19;
    sc.top = 19;
    sc.bottom = -19;
    sc.near = 1;
    sc.far = 120;
    k.shadow.bias = -0.0004;
    // Just under a prop voxel (1/16 tile): enough to stop self-shadowing without lifting shadows off contacts.
    k.shadow.normalBias = 0.04;
    k.target.position.set(0, 0, 0);
    scene.add(this.hemi, k, k.target);
    this.apply();
  }

  /** Half-size of the area the sun's shadows cover, in tiles. Smaller means sharper shadows. */
  setShadowExtent(half: number) {
    const sc = this.key.shadow.camera;
    sc.left = sc.bottom = -half;
    sc.right = sc.top = half;
    sc.updateProjectionMatrix();
  }

  setHour(h: number) {
    this.hour = ((h % 24) + 24) % 24;
    this.apply();
  }

  /** Moves the clock forward (sleeping), counting days and play time as if they had passed. */
  advance(hours: number) {
    this.elapsed += hours;
    const next = this.hour + hours;
    this.day += Math.floor(next / 24);
    this.hour = next % 24;
    this.apply();
  }

  update(dt: number) {
    if (!this.paused) {
      this.elapsed += dt * this.speed;
      const next = this.hour + dt * this.speed;
      // Each time the clock passes midnight a new day begins.
      if (next >= 24) this.day += Math.floor(next / 24);
      this.hour = next % 24;
    }
    this.apply();
  }

  private apply() {
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = THREE.MathUtils.smoothstep(h, a.h, b.h);

    mixHex(this.background, a.sky, b.sky, t);
    if (this.indoor) {
      const night = THREE.MathUtils.clamp(1 - (Math.sin(((h - 6) / 12) * Math.PI) + 0.15) / 0.4, 0, 1);
      this.background.copy(this.indoorDay).lerp(this.indoorNight, night);
    }
    this.fog.color.copy(this.background);
    mixHex(this.hemi.color, a.hemiSky, b.hemiSky, t);
    mixHex(this.hemi.groundColor, a.hemiGround, b.hemiGround, t);
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, t);
    mixHex(this.key.color, a.sun, b.sun, t);
    this.key.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, t);

    // Sun arcs from the back-left (morning) overhead to the right (evening); the moon takes the opposite arc.
    const theta = ((h - 6) / 12) * Math.PI;
    const sunUp = Math.sin(theta);
    const arc = sunUp > -0.08 ? theta : theta + Math.PI;
    const elev = Math.max(0.28, Math.sin(arc));
    this.key.position.set(-Math.cos(arc) * 32, elev * 45, 18 - Math.cos(arc) * 10);

    this.nightFactor = THREE.MathUtils.clamp(1 - (sunUp + 0.15) / 0.4, 0, 1);
  }
}
