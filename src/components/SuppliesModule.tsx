'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  formatCLP,
  formatNumberCL,
  formatUnitCostCLP,
  getSupplyUnitCost,
} from '@/lib/calculations';
import { MeasurementUnit, SupplyItem, SupplyType } from '@/types/bakery';
import {
  AlertTriangle,
  Box,
  Check,
  Edit2,
  PackagePlus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';

const INGREDIENT_CATEGORIES = [
  'Harinas y Secos',
  'Azúcares y Endulzantes',
  'Chocolates y Cacao',
  'Lácteos y Huevos',
  'Frutos Secos y Pastas',
  'Frutas y Pulpas',
  'Esencias y Especias',
  'Otros Ingredientes',
];

const PACKAGING_CATEGORIES = [
  'Cajas',
  'Bolsas y Papel',
  'Stickers y Etiquetas',
  'Cintas y Decoración',
  'Otros Empaques',
];

export default function SuppliesModule() {
  const {
    state,
    addSupply,
    updateSupply,
    deleteSupply,
    registerSupplyPurchase,
  } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const [activeTab, setActiveTab] = useState<'all' | 'ingredient' | 'packaging' | 'low_stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Estado del modal de Crear/Editar Insumo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<SupplyType>('ingredient');
  const [category, setCategory] = useState(INGREDIENT_CATEGORIES[0]);
  const [inputUnit, setInputUnit] = useState<'g' | 'kg' | 'ml' | 'L' | 'u'>('g');
  const [purchaseQtyInput, setPurchaseQtyInput] = useState('1000');
  const [purchaseCostInput, setPurchaseCostInput] = useState('');
  const [currentStockInput, setCurrentStockInput] = useState('0');
  const [minStockInput, setMinStockInput] = useState('0');
  const [supplier, setSupplier] = useState('');

  // Estado del modal de "Registrar Compra Rápida"
  const [purchaseModalItem, setPurchaseModalItem] = useState<SupplyItem | null>(null);
  const [buyAddedQty, setBuyAddedQty] = useState('');
  const [buyTotalPaid, setBuyTotalPaid] = useState('');
  const [updatePriceOnBuy, setUpdatePriceOnBuy] = useState(true);

  const lowStockCount = useMemo(() => {
    return state.supplies.filter(
      (s) => s.minStock > 0 && s.currentStock <= s.minStock
    ).length;
  }, [state.supplies]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    state.supplies.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['Todas', ...Array.from(set)];
  }, [state.supplies]);

  const filteredSupplies = useMemo(() => {
    return state.supplies
      .filter((item) => {
        if (activeTab === 'ingredient' && item.type !== 'ingredient') return false;
        if (activeTab === 'packaging' && item.type !== 'packaging') return false;
        if (
          activeTab === 'low_stock' &&
          !(item.minStock > 0 && item.currentStock <= item.minStock)
        ) {
          return false;
        }
        if (selectedCategory !== 'Todas' && item.category !== selectedCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            (item.supplier && item.supplier.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [state.supplies, activeTab, selectedCategory, searchQuery]);

  const openNewModal = (defaultType: SupplyType = 'ingredient') => {
    setEditingSupply(null);
    setName('');
    setType(defaultType);
    setCategory(
      defaultType === 'ingredient' ? INGREDIENT_CATEGORIES[0] : PACKAGING_CATEGORIES[0]
    );
    setInputUnit(defaultType === 'ingredient' ? 'g' : 'u');
    setPurchaseQtyInput(defaultType === 'ingredient' ? '1000' : '10');
    setPurchaseCostInput('');
    setCurrentStockInput('0');
    setMinStockInput('0');
    setSupplier('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupplyItem) => {
    setEditingSupply(item);
    setName(item.name);
    setType(item.type);
    setCategory(item.category);
    setInputUnit(item.unit);
    setPurchaseQtyInput(String(item.purchaseQuantity));
    setPurchaseCostInput(String(item.purchaseCost));
    setCurrentStockInput(String(item.currentStock));
    setMinStockInput(String(item.minStock));
    setSupplier(item.supplier || '');
    setIsModalOpen(true);
  };

  const handleSaveSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Convertir kg -> g y L -> ml para mantener la unidad base limpia
    const multiplier = inputUnit === 'kg' || inputUnit === 'L' ? 1000 : 1;
    const baseUnit: MeasurementUnit =
      inputUnit === 'kg'
        ? 'g'
        : inputUnit === 'L'
        ? 'ml'
        : inputUnit;

    const rawPurchaseQty = Math.max(0.01, ( parseFloat(purchaseQtyInput) || 1 ) * multiplier);
    const rawPurchaseCost = Math.max(0, parseFloat(purchaseCostInput) || 0);
    const rawCurrentStock = Math.max(0, (parseFloat(currentStockInput) || 0) * multiplier);
    const rawMinStock = Math.max(0, (parseFloat(minStockInput) || 0) * multiplier);

    const payload = {
      name: name.trim(),
      type,
      category: category.trim() || 'General',
      unit: baseUnit,
      purchaseQuantity: rawPurchaseQty,
      purchaseCost: rawPurchaseCost,
      currentStock: rawCurrentStock,
      minStock: rawMinStock,
      supplier: supplier.trim() || undefined,
    };

    if (editingSupply) {
      updateSupply(editingSupply.id, payload);
      showToast(
        'Insumo actualizado',
        `"${payload.name}" se actualizó correctamente en la bodega.`
      );
    } else {
      addSupply(payload);
      showToast(
        'Insumo agregado a Bodega',
        `"${payload.name}" ya está listo para usar en tus recetas.`
      );
    }

    setIsModalOpen(false);
  };

  const openPurchaseModal = (item: SupplyItem) => {
    setPurchaseModalItem(item);
    setBuyAddedQty(String(item.purchaseQuantity));
    setBuyTotalPaid(String(item.purchaseCost));
    setUpdatePriceOnBuy(true);
  };

  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseModalItem) return;

    const added = Math.max(0, parseFloat(buyAddedQty) || 0);
    const paid = Math.max(0, parseFloat(buyTotalPaid) || 0);

    if (updatePriceOnBuy && added > 0) {
      registerSupplyPurchase(purchaseModalItem.id, added, added, paid);
    } else {
      registerSupplyPurchase(
        purchaseModalItem.id,
        added,
        purchaseModalItem.purchaseQuantity,
        purchaseModalItem.purchaseCost
      );
    }

    showToast(
      'Compra registrada en Bodega',
      `Se sumaron +${formatNumberCL(added)} ${purchaseModalItem.unit} de "${purchaseModalItem.name}".`
    );
    setPurchaseModalItem(null);
  };

  // Vista previa del precio unitario en el modal
  const previewMultiplier = inputUnit === 'kg' || inputUnit === 'L' ? 1000 : 1;
  const previewBaseUnit =
    inputUnit === 'kg' ? 'g' : inputUnit === 'L' ? 'ml' : inputUnit;
  const previewQty = (parseFloat(purchaseQtyInput) || 0) * previewMultiplier;
  const previewCost = parseFloat(purchaseCostInput) || 0;
  const previewUnitCost = previewQty > 0 ? previewCost / previewQty : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado y Botones Principales */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Wheat className="w-6 h-6 text-amber-600" />
            Bodega de Ingredientes y Empaque
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Ingresa cuánto compras y cuánto pagas en <span className="font-semibold text-stone-700">$ CLP</span>. El precio por gramo o unidad se calcula solo para todas tus recetas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openNewModal('ingredient')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Ingrediente
          </button>
          <button
            onClick={() => openNewModal('packaging')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-medium text-sm shadow-sm transition"
          >
            <Box className="w-4 h-4" />
            Nuevo Empaque / Caja
          </button>
        </div>
      </div>

      {/* Pestañas y Buscador */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5 bg-stone-100 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'all'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos ({state.supplies.length})
          </button>
          <button
            onClick={() => setActiveTab('ingredient')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'ingredient'
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Ingredientes ({state.supplies.filter((s) => s.type === 'ingredient').length})
          </button>
          <button
            onClick={() => setActiveTab('packaging')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'packaging'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Empaque / Cajas ({state.supplies.filter((s) => s.type === 'packaging').length})
          </button>
          <button
            onClick={() => setActiveTab('low_stock')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'low_stock'
                ? 'bg-red-600 text-white shadow-sm'
                : lowStockCount > 0
                ? 'text-red-700 bg-red-50 hover:bg-red-100'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Stock Bajo ({lowStockCount})
          </button>
        </div>

        <div className="flex flex-1 max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ingrediente, chocolate, caja..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado Vacío */}
      {filteredSupplies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-800">
            {state.supplies.length === 0
              ? 'Tu bodega está lista para empezar desde cero'
              : 'No se encontraron insumos con ese filtro'}
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-6">
            {state.supplies.length === 0
              ? 'Agrega tus primeros ingredientes (ej. Mantequilla, Harina, Azúcar, Chocolate) o tus cajas de empaque para comenzar a armar tus recetas.'
              : 'Prueba cambiando la búsqueda o seleccionando otra categoría.'}
          </p>
          {state.supplies.length === 0 && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => openNewModal('ingredient')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Agregar Primer Ingrediente
              </button>
              <button
                onClick={() => openNewModal('packaging')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-sm transition"
              >
                <Box className="w-4 h-4" />
                Agregar Empaque
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Tabla de Insumos estilo Planilla Mejorada */
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Insumo / Categoría</th>
                  <th className="py-3.5 px-4 bg-amber-50/60 text-amber-900">
                    Cantidad Comprada
                  </th>
                  <th className="py-3.5 px-4 bg-amber-50/60 text-amber-900">
                    Costo Pagado ($)
                  </th>
                  <th className="py-3.5 px-4">Precio Unitario ($/u)</th>
                  <th className="py-3.5 px-4">Stock en Bodega</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredSupplies.map((item) => {
                  const unitCost = getSupplyUnitCost(item);
                  const isLowStock =
                    item.minStock > 0 && item.currentStock <= item.minStock;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-stone-50/80 transition group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              item.type === 'ingredient'
                                ? 'bg-amber-500'
                                : 'bg-stone-700'
                            }`}
                          />
                          <div>
                            <div className="font-semibold text-stone-800">
                              {item.name}
                            </div>
                            <div className="text-xs text-stone-400 flex items-center gap-2">
                              <span>{item.category}</span>
                              {item.supplier && (
                                <>
                                  <span>•</span>
                                  <span className="text-stone-500">
                                    {item.supplier}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 bg-amber-50/30 font-medium text-stone-700">
                        {formatNumberCL(item.purchaseQuantity)} {item.unit}
                      </td>

                      <td className="py-3.5 px-4 bg-amber-50/30 font-semibold text-stone-800">
                        {formatCLP(item.purchaseCost)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 font-bold text-xs">
                          {formatUnitCostCLP(unitCost, item.unit)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              isLowStock ? 'text-red-600' : 'text-stone-700'
                            }`}
                          >
                            {formatNumberCL(item.currentStock)} {item.unit}
                          </span>
                          {isLowStock && (
                            <span
                              title={`Stock mínimo: ${item.minStock} ${item.unit}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Bajo
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPurchaseModal(item)}
                            title="Registrar nueva compra y sumar al stock"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs transition"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Compra</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            title="Editar insumo"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: 'Eliminar Insumo de Bodega',
                                message: `¿Estás segura de eliminar "${item.name}" de tu bodega?`,
                                confirmLabel: 'Sí, Eliminar',
                                variant: 'danger',
                              });
                              if (ok) {
                                deleteSupply(item.id);
                                showToast(
                                  'Insumo eliminado',
                                  `"${item.name}" fue eliminado de la bodega.`,
                                  'info'
                                );
                              }
                            }}
                            title="Eliminar insumo"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Insumo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-bold text-stone-800 text-lg">
                {editingSupply ? 'Editar Insumo' : 'Nuevo Insumo de Bodega'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupply} className="p-6 space-y-4">
              {/* Tipo: Ingrediente vs Empaque */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setType('ingredient');
                    setCategory(INGREDIENT_CATEGORIES[0]);
                    if (inputUnit === 'u') setInputUnit('g');
                  }}
                  className={`py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    type === 'ingredient'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  <Wheat className="w-4 h-4" />
                  Ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('packaging');
                    setCategory(PACKAGING_CATEGORIES[0]);
                    setInputUnit('u');
                  }}
                  className={`py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    type === 'packaging'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  Empaque / Caja
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Nombre del {type === 'ingredient' ? 'Ingrediente' : 'Empaque'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      type === 'ingredient'
                        ? 'Ej. Mantequilla sin sal, Harina floja, Chips 56%...'
                        : 'Ej. Caja para 6 galletas, Sticker logo...'
                    }
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {(type === 'ingredient'
                      ? INGREDIENT_CATEGORIES
                      : PACKAGING_CATEGORIES
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Proveedor / Marca (Opcional)
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ej. Valrhona, Soprole, La Vega..."
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Bloque amarillo como la planilla Excel */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Datos de Compra (Cálculo Automático)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Cantidad comprada *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={purchaseQtyInput}
                      onChange={(e) => setPurchaseQtyInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Unidad
                    </label>
                    <select
                      value={inputUnit}
                      onChange={(e) =>
                        setInputUnit(e.target.value as 'g' | 'kg' | 'ml' | 'L' | 'u')
                      }
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="g">Gramos (g)</option>
                      <option value="kg">Kilos (kg → pasa a g)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="L">Litros (L → pasa a ml)</option>
                      <option value="u">Unidades (u)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Costo Total Pagado ($ CLP) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={purchaseCostInput}
                      onChange={(e) => setPurchaseCostInput(e.target.value)}
                      placeholder="Ej. 8500"
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-200/70 text-xs">
                  <span className="text-amber-900 font-medium">
                    Precio unitario resultante para recetas:
                  </span>
                  <span className="text-sm font-bold text-amber-950 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                    {formatUnitCostCLP(previewUnitCost, previewBaseUnit)}
                  </span>
                </div>
              </div>

              {/* Control de Stock */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Stock disponible hoy ({inputUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={currentStockInput}
                    onChange={(e) => setCurrentStockInput(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Alerta stock mínimo ({inputUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={minStockInput}
                    onChange={(e) => setMinStockInput(e.target.value)}
                    placeholder="Ej. 500"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
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
                  {editingSupply ? 'Guardar Cambios' : 'Crear Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Compra Rápida */}
      {purchaseModalItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-emerald-50/70">
              <div>
                <h3 className="font-bold text-stone-800 text-base">
                  Registrar Compra: {purchaseModalItem.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Stock actual: {formatNumberCL(purchaseModalItem.currentStock)}{' '}
                  {purchaseModalItem.unit}
                </p>
              </div>
              <button
                onClick={() => setPurchaseModalItem(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPurchase} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Cantidad comprada que entra a bodega ({purchaseModalItem.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={buyAddedQty}
                  onChange={(e) => setBuyAddedQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Costo Total Pagado por esta compra ($ CLP) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={buyTotalPaid}
                  onChange={(e) => setBuyTotalPaid(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={updatePriceOnBuy}
                  onChange={(e) => setUpdatePriceOnBuy(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  Actualizar el precio del ingrediente con esta compra
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPurchaseModalItem(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <PackagePlus className="w-4 h-4" />
                  Sumar al Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
