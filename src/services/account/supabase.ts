import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { normalizeSave, type SaveState } from '@/game/save';
import { AccountError, cleanName, type Account, type AccountService, type SignUpResult } from './types';

/**
 * Real accounts with Supabase Auth (email + password) and progress in the `progress` table.
 * Passwords only ever go to Supabase Auth. Row Level Security (see supabase/schema.sql) limits every
 * player to their own rows. The email stays in Supabase Auth and isn't copied into our tables.
 */
export class SupabaseAccountService implements AccountService {
  readonly mode = 'supabase' as const;
  readonly canResetPassword = true;
  readonly confirmsEmail = true;
  readonly client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async user(): Promise<User | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user ?? null;
  }

  /** Reads the name from the player's profile, creating the profile on first sign-in. */
  private async account(user: User): Promise<Account> {
    const { data } = await this.client.from('profiles').select('name').eq('user_id', user.id).maybeSingle();
    let name = data?.name as string | undefined;
    if (!name) {
      name = cleanName(String(user.user_metadata?.name ?? 'Friend')).slice(0, 24) || 'Friend';
      await this.client.from('profiles').upsert({ user_id: user.id, name });
    }
    return { id: user.id, email: user.email ?? '', name, emailConfirmed: !!(user.email_confirmed_at ?? user.confirmed_at) };
  }

  async current() {
    const user = await this.user();
    return user ? this.account(user) : null;
  }

  async signUp(name: string, email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: cleanName(name) }, emailRedirectTo: window.location.origin },
    });
    if (error) throw mapError(error);
    // With confirmation on, Supabase hides whether an email is taken: such sign-ups come back with no identities.
    if (data.user && data.user.identities?.length === 0)
      throw new AccountError('email_taken', 'An account with this email already exists. Try signing in.');
    if (!data.session || !data.user) return { account: null, needsConfirmation: true };
    return { account: await this.account(data.user), needsConfirmation: false };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw mapError(error, true);
    return this.account(data.user);
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw mapError(error);
  }

  async resendConfirmation(email: string) {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw mapError(error);
  }

  async refresh() {
    // getUser() asks the server, unlike the cached session, so a confirmation made elsewhere shows up.
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      if (error.status === 0 || (error.message ?? '').toLowerCase().includes('fetch'))
        throw new AccountError('network', 'We couldn’t reach the server. Check your connection and try again.');
      return null;
    }
    return data.user ? this.account(data.user) : null;
  }

  async deleteAccount() {
    // A SECURITY DEFINER function deletes auth.users for auth.uid(); profile and progress cascade.
    const { error } = await this.client.rpc('delete_my_account');
    if (error) throw new AccountError('unknown', 'We couldn’t delete your account. Please try again.');
    await this.client.auth.signOut();
  }

  async loadProgress() {
    const user = await this.user();
    if (!user) return null;
    const { data, error } = await this.client.from('progress').select('state').eq('user_id', user.id).maybeSingle();
    if (error) throw new AccountError('network', 'We couldn’t load your game. Check your connection and try again.');
    return normalizeSave(data?.state);
  }

  async saveProgress(state: SaveState) {
    const user = await this.user();
    if (!user) return;
    const { error } = await this.client
      .from('progress')
      .upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
    if (error) throw new AccountError('network', 'Your game couldn’t be saved online. We’ll keep trying.');
  }
}

function mapError(error: { message?: string; status?: number; code?: string } | null, signIn = false): AccountError {
  const msg = (error?.message ?? '').toLowerCase();
  const code = error?.code ?? '';
  if (signIn) {
    if (code === 'email_not_confirmed' || msg.includes('not confirmed'))
      return new AccountError('not_confirmed', 'Please confirm your email first. Check your inbox for the link.');
    // Generic on purpose: don't reveal whether the email has an account.
    return new AccountError('invalid_credentials', 'Email or password is incorrect.');
  }
  if (code === 'over_email_send_rate_limit' || error?.status === 429 || msg.includes('security purposes'))
    return new AccountError('rate_limited', 'We just sent an email. Please wait a minute before asking again.');
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return new AccountError('email_taken', 'An account with this email already exists. Try signing in.');
  if (code === 'weak_password' || msg.includes('password'))
    return new AccountError('weak_password', 'That password is too weak. Try a longer one.');
  if (code === 'email_address_invalid' || msg.includes('invalid email'))
    return new AccountError('invalid_email', 'Please enter a valid email address.');
  if (error?.status === 0 || msg.includes('fetch'))
    return new AccountError('network', 'We couldn’t reach the server. Check your connection and try again.');
  return new AccountError('unknown', 'Something went wrong. Please try again.');
}
