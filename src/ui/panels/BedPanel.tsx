'use client';

import { useGame } from '@/game/store';
import { WAKE_HOUR, goToSleep } from '@/game/actions';
import { Dialog } from '../Dialog';
import ui from '../ui.module.css';

const pad = (n: number) => String(n).padStart(2, '0');

/** "Go to sleep?" with how long you'll sleep, then waking at sunrise. */
export function BedPanel() {
  const hour = useGame((s) => s.hour);
  const hours = (WAKE_HOUR - hour + 24) % 24 || 24;
  const night = hour >= 19 || hour < 6;
  return (
    <Dialog title="Bed" onClose={() => useGame.setState({ panel: null })}>
      <p className={ui.p}>
        {night ? 'The cabin is quiet and the stove is warm.' : 'It’s still light out, but a rest sounds nice.'} Sleep until{' '}
        {pad(WAKE_HOUR)}:00, when the sun is up? That’s about {Math.round(hours)} hours.
      </p>
      <p className={ui.note}>Your plants keep growing while you sleep, and the river brings new stones.</p>
      <div className={ui.row}>
        <button className={`${ui.text} ${ui.primary}`} onClick={goToSleep} autoFocus>
          Sleep until morning
        </button>
        <button className={ui.text} onClick={() => useGame.setState({ panel: null })}>
          Not yet
        </button>
      </div>
    </Dialog>
  );
}

/** Black fade while you sleep, with the new day shown as you wake. */
export function SleepOverlay() {
  const sleep = useGame((s) => s.sleep);
  const day = useGame((s) => s.day);
  if (!sleep) return null;
  return (
    <div className={`${ui.sleepOverlay} ${sleep === 'waking' ? ui.waking : ''}`} role="status" aria-live="polite">
      {sleep === 'waking' ? (
        <span className={ui.heading}>
          Day {day} · {pad(WAKE_HOUR)}:00
        </span>
      ) : (
        <span className={ui.heading}>Zzz…</span>
      )}
    </div>
  );
}
