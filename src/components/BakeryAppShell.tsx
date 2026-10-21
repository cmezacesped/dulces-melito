'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import SuppliesModule from './SuppliesModule';
import RecipesModule from './RecipesModule';
import BoxesModule from './BoxesModule';
import CalendarModule from './CalendarModule';
import ProductionModule from './ProductionModule';
import FinancesModule from './FinancesModule';
import CloudSettingsModal from './CloudSettingsModal';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChefHat,
  ClipboardList,
  Cloud,
  Gift,
  Lock,
  Settings,
  Wheat,
} from 'lucide-react';

type ActiveModule =
  | 'supplies'
  | 'recipes'
  | 'boxes'
  | 'calendar'
  | 'production'
  | 'finances';

const SESSION_UNLOCK_KEY = 'pasteleria_unlocked_v1';

export default function BakeryAppShell() {
  const { state, isLoaded, syncStatus } = useBakery();
  const [activeModule, setActiveModule] = useState<ActiveModule>('supplies');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Control de bloqueo por clave privada
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState(false);

  const requiredPin =
    state.accessPin || process.env.NEXT_PUBLIC_ACCESS_PIN || '';

  useEffect(() => {
    if (!requiredPin) {
      setIsUnlocked(true);
      return;
    }
    const savedPin = localStorage.getItem(SESSION_UNLOCK_KEY);
    if (savedPin === requiredPin) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }
  }, [requiredPin]);

  const lowStockCount = useMemo(
    () =>
      state.supplies.filter(
        (s) => s.minStock > 0 && s.currentStock <= s.minStock
      ).length,
    [state.supplies]
  );

  const pendingOrdersCount = useMemo(
    () =>
      state.orders.filter(
        (o) => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled'
      ).length,
    [state.orders]
  );

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#fbf7f2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center animate-pulse">
            <ChefHat className="w-7 h-7" />
          </div>
          <span className="text-sm font-semibold text-stone-600">
            Cargando Dulces Melito...
          </span>
        </div>
      </div>
    );
  }

  // Pantalla de Acceso Privado si tienen clave configurada
  if (requiredPin && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#fbf7f2] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-amber-100 p-8 w-full max-w-md text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">
              Acceso Privado · Dulces Melito
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Ingresa tu clave privada para entrar al recetario y calendario de pedidos.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pinAttempt.trim() === requiredPin) {
                localStorage.setItem(SESSION_UNLOCK_KEY, requiredPin);
                setIsUnlocked(true);
                setPinError(false);
              } else {
                setPinError(true);
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={pinAttempt}
              onChange={(e) => setPinAttempt(e.target.value)}
              placeholder="Ingresa tu clave..."
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-center font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {pinError && (
              <p className="text-xs font-semibold text-red-600">
                Clave incorrecta. Intenta nuevamente.
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-sm transition"
            >
              Entrar al Taller
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: {
    id: ActiveModule;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'supplies',
      label: '1. Bodega e Insumos',
      shortLabel: 'Bodega',
      icon: <Wheat className="w-4 h-4" />,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-red-600 text-white',
    },
    {
      id: 'recipes',
      label: '2. Recetario',
      shortLabel: 'Recetas',
      icon: <BookOpen className="w-4 h-4" />,
      badge: state.recipes.length > 0 ? state.recipes.length : undefined,
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'boxes',
      label: '3. Armar Cajas',
      shortLabel: 'Cajas',
      icon: <Gift className="w-4 h-4" />,
      badge: state.boxes.length > 0 ? state.boxes.length : undefined,
      badgeColor: 'bg-stone-200 text-stone-800',
    },
    {
      id: 'calendar',
      label: '4. Calendario Pedidos',
      shortLabel: 'Pedidos',
      icon: <Calendar className="w-4 h-4" />,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      id: 'production',
      label: '5. Producción',
      shortLabel: 'Hornear',
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: 'finances',
      label: '6. Finanzas e Historial',
      shortLabel: 'Finanzas',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#fbf7f2] text-stone-800 pb-24 md:pb-12">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-stone-900 text-base sm:text-lg leading-tight">
                Dulces Melito
              </h1>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Ingredientes · Recetario · Armador de Cajas · Calendario de Pedidos
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-stone-100/90 p-1.5 rounded-2xl">
            {navItems.map((item) => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Botón Nube / Seguridad */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
          >
            <Cloud
              className={`w-4 h-4 ${
                syncStatus === 'synced'
                  ? 'text-emerald-600'
                  : syncStatus === 'error'
                  ? 'text-red-500'
                  : 'text-amber-600'
              }`}
            />
            <span className="hidden sm:inline">
              {syncStatus === 'synced'
                ? 'Nube Activa'
                : syncStatus === 'syncing'
                ? 'Sincronizando...'
                : 'Nube / Clave'}
            </span>
            <Settings className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {activeModule === 'supplies' && <SuppliesModule />}
        {activeModule === 'recipes' && <RecipesModule />}
        {activeModule === 'boxes' && <BoxesModule />}
        {activeModule === 'calendar' && <CalendarModule />}
        {activeModule === 'production' && <ProductionModule />}
        {activeModule === 'finances' && <FinancesModule />}
      </main>

      {/* Navegación Inferior Móvil / Tablet */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 px-2 py-1.5 grid grid-cols-6 gap-1 shadow-lg">
        {navItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold relative transition ${
                isActive ? 'text-amber-700 bg-amber-50' : 'text-stone-500'
              }`}
            >
              {item.icon}
              <span className="mt-0.5 truncate">{item.shortLabel}</span>
              {item.badge !== undefined && (
                <span
                  className={`absolute top-1 right-2 px-1.5 rounded-full text-[9px] font-extrabold ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Modal de Configuración de Nube, Clave Privada y Respaldos */}
      <CloudSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
