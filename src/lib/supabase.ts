import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  workspaceKey: string; // Clave privada compartida entre tú y tu novia para sincronizar el mismo espacio
}

const CLOUD_CONFIG_STORAGE_KEY = 'pasteleria_cloud_config_v1';

const DEFAULT_SUPABASE_URL = 'https://jsujoejhsoeghfogzwkj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdWpvZWpoc29lZ2hmb2d6d2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NTE4ODUsImV4cCI6MjEwODEyNzg4NX0.WGVMJ-WT3SzBc9m5H6aqU0fJ9mnARtdzuoJnBL2sm80';
const DEFAULT_WORKSPACE_KEY = 'dulces-melito-principal';

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function getSavedCloudConfig(): CloudConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const envWorkspace =
    process.env.NEXT_PUBLIC_WORKSPACE_KEY || DEFAULT_WORKSPACE_KEY;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CloudConfig;
        if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          return {
            ...parsed,
            supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl),
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  if (envUrl && envKey) {
    return {
      supabaseUrl: normalizeSupabaseUrl(envUrl),
      supabaseAnonKey: envKey.trim(),
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
