import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'pnd_supabase_url_v1';
const STORAGE_KEY_KEY = 'pnd_supabase_anon_key_v1';

export interface SupabaseConfigInfo {
  url: string;
  anonKey: string;
  source: 'env' | 'runtime' | 'none';
}

export function getSupabaseConfig(): SupabaseConfigInfo {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (
    envUrl &&
    envKey &&
    !envUrl.includes('your-project-id') &&
    !envKey.includes('your-supabase-anon-key')
  ) {
    return { url: envUrl.trim(), anonKey: envKey.trim(), source: 'env' };
  }

  if (typeof window !== 'undefined') {
    try {
      const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
      const storedKey = localStorage.getItem(STORAGE_KEY_KEY);
      if (
        storedUrl &&
        storedKey &&
        storedUrl.startsWith('https://') &&
        storedKey.length > 20
      ) {
        return { url: storedUrl.trim(), anonKey: storedKey.trim(), source: 'runtime' };
      }
    } catch {
      // ignore localStorage errors
    }
  }

  return { url: '', anonKey: '', source: 'none' };
}

export const isSupabaseConfigured = (): boolean => {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey && cfg.source !== 'none');
};

let _clientInstance: SupabaseClient | null = null;

function createClientInstance(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getSupabase(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey || cfg.source === 'none') {
    _clientInstance = null;
    return null;
  }
  if (!_clientInstance) {
    _clientInstance = createClientInstance(cfg.url, cfg.anonKey);
  }
  return _clientInstance;
}

export function saveRuntimeSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
  _clientInstance = createClientInstance(cleanUrl, cleanKey);
}

export function clearRuntimeSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  _clientInstance = null;
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = anonKey.trim();
    if (!cleanUrl.startsWith('https://')) {
      return { success: false, message: 'Supabase URL must start with https://' };
    }
    if (!cleanKey || cleanKey.length < 20) {
      return { success: false, message: 'Invalid Anon Public Key format.' };
    }

    const testClient = createClient(cleanUrl, cleanKey);
    const { error } = await testClient.auth.getSession();
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Connected successfully to Supabase!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}

// Transparent Proxy so all existing `supabase.auth...` and `supabase.from(...)` references continue working seamlessly
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) return undefined;
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
