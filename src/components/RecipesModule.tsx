'use client';

import React, { useMemo, useState } from 'react';
import { useBakery } from '@/context/BakeryContext';
import { useFeedback } from '@/context/FeedbackContext';
import {
  calculateRecipeMetrics,
  formatCLP,
  formatNumberCL,
  formatUnitCostCLP,
  getSupplyUnitCost,
} from '@/lib/calculations';
import { Recipe, RecipeIngredientLine } from '@/types/bakery';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChefHat,
  Copy,
  Edit2,
  Flame,
  Layers,
  Plus,
  Scale,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

function makeLineId() {
  return `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

const DEFAULT_RECIPE_SECTIONS = [
  'Para la cookie',
  'Para la masa',
  'Relleno / Insert',
  'Toffee / Caramelo',
  'Compota / Curd',
  'Glaseado / Cobertura',
  'Merengue',
  'Decoración / Topping',
  'Ingredientes',
];

export default function RecipesModule() {
  const {
    state,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    duplicateRecipe,
    bakeRecipeBatch,
    addRecipeCategoryLine,
  } = useBakery();
  const { showToast, confirmAction } = useFeedback();

  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Filtros del índice
  const [typeFilter, setTypeFilter] = useState<'all' | 'final' | 'subrecipe'>('all');
  const [lineFilter, setLineFilter] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [newLineInput, setNewLineInput] = useState('');
  const [showNewLineInput, setShowNewLineInput] = useState(false);

  // Escalador en vivo en vista detalle ("Modo Cocina")
  const [scaledUnitsInput, setScaledUnitsInput] = useState<string>('');
  const [bakeSuccessMsg, setBakeSuccessMsg] = useState<string | null>(null);

  // Estado del formulario Crear/Editar Receta
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formName, setFormName] = useState('');
  const [formIsSubRecipe, setFormIsSubRecipe] = useState(false);
  const [formLine, setFormLine] = useState('Base');
  const [formYieldUnits, setFormYieldUnits] = useState('12');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<RecipeIngredientLine[]>([]);
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Lista combinada de secciones seleccionables (predeterminadas + usadas en recetas + creadas)
  const availableSections = useMemo(() => {
    const set = new Set<string>(DEFAULT_RECIPE_SECTIONS);
    state.recipes.forEach((r) => {
      r.lines.forEach((l) => {
        if (l.section && l.section.trim()) set.add(l.section.trim());
      });
    });
    formLines.forEach((l) => {
      if (l.section && l.section.trim()) set.add(l.section.trim());
    });
    customSections.forEach((s) => {
      if (s.trim()) set.add(s.trim());
    });
    return Array.from(set);
  }, [state.recipes, formLines, customSections]);

  const ingredientSupplies = useMemo(
    () =>
      state.supplies
        .filter((s) => s.type === 'ingredient')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [state.supplies]
  );

  const subRecipesList = useMemo(
    () =>
      state.recipes
        .filter((r) => r.isSubRecipe && (!editingRecipe || r.id !== editingRecipe.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [state.recipes, editingRecipe]
  );

  const filteredRecipes = useMemo(() => {
    return state.recipes
      .filter((r) => {
        if (typeFilter === 'final' && r.isSubRecipe) return false;
        if (typeFilter === 'subrecipe' && !r.isSubRecipe) return false;
        if (lineFilter !== 'Todas' && r.line !== lineFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) || r.line.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isSubRecipe !== b.isSubRecipe) return a.isSubRecipe ? -1 : 1;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [state.recipes, typeFilter, lineFilter, searchQuery]);

  const selectedRecipe = useMemo(
    () => state.recipes.find((r) => r.id === selectedRecipeId) || null,
    [state.recipes, selectedRecipeId]
  );

  const openRecipeDetail = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    setScaledUnitsInput(
      recipe.isSubRecipe ? '' : String(recipe.yieldUnits || 12)
    );
    setBakeSuccessMsg(null);
    setViewMode('detail');
  };

  const openCreateForm = (isSub = false) => {
    setEditingRecipe(null);
    setFormName('');
    setFormIsSubRecipe(isSub);
    setFormLine(state.recipeLines[0] || 'Base');
    setFormYieldUnits('12');
    setFormNotes('');
    const defaultSupplyId = ingredientSupplies[0]?.id || '';
    setFormLines(
      defaultSupplyId
        ? [
            {
              id: makeLineId(),
              section: isSub ? 'Ingredientes' : 'Para la cookie',
              sourceType: 'supply',
              sourceId: defaultSupplyId,
              quantity: 100,
              prepNote: '',
            },
          ]
        : []
    );
    setViewMode('form');
  };

  const openEditForm = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormName(recipe.name);
    setFormIsSubRecipe(recipe.isSubRecipe);
    setFormLine(recipe.line);
    setFormYieldUnits(String(recipe.yieldUnits || 12));
    setFormNotes(recipe.notes || '');
    setFormLines(recipe.lines.map((l) => ({ ...l })));
    setViewMode('form');
  };

  const handleAddFormLine = (sectionName?: string) => {
    const lastSection =
      sectionName ||
      (formLines.length > 0
        ? formLines[formLines.length - 1].section
        : formIsSubRecipe
        ? 'Ingredientes'
        : 'Para la cookie');
    const defaultSupplyId =
      ingredientSupplies[0]?.id || subRecipesList[0]?.id || '';
    const defaultSourceType: 'supply' | 'subrecipe' = ingredientSupplies[0]
      ? 'supply'
      : 'subrecipe';

    setFormLines((prev) => [
      ...prev,
      {
        id: makeLineId(),
        section: lastSection,
        sourceType: defaultSourceType,
        sourceId: defaultSupplyId,
        quantity: 100,
        prepNote: '',
      },
    ]);
  };

  const handleUpdateFormLine = (
    lineId: string,
    patch: Partial<RecipeIngredientLine>
  ) => {
    setFormLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l))
    );
  };

  const handleRemoveFormLine = (lineId: string) => {
    setFormLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const cleanLines = formLines.filter((l) => l.sourceId && l.quantity > 0);
    const yieldNum = formIsSubRecipe
      ? 1
      : Math.max(1, parseFloat(formYieldUnits) || 1);

    const payload = {
      name: formName.trim(),
      isSubRecipe: formIsSubRecipe,
      line: formLine || 'Base',
      yieldUnits: yieldNum,
      lines: cleanLines,
      notes: formNotes.trim() || undefined,
    };

    if (editingRecipe) {
      updateRecipe(editingRecipe.id, payload);
      setSelectedRecipeId(editingRecipe.id);
      setScaledUnitsInput(formIsSubRecipe ? '' : String(yieldNum));
      setViewMode('detail');
      showToast(
        'Receta actualizada',
        `Los cambios en "${payload.name}" se guardaron correctamente.`
      );
    } else {
      const created = addRecipe(payload);
      setSelectedRecipeId(created.id);
      setScaledUnitsInput(formIsSubRecipe ? '' : String(yieldNum));
      setViewMode('detail');
      showToast(
        'Receta creada con éxito',
        `"${payload.name}" se agregó a tu recetario.`
      );
    }
  };

  // ==========================================================
  // VISTA 1: DETALLE DE RECETA + ESCALADOR EN VIVO (MODO COCINA)
  // ==========================================================
  if (viewMode === 'detail' && selectedRecipe) {
    const metrics = calculateRecipeMetrics(
      selectedRecipe,
      state.supplies,
      state.recipes
    );

    const baseUnits = selectedRecipe.isSubRecipe
      ? metrics.totalWeightGrams || 1
      : selectedRecipe.yieldUnits || 1;
    const desiredUnits = parseFloat(scaledUnitsInput) || baseUnits;
    const scaleFactor = baseUnits > 0 ? desiredUnits / baseUnits : 1;

    // Agrupar líneas por sección tal como en la planilla Excel
    const sectionsMap = new Map<string, typeof metrics.calculatedLines>();
    for (const line of metrics.calculatedLines) {
      const sec = line.section || 'Ingredientes';
      const arr = sectionsMap.get(sec) || [];
      arr.push(line);
      sectionsMap.set(sec, arr);
    }

    return (
      <div className="space-y-6">
        {/* Barra Superior */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Índice de Recetas
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const copy = duplicateRecipe(selectedRecipe.id);
                if (copy) {
                  showToast(
                    'Receta duplicada',
                    `Se creó "${copy.name}". Ahora puedes editar sus ingredientes o línea.`
                  );
                  openEditForm(copy);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium transition"
            >
              <Copy className="w-4 h-4" />
              Duplicar Receta
            </button>
            <button
              onClick={() => openEditForm(selectedRecipe)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <Edit2 className="w-4 h-4" />
              Editar Receta
            </button>
          </div>
        </div>

        {/* Encabezado de la Receta y Tarjetas de Resumen */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                    selectedRecipe.isSubRecipe
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {selectedRecipe.isSubRecipe ? 'Sub-receta (Base)' : 'Receta Final'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                  Línea: {selectedRecipe.line}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-stone-900">
                {selectedRecipe.name}
              </h2>
              {selectedRecipe.notes && (
                <p className="text-sm text-stone-600 mt-1">{selectedRecipe.notes}</p>
              )}
            </div>

            {/* Panel de Modo Cocina / Escalador en Vivo */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
                  <Scale className="w-4 h-4 text-amber-700" />
                  Modo Cocina · Escalador en Vivo
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  {selectedRecipe.isSubRecipe
                    ? 'Cambia los gramos deseados para escalar la base:'
                    : 'Cambia cuántas unidades quieres hornear hoy:'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={scaledUnitsInput}
                  onChange={(e) => setScaledUnitsInput(e.target.value)}
                  placeholder={String(baseUnits)}
                  className="w-24 px-3 py-2 bg-white border border-amber-300 rounded-xl text-center font-bold text-stone-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs font-semibold text-amber-900">
                  {selectedRecipe.isSubRecipe ? 'g' : 'unid.'}
                </span>
                {Math.abs(scaleFactor - 1) > 0.01 && (
                  <button
                    onClick={() => setScaledUnitsInput(String(baseUnits))}
                    className="text-xs text-amber-700 underline hover:text-amber-950 ml-1"
                  >
                    Reset ({baseUnits})
                  </button>
                )}
              </div>

              <button
                onClick={async () => {
                  const unitsToDeduct = desiredUnits;
                  const ok = await confirmAction({
                    title: 'Hornear Lote y Descontar Stock',
                    message: `¿Descontar de tu Bodega los ingredientes exactos para preparar ${formatNumberCL(
                      unitsToDeduct
                    )} ${
                      selectedRecipe.isSubRecipe ? 'gramos' : 'unidades'
                    } de "${selectedRecipe.name}"?`,
                    confirmLabel: 'Sí, Hornear y Descontar',
                    variant: 'warning',
                  });
                  if (ok) {
                    bakeRecipeBatch(selectedRecipe.id, unitsToDeduct);
                    const msg = `¡Stock descontado para ${formatNumberCL(
                      unitsToDeduct
                    )} ${selectedRecipe.isSubRecipe ? 'g' : 'unidades'}!`;
                    setBakeSuccessMsg(msg);
                    showToast('¡Lote horneado!', msg, 'success');
                    setTimeout(() => setBakeSuccessMsg(null), 4000);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition"
              >
                <Flame className="w-4 h-4 text-amber-400" />
                Hornear y Descontar Stock
              </button>
            </div>
          </div>

          {bakeSuccessMsg && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              {bakeSuccessMsg}
            </div>
          )}

          {/* 4 Indicadores Clave de la Planilla */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-xs font-semibold text-stone-500 uppercase">
                Costo Total Receta {Math.abs(scaleFactor - 1) > 0.01 ? '(Escalada)' : ''}
              </div>
              <div className="text-2xl font-extrabold text-stone-900 mt-1">
                {formatCLP(metrics.totalCost * scaleFactor)}
              </div>
              {Math.abs(scaleFactor - 1) > 0.01 && (
                <div className="text-xs text-stone-400 mt-0.5">
                  Receta base: {formatCLP(metrics.totalCost)}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-xs font-semibold text-stone-500 uppercase">
                Peso Total Ingredientes
              </div>
              <div className="text-2xl font-bold text-stone-800 mt-1">
                {formatNumberCL(metrics.totalWeightGrams * scaleFactor)} g
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Costo por gramo: {formatUnitCostCLP(metrics.costPerGram, 'g')}
              </div>
            </div>

            {!selectedRecipe.isSubRecipe ? (
              <>
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="text-xs font-bold text-amber-900 uppercase">
                    Rendimiento Base (Unidades)
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={selectedRecipe.yieldUnits}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        updateRecipe(selectedRecipe.id, { yieldUnits: val });
                        setScaledUnitsInput(String(val));
                      }}
                      className="w-20 px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-bold text-lg text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-amber-800">
                      unidades (
                      {metrics.totalWeightGrams > 0 && selectedRecipe.yieldUnits > 0
                        ? `~${Math.round(
                            metrics.totalWeightGrams / selectedRecipe.yieldUnits
                          )} g c/u`
                        : ''}
                      )
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-900 uppercase">
                    Costo Unitario ($/unidad)
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                    {formatCLP(metrics.costPerUnit)}
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Calculado = Costo Total / Rendimiento
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900 uppercase">
                  Costo por Gramo de esta Sub-receta ($/g)
                </div>
                <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                  {formatUnitCostCLP(metrics.costPerGram, 'g')}
                </div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  Este valor se enlaza automáticamente (en verde) cuando usas esta base en otra receta.
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Ingredientes por Sección */}
          <div className="mt-6 border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase">
                  <th className="py-3 px-4">Sección</th>
                  <th className="py-3 px-4">Ingrediente / Sub-receta</th>
                  <th className="py-3 px-4">
                    Cantidad {Math.abs(scaleFactor - 1) > 0.01 ? '(Escalada)' : ''}
                  </th>
                  <th className="py-3 px-4">Precio Unitario ($/u)</th>
                  <th className="py-3 px-4 text-right">Costo ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {Array.from(sectionsMap.entries()).map(([sectionName, lines]) => (
                  <React.Fragment key={sectionName}>
                    <tr className="bg-stone-100/70">
                      <td
                        colSpan={5}
                        className="py-2 px-4 text-xs font-bold text-stone-700 uppercase tracking-wider"
                      >
                        {sectionName}
                      </td>
                    </tr>
                    {lines.map((line) => {
                      const isSub = line.sourceType === 'subrecipe';
                      return (
                        <tr
                          key={line.lineId}
                          className={
                            isSub
                              ? 'bg-emerald-50/50 hover:bg-emerald-50 transition'
                              : 'hover:bg-stone-50 transition'
                          }
                        >
                          <td className="py-3 px-4 text-xs text-stone-400">
                            {line.section}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isSub ? (
                                <button
                                  onClick={() => {
                                    const target = state.recipes.find(
                                      (r) => r.id === line.sourceId
                                    );
                                    if (target) openRecipeDetail(target);
                                  }}
                                  className="font-bold text-emerald-700 hover:underline flex items-center gap-1.5"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  {line.name}
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    Sub-receta
                                  </span>
                                </button>
                              ) : (
                                <span className="font-medium text-stone-800">
                                  {line.name}
                                </span>
                              )}
                              {line.prepNote && (
                                <span className="text-xs italic text-stone-500">
                                  ({line.prepNote})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-900">
                            {formatNumberCL(line.quantity * scaleFactor, 2)}{' '}
                            {line.unit}
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            {formatUnitCostCLP(line.unitCost, line.unit)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-stone-900">
                            {formatCLP(line.totalCost * scaleFactor)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // VISTA 2: FORMULARIO CREAR / EDITAR RECETA O SUB-RECETA
  // ==========================================================
  if (viewMode === 'form') {
    // Calculamos vista previa en tiempo real mientras arma la receta
    const previewRecipe: Recipe = {
      id: editingRecipe?.id || 'preview',
      name: formName || 'Nueva Receta',
      isSubRecipe: formIsSubRecipe,
      line: formLine,
      yieldUnits: Math.max(1, parseFloat(formYieldUnits) || 1),
      lines: formLines,
      updatedAt: '',
    };
    const previewMetrics = calculateRecipeMetrics(
      previewRecipe,
      state.supplies,
      state.recipes
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
          <button
            onClick={() =>
              selectedRecipeId ? setViewMode('detail') : setViewMode('list')
            }
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancelar y Volver
          </button>
          <h2 className="text-lg font-bold text-stone-800">
            {editingRecipe ? `Editando: ${editingRecipe.name}` : 'Crear Nueva Receta'}
          </h2>
        </div>

        <form onSubmit={handleSaveRecipe} className="space-y-6">
          {/* Datos Generales de la Receta */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl max-w-md">
              <button
                type="button"
                onClick={() => setFormIsSubRecipe(false)}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  !formIsSubRecipe
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-stone-600'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                Receta Final (Galletas, Tortas...)
              </button>
              <button
                type="button"
                onClick={() => setFormIsSubRecipe(true)}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  formIsSubRecipe
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-600'
                }`}
              >
                <Layers className="w-4 h-4" />
                Sub-receta (Base reutilizable)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Nombre de la Receta *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formIsSubRecipe
                      ? 'Ej. Praliné de avellanas, Huevo vegano...'
                      : 'Ej. Cookie Clásica de Chips, Cookie Pistacho Dubai...'
                  }
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Línea / Categoría
                </label>
                <select
                  value={formLine}
                  onChange={(e) => setFormLine(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {state.recipeLines.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {!formIsSubRecipe && (
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900 uppercase mb-1">
                    Rendimiento (Unidades que produce) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={formYieldUnits}
                    onChange={(e) => setFormYieldUnits(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                Notas o Instrucciones de preparación (Opcional)
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ej. Hornear a 175°C por 11 minutos, boleado de 125g..."
                className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Lista de Ingredientes de la Receta */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-800 text-base">
                  Ingredientes y Secciones de la Receta
                </h3>
                <p className="text-xs text-stone-500">
                  Puedes agrupar por sección (ej. &quot;Para la cookie&quot;, &quot;Insert de queso crema&quot;, &quot;Toffee&quot;) y usar ingredientes o sub-recetas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSectionModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Sección Personalizada
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFormLine()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Ingrediente / Fila
                </button>
              </div>
            </div>

            {showNewSectionModal && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <span className="text-xs font-bold text-amber-900">
                  Nombre de la nueva sección:
                </span>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Ej. Insert de queso crema, Barquillo..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newSectionName.trim();
                    if (!clean) return;
                    setCustomSections((prev) =>
                      prev.includes(clean) ? prev : [...prev, clean]
                    );
                    if (formLines.length > 0) {
                      const lastId = formLines[formLines.length - 1].id;
                      handleUpdateFormLine(lastId, { section: clean });
                    }
                    setNewSectionName('');
                    setShowNewSectionModal(false);
                    showToast(
                      'Sección agregada',
                      `"${clean}" ya aparece en la lista desplegable de secciones.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Agregar a la lista
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewSectionModal(false)}
                  className="p-1 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {ingredientSupplies.length === 0 && subRecipesList.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                Aún no has cargado ingredientes en la pestaña <strong>Bodega</strong>. Primero agrega tus ingredientes en Bodega para poder seleccionarlos aquí.
              </div>
            )}

            <div className="space-y-2.5">
              {formLines.map((line) => {
                const isSub = line.sourceType === 'subrecipe';
                const selectedSupply = !isSub
                  ? ingredientSupplies.find((s) => s.id === line.sourceId)
                  : null;
                const selectedSub = isSub
                  ? subRecipesList.find((r) => r.id === line.sourceId)
                  : null;

                let unitCost = 0;
                let unitLabel = 'g';
                if (!isSub && selectedSupply) {
                  unitCost = getSupplyUnitCost(selectedSupply);
                  unitLabel = selectedSupply.unit;
                } else if (isSub && selectedSub) {
                  const subM = calculateRecipeMetrics(
                    selectedSub,
                    state.supplies,
                    state.recipes
                  );
                  unitCost = subM.costPerGram;
                  unitLabel = 'g';
                }

                const lineTotalCost = (line.quantity || 0) * unitCost;

                return (
                  <div
                    key={line.id}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center p-3 rounded-xl border ${
                      isSub
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-stone-50/70 border-stone-200'
                    }`}
                  >
                    {/* Sección (Selector desplegable) */}
                    <div className="md:col-span-2">
                      <label className="block md:hidden text-[11px] font-semibold text-stone-500 uppercase">
                        Sección
                      </label>
                      <select
                        value={line.section}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setShowNewSectionModal(true);
                          } else {
                            handleUpdateFormLine(line.id, {
                              section: e.target.value,
                            });
                          }
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {availableSections.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                        <option value="__NEW__">+ Crear otra sección...</option>
                      </select>
                    </div>

                    {/* Tipo: Ingrediente vs Sub-receta (si existen sub-recetas) */}
                    <div className="md:col-span-2">
                      <label className="block md:hidden text-[11px] font-semibold text-stone-500 uppercase">
                        Origen
                      </label>
                      <select
                        value={line.sourceType}
                        onChange={(e) => {
                          const newType = e.target.value as 'supply' | 'subrecipe';
                          const firstId =
                            newType === 'supply'
                              ? ingredientSupplies[0]?.id || ''
                              : subRecipesList[0]?.id || '';
                          handleUpdateFormLine(line.id, {
                            sourceType: newType,
                            sourceId: firstId,
                          });
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="supply">Ingrediente Bodega</option>
                        <option
                          value="subrecipe"
                          disabled={subRecipesList.length === 0}
                        >
                          Sub-receta (Verde)
                        </option>
                      </select>
                    </div>

                    {/* Selector de Ingrediente o Sub-receta */}
                    <div className="md:col-span-3">
                      <label className="block md:hidden text-[11px] font-semibold text-stone-500 uppercase">
                        Ingrediente
                      </label>
                      <select
                        value={line.sourceId}
                        onChange={(e) =>
                          handleUpdateFormLine(line.id, { sourceId: e.target.value })
                        }
                        className="w-full px-2.5 py-2 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {line.sourceType === 'supply' ? (
                          ingredientSupplies.map((sup) => (
                            <option key={sup.id} value={sup.id}>
                              {sup.name} ({formatUnitCostCLP(getSupplyUnitCost(sup), sup.unit)})
                            </option>
                          ))
                        ) : (
                          subRecipesList.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              [Sub-receta] {sub.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Cantidad */}
                    <div className="md:col-span-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.quantity}
                        onChange={(e) =>
                          handleUpdateFormLine(line.id, {
                            quantity: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs font-semibold text-stone-500">
                        {unitLabel}
                      </span>
                    </div>

                    {/* Nota de preparación */}
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={line.prepNote || ''}
                        onChange={(e) =>
                          handleUpdateFormLine(line.id, { prepNote: e.target.value })
                        }
                        placeholder="Nota (ej. fría, picada)"
                        className="w-full px-2.5 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* Costo Calculado y Eliminar */}
                    <div className="md:col-span-1 flex items-center justify-between md:justify-end gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        {formatCLP(lineTotalCost)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormLine(line.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen en Vivo al Pie del Editor */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-200 bg-stone-50 p-4 rounded-xl">
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="text-xs text-stone-500 block">
                    Peso Total Masa
                  </span>
                  <span className="text-base font-bold text-stone-800">
                    {formatNumberCL(previewMetrics.totalWeightGrams)} g
                  </span>
                </div>
                <div>
                  <span className="text-xs text-stone-500 block">
                    Costo Total Receta
                  </span>
                  <span className="text-lg font-extrabold text-stone-900">
                    {formatCLP(previewMetrics.totalCost)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-emerald-700 font-semibold block">
                    {formIsSubRecipe ? 'Costo por Gramo ($/g)' : 'Costo Unitario ($/unidad)'}
                  </span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    {formIsSubRecipe
                      ? formatUnitCostCLP(previewMetrics.costPerGram, 'g')
                      : formatCLP(previewMetrics.costPerUnit)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition"
              >
                <Check className="w-4 h-4" />
                Guardar Receta
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================================
  // VISTA 3: ÍNDICE DE RECETAS Y SUB-RECETAS
  // ==========================================================
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" />
            Índice de Recetas y Sub-recetas
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Crea tus bases reutilizables (en verde) y tus recetas por línea. Haz clic en cualquiera para abrir su costeo y el escalador de cocina.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openCreateForm(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Nueva Receta
          </button>
          <button
            onClick={() => openCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm shadow-sm transition"
          >
            <Layers className="w-4 h-4" />
            Nueva Sub-receta (Base)
          </button>
        </div>
      </div>

      {/* Filtros por Tipo, Línea y Buscador */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                typeFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Todas ({state.recipes.length})
            </button>
            <button
              onClick={() => setTypeFilter('final')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                typeFilter === 'final'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Recetas ({state.recipes.filter((r) => !r.isSubRecipe).length})
            </button>
            <button
              onClick={() => setTypeFilter('subrecipe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                typeFilter === 'subrecipe'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Sub-recetas ({state.recipes.filter((r) => r.isSubRecipe).length})
            </button>
          </div>

          {/* Filtro por Línea (Base, Sin Azúcar, Sin Gluten, Vegano...) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['Todas', ...state.recipeLines].map((line) => (
              <button
                key={line}
                onClick={() => setLineFilter(line)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  lineFilter === line
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }`}
              >
                {line}
              </button>
            ))}

            {showNewLineInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newLineInput}
                  onChange={(e) => setNewLineInput(e.target.value)}
                  placeholder="Nueva línea..."
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newLineInput.trim()) {
                      addRecipeCategoryLine(newLineInput.trim());
                      setNewLineInput('');
                      setShowNewLineInput(false);
                    }
                  }}
                  className="p-1 rounded-lg bg-amber-600 text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewLineInput(false)}
                  className="p-1 rounded-lg text-stone-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewLineInput(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
              >
                + Línea
              </button>
            )}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar receta..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Lista de Recetas o Estado Vacío */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-800">
            {state.recipes.length === 0
              ? 'Tu recetario está listo para crear tu primera receta'
              : 'No hay recetas que coincidan con este filtro'}
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-6">
            {state.recipes.length === 0
              ? 'Crea primero tus sub-recetas reutilizables (como Praliné, Gianduja o Huevo Vegano) o directamente tus recetas de galletas y pastelería.'
              : 'Prueba cambiando la línea seleccionada o el texto de búsqueda.'}
          </p>
          {state.recipes.length === 0 && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => openCreateForm(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Crear Primera Receta
              </button>
              <button
                onClick={() => openCreateForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-sm transition"
              >
                <Sparkles className="w-4 h-4" />
                Crear Sub-receta Base
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Receta / Sub-receta</th>
                  <th className="py-3.5 px-4">Línea</th>
                  <th className="py-3.5 px-4">Peso Total</th>
                  <th className="py-3.5 px-4">Rendimiento</th>
                  <th className="py-3.5 px-4">Costo Total ($)</th>
                  <th className="py-3.5 px-4">Costo Unitario</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredRecipes.map((rec) => {
                  const metrics = calculateRecipeMetrics(
                    rec,
                    state.supplies,
                    state.recipes
                  );

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => openRecipeDetail(rec)}
                      className="hover:bg-amber-50/40 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                              rec.isSubRecipe
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {rec.isSubRecipe ? 'Sub-receta' : 'Receta'}
                          </span>
                          <span className="font-bold text-stone-800 hover:text-amber-700">
                            {rec.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium">
                          {rec.line}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-stone-600 font-medium">
                        {formatNumberCL(metrics.totalWeightGrams)} g
                      </td>

                      <td className="py-3.5 px-4 text-stone-600">
                        {rec.isSubRecipe
                          ? `${formatNumberCL(metrics.totalWeightGrams)} g`
                          : `${rec.yieldUnits} unid.`}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-stone-900">
                        {formatCLP(metrics.totalCost)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-xs ${
                            rec.isSubRecipe
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-900'
                          }`}
                        >
                          {rec.isSubRecipe
                            ? formatUnitCostCLP(metrics.costPerGram, 'g')
                            : `${formatCLP(metrics.costPerUnit)} / u`}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(rec)}
                            title="Editar receta"
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: 'Eliminar Receta',
                                message: `¿Estás segura de eliminar "${rec.name}" del recetario?`,
                                confirmLabel: 'Sí, Eliminar',
                                variant: 'danger',
                              });
                              if (ok) {
                                deleteRecipe(rec.id);
                                showToast(
                                  'Receta eliminada',
                                  `"${rec.name}" se eliminó del recetario.`,
                                  'info'
                                );
                              }
                            }}
                            title="Eliminar receta"
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
    </div>
  );
}
