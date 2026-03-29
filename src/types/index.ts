export type UserRole = 'admin' | 'staff';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export type MasterCategory = 'wood' | 'ply' | 'foam' | 'hardware' | 'markups' | 'fabric';

export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Closed';

export type CustomerType = 'Architect' | 'Interior Designer' | 'House Owner' | 'Showroom' | 'Third Party';

// ===================================================================
// PRODUCT LIBRARY / SKU
// ===================================================================

export interface ProductLibraryItem {
  id?: string;
  sku: string;
  name: string;
  category: string;
  image?: string;
  description?: string;
  tags?: string[];
  
  // Costing Snapshot (Static values at time of saving)
  woodBreakdown: WoodRow[];
  plyBreakdown: PlyRow[];
  foamBreakdown: FoamRow[];
  fabricBreakdown: FabricRow[];
  
  labour: {
    carpenter: number;
    polish: number;
    foam: number;
    total: number;
  };
  
  miscellaneous: {
    amount: number;
    total: number;
  };
  
  factoryExpensePercent: number;
  
  // Totals at time of snapshot
  totalInternalCost: number;
  totalMaterials: number;
  totalLabour: number;
  totalWastageAmount: number;
  
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

// ===================================================================
// QUOTE ROW TYPES
// ===================================================================

export interface WoodRow {
  id: string;
  componentName: string;
  woodType: string;
  length_ft: number;
  width_in: number;
  thickness_in: number;
  quantity: number;
  wastage_percent?: number;
  gun_foot: number;
  rate_per_gf: number;
  isRateOverridden: boolean;
  total_cost: number;
}

export interface PlyRow {
  id: string;
  componentName: string;
  plyCategory: string;
  thickness_mm: number;
  sheet_length_ft: number;
  sheet_width_ft: number;
  cut_length_in: number;
  cut_width_in: number;
  quantity: number;
  sqft: number;
  wastage_percent: number;
  wastage_amount: number;
  rate_per_sqft: number;
  isRateOverridden: boolean;
  total_cost: number;
}

export interface FoamRow {
  id: string;
  componentName: string;
  foamType: string;
  specification: string;
  thickness_in: number;
  cut_length_in: number;
  cut_width_in: number;
  quantity: number;
  sqft: number;
  master_rate: number;       // base rate from foam master
  rate_per_sqft: number;     // derived: (master_rate × thickness) / 18
  wastage_percent: number;
  wastage_amount: number;
  isRateOverridden: boolean;
  total_cost: number;
}

export interface FabricRow {
  id: string;
  componentName: string;
  fabricType: string;
  metersRequired: number;
  wastagePercent: number;
  ratePerMeter: number;
  totalCost: number;
  isCustomRate?: boolean;
}

// ===================================================================
// QUOTATION
// ===================================================================

export interface QuoteSummary {
  totalWood: number;
  totalPly: number;
  totalFoam: number;
  totalFabric: number;
  totalMaterials: number;
  totalLabour: number;
  totalMisc: number;
  totalInternalCost: number;
  totalWastageAmount: number;
  factoryExpensePercent: number;
  factoryExpenseAmount: number;
  markupPercent: number;
  finalSellingPrice: number;
  grossProfitAmount: number;
  profitPercent: number;
  baseAmount: number; // For GST calculation
  gstAmount: number;
  includeGST: boolean; 
  grandTotal: number;
}

export interface Quotation {
  id?: string;
  refCode?: string;
  productName?: string;
  productCategory: string;
  productImage?: string;
  customerName?: string;
  customerType: CustomerType;
  date: string;
  notes?: string;
  tags?: string;
  
  woodBreakdown: WoodRow[];
  plyBreakdown: PlyRow[];
  foamBreakdown: FoamRow[];
  fabricBreakdown: FabricRow[];
  
  status: QuoteStatus;
  gstPercent: number;
  includeGST: boolean; 
  factoryExpensePercent: number;
  markupPercent: number;
  isArchived: boolean;
  
  labour: {
    carpenter: number;
    polish: number;
    foam: number;
    total: number;
  };
  
  miscellaneous: {
    amount: number;
    notes?: string;
    total: number;
  };
  
  summary: QuoteSummary;
  
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

// ===================================================================
// MASTER SCHEMAS — each row = one usable rate record
// ===================================================================

/**
 * WOOD MASTER
 * Lookup: wood_type + length band + width + thickness
 * Simplified to 6 fields only (matches the rate card exactly).
 */
export interface WoodMaster {
  id?: string;
  wood_type: string;
  length_from_ft: number;
  length_to_ft: number;
  width_in: number;
  thickness_in: number;
  rate_per_gf: number;
}

/**
 * PLYWOOD MASTER
 * Lookup: ply_category + thickness_mm + effective_date
 * Rate is ALWAYS per sqft (stored directly)
 */
export interface PlyMaster {
  id?: string;
  ply_category: string;
  thickness_mm: number;
  rate_per_sqft: number;
  effective_date: string;       // YYYY-MM-DD
  is_active: boolean;
  notes?: string;
}

/**
 * FOAM MASTER
 * Simplified to core pricing data only.
 */
export interface FoamMaster {
  id?: string;
  foam_type: string;
  specification: string;
  base_rate: number;
}

/**
 * FABRIC MASTER
 */
export interface FabricMaster {
  id?: string;
  fabric_type: string;
  brand: string;
  base_rate_per_meter: number;
}

export interface CustomerMarkupSetting {
  customer_type: CustomerType;
  default_markup_percent: number;
}
