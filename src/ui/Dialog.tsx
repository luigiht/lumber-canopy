'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useGame } from '@/game/store';
import hud from './hud.module.css';
import ui from './ui.module.css';

/** Pixel-style X drawn on a 9×9 grid so it stays crisp like the font. */
export const CloseIcon = () => (
  <svg viewBox="0 0 9 9" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
    <path
      fill="currentColor"
      d="M0 0h2v1h1v1h1v1h1V2h1V1h1V0h2v2H8v1H7v1H6v1h1v1h1v1h1v2H7V8H6V7H5V6H4v1H3v1H2v1H0V7h1V6h1V5h1V4H2V3H1V2H0z"
    />
  </svg>
);

/** Centred wood panel over a dimmed scene. Esc or a click outside closes it. */
export function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const engine = useGame((s) => s.engine);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // The scene behind should not react to keys while a dialog is open.
    if (engine) engine.iso.keyboardEnabled = false;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (engine) engine.iso.keyboardEnabled = true;
      prev?.focus?.();
    };
  }, [engine]);

  return (
    <div className={hud.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`${hud.panel} ${hud.settings} ${wide ? ui.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className={hud.settingsHeader}>
          <h2 id={id} className={hud.settingsTitle}>
            {title}
          </h2>
          <button className={hud.iconButton} onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A titled section inside a dialog. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={hud.section} aria-labelledby={id}>
      <h3 id={id} className={hud.sectionTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}
