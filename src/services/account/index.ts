import { LocalAccountService } from './local';
import { SupabaseAccountService } from './supabase';
import type { AccountService } from './types';

export * from './types';

let service: AccountService | null = null;

/**
 * The account service for this build: Supabase when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set, otherwise saves in this browser.
 */
export function accounts(): AccountService {
  if (!service) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    service = url && key ? new SupabaseAccountService(url, key) : new LocalAccountService();
  }
  return service;
}
