import { useGame, type Display } from './store';

/* Brightness and text size: a per-device preference, kept in this browser (not in the save). */

const KEY = 'lc.display';

export function applyDisplay(display: Display) {
  useGame.getState().engine?.setBrightness(display.brightness);
  document.documentElement.style.setProperty('--text-scale', String(display.textScale));
}

export function loadDisplay() {
  let display = useGame.getState().display;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) display = { ...display, ...(JSON.parse(raw) as Partial<Display>) };
  } catch {
    // Use defaults.
  }
  useGame.setState({ display });
  applyDisplay(display);
}

export function setDisplay(patch: Partial<Display>) {
  const display = { ...useGame.getState().display, ...patch };
  useGame.setState({ display });
  applyDisplay(display);
  try {
    localStorage.setItem(KEY, JSON.stringify(display));
  } catch {
    // Not saved; still applied for this visit.
  }
}
