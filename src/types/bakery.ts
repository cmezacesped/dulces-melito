export type SupplyType = 'ingredient' | 'packaging';
export type MeasurementUnit = 'g' | 'ml' | 'u';

export interface SupplyItem {
  id: string;
  name: string;
  type: SupplyType;
  category: string;
  unit: MeasurementUnit;
  purchaseQuantity: number; // Cantidad comprada en la unidad base (g, ml, u)
  purchaseCost: number; // Costo total pagado en $ CLP
  currentStock: number; // Cantidad disponible actualmente
  minStock: number; // Alerta de stock mínimo
  supplier?: string;
  updatedAt: string;
}

export interface RecipeIngredientLine {
  id: string;
  section: string; // ej. "Para la cookie", "Toffee de frambuesa", "Insert"
  sourceType: 'supply' | 'subrecipe';
  sourceId: string; // ID de SupplyItem o Recipe (sub-receta)
  quantity: number; // Cantidad usada en la unidad del ingrediente
  prepNote?: string; // ej. "fría", "derretida", "a temperatura ambiente"
}

export interface Recipe {
  id: string;
  name: string;
  isSubRecipe: boolean; // true = Base reutilizable ($/g), false = Receta final ($/unidad)
  line: string; // ej. "Base", "Sin azúcar", "Sin gluten", "Vegano"
  yieldUnits: number; // Unidades que rinde la receta (para recetas finales)
  lines: RecipeIngredientLine[];
  notes?: string;
  updatedAt: string;
}

export interface BoxRecipeItem {
  recipeId: string;
  quantity: number;
}

export interface BoxPackagingItem {
  supplyId: string;
  quantity: number;
}

export interface ProductBox {
  id: string;
  name: string;
  description?: string;
  isCustomizable: boolean; // false = Sabores fijos, true = Caja armable por el cliente
  capacity: number; // Cantidad de productos que caben (para cajas armables)
  fixedItems: BoxRecipeItem[]; // Sabores predefinidos (para cajas fijas)
  packagingItems: BoxPackagingItem[]; // Cajas, stickers, cintas, etc.
  salePrice: number; // Precio de venta al cliente en $ CLP
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type OrderStatus = 'scheduled' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type DeliveryMethod = 'pickup' | 'delivery';

export interface OrderItem {
  id: string;
  type: 'box' | 'single_recipe';
  boxId?: string;
  recipeId?: string;
  quantity: number; // Cantidad de cajas o de unidades sueltas
  unitSalePrice: number; // Precio unitario de venta ($ CLP)
  customSelections?: BoxRecipeItem[]; // Sabores elegidos si la caja es armable (por cada caja)
}

export interface CustomerOrder {
  id: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime?: string; // HH:mm
  customerName: string;
  customerPhone?: string;
  customerInstagram?: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string;
  deliveryFee: number;
  paymentStatus: PaymentStatus;
  depositAmount: number; // Monto abonado ($ CLP)
  orderStatus: OrderStatus;
  stockDeducted: boolean; // Indica si ya se descontó del inventario
  items: OrderItem[];
  notes?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: 'ingredient_purchase' | 'packaging_purchase' | 'extra_expense';
  amount: number; // Monto en $ CLP
  supplyId?: string;
  quantityAdded?: number;
  unit?: string;
}

export interface BakeryState {
  supplies: SupplyItem[];
  recipes: Recipe[];
  boxes: ProductBox[];
  orders: CustomerOrder[];
  expenses: ExpenseRecord[];
  recipeLines: string[]; // Líneas de recetas (Base, Sin azúcar, Sin gluten, Vegano, etc.)
  accessPin?: string; // PIN o contraseña de acceso rápido local/nube
}
