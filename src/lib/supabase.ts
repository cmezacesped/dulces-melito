import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  workspaceKey: string; // Clave privada compartida entre tú y tu novia para sincronizar el mismo espacio
}

const CLOUD_CONFIG_STORAGE_KEY = 'pasteleria_cloud_config_v1';

export function getSavedCloudConfig(): CloudConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envWorkspace = process.env.NEXT_PUBLIC_WORKSPACE_KEY || 'pasteleria-principal';

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CloudConfig;
        if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  if (envUrl && envKey) {
    return {
      supabaseUrl: envUrl,
      supabaseAnonKey: envKey,
      workspaceKey: envWorkspace,
    };
  }

  return null;
}

export function saveCloudConfig(config: CloudConfig | null) {
  if (typeof window === 'undefined') return;
  if (!config) {
    localStorage.removeItem(CLOUD_CONFIG_STORAGE_KEY);
  } else {
    localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(): {
  client: SupabaseClient | null;
  workspaceKey: string;
} {
  const cfg = getSavedCloudConfig();
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return { client: null, workspaceKey: 'pasteleria-principal' };
  }

  const key = `${cfg.supabaseUrl}|${cfg.supabaseAnonKey}`;
  if (!cachedClient || cachedConfigKey !== key) {
    try {
      cachedClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      cachedConfigKey = key;
    } catch {
      cachedClient = null;
    }
  }

  return {
    client: cachedClient,
    workspaceKey: cfg.workspaceKey || 'pasteleria-principal',
  };
}

export const SUPABASE_SETUP_SQL = `-- Copia y pega esto en el "SQL Editor" de tu proyecto gratuito en Supabase.com:
create table if not exists public.bakery_workspace (
  workspace_key text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bakery_workspace enable row level security;

create policy "Permitir acceso al espacio de trabajo"
  on public.bakery_workspace
  for all
  using (true)
  with check (true);
`;
