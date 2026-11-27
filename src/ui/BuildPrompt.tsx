'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/game/store';
import { formatCost } from '@/game/items';
import { goBuild, missingFor, stageCost } from '@/game/actions';
import styles from './hud.module.css';
import ui from './ui.module.css';
import { ItemIcon } from './ItemIcon';

const HammerIcon = () => <ItemIcon icon="hammer" />;

/**
 * Prompt floating above the cabin site next to the log pile: a "Build cabin" button (with the first
 * stage's materials) before work starts, then the current stage, progress and any missing materials.
 */
export function BuildPrompt() {
  const engine = useGame((s) => s.engine);
  const build = useGame((s) => s.build);
  useGame((s) => s.inventory); // re-check materials as they change
  const cost = stageCost(build.stageNumber - 1);
  const missing = missingFor(cost);
  const short = !build.stagePaid && Object.keys(missing).length > 0;
  const anchor = useRef<HTMLDivElement>(null);
  const [celebrate, setCelebrate] = useState(false);
  const wasBuilding = useRef(false);

  // Follow the site on screen every frame without re-rendering React.
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      const p = engine.buildAnchor();
      const el = anchor.current;
      if (el) {
        el.style.visibility = p ? 'visible' : 'hidden';
        if (p) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // A short "Cabin built!" when construction finishes.
  useEffect(() => {
    if (build.phase === 'building') wasBuilding.current = true;
    if (build.phase === 'done' && wasBuilding.current) {
      wasBuilding.current = false;
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 4000);
      return () => clearTimeout(t);
    }
  }, [build.phase]);

  if (!engine || (build.phase === 'done' && !celebrate)) return null;

  return (
    <div ref={anchor} className={styles.worldAnchor}>
      {build.phase === 'plot' && (
        <>
          <button className={styles.worldButton} onClick={goBuild} disabled={build.heading}>
            <HammerIcon />
            <span>{build.heading ? 'On the way…' : 'Build cabin'}</span>
          </button>
          <div className={`${styles.panel} ${styles.buildCard}`} style={{ marginTop: 12 }}>
            <span className={ui.small}>First: {formatCost(cost)}</span>
            {short && <span className={`${ui.small} ${ui.warn}`}>Need {formatCost(missing)} more</span>}
          </div>
        </>
      )}
      {build.phase === 'building' && (
        <div className={`${styles.panel} ${styles.buildCard}`} role="status" aria-live="polite">
          <div className={styles.buildTitle}>
            {build.waiting ? 'Needs materials' : build.paused ? 'Paused' : build.stageName}
            <span className={styles.buildStep}>
              {build.stageNumber} of {build.stageCount}
            </span>
          </div>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Cabin progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(build.progress * 100)}
          >
            <div className={styles.progressFill} style={{ width: `${build.progress * 100}%` }} />
          </div>
          {short && (
            <span className={`${ui.small} ${ui.warn}`}>
              {build.stageName}: need {formatCost(missing)} more
            </span>
          )}
          {build.paused && (
            <button className={styles.resume} onClick={goBuild}>
              Back to work
            </button>
          )}
        </div>
      )}
      {build.phase === 'done' && celebrate && (
        <div className={`${styles.panel} ${styles.buildCard} ${styles.buildTitle}`}>Cabin built!</div>
      )}
    </div>
  );
}
