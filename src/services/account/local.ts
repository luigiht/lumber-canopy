import { normalizeSave, type SaveState } from '@/game/save';
import { AccountError, cleanName, type Account, type AccountService, type SignUpResult } from './types';

/**
 * Fallback used while Supabase isn't configured: accounts and saves live in this browser's
 * localStorage. Passwords are salted and hashed (PBKDF2) before storing, but this is a development
 * and offline mode only: anything here stays on this device and can't be recovered elsewhere.
 */

const ACCOUNTS = 'lc.accounts';
const SESSION = 'lc.session';
const progressKey = (id: string) => `lc.progress.${id}`;

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new AccountError('unknown', 'This browser is blocking storage, so your game can’t be saved here.');
  }
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

const publicAccount = (a: StoredAccount): Account => ({ id: a.id, email: a.email, name: a.name });

export class LocalAccountService implements AccountService {
  readonly mode = 'local' as const;
  readonly canResetPassword = false;

  private accounts() {
    return read<Record<string, StoredAccount>>(ACCOUNTS, {});
  }

  private sessionAccount() {
    const id = read<string | null>(SESSION, null);
    return id ? (Object.values(this.accounts()).find((a) => a.id === id) ?? null) : null;
  }

  async current() {
    const a = this.sessionAccount();
    return a ? publicAccount(a) : null;
  }

  async signUp(name: string, email: string, password: string): Promise<SignUpResult> {
    const key = email.trim().toLowerCase();
    const accounts = this.accounts();
    if (accounts[key]) throw new AccountError('email_taken', 'An account with this email already exists. Try signing in.');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const account: StoredAccount = {
      id: crypto.randomUUID(),
      email: email.trim(),
      name: cleanName(name),
      salt,
      hash: await hashPassword(password, salt),
    };
    write(ACCOUNTS, { ...accounts, [key]: account });
    write(SESSION, account.id);
    return { account: publicAccount(account), needsConfirmation: false };
  }

  async signIn(email: string, password: string) {
    const a = this.accounts()[email.trim().toLowerCase()];
    if (!a || (await hashPassword(password, a.salt)) !== a.hash)
      throw new AccountError('invalid_credentials', 'Email or password is incorrect.');
    write(SESSION, a.id);
    return publicAccount(a);
  }

  async signOut() {
    write(SESSION, null);
  }

  async requestPasswordReset() {
    throw new AccountError(
      'not_supported',
      'Password reset needs online accounts, which aren’t set up yet. In offline mode, start a new game instead.',
    );
  }

  async deleteAccount() {
    const a = this.sessionAccount();
    if (!a) return;
    const accounts = this.accounts();
    delete accounts[a.email.toLowerCase()];
    write(ACCOUNTS, accounts);
    write(progressKey(a.id), null);
    write(SESSION, null);
  }

  async loadProgress() {
    const a = this.sessionAccount();
    return a ? normalizeSave(read<unknown>(progressKey(a.id), null)) : null;
  }

  async saveProgress(state: SaveState) {
    const a = this.sessionAccount();
    if (a) write(progressKey(a.id), state);
  }
}
