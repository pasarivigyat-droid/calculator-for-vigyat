import { WoodRow, PlyRow, FoamRow, FabricRow, WoodMaster, PlyMaster, FoamMaster, FabricMaster, QuoteSummary } from "@/types";
import { normalizePlyCategory } from "@/lib/utils/csv_handler";

// ===================================================================
// NORMALIZATION HELPERS
// ===================================================================

export const normalizeStr = (str: string | undefined | null) => (str || '').toString().trim().toLowerCase();
export const normalizeNum = (n: any) => Number(n) || 0;

// ===================================================================
// GUN FOOT FORMULA
// ===================================================================

/**
 * Gun Foot = (length_ft × width_in × thickness_in × quantity) / 144
 */
export const calculateGunFoot = (
  length_ft: number,
  width_in: number,
  thickness_in: number
): number => {
  if (!length_ft || !width_in || !thickness_in) return 0;
  return Number(((length_ft * width_in * thickness_in) / 144).toFixed(3));
};

// ===================================================================
// MASTER LOOKUP FUNCTIONS — return full master row or null
// ===================================================================

/**
 * WOOD MASTER LOOKUP
 * Keys: wood_type + length band + width + thickness
 * Simplified — no is_active or effective_date filtering.
 */
export const findWoodMaster = (
  woodType: string,
  length: number,
  width: number,
  thickness: number,
  masters: WoodMaster[]
): WoodMaster | null => {
  const normType = normalizeStr(woodType);
  if (!normType) return null;
  const l = normalizeNum(length);
  const w = normalizeNum(width);
  const t = normalizeNum(thickness);
  const match = masters.find(m => 
    normalizeStr(m.wood_type) === normType &&
    l >= normalizeNum(m.length_from_ft) &&
    l <= normalizeNum(m.length_to_ft) &&
    w === normalizeNum(m.width_in) &&
    t === normalizeNum(m.thickness_in)
  );
  return match || null;
};

/**
 * PLY MASTER LOOKUP
 * Keys: ply_category + thickness_mm + effective_date ≤ today
 */
export const findPlyMaster = (category: string, thickness: number, masters: PlyMaster[]): PlyMaster | null => {
  const normCat = normalizePlyCategory(category);
  if (!normCat) return null;
  const t = normalizeNum(thickness);
  const today = new Date().toISOString().split('T')[0];
  const matches = masters.filter(m => 
    m.is_active &&
    normalizeStr(m.ply_category) === normCat &&
    normalizeNum(m.thickness_mm) === t &&
    m.effective_date <= today
  );
  if (matches.length === 0) return null;
  return matches.sort((a,b) => b.effective_date.localeCompare(a.effective_date))[0];
};

/**
 * FOAM MASTER LOOKUP
 * Keys: foam_type + specification + effective_date ≤ today
 * BUSINESS RULE: thickness is NOT part of lookup. It comes from the quote row.
 */
export const findFoamMaster = (type: string, spec: string, masters: FoamMaster[]): FoamMaster | null => {
  const normType = normalizeStr(type);
  const normSpec = normalizeStr(spec);
  if (!normType || !normSpec) return null;
  const today = new Date().toISOString().split('T')[0];
  const matches = masters.filter(m =>
    normalizeStr(m.foam_type) === normType &&
    normalizeStr(m.specification) === normSpec
  );
  if (matches.length === 0) return null;
  return matches[0];
};

// ===================================================================
// MATCH REASON FUNCTIONS — explain WHY a lookup failed
// ===================================================================

export const getWoodMatchReason = (row: Partial<WoodRow>, masters: WoodMaster[]): string => {
  const normType = normalizeStr(row.woodType);
  if (!normType) return "Wood type is empty.";
  const l = normalizeNum(row.length_ft);
  const w = normalizeNum(row.width_in);
  const t = normalizeNum(row.thickness_in);
  if (l === 0) return "Length is 0 or missing.";
  if (w === 0) return "Width is 0 or missing.";
  if (t === 0) return "Thickness is 0 or missing.";

  if (masters.length === 0) return "No wood master records found.";

  const typeMatches = masters.filter(m => normalizeStr(m.wood_type) === normType);
  if (typeMatches.length === 0) return `Wood type "${row.woodType}" not found in masters. Available: ${Array.from(new Set(masters.map(m => m.wood_type))).join(', ')}`;
  
  const bandMatches = typeMatches.filter(m => l >= normalizeNum(m.length_from_ft) && l <= normalizeNum(m.length_to_ft));
  if (bandMatches.length === 0) return `Length ${l}ft not inside any band for "${row.woodType}". Bands: ${typeMatches.map(m => `${m.length_from_ft}-${m.length_to_ft}`).join(', ')}`;

  const wMatches = bandMatches.filter(m => w === normalizeNum(m.width_in));
  if (wMatches.length === 0) return `Width ${w}in not available. Options: ${Array.from(new Set(bandMatches.map(m => normalizeNum(m.width_in)))).join(', ')}`;

  const tMatches = wMatches.filter(m => t === normalizeNum(m.thickness_in));
  if (tMatches.length === 0) return `Thickness ${t}in not available. Options: ${Array.from(new Set(wMatches.map(m => normalizeNum(m.thickness_in)))).join(', ')}`;

  return "No matching rate found.";
};

