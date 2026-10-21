'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  calculateOrderMetrics,
  calculateRecipeMetrics,
  formatCLP,
} from '@/lib/calculations';
import {
  BoxRecipeItem,
  CustomerOrder,
  DeliveryMethod,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from '@/types/bakery';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Flame,
  Instagram,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeOrderItemId() {
  return `oit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default function CalendarModule() {
  const {
    state,
    addOrder,
    updateOrder,
    deleteOrder,
    deductOrderStock,
  } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const todayStr = useMemo(() => toDateString(new Date()), []);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Modal de Crear / Editar Pedido
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);

  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [deliveryTime, setDeliveryTime] = useState('16:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerInstagram, setCustomerInstagram] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [depositAmount, setDepositAmount] = useState('0');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);

  const finalRecipes = useMemo(
    () =>
      state.recipes
        .filter((r) => !r.isSubRecipe)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [state.recipes]
  );

  // Construcción de la cuadrícula del mes (Lunes a Domingo)
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // 0 = Dom -> ajustamos para que Lun = 0, Dom = 6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({
        dateStr: toDateString(d),
        dayNumber: d.getDate(),
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        dateStr: toDateString(d),
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    // Rellenar hasta múltiplo de 7
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, nextDay++);
      cells.push({
        dateStr: toDateString(d),
        dayNumber: d.getDate(),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentMonthDate]);

  // Agrupar pedidos por fecha
  const ordersByDate = useMemo(() => {
    const map = new Map<string, CustomerOrder[]>();
    for (const ord of state.orders) {
      const arr = map.get(ord.deliveryDate) || [];
      arr.push(ord);
      map.set(ord.deliveryDate, arr);
    }
    return map;
  }, [state.orders]);

  const selectedDayOrders = useMemo(() => {
    const list = ordersByDate.get(selectedDateStr) || [];
    return [...list].sort((a, b) =>
      (a.deliveryTime || '23:59').localeCompare(b.deliveryTime || '23:59')
    );
  }, [ordersByDate, selectedDateStr]);

  const openNewOrderModal = (dateStr = selectedDateStr) => {
    setEditingOrder(null);
    setDeliveryDate(dateStr);
    setDeliveryTime('16:00');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerInstagram('');
    setDeliveryMethod('pickup');
    setDeliveryAddress('');
    setDeliveryFee('0');
    setPaymentStatus('pending');
    setDepositAmount('0');
    setOrderStatus('scheduled');
    setNotes('');

    if (state.boxes.length > 0) {
      const firstBox = state.boxes[0];
      setItems([
        {
          id: makeOrderItemId(),
          type: 'box',
          boxId: firstBox.id,
          quantity: 1,
          unitSalePrice: firstBox.salePrice,
          customSelections:
            firstBox.isCustomizable && finalRecipes[0]
              ? [{ recipeId: finalRecipes[0].id, quantity: firstBox.capacity }]
              : [],
        },
      ]);
    } else if (finalRecipes.length > 0) {
      const firstRec = finalRecipes[0];
      const recCost = calculateRecipeMetrics(
        firstRec,
        state.supplies,
        state.recipes
      ).costPerUnit;
      setItems([
        {
          id: makeOrderItemId(),
          type: 'single_recipe',
          recipeId: firstRec.id,
          quantity: 6,
          unitSalePrice: Math.ceil((recCost * 2.5) / 100) * 100 || 2500,
        },
      ]);
    } else {
      setItems([]);
    }

    setIsModalOpen(true);
  };

  const openEditOrderModal = (order: CustomerOrder) => {
    setEditingOrder(order);
    setDeliveryDate(order.deliveryDate);
    setDeliveryTime(order.deliveryTime || '16:00');
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone || '');
    setCustomerInstagram(order.customerInstagram || '');
    setDeliveryMethod(order.deliveryMethod);
    setDeliveryAddress(order.deliveryAddress || '');
    setDeliveryFee(String(order.deliveryFee || 0));
    setPaymentStatus(order.paymentStatus);
    setDepositAmount(String(order.depositAmount || 0));
    setOrderStatus(order.orderStatus);
    setNotes(order.notes || '');
    setItems(
      order.items.map((it) => ({
        ...it,
        customSelections: it.customSelections
          ? it.customSelections.map((cs) => ({ ...cs }))
          : undefined,
      }))
    );
    setIsModalOpen(true);
  };

  const handleAddOrderItem = (type: 'box' | 'single_recipe') => {
    if (type === 'box' && state.boxes[0]) {
      const b = state.boxes[0];
      setItems((prev) => [
        ...prev,
        {
          id: makeOrderItemId(),
          type: 'box',
          boxId: b.id,
          quantity: 1,
          unitSalePrice: b.salePrice,
          customSelections:
            b.isCustomizable && finalRecipes[0]
              ? [{ recipeId: finalRecipes[0].id, quantity: b.capacity }]
              : [],
        },
      ]);
    } else if (type === 'single_recipe' && finalRecipes[0]) {
      const r = finalRecipes[0];
      const recCost = calculateRecipeMetrics(
        r,
        state.supplies,
        state.recipes
      ).costPerUnit;
      setItems((prev) => [
        ...prev,
        {
          id: makeOrderItemId(),
          type: 'single_recipe',
          recipeId: r.id,
          quantity: 1,
          unitSalePrice: Math.ceil((recCost * 2.5) / 100) * 100 || 2500,
        },
      ]);
    }
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    const payload = {
      deliveryDate,
      deliveryTime: deliveryTime || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerInstagram: customerInstagram.trim() || undefined,
      deliveryMethod,
      deliveryAddress:
        deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
      deliveryFee:
        deliveryMethod === 'delivery'
          ? Math.max(0, Math.round(parseFloat(deliveryFee) || 0))
          : 0,
      paymentStatus,
      depositAmount:
        paymentStatus === 'partial'
          ? Math.max(0, Math.round(parseFloat(depositAmount) || 0))
          : 0,
      orderStatus,
      stockDeducted: editingOrder ? editingOrder.stockDeducted : false,
      items,
      notes: notes.trim() || undefined,
    };

    setSelectedDateStr(deliveryDate);
    setIsModalOpen(false);

    if (editingOrder) {
      updateOrder(editingOrder.id, payload);
      showToast(
        'Pedido actualizado',
        `El pedido de ${payload.customerName} fue actualizado.`
      );
      if (orderStatus === 'preparing' && !editingOrder.stockDeducted) {
        const ok = await confirmAction({
          title: 'Descontar Stock de Bodega',
          message: `Pasaste el pedido de ${payload.customerName} a "En Preparación / Horneado". ¿Quieres descontar automáticamente sus ingredientes y cajas del Stock de Bodega?`,
          confirmLabel: 'Sí, Descontar Stock',
          variant: 'warning',
        });
        if (ok) {
          deductOrderStock(editingOrder.id);
          showToast(
            'Stock descontado',
            `Se descontaron los ingredientes y empaques del pedido de ${payload.customerName}.`
          );
        }
      }
    } else {
      const created = addOrder(payload);
      showToast(
        'Pedido agendado',
        `Se agendó el pedido de ${payload.customerName} para el ${deliveryDate}.`
      );
      if (orderStatus === 'preparing') {
        const ok = await confirmAction({
          title: 'Descontar Stock de Bodega',
          message: `El pedido de ${payload.customerName} está "En Preparación / Horneado". ¿Quieres descontar automáticamente sus ingredientes y cajas del Stock de Bodega?`,
          confirmLabel: 'Sí, Descontar Stock',
          variant: 'warning',
        });
        if (ok) {
          deductOrderStock(created.id);
          showToast(
            'Stock descontado',
            `Se descontaron los ingredientes y empaques del pedido de ${payload.customerName}.`
          );
        }
      }
    }
  };

  const handleQuickStatusChange = async (
    order: CustomerOrder,
    newStatus: OrderStatus
  ) => {
    updateOrder(order.id, { orderStatus: newStatus });
    showToast(
      'Estado de pedido actualizado',
      `El pedido de ${order.customerName} pasó a estado "${
        newStatus === 'delivered'
          ? 'Entregado'
          : newStatus === 'preparing'
          ? 'En Preparación'
          : newStatus === 'ready'
          ? 'Listo para Entregar'
          : newStatus === 'cancelled'
          ? 'Cancelado'
          : 'Agendado'
      }".`
    );
    if (newStatus === 'preparing' && !order.stockDeducted) {
      const ok = await confirmAction({
        title: 'Descontar Stock de Bodega',
        message: `¿Descontar ahora del Stock de Bodega los ingredientes y empaques del pedido de ${order.customerName}?`,
        confirmLabel: 'Sí, Descontar Stock',
        variant: 'warning',
      });
      if (ok) {
        deductOrderStock(order.id);
        showToast(
          'Stock descontado',
          `Se descontaron los insumos del pedido de ${order.customerName}.`
        );
      }
    }
  };

  // Vista previa financiera dentro del modal
  const previewOrder: CustomerOrder = {
    id: editingOrder?.id || 'preview',
    deliveryDate,
    customerName,
    deliveryMethod,
    deliveryFee:
      deliveryMethod === 'delivery' ? Math.max(0, parseFloat(deliveryFee) || 0) : 0,
    paymentStatus,
    depositAmount:
      paymentStatus === 'partial'
        ? Math.max(0, parseFloat(depositAmount) || 0)
        : 0,
    orderStatus,
    stockDeducted: false,
    items,
    createdAt: '',
  };
  const previewOrderMetrics = calculateOrderMetrics(
    previewOrder,
    state.boxes,
    state.recipes,
    state.supplies
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-600" />
            Calendario de Pedidos y Clientes
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Selecciona cualquier día para ver o agendar pedidos, registrar abonos, armar cajas a elección y controlar entregas.
          </p>
        </div>

        <button
          onClick={() => openNewOrderModal(selectedDateStr)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Agendar Nuevo Pedido
        </button>
      </div>

      {/* Layout Principal: Calendario Mensual (Izquierda) + Agenda del Día Seleccionado (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendario Mensual */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">
                {MONTH_NAMES[currentMonthDate.getMonth()]}{' '}
                {currentMonthDate.getFullYear()}
              </h3>
              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentMonthDate(
                    new Date(now.getFullYear(), now.getMonth(), 1)
                  );
                  setSelectedDateStr(toDateString(now));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 transition"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCurrentMonthDate(
                    new Date(
                      currentMonthDate.getFullYear(),
                      currentMonthDate.getMonth() - 1,
                      1
                    )
                  )
                }
                className="p-2 rounded-xl hover:bg-stone-200 text-stone-600 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setCurrentMonthDate(
                    new Date(
                      currentMonthDate.getFullYear(),
                      currentMonthDate.getMonth() + 1,
                      1
                    )
                  )
                }
                className="p-2 rounded-xl hover:bg-stone-200 text-stone-600 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/60 text-center text-xs font-bold text-stone-500 uppercase py-2">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
            {calendarDays.map((cell) => {
              const dayOrders = (ordersByDate.get(cell.dateStr) || []).filter(
                (o) => o.orderStatus !== 'cancelled'
              );
              const isSelected = cell.dateStr === selectedDateStr;
              const isToday = cell.dateStr === todayStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[88px] sm:min-h-[104px] p-2 text-left flex flex-col justify-between transition relative ${
                    !cell.isCurrentMonth
                      ? 'bg-stone-50/50 text-stone-400'
                      : 'bg-white text-stone-800 hover:bg-amber-50/40'
                  } ${
                    isSelected
                      ? 'ring-2 ring-inset ring-amber-600 bg-amber-50/50'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        isToday
                          ? 'bg-amber-600 text-white'
                          : isSelected
                          ? 'text-amber-900 font-extrabold'
                          : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {dayOrders.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        {dayOrders.length} ped.
                      </span>
                    )}
                  </div>

                  {/* Vista previa de clientes del día */}
                  <div className="space-y-1 mt-1 w-full overflow-hidden">
                    {dayOrders.slice(0, 2).map((ord) => (
                      <div
                        key={ord.id}
                        className={`truncate text-[11px] px-1.5 py-0.5 rounded font-medium ${
                          ord.orderStatus === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.orderStatus === 'preparing'
                            ? 'bg-amber-200/80 text-amber-950'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {ord.deliveryTime ? `${ord.deliveryTime} ` : ''}
                        {ord.customerName}
                      </div>
                    ))}
                    {dayOrders.length > 2 && (
                      <div className="text-[10px] text-stone-500 font-semibold pl-1">
                        +{dayOrders.length - 2} más...
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Derecho: Detalle de Pedidos del Día Seleccionado */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <span className="text-xs font-bold text-amber-700 uppercase">
                Agenda del Día Seleccionado
              </span>
              <h3 className="text-lg font-bold text-stone-900">
                {selectedDateStr}
              </h3>
            </div>

            <button
              onClick={() => openNewOrderModal(selectedDateStr)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Pedido
            </button>
          </div>

          {selectedDayOrders.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarIcon className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">
                No hay pedidos agendados para el {selectedDateStr}
              </p>
              <p className="text-xs text-stone-400 mt-1 mb-4">
                Haz clic en &quot;Agregar Pedido&quot; para anotar un cliente en esta fecha.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDayOrders.map((order) => {
                const metrics = calculateOrderMetrics(
                  order,
                  state.boxes,
                  state.recipes,
                  state.supplies
                );

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-3 hover:border-amber-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {order.deliveryTime && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-800 text-white text-xs font-bold">
                              <Clock className="w-3 h-3" />
                              {order.deliveryTime}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              order.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.paymentStatus === 'partial'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {order.paymentStatus === 'paid'
                              ? 'Pagado'
                              : order.paymentStatus === 'partial'
                              ? `Abonó ${formatCLP(order.depositAmount)} (Falta ${formatCLP(
                                  metrics.remainingBalance
                                )})`
                              : 'Pago Pendiente'}
                          </span>
                        </div>

                        <h4 className="font-bold text-stone-900 text-base flex items-center gap-1.5">
                          <User className="w-4 h-4 text-amber-600" />
                          {order.customerName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
                          {order.customerPhone && (
                            <a
                              href={`https://wa.me/${order.customerPhone.replace(
                                /[^0-9]/g,
                                ''
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 font-medium hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {order.customerPhone}
                            </a>
                          )}
                          {order.customerInstagram && (
                            <a
                              href={
                                order.customerInstagram.startsWith('http')
                                  ? order.customerInstagram
                                  : `https://instagram.com/${order.customerInstagram
                                      .trim()
                                      .replace(/^@/, '')}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-pink-700 font-medium hover:underline"
                            >
                              <Instagram className="w-3 h-3" />
                              {order.customerInstagram.startsWith('@')
                                ? order.customerInstagram
                                : `@${order.customerInstagram.replace(
                                    /^https?:\/\/(www\.)?instagram\.com\//,
                                    ''
                                  )}`}
                            </a>
                          )}
                          <span className="inline-flex items-center gap-1 text-stone-600">
                            {order.deliveryMethod === 'delivery' ? (
                              <>
                                <Truck className="w-3 h-3" />
                                Delivery {order.deliveryAddress ? `(${order.deliveryAddress})` : ''}
                              </>
                            ) : (
                              <>
                                <MapPin className="w-3 h-3" />
                                Retiro
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditOrderModal(order)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: 'Eliminar Pedido del Calendario',
                              message: `¿Estás segura de eliminar el pedido de ${order.customerName}?`,
                              confirmLabel: 'Sí, Eliminar',
                              variant: 'danger',
                            });
                            if (ok) {
                              deleteOrder(order.id);
                              showToast(
                                'Pedido eliminado',
                                `El pedido de ${order.customerName} fue eliminado.`,
                                'info'
                              );
                            }
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Detalle de lo que pidió */}
                    <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1.5 text-xs">
                      {order.items.map((item) => {
                        if (item.type === 'box' && item.boxId) {
                          const box = state.boxes.find(
                            (b) => b.id === item.boxId
                          );
                          return (
                            <div key={item.id} className="space-y-1">
                              <div className="flex justify-between font-bold text-stone-800">
                                <span>
                                  {item.quantity}x {box ? box.name : 'Caja'}
                                </span>
                                <span>
                                  {formatCLP(item.unitSalePrice * item.quantity)}
                                </span>
                              </div>
                              {box?.isCustomizable &&
                                item.customSelections &&
                                item.customSelections.length > 0 && (
                                  <div className="pl-3 text-stone-500 flex flex-wrap gap-1">
                                    {item.customSelections.map((sel, i) => {
                                      const rec = state.recipes.find(
                                        (r) => r.id === sel.recipeId
                                      );
                                      return (
                                        <span
                                          key={i}
                                          className="px-1.5 py-0.5 bg-purple-50 text-purple-900 rounded text-[11px]"
                                        >
                                          {sel.quantity}x {rec?.name || 'Sabor'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          );
                        } else {
                          const rec = state.recipes.find(
                            (r) => r.id === item.recipeId
                          );
                          return (
                            <div
                              key={item.id}
                              className="flex justify-between font-bold text-stone-800"
                            >
                              <span>
                                {item.quantity}x {rec ? rec.name : 'Receta'}
                              </span>
                              <span>
                                {formatCLP(item.unitSalePrice * item.quantity)}
                              </span>
                            </div>
                          );
                        }
                      })}
                      {order.notes && (
                        <div className="pt-1.5 border-t border-stone-100 text-stone-500 italic">
                          Nota: {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Estado del pedido + Botón Descontar Stock */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <select
                        value={order.orderStatus}
                        onChange={(e) =>
                          handleQuickStatusChange(
                            order,
                            e.target.value as OrderStatus
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="scheduled">📅 Agendado</option>
                        <option value="preparing">🔥 En Preparación / Horneado</option>
                        <option value="ready">✨ Listo para Entregar</option>
                        <option value="delivered">✅ Entregado</option>
                        <option value="cancelled">❌ Cancelado</option>
                      </select>

                      {!order.stockDeducted ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: 'Descontar Stock de Bodega',
                              message: `¿Descontar del Stock de Bodega los ingredientes y cajas del pedido de ${order.customerName}?`,
                              confirmLabel: 'Sí, Descontar Stock',
                              variant: 'warning',
                            });
                            if (ok) {
                              deductOrderStock(order.id);
                              showToast(
                                'Stock descontado',
                                `Se descontaron los insumos del pedido de ${order.customerName}.`
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold transition"
                        >
                          <Flame className="w-3 h-3 text-amber-400" />
                          Descontar Stock
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                          <Check className="w-3 h-3" />
                          Stock Descontado
                        </span>
                      )}
                    </div>

                    {/* Resumen Financiero del Pedido */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/70 text-xs">
                      <span className="text-stone-500">
                        Costo: <strong>{formatCLP(metrics.totalProductionCost)}</strong>
                      </span>
                      <span className="text-stone-800">
                        Cobrado: <strong>{formatCLP(metrics.totalSale)}</strong>
                      </span>
                      <span className="text-emerald-700 font-bold">
                        Ganancia: {formatCLP(metrics.netProfit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Agendar / Editar Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-3xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-bold text-stone-800 text-lg">
                {editingOrder
                  ? `Editar Pedido de ${editingOrder.customerName}`
                  : 'Agendar Nuevo Pedido'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveOrder}
              className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
            >
              {/* Datos del Cliente y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Camila Rojas"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej. +569 1234 5678"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Usuario Instagram
                  </label>
                  <input
                    type="text"
                    value={customerInstagram}
                    onChange={(e) => setCustomerInstagram(e.target.value)}
                    placeholder="Ej. @camilarojas"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Fecha de Entrega *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Hora de Entrega
                  </label>
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Modalidad de Entrega
                  </label>
                  <select
                    value={deliveryMethod}
                    onChange={(e) =>
                      setDeliveryMethod(e.target.value as DeliveryMethod)
                    }
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="pickup">Retiro en Local / Casa</option>
                    <option value="delivery">Delivery / Envío</option>
                  </select>
                </div>
              </div>

              {deliveryMethod === 'delivery' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                      Dirección de Envío
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Calle, número, depto, comuna..."
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                      Costo de Envío ($ CLP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Productos / Cajas del Pedido */}
              <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    Productos del Pedido
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={state.boxes.length === 0}
                      onClick={() => handleAddOrderItem('box')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 disabled:bg-stone-300 text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Caja / Pack
                    </button>
                    <button
                      type="button"
                      disabled={finalRecipes.length === 0}
                      onClick={() => handleAddOrderItem('single_recipe')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 disabled:bg-stone-300 text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Unidad Suelta
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-amber-900">
                    Agrega una caja (de la pestaña Cajas) o una receta (de la pestaña Recetario) al pedido.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, idx) => {
                      const selectedBox =
                        item.type === 'box'
                          ? state.boxes.find((b) => b.id === item.boxId)
                          : null;

                      const totalSelectedCustomUnits =
                        item.customSelections?.reduce(
                          (acc, s) => acc + s.quantity,
                          0
                        ) || 0;

                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-white border border-amber-200 space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <div className="sm:col-span-6">
                              {item.type === 'box' ? (
                                <select
                                  value={item.boxId}
                                  onChange={(e) => {
                                    const newBox = state.boxes.find(
                                      (b) => b.id === e.target.value
                                    );
                                    if (!newBox) return;
                                    setItems((prev) =>
                                      prev.map((it, i) =>
                                        i === idx
                                          ? {
                                              ...it,
                                              boxId: newBox.id,
                                              unitSalePrice: newBox.salePrice,
                                              customSelections:
                                                newBox.isCustomizable &&
                                                finalRecipes[0]
                                                  ? [
                                                      {
                                                        recipeId:
                                                          finalRecipes[0].id,
                                                        quantity:
                                                          newBox.capacity,
                                                      },
                                                    ]
                                                  : [],
                                            }
                                          : it
                                      )
                                    );
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-800"
                                >
                                  {state.boxes.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      [Caja] {b.name} ({formatCLP(b.salePrice)})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={item.recipeId}
                                  onChange={(e) => {
                                    const newRec = finalRecipes.find(
                                      (r) => r.id === e.target.value
                                    );
                                    if (!newRec) return;
                                    setItems((prev) =>
                                      prev.map((it, i) =>
                                        i === idx
                                          ? { ...it, recipeId: newRec.id }
                                          : it
                                      )
                                    );
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-800"
                                >
                                  {finalRecipes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      [Unidad] {r.name} [{r.line}]
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <div className="sm:col-span-2 flex items-center gap-1">
                              <span className="text-xs text-stone-500">Cant:</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const q = Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1
                                  );
                                  setItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, quantity: q } : it
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-center text-xs font-bold"
                              />
                            </div>

                            <div className="sm:col-span-3 flex items-center gap-1">
                              <span className="text-xs text-stone-500">$ c/u:</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={item.unitSalePrice}
                                onChange={(e) => {
                                  const p = Math.max(
                                    0,
                                    parseFloat(e.target.value) || 0
                                  );
                                  setItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? { ...it, unitSalePrice: p }
                                        : it
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-xs font-bold"
                              />
                            </div>

                            <div className="sm:col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setItems((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="p-1.5 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Si es una Caja Armable, selector de sabores de esta caja */}
                          {selectedBox && selectedBox.isCustomizable && (
                            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-purple-950 flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                                  Sabores elegidos por el cliente en esta caja:
                                </span>
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-full ${
                                    totalSelectedCustomUnits ===
                                    selectedBox.capacity
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {totalSelectedCustomUnits} /{' '}
                                  {selectedBox.capacity} unid.
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {(item.customSelections || []).map(
                                  (sel, selIdx) => (
                                    <div
                                      key={selIdx}
                                      className="flex items-center gap-2"
                                    >
                                      <select
                                        value={sel.recipeId}
                                        onChange={(e) => {
                                          const newRecId = e.target.value;
                                          setItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i !== idx) return it;
                                              const nextSel = [
                                                ...(it.customSelections || []),
                                              ];
                                              nextSel[selIdx] = {
                                                ...nextSel[selIdx],
                                                recipeId: newRecId,
                                              };
                                              return {
                                                ...it,
                                                customSelections: nextSel,
                                              };
                                            })
                                          );
                                        }}
                                        className="flex-1 px-2 py-1 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                                      >
                                        {finalRecipes.map((r) => (
                                          <option key={r.id} value={r.id}>
                                            {r.name} [{r.line}]
                                          </option>
                                        ))}
                                      </select>

                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={sel.quantity}
                                        onChange={(e) => {
                                          const q = Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                          );
                                          setItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i !== idx) return it;
                                              const nextSel = [
                                                ...(it.customSelections || []),
                                              ];
                                              nextSel[selIdx] = {
                                                ...nextSel[selIdx],
                                                quantity: q,
                                              };
                                              return {
                                                ...it,
                                                customSelections: nextSel,
                                              };
                                            })
                                          );
                                        }}
                                        className="w-16 px-2 py-1 bg-white border border-purple-200 rounded-lg text-center text-xs font-bold"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i !== idx) return it;
                                              return {
                                                ...it,
                                                customSelections: (
                                                  it.customSelections || []
                                                ).filter(
                                                  (_, si) => si !== selIdx
                                                ),
                                              };
                                            })
                                          );
                                        }}
                                        className="p-1 text-purple-400 hover:text-red-600"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                )}

                                {finalRecipes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setItems((prev) =>
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const nextSel: BoxRecipeItem[] = [
                                            ...(it.customSelections || []),
                                            {
                                              recipeId: finalRecipes[0].id,
                                              quantity: 1,
                                            },
                                          ];
                                          return {
                                            ...it,
                                            customSelections: nextSel,
                                          };
                                        })
                                      );
                                    }}
                                    className="text-xs font-semibold text-purple-800 hover:underline inline-flex items-center gap-1"
                                  >
                                    + Agregar otro sabor a la caja
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Estado de Pago, Estado de Preparación y Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Estado del Pago
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(e.target.value as PaymentStatus)
                    }
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm bg-white font-semibold"
                  >
                    <option value="pending">Pendiente de Pago</option>
                    <option value="partial">Abonado / Seña</option>
                    <option value="paid">Pagado Total</option>
                  </select>
                </div>

                {paymentStatus === 'partial' && (
                  <div>
                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                      Monto Abonado ($ CLP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full px-3.5 py-2 border border-blue-300 bg-blue-50/40 rounded-xl text-sm font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Estado del Pedido
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) =>
                      setOrderStatus(e.target.value as OrderStatus)
                    }
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm bg-white font-semibold"
                  >
                    <option value="scheduled">Agendado</option>
                    <option value="preparing">En Preparación / Horneado</option>
                    <option value="ready">Listo para Entrega</option>
                    <option value="delivered">Entregado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Notas / Dedicatoria / Alergias (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Sin trazas de maní, tarjeta de feliz cumpleaños..."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm"
                />
              </div>

              {/* Resumen Financiero del Pedido */}
              <div className="p-4 rounded-xl bg-stone-900 text-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[11px] text-stone-400 uppercase block">
                    Costo Producción
                  </span>
                  <span className="text-base font-bold">
                    {formatCLP(previewOrderMetrics.totalProductionCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 uppercase block">
                    Total a Cobrar
                  </span>
                  <span className="text-base font-extrabold text-amber-400">
                    {formatCLP(previewOrderMetrics.totalSale)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 uppercase block">
                    Ganancia Neta
                  </span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatCLP(previewOrderMetrics.netProfit)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 uppercase block">
                    Saldo Pendiente
                  </span>
                  <span className="text-base font-bold text-white">
                    {formatCLP(previewOrderMetrics.remainingBalance)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {editingOrder ? 'Guardar Cambios' : 'Agendar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
