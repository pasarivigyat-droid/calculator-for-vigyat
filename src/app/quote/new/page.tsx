"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { 
  Plus, Trash2, Calculator, Save, ArrowRight, ArrowLeft,
  AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Beaker
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Quotation, CustomerType, WoodMaster, PlyMaster, FoamMaster, WoodRow, PlyRow, FoamRow } from "@/types";
import { 
  calculateGunFoot, calculatePlyRow, calculateFoamRow,
  calculateFinalQuotation, findWoodMaster, findPlyMaster, findFoamMaster,
  getWoodMatchReason, getPlyMatchReason, getFoamMatchReason
} from "@/lib/utils/calculations";
import { getWoodMasters, getPlyMasters, getFoamMasters, createQuotation } from "@/lib/firebase/services";
import { useRouter } from "next/navigation";
import { generateRefCode } from "@/lib/utils/formatters";
import { compressImage } from "@/lib/utils/image_compression";

const CUSTOMER_TYPES: CustomerType[] = [
  "Architect", "Interior Designer", "House Owner", "Showroom", "Third-party Supplier",
];

// =======================================================════════════
// SAMPLE CHAIR TEST DATA
// =======================================================════════════
const SAMPLE_CHAIR: Partial<Quotation> = {
  productName: "Sagwood Teak Arm Chair (TEST)",
  productCategory: "Chairs",
  customerName: "Test Customer",
  customerType: "House Owner",
  date: new Date().toISOString().split('T')[0],
  woodBreakdown: [
    { id: 'w1', componentName: 'Front Legs', woodType: 'Sagawood', length_ft: 1.75, width_in: 1.5, thickness_in: 1, quantity: 2, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false },
    { id: 'w2', componentName: 'Back Legs', woodType: 'Sagawood', length_ft: 2.5, width_in: 1.5, thickness_in: 1, quantity: 2, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false },
    { id: 'w3', componentName: 'Arm Rests', woodType: 'Babool', length_ft: 2.0, width_in: 1.5, thickness_in: 1, quantity: 2, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false },
  ],
  plyBreakdown: [
    { id: 'p1', componentName: 'Seat Base', plyCategory: 'plywood', thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 18, cut_width_in: 18, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 },
  ],
  foamBreakdown: [
    { id: 'f1', componentName: 'Seat Cushion', foamType: 'PU', specification: 'Standard', thickness_in: 2, cut_length_in: 18, cut_width_in: 18, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 },
  ],
  labour: { carpenter: 800, polish: 500, foam: 300, total: 0 },
  miscellaneous: { amount: 200, total: 0 },
  factoryExpensePercent: 30,
  markupPercent: 20,
};

// =======================================================════════════
// Debug panel component
// =======================================================════════════
function DebugView({ label, data, warnings }: { label: string; data: Record<string, string | number>; warnings?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] text-blue-500 font-bold uppercase">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {label}
        {warnings && warnings.length > 0 && <span className="ml-2 text-red-500">⚠ {warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>}
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          {warnings && warnings.length > 0 && (
            <div className="p-2 bg-red-50 rounded-lg border border-red-100">
              {warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {w}
                </p>
              ))}
            </div>
          )}
          <div className="p-2 bg-blue-50 rounded-lg text-[10px] font-mono text-blue-800 space-y-0.5">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                 <span className="text-blue-500">{k}:</span>
                 <span className="font-bold">{typeof v === 'number' ? v.toFixed(3) : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MissingRateBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold uppercase animate-pulse">
      <AlertTriangle className="w-3 h-3" /> No master rate
    </span>
  );
}

