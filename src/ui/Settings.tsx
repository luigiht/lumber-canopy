'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SPEEDS, useGame } from '@/game/store';
import { setDisplay } from '@/game/display';
import { deleteAccount, errorText, signOut } from '@/game/session';
import { accounts } from '@/services/account';
import styles from './hud.module.css';
import ui from './ui.module.css';
import { ItemIcon } from './ItemIcon';

interface Section {
  id: string;
  title: string;
  content: ReactNode;
}

/** A labelled row inside a settings section. */
export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingLabel}>{label}</span>
      <div className={styles.settingControl}>{children}</div>
    </div>
  );
}

function formatHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function TimeSettings() {
  const { engine, hour, speedIndex } = useGame();
  return (
    <>
      <SettingRow label="Speed">
        <div className={styles.segmented} role="group" aria-label="Time speed">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              className={i === speedIndex ? styles.active : undefined}
              aria-pressed={i === speedIndex}
              aria-label={i === 0 ? 'Pause time' : `Speed ${s.label}`}
              onClick={() => {
                engine?.setSpeed(s.hoursPerSec);
                useGame.setState({ speedIndex: i });
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label={`Time of day · ${formatHour(hour)}`}>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={hour}
          aria-label="Time of day"
          onChange={(e) => engine?.setHour(Number(e.target.value))}
        />
      </SettingRow>
    </>
  );
}

/** Every way to control the game, shown in the Controls section. */
const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ['Click', 'Tap'], action: 'Walk there' },
  { keys: ['Click a marker'], action: 'Walk to it and use it' },
  { keys: ['1', '2', '3'], action: 'Hammer, fishing rod, pickaxe' },
  { keys: ['I'], action: 'Inventory' },
  { keys: ['P'], action: 'Plants' },
  { keys: ['Space'], action: 'Reel in while fishing' },
  { keys: ['H'], action: 'Hide or show the UI (for screenshots)' },
  { keys: ['Drag'], action: 'Rotate the view (snaps to quarter turns)' },
  { keys: ['Q', 'E'], action: 'Rotate left or right' },
  { keys: ['Scroll', 'Pinch'], action: 'Zoom' },
  { keys: ['+', '-'], action: 'Zoom in or out' },
  { keys: ['W', 'A', 'S', 'D'], action: 'Pan (arrow keys work too)' },
  { keys: ['Right-drag', 'Two fingers'], action: 'Pan' },
  { keys: ['Esc'], action: 'Close a panel or stop fishing' },
];

const TEXT_SIZES = [
  { label: '100%', value: 1 },
  { label: '115%', value: 1.15 },
  { label: '130%', value: 1.3 },
];

