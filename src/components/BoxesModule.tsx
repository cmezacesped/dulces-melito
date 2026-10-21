'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  calculateBoxMetrics,
  calculateRecipeMetrics,
  formatCLP,
  getSupplyUnitCost,
} from '@/lib/calculations';
import {
  BoxPackagingItem,
  BoxRecipeItem,
  ProductBox,
} from '@/types/bakery';
import {
  Box,
  Check,
  Edit2,
  Gift,
  Package,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

export default function BoxesModule() {
  const { state, addBox, updateBox, deleteBox } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<ProductBox | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [capacity, setCapacity] = useState('6');
  const [fixedItems, setFixedItems] = useState<BoxRecipeItem[]>([]);
  const [packagingItems, setPackagingItems] = useState<BoxPackagingItem[]>([]);
  const [salePrice, setSalePrice] = useState('');

  const finalRecipes = useMemo(
    () =>
      state.recipes
        .filter((r) => !r.isSubRecipe)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [state.recipes]
  );

  const packagingSupplies = useMemo(
    () =>
      state.supplies
        .filter((s) => s.type === 'packaging')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [state.supplies]
  );

  const openNewBoxModal = (customizable = false) => {
    setEditingBox(null);
    setName('');
    setDescription('');
    setIsCustomizable(customizable);
    setCapacity('6');
    setFixedItems(
      !customizable && finalRecipes[0]
        ? [{ recipeId: finalRecipes[0].id, quantity: 6 }]
        : []
    );
    setPackagingItems(
      packagingSupplies[0]
        ? [{ supplyId: packagingSupplies[0].id, quantity: 1 }]
        : []
    );
    setSalePrice('');
    setIsModalOpen(true);
  };

  const openEditBoxModal = (box: ProductBox) => {
    setEditingBox(box);
    setName(box.name);
    setDescription(box.description || '');
    setIsCustomizable(box.isCustomizable);
    setCapacity(String(box.capacity || 6));
    setFixedItems(box.fixedItems.map((i) => ({ ...i })));
    setPackagingItems(box.packagingItems.map((p) => ({ ...p })));
    setSalePrice(String(box.salePrice || ''));
    setIsModalOpen(true);
  };

  const handleSaveBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanFixed = isCustomizable
      ? []
      : fixedItems.filter((i) => i.recipeId && i.quantity > 0);
    const cleanPackaging = packagingItems.filter(
      (p) => p.supplyId && p.quantity > 0
    );

    const totalFixedUnits = cleanFixed.reduce((acc, i) => acc + i.quantity, 0);
    const capNumber = isCustomizable
      ? Math.max(1, parseInt(capacity, 10) || 1)
      : Math.max(1, totalFixedUnits);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      isCustomizable,
      capacity: capNumber,
      fixedItems: cleanFixed,
      packagingItems: cleanPackaging,
      salePrice: Math.max(0, Math.round(parseFloat(salePrice) || 0)),
    };

    if (editingBox) {
      updateBox(editingBox.id, payload);
      showToast(
        'Caja actualizada',
        `"${payload.name}" se actualizó correctamente.`
      );
    } else {
      addBox(payload);
      showToast(
        'Caja agregada al catálogo',
        `"${payload.name}" ya está disponible para tus pedidos.`
      );
    }

    setIsModalOpen(false);
  };

  // Cálculo en tiempo real dentro del modal
  const previewBox: ProductBox = {
    id: editingBox?.id || 'preview',
    name: name || 'Caja',
    isCustomizable,
    capacity: Math.max(1, parseInt(capacity, 10) || 1),
    fixedItems,
    packagingItems,
    salePrice: Math.max(0, parseFloat(salePrice) || 0),
    updatedAt: '',
  };
  const previewMetrics = calculateBoxMetrics(
    previewBox,
    state.supplies,
    state.recipes
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-600" />
            Armador de Cajas y Packs de Venta
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Arma tus cajas combinando galletas/recetas + insumos de empaque (cajas, stickers, papel) y calcula tu ganancia neta en <span className="font-semibold text-stone-700">$ CLP</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openNewBoxModal(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Nueva Caja de Sabores Fijos
          </button>
          <button
            onClick={() => openNewBoxModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-medium text-sm shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Nueva Caja Armable (A elección)
          </button>
        </div>
      </div>

      {/* Listado de Cajas */}
      {state.boxes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-800">
            Aún no has armado cajas o packs de venta
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-6">
            Puedes crear cajas con sabores fijos (ej. &quot;Caja Clásica x6&quot;) o cajas armables donde eliges qué sabores pidió el cliente al agendar su pedido en el calendario.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => openNewBoxModal(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Crear Caja Fija
            </button>
            <button
              onClick={() => openNewBoxModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-sm transition"
            >
              <Sparkles className="w-4 h-4" />
              Crear Caja Armable
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {state.boxes.map((box) => {
            const metrics = calculateBoxMetrics(
              box,
              state.supplies,
              state.recipes
            );

            return (
              <div
                key={box.id}
                className="bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between overflow-hidden hover:border-amber-300 transition"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          box.isCustomizable
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {box.isCustomizable
                          ? `Caja Armable (${box.capacity} unid.)`
                          : 'Sabores Fijos'}
                      </span>
                      <h3 className="text-lg font-bold text-stone-900 mt-1.5">
                        {box.name}
                      </h3>
                      {box.description && (
                        <p className="text-xs text-stone-500 mt-0.5">
                          {box.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditBoxModal(box)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: 'Eliminar Caja del Catálogo',
                            message: `¿Estás segura de eliminar "${box.name}"?`,
                            confirmLabel: 'Sí, Eliminar',
                            variant: 'danger',
                          });
                          if (ok) {
                            deleteBox(box.id);
                            showToast(
                              'Caja eliminada',
                              `"${box.name}" fue eliminada del catálogo.`,
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

                  {/* Contenido de Recetas */}
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-stone-500 uppercase tracking-wider">
                      Contenido de Pastelería:
                    </div>
                    {box.isCustomizable ? (
                      <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-purple-900">
                        El cliente elige <strong>{box.capacity} unidades</strong> al tomar el pedido en el calendario.
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {box.fixedItems.map((item, idx) => {
                          const rec = state.recipes.find(
                            (r) => r.id === item.recipeId
                          );
                          return (
                            <li
                              key={idx}
                              className="flex items-center justify-between text-stone-700 bg-stone-50 px-2.5 py-1.5 rounded-lg"
                            >
                              <span className="font-medium">
                                {item.quantity}x {rec ? rec.name : 'Receta eliminada'}
                              </span>
                              <span className="text-stone-400 text-[11px]">
                                {rec ? `[${rec.line}]` : ''}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Contenido de Empaque */}
                  {box.packagingItems.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-stone-500 uppercase tracking-wider">
                        Empaque Incluido ({formatCLP(metrics.packagingCost)}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {box.packagingItems.map((pkg, idx) => {
                          const sup = state.supplies.find(
                            (s) => s.id === pkg.supplyId
                          );
                          return (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-md bg-stone-100 text-stone-700 font-medium"
                            >
                              {pkg.quantity}x {sup ? sup.name : 'Empaque'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pie Financiero de la Caja */}
                <div className="bg-stone-50 border-t border-stone-200 p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-500 uppercase block">
                      Costo {metrics.isEstimated ? '(Prom.)' : 'Total'}
                    </span>
                    <span className="text-sm font-bold text-stone-800">
                      {formatCLP(metrics.totalCost)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-stone-500 uppercase block">
                      Precio Venta
                    </span>
                    <span className="text-sm font-extrabold text-amber-800">
                      {formatCLP(metrics.salePrice)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase block">
                      Ganancia ({Math.round(metrics.marginPercent)}%)
                    </span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatCLP(metrics.profit)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Caja */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-bold text-stone-800 text-lg">
                {editingBox ? `Editar: ${editingBox.name}` : 'Armar Nueva Caja / Pack'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBox} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Selector Fija vs Armable */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsCustomizable(false)}
                  className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    !isCustomizable
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  Sabores Fijos Predefinidos
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizable(true)}
                  className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    isCustomizable
                      ? 'bg-white text-purple-900 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Caja Armable (Cliente elige sabores)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Nombre de la Caja / Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Caja de 6 Cookies Surtidas, Caja Clásica x4..."
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {isCustomizable && (
                  <div>
                    <label className="block text-xs font-bold text-purple-900 uppercase mb-1">
                      Capacidad (Unidades) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-purple-300 bg-purple-50/40 rounded-xl text-sm font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* Sección 1: Recetas que lleva la caja (si es fija) */}
              {!isCustomizable ? (
                <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase">
                      1. Recetas que incluye esta caja
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!finalRecipes[0]) return;
                        setFixedItems((prev) => [
                          ...prev,
                          { recipeId: finalRecipes[0].id, quantity: 1 },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Sabor
                    </button>
                  </div>

                  {finalRecipes.length === 0 ? (
                    <p className="text-xs text-amber-800">
                      Primero crea al menos una Receta Final en la pestaña Recetario.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {fixedItems.map((item, idx) => {
                        const rec = finalRecipes.find(
                          (r) => r.id === item.recipeId
                        );
                        const recCost = rec
                          ? calculateRecipeMetrics(
                              rec,
                              state.supplies,
                              state.recipes
                            ).costPerUnit
                          : 0;

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-white p-2 rounded-xl border border-amber-200"
                          >
                            <select
                              value={item.recipeId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFixedItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, recipeId: val } : it
                                  )
                                );
                              }}
                              className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-stone-800 bg-transparent focus:outline-none"
                            >
                              {finalRecipes.map((r) => {
                                const m = calculateRecipeMetrics(
                                  r,
                                  state.supplies,
                                  state.recipes
                                );
                                return (
                                  <option key={r.id} value={r.id}>
                                    {r.name} [{r.line}] ({formatCLP(m.costPerUnit)}/u)
                                  </option>
                                );
                              })}
                            </select>

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
                                setFixedItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, quantity: q } : it
                                  )
                                );
                              }}
                              className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center text-xs font-bold"
                            />
                            <span className="text-xs text-stone-500">unid.</span>
                            <span className="text-xs font-bold text-stone-800 w-20 text-right">
                              {formatCLP(recCost * item.quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFixedItems((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1 text-stone-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900">
                  <strong>Modo Caja Armable:</strong> Al agendar un pedido en el Calendario, podrás elegir qué <strong>{capacity} sabores</strong> quiere el cliente dentro de esta caja y se calculará el costo exacto de ese pedido.
                </div>
              )}

              {/* Sección 2: Empaque / Packaging */}
              <div className="space-y-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase">
                    2. Empaque / Packaging (Caja, Sticker, Papel, Cinta)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!packagingSupplies[0]) return;
                      setPackagingItems((prev) => [
                        ...prev,
                        { supplyId: packagingSupplies[0].id, quantity: 1 },
                      ]);
                    }}
                    disabled={packagingSupplies.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 disabled:bg-stone-300 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Empaque
                  </button>
                </div>

                {packagingSupplies.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    Si quieres incluir el costo de la caja o stickers, agrégalos primero en la pestaña Bodega como &quot;Empaque / Caja&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {packagingItems.map((pkg, idx) => {
                      const sup = packagingSupplies.find(
                        (s) => s.id === pkg.supplyId
                      );
                      const uCost = sup ? getSupplyUnitCost(sup) : 0;

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white p-2 rounded-xl border border-stone-200"
                        >
                          <select
                            value={pkg.supplyId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPackagingItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, supplyId: val } : it
                                )
                              );
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-stone-800 bg-transparent focus:outline-none"
                          >
                            {packagingSupplies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({formatCLP(getSupplyUnitCost(s))}/{s.unit})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={pkg.quantity}
                            onChange={(e) => {
                              const q = Math.max(
                                0.1,
                                parseFloat(e.target.value) || 1
                              );
                              setPackagingItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, quantity: q } : it
                                )
                              );
                            }}
                            className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center text-xs font-bold"
                          />
                          <span className="text-xs font-bold text-stone-800 w-20 text-right">
                            {formatCLP(uCost * pkg.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPackagingItems((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1 text-stone-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sección 3: Precio de Venta y Rentabilidad */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 uppercase">
                      3. Precio de Venta al Cliente ($ CLP) *
                    </label>
                    <p className="text-xs text-emerald-800">
                      Costo total calculado: <strong>{formatCLP(previewMetrics.totalCost)}</strong> (Recetas: {formatCLP(previewMetrics.recipesCost)} + Empaque: {formatCLP(previewMetrics.packagingCost)})
                    </p>
                  </div>

                  {/* Botones de sugerencia rápida de precio */}
                  {previewMetrics.totalCost > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-emerald-800 font-medium">
                        Sugerir:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSalePrice(
                            String(
                              Math.ceil((previewMetrics.totalCost * 2.5) / 100) *
                                100
                            )
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
                      >
                        x2.5 ({formatCLP(Math.ceil((previewMetrics.totalCost * 2.5) / 100) * 100)})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSalePrice(
                            String(
                              Math.ceil((previewMetrics.totalCost * 3) / 100) *
                                100
                            )
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
                      >
                        x3 ({formatCLP(Math.ceil((previewMetrics.totalCost * 3) / 100) * 100)})
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                  <div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="Ej. 15000"
                      className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-base font-extrabold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[11px] text-stone-500 uppercase block">
                      Ganancia Limpia
                    </span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {formatCLP(previewMetrics.profit)}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[11px] text-stone-500 uppercase block">
                      Margen de Ganancia
                    </span>
                    <span className="text-base font-extrabold text-emerald-700 inline-flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {Math.round(previewMetrics.marginPercent)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {editingBox ? 'Guardar Cambios' : 'Guardar Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
