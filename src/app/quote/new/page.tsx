"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Calculator, 
  AlertTriangle,
  AlertCircle,
  Package,
  Wood,
  Layers,
  Wind
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Quotation, WoodMaster, PlyMaster, FoamMaster, WoodRow, PlyRow, FoamRow, CustomerType, FabricRow, FabricMaster } from "@/types";
import { getWoodMasters, getPlyMasters, getFoamMasters, createQuotation } from "@/lib/firebase/services";
import { useRouter } from "next/navigation";
import { generateRefCode } from "@/lib/utils/formatters";
import { compressImage } from "@/lib/utils/image_compression";

const CUSTOMER_TYPES: CustomerType[] = [
  "Architect", "Interior Designer", "House Owner", "Showroom", "Third-party Supplier",
  "Furniture Manufacturer", "Real Estate Developer", "Hospitality Group", "Retail Client", "Other"
];

// Calculation Helpers
import { 
  calculateGunFoot, 
  calculateWoodRow, 
  calculatePlyRow, 
  calculateFoamRow, 
  calculateFinalQuotation,
  findWoodMaster,
  findPlyMaster,
  getWoodMatchReason,
  getPlyMatchReason,
  findFoamMaster,
  getFoamMatchReason
} from "@/lib/utils/calculations";

/**
 * DEBUG VIEW COMPONENT
 * Shows raw matched values and formulas.
 */
