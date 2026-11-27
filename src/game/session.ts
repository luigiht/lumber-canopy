import { useGame, progressOf } from './store';
import { newGameState, normalizeSave, type SaveState } from './save';
import { TOOL_STATS, levelIndex } from './tools';
import { isFriend } from './otter';
import { accounts, AccountError, cleanName, type Account } from '@/services/account';
import { toast } from './actions';

/* Accounts, loading and saving. Screens call these; the game never calls the account service directly. */

const get = useGame.getState;
const set = useGame.setState;

/** Progress made while waiting for email confirmation, kept in this browser until first sign-in. */
const PENDING = 'lc.pending';
/** Latest save for an online account, kept locally so closing the tab never loses progress. */
const backupKey = (id: string) => `lc.backup.${id}`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the online save still happens.
  }
}

const newer = (a: SaveState | null, b: SaveState | null) => {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.savedAt) > Date.parse(a.savedAt) ? b : a;
};

export const errorText = (e: unknown) =>
  e instanceof AccountError ? e.message : 'Something went wrong. Please try again.';

/** Checks for a signed-in player on this device and shows the right first screen. */
export async function initSession() {
  try {
    const account = await accounts().current();
    if (account) return await loadAccount(account);
  } catch {
    // Fall through to the start screen.
  }
  set({ screen: 'start' });
}

async function loadAccount(account: Account) {
  const svc = accounts();
  let save = await svc.loadProgress();
  if (svc.mode === 'supabase') save = newer(save, normalizeSave(readJSON(backupKey(account.id))));
  set({ account, playerName: account.name, pendingEmail: null, loaded: save, screen: save ? 'welcome' : 'goal' });
}

export async function signUp(name: string, email: string, password: string) {
  const res = await accounts().signUp(cleanName(name), email, password);
  if (res.needsConfirmation) {
    set({ pendingEmail: email.trim().toLowerCase(), playerName: cleanName(name), loaded: null, screen: 'confirm' });
    return;
  }
  set({ account: res.account, playerName: res.account?.name ?? cleanName(name), loaded: null, screen: 'goal' });
}

export async function signIn(email: string, password: string) {
  await signInWith(await accounts().signIn(email, password));
}

async function signInWith(account: Account) {
  const svc = accounts();
  // First sign-in after confirming: bring over what they played while waiting.
  const pending = readJSON<{ email: string; state: SaveState }>(PENDING);
  if (pending && pending.email === account.email.toLowerCase()) {
    const existing = await svc.loadProgress();
    if (!existing) await svc.saveProgress(pending.state);
    writeJSON(PENDING, null);
  }
  await loadAccount(account);
}

export async function requestPasswordReset(email: string) {
  await accounts().requestPasswordReset(email);
}

// ---- Email confirmation -----------------------------------------------------------------------

/** Sends the confirmation link again to the signed-in or waiting-to-confirm email. */
export async function resendConfirmation() {
  const email = get().account?.email ?? get().pendingEmail;
  if (!email) throw new AccountError('unknown', 'There’s no email to confirm.');
  await accounts().resendConfirmation(email);
}

/**
 * Asks the provider whether the email is confirmed now. A signed-in account is re-read. A player
 * still waiting to confirm has no session, so we look for one the confirmation link may have
 * started in this browser, then sign in with their password (which only works once confirmed).
 */
export async function checkEmailConfirmed(password?: string): Promise<boolean> {
  const svc = accounts();
  const s = get();
  if (s.account) {
    const account = await svc.refresh();
    if (!account) return false;
    set({ account });
    return account.emailConfirmed;
  }
  if (!s.pendingEmail) return false;
  let account = await svc.current();
  if (!account && password) {
    try {
      account = await svc.signIn(s.pendingEmail, password);
    } catch (e) {
      if (e instanceof AccountError && e.code === 'not_confirmed') return false;
      throw e;
    }
  }
  if (!account) return false;
  await adoptAccount(account);
  return true;
}

