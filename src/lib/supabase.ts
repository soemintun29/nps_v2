import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const supabaseConfigError =
  !configuredUrl || !supabaseAnonKey
    ? 'NPS login is not configured correctly. Please add the Supabase URL and public key to this deployment.'
    : null;

function resolveSupabaseUrl() {
  if (typeof window !== 'undefined' && configuredUrl) {
    // Same-origin /sb proxy avoids Myanmar ISP DNS blocks on *.supabase.co.
    return `${window.location.origin}/sb`;
  }
  return configuredUrl;
}

export const supabase = createClient(
  resolveSupabaseUrl() || 'https://invalid.supabase.local',
  supabaseAnonKey || 'invalid-public-key'
);

export function formatSupabaseError(error: unknown, fallback = 'Something went wrong') {
  const message =
    typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';

  if (supabaseConfigError) {
    return supabaseConfigError;
  }

  if (
    error instanceof TypeError ||
    /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)
  ) {
    return 'Cannot reach the NPS login server. Refresh the page and try again.';
  }

  return message || fallback;
}
