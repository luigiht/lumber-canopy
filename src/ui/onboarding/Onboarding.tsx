'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useGame } from '@/game/store';
import { CABIN } from '@/config/cabin';
import { TOOLS, TOOL_IDS } from '@/game/tools';
import { parsePlantItem } from '@/game/items';
import type { SaveState } from '@/game/save';
import { accounts, isEmail, NAME_MAX, PASSWORD_MIN, validateSignUp } from '@/services/account';
import {
  backToStart,
  errorText,
  playWhileUnconfirmed,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  startPlaying,
} from '@/game/session';
import { ItemIcon } from '../ItemIcon';
import hud from '../hud.module.css';
import ui from '../ui.module.css';
import styles from './onboarding.module.css';

const go = (screen: ReturnType<typeof useGame.getState>['screen']) => useGame.setState({ screen });

const PrivacyLink = ({ children = 'Privacy' }: { children?: ReactNode }) => (
  <a className={ui.link} href="/privacy" target="_blank" rel="noopener">
    {children}
  </a>
);

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.overlay}>
      <div className={`${hud.panel} ${styles.card}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** Wraps an async submit with a busy flag and a player-safe error message. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function PasswordField({
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'new-password' | 'current-password';
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className={ui.field}>
      Password
      <span className={ui.passwordRow}>
        <input
          className={ui.input}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={autoComplete === 'new-password' ? PASSWORD_MIN : undefined}
          aria-invalid={invalid}
          required
        />
        <button type="button" className={ui.text} onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
      {autoComplete === 'new-password' && <span className={ui.note}>At least {PASSWORD_MIN} characters.</span>}
    </label>
  );
}

function StartScreen() {
  const local = accounts().mode === 'local';
  return (
    <Card label="Lumber and Canopy">
      <h1 className={styles.title}>Lumber &amp; Canopy</h1>
      <p className={styles.tagline}>Build a cabin, fill it with plants, and leave the forest as you found it.</p>
      <div className={styles.actions}>
        <button className={ui.primary} onClick={() => go('signup')} autoFocus>
          New game
        </button>
        <button onClick={() => go('signin')}>Sign in</button>
      </div>
      {local && (
        <p className={ui.note}>Offline mode: accounts and saves stay in this browser on this device.</p>
      )}
      <div className={styles.footer}>
        <PrivacyLink />
      </div>
    </Card>
  );
}

function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useSubmit();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateSignUp(name, email, password);
    if (problem) return setError(problem);
    void run(() => signUp(name, email, password));
  };

  return (
    <Card label="Create your account">
      <h2 className={styles.heading}>Start a new game</h2>
      <form onSubmit={submit} noValidate>
        <label className={ui.field}>
          What should we call you?
          <input
            ref={nameRef}
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            required
          />
        </label>
        <label className={ui.field}>
          Email
          <input
            className={ui.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-describedby="email-note"
            required
          />
          <span id="email-note" className={ui.note}>
            We’ll only use your email to save your game. No newsletters, no sharing. <PrivacyLink />
          </span>
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="submit" className={ui.primary} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>
      <div className={styles.footer}>
        <button className={ui.link} onClick={() => go('start')}>
          Back
        </button>
        <span>
          Have an account?{' '}
          <button className={ui.link} onClick={() => go('signin')}>
            Sign in
          </button>
        </span>
      </div>
    </Card>
  );
}

function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useSubmit();
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => emailRef.current?.focus(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email) || !password) return setError('Email or password is incorrect.');
    void run(() => signIn(email, password));
  };

  return (
    <Card label="Sign in">
      <h2 className={styles.heading}>Welcome back</h2>
      <form onSubmit={submit} noValidate>
        <label className={ui.field}>
          Email
          <input
            ref={emailRef}
            className={ui.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="submit" className={ui.primary} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
      <div className={styles.footer}>
        <button className={ui.link} onClick={() => go('forgot')}>
          Forgot password?
        </button>
        <button className={ui.link} onClick={() => go('signup')}>
          Start a new game instead
        </button>
      </div>
      <div className={styles.footer}>
        <button className={ui.link} onClick={() => go('start')}>
          Back
        </button>
        <PrivacyLink />
      </div>
    </Card>
  );
}

function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, setError, run } = useSubmit();
  const canReset = accounts().canResetPassword;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setError('Please enter a valid email address.');
    void run(async () => {
      await requestPasswordReset(email);
      setSent(true);
    });
  };

  return (
    <Card label="Reset your password">
      <h2 className={styles.heading}>Forgot your password?</h2>
      {!canReset ? (
        <p className={ui.p}>
          Password reset needs online accounts, which aren’t set up in this version yet. Your saves are kept in this
          browser; if you can’t sign in, start a new game.
        </p>
      ) : sent ? (
        <p className={ui.p} role="status">
          If there’s an account for {email}, we’ve sent it a link to set a new password. Check your inbox.
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className={ui.p}>Enter your email and we’ll send you a link to set a new password.</p>
          <label className={ui.field}>
            Email
            <input
              className={ui.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </label>
          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="submit" className={ui.primary} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </div>
        </form>
      )}
      <div className={styles.footer}>
        <button className={ui.link} onClick={() => go('signin')}>
          Back to sign in
        </button>
      </div>
    </Card>
  );
}

function ConfirmScreen() {
  const email = useGame((s) => s.pendingEmail);
  return (
    <Card label="Confirm your email">
      <h2 className={styles.heading}>Check your inbox</h2>
      <p className={ui.p}>
        We sent a confirmation link to <strong style={{ fontWeight: 'normal' }}>{email}</strong>. Once you confirm, sign in
        to keep your game safe on any device.
      </p>
      <p className={ui.note}>
        You can play now. Until you confirm and sign in, your progress is saved in this browser, then moves to your
        account.
      </p>
      <div className={styles.actions}>
        <button className={ui.primary} onClick={playWhileUnconfirmed} autoFocus>
          Play now
        </button>
        <button onClick={() => go('signin')}>I’ve confirmed: sign in</button>
      </div>
      <div className={styles.footer}>
        <button className={ui.link} onClick={backToStart}>
          Back
        </button>
        <PrivacyLink />
      </div>
    </Card>
  );
}

function GoalScreen() {
  const name = useGame((s) => s.playerName);
  const ready = useGame((s) => s.ready);
  return (
    <Card label="Your goal">
      <h2 className={styles.heading}>Welcome, {name || 'friend'}.</h2>
      <p className={ui.p}>
        Your goal: <strong style={{ fontWeight: 'normal', color: 'var(--amber)' }}>build a cabin, fill it with plants, and
        propagate them to earn improvements, all without hurting the environment.</strong>
      </p>
      <ol className={styles.steps}>
        <li>
          <span className={styles.stepIcon} aria-hidden="true">
            <ItemIcon icon="hammer" />
          </span>
          <span>
            <strong style={{ fontWeight: 'normal' }}>Build</strong> your cabin from reclaimed materials.
          </span>
        </li>
        <li>
          <span className={styles.stepIcon} aria-hidden="true">
            <ItemIcon icon="potted" />
          </span>
          <span>
            <strong style={{ fontWeight: 'normal' }}>Fill</strong> it with plants.
          </span>
        </li>
        <li>
          <span className={styles.stepIcon} aria-hidden="true">
            <ItemIcon icon="sprout" />
          </span>
          <span>
            <strong style={{ fontWeight: 'normal' }}>Propagate</strong> plants to earn upgrades, without harming the land.
          </span>
        </li>
      </ol>
      <p className={styles.rules}>
        Gather only what nature has let go of: driftwood fished from the river, loose stones, cuttings and seeds. No
        cutting trees, no harming wildlife. Reuse, recycle and regrow.
      </p>
      <div className={styles.actions}>
        <button className={ui.primary} onClick={startPlaying} disabled={!ready} autoFocus>
          {ready ? 'Let’s go' : 'Getting ready…'}
        </button>
      </div>
    </Card>
  );
}

function plantsOwned(save: SaveState) {
  const inBag = Object.entries(save.inventory).reduce((n, [id, c]) => (parsePlantItem(id)?.kind === 'plant' ? n + c : n), 0);
  return save.pots.length + inBag + save.decor.filter(Boolean).length;
}

function cabinText(save: SaveState) {
  const { phase, stageIndex } = save.cabin;
  if (phase === 'done') return 'Finished';
  if (phase === 'plot') return 'Not started';
  return `Stage ${stageIndex + 1} of ${CABIN.stages.length}: ${CABIN.stages[stageIndex].name}`;
}

function WelcomeScreen() {
  const name = useGame((s) => s.playerName);
  const save = useGame((s) => s.loaded);
  const ready = useGame((s) => s.ready);
  if (!save) return null;
  return (
    <Card label="Your progress">
      <h2 className={styles.heading}>Welcome back, {name}.</h2>
      <dl className={styles.summary}>
        <dt>Cabin</dt>
        <dd>{cabinText(save)}</dd>
        <dt>Plants</dt>
        <dd>
          {plantsOwned(save)} owned · {save.decor.filter(Boolean).length} on display
        </dd>
        <dt>Propagated</dt>
        <dd>{save.stats.propagated} times</dd>
        <dt>Tools</dt>
        <dd>{TOOL_IDS.map((id) => `${TOOLS[id].name} L${save.tools[id]}`).join(' · ')}</dd>
        <dt>Coins</dt>
        <dd>{save.coins}</dd>
      </dl>
      <div className={styles.actions}>
        <button className={ui.primary} onClick={startPlaying} disabled={!ready} autoFocus>
          {ready ? 'Continue' : 'Getting ready…'}
        </button>
      </div>
      <div className={styles.footer}>
        <button className={ui.link} onClick={() => void signOut()}>
          Not you? Sign out
        </button>
        <PrivacyLink />
      </div>
    </Card>
  );
}

/** Everything before play: start, account screens, the goal of the game, or a welcome-back summary. */
export function Onboarding() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case 'start':
      return <StartScreen />;
    case 'signup':
      return <SignUpScreen />;
    case 'signin':
      return <SignInScreen />;
    case 'forgot':
      return <ForgotScreen />;
    case 'confirm':
      return <ConfirmScreen />;
    case 'goal':
      return <GoalScreen />;
    case 'welcome':
      return <WelcomeScreen />;
    default:
      return null;
  }
}
