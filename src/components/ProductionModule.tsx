'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  calculateOrderMetrics,
  calculateProductionAndShopping,
  formatCLP,
  formatNumberCL,
} from '@/lib/calculations';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Flame,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysStr(baseStr: string, days: number): string {
  const [y, m, d] = baseStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ProductionModule() {
  const { state, deductMultipleOrdersStock } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const today = useMemo(() => getTodayStr(), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => addDaysStr(today, 7));
  const [onlyNotDeductedOrders, setOnlyNotDeductedOrders] = useState(true);
  const [showOnlyMissingSupplies, setShowOnlyMissingSupplies] = useState(false);

  const setPresetRange = (preset: 'today' | 'tomorrow' | 'week' | 'month') => {
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'tomorrow') {
      const tom = addDaysStr(today, 1);
      setStartDate(tom);
      setEndDate(tom);
    } else if (preset === 'week') {
      setStartDate(today);
      setEndDate(addDaysStr(today, 7));
    } else if (preset === 'month') {
      setStartDate(today);
      setEndDate(addDaysStr(today, 30));
    }
  };

  // Todos los pedidos activos del rango (para el resumen financiero)
  const periodActiveOrders = useMemo(() => {
    return state.orders.filter((o) => {
      if (o.orderStatus === 'cancelled') return false;
      return o.deliveryDate >= startDate && o.deliveryDate <= endDate;
    });
  }, [state.orders, startDate, endDate]);

  // Pedidos que se usan para calcular "¿Qué debo hornear?" y "Lista de Compras"
  // Por defecto solo incluye los pedidos que AÚN NO han descontado stock (!o.stockDeducted)
  // para evitar que se descuenten o compren dos veces.
  const filteredOrders = useMemo(() => {
    return periodActiveOrders.filter((o) => {
      if (onlyNotDeductedOrders && (o.stockDeducted || o.orderStatus === 'delivered')) {
        return false;
      }
      return true;
    });
  }, [periodActiveOrders, onlyNotDeductedOrders]);

  const pendingStockOrders = useMemo(
    () =>
      periodActiveOrders.filter(
        (o) => !o.stockDeducted && o.orderStatus !== 'delivered'
      ),
    [periodActiveOrders]
  );

  const { recipesToBake, shoppingList } = useMemo(() => {
    return calculateProductionAndShopping(
      filteredOrders,
      state.boxes,
      state.recipes,
      state.supplies
    );
  }, [filteredOrders, state.boxes, state.recipes, state.supplies]);

  const financialSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalPendingPayment = 0;

    for (const ord of periodActiveOrders) {
      const m = calculateOrderMetrics(
        ord,
        state.boxes,
        state.recipes,
        state.supplies
      );
      totalRevenue += m.totalSale;
      totalCost += m.totalProductionCost;
      totalProfit += m.netProfit;
      totalPendingPayment += m.remainingBalance;
    }

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      totalPendingPayment,
    };
  }, [periodActiveOrders, state.boxes, state.recipes, state.supplies]);

  const displayedShoppingList = useMemo(() => {
    if (!showOnlyMissingSupplies) return shoppingList;
    return shoppingList.filter((item) => item.missingQuantity > 0);
  }, [shoppingList, showOnlyMissingSupplies]);

  const totalEstimatedShoppingCost = useMemo(() => {
    return shoppingList
      .filter((i) => i.missingQuantity > 0)
      .reduce((acc, i) => acc + i.estimatedCostToBuy, 0);
  }, [shoppingList]);

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Fechas */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-amber-600" />
              Resumen de Producción y Lista de Compras
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Suma todas las cajas y pedidos del rango elegido para decirte exactamente cuántas galletas hornear y qué ingredientes te faltan en bodega.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1.5 rounded-xl">
            <button
              onClick={() => setPresetRange('today')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-stone-800 shadow-2xs hover:bg-amber-50 transition"
            >
              Hoy
            </button>
            <button
              onClick={() => setPresetRange('tomorrow')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-stone-800 shadow-2xs hover:bg-amber-50 transition"
            >
              Mañana
            </button>
            <button
              onClick={() => setPresetRange('week')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white shadow-2xs hover:bg-amber-700 transition"
            >
              Próximos 7 días
            </button>
            <button
              onClick={() => setPresetRange('month')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-stone-800 shadow-2xs hover:bg-amber-50 transition"
            >
              Próximos 30 días
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-stone-600 uppercase">
                Desde:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-stone-600 uppercase">
                Hasta:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyNotDeductedOrders}
              onChange={(e) => setOnlyNotDeductedOrders(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            Mostrar en horneado/compras solo pedidos pendientes de descontar stock ({pendingStockOrders.length} de {periodActiveOrders.length})
          </label>
        </div>
      </div>

      {/* Tarjetas de Resumen Financiero del Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <span className="text-xs font-semibold text-stone-500 uppercase">
            Pedidos en el Período
          </span>
          <div className="text-2xl font-extrabold text-stone-900 mt-1">
            {periodActiveOrders.length} pedidos
          </div>
          <span className="text-xs text-stone-400">
            {pendingStockOrders.length} por hornear · {periodActiveOrders.length - pendingStockOrders.length} ya descontados
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <span className="text-xs font-semibold text-stone-500 uppercase">
            Ventas Totales ($ CLP)
          </span>
          <div className="text-2xl font-extrabold text-stone-900 mt-1">
            {formatCLP(financialSummary.totalRevenue)}
          </div>
          <span className="text-xs text-amber-700 font-medium">
            Por cobrar: {formatCLP(financialSummary.totalPendingPayment)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <span className="text-xs font-semibold text-stone-500 uppercase">
            Costo de Producción
          </span>
          <div className="text-2xl font-bold text-stone-800 mt-1">
            {formatCLP(financialSummary.totalCost)}
          </div>
          <span className="text-xs text-stone-400">
            Ingredientes + Empaques
          </span>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl shadow-sm border border-emerald-200">
          <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Ganancia Neta Estimada
          </span>
          <div className="text-2xl font-extrabold text-emerald-800 mt-1">
            {formatCLP(financialSummary.totalProfit)}
          </div>
          <span className="text-xs text-emerald-700">
            Libre de costos de insumos
          </span>
        </div>
      </div>

      {/* Dos Columnas: 1. Qué debo hornear | 2. Lista de Compras vs Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna 1: Qué debo hornear */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 bg-amber-50/60 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-700" />
                ¿Qué debo hornear?
              </h3>
              <p className="text-xs text-stone-500">
                Unidades requeridas por los pedidos pendientes de hornear
              </p>
            </div>

            {pendingStockOrders.length > 0 && (
              <button
                onClick={async () => {
                  const ok = await confirmAction({
                    title: 'Hornear Pedidos y Descontar Stock',
                    message: `Se descontarán de tu Bodega todos los ingredientes y cajas de los ${pendingStockOrders.length} pedidos pendientes de este período, y pasarán automáticamente al estado "En Preparación / Horneado" con el sello "Stock Descontado" en el Calendario (así nunca se descontarán dos veces).`,
                    confirmLabel: 'Sí, Hornear y Descontar',
                    variant: 'warning',
                  });
                  if (ok) {
                    const count = deductMultipleOrdersStock(
                      pendingStockOrders.map((o) => o.id)
                    );
                    showToast(
                      '¡Pedidos en preparación y stock descontado!',
                      `Se descontó el stock de ${count} pedido(s) y quedaron marcados como "Stock Descontado" en el Calendario.`
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Hornear Todos ({pendingStockOrders.length} ped.)
              </button>
            )}
          </div>

          {recipesToBake.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              {periodActiveOrders.length > 0 && pendingStockOrders.length === 0
                ? '¡Todos los pedidos de este período ya fueron horneados y descontados de la Bodega!'
                : 'No hay unidades pendientes por hornear en este rango de fechas.'}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {recipesToBake.map(({ recipe, totalUnitsToBake, batchesNeeded }) => (
                <div
                  key={recipe.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-stone-50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-amber-700">
                        {formatNumberCL(totalUnitsToBake)}x
                      </span>
                      <span className="font-bold text-stone-800">
                        {recipe.name}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                        Línea: {recipe.line}
                      </span>
                      <span>
                        Equivale a{' '}
                        <strong>{formatNumberCL(batchesNeeded, 2)} lotes</strong>{' '}
                        (rinde {recipe.yieldUnits} u/lote)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna 2: Lista de Compras Automática vs Stock */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-700" />
                Lista de Compras vs. Stock en Bodega
              </h3>
              <p className="text-xs text-stone-500">
                Compara lo que necesitan tus pedidos contra lo que tienes hoy en Bodega
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-stone-200">
              <input
                type="checkbox"
                checked={showOnlyMissingSupplies}
                onChange={(e) => setShowOnlyMissingSupplies(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-600"
              />
              Ver solo lo que falta comprar
            </label>
          </div>

          {displayedShoppingList.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              {shoppingList.length === 0
                ? 'Cuando agendes pedidos en el calendario, aquí aparecerá la lista de ingredientes y empaques necesarios.'
                : '¡Tienes stock suficiente de todos los ingredientes para cumplir con estos pedidos!'}
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase">
                      <th className="py-3 px-4">Insumo / Empaque</th>
                      <th className="py-3 px-4">Necesario</th>
                      <th className="py-3 px-4">En Stock</th>
                      <th className="py-3 px-4">Estado / Falta Comprar</th>
                      <th className="py-3 px-4 text-right">Costo Est. Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                    {displayedShoppingList.map((item) => {
                      const isMissing = item.missingQuantity > 0;
                      return (
                        <tr
                          key={item.supply.id}
                          className={
                            isMissing ? 'bg-red-50/40' : 'hover:bg-stone-50'
                          }
                        >
                          <td className="py-3 px-4 font-semibold text-stone-800">
                            {item.supply.name}
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-700">
                            {formatNumberCL(item.requiredQuantity)}{' '}
                            {item.supply.unit}
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            {formatNumberCL(item.currentStock)}{' '}
                            {item.supply.unit}
                          </td>
                          <td className="py-3 px-4">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-bold text-xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Comprar {formatNumberCL(item.missingQuantity)}{' '}
                                {item.supply.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Cubierto
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-stone-800">
                            {isMissing
                              ? formatCLP(item.estimatedCostToBuy)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalEstimatedShoppingCost > 0 && (
                <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-stone-300">
                    Presupuesto estimado para comprar faltantes:
                  </span>
                  <span className="text-lg font-extrabold text-amber-400">
                    {formatCLP(totalEstimatedShoppingCost)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
