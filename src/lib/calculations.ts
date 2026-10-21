import {
  CustomerOrder,
  OrderItem,
  ProductBox,
  Recipe,
  SupplyItem,
} from '@/types/bakery';

/**
 * Formatea un monto en Pesos Chilenos ($ CLP) sin decimales para totales y precios
 */
export function formatCLP(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Formatea un costo unitario por gramo/ml/u mostrando hasta 2 decimales si es necesario
 * (ej. $0,9/g para harina o $18,5/g para chocolate)
 */
export function formatUnitCostCLP(amount: number, unit: string = 'g'): string {
  if (!Number.isFinite(amount) || amount === 0) return `$0/${unit}`;
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.005;
  const formatted = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$${formatted}/${unit}`;
}

export function formatNumberCL(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/**
 * Obtiene el precio unitario de un insumo de bodega ($/g, $/ml o $/u)
 */
export function getSupplyUnitCost(supply: SupplyItem): number {
  if (!supply || supply.purchaseQuantity <= 0) return 0;
  return supply.purchaseCost / supply.purchaseQuantity;
}

export interface CalculatedRecipeLine {
  lineId: string;
  section: string;
  sourceType: 'supply' | 'subrecipe';
  sourceId: string;
  name: string;
  unit: string;
  quantity: number;
  prepNote?: string;
  unitCost: number;
  totalCost: number;
}

export interface RecipeMetrics {
  totalCost: number;
  totalWeightGrams: number;
  costPerGram: number;
  costPerUnit: number;
  yieldUnits: number;
  calculatedLines: CalculatedRecipeLine[];
}

/**
 * Calcula costos y pesos de una receta o sub-receta (soportando sub-recetas anidadas)
 */
export function calculateRecipeMetrics(
  recipe: Recipe,
  supplies: SupplyItem[],
  allRecipes: Recipe[],
  visitedIds: Set<string> = new Set()
): RecipeMetrics {
  if (visitedIds.has(recipe.id)) {
    return {
      totalCost: 0,
      totalWeightGrams: 0,
      costPerGram: 0,
      costPerUnit: 0,
      yieldUnits: recipe.yieldUnits || 1,
      calculatedLines: [],
    };
  }

  const nextVisited = new Set(visitedIds);
  nextVisited.add(recipe.id);

  let totalCost = 0;
  let totalWeightGrams = 0;
  const calculatedLines: CalculatedRecipeLine[] = [];

  for (const line of recipe.lines) {
    if (line.sourceType === 'supply') {
      const supply = supplies.find((s) => s.id === line.sourceId);
      const unitCost = supply ? getSupplyUnitCost(supply) : 0;
      const lineCost = line.quantity * unitCost;
      const unit = supply?.unit || 'g';

      totalCost += lineCost;
      if (unit === 'g' || unit === 'ml') {
        totalWeightGrams += line.quantity;
      }

      calculatedLines.push({
        lineId: line.id,
        section: line.section || 'General',
        sourceType: 'supply',
        sourceId: line.sourceId,
        name: supply ? supply.name : 'Ingrediente eliminado',
        unit,
        quantity: line.quantity,
        prepNote: line.prepNote,
        unitCost,
        totalCost: lineCost,
      });
    } else {
      const subRecipe = allRecipes.find((r) => r.id === line.sourceId);
      let unitCost = 0;
      if (subRecipe) {
        const subMetrics = calculateRecipeMetrics(
          subRecipe,
          supplies,
          allRecipes,
          nextVisited
        );
        unitCost = subRecipe.isSubRecipe
          ? subMetrics.costPerGram
          : subMetrics.costPerUnit;
      }
      const lineCost = line.quantity * unitCost;
      const unit = subRecipe && !subRecipe.isSubRecipe ? 'u' : 'g';

      totalCost += lineCost;
      if (unit === 'g') {
        totalWeightGrams += line.quantity;
      }

      calculatedLines.push({
        lineId: line.id,
        section: line.section || 'General',
        sourceType: 'subrecipe',
        sourceId: line.sourceId,
        name: subRecipe ? subRecipe.name : 'Sub-receta eliminada',
        unit,
        quantity: line.quantity,
        prepNote: line.prepNote,
        unitCost,
        totalCost: lineCost,
      });
    }
  }

  const costPerGram = totalWeightGrams > 0 ? totalCost / totalWeightGrams : 0;
  const yieldUnits = recipe.yieldUnits > 0 ? recipe.yieldUnits : 1;
  const costPerUnit = recipe.isSubRecipe ? costPerGram : totalCost / yieldUnits;

  return {
    totalCost,
    totalWeightGrams,
    costPerGram,
    costPerUnit,
    yieldUnits,
    calculatedLines,
  };
}

export interface BoxMetrics {
  recipesCost: number;
  packagingCost: number;
  totalCost: number;
  salePrice: number;
  profit: number;
  marginPercent: number;
  isEstimated: boolean;
}

/**
 * Calcula el costo, ganancia y margen de una Caja/Pack.
 * Si es una caja "armable" y no se pasan selecciones específicas, estima con el promedio de las recetas finales.
 */
export function calculateBoxMetrics(
  box: ProductBox,
  supplies: SupplyItem[],
  recipes: Recipe[],
  customSelections?: { recipeId: string; quantity: number }[]
): BoxMetrics {
  let packagingCost = 0;
  for (const pkg of box.packagingItems) {
    const supply = supplies.find((s) => s.id === pkg.supplyId);
    if (supply) {
      packagingCost += getSupplyUnitCost(supply) * pkg.quantity;
    }
  }

  let recipesCost = 0;
  let isEstimated = false;

  const itemsToCalculate =
    box.isCustomizable && customSelections && customSelections.length > 0
      ? customSelections
      : !box.isCustomizable
      ? box.fixedItems
      : null;

  if (itemsToCalculate) {
    for (const item of itemsToCalculate) {
      const recipe = recipes.find((r) => r.id === item.recipeId);
      if (recipe) {
        const metrics = calculateRecipeMetrics(recipe, supplies, recipes);
        recipesCost += metrics.costPerUnit * item.quantity;
      }
    }
  } else {
    // Caja armable sin selección aún: estimamos con el costo unitario promedio de las recetas finales
    isEstimated = true;
    const finalRecipes = recipes.filter((r) => !r.isSubRecipe);
    if (finalRecipes.length > 0) {
      const avgUnitCost =
        finalRecipes.reduce((acc, r) => {
          const m = calculateRecipeMetrics(r, supplies, recipes);
          return acc + m.costPerUnit;
        }, 0) / finalRecipes.length;
      recipesCost = avgUnitCost * (box.capacity || 1);
    }
  }

  const totalCost = recipesCost + packagingCost;
  const salePrice = box.salePrice || 0;
  const profit = salePrice - totalCost;
  const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  return {
    recipesCost,
    packagingCost,
    totalCost,
    salePrice,
    profit,
    marginPercent,
    isEstimated,
  };
}

export interface OrderMetrics {
  itemsSubtotal: number;
  deliveryFee: number;
  totalSale: number;
  totalProductionCost: number;
  netProfit: number;
  marginPercent: number;
  remainingBalance: number;
}

/**
 * Calcula los totales financieros de un pedido en el calendario
 */
export function calculateOrderMetrics(
  order: CustomerOrder,
  boxes: ProductBox[],
  recipes: Recipe[],
  supplies: SupplyItem[]
): OrderMetrics {
  let itemsSubtotal = 0;
  let totalProductionCost = 0;

  for (const item of order.items) {
    itemsSubtotal += item.unitSalePrice * item.quantity;

    if (item.type === 'box' && item.boxId) {
      const box = boxes.find((b) => b.id === item.boxId);
      if (box) {
        const boxMetrics = calculateBoxMetrics(
          box,
          supplies,
          recipes,
          item.customSelections
        );
        totalProductionCost += boxMetrics.totalCost * item.quantity;
      }
    } else if (item.type === 'single_recipe' && item.recipeId) {
      const recipe = recipes.find((r) => r.id === item.recipeId);
      if (recipe) {
        const recMetrics = calculateRecipeMetrics(recipe, supplies, recipes);
        totalProductionCost += recMetrics.costPerUnit * item.quantity;
      }
    }
  }

  const deliveryFee = order.deliveryFee || 0;
  const totalSale = itemsSubtotal + deliveryFee;
  const netProfit = itemsSubtotal - totalProductionCost;
  const marginPercent = itemsSubtotal > 0 ? (netProfit / itemsSubtotal) * 100 : 0;

  const paidAmount =
    order.paymentStatus === 'paid'
      ? totalSale
      : order.paymentStatus === 'partial'
      ? order.depositAmount || 0
      : 0;

  const remainingBalance = Math.max(0, totalSale - paidAmount);

  return {
    itemsSubtotal,
    deliveryFee,
    totalSale,
    totalProductionCost,
    netProfit,
    marginPercent,
    remainingBalance,
  };
}

/**
 * Desglosa recursivamente los insumos crudos (SupplyItem) que consume una cantidad de una receta
 */
export function accumulateRecipeRawSupplies(
  recipe: Recipe,
  unitsNeeded: number, // Unidades si es receta final, o gramos si es sub-receta
  supplies: SupplyItem[],
  allRecipes: Recipe[],
  supplyTotals: Map<string, number>,
  visitedIds: Set<string> = new Set()
) {
  if (visitedIds.has(recipe.id) || unitsNeeded <= 0) return;
  const nextVisited = new Set(visitedIds);
  nextVisited.add(recipe.id);

  const metrics = calculateRecipeMetrics(recipe, supplies, allRecipes);
  // Factor de lote: cuántos lotes de esta receta se requieren
  const batchFactor = recipe.isSubRecipe
    ? metrics.totalWeightGrams > 0
      ? unitsNeeded / metrics.totalWeightGrams
      : 0
    : (recipe.yieldUnits || 1) > 0
    ? unitsNeeded / (recipe.yieldUnits || 1)
    : 0;

  if (batchFactor <= 0) return;

  for (const line of recipe.lines) {
    const requiredLineQty = line.quantity * batchFactor;
    if (line.sourceType === 'supply') {
      const prev = supplyTotals.get(line.sourceId) || 0;
      supplyTotals.set(line.sourceId, prev + requiredLineQty);
    } else {
      const subRecipe = allRecipes.find((r) => r.id === line.sourceId);
      if (subRecipe) {
        accumulateRecipeRawSupplies(
          subRecipe,
          requiredLineQty,
          supplies,
          allRecipes,
          supplyTotals,
          nextVisited
        );
      }
    }
  }
}

export interface ProductionRecipeSummary {
  recipe: Recipe;
  totalUnitsToBake: number;
  batchesNeeded: number;
}

export interface ShoppingListItem {
  supply: SupplyItem;
  requiredQuantity: number;
  currentStock: number;
  missingQuantity: number;
  estimatedCostToBuy: number;
  packsToBuy: number;
}

/**
 * Calcula para una lista de pedidos:
 * 1) Qué recetas y cuántas unidades hornear en total
 * 2) Qué cantidad exacta de cada insumo y empaque se necesita
 * 3) La lista de compras comparada contra el Stock actual en Bodega
 */
export function calculateProductionAndShopping(
  orders: CustomerOrder[],
  boxes: ProductBox[],
  recipes: Recipe[],
  supplies: SupplyItem[]
): {
  recipesToBake: ProductionRecipeSummary[];
  supplyConsumptionMap: Map<string, number>;
  shoppingList: ShoppingListItem[];
} {
  const recipeUnitsMap = new Map<string, number>();
  const supplyConsumptionMap = new Map<string, number>();

  for (const order of orders) {
    if (order.orderStatus === 'cancelled') continue;

    for (const item of order.items) {
      if (item.type === 'single_recipe' && item.recipeId) {
        const prev = recipeUnitsMap.get(item.recipeId) || 0;
        recipeUnitsMap.set(item.recipeId, prev + item.quantity);
      } else if (item.type === 'box' && item.boxId) {
        const box = boxes.find((b) => b.id === item.boxId);
        if (!box) continue;

        // Sumar empaque de la caja
        for (const pkg of box.packagingItems) {
          const prevPkg = supplyConsumptionMap.get(pkg.supplyId) || 0;
          supplyConsumptionMap.set(pkg.supplyId, prevPkg + pkg.quantity * item.quantity);
        }

        // Sumar recetas dentro de la caja
        const boxRecipes =
          box.isCustomizable && item.customSelections && item.customSelections.length > 0
            ? item.customSelections
            : box.fixedItems;

        for (const br of boxRecipes) {
          const prevRec = recipeUnitsMap.get(br.recipeId) || 0;
          recipeUnitsMap.set(br.recipeId, prevRec + br.quantity * item.quantity);
        }
      }
    }
  }

  const recipesToBake: ProductionRecipeSummary[] = [];

  for (const [recipeId, totalUnitsToBake] of Array.from(recipeUnitsMap.entries())) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || totalUnitsToBake <= 0) continue;

    const yieldUnits = recipe.yieldUnits > 0 ? recipe.yieldUnits : 1;
    const batchesNeeded = totalUnitsToBake / yieldUnits;

    recipesToBake.push({
      recipe,
      totalUnitsToBake,
      batchesNeeded,
    });

    accumulateRecipeRawSupplies(
      recipe,
      totalUnitsToBake,
      supplies,
      recipes,
      supplyConsumptionMap
    );
  }

  recipesToBake.sort((a, b) => b.totalUnitsToBake - a.totalUnitsToBake);

  const shoppingList: ShoppingListItem[] = [];
  for (const [supplyId, requiredQuantity] of Array.from(supplyConsumptionMap.entries())) {
    const supply = supplies.find((s) => s.id === supplyId);
    if (!supply || requiredQuantity <= 0) continue;

    const currentStock = supply.currentStock || 0;
    const missingQuantity = Math.max(0, requiredQuantity - currentStock);
    const unitCost = getSupplyUnitCost(supply);
    const packsToBuy =
      missingQuantity > 0 && supply.purchaseQuantity > 0
        ? Math.ceil(missingQuantity / supply.purchaseQuantity)
        : 0;
    const estimatedCostToBuy =
      packsToBuy > 0
        ? packsToBuy * supply.purchaseCost
        : missingQuantity * unitCost;

    shoppingList.push({
      supply,
      requiredQuantity,
      currentStock,
      missingQuantity,
      estimatedCostToBuy,
      packsToBuy,
    });
  }

  shoppingList.sort((a, b) => b.missingQuantity - a.missingQuantity);

  return {
    recipesToBake,
    supplyConsumptionMap,
    shoppingList,
  };
}
