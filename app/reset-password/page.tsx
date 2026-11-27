'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { accounts, PASSWORD_MIN } from '@/services/account';
import { SupabaseAccountService } from '@/services/account/supabase';
import styles from '../privacy/page.module.css';

/** Landing page for the password reset email: set a new password, then head back to the game. */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid' | 'offline'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const svc = accounts();
    if (!(svc instanceof SupabaseAccountService)) {
      setReady('offline');
      return;
    }
    // The link signs the player in for recovery; wait for that session.
    const { data } = svc.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady('ok');
    });
    const t = setTimeout(() => setReady((r) => (r === 'checking' ? 'invalid' : r)), 4000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN) return setError(`Passwords need at least ${PASSWORD_MIN} characters.`);
    const svc = accounts() as SupabaseAccountService;
    const { error } = await svc.client.auth.updateUser({ password });
    if (error) return setError('We couldn’t update your password. The link may have expired; request a new one.');
    setDone(true);
  };

  return (
    <main className={styles.page}>
      <article className={styles.paper}>
        <h1>Set a new password</h1>
        {ready === 'offline' && <p>Password reset needs online accounts, which aren’t set up in this version yet.</p>}
        {ready === 'checking' && <p>Checking your link…</p>}
        {ready === 'invalid' && <p>This reset link is invalid or has expired. Request a new one from the sign-in screen.</p>}
        {ready === 'ok' && !done && (
          <form className={styles.form} onSubmit={submit}>
            <label>
              New password (at least {PASSWORD_MIN} characters)
              <br />
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN}
                required
                autoFocus
              />
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button className={styles.button} type="submit">
              Save password
            </button>
          </form>
        )}
        {done && <p role="status">Your password is updated.</p>}
        <p>
          <Link href="/">Back to the game</Link>
        </p>
      </article>
    </main>
  );
}
