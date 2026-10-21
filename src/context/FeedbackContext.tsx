'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Info,
  Trash2,
  X,
} from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface FeedbackContextValue {
  showToast: (
    title: string,
    description?: string,
    type?: ToastType
  ) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(
  undefined
);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((result: boolean) => void) | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      title: string,
      description?: string,
      type: ToastType = 'success'
    ) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const confirmAction = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const handleConfirmDecision = (decision: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(decision);
      confirmResolverRef.current = null;
    }
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* Contenedor Flotante de Notificaciones (Toasts) */}
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const styles =
            t.type === 'success'
              ? {
                  border: 'border-emerald-200',
                  bg: 'bg-white',
                  iconBg: 'bg-emerald-100 text-emerald-700',
                  icon: <CheckCircle2 className="w-5 h-5" />,
                }
              : t.type === 'error'
              ? {
                  border: 'border-red-200',
                  bg: 'bg-white',
                  iconBg: 'bg-red-100 text-red-700',
                  icon: <AlertTriangle className="w-5 h-5" />,
                }
              : t.type === 'warning'
              ? {
                  border: 'border-amber-200',
                  bg: 'bg-white',
                  iconBg: 'bg-amber-100 text-amber-700',
                  icon: <Flame className="w-5 h-5" />,
                }
              : {
                  border: 'border-stone-200',
                  bg: 'bg-white',
                  iconBg: 'bg-stone-100 text-stone-700',
                  icon: <Info className="w-5 h-5" />,
                };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border ${styles.border} ${styles.bg} transition-all duration-200`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}
              >
                {styles.icon}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900 leading-snug">
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Personalizado de Confirmación (Reemplaza el confirm() del navegador) */}
      {confirmState && (
        <div className="fixed inset-0 z-[80] bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  confirmState.variant === 'danger'
                    ? 'bg-red-100 text-red-700'
                    : confirmState.variant === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {confirmState.variant === 'danger' ? (
                  <Trash2 className="w-6 h-6" />
                ) : confirmState.variant === 'warning' ? (
                  <Flame className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-stone-900">
                  {confirmState.title}
                </h3>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => handleConfirmDecision(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                {confirmState.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDecision(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition ${
                  confirmState.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmState.variant === 'warning'
                    ? 'bg-stone-900 hover:bg-stone-800'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmState.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback debe usarse dentro de un FeedbackProvider');
  }
  return ctx;
}