function DebugView({ label, data, warnings }: { label: string, data: any, warnings?: string[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <button 
        type="button" 
        onClick={() => setShow(!show)} 
        className="text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-amber-600 flex items-center gap-1"
      >
        {show ? "Hide Diagnostics" : "Show Diagnostics"} {warnings && warnings.length > 0 && <span className="text-red-500">({warnings.length} issues)</span>}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-slate-900 rounded-lg font-mono text-[10px] text-amber-200 overflow-x-auto border-l-4 border-amber-500">
          <p className="text-white font-bold mb-2 uppercase tracking-widest opacity-50 border-b border-white/10 pb-1">{label}</p>
          {warnings && warnings.map((w,i) => <p key={i} className="text-red-400 mb-1">⚠ {w}</p>)}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(data).map(([k,v]) => (
              <React.Fragment key={k}>
                <span className="text-white/40">{k}:</span>
                <span className="text-right">{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
              </React.Fragment>
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
  const [activeTab, setActiveTab] = useState<'wood' | 'ply' | 'foam' | 'fabric'>('wood');
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
      fabricBreakdown: [],
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
  const { fields: fabricFields, append: appendFabric, remove: removeFabric } = useFieldArray({ control, name: "fabricBreakdown" });

  useEffect(() => {
    const loadMasters = async () => {
      const [w, p, f] = await Promise.all([getWoodMasters(), getPlyMasters(), getFoamMasters()]);
      setWoodMasters(w);
      setPlyMasters(p);
      setFoamMasters(f);
      setMastersLoaded(true);
    };
    loadMasters();
  }, []);

  const watchedWood = watch("woodBreakdown");
  const watchedPly = watch("plyBreakdown");
  const watchedFoam = watch("foamBreakdown");
  const watchedFabric = watch("fabricBreakdown");
  const watchedLabour = watch("labour");
  const watchedMisc = watch("miscellaneous");
  const watchedFactory = watch("factoryExpensePercent");
  const watchedMarkup = watch("markupPercent");
  const watchedGST = watch("gstPercent");

  // Material Data Lists
  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  // Auto-rate lookup for Wood
  useEffect(() => {
    watchedWood?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findWoodMaster(row.woodType, row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters);
      if (match) {
        setValue(`woodBreakdown.${index}.rate_per_gf`, match.rate_per_gf);
      } else {
        setValue(`woodBreakdown.${index}.rate_per_gf`, 0);
      }
    });
  }, [watchedWood, woodMasters, setValue]);

  // Auto-rate lookup for Ply
  useEffect(() => {
    watchedPly?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findPlyMaster(row.plyCategory, row.thickness_mm || 0, plyMasters);
      if (match) {
        setValue(`plyBreakdown.${index}.rate_per_sqft`, match.rate_per_sqft);
      } else {
        setValue(`plyBreakdown.${index}.rate_per_sqft`, 0);
      }
    });
  }, [watchedPly, plyMasters, setValue]);

  // Auto-rate lookup for Foam
  useEffect(() => {
    watchedFoam?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findFoamMaster(row.foamType, row.specification, foamMasters);
      if (match) {
        setValue(`foamBreakdown.${index}.master_rate`, match.base_rate);
      } else {
        setValue(`foamBreakdown.${index}.master_rate`, 0);
      }
    });
  }, [watchedFoam, foamMasters, setValue]);

  // Summary Calculations
  const summary = useMemo(() => {
    const woodCalc = watchedWood?.map(r => calculateWoodRow(r)) || [];
    const plyCalc = watchedPly?.map(r => calculatePlyRow(r)) || [];
    const foamCalc = watchedFoam?.map(r => calculateFoamRow(r)) || [];
    const fabricCalc = (watchedFabric || []).map(r => {
       const cost = (r.metersRequired || 0) * (r.ratePerMeter || 0);
       const withWastage = cost + (cost * (r.wastagePercent || 0) / 100);
       return { ...r, totalCost: withWastage };
    });

    return calculateFinalQuotation(
      woodCalc,
      plyCalc,
      foamCalc,
      fabricCalc as any,
      { carpenter: watchedLabour?.carpenter || 0, polish: watchedLabour?.polish || 0, foam: watchedLabour?.foam || 0 },
      { amount: watchedMisc?.amount || 0 },
      watchedFactory || 0,
      watchedMarkup || 0,
      watchedGST || 0
    );
  }, [watchedWood, watchedPly, watchedFoam, watchedFabric, watchedLabour, watchedMisc, watchedFactory, watchedMarkup, watchedGST]);

  // Save Block Check
  const missingRates = useMemo(() => {
    const issues: string[] = [];
    watchedWood?.forEach((r, i) => {
      if (!r.isRateOverridden && r.rate_per_gf === 0 && r.woodType) issues.push(`Wood #${i+1}: Missing rate for ${r.woodType}`);
    });
    watchedPly?.forEach((r, i) => {
      if (!r.isRateOverridden && r.rate_per_sqft === 0 && r.plyCategory) issues.push(`Ply #${i+1}: Missing rate for ${r.plyCategory}`);
    });
    watchedFoam?.forEach((r, i) => {
      if (!r.isRateOverridden && r.master_rate === 0 && r.foamType) issues.push(`Foam #${i+1}: Missing rate for ${r.foamType}`);
    });
    return issues;
  }, [watchedWood, watchedPly, watchedFoam]);

  const onSubmit = async (data: Quotation) => {
    if (missingRates.length > 0) {
      alert("Cannot save. Please fix or override missing rates.");
      return;
    }

    try {
      const woodCalc = data.woodBreakdown.map(r => calculateWoodRow(r));
      const plyCalc = data.plyBreakdown.map(r => calculatePlyRow(r));
      const foamCalc = data.foamBreakdown.map(r => calculateFoamRow(r));
      
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
      router.push(`/quote/view/${id}?download=true`);
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                  step === s ? "bg-amber-600 text-white ring-4 ring-amber-100" : 
                  step > s ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ========== STEP 1: Basic Info ========== */}
        {step === 1 && (
          <Card title="Quotation Basic Info" subtitle="Enter client details and product overview.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Input 
                  label="Customer Name" 
                  placeholder="Enter Name"
                  {...register("customerName", { required: "Customer name is required" })} 
                  error={errors.customerName?.message}
                />
                <Select 
                  label="Customer Type"
                  options={CUSTOMER_TYPES.map(t => ({ label: t, value: t }))} 
                  {...register("customerType")} 
                />
                <Input 
                  label="Product Category" 
                  placeholder="e.g. Sofa, Dining Chair"
                  {...register("productCategory", { required: "Category is required" })} 
                  error={errors.productCategory?.message}
                />
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-[#2d221c] mb-2">Product Reference Image</p>
                  <div className="flex items-center gap-4">
                    {watch("productImage") && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center p-1">
                        <img src={watch("productImage")} className="max-w-full max-h-full object-contain" alt="Preview" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="image-upload" 
                      className="hidden" 
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
            </div>
            <div className="mt-8 flex justify-end">
              <Button type="button" onClick={() => setStep(2)}>Next: Material Breakdown <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </Card>
        )}

        {/* ========== STEP 2: Material Breakdown ========== */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <h1 className="text-2xl font-bold text-[#2d221c] tracking-tight">Material Breakdown</h1>
                  <p className="text-sm text-gray-500">Add following components for accurate costing</p>
               </div>
               <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-none">Live Costing</span>
               </div>
            </div>

            {/* Tab Selector */}
            <div className="flex p-1 bg-gray-100 rounded-xl overflow-x-auto no-scrollbar gap-1">
              {[
                { id: 'wood', label: 'Wood', count: woodFields.length, Icon: Wood },
                { id: 'ply', label: 'Ply', count: plyFields.length, Icon: Layers },
                { id: 'foam', label: 'Foam', count: foamFields.length, Icon: Wind },
                { id: 'fabric', label: 'Fabric', count: fabricFields.length, Icon: Package }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 min-w-[90px] py-3 px-4 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap uppercase tracking-tighter ${
                    activeTab === tab.id 
                      ? "bg-white text-amber-700 shadow-sm ring-1 ring-black/5" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  }`}
                >
                  <tab.Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-amber-600' : 'text-gray-400'}`} />
                  {tab.label}
                  {tab.count > 0 && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[9px] font-black">{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* ─── WOOD ─── */}
            {activeTab === 'wood' && (
              <Card title="Wood Components" subtitle="Enter solid wood details and dimensions.">
                <div className="space-y-4">
                  <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                    <div className="col-span-2">Component</div>
                    <div className="col-span-2">Wood Type</div>
                    <div>L (ft)</div><div>W (in)</div><div>T (in)</div>
                    <div className="text-center">Qty</div>
                    <div className="col-span-2">Rate/GF</div>
                    <div className="col-span-2 text-right text-amber-900 pr-4">Total</div>
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
                  <Button variant="outline" type="button" onClick={() => appendWood({ id: `w_${Date.now()}`, componentName: '', woodType: (woodTypes[0] || ''), length_ft: 0, width_in: 0, thickness_in: 0, quantity: 1, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false })} className="w-full border-dashed py-6 gap-2 text-amber-700 hover:bg-amber-50 bg-white">
                    <Plus className="w-4 h-4" /> Add Wood Component
                  </Button>
                </div>
              </Card>
            )}

            {/* ─── PLYWOOD ─── */}
            {activeTab === 'ply' && (
              <Card title="Plywood Components" subtitle="Enter plywood details and cut dimensions.">
                <div className="space-y-4">
                  <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                     <div className="col-span-2">Component</div>
                     <div>Category</div><div>T (mm)</div>
                     <div>CutL (in)</div><div>CutW (in)</div><div>Qty</div>
                     <div>Rate/SqFt</div><div>Wastage%</div><div>SqFt</div>
                     <div className="col-span-2 text-right pr-4 text-blue-900">Total</div>
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
                        <div className="flex flex-col items-center justify-center pt-2 lg:pt-0">
                           <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block lg:hidden">SqFt Area</span>
                           <span className="text-xs font-mono text-gray-600">{calc?.sqft?.toFixed(2) || '0'}</span>
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                           {!hasRate && plyRow?.plyCategory && plyRow.plyCategory.trim() && <MissingRateBadge />}
                           <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(2) || '0'}</p>
                           <button type="button" onClick={() => removePly(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="outline" type="button" onClick={() => appendPly({ id: `p_${Date.now()}`, componentName: '', plyCategory: (plyCategories[0] || 'plywood'), thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 })} className="w-full border-dashed py-6 gap-2 text-blue-700 hover:bg-blue-50 bg-white">
                    <Plus className="w-4 h-4" /> Add Plywood Component
                  </Button>
                </div>
              </Card>
            )}

            {/* ─── FOAM ─── */}
            {activeTab === 'foam' && (
              <Card title="Foam Components" subtitle="Enter foam details and required thickness.">
                <div className="space-y-4">
                  <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                     <div className="col-span-2">Component</div>
                     <div>Type</div><div>Spec</div><div>T (in)</div>
                     <div>CutL</div><div>CutW</div><div>Qty</div>
                     <div>BaseRate</div><div>Wastage%</div>
                     <div className="col-span-2 text-right pr-4 text-orange-900">Total</div>
                  </div>
                  {foamFields.map((field, index) => {
                    const foamRow = watchedFoam?.[index] as FoamRow | undefined;
                    const calc = foamRow ? calculateFoamRow(foamRow) : null;
                    const hasRate = foamRow?.isRateOverridden || (foamRow?.master_rate && foamRow.master_rate > 0);
                    const derivedPerSqft = (foamRow?.master_rate || 0) * (foamRow?.thickness_in || 0) / 18;
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
                           <div className="text-right">
                             <p className="text-[10px] text-gray-400 font-bold tracking-tight">{calc?.sqft?.toFixed(2) || '0'} sqft · ₹{derivedPerSqft.toFixed(1)}/sqft</p>
                             <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(2) || '0'}</p>
                           </div>
                           <button type="button" onClick={() => removeFoam(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="outline" type="button" onClick={() => appendFoam({ id: `f_${Date.now()}`, componentName: '', foamType: (foamTypes[0] || 'PU'), specification: 'Standard', thickness_in: 0, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 })} className="w-full border-dashed py-6 gap-2 text-orange-700 hover:bg-orange-50 bg-white">
                    <Plus className="w-4 h-4" /> Add Foam Component
                  </Button>
                </div>
              </Card>
            )}

            {/* ─── FABRIC ─── */}
            {activeTab === 'fabric' && (
              <Card title="Fabric & Upholstery" subtitle="Enter fabric details and meters required.">
                <div className="space-y-4">
                  <div className="hidden lg:grid grid-cols-12 gap-3 px-4 mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest">
                    <div className="col-span-3">Component</div>
                    <div className="col-span-3">Fabric Type</div>
                    <div>Meters</div>
                    <div>Rate/M</div>
                    <div>Wastage%</div>
                    <div className="col-span-3 text-right pr-4 text-purple-900">Total</div>
                  </div>
                  {fabricFields.map((field, index) => {
                    const row = watchedFabric?.[index];
                    const matCost = (row?.metersRequired || 0) * (row?.ratePerMeter || 0);
                    const totalCost = matCost + (matCost * (row?.wastagePercent || 0) / 100);
                    return (
                      <div key={field.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border bg-purple-50/10 border-purple-100 hover:shadow-md transition-all">
                        <div className="col-span-3"><Input label="Component" {...register(`fabricBreakdown.${index}.componentName`)} /></div>
                        <div className="col-span-3"><Input label="Fabric Type" {...register(`fabricBreakdown.${index}.fabricType`)} /></div>
                        <div><Input label="Meters" type="number" step="0.01" {...register(`fabricBreakdown.${index}.metersRequired`, { valueAsNumber: true })} /></div>
                        <div><Input label="Rate" type="number" {...register(`fabricBreakdown.${index}.ratePerMeter`, { valueAsNumber: true })} /></div>
                        <div><Input label="Wastage%" type="number" {...register(`fabricBreakdown.${index}.wastagePercent`, { valueAsNumber: true })} /></div>
                        <div className="col-span-3 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                           <p className="text-sm font-bold text-purple-900">₹{totalCost.toFixed(2)}</p>
                           <button type="button" onClick={() => removeFabric(index)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="outline" type="button" onClick={() => appendFabric({ id: `fab_${Date.now()}`, componentName: '', fabricType: '', metersRequired: 0, wastagePercent: 0, ratePerMeter: 0, totalCost: 0, isCustomRate: false })} className="w-full border-dashed py-6 gap-2 text-purple-700 hover:bg-purple-50 bg-white">
                    <Plus className="w-4 h-4" /> Add Fabric Component
                  </Button>
                </div>
              </Card>
            )}

            <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
              <Button variant="ghost" type="button" onClick={() => setStep(1)} className="flex-1 lg:flex-none h-[64px] border-gray-200">
                 <ArrowLeft className="w-5 h-5 mr-3" /> Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1 lg:flex-none h-[64px] bg-amber-600 hover:bg-amber-700 text-white shadow-lg text-lg font-bold">
                 Review Quotation <ArrowRight className="w-5 h-5 ml-3" />
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: Summary & Labour ========== */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                <Card title="Labour & Finishing" subtitle="Rates for the craftsmen and finishes.">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input label="Carpenter Labour (₹)" type="number" {...register("labour.carpenter", { valueAsNumber: true })} />
                      <Input label="Polish Labour (₹)" type="number" {...register("labour.polish", { valueAsNumber: true })} />
                      <Input label="Foam/Upholstery (₹)" type="number" {...register("labour.foam", { valueAsNumber: true })} />
                      <Input label="Miscellaneous (₹)" type="number" {...register("miscellaneous.amount", { valueAsNumber: true })} />
                   </div>
                </Card>

                <Card title="Factory Config" subtitle="Overheads and margin settings.">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Select 
                        label="Factory Expense %"
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
