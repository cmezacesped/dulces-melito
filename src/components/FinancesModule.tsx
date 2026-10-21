'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  calculateOrderMetrics,
  formatCLP,
  formatNumberCL,
  getSupplyUnitCost,
} from '@/lib/calculations';
import {
  Award,
  BarChart3,
  Calendar,
  Check,
  DollarSign,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_LABELS[m] || m} ${y}`;
}

export default function FinancesModule() {
  const { state, addExpense, deleteExpense } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_year' | 'this_month' | string>('all');
  const [subTab, setSubTab] = useState<'monthly' | 'orders_history' | 'expenses_history'>('monthly');
  const [orderSearch, setOrderSearch] = useState('');
  const [onlyDelivered, setOnlyDelivered] = useState(false);

  // Modal para registrar un gasto extra (ej. gas, luz, envío, utensilios, etc.)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState<
    'ingredient_purchase' | 'packaging_purchase' | 'extra_expense'
  >('extra_expense');
  const [expAmount, setExpAmount] = useState('');

  const nowYear = String(new Date().getFullYear());
  const nowYearMonth = new Date().toISOString().slice(0, 7);

  // Meses disponibles en pedidos o gastos para filtrar
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    state.orders.forEach((o) => {
      if (o.deliveryDate && o.deliveryDate.length >= 7) {
        set.add(o.deliveryDate.slice(0, 7));
      }
    });
    (state.expenses || []).forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [state.orders, state.expenses]);

  // Valor actual del inventario guardado en Bodega
  const currentInventoryValue = useMemo(() => {
    return state.supplies.reduce((acc, s) => {
      const unitCost = getSupplyUnitCost(s);
      return acc + (s.currentStock || 0) * unitCost;
    }, 0);
  }, [state.supplies]);

  // Filtrado de pedidos según el período elegido
  const filteredOrders = useMemo(() => {
    return state.orders
      .filter((o) => {
        if (o.orderStatus === 'cancelled') return false;
        if (onlyDelivered && o.orderStatus !== 'delivered') return false;

        if (periodFilter === 'this_year') {
          return o.deliveryDate.startsWith(nowYear);
        }
        if (periodFilter === 'this_month') {
          return o.deliveryDate.startsWith(nowYearMonth);
        }
        if (periodFilter !== 'all') {
          return o.deliveryDate.startsWith(periodFilter);
        }
        return true;
      })
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
  }, [state.orders, periodFilter, onlyDelivered, nowYear, nowYearMonth]);

  // Filtrado de gastos/compras según el período elegido
  const filteredExpenses = useMemo(() => {
    const list = state.expenses || [];
    return list
      .filter((e) => {
        if (periodFilter === 'this_year') return e.date.startsWith(nowYear);
        if (periodFilter === 'this_month') return e.date.startsWith(nowYearMonth);
        if (periodFilter !== 'all') return e.date.startsWith(periodFilter);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.expenses, periodFilter, nowYear, nowYearMonth]);

  // Totales globales del período seleccionado
  const totals = useMemo(() => {
    let totalSales = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalProductionCost = 0;
    let totalNetProfit = 0;

    for (const ord of filteredOrders) {
      const m = calculateOrderMetrics(
        ord,
        state.boxes,
        state.recipes,
        state.supplies
      );
      totalSales += m.totalSale;
      totalProductionCost += m.totalProductionCost;
      totalNetProfit += m.netProfit;
      totalPending += m.remainingBalance;
      totalCollected += m.totalSale - m.remainingBalance;
    }

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const avgMargin =
      totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0;

    return {
      totalSales,
      totalCollected,
      totalPending,
      totalProductionCost,
      totalNetProfit,
      totalExpenses,
      avgMargin,
    };
  }, [filteredOrders, filteredExpenses, state.boxes, state.recipes, state.supplies]);

  // Desglose Histórico Mes a Mes
  const monthlyBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        yearMonth: string;
        ordersCount: number;
        sales: number;
        productionCost: number;
        netProfit: number;
        expenses: number;
      }
    >();

    for (const ord of state.orders) {
      if (ord.orderStatus === 'cancelled') continue;
      if (onlyDelivered && ord.orderStatus !== 'delivered') continue;

      const ym = ord.deliveryDate.slice(0, 7);
      const prev = map.get(ym) || {
        yearMonth: ym,
        ordersCount: 0,
        sales: 0,
        productionCost: 0,
        netProfit: 0,
        expenses: 0,
      };

      const m = calculateOrderMetrics(
        ord,
        state.boxes,
        state.recipes,
        state.supplies
      );
      prev.ordersCount += 1;
      prev.sales += m.totalSale;
      prev.productionCost += m.totalProductionCost;
      prev.netProfit += m.netProfit;
      map.set(ym, prev);
    }

    for (const exp of state.expenses || []) {
      const ym = exp.date.slice(0, 7);
      const prev = map.get(ym) || {
        yearMonth: ym,
        ordersCount: 0,
        sales: 0,
        productionCost: 0,
        netProfit: 0,
        expenses: 0,
      };
      prev.expenses += exp.amount;
      map.set(ym, prev);
    }

    return Array.from(map.values()).sort((a, b) =>
      b.yearMonth.localeCompare(a.yearMonth)
    );
  }, [state.orders, state.expenses, state.boxes, state.recipes, state.supplies, onlyDelivered]);

  // Ranking de Cajas y Sabores más vendidos en el período
  const topProducts = useMemo(() => {
    const boxSales = new Map<
      string,
      { name: string; units: number; revenue: number }
    >();
    const recipeUnits = new Map<string, { name: string; line: string; units: number }>();

    for (const ord of filteredOrders) {
      for (const item of ord.items) {
        if (item.type === 'box' && item.boxId) {
          const box = state.boxes.find((b) => b.id === item.boxId);
          const name = box ? box.name : 'Caja';
          const prevBox = boxSales.get(item.boxId) || {
            name,
            units: 0,
            revenue: 0,
          };
          prevBox.units += item.quantity;
          prevBox.revenue += item.unitSalePrice * item.quantity;
          boxSales.set(item.boxId, prevBox);

          const flavors =
            box?.isCustomizable && item.customSelections?.length
              ? item.customSelections
              : box?.fixedItems || [];
          for (const fl of flavors) {
            const rec = state.recipes.find((r) => r.id === fl.recipeId);
            if (!rec) continue;
            const prevRec = recipeUnits.get(rec.id) || {
              name: rec.name,
              line: rec.line,
              units: 0,
            };
            prevRec.units += fl.quantity * item.quantity;
            recipeUnits.set(rec.id, prevRec);
          }
        } else if (item.type === 'single_recipe' && item.recipeId) {
          const rec = state.recipes.find((r) => r.id === item.recipeId);
          if (!rec) continue;
          const prevRec = recipeUnits.get(rec.id) || {
            name: rec.name,
            line: rec.line,
            units: 0,
          };
          prevRec.units += item.quantity;
          recipeUnits.set(rec.id, prevRec);
        }
      }
    }

    return {
      topBoxes: Array.from(boxSales.values()).sort(
        (a, b) => b.revenue - a.revenue
      ),
      topRecipes: Array.from(recipeUnits.values()).sort(
        (a, b) => b.units - a.units
      ),
    };
  }, [filteredOrders, state.boxes, state.recipes]);

  const searchedOrders = useMemo(() => {
    if (!orderSearch.trim()) return filteredOrders;
    const q = orderSearch.toLowerCase();
    return filteredOrders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        (o.customerInstagram && o.customerInstagram.toLowerCase().includes(q)) ||
        o.deliveryDate.includes(q)
    );
  }, [filteredOrders, orderSearch]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim()) return;
    const amountNum = Math.max(0, Math.round(parseFloat(expAmount) || 0));
    if (amountNum <= 0) return;

    addExpense({
      date: expDate,
      description: expDesc.trim(),
      category: expCategory,
      amount: amountNum,
    });

    showToast(
      'Gasto registrado',
      `Se registró "${expDesc.trim()}" por ${formatCLP(amountNum)}.`
    );
    setExpDesc('');
    setExpAmount('');
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros de Tiempo */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-600" />
              Historial Total de Costos, Ventas y Ganancias
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Revisa la rentabilidad histórica de <strong>Dulces Melito</strong> mes a mes, el detalle de cada pedido y tus compras de bodega.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-3.5 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">📊 Histórico Total (Desde el inicio)</option>
              <option value="this_month">📅 Este Mes ({formatYearMonth(nowYearMonth)})</option>
              <option value="this_year">🗓️ Este Año ({nowYear})</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  Mes: {formatYearMonth(ym)}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Gasto / Compra Extra
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs">
          <label className="flex items-center gap-2 font-medium text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyDelivered}
              onChange={(e) => setOnlyDelivered(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            Contabilizar solo pedidos marcados como &quot;Entregados&quot; (por defecto incluye todos los agendados activos)
          </label>
        </div>
      </div>

      {/* 4 Tarjetas Principales del Historial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase">
              Ventas Totales ({filteredOrders.length} ped.)
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900 mt-1.5">
            {formatCLP(totals.totalSales)}
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-stone-100">
            <span className="text-emerald-700 font-semibold">
              Cobrado: {formatCLP(totals.totalCollected)}
            </span>
            <span className="text-amber-700 font-semibold">
              Falta: {formatCLP(totals.totalPending)}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase">
              Costo de Producción
            </span>
            <Receipt className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-2xl font-extrabold text-stone-800 mt-1.5">
            {formatCLP(totals.totalProductionCost)}
          </div>
          <div className="text-xs text-stone-400 mt-2 pt-2 border-t border-stone-100">
            Costo exacto de recetas + cajas vendidas
          </div>
        </div>

        <div className="bg-emerald-50/90 p-5 rounded-2xl shadow-sm border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase">
              Ganancia Neta de Pedidos
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-800 mt-1.5">
            {formatCLP(totals.totalNetProfit)}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-2 pt-2 border-t border-emerald-200/70">
            Margen promedio: {Math.round(totals.avgMargin)}% sobre ventas
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase">
              Compras de Bodega y Gastos
            </span>
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900 mt-1.5">
            {formatCLP(totals.totalExpenses)}
          </div>
          <div className="text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
            Valor actual guardado en Stock:{' '}
            <strong className="text-stone-800">
              {formatCLP(currentInventoryValue)}
            </strong>
          </div>
        </div>
      </div>

      {/* Selector de Sub-pestañas de Historial */}
      <div className="flex flex-wrap gap-2 bg-stone-100 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setSubTab('monthly')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            subTab === 'monthly'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          1. Resumen Mes a Mes y Ranking
        </button>
        <button
          onClick={() => setSubTab('orders_history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            subTab === 'orders_history'
              ? 'bg-white text-amber-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          2. Historial de Pedidos ({filteredOrders.length})
        </button>
        <button
          onClick={() => setSubTab('expenses_history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            subTab === 'expenses_history'
              ? 'bg-white text-purple-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          3. Historial de Compras y Gastos ({filteredExpenses.length})
        </button>
      </div>

      {/* SUB-PESTAÑA 1: RESUMEN MES A MES Y RANKING */}
      {subTab === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tabla Mensual */}
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                Evolución Mensual (Ventas, Costos y Ganancias)
              </h3>
            </div>

            {monthlyBreakdown.length === 0 ? (
              <div className="p-10 text-center text-sm text-stone-500">
                Aún no hay pedidos ni compras registradas. A medida que agendes pedidos, aquí verás el historial mes por mes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase">
                      <th className="py-3 px-4">Mes / Año</th>
                      <th className="py-3 px-4">Pedidos</th>
                      <th className="py-3 px-4">Ventas ($)</th>
                      <th className="py-3 px-4">Costo Prod. ($)</th>
                      <th className="py-3 px-4">Ganancia Neta ($)</th>
                      <th className="py-3 px-4">Compras Bodega ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {monthlyBreakdown.map((row) => {
                      const margin =
                        row.sales > 0
                          ? Math.round((row.netProfit / row.sales) * 100)
                          : 0;
                      return (
                        <tr key={row.yearMonth} className="hover:bg-stone-50">
                          <td className="py-3.5 px-4 font-bold text-stone-800">
                            {formatYearMonth(row.yearMonth)}
                          </td>
                          <td className="py-3.5 px-4 text-stone-600">
                            {row.ordersCount} ped.
                          </td>
                          <td className="py-3.5 px-4 font-bold text-stone-900">
                            {formatCLP(row.sales)}
                          </td>
                          <td className="py-3.5 px-4 text-stone-600">
                            {formatCLP(row.productionCost)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs">
                              {formatCLP(row.netProfit)} ({margin}%)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-purple-800 font-semibold">
                            {formatCLP(row.expenses)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ranking de Productos y Sabores más vendidos */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-3">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                <Award className="w-4 h-4 text-amber-600" />
                Sabores Más Vendidos
              </h3>
              {topProducts.topRecipes.length === 0 ? (
                <p className="text-xs text-stone-400">
                  Sin datos de sabores vendidos aún.
                </p>
              ) : (
                <div className="space-y-2">
                  {topProducts.topRecipes.slice(0, 8).map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-stone-50"
                    >
                      <div>
                        <span className="font-bold text-stone-800">
                          #{idx + 1} {rec.name}
                        </span>
                        <span className="text-stone-400 ml-1">
                          [{rec.line}]
                        </span>
                      </div>
                      <span className="font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        {formatNumberCL(rec.units)} unid.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-3">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                <Package className="w-4 h-4 text-emerald-600" />
                Cajas Con Más Ingresos
              </h3>
              {topProducts.topBoxes.length === 0 ? (
                <p className="text-xs text-stone-400">
                  Sin cajas vendidas en este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {topProducts.topBoxes.slice(0, 6).map((box, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-stone-50"
                    >
                      <div>
                        <span className="font-bold text-stone-800">
                          {box.name}
                        </span>
                        <span className="text-stone-400 block">
                          {box.units} cajas vendidas
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-800">
                        {formatCLP(box.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: HISTORIAL DETALLADO DE PEDIDOS */}
      {subTab === 'orders_history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-stone-800 text-base">
              Registro Histórico de Pedidos (Ventas vs. Costos vs. Ganancias)
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar cliente o fecha..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {searchedOrders.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              No hay pedidos registrados para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase">
                    <th className="py-3 px-4">Fecha Entrega</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Estado Pedido / Pago</th>
                    <th className="py-3 px-4">Costo Prod. ($)</th>
                    <th className="py-3 px-4">Total Venta ($)</th>
                    <th className="py-3 px-4 text-right">Ganancia Neta ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {searchedOrders.map((ord) => {
                    const m = calculateOrderMetrics(
                      ord,
                      state.boxes,
                      state.recipes,
                      state.supplies
                    );
                    return (
                      <tr key={ord.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-semibold text-stone-700">
                          {ord.deliveryDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-800">
                            {ord.customerName}
                          </div>
                          {ord.customerInstagram && (
                            <a
                              href={
                                ord.customerInstagram.startsWith('http')
                                  ? ord.customerInstagram
                                  : `https://instagram.com/${ord.customerInstagram
                                      .trim()
                                      .replace(/^@/, '')}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-pink-700 font-medium hover:underline inline-block"
                            >
                              {ord.customerInstagram.startsWith('@')
                                ? ord.customerInstagram
                                : `@${ord.customerInstagram.replace(
                                    /^https?:\/\/(www\.)?instagram\.com\//,
                                    ''
                                  )}`}
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                              {ord.orderStatus === 'delivered'
                                ? 'Entregado'
                                : ord.orderStatus === 'preparing'
                                ? 'En Preparación'
                                : ord.orderStatus === 'ready'
                                ? 'Listo'
                                : 'Agendado'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                ord.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.paymentStatus === 'partial'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {ord.paymentStatus === 'paid'
                                ? 'Pagado'
                                : ord.paymentStatus === 'partial'
                                ? `Abonó ${formatCLP(ord.depositAmount)}`
                                : 'Pendiente'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-stone-600 font-medium">
                          {formatCLP(m.totalProductionCost)}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900">
                          {formatCLP(m.totalSale)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                          {formatCLP(m.netProfit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-PESTAÑA 3: HISTORIAL DE COMPRAS DE BODEGA Y GASTOS EXTRAS */}
      {subTab === 'expenses_history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-600" />
                Historial de Compras de Insumos y Gastos Extras
              </h3>
              <p className="text-xs text-stone-500">
                Cada vez que usas el botón &quot;Compra&quot; en Bodega se anota aquí automáticamente, o puedes registrar gastos manuales.
              </p>
            </div>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Gasto
            </button>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              Aún no hay compras ni gastos registrados en este período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Descripción de Compra / Gasto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Monto Pagado ($)</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 font-medium text-stone-600">
                        {exp.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-800">
                        {exp.description}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            exp.category === 'ingredient_purchase'
                              ? 'bg-amber-100 text-amber-900'
                              : exp.category === 'packaging_purchase'
                              ? 'bg-stone-200 text-stone-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {exp.category === 'ingredient_purchase'
                            ? 'Compra Ingrediente'
                            : exp.category === 'packaging_purchase'
                            ? 'Compra Empaque'
                            : 'Gasto Extra / Operativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-stone-900">
                        {formatCLP(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: 'Eliminar Registro de Gasto',
                              message: `¿Estás segura de eliminar "${exp.description}" del historial?`,
                              confirmLabel: 'Sí, Eliminar',
                              variant: 'danger',
                            });
                            if (ok) {
                              deleteExpense(exp.id);
                              showToast(
                                'Gasto eliminado',
                                `"${exp.description}" se eliminó del historial.`,
                                'info'
                              );
                            }
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal para Registrar un Gasto o Compra Manual */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-bold text-stone-800 text-base">
                Registrar Gasto o Compra Extra
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Ej. Compra supermercado, Gas, Moldes, Envío proveedor..."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Categoría
                </label>
                <select
                  value={expCategory}
                  onChange={(e) =>
                    setExpCategory(
                      e.target.value as
                        | 'ingredient_purchase'
                        | 'packaging_purchase'
                        | 'extra_expense'
                    )
                  }
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm bg-white"
                >
                  <option value="extra_expense">Gasto Extra / Operativo (Gas, Luz, Utensilios)</option>
                  <option value="ingredient_purchase">Compra de Ingredientes</option>
                  <option value="packaging_purchase">Compra de Empaque / Cajas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Monto Pagado ($ CLP) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Ej. 15000"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