/** The waiting player just confirmed: move what they played into the account. */
async function adoptAccount(account: Account) {
  if (get().screen !== 'playing') {
    await signInWith(account);
    return;
  }
  // Mid-game: keep playing the current game and save it to the new account.
  writeJSON(PENDING, null);
  set({ account, playerName: account.name, pendingEmail: null });
  await saveNow();
  toast('Email confirmed. Your game is now saved to your account.', 'good');
}

/** Starts play: a fresh game (taxi intro) or the loaded save. */
export function startPlaying() {
  const s = get();
  const engine = s.engine;
  if (!engine) return;
  const save = s.loaded ?? newGameState();
  set({ ...progressOf(save), screen: 'playing', loaded: null });
  engine.setTool(save.selectedTool);
  engine.setBuildSpeed(TOOL_STATS.hammer.buildSpeed[levelIndex(save.tools.hammer)]);
  engine.setGate(!save.tutorial.done);
  if (save.arrived) engine.restore(save);
  else {
    if (save.clock.elapsed > 0) engine.restore({ ...save, player: null });
    engine.playArrival();
  }
  // A befriended otter turns up right beside you.
  if (isFriend(save.otter.feeds)) engine.setOtterFriend(true);
  startAutosave();
}

/** The taxi has gone: the player is here and the controls tutorial begins. */
export function onArrivalDone() {
  set({ arrived: true });
  requestSave(0);
}

// ---- Saving -----------------------------------------------------------------------------------

export function buildSave(): SaveState | null {
  const s = get();
  if (!s.engine) return null;
  const { inventory, coins, tools, selectedTool, pots, nextPotId, decor, rocks, compost, arrived, tutorial, stats, otter } = s;
  return {
    version: 1,
    inventory,
    coins,
    tools,
    selectedTool,
    pots,
    nextPotId,
    decor,
    rocks,
    compost,
    arrived,
    tutorial,
    stats,
    otter,
    ...s.engine.snapshot(),
    savedAt: new Date().toISOString(),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | null = null;

/** Saves soon, batching bursts of changes into one write. */
export function requestSave(delay = 1200) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), delay);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  const s = get();
  if (s.screen !== 'playing') return;
  const state = buildSave();
  if (!state) return;
  if (s.pendingEmail) {
    writeJSON(PENDING, { email: s.pendingEmail, state });
    return;
  }
  if (!s.account) return;
  const svc = accounts();
  if (svc.mode === 'supabase') writeJSON(backupKey(s.account.id), state);
  if (saving) await saving;
  set({ saving: 'saving' });
  saving = svc
    .saveProgress(state)
    .then(() => set({ saving: 'idle' }))
    .catch((e) => {
      set({ saving: 'error' });
      toast(errorText(e), 'warn');
    })
    .finally(() => {
      saving = null;
    });
  await saving;
}

let autosave: ReturnType<typeof setInterval> | undefined;

function startAutosave() {
  clearInterval(autosave);
  autosave = setInterval(() => void saveNow(), 30_000);
  const flush = () => void saveNow();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

// ---- Leaving ----------------------------------------------------------------------------------

export async function signOut() {
  await saveNow();
  await accounts().signOut();
  window.location.reload();
}

/**
 * Deletes the account, profile and progress. Before the email is confirmed there's no signed-in
 * account to remove online, so only the progress kept in this browser is deleted.
 */
export async function deleteAccount() {
  const id = get().account?.id;
  if (id) await accounts().deleteAccount();
  if (id) writeJSON(backupKey(id), null);
  writeJSON(PENDING, null);
  window.location.href = '/';
}

/** Leaves the confirmation wait and plays now; saves stay in this browser until they sign in. */
export function playWhileUnconfirmed() {
  set({ loaded: readJSON<{ state: SaveState }>(PENDING)?.state ?? null, screen: 'goal' });
}

export function backToStart() {
  set({ screen: 'start', pendingEmail: null });
}