function DisplaySettings() {
  const display = useGame((s) => s.display);
  return (
    <>
      <SettingRow label={`Brightness · ${Math.round(display.brightness * 100)}%`}>
        <input
          className={styles.slider}
          type="range"
          min={0.7}
          max={1.4}
          step={0.05}
          value={display.brightness}
          aria-label="Brightness"
          onChange={(e) => setDisplay({ brightness: Number(e.target.value) })}
        />
      </SettingRow>
      <SettingRow label="Text size">
        <div className={styles.segmented} role="group" aria-label="Text size">
          {TEXT_SIZES.map((t) => (
            <button
              key={t.label}
              className={display.textScale === t.value ? styles.active : undefined}
              aria-pressed={display.textScale === t.value}
              onClick={() => setDisplay({ textScale: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SettingRow>
    </>
  );
}

function AccountSettings() {
  const account = useGame((s) => s.account);
  const pendingEmail = useGame((s) => s.pendingEmail);
  const name = useGame((s) => s.playerName);
  const saving = useGame((s) => s.saving);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const local = accounts().mode === 'local';
  // Anyone who has signed up, including players still waiting to confirm their email.
  const signedUp = !!account || !!pendingEmail;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <>
      <p className={ui.p}>
        {name}
        {account && <span className={ui.muted}> · {account.email}</span>}
      </p>
      {pendingEmail && !account && (
        <p className={ui.note}>
          Waiting for you to confirm {pendingEmail}. Your game is saved in this browser until you sign in.
        </p>
      )}
      {local && <p className={ui.note}>Offline mode: your account and saves are kept in this browser.</p>}
      {saving === 'error' && <p className={`${ui.note} ${ui.warn}`}>Last save failed. We’ll try again shortly.</p>}
      <div className={ui.row}>
        <a className={ui.link} href="/privacy" target="_blank" rel="noopener">
          Privacy
        </a>
      </div>
      {signedUp && (
        <div className={ui.row}>
          <button className={ui.text} onClick={() => void signOut()}>
            Log out
          </button>
          {!confirming ? (
            <button className={ui.text} onClick={() => setConfirming(true)}>
              Delete account
            </button>
          ) : null}
        </div>
      )}
      {confirming && (
        <div className={ui.card} role="alertdialog" aria-label="Delete account">
          <p className={ui.p}>
            {account
              ? 'Delete your account, profile and all your progress? This can’t be undone.'
              : 'Delete the progress saved in this browser? This can’t be undone. Your email isn’t confirmed yet, so there’s no account online to remove: to remove the sign-up itself, confirm your email, sign in and delete it here.'}
          </p>
          {error && <p className={ui.error}>{error}</p>}
          <div className={ui.row}>
            <button className={ui.text} onClick={() => void remove()} disabled={busy}>
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button className={`${ui.text} ${ui.primary}`} onClick={() => setConfirming(false)} disabled={busy}>
              Keep my account
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ControlsHelp() {
  return (
    <dl className={styles.controls}>
      {CONTROLS.map((c) => (
        <div key={c.action} className={styles.controlRow}>
          <dt className={styles.keys}>
            {c.keys.map((k) => (
              <kbd key={k} className={styles.key}>
                {k}
              </kbd>
            ))}
          </dt>
          <dd className={styles.action}>{c.action}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Settings sections, in display order. Add new groups of options here. */
const SECTIONS: Section[] = [
  { id: 'time', title: 'Time', content: <TimeSettings /> },
  { id: 'display', title: 'Display', content: <DisplaySettings /> },
  { id: 'controls', title: 'Controls', content: <ControlsHelp /> },
];

/** Pixel-style X drawn on a 9×9 grid so it stays crisp like the font. */
const CloseIcon = () => (
  <svg viewBox="0 0 9 9" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
    <path
      fill="currentColor"
      d="M0 0h2v1h1v1h1v1h1V2h1V1h1V0h2v2H8v1H7v1H6v1h1v1h1v1h1v2H7V8H6V7H5V6H4v1H3v1H2v1H0V7h1V6h1V5h1V4H2V3H1V2H0z"
    />
  </svg>
);

const GearIcon = () => <ItemIcon icon="gear" />;

/** Gear button in the top-right corner that opens settings as a centred overlay. */
export function Settings() {
  const open = useGame((s) => s.settingsOpen);
  const engine = useGame((s) => s.engine);
  const gear = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const setOpen = (settingsOpen: boolean) => useGame.setState({ settingsOpen });

  useEffect(() => {
    // The scene behind the overlay should not react to keys while settings are open.
    if (engine) engine.iso.keyboardEnabled = !open;
    if (!open) return;
    panel.current?.focus();
    const gearEl = gear.current;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      gearEl?.focus();
    };
  }, [open, engine]);

  return (
    <>
      <button
        ref={gear}
        className={`${styles.panel} ${styles.gear}`}
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <GearIcon />
      </button>
      {open && (
        <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={panel}
            className={`${styles.panel} ${styles.settings}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            tabIndex={-1}
          >
            <div className={styles.settingsHeader}>
              <h2 id="settings-title" className={styles.settingsTitle}>
                Settings
              </h2>
              <button className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Close settings">
                <CloseIcon />
              </button>
            </div>
            {SECTIONS.map((s) => (
              <section key={s.id} className={styles.section} aria-labelledby={`settings-${s.id}`}>
                <h3 id={`settings-${s.id}`} className={styles.sectionTitle}>
                  {s.title}
                </h3>
                {s.content}
              </section>
            ))}
            {/* Account comes last. */}
            <section className={styles.section} aria-labelledby="settings-account">
              <h3 id="settings-account" className={styles.sectionTitle}>
                Account
              </h3>
              <AccountSettings />
            </section>
          </div>
        </div>
      )}
    </>
  );
}
