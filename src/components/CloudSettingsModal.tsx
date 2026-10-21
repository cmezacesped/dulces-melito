'use client';

import React, { useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  getSavedCloudConfig,
  saveCloudConfig,
  SUPABASE_SETUP_SQL,
} from '@/lib/supabase';
import { BakeryState } from '@/types/bakery';
import {
  Check,
  Cloud,
  Copy,
  Download,
  Lock,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CloudSettingsModal({ isOpen, onClose }: Props) {
  const {
    state,
    syncStatus,
    setAccessPin,
    importFullState,
    refreshFromCloud,
  } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const existingCloud = getSavedCloudConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(
    existingCloud?.supabaseUrl || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    existingCloud?.supabaseAnonKey || ''
  );
  const [workspaceKey, setWorkspaceKey] = useState(
    existingCloud?.workspaceKey || 'pasteleria-privada'
  );
  const [pinInput, setPinInput] = useState(state.accessPin || '');
  const [copiedSql, setCopiedSql] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      saveCloudConfig(null);
      setSavedNotice('Modo local activado.');
    } else {
      saveCloudConfig({
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        workspaceKey: workspaceKey.trim() || 'pasteleria-privada',
      });
      await refreshFromCloud();
      setSavedNotice('Configuración de nube guardada y sincronizada.');
    }
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setAccessPin(pinInput);
    setSavedNotice(
      pinInput.trim()
        ? 'Clave de acceso privada actualizada.'
        : 'Clave de acceso desactivada.'
    );
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-pasteleria-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BakeryState;
        const ok = await confirmAction({
          title: 'Restaurar Copia de Seguridad',
          message:
            '¿Deseas restaurar este archivo de respaldo? Reemplazará los datos actuales por los del respaldo.',
          confirmLabel: 'Sí, Restaurar',
          variant: 'warning',
        });
        if (ok) {
          importFullState(parsed);
          setSavedNotice('Respaldo restaurado correctamente.');
          showToast(
            'Respaldo restaurado',
            'Todos tus datos fueron cargados correctamente.'
          );
        }
      } catch {
        showToast(
          'Archivo no válido',
          'El archivo seleccionado no es un respaldo JSON válido.',
          'error'
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <h3 className="font-bold text-stone-800 text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5 text-amber-600" />
            Sincronización en la Nube, Seguridad y Respaldos
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {savedNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              {savedNotice}
            </div>
          )}

          {/* 1. Clave Privada de Acceso */}
          <form
            onSubmit={handleSavePin}
            className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <Lock className="w-4 h-4 text-amber-700" />
              1. Clave Privada de Acceso (Solo para ella y para ti)
            </div>
            <p className="text-xs text-stone-600">
              Define una contraseña o PIN privado. Cada vez que alguien abra la página en un navegador nuevo, pedirá esta clave para entrar.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Ej. dulcenoviembre2026 (deja vacío para no pedir clave)"
                className="flex-1 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-semibold"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Guardar Clave
              </button>
            </div>
          </form>

          {/* 2. Sincronización Gratuita en Tiempo Real con Supabase */}
          <form
            onSubmit={handleSaveCloud}
            className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-800 font-bold text-sm">
                <Cloud className="w-4 h-4 text-emerald-600" />
                2. Sincronización en la Nube (Supabase Gratis)
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white border border-stone-200">
                Estado: {syncStatus === 'synced' ? '🟢 Conectado' : syncStatus === 'syncing' ? '⏳ Sincronizando' : syncStatus === 'error' ? '🔴 Error' : '💻 Guardado Local'}
              </span>
            </div>

            <p className="text-xs text-stone-500">
              Para que tu celular y el de tu novia vean exactamente lo mismo en tiempo real, crea un proyecto gratuito en <strong>supabase.com</strong> y pega aquí el URL y Anon Key:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Supabase Anon Public Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Código de Espacio Compartido
                </label>
                <input
                  type="text"
                  value={workspaceKey}
                  onChange={(e) => setWorkspaceKey(e.target.value)}
                  placeholder="pasteleria-privada"
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-lg border border-stone-200"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedSql
                  ? '¡SQL Copiado al portapapeles!'
                  : 'Copiar SQL para crear tabla en Supabase'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshFromCloud()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sincronizar Ahora
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold"
                >
                  Guardar Conexión
                </button>
              </div>
            </div>
          </form>

          {/* 3. Respaldo en Archivo Local (JSON) */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-stone-800 text-sm">
                3. Descargar o Restaurar Copia de Seguridad
              </div>
              <p className="text-xs text-stone-500">
                Guarda una copia completa de tus ingredientes, recetas, cajas y pedidos en tu computador o celular.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 text-xs font-semibold hover:bg-stone-100"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 text-xs font-semibold hover:bg-stone-100 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Importar
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
