'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/game/store';
import { seasonOf } from '@/config/calendar';
import { TOOLS, TOOL_IDS } from '@/game/tools';
import { openPanel, selectTool, stopFishing } from '@/game/actions';
import { Settings } from './Settings';
import { BuildPrompt } from './BuildPrompt';
import { Coach, FishingGame, ResourceBar, TaskBar, Toasts, ToolBar, WorldMarkers } from './GameHud';
import { InventoryPanel } from './panels/InventoryPanel';
import { PlantsPanel } from './panels/PlantsPanel';
import { WorkbenchPanel } from './panels/WorkbenchPanel';
import { DeliveryPanel } from './panels/DeliveryPanel';
import { PlacePanel } from './panels/PlacePanel';
import { OtterPanel } from './panels/OtterPanel';
import { BedPanel, SleepOverlay } from './panels/BedPanel';
import { Onboarding } from './onboarding/Onboarding';
import Image from 'next/image';
import { ItemIcon } from './ItemIcon';
import styles from './hud.module.css';

function formatHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const isNight = (h: number) => h < 6 || h >= 19;

/** I: inventory, P: plants, 1–3: tools, H: hide the UI, Esc: stop fishing. Off while typing or a dialog is open. */
function useHotkeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.panel || s.settingsOpen) return;
      if (e.code === 'KeyH') useGame.setState({ uiHidden: !s.uiHidden });
      else if (s.uiHidden) return;
      else if (e.code === 'KeyI') openPanel('inventory');
      else if (e.code === 'KeyP') openPanel('plants');
      else if (e.key === 'Escape' && s.fishing) stopFishing();
      else {
        const tool = TOOL_IDS.find((id) => TOOLS[id].key === e.key);
        if (tool) selectTool(tool);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

function Panels() {
  const panel = useGame((s) => s.panel);
  switch (panel) {
    case 'inventory':
      return <InventoryPanel />;
    case 'plants':
    case 'potting':
      return <PlantsPanel atTable={panel === 'potting'} />;
    case 'workbench':
      return <WorkbenchPanel />;
    case 'delivery':
      return <DeliveryPanel />;
    case 'place':
      return <PlacePanel />;
    case 'otter':
      return <OtterPanel />;
    case 'bed':
      return <BedPanel />;
    default:
      return null;
  }
}

/** Shown for a moment after hiding the UI, then fades so it never ends up in a screenshot. */
function HiddenHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, []);
  return show ? (
    <div className={`${styles.panel} ${styles.hiddenHint}`} role="status">
      UI hidden · press H to show it
    </div>
  ) : null;
}

/** Shown while the world builds and the save loads: the intro illustration behind the logo. */
function LoadingScreen() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <Image
        className={styles.loadingBackground}
        src="/brand/background-intro.png"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <Image
        className={styles.loadingLogo}
        src="/brand/logo-full.svg"
        alt="Lumber & Canopy"
        width={702}
        height={327}
        priority
      />
      <span className={styles.pixelSpinner} aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} />
        ))}
      </span>
      <span className={styles.loadingText}>Walking into the woods…</span>
    </div>
  );
}

export function Hud() {
  const { engine, ready, hour, day, screen, arrived, inside } = useGame();
  const playing = screen === 'playing';
  const uiHidden = useGame((s) => s.uiHidden);
  useHotkeys(playing);

  // Screenshot mode: only the scene, plus a brief reminder of how to bring the UI back.
  if (playing && uiHidden) return <HiddenHint />;

  return (
    <>
      {playing && arrived && (
        <>
          <WorldMarkers />
          <TaskBar />
        </>
      )}

      {/* Calendar, materials and (on phones) messages stack in one column, so they never overlap. */}
      <div className={styles.topLeftStack}>
        <div className={`${styles.panel} ${styles.topLeft}`} aria-label="Calendar">
          <span className={styles.clock} aria-label={`Time ${formatHour(hour)}`}>
            <ItemIcon icon={isNight(hour) ? 'moon' : 'sun'} /> {formatHour(hour)}
          </span>
          <span className={styles.calendar}>
            {seasonOf(day)} · Day {day}
          </span>
        </div>
        {playing && arrived && <ResourceBar />}
        {playing && <Toasts />}
      </div>

      {playing && arrived && (
        <>
          {!inside && <BuildPrompt />}
          <Coach />
          <ToolBar />
          <FishingGame />
        </>
      )}

      {playing && <Settings />}

      <div className={`${styles.panel} ${styles.bottomRight}`}>
        <button onClick={() => engine?.iso.rotate(-1)} aria-label="Rotate left (Q)">
          <ItemIcon icon="rotateLeft" />
        </button>
        <button onClick={() => engine?.iso.rotate(1)} aria-label="Rotate right (E)">
          <ItemIcon icon="rotateRight" />
        </button>
        <button className={styles.zoomButton} onClick={() => engine?.iso.zoomBy(1.25)} aria-label="Zoom in">
          <ItemIcon icon="plus" />
        </button>
        <button className={styles.zoomButton} onClick={() => engine?.iso.zoomBy(0.8)} aria-label="Zoom out">
          <ItemIcon icon="minus" />
        </button>
      </div>

      {playing && <Panels />}
      {playing && <SleepOverlay />}
      <Onboarding />

      {(!ready || screen === 'loading') && <LoadingScreen />}
    </>
  );
}