export default function NewQuotePage() {
  const [step, setStep] = useState(1);
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const router = useRouter();

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Quotation>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      woodBreakdown: [],
      plyBreakdown: [],
      foamBreakdown: [],
      factoryExpensePercent: 30,
      markupPercent: 20,
      gstPercent: 18,
      labour: { carpenter: 0, polish: 0, foam: 0, total: 0 },
      miscellaneous: { amount: 0, total: 0 }
    }
  });

  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({ control, name: "woodBreakdown" });
  const { fields: plyFields, append: appendPly, remove: removePly } = useFieldArray({ control, name: "plyBreakdown" });
  const { fields: foamFields, append: appendFoam, remove: removeFoam } = useFieldArray({ control, name: "foamBreakdown" });

  const watchedWood = useWatch({ control, name: "woodBreakdown" });
  const watchedPly = useWatch({ control, name: "plyBreakdown" });
  const watchedFoam = useWatch({ control, name: "foamBreakdown" });
  const watchedLabour = useWatch({ control, name: "labour" });
  const watchedMisc = useWatch({ control, name: "miscellaneous" });
  const watchedFactory = useWatch({ control, name: "factoryExpensePercent" });
  const watchedMarkup = useWatch({ control, name: "markupPercent" });
  const watchedGST = useWatch({ control, name: "gstPercent" });

  // --- UNIQUE VALUES FOR DROP-DOWNS ---
  const woodTypes = useMemo(() => {
    const defaults = ["Sagawood", "Babool"];
    const fromMasters = woodMasters.map(m => m.wood_type).filter(Boolean);
    const combined = [...defaults, ...fromMasters];
    const uniqueMap = new Map<string, string>();
    combined.forEach(t => {
      const lower = t.toLowerCase().trim();
      if (!uniqueMap.has(lower)) uniqueMap.set(lower, t.trim());
    });
    return Array.from(uniqueMap.values()).sort();
  }, [woodMasters]);

  const plyCategories = useMemo(() => {
    const fromMasters = plyMasters.map(m => m.ply_category).filter(Boolean);
    const uniqueMap = new Map<string, string>();
    fromMasters.forEach(c => {
      const lower = c.toLowerCase().trim();
      if (!uniqueMap.has(lower)) uniqueMap.set(lower, c.trim());
    });
    return Array.from(uniqueMap.values()).sort();
  }, [plyMasters]);

  const foamTypes = useMemo(() => {
    const fromMasters = foamMasters.map(m => m.foam_type).filter(Boolean);
    const uniqueMap = new Map<string, string>();
    fromMasters.forEach(t => {
      const lower = t.toLowerCase().trim();
      if (!uniqueMap.has(lower)) uniqueMap.set(lower, t.trim());
    });
    return Array.from(uniqueMap.values()).sort();
  }, [foamMasters]);

  const getFoamSpecs = (type: string) => {
    const fromMasters = foamMasters
      .filter(m => (m.foam_type || '').toLowerCase() === (type || '').toLowerCase())
      .map(m => m.specification)
      .filter(Boolean);
    const uniqueMap = new Map<string, string>();
    fromMasters.forEach(s => {
      const lower = s.toLowerCase().trim();
      if (!uniqueMap.has(lower)) uniqueMap.set(lower, s.trim());
    });
    return Array.from(uniqueMap.values()).sort();
  };

  // ── Load masters from Firestore ──
  useEffect(() => {
    async function init() {
      const [wm, pm, fm] = await Promise.all([getWoodMasters(), getPlyMasters(), getFoamMasters()]);
      setWoodMasters(wm);
      setPlyMasters(pm);
      setFoamMasters(fm);
      setMastersLoaded(true);
    }
    init();
  }, []);

  const loadSampleData = () => {
    reset(SAMPLE_CHAIR as Quotation);
  };

  // ══════════════════════════════════════════════════════════════
  // AUTO-RATE LOOKUP — runs whenever inputs or masters change
  // ══════════════════════════════════════════════════════════════

  // WOOD: auto-fill rate_per_gf
  useEffect(() => {
    if (!mastersLoaded) return;
    watchedWood?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      if (!row.woodType || !row.length_ft || !row.width_in || !row.thickness_in) return;
      const master = findWoodMaster(row.woodType, row.length_ft, row.width_in, row.thickness_in, woodMasters);
      const autoRate = master ? master.rate_per_gf : 0;
      if (autoRate !== row.rate_per_gf) {
        setValue(`woodBreakdown.${index}.rate_per_gf`, autoRate);
      }
    });
  }, [watchedWood, woodMasters, mastersLoaded, setValue]);

  // PLY: auto-fill rate_per_sqft
  useEffect(() => {
    if (!mastersLoaded) return;
    watchedPly?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      if (!row.plyCategory || !row.thickness_mm) return;
      const master = findPlyMaster(row.plyCategory, row.thickness_mm, plyMasters);
      const autoRate = master ? master.rate_per_sqft : 0;
      if (autoRate !== row.rate_per_sqft) {
        setValue(`plyBreakdown.${index}.rate_per_sqft`, autoRate);
      }
    });
  }, [watchedPly, plyMasters, mastersLoaded, setValue]);

  // FOAM: auto-fill master_rate (base_rate)
  useEffect(() => {
    if (!mastersLoaded) return;
    watchedFoam?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      if (!row.foamType || !row.specification) return;
      const master = findFoamMaster(row.foamType, row.specification, foamMasters);
      const baseRate = master ? master.base_rate : 0;
      if (baseRate !== row.master_rate) {
        setValue(`foamBreakdown.${index}.master_rate`, baseRate);
      }
    });
  }, [watchedFoam, foamMasters, mastersLoaded, setValue]);

  // ── Missing rates checker ──
  const missingRates = useMemo(() => {
    const issues: string[] = [];
    (watchedWood || []).forEach((row, i) => {
      if (!row.isRateOverridden && (!row.rate_per_gf || row.rate_per_gf <= 0) && row.woodType && row.woodType.trim()) {
        issues.push(`Wood row ${i + 1} "${row.componentName || 'Unnamed'}": ${getWoodMatchReason(row, woodMasters)}`);
      }
    });
    (watchedPly || []).forEach((row, i) => {
      if (!row.isRateOverridden && (!row.rate_per_sqft || row.rate_per_sqft <= 0) && row.plyCategory && row.plyCategory.trim()) {
        issues.push(`Ply row ${i + 1} "${row.componentName || 'Unnamed'}": ${getPlyMatchReason(row, plyMasters)}`);
      }
    });
    (watchedFoam || []).forEach((row, i) => {
      if (!row.isRateOverridden && (!row.master_rate || row.master_rate <= 0) && row.foamType && row.foamType.trim()) {
        issues.push(`Foam row ${i + 1} "${row.componentName || 'Unnamed'}": ${getFoamMatchReason(row, foamMasters)}`);
      }
    });
    return issues;
  }, [watchedWood, watchedPly, watchedFoam, woodMasters, plyMasters, foamMasters]);

  // ── Summary ──
  const summary = useMemo(() => {
    const woodRowsCalc = (watchedWood || []).map(row => {
      const gun_foot = calculateGunFoot(row.length_ft, row.width_in, row.thickness_in, row.quantity);
      return { ...row, gun_foot, total_cost: Number((gun_foot * (row.rate_per_gf || 0)).toFixed(2)) };
    }) as WoodRow[];
    const plyRowsCalc = (watchedPly || []).map(row => calculatePlyRow(row as PlyRow));
    const foamRowsCalc = (watchedFoam || []).map(row => calculateFoamRow(row as FoamRow));
    return calculateFinalQuotation(woodRowsCalc, plyRowsCalc, foamRowsCalc, [], watchedLabour, watchedMisc, watchedFactory, watchedMarkup, watchedGST || 18);
  }, [watchedWood, watchedPly, watchedFoam, watchedLabour, watchedMisc, watchedFactory, watchedMarkup, watchedGST]);

  // ── Save ──
  const onSubmit = async (data: Quotation) => {
    if (missingRates.length > 0) {
      alert("Cannot save: some rows have no master rate and are not manually overridden.\n\n" + missingRates.join("\n"));
      return;
    }
    try {
      const woodCalc = data.woodBreakdown.map(row => {
        const gun_foot = calculateGunFoot(row.length_ft, row.width_in, row.thickness_in, row.quantity);
        return {
          ...row,
          gun_foot,
          total_cost: Number((gun_foot * (row.rate_per_gf || 0)).toFixed(2))
        };
      });
      const plyCalc = data.plyBreakdown.map(row => calculatePlyRow(row));
      const foamCalc = data.foamBreakdown.map(row => calculateFoamRow(row));
      
      const finalData = {
        ...data,
        refCode: generateRefCode(),
        woodBreakdown: woodCalc,
        plyBreakdown: plyCalc,
        foamBreakdown: foamCalc,
        ...summary,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const id = await createQuotation(finalData as any);
      router.push(`/quote/edit/${id}`);
    } catch (err) {
      alert("Error saving quotation: " + (err as Error).message);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-[#2d221c] tracking-tight">Create Quotation</h1>
          <p className="text-gray-500 mt-1">Full costing calculator for one product</p>
          {mastersLoaded && (
            <p className="text-[10px] text-green-600 font-bold mt-1">
              ✓ Masters loaded: {woodMasters.length} wood, {plyMasters.length} ply, {foamMasters.length} foam
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" type="button" onClick={loadSampleData} className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5">
            <Beaker className="w-4 h-4" /> Load Test Chair
          </Button>
          <div className="w-px h-6 bg-gray-200" />
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                 {s}
               </div>
               {s < 3 && <div className={`w-8 h-0.5 bg-gray-100 ${step > s ? 'bg-amber-200' : ''}`} />}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ========== STEP 1: Header Details ========== */}
        {step === 1 && (
          <Card title="1. Header Details" subtitle="Customer and product classification">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <Input label="Category" placeholder="e.g. Chairs" required {...register("productCategory", { required: true })} />
              <Input label="Customer Name" placeholder="Full name" required {...register("customerName", { required: true })} />
              <Select label="Customer Type" options={CUSTOMER_TYPES.map(t => ({ label: t, value: t }))} required {...register("customerType")} />
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Product Reference Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                    {watch("productImage") ? (
                      <img src={watch("productImage")} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="image-upload" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const originalDataUrl = reader.result as string;
                          try {
                            const compressed = await compressImage(originalDataUrl, 800, 0.7);
                            setValue("productImage", compressed);
                          } catch (err) {
                            console.error("Compression failed", err);
                            setValue("productImage", originalDataUrl); // fallback
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label htmlFor="image-upload" className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50">
                    Upload Image
                  </label>
                  {watch("productImage") && (
                    <button type="button" onClick={() => setValue("productImage", undefined)} className="text-[10px] text-red-500 font-bold uppercase underline">Remove</button>
                  )}
                </div>
              </div>

              <Input label="Date" type="date" {...register("date")} />
            </div>
            <div className="mt-8 flex justify-end">
              <Button type="button" onClick={() => setStep(2)}>Next: Material Breakdown <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </Card>
        )}

        {/* ========== STEP 2: Material Breakdown ========== */}
        {step === 2 && (
          <div className="space-y-8">
            {/* ─── WOOD ─── */}
            <Card title="2A. Wood Costing" subtitle="Rate auto-fetched from wood masters. Enter type + dimensions + qty.">
              <div className="space-y-4">
                <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                   <div className="col-span-2">Component</div>
                   <div className="col-span-2">Wood Type</div>
                   <div>L (ft)</div><div>W (in)</div><div>T (in)</div>
                   <div className="text-center">Qty</div>
                   <div className="col-span-2">Rate/GF (auto)</div>
                   <div className="col-span-2 text-right">Total</div>
                </div>
                
                {woodFields.map((field, index) => {
                  const row = watchedWood?.[index];
                  const gf = row ? calculateGunFoot(row.length_ft, row.width_in, row.thickness_in, row.quantity) : 0;
                  const rate = row?.rate_per_gf || 0;
                  const wCost = gf * rate;
                  const hasRate = row?.isRateOverridden || rate > 0;
                  const matchedMaster = row && !row.isRateOverridden ? findWoodMaster(row.woodType || '', row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters) : null;

                  const warnings: string[] = [];
                  if (!hasRate && row?.woodType && row.woodType.trim()) warnings.push(getWoodMatchReason(row, woodMasters));

                  return (
                    <div key={field.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${!hasRate && row?.woodType ? 'bg-red-50/30 border-red-200' : row?.isRateOverridden ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                      <div className="col-span-2"><Input label="Component Name" placeholder="e.g. Front Legs" {...register(`woodBreakdown.${index}.componentName`)} /></div>
                      <div className="col-span-2">
                        <Select 
                          label="Wood Type"
                          options={woodTypes.map(t => ({ label: t, value: t }))} 
                          {...register(`woodBreakdown.${index}.woodType`)} 
                        />
                      </div>
                      <div><Input label="Length (ft)" type="number" step="0.01" {...register(`woodBreakdown.${index}.length_ft`, { valueAsNumber: true })} /></div>
                      <div><Input label="Width (in)" type="number" step="0.01" {...register(`woodBreakdown.${index}.width_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="Thickness (in)" type="number" step="0.01" {...register(`woodBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="Qty" type="number" {...register(`woodBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                      <div className="col-span-2 relative">
                         <Input label="Rate/GF" type="number" step="0.01" readOnly={!row?.isRateOverridden} {...register(`woodBreakdown.${index}.rate_per_gf`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />
                         <button type="button" onClick={() => setValue(`woodBreakdown.${index}.isRateOverridden`, !watch(`woodBreakdown.${index}.isRateOverridden`))} className={`absolute right-2 top-11 p-1 rounded text-[9px] ${watch(`woodBreakdown.${index}.isRateOverridden`) ? "text-amber-600 font-bold" : "text-gray-300"}`} title="Toggle manual override">
                            <AlertCircle className="w-3 h-3" />
                         </button>
                      </div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                         {!hasRate && row?.woodType && row.woodType.trim() && <MissingRateBadge />}
                         <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{gf.toFixed(3)} GF</p>
                            <p className="text-sm font-bold text-[#2d221c]">₹{wCost.toFixed(2)}</p>
                         </div>
                         <button type="button" onClick={() => removeWood(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="col-span-12">
                        <DebugView label="Calculation Details" warnings={warnings} data={{
                          "Formula": "GunFoot × Rate/GF",
                          "Gun Foot": gf,
                          "Rate/GF (₹)": rate,
                          "Row Total (₹)": wCost,
                          "Matched Master": matchedMaster ? `${matchedMaster.wood_type} (${matchedMaster.length_from_ft}-${matchedMaster.length_to_ft}ft, W:${matchedMaster.width_in}, T:${matchedMaster.thickness_in})` : "NONE",
                          "Override": row?.isRateOverridden ? "YES" : "NO"
                        }} />
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" type="button" onClick={() => appendWood({ componentName: '', woodType: woodTypes[0] || '', length_ft: 0, width_in: 0, thickness_in: 0, quantity: 1, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false } as any)} className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Add Wood Component
                </Button>
              </div>
            </Card>

            {/* ─── PLY ─── */}
            <Card title="2B. Plywood Costing" subtitle="Rate auto-fetched from ply masters. Enter category + thickness + cut size + qty + wastage%.">
              <div className="space-y-4">
                <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                   <div className="col-span-2">Component</div>
                   <div>Category</div><div>T (mm)</div>
                   <div>CutL (in)</div><div>CutW (in)</div><div>Qty</div>
                   <div>Rate/SqFt</div><div>Wastage%</div><div>SqFt</div>
                   <div className="col-span-2 text-right">Total</div>
                </div>
                {plyFields.map((field, index) => {
                  const plyRow = watchedPly?.[index] as PlyRow | undefined;
                  const calc = plyRow ? calculatePlyRow(plyRow) : null;
                  const hasRate = plyRow?.isRateOverridden || (plyRow?.rate_per_sqft && plyRow.rate_per_sqft > 0);
                  const matchedMaster = plyRow && !plyRow.isRateOverridden ? findPlyMaster(plyRow.plyCategory || '', plyRow.thickness_mm || 0, plyMasters) : null;

                  const warnings: string[] = [];
                  if (!hasRate && plyRow?.plyCategory && plyRow.plyCategory.trim()) warnings.push(getPlyMatchReason(plyRow, plyMasters));

                  return (
                    <div key={field.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${!hasRate && plyRow?.plyCategory ? 'bg-red-50/30 border-red-200' : plyRow?.isRateOverridden ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                      <div className="col-span-2"><Input label="Component" placeholder="Seat Base" {...register(`plyBreakdown.${index}.componentName`)} /></div>
                      <div>
                        <Select 
                          label="Category"
                          options={plyCategories.map(c => ({ label: c, value: c }))} 
                          {...register(`plyBreakdown.${index}.plyCategory`)} 
                        />
                      </div>
                      <div><Input label="T (mm)" type="number" placeholder="18" {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                      <div><Input label="L (in)" type="number" step="0.01" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="W (in)" type="number" step="0.01" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="Qty" type="number" {...register(`plyBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                      <div className="relative">
                         <Input label="Rate/SqFt" type="number" step="0.01" readOnly={!plyRow?.isRateOverridden} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} className={plyRow?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />
                         <button type="button" onClick={() => setValue(`plyBreakdown.${index}.isRateOverridden`, !watch(`plyBreakdown.${index}.isRateOverridden`))} className={`absolute right-1 top-11 p-0.5 rounded ${watch(`plyBreakdown.${index}.isRateOverridden`) ? "text-amber-600" : "text-gray-300"}`} title="Toggle override">
                            <AlertCircle className="w-3 h-3" />
                         </button>
                      </div>
                      <div><Input label="Wastage%" type="number" step="0.1" placeholder="5" {...register(`plyBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                      <div className="flex flex-col items-center justify-center pt-2">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block lg:hidden">SqFt</span>
                         <span className="text-xs font-mono text-gray-600">{calc?.sqft?.toFixed(2) || '0'}</span>
                      </div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-3">
                         {!hasRate && plyRow?.plyCategory && plyRow.plyCategory.trim() && <MissingRateBadge />}
                         <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(2) || '0.00'}</p>
                         <button type="button" onClick={() => removePly(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="col-span-12">
                        <DebugView label="Ply Calculation" warnings={warnings} data={{
                          "Formula": "sqft × rate_per_sqft + wastage",
                          "Required SqFt": calc?.sqft || 0,
                          "Rate/SqFt (₹)": plyRow?.rate_per_sqft || 0,
                          "Material Cost (₹)": (calc?.sqft || 0) * (plyRow?.rate_per_sqft || 0),
                          "Wastage %": plyRow?.wastage_percent || 0,
                          "Wastage Amt (₹)": calc?.wastage_amount || 0,
                          "Final Total (₹)": calc?.total_cost || 0,
                          "Matched Master": matchedMaster ? `${matchedMaster.ply_category} ${matchedMaster.thickness_mm}mm` : "NONE",
                          "Override": plyRow?.isRateOverridden ? "YES" : "NO"
                        }} />
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" type="button" onClick={() => appendPly({ componentName: '', plyCategory: plyCategories[0] || 'plywood', thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 } as any)} className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Add Plywood Component
                </Button>
              </div>
            </Card>

            {/* ─── FOAM ─── */}
            <Card title="2C. Foam Costing" subtitle="Base rate auto-fetched from foam masters. Thickness × base_rate / 18 = rate/sqft.">
              <div className="space-y-4">
                <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                   <div className="col-span-2">Component</div>
                   <div>Foam Type</div><div>Spec</div><div>T (in)</div>
                   <div>CutL (in)</div><div>CutW (in)</div><div>Qty</div>
                   <div>Base Rate</div><div>Wastage%</div>
                   <div className="col-span-2 text-right">Total</div>
                </div>
                {foamFields.map((field, index) => {
                  const foamRow = watchedFoam?.[index] as FoamRow | undefined;
                  const calc = foamRow ? calculateFoamRow(foamRow) : null;
                  const baseRate = foamRow?.master_rate || 0;
                  const adjustedSheet = baseRate * (foamRow?.thickness_in || 0);
                  const derivedPerSqft = adjustedSheet > 0 ? adjustedSheet / 18 : 0;
                  const hasRate = foamRow?.isRateOverridden || baseRate > 0;
                  const matchedMaster = foamRow && !foamRow.isRateOverridden ? findFoamMaster(foamRow.foamType || '', foamRow.specification || '', foamMasters) : null;

                  const warnings: string[] = [];
                  if (!hasRate && foamRow?.foamType && foamRow.foamType.trim()) warnings.push(getFoamMatchReason(foamRow, foamMasters));

                  return (
                    <div key={field.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${!hasRate && foamRow?.foamType ? 'bg-red-50/30 border-red-200' : foamRow?.isRateOverridden ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                      <div className="col-span-2"><Input label="Component" placeholder="Seat Cushion" {...register(`foamBreakdown.${index}.componentName`)} /></div>
                      <div>
                        <Select 
                          label="Foam Type"
                          options={foamTypes.map(t => ({ label: t, value: t }))} 
                          {...register(`foamBreakdown.${index}.foamType`)} 
                        />
                      </div>
                      <div>
                        <Select 
                          label="Spec"
                          options={getFoamSpecs(foamRow?.foamType || '').map(s => ({ label: s, value: s }))} 
                          {...register(`foamBreakdown.${index}.specification`)} 
                        />
                      </div>
                      <div><Input label="T (in)" type="number" step="0.5" {...register(`foamBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="L (in)" type="number" step="0.01" {...register(`foamBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="W (in)" type="number" step="0.01" {...register(`foamBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                      <div><Input label="Qty" type="number" {...register(`foamBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                      <div className="relative">
                         <Input label="Base Rate" type="number" step="0.01" readOnly={!foamRow?.isRateOverridden} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} className={foamRow?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />
                         <button type="button" onClick={() => setValue(`foamBreakdown.${index}.isRateOverridden`, !watch(`foamBreakdown.${index}.isRateOverridden`))} className={`absolute right-1 top-11 p-0.5 rounded ${watch(`foamBreakdown.${index}.isRateOverridden`) ? "text-amber-600" : "text-gray-300"}`} title="Toggle override">
                            <AlertCircle className="w-3 h-3" />
                         </button>
                      </div>
                      <div><Input label="Wastage%" type="number" step="0.1" placeholder="5" {...register(`foamBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                         {!hasRate && foamRow?.foamType && foamRow.foamType.trim() && <MissingRateBadge />}
                         <div>
                           <p className="text-[10px] text-gray-400 font-bold">{calc?.sqft?.toFixed(2) || '0'} sqft · ₹{derivedPerSqft.toFixed(2)}/sqft</p>
                           <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(2) || '0.00'}</p>
                         </div>
                         <button type="button" onClick={() => removeFoam(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="col-span-12">
                        <DebugView label="Foam Calculation" warnings={warnings} data={{
                          "Formula": "((baseRate × thickness) / 18) × sqft + wastage",
                          "Base Rate (₹)": baseRate,
                          "Thickness (in)": foamRow?.thickness_in || 0,
                          "Adjusted Sheet (₹)": adjustedSheet,
                          "Derived ₹/sqft": derivedPerSqft,
                          "Required SqFt": calc?.sqft || 0,
                          "Material Cost (₹)": (calc?.sqft || 0) * derivedPerSqft,
                          "Wastage %": foamRow?.wastage_percent || 0,
                          "Wastage Amt (₹)": calc?.wastage_amount || 0,
                          "Final Total (₹)": calc?.total_cost || 0,
                          "Matched Master": matchedMaster ? `${matchedMaster.foam_type} / ${matchedMaster.specification}` : "NONE",
                          "Override": foamRow?.isRateOverridden ? "YES" : "NO"
                        }} />
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" type="button" onClick={() => appendFoam({ componentName: '', foamType: foamTypes[0] || 'PU', specification: getFoamSpecs(foamTypes[0] || '')[0] || 'Standard', thickness_in: 2, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 } as any)} className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Add Foam Component
                </Button>
              </div>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" type="button" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button type="button" onClick={() => setStep(3)}>Next: Pricing & Summary <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: Summary ========== */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             <div className="lg:col-span-2 space-y-8">
                <Card title="Labour & Finishing" subtitle="Manual override available for all labour types">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input label="Carpenter Labour (₹)" type="number" step="50" {...register("labour.carpenter", { valueAsNumber: true })} />
                      <Input label="Polish Labour (₹)" type="number" step="50" {...register("labour.polish", { valueAsNumber: true })} />
                      <Input label="Foam/Stitch Labour (₹)" type="number" step="50" {...register("labour.foam", { valueAsNumber: true })} />
                      <Input label="Miscellaneous Amount (₹)" type="number" {...register("miscellaneous.amount", { valueAsNumber: true })} />
                   </div>
                </Card>

                <Card title="Overhead & Margin" subtitle="Markup applied on top of internal cost">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select 
                        label="Factory Expense (%)" 
                        options={[{label:'30%', value:30}, {label:'35%', value:35}, {label:'40%', value:40}]} 
                        {...register("factoryExpensePercent", { valueAsNumber: true })}
                      />
                      <Input label="Profit Markup (%)" type="number" min="0" max="40" {...register("markupPercent", { valueAsNumber: true })} />
                      <Input label="GST (%)" type="number" min="0" max="28" {...register("gstPercent", { valueAsNumber: true })} />
                   </div>
                </Card>

                {missingRates.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                     <p className="text-xs font-bold text-red-800 uppercase flex items-center gap-1 mb-2"><AlertTriangle className="w-4 h-4" /> Save Blocked — Missing Rates</p>
                     <ul className="text-[11px] text-red-700 space-y-1 list-disc list-inside">
                        {missingRates.map((msg, i) => <li key={i}>{msg}</li>)}
                     </ul>
                     <p className="text-[10px] text-red-600 mt-2">Go back and check master data or toggle ⚠ override on affected rows.</p>
                  </div>
                )}
             </div>

             <div className="relative lg:sticky lg:top-24 bg-[#2d221c] text-white p-6 md:p-8 rounded-3xl shadow-2xl shadow-amber-900/20 ring-1 ring-white/10">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                   <Calculator className="w-6 h-6 text-amber-500" /> Cost Summary
                </h3>
                <div className="space-y-3 mb-8">
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Wood Cost</span><span className="text-white font-mono">₹{summary.totalWood.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Plywood Cost</span><span className="text-white font-mono">₹{summary.totalPly.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Foam Cost</span><span className="text-white font-mono">₹{summary.totalFoam.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/40 text-xs pt-2 border-t border-white/5"><span>Raw Materials</span><span className="text-amber-200 font-mono">₹{summary.totalMaterials.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Total Labour</span><span className="text-white font-mono">₹{summary.totalLabour.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Miscellaneous</span><span className="text-white font-mono">₹{summary.totalMisc.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Factory Expense ({watchedFactory}%)</span><span className="text-white font-mono">₹{summary.factoryExpenseAmount.toFixed(2)}</span></div>
                   <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                      <span className="text-amber-500 font-bold">INTERNAL COST</span>
                      <span className="text-2xl font-bold font-mono">₹{summary.totalInternalCost.toFixed(2)}</span>
                   </div>
                </div>
                <div className="space-y-4 pt-6 border-t border-white/10">
                   <div className="p-4 bg-white/5 rounded-2xl">
                      <p className="text-[10px] text-amber-100/40 uppercase font-bold tracking-[0.2em] mb-2">Base Amount</p>
                      <p className="text-2xl font-bold text-white mb-2">₹{summary.baseAmount.toFixed(2)}</p>
                      <div className="flex justify-between text-[10px] text-amber-100/40 font-bold border-t border-white/5 pt-2">
                         <span>GST ({watchedGST || 18}%)</span>
                         <span>₹{summary.gstAmount.toFixed(2)}</span>
                      </div>
                   </div>
                   <div className="p-4 bg-amber-600/10 rounded-2xl border border-amber-600/20">
                      <p className="text-[10px] text-amber-500 uppercase font-bold tracking-[0.2em] mb-1">Grand Total</p>
                      <p className="text-4xl font-black text-white">₹{summary.grandTotal.toFixed(2)}</p>
                   </div>
                   <div className="flex justify-between items-center text-sm pt-2">
                      <div className="text-green-400 font-bold">
                         <span className="text-[10px] text-white/40 block mb-0.5">EST. PROFIT</span>
                         ₹{summary.grossProfitAmount.toFixed(2)}
                      </div>
                      <div className="text-right text-green-400 font-bold">
                         <span className="text-[10px] text-white/40 block mb-0.5">MARGIN (%)</span>
                         {summary.profitPercent}%
                      </div>
                   </div>
                </div>
                <Button className="w-full mt-10 h-14 bg-amber-600 hover:bg-amber-700 text-lg border-none shadow-xl disabled:opacity-40 disabled:cursor-not-allowed" type="submit" disabled={missingRates.length > 0}>
                   <Save className="w-5 h-5 mr-2" /> Save Quotation
                </Button>
                {missingRates.length > 0 && <p className="text-center text-[10px] text-red-400 mt-2 font-bold">⚠ Fix missing rates before saving</p>}
                <Button variant="ghost" onClick={() => setStep(2)} className="w-full mt-2 text-white/40 hover:text-white" type="button">
                   <ArrowLeft className="w-4 h-4 mr-2" /> Back to components
                </Button>
             </div>
          </div>
        )}
      </form>
      
      {/* Mobile Sticky Summary Footer */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[#2d221c] text-white p-4 z-40 border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest opacity-70">Total Selling Price</p>
            <p className="text-xl font-black text-amber-50">₹{(summary.finalSellingPrice || 0).toLocaleString(undefined, {maximumFractionDigits:0})}</p>
          </div>
          <div className="text-right flex items-center gap-3">
             <div className="pr-2 border-r border-white/10">
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest opacity-70">Profit</p>
                <p className="text-sm font-bold text-green-400">{summary.profitPercent || 0}%</p>
             </div>
             {step < 3 ? (
               <Button type="button" size="sm" onClick={() => setStep(step + 1)} className="bg-amber-600 h-10 px-4">
                 Next <ArrowRight className="w-4 h-4 ml-1" />
               </Button>
             ) : (
               <Button type="button" size="sm" onClick={() => handleSubmit(onSubmit)()} disabled={missingRates.length > 0} className="bg-amber-600 h-10 px-4">
                 Save
               </Button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
