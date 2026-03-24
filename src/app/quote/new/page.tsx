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
  Trees,
  Layers,
  Wind,
  User,
  Activity,
  ChevronRight,
  ClipboardCheck,
  Percent
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
  calculateFabricRow,
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
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Quotation>({
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

  // Material field arrays
  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({ control, name: "woodBreakdown" });
  const { fields: plyFields, append: appendPly, remove: removePly } = useFieldArray({ control, name: "plyBreakdown" });
  const { fields: foamFields, append: appendFoam, remove: removeFoam } = useFieldArray({ control, name: "foamBreakdown" });
  const { fields: fabricFields, append: appendFabric, remove: removeFabric } = useFieldArray({ control, name: "fabricBreakdown" });

  const watchedValues = useWatch({ control });
  
  // Real-time calculation engine
  const summary = useMemo(() => {
    return calculateFinalQuotation(
      (watchedValues.woodBreakdown || []).map(r => calculateWoodRow(r as any)),
      (watchedValues.plyBreakdown || []).map(r => calculatePlyRow(r as any)),
      (watchedValues.foamBreakdown || []).map(r => calculateFoamRow(r as any)),
      (watchedValues.fabricBreakdown || []).map(r => calculateFabricRow(r as any)),
      watchedValues.labour ? { 
        carpenter: watchedValues.labour.carpenter || 0, 
        polish: watchedValues.labour.polish || 0, 
        foam: watchedValues.labour.foam || 0 
      } : { carpenter: 0, polish: 0, foam: 0 },
      watchedValues.miscellaneous ? { amount: watchedValues.miscellaneous.amount || 0 } : { amount: 0 },
      watchedValues.factoryExpensePercent || 30,
      watchedValues.markupPercent || 20,
      watchedValues.gstPercent || 18
    );
  }, [watchedValues]);

  // ─── MASTER DATA FETCHING ───
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

  // ─── AUTO-RATE LOOKUP LOGIC ───
  useEffect(() => {
    watchedValues.woodBreakdown?.forEach((row, index) => {
      if (row?.isRateOverridden) return;
      const match = findWoodMaster(row?.woodType || '', row?.length_ft || 0, row?.width_in || 0, row?.thickness_in || 0, woodMasters);
      if (match) setValue(`woodBreakdown.${index}.rate_per_gf`, match.rate_per_gf);
    });
  }, [watchedValues.woodBreakdown, woodMasters, setValue]);

  useEffect(() => {
    watchedValues.plyBreakdown?.forEach((row, index) => {
      if (row?.isRateOverridden) return;
      const match = findPlyMaster(row?.plyCategory || '', row?.thickness_mm || 0, plyMasters);
      if (match) setValue(`plyBreakdown.${index}.rate_per_sqft`, match.rate_per_sqft);
    });
  }, [watchedValues.plyBreakdown, plyMasters, setValue]);

  useEffect(() => {
    watchedValues.foamBreakdown?.forEach((row, index) => {
      if (row?.isRateOverridden) return;
      const match = findFoamMaster(row?.foamType || '', row?.specification || '', foamMasters);
      if (match) setValue(`foamBreakdown.${index}.master_rate`, match.base_rate);
    });
  }, [watchedValues.foamBreakdown, foamMasters, setValue]);

  // Material Data Helpers
  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  // Save Block Check
  const missingRates = useMemo(() => {
    const issues: string[] = [];
    watchedValues.woodBreakdown?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.rate_per_gf || 0) === 0 && r.woodType) issues.push(`Wood #${i+1}: Missing rate for ${r.woodType}`);
    });
    watchedValues.plyBreakdown?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.rate_per_sqft || 0) === 0 && r.plyCategory) issues.push(`Ply #${i+1}: Missing rate for ${r.plyCategory}`);
    });
    watchedValues.foamBreakdown?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.master_rate || 0) === 0 && r.foamType) issues.push(`Foam #${i+1}: Missing rate for ${r.foamType}`);
    });
    return issues;
  }, [watchedValues.woodBreakdown, watchedValues.plyBreakdown, watchedValues.foamBreakdown]);

  const onSubmit = async (data: Quotation) => {
    if (missingRates.length > 0) {
      alert("Cannot save. Please fix or override missing rates.");
      return;
    }

    setIsSubmitting(true);
    try {
      const woodCalc = data.woodBreakdown.map(r => calculateWoodRow(r));
      const plyCalc = data.plyBreakdown.map(r => calculatePlyRow(r as any));
      const foamCalc = data.foamBreakdown.map(r => calculateFoamRow(r as any));
      const fabricCalc = data.fabricBreakdown.map(r => calculateFabricRow(r as any));
      
      const finalData = {
        ...data,
        refCode: generateRefCode(),
        woodBreakdown: woodCalc,
        plyBreakdown: plyCalc,
        foamBreakdown: foamCalc,
        fabricBreakdown: fabricCalc,
        summary: summary,
        status: 'Draft' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const id = await createQuotation(finalData as any);
      alert("Quotation saved successfully!");
      router.push(`/quote/view/${id}?download=true`);
    } catch (err: any) {
      console.error("[Submit] ❌ Error:", err);
      alert("Error saving quotation: " + (err.message || "Unknown error occurred."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 px-4 md:px-8">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#2d221c] p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white border-b-8 border-amber-600">
        <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight">New Valuation</h1>
          <p className="text-amber-200/50 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5" /> Bespoke Furniture Intelligence
          </p>
        </div>
        
        <div className="relative z-10 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
               <div className="flex flex-col items-center gap-2">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 border-t border-white/20 ${
                    step === s ? "bg-amber-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.5)] scale-110" : 
                    step > s ? "bg-emerald-500 text-white" : "bg-white/5 text-white/30"
                  }`}>
                    {step > s ? "✓" : s}
                 </div>
                 <span className={`text-[9px] font-black uppercase tracking-widest ${step === s ? 'text-amber-400' : 'text-white/20'}`}>
                    {s === 1 ? 'Client' : s === 2 ? 'Structure' : s === 3 ? 'Soft' : 'Finishing'}
                 </span>
               </div>
               {s < 4 && <div className={`w-10 h-px mb-4 transition-colors duration-500 ${step > s ? 'bg-emerald-500/30' : 'bg-white/10'}`}></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-8 space-y-8">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
               <div className="bg-white p-10 rounded-[2rem] shadow-wood border border-amber-900/5 relative overflow-hidden">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center gap-4 mb-10">
                     <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700 shadow-inner">
                        <User className="w-7 h-7" />
                     </div>
                     <div>
                        <h2 className="text-3xl font-serif text-[#2d221c]">Client Identity</h2>
                        <p className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em]">Project Origin & Specification</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <Input label="Customer Name" placeholder="e.g. Prestige Woodworks" {...register("customerName", { required: "Customer name is required" })} error={errors.customerName?.message} />
                      <Select label="Customer Type" options={CUSTOMER_TYPES.map(t => ({ label: t, value: t }))} {...register("customerType")} />
                      <Input label="Valuation Date" type="date" {...register("date")} />
                    </div>
                    
                    <div className="space-y-6">
                      <Input label="Product Name" placeholder="e.g. Wingback Lounge Chair" {...register("productName", { required: "Product name is required" })} error={errors.productName?.message} />
                      <Input label="Category" placeholder="e.g. Seating" {...register("productCategory", { required: "Category is required" })} error={errors.productCategory?.message} />
                    </div>

                    <div className="md:col-span-2 pt-10 border-t border-amber-900/5">
                       <p className="text-[10px] font-black text-amber-900/60 uppercase tracking-[0.2em] mb-6">Visual Reference (Product Drawing)</p>
                       <div className="flex flex-col md:flex-row items-center gap-8">
                          <div className="w-48 h-48 rounded-3xl bg-amber-50 border-2 border-dashed border-amber-900/10 flex items-center justify-center overflow-hidden group shadow-inner">
                             {watchedValues.productImage ? (
                               <img src={watchedValues.productImage as any} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Preview" />
                             ) : (
                               <Package className="w-12 h-12 text-amber-900/10" />
                             )}
                          </div>
                          <div className="space-y-4 text-center md:text-left">
                             <input type="file" accept="image/*" id="image-upload" className="hidden" onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = async () => {
                                   const originalDataUrl = reader.result as string;
                                   const compressed = await compressImage(originalDataUrl, 800, 0.7);
                                   setValue("productImage", compressed);
                                 };
                                 reader.readAsDataURL(file);
                               }
                             }} />
                             <label htmlFor="image-upload" className="px-8 py-4 bg-[#2d221c] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer hover:bg-black shadow-lg transition-all flex items-center gap-3">
                                <Plus className="w-4 h-4" /> Upload Technical Drawing
                             </label>
                             {watchedValues.productImage && (
                               <button type="button" onClick={() => setValue("productImage", undefined)} className="text-[10px] text-rose-500 font-bold uppercase tracking-widest hover:underline block mx-auto md:mx-0">Remove Ref Image</button>
                             )}
                          </div>
                       </div>
                    </div>
                  </div>
               </div>

               <div className="flex justify-end pt-4">
                  <Button type="button" onClick={() => setStep(2)} className="h-16 px-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xl shadow-amber-900/20 text-xl font-serif tracking-wide group">
                    Next: Structural Breakdown <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
               </div>
            </div>
          )}

          {/* STEP 2: STRUCTURAL MATERIALS (Wood/Ply) */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               {/* Wood Section */}
               <div className="bg-white p-8 rounded-[2rem] shadow-wood border border-amber-900/5 relative">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700">
                          <Trees className="w-6 h-6" />
                       </div>
                       <h2 className="text-2xl font-serif text-[#2d221c]">Solid Wood Components</h2>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendWood({ id: `w_${Date.now()}`, componentName: '', woodType: (woodTypes[0] || ''), length_ft: 0, width_in: 0, thickness_in: 0, quantity: 1, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false })} className="border-amber-900/10 text-amber-800 hover:bg-amber-50 font-black uppercase tracking-tighter text-[10px]">
                       <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {woodFields.map((field, index) => {
                      const row = watchedValues.woodBreakdown?.[index] as any;
                      const gf = row ? calculateGunFoot(row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, row.quantity || 0) : 0;
                      const hasRate = row?.isRateOverridden || (row?.rate_per_gf || 0) > 0;
                      
                      return (
                        <div key={field.id} className={`p-5 rounded-2xl border transition-all ${!hasRate && row?.woodType ? 'bg-rose-50/50 border-rose-200' : 'bg-amber-50/10 border-amber-900/5 hover:border-amber-500/30'}`}>
                          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2 lg:col-span-3">
                               <Input label="Part Name" placeholder="e.g. Main Frame" {...register(`woodBreakdown.${index}.componentName`)} />
                            </div>
                            <div className="lg:col-span-2">
                               <Select label="Wood" options={woodTypes.map(t => ({ label: t, value: t }))} {...register(`woodBreakdown.${index}.woodType`)} />
                            </div>
                            <div className="flex gap-2 lg:col-span-3">
                               <Input label="L (ft)" type="number" step="0.01" {...register(`woodBreakdown.${index}.length_ft`, { valueAsNumber: true })} />
                               <Input label="W (in)" type="number" step="0.01" {...register(`woodBreakdown.${index}.width_in`, { valueAsNumber: true })} />
                               <Input label="T (in)" type="number" step="0.01" {...register(`woodBreakdown.${index}.thickness_in`, { valueAsNumber: true })} />
                            </div>
                            <div className="lg:col-span-1">
                               <Input label="Qty" type="number" {...register(`woodBreakdown.${index}.quantity`, { valueAsNumber: true })} />
                            </div>
                            <div className="lg:col-span-2 relative">
                               <Input label="Rate/GF" type="number" step="0.01" readOnly={!row?.isRateOverridden} {...register(`woodBreakdown.${index}.rate_per_gf`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-amber-100/50" : "bg-white"} />
                               <button type="button" onClick={() => setValue(`woodBreakdown.${index}.isRateOverridden`, !row?.isRateOverridden)} className={`absolute right-2 top-11 transition-colors ${row?.isRateOverridden ? 'text-amber-600' : 'text-amber-900/10 hover:text-amber-500'}`} title="Override rate">
                                  <AlertCircle className="w-3.5 h-3.5" />
                               </button>
                            </div>
                            <div className="flex items-center justify-end gap-3 lg:col-span-1 pb-2">
                               <div className="text-right">
                                  <p className="text-[9px] font-black text-amber-900/20 uppercase">{gf.toFixed(2)}gf</p>
                                  <p className="text-sm font-black text-[#2d221c]">₹{((row?.rate_per_gf || 0) * gf).toLocaleString()}</p>
                                </div>
                               <button type="button" onClick={() => removeWood(index)} className="p-1.5 text-amber-900/10 hover:text-rose-500 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               {/* Plywood Section */}
               <div className="bg-white p-8 rounded-[2rem] shadow-wood border border-amber-900/5 relative">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-700">
                          <Layers className="w-6 h-6" />
                       </div>
                       <h2 className="text-2xl font-serif text-[#2d221c]">Engineering Board (Ply)</h2>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendPly({ id: `p_${Date.now()}`, componentName: '', plyCategory: (plyCategories[0] || 'plywood'), thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 })} className="border-blue-900/10 text-blue-800 hover:bg-blue-50 font-black uppercase tracking-tighter text-[10px]">
                       <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {plyFields.map((field, index) => {
                      const row = watchedValues.plyBreakdown?.[index] as any;
                      const sqft = row ? (row.cut_length_in * row.cut_width_in * row.quantity) / 144 : 0;
                      const hasRate = row?.isRateOverridden || (row?.rate_per_sqft || 0) > 0;

                      return (
                        <div key={field.id} className="p-5 rounded-2xl bg-blue-50/5 border border-blue-900/5 hover:border-blue-500/30 transition-all shadow-sm">
                           <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
                              <div className="md:col-span-2 lg:col-span-3"><Input label="Part" placeholder="Seat Base" {...register(`plyBreakdown.${index}.componentName`)} /></div>
                              <div className="lg:col-span-2"><Select label="Category" options={plyCategories.map(c => ({ label: c, value: c }))} {...register(`plyBreakdown.${index}.plyCategory`)} /></div>
                              <div className="lg:col-span-1"><Input label="T (mm)" type="number" {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                              <div className="flex gap-2 lg:col-span-2"><Input label="L (in)" type="number" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /><Input label="W (in)" type="number" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                              <div className="lg:col-span-1"><Input label="Qty" type="number" {...register(`plyBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                              <div className="lg:col-span-2 relative"><Input label="Rate/SF" type="number" readOnly={!row?.isRateOverridden} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-blue-100/30" : "bg-white"} /><button type="button" onClick={() => setValue(`plyBreakdown.${index}.isRateOverridden`, !row?.isRateOverridden)} className={`absolute right-2 top-11 transition-colors ${row?.isRateOverridden ? 'text-blue-600' : 'text-blue-900/10 hover:text-blue-500'}`}><AlertCircle className="w-3.5 h-3.5" /></button></div>
                              <div className="flex items-center justify-end gap-3 lg:col-span-1 pb-2">
                                 <div className="text-right"><p className="text-[9px] font-black text-blue-900/20 uppercase">{sqft.toFixed(2)}sf</p><p className="text-sm font-black text-[#2d221c]">₹{((row?.rate_per_sqft || 0) * sqft).toLocaleString()}</p></div>
                                 <button type="button" onClick={() => removePly(index)} className="p-1.5 text-blue-900/10 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               <div className="flex justify-between items-center pt-8 border-t border-amber-900/5">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)} className="h-16 px-10 rounded-2xl text-[#2d221c] font-serif group hover:bg-amber-50"><ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" /> Back to Client Hub</Button>
                  <Button type="button" onClick={() => setStep(3)} className="h-16 px-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xl shadow-amber-900/20 text-xl font-serif tracking-wide group">Next: Soft Materials <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" /></Button>
               </div>
            </div>
          )}

          {/* STEP 3: SOFT MATERIALS (Foam/Fabric) */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               {/* Foam Section */}
               <div className="bg-white p-8 rounded-[2rem] shadow-wood border border-amber-900/5 relative">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-700">
                          <Wind className="w-6 h-6" />
                       </div>
                       <h2 className="text-2xl font-serif text-[#2d221c]">Foam & Padding</h2>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendFoam({ id: `f_${Date.now()}`, componentName: '', foamType: (foamTypes[0] || 'PU'), specification: 'Standard', thickness_in: 0, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 })} className="border-orange-900/10 text-orange-800 hover:bg-orange-50 font-black uppercase tracking-tighter text-[10px]">
                       <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {foamFields.map((field, index) => {
                      const row = watchedValues.foamBreakdown?.[index] as any;
                      const sqft = row ? (row.cut_length_in * row.cut_width_in * row.quantity) / 144 : 0;
                      const hasRate = row?.isRateOverridden || (row?.master_rate || 0) > 0;
                      const derivedPerSqft = ((row?.master_rate || 0) * (row?.thickness_in || 0)) / 18;

                      return (
                        <div key={field.id} className="p-5 rounded-2xl bg-orange-50/5 border border-orange-900/5 hover:border-orange-500/30 transition-all shadow-sm">
                           <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
                              <div className="md:col-span-2 lg:col-span-3"><Input label="Part" placeholder="Seat Cushion" {...register(`foamBreakdown.${index}.componentName`)} /></div>
                              <div className="lg:col-span-2"><Select label="Foam" options={foamTypes.map(t => ({ label: t, value: t }))} {...register(`foamBreakdown.${index}.foamType`)} /></div>
                              <div className="lg:col-span-2"><Select label="Spec" options={getFoamSpecs(row?.foamType || '').map(s => ({ label: s, value: s }))} {...register(`foamBreakdown.${index}.specification`)} /></div>
                              <div className="flex gap-2 lg:col-span-2"><Input label="T (in)" type="number" step="0.5" {...register(`foamBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /><Input label="Qty" type="number" {...register(`foamBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                              <div className="lg:col-span-2 relative"><Input label="Rate" type="number" readOnly={!row?.isRateOverridden} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-orange-100/30" : "bg-white"} /><button type="button" onClick={() => setValue(`foamBreakdown.${index}.isRateOverridden`, !row?.isRateOverridden)} className={`absolute right-2 top-11 transition-colors ${row?.isRateOverridden ? 'text-orange-600' : 'text-orange-900/10 hover:text-orange-500'}`}><AlertCircle className="w-3.5 h-3.5" /></button></div>
                              <div className="flex items-center justify-end gap-3 lg:col-span-1 pb-2">
                                 <div className="text-right">
                                    <p className="text-[9px] font-black text-orange-900/20 uppercase">{sqft.toFixed(1)}sf · ₹{derivedPerSqft.toFixed(0)}/sf</p>
                                    <p className="text-sm font-black text-[#2d221c]">₹{((derivedPerSqft || 0) * sqft).toLocaleString()}</p>
                                 </div>
                                 <button type="button" onClick={() => removeFoam(index)} className="p-1.5 text-orange-900/10 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               {/* Fabric Section */}
               <div className="bg-white p-8 rounded-[2rem] shadow-wood border border-amber-900/5 relative">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-700">
                          <Package className="w-6 h-6" />
                       </div>
                       <h2 className="text-2xl font-serif text-[#2d221c]">Fabric & Upholstery</h2>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendFabric({ id: `fab_${Date.now()}`, componentName: '', fabricType: '', metersRequired: 0, wastagePercent: 0, ratePerMeter: 0, totalCost: 0, isCustomRate: false })} className="border-purple-900/10 text-purple-800 hover:bg-purple-50 font-black uppercase tracking-tighter text-[10px]">
                       <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fabricFields.map((field, index) => {
                      const row = watchedValues.fabricBreakdown?.[index] as any;
                      const cost = (row?.metersRequired || 0) * (row?.ratePerMeter || 0);

                      return (
                        <div key={field.id} className="p-5 rounded-2xl bg-purple-50/5 border border-purple-900/5 hover:border-purple-500/30 transition-all shadow-sm">
                           <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
                              <div className="md:col-span-2 lg:col-span-3"><Input label="Upholstery Part" {...register(`fabricBreakdown.${index}.componentName`)} /></div>
                              <div className="lg:col-span-3"><Input label="Fabric Ref" {...register(`fabricBreakdown.${index}.fabricType`)} /></div>
                              <div className="lg:col-span-1"><Input label="Meters" type="number" step="0.1" {...register(`fabricBreakdown.${index}.metersRequired`, { valueAsNumber: true })} /></div>
                              <div className="lg:col-span-2"><Input label="Rate" type="number" {...register(`fabricBreakdown.${index}.ratePerMeter`, { valueAsNumber: true })} /></div>
                              <div className="lg:col-span-1"><Input label="Wastage%" type="number" {...register(`fabricBreakdown.${index}.wastagePercent`, { valueAsNumber: true })} /></div>
                              <div className="flex items-center justify-end gap-3 lg:col-span-2 pb-2">
                                 <div className="text-right"><p className="text-sm font-black text-[#2d221c]">₹{cost.toLocaleString()}</p></div>
                                 <button type="button" onClick={() => removeFabric(index)} className="p-1.5 text-purple-900/10 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               <div className="flex justify-between items-center pt-8 border-t border-amber-900/5">
                  <Button type="button" variant="ghost" onClick={() => setStep(2)} className="h-16 px-10 rounded-2xl text-[#2d221c] font-serif group hover:bg-amber-50"><ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" /> Back to Structure</Button>
                  <Button type="button" onClick={() => setStep(4)} className="h-16 px-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xl shadow-amber-900/20 text-xl font-serif tracking-wide group">Finalize: Internal Audit <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" /></Button>
               </div>
            </div>
          )}

          {/* STEP 4: FINAL AUDIT */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="bg-white p-10 rounded-[2rem] shadow-wood border border-amber-900/5 relative">
                  <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
                  <div className="flex items-center gap-4 mb-10">
                     <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                        <ClipboardCheck className="w-7 h-7" />
                     </div>
                     <h2 className="text-3xl font-serif text-[#2d221c]">Labour & Factory Overheads</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-amber-900/40 tracking-widest border-b border-amber-900/5 pb-2">Labour Rates (₹)</h4>
                       <Input label="Carpenter Labour" type="number" {...register("labour.carpenter", { valueAsNumber: true })} />
                       <Input label="Polish/Painting" type="number" {...register("labour.polish", { valueAsNumber: true })} />
                       <Input label="Foam/Upholstery Labour" type="number" {...register("labour.foam", { valueAsNumber: true })} />
                       <Input label="Miscellaneous Fittings" type="number" {...register("miscellaneous.amount", { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-amber-900/40 tracking-widest border-b border-amber-900/5 pb-2">Factory Settings (%)</h4>
                       <Select label="Factory Expense %" options={[{label:'30% (Standard)', value:30}, {label:'35% (Complex)', value:35}, {label:'40% (Premium)', value:40}]} {...register("factoryExpensePercent", { valueAsNumber: true })} />
                       <Input label="Profit Margin %" type="number" {...register("markupPercent", { valueAsNumber: true })} />
                       <Input label="Tax Calculation (GST %)" type="number" {...register("gstPercent", { valueAsNumber: true })} />
                    </div>
                  </div>
               </div>

               {missingRates.length > 0 && (
                 <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-start gap-6">
                    <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
                    <div>
                       <p className="text-sm font-black text-rose-900 uppercase tracking-widest mb-2">Valuation Blocked</p>
                       <p className="text-[11px] text-rose-700 leading-relaxed mb-6">Please fix missing master rates before saving this quotation. Use the ⚠ icon on any material row to manually override its rate from the masters library.</p>
                       <ul className="text-[10px] font-serif text-rose-800 space-y-2 list-disc list-inside bg-white/50 p-6 rounded-2xl border border-rose-200/50">
                          {missingRates.map((msg, i) => <li key={i}>{msg}</li>)}
                       </ul>
                    </div>
                 </div>
               )}

               <div className="flex justify-between items-center pt-8 border-t border-amber-900/5">
                  <Button type="button" variant="ghost" onClick={() => setStep(3)} className="h-16 px-10 rounded-2xl text-[#2d221c] font-serif group hover:bg-amber-50"><ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" /> Back to Materials</Button>
                  <Button type="submit" disabled={missingRates.length > 0 || isSubmitting} className="h-16 px-12 rounded-2xl bg-[#2d221c] hover:bg-black text-white shadow-2xl shadow-black/30 text-xl font-serif tracking-wide group">
                    {isSubmitting ? 'Architecting...' : <><Save className="w-6 h-6 mr-3" /> Save Factory Valuation</>}
                  </Button>
               </div>
            </div>
          )}
        </form>

        {/* STICKY LIVE SIDEBAR */}
        <aside className="lg:col-span-4 sticky top-8 space-y-6">
           <div className="bg-[#2d221c] text-white p-8 md:p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border-t border-white/10">
              <div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div>
              
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-10 opacity-50">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Live Intelligence Feed</span>
                 </div>

                 <div className="space-y-6 mb-12">
                    <div className="flex justify-between items-center text-xs group">
                       <span className="text-white/40 group-hover:text-amber-200/80 transition-colors uppercase tracking-widest font-black text-[9px]">Materials</span>
                       <span className="font-serif text-xl font-light">₹{summary.totalMaterials.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs group">
                       <span className="text-white/40 group-hover:text-amber-200/80 transition-colors uppercase tracking-widest font-black text-[9px]">Craftsmanship</span>
                       <span className="font-serif text-xl font-light">₹{summary.totalLabour.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs group">
                       <span className="text-white/40 group-hover:text-amber-200/80 transition-colors uppercase tracking-widest font-black text-[9px]">Operations</span>
                       <span className="font-serif text-xl font-light">₹{summary.factoryExpenseAmount.toLocaleString()}</span>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 flex justify-between items-end">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Internal Cost</p>
                          <p className="text-3xl font-serif font-light">₹{summary.totalInternalCost.toLocaleString()}</p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-amber-500/10 p-8 rounded-[2rem] border border-amber-500/20 mb-8 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3">Est. Selling Price</p>
                    <p className="text-5xl font-serif text-white tracking-tight font-light">₹{summary.grandTotal.toLocaleString()}</p>
                    <div className="flex justify-between items-center mt-6 pt-5 border-t border-white/5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                       <span className="flex items-center gap-2"><Percent className="w-3 h-3" /> GST: ₹{summary.gstAmount.toLocaleString()}</span>
                       <span className="bg-emerald-500/10 px-2 py-1 rounded text-[9px]">Margin: {summary.profitPercent}%</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Net Profit</p>
                       <p className="text-base font-black text-emerald-400">₹{summary.grossProfitAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Efficiency</p>
                       <p className="text-base font-black text-amber-400">Auto-Optimized</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-amber-900/5">
              <h4 className="text-[10px] font-black uppercase text-amber-900/40 tracking-[0.3em] mb-6 flex items-center justify-between">
                 Validation Diagnostics
                 {missingRates.length > 0 ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <ClipboardCheck className="w-4 h-4 text-emerald-500" />}
              </h4>
              <div className="space-y-4">
                 {missingRates.length === 0 ? (
                    <div className="flex items-center gap-3 text-emerald-700">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                       <span className="text-[11px] font-bold uppercase tracking-tight">AI Audit: Data Integrity Verified</span>
                    </div>
                 ) : (
                    <div className="flex items-start gap-3 text-rose-600">
                       <div className="w-2 h-2 rounded-full bg-rose-500 mt-1"></div>
                       <p className="text-[11px] font-bold uppercase leading-tight tracking-tight">
                          Valuation Blocked: {missingRates.length} Errors detected in Master Rates.
                       </p>
                    </div>
                 )}
                 <div className="flex items-center gap-3 text-amber-900/40 text-[10px] font-bold uppercase pt-4 border-t border-amber-900/5">
                    <Activity className="w-3.5 h-3.5" /> Identity: {watchedValues.customerName || 'Waiting...'}
                 </div>
              </div>
           </div>
        </aside>
      </div>
    </div>
  );
}
