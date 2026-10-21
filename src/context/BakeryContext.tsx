'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  BakeryState,
  CustomerOrder,
  ExpenseRecord,
  ProductBox,
  Recipe,
  SupplyItem,
} from '@/types/bakery';
import {
  accumulateRecipeRawSupplies,
  calculateProductionAndShopping,
} from '@/lib/calculations';
import { getSupabaseClient } from '@/lib/supabase';

const LOCAL_STORAGE_KEY = 'pasteleria_ny_state_v1';

const INITIAL_EMPTY_STATE: BakeryState = {
  supplies: [],
  recipes: [],
  boxes: [],
  orders: [],
  expenses: [],
  recipeLines: ['Base', 'Sin azúcar', 'Sin gluten', 'Vegano'],
  accessPin: '',
};

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface BakeryContextValue {
  state: BakeryState;
  isLoaded: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  // Insumos y Bodega
  addSupply: (item: Omit<SupplyItem, 'id' | 'updatedAt'>) => SupplyItem;
  updateSupply: (id: string, item: Partial<SupplyItem>) => void;
  deleteSupply: (id: string) => void;
  registerSupplyPurchase: (
    id: string,
    addedQuantity: number,
    newPurchaseQuantity: number,
    newPurchaseCost: number
  ) => void;
  adjustSupplyStock: (id: string, delta: number) => void;
  // Recetas y Sub-recetas
  addRecipe: (recipe: Omit<Recipe, 'id' | 'updatedAt'>) => Recipe;
  updateRecipe: (id: string, recipe: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  duplicateRecipe: (id: string, newName?: string, newLine?: string) => Recipe | null;
  bakeRecipeBatch: (recipeId: string, unitsToBake: number) => void;
  addRecipeCategoryLine: (lineName: string) => void;
  removeRecipeCategoryLine: (lineName: string) => void;
  // Armador de Cajas / Packs
  addBox: (box: Omit<ProductBox, 'id' | 'updatedAt'>) => ProductBox;
  updateBox: (id: string, box: Partial<ProductBox>) => void;
  deleteBox: (id: string) => void;
  // Pedidos del Calendario
  addOrder: (order: Omit<CustomerOrder, 'id' | 'createdAt'>) => CustomerOrder;
  updateOrder: (id: string, order: Partial<CustomerOrder>) => void;
  deleteOrder: (id: string) => void;
  deductOrderStock: (orderId: string) => boolean;
  deductMultipleOrdersStock: (orderIds: string[]) => number;
  // Gastos e Historial de Compras
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => ExpenseRecord;
  deleteExpense: (id: string) => void;
  // Seguridad y Respaldo
  setAccessPin: (pin: string) => void;
  importFullState: (newState: BakeryState) => void;
  clearAllData: () => void;
  refreshFromCloud: () => Promise<void>;
}

const BakeryContext = createContext<BakeryContextValue | undefined>(undefined);

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function BakeryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BakeryState>(INITIAL_EMPTY_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isCloudReadyRef = useRef(false);
  const shouldPushToCloudRef = useRef(false);

  // Función auxiliar para actualizar el estado marcando que fue un cambio real del usuario
  const updateStateAndSync = useCallback(
    (updater: BakeryState | ((prev: BakeryState) => BakeryState)) => {
      shouldPushToCloudRef.current = true;
      setState(updater);
    },
    []
  );

  // Cargar estado inicial desde Supabase (la nube es la fuente de la verdad al abrir la app)
  const refreshFromCloud = useCallback(async () => {
    const { client, workspaceKey } = getSupabaseClient();
    if (!client) {
      isCloudReadyRef.current = true;
      setSyncStatus('local');
      return;
    }

    setSyncStatus('syncing');
    try {
      const { data, error } = await client
        .from('bakery_workspace')
        .select('state, updated_at')
        .eq('workspace_key', workspaceKey)
        .maybeSingle();

      if (error) {
        isCloudReadyRef.current = true;
        setSyncStatus('error');
        return;
      }

      if (data && data.state) {
        const remoteState = data.state as BakeryState;
        const normalizedRemote: BakeryState = {
          supplies: remoteState.supplies || [],
          recipes: remoteState.recipes || [],
          boxes: remoteState.boxes || [],
          orders: remoteState.orders || [],
          expenses: remoteState.expenses || [],
          recipeLines:
            remoteState.recipeLines && remoteState.recipeLines.length > 0
              ? remoteState.recipeLines
              : INITIAL_EMPTY_STATE.recipeLines,
          accessPin: remoteState.accessPin || '',
        };
        shouldPushToCloudRef.current = false;
        setState(normalizedRemote);
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(normalizedRemote)
        );
        setLastSyncedAt(data.updated_at || new Date().toISOString());
      }
      isCloudReadyRef.current = true;
      setSyncStatus('synced');
    } catch {
      isCloudReadyRef.current = true;
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<BakeryState>;
          setState({
            supplies: parsed.supplies || [],
            recipes: parsed.recipes || [],
            boxes: parsed.boxes || [],
            orders: parsed.orders || [],
            expenses: parsed.expenses || [],
            recipeLines:
              parsed.recipeLines && parsed.recipeLines.length > 0
                ? parsed.recipeLines
                : INITIAL_EMPTY_STATE.recipeLines,
            accessPin: parsed.accessPin || '',
          });
        }
      } catch {
        // ignore parse errors
      }

      await refreshFromCloud();
      if (mounted) {
        setIsLoaded(true);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [refreshFromCloud]);

  // Guardar automáticamente en localStorage y sincronizar con Supabase SOLO cuando el usuario hace un cambio
  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }

    if (!isCloudReadyRef.current || !shouldPushToCloudRef.current) return;

    const { client, workspaceKey } = getSupabaseClient();
    if (!client) {
      setSyncStatus('local');
      return;
    }

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const now = new Date().toISOString();
        const { error } = await client.from('bakery_workspace').upsert(
          {
            workspace_key: workspaceKey,
            state,
            updated_at: now,
          },
          { onConflict: 'workspace_key' }
        );

        if (error) {
          setSyncStatus('error');
        } else {
          shouldPushToCloudRef.current = false;
          setSyncStatus('synced');
          setLastSyncedAt(now);
        }
      } catch {
        setSyncStatus('error');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [state, isLoaded]);

  // Acciones de Bodega / Insumos
  const addSupply = useCallback((item: Omit<SupplyItem, 'id' | 'updatedAt'>) => {
    const newItem: SupplyItem = {
      ...item,
      id: generateId('sup'),
      updatedAt: new Date().toISOString(),
    };
    updateStateAndSync((prev) => ({
      ...prev,
      supplies: [...prev.supplies, newItem],
    }));
    return newItem;
  }, [updateStateAndSync]);

  const updateSupply = useCallback((id: string, item: Partial<SupplyItem>) => {
    updateStateAndSync((prev) => ({
      ...prev,
      supplies: prev.supplies.map((s) =>
        s.id === id ? { ...s, ...item, updatedAt: new Date().toISOString() } : s
      ),
    }));
  }, [updateStateAndSync]);

  const deleteSupply = useCallback((id: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      supplies: prev.supplies.filter((s) => s.id !== id),
    }));
  }, [updateStateAndSync]);

  const registerSupplyPurchase = useCallback(
    (
      id: string,
      addedQuantity: number,
      newPurchaseQuantity: number,
      newPurchaseCost: number
    ) => {
      updateStateAndSync((prev) => {
        const target = prev.supplies.find((s) => s.id === id);
        const todayStr = new Date().toISOString().slice(0, 10);
        const newExpenses = [...(prev.expenses || [])];

        if (target && newPurchaseCost > 0) {
          newExpenses.unshift({
            id: generateId('exp'),
            date: todayStr,
            description: `Compra Bodega: ${target.name} (+${addedQuantity} ${target.unit})`,
            category:
              target.type === 'packaging'
                ? 'packaging_purchase'
                : 'ingredient_purchase',
            amount: newPurchaseCost,
            supplyId: target.id,
            quantityAdded: addedQuantity,
            unit: target.unit,
          });
        }

        return {
          ...prev,
          expenses: newExpenses,
          supplies: prev.supplies.map((s) =>
            s.id === id
              ? {
                  ...s,
                  currentStock: Math.max(0, (s.currentStock || 0) + addedQuantity),
                  purchaseQuantity:
                    newPurchaseQuantity > 0
                      ? newPurchaseQuantity
                      : s.purchaseQuantity,
                  purchaseCost:
                    newPurchaseCost >= 0 ? newPurchaseCost : s.purchaseCost,
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        };
      });
    },
    [updateStateAndSync]
  );

  const adjustSupplyStock = useCallback((id: string, delta: number) => {
    updateStateAndSync((prev) => ({
      ...prev,
      supplies: prev.supplies.map((s) =>
        s.id === id
          ? {
              ...s,
              currentStock: Math.max(0, Number(((s.currentStock || 0) + delta).toFixed(2))),
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    }));
  }, [updateStateAndSync]);

  // Acciones de Recetas y Sub-recetas
  const addRecipe = useCallback((recipe: Omit<Recipe, 'id' | 'updatedAt'>) => {
    const newRecipe: Recipe = {
      ...recipe,
      id: generateId('rec'),
      updatedAt: new Date().toISOString(),
    };
    updateStateAndSync((prev) => ({
      ...prev,
      recipes: [...prev.recipes, newRecipe],
    }));
    return newRecipe;
  }, [updateStateAndSync]);

  const updateRecipe = useCallback((id: string, recipe: Partial<Recipe>) => {
    updateStateAndSync((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) =>
        r.id === id ? { ...r, ...recipe, updatedAt: new Date().toISOString() } : r
      ),
    }));
  }, [updateStateAndSync]);

  const deleteRecipe = useCallback((id: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((r) => r.id !== id),
    }));
  }, [updateStateAndSync]);

  const duplicateRecipe = useCallback(
    (id: string, newName?: string, newLine?: string): Recipe | null => {
      const original = state.recipes.find((r) => r.id === id);
      if (!original) return null;

      const copy: Recipe = {
        ...original,
        id: generateId('rec'),
        name: newName || `${original.name} (Copia)`,
        line: newLine || original.line,
        lines: original.lines.map((l) => ({
          ...l,
          id: generateId('line'),
        })),
        updatedAt: new Date().toISOString(),
      };

      updateStateAndSync((prev) => ({
        ...prev,
        recipes: [...prev.recipes, copy],
      }));
      return copy;
    },
    [state.recipes, updateStateAndSync]
  );

  const bakeRecipeBatch = useCallback((recipeId: string, unitsToBake: number) => {
    updateStateAndSync((prev) => {
      const recipe = prev.recipes.find((r) => r.id === recipeId);
      if (!recipe || unitsToBake <= 0) return prev;

      const consumption = new Map<string, number>();
      accumulateRecipeRawSupplies(
        recipe,
        unitsToBake,
        prev.supplies,
        prev.recipes,
        consumption
      );

      const updatedSupplies = prev.supplies.map((s) => {
        const used = consumption.get(s.id) || 0;
        if (used <= 0) return s;
        return {
          ...s,
          currentStock: Math.max(0, Number(((s.currentStock || 0) - used).toFixed(2))),
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...prev,
        supplies: updatedSupplies,
      };
    });
  }, [updateStateAndSync]);

  const addRecipeCategoryLine = useCallback((lineName: string) => {
    const clean = lineName.trim();
    if (!clean) return;
    updateStateAndSync((prev) => {
      if (prev.recipeLines.includes(clean)) return prev;
      return {
        ...prev,
        recipeLines: [...prev.recipeLines, clean],
      };
    });
  }, [updateStateAndSync]);

  const removeRecipeCategoryLine = useCallback((lineName: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      recipeLines: prev.recipeLines.filter((l) => l !== lineName),
    }));
  }, [updateStateAndSync]);

  // Acciones de Cajas / Productos Armados
  const addBox = useCallback((box: Omit<ProductBox, 'id' | 'updatedAt'>) => {
    const newBox: ProductBox = {
      ...box,
      id: generateId('box'),
      updatedAt: new Date().toISOString(),
    };
    updateStateAndSync((prev) => ({
      ...prev,
      boxes: [...prev.boxes, newBox],
    }));
    return newBox;
  }, [updateStateAndSync]);

  const updateBox = useCallback((id: string, box: Partial<ProductBox>) => {
    updateStateAndSync((prev) => ({
      ...prev,
      boxes: prev.boxes.map((b) =>
        b.id === id ? { ...b, ...box, updatedAt: new Date().toISOString() } : b
      ),
    }));
  }, [updateStateAndSync]);

  const deleteBox = useCallback((id: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      boxes: prev.boxes.filter((b) => b.id !== id),
    }));
  }, [updateStateAndSync]);

  // Acciones de Pedidos / Calendario
  const addOrder = useCallback((order: Omit<CustomerOrder, 'id' | 'createdAt'>) => {
    const newOrder: CustomerOrder = {
      ...order,
      id: generateId('ord'),
      createdAt: new Date().toISOString(),
    };
    updateStateAndSync((prev) => ({
      ...prev,
      orders: [...prev.orders, newOrder],
    }));
    return newOrder;
  }, [updateStateAndSync]);

  const updateOrder = useCallback((id: string, order: Partial<CustomerOrder>) => {
    updateStateAndSync((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === id ? { ...o, ...order } : o)),
    }));
  }, [updateStateAndSync]);

  const deleteOrder = useCallback((id: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== id),
    }));
  }, [updateStateAndSync]);

  const deductOrderStock = useCallback((orderId: string): boolean => {
    let didDeduct = false;
    updateStateAndSync((prev) => {
      const targetOrder = prev.orders.find((o) => o.id === orderId);
      if (!targetOrder || targetOrder.stockDeducted) return prev;

      const { supplyConsumptionMap } = calculateProductionAndShopping(
        [targetOrder],
        prev.boxes,
        prev.recipes,
        prev.supplies
      );

      didDeduct = true;
      const updatedSupplies = prev.supplies.map((s) => {
        const used = supplyConsumptionMap.get(s.id) || 0;
        if (used <= 0) return s;
        return {
          ...s,
          currentStock: Math.max(0, Number(((s.currentStock || 0) - used).toFixed(2))),
          updatedAt: new Date().toISOString(),
        };
      });

      const updatedOrders = prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              stockDeducted: true,
              orderStatus:
                o.orderStatus === 'scheduled' ? 'preparing' : o.orderStatus,
            }
          : o
      );

      return {
        ...prev,
        supplies: updatedSupplies,
        orders: updatedOrders,
      };
    });
    return didDeduct;
  }, [updateStateAndSync]);

  const deductMultipleOrdersStock = useCallback((orderIds: string[]): number => {
    let deductedCount = 0;
    updateStateAndSync((prev) => {
      const targetOrders = prev.orders.filter(
        (o) =>
          orderIds.includes(o.id) &&
          !o.stockDeducted &&
          o.orderStatus !== 'cancelled'
      );
      if (targetOrders.length === 0) return prev;

      deductedCount = targetOrders.length;
      const { supplyConsumptionMap } = calculateProductionAndShopping(
        targetOrders,
        prev.boxes,
        prev.recipes,
        prev.supplies
      );

      const updatedSupplies = prev.supplies.map((s) => {
        const used = supplyConsumptionMap.get(s.id) || 0;
        if (used <= 0) return s;
        return {
          ...s,
          currentStock: Math.max(
            0,
            Number(((s.currentStock || 0) - used).toFixed(2))
          ),
          updatedAt: new Date().toISOString(),
        };
      });

      const targetIdSet = new Set(targetOrders.map((o) => o.id));
      const updatedOrders = prev.orders.map((o) =>
        targetIdSet.has(o.id)
          ? {
              ...o,
              stockDeducted: true,
              orderStatus:
                o.orderStatus === 'scheduled' ? 'preparing' : o.orderStatus,
            }
          : o
      );

      return {
        ...prev,
        supplies: updatedSupplies,
        orders: updatedOrders,
      };
    });
    return deductedCount;
  }, [updateStateAndSync]);

  const addExpense = useCallback((expense: Omit<ExpenseRecord, 'id'>) => {
    const newExp: ExpenseRecord = {
      ...expense,
      id: generateId('exp'),
    };
    updateStateAndSync((prev) => ({
      ...prev,
      expenses: [newExp, ...(prev.expenses || [])],
    }));
    return newExp;
  }, [updateStateAndSync]);

  const deleteExpense = useCallback((id: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((e) => e.id !== id),
    }));
  }, [updateStateAndSync]);

  const setAccessPin = useCallback((pin: string) => {
    updateStateAndSync((prev) => ({
      ...prev,
      accessPin: pin.trim(),
    }));
  }, [updateStateAndSync]);

  const importFullState = useCallback((newState: BakeryState) => {
    updateStateAndSync({
      supplies: newState.supplies || [],
      recipes: newState.recipes || [],
      boxes: newState.boxes || [],
      orders: newState.orders || [],
      expenses: newState.expenses || [],
      recipeLines:
        newState.recipeLines && newState.recipeLines.length > 0
          ? newState.recipeLines
          : INITIAL_EMPTY_STATE.recipeLines,
      accessPin: newState.accessPin || '',
    });
  }, [updateStateAndSync]);

  const clearAllData = useCallback(() => {
    updateStateAndSync(INITIAL_EMPTY_STATE);
  }, [updateStateAndSync]);

  return (
    <BakeryContext.Provider
      value={{
        state,
        isLoaded,
        syncStatus,
        lastSyncedAt,
        addSupply,
        updateSupply,
        deleteSupply,
        registerSupplyPurchase,
        adjustSupplyStock,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        duplicateRecipe,
        bakeRecipeBatch,
        addRecipeCategoryLine,
        removeRecipeCategoryLine,
        addBox,
        updateBox,
        deleteBox,
        addOrder,
        updateOrder,
        deleteOrder,
        deductOrderStock,
        deductMultipleOrdersStock,
        addExpense,
        deleteExpense,
        setAccessPin,
        importFullState,
        clearAllData,
        refreshFromCloud,
      }}
    >
      {children}
    </BakeryContext.Provider>
  );
}

export function useBakery() {
  const ctx = useContext(BakeryContext);
  if (!ctx) {
    throw new Error('useBakery debe usarse dentro de un BakeryProvider');
  }
  return ctx;
}