export const getPlyMatchReason = (row: Partial<PlyRow>, masters: PlyMaster[]): string => {
  let normCat = normalizeStr(row.plyCategory);
  if (!normCat) return "Category is empty.";
  if (normCat === "ply" || normCat === "plywo") normCat = "plywood";

  const t = normalizeNum(row.thickness_mm);
  if (t === 0) return "Thickness is 0 or missing.";
  const today = new Date().toISOString().split('T')[0];

  const activeMasters = masters.filter(m => m.is_active && m.effective_date <= today);
  if (activeMasters.length === 0) return "No active ply master records found.";

  const catMatches = activeMasters.filter(m => normalizeStr(m.ply_category) === normCat);
  if (catMatches.length === 0) return `Category "${row.plyCategory}" not found. Available: ${Array.from(new Set(activeMasters.map(m => m.ply_category))).join(', ')}`;

  const tMatches = catMatches.filter(m => t === normalizeNum(m.thickness_mm));
  if (tMatches.length === 0) return `Thickness ${t}mm not available. Options: ${Array.from(new Set(catMatches.map(m => normalizeNum(m.thickness_mm)))).join(', ')}`;

  return "No active rate found for today's date.";
};

export const getFoamMatchReason = (row: Partial<FoamRow>, masters: FoamMaster[]): string => {
  const normType = normalizeStr(row.foamType);
  const normSpec = normalizeStr(row.specification);
  if (!normType) return "Foam type is empty.";
  if (!normSpec) return "Specification is empty.";
  
  const activeMasters = masters;
  if (activeMasters.length === 0) return "No foam master records found.";

  const typeMatches = activeMasters.filter(m => normalizeStr(m.foam_type) === normType);
  if (typeMatches.length === 0) return `Foam type "${row.foamType}" not found. Available: ${Array.from(new Set(activeMasters.map(m => m.foam_type))).join(', ')}`;

  const specMatches = typeMatches.filter(m => normalizeStr(m.specification) === normSpec);
  if (specMatches.length === 0) return `Spec "${row.specification}" not found. Available for ${row.foamType}: ${Array.from(new Set(typeMatches.map(m => m.specification))).join(', ')}`;

  return "No active rate found for today's date.";
};

// ===================================================================
// ROW CALCULATION FUNCTIONS
// ===================================================================

export const calculateWoodRow = (row: WoodRow): WoodRow => {
  const unitGF = calculateGunFoot(row.length_ft || 0, row.width_in || 0, row.thickness_in || 0);
  const baseGF = unitGF * (row.quantity || 1);
  const wastageAmount = (baseGF * (row.wastage_percent || 7.5)) / 100;
  const totalGF = Number((baseGF + wastageAmount).toFixed(3));
  const totalCost = Number((totalGF * (row.rate_per_gf || 0)).toFixed(2));
  return { ...row, gun_foot: totalGF, total_cost: totalCost };
};

export const calculatePlyRow = (row: PlyRow): PlyRow => {
  const requiredSqft = Number(((row.cut_length_in * row.cut_width_in * row.quantity) / 144).toFixed(3));
  const materialCost = requiredSqft * (row.rate_per_sqft || 0);
  const wastageAmount = row.wastage_percent > 0 ? (materialCost * row.wastage_percent) / 100 : (row.wastage_amount || 0);
  const totalCost = Number((materialCost + wastageAmount).toFixed(2));
  
  return { 
    ...row, 
    sqft: requiredSqft, 
    wastage_amount: Number(wastageAmount.toFixed(2)),
    total_cost: totalCost 
  };
};

/**
 * FOAM ROW CALCULATION
 * ─────────────────────────────────────────────────────────────────────
 * master_rate = base rate from foam master (NOT thickness-specific)
 * Thickness is entered per-row.
 *
 * Formula:
 *   1. thickness_adjusted_sheet_value = master_rate × thickness_in
 *   2. foam_rate_per_sqft = thickness_adjusted_sheet_value / 18
 *      (standard foam sheet = 6 ft × 3 ft = 18 sq ft)
 *   3. required_foam_sqft = (cut_length_in × cut_width_in × qty) / 144
 *   4. foam_material_cost = required_foam_sqft × foam_rate_per_sqft
 *   5. foam_wastage = foam_material_cost × wastage_percent / 100
 *   6. final_foam_row_total = foam_material_cost + foam_wastage
 * ─────────────────────────────────────────────────────────────────────
 */
