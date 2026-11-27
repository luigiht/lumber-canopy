import type { SaveState } from '@/game/save';

export interface Account {
  id: string;
  email: string;
  name: string;
  /** Whether the provider has confirmed this email address. Always true in offline mode. */
  emailConfirmed: boolean;
}

export type AccountErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_email'
  | 'not_confirmed'
  | 'not_supported'
  | 'rate_limited'
  | 'network'
  | 'unknown';

/** An error whose message is safe to show to the player. */
export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SignUpResult {
  /** Signed in right away (no email confirmation needed). */
  account: Account | null;
  /** The provider sent a confirmation email; the player must confirm before signing in. */
  needsConfirmation: boolean;
}

/**
 * Player accounts and saved progress. The game only talks to this interface, so the storage behind
 * it (this browser, or Supabase) can change without touching game code.
 */
export interface AccountService {
  /** 'local' saves in this browser only; 'supabase' uses real accounts. */
  readonly mode: 'local' | 'supabase';
  /** Whether the provider can email a password reset link. */
  readonly canResetPassword: boolean;
  current(): Promise<Account | null>;
  signUp(name: string, email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<Account>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Whether the provider confirms emails, so confirmation can be resent and checked. */
  readonly confirmsEmail: boolean;
  /** Sends the confirmation link for this email again. */
  resendConfirmation(email: string): Promise<void>;
  /** Re-reads the signed-in account from the provider, so `emailConfirmed` is up to date. */
  refresh(): Promise<Account | null>;
  /** Removes the account, profile and progress. */
  deleteAccount(): Promise<void>;
  loadProgress(): Promise<SaveState | null>;
  saveProgress(state: SaveState): Promise<void>;
}

export const NAME_MAX = 24;
export const PASSWORD_MIN = 8;

export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateSignUp(name: string, email: string, password: string): string | null {
  const n = cleanName(name);
  if (!n) return 'Please tell us what to call you.';
  if (n.length > NAME_MAX) return `Names can be up to ${NAME_MAX} characters.`;
  if (!isEmail(email)) return 'Please enter a valid email address.';
  if (password.length < PASSWORD_MIN) return `Passwords need at least ${PASSWORD_MIN} characters.`;
  return null;
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
