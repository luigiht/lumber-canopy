import type * as THREE from 'three';

/** Values shown in the debug console, read fresh every refresh. */
export type DebugStats = () => Record<string, string | number>;

/**
 * Internal debug console: hidden by default and not mentioned anywhere in the UI. The backtick key
 * (`) toggles it. Shows frame timing and renderer stats plus whatever `extra` reports.
 */
export class DebugConsole {
  private readonly el: HTMLPreElement;
  private visible = false;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Backquote' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    e.preventDefault();
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  };

  constructor(
    container: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly extra: DebugStats,
  ) {
    this.el = document.createElement('pre');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      display: 'none',
      position: 'absolute',
      left: '16px',
      bottom: '16px',
      margin: '0',
      padding: '8px 10px',
      zIndex: '20',
      font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
      color: '#d8f5c8',
      background: 'rgba(10, 12, 10, 0.78)',
      borderRadius: '4px',
      pointerEvents: 'none',
      textShadow: 'none',
      whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(this.el);
    window.addEventListener('keydown', this.onKey);
  }

  /** Call once per frame with the frame time in seconds. */
  frame(dt: number) {
    this.frames++;
    this.elapsed += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.elapsed < 0.25) return;
    if (this.visible) {
      const r = this.renderer.info;
      const rows: Record<string, string | number> = {
        fps: (this.frames / this.elapsed).toFixed(0),
        'frame ms': `${((this.elapsed / this.frames) * 1000).toFixed(1)} (worst ${(this.worst * 1000).toFixed(1)})`,
        'draw calls': r.render.calls,
        triangles: `${(r.render.triangles / 1000).toFixed(0)}k`,
        geometries: r.memory.geometries,
        textures: r.memory.textures,
        ...this.extra(),
      };
      const w = Math.max(...Object.keys(rows).map((k) => k.length));
      this.el.textContent = Object.entries(rows)
        .map(([k, v]) => `${k.padEnd(w)}  ${v}`)
        .join('\n');
    }
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