export const calculateFoamRow = (row: FoamRow): FoamRow => {
  const derivedRatePerSqft = (row.master_rate || 0) * (row.thickness_mm || 0);
  const requiredSqft = Number(((row.cut_length_in * row.cut_width_in * row.quantity) / 144).toFixed(3));
  const materialCost = requiredSqft * derivedRatePerSqft;
  const wastageAmount = row.wastage_percent > 0 ? (materialCost * row.wastage_percent) / 100 : (row.wastage_amount || 0);
  const totalCost = Number((materialCost + wastageAmount).toFixed(2));

  return { 
    ...row, 
    sqft: requiredSqft, 
    rate_per_sqft: Number(derivedRatePerSqft.toFixed(2)), 
    wastage_amount: Number(wastageAmount.toFixed(2)), 
    total_cost: totalCost 
  };
};

export const calculateFabricRow = (row: FabricRow): FabricRow => {
  const materialCost = (row.metersRequired || 0) * (row.ratePerMeter || 0);
  const wastageAmount = row.wastagePercent > 0 ? (materialCost * row.wastagePercent) / 100 : 0;
  const totalCost = Number((materialCost + wastageAmount).toFixed(2));
  return { ...row, totalCost };
};

// ===================================================================
// FINAL QUOTATION SUMMARY
// ===================================================================

export const calculateFinalQuotation = (
  woodRows: WoodRow[],
  plyRows: PlyRow[],
  foamRows: FoamRow[],
  fabricRows: FabricRow[] = [],
  labour: { carpenter: number; polish: number; foam: number },
  misc: { amount: number },
  factoryExpensePercent: number,
  markupPercent: number,
  gstPercent: number = 0,
  includeGST: boolean = true
): QuoteSummary => {
  const totalWood = woodRows.reduce((sum, r) => sum + r.total_cost, 0);
  const totalPly = plyRows.reduce((sum, r) => sum + r.total_cost, 0);
  const totalFoam = foamRows.reduce((sum, r) => sum + r.total_cost, 0);
  const totalFabric = fabricRows.reduce((sum, r) => sum + r.totalCost, 0);
  const totalMaterials = totalWood + totalPly + totalFoam + totalFabric;
  
  const totalLabour = (Number(labour.carpenter) || 0) + (Number(labour.polish) || 0) + (Number(labour.foam) || 0);
  const totalMisc = Number(misc.amount) || 0;
  
  const subtotal = totalMaterials + totalLabour + totalMisc;
  const factoryExpenseAmount = Number(((subtotal * factoryExpensePercent) / 100).toFixed(2));
  const totalInternalCost = Number((subtotal + factoryExpenseAmount).toFixed(2));
  
  // NET WASTAGE AGGREGATE
  const woodWastage = woodRows.reduce((sum, r) => sum + (r.gun_foot * (r.rate_per_gf || 0) * (r.wastage_percent || 0) / 100), 0);
  const plyWastage = plyRows.reduce((sum, r) => sum + (r.wastage_amount || 0), 0);
  const foamWastage = foamRows.reduce((sum, r) => sum + (r.wastage_amount || 0), 0);
  const fabricWastage = fabricRows.reduce((sum, r) => sum + ((r.metersRequired * r.ratePerMeter) * r.wastagePercent / 100), 0);
  const totalWastageAmount = Number((woodWastage + plyWastage + foamWastage + fabricWastage).toFixed(2));
  
  const markupAmount = Number(((totalInternalCost * markupPercent) / 100).toFixed(2));
  const baseAmount = Number((totalInternalCost + markupAmount).toFixed(2)); // Selling Price before tax
  
  const gstAmount = includeGST ? Number(((baseAmount * gstPercent) / 100).toFixed(2)) : 0;
  const grandTotal = Number((baseAmount + gstAmount).toFixed(2));

  const finalSellingPrice = baseAmount; // For backward compatibility in logic that expects FSP = base
  const grossProfitAmount = Number((finalSellingPrice - totalInternalCost).toFixed(2));
  const profitPercent = finalSellingPrice > 0 ? Number(((grossProfitAmount / finalSellingPrice) * 100).toFixed(2)) : 0;

  return {
    totalWood,
    totalPly,
    totalFoam,
    totalFabric,
    totalMaterials,
    totalLabour,
    totalMisc,
    totalInternalCost,
    totalWastageAmount,
    factoryExpensePercent,
    factoryExpenseAmount,
    markupPercent,
    finalSellingPrice,
    grossProfitAmount,
    profitPercent,
    baseAmount,
    gstAmount,
    includeGST,
    grandTotal
  };
};
