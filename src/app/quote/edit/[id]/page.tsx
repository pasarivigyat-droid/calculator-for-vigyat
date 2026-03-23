"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { 
  Plus, Trash2, Calculator, Save, ArrowRight, ArrowLeft,
  AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Beaker,
  Copy, CheckCircle2, Printer, ExternalLink, Package, Trees, Layers, Wind
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Quotation, CustomerType, WoodMaster, PlyMaster, FoamMaster, FabricMaster, WoodRow, PlyRow, FoamRow, FabricRow, QuoteStatus } from "@/types";
import { 
  calculateGunFoot, calculatePlyRow, calculateFoamRow, calculateFabricRow,
  calculateFinalQuotation, findWoodMaster, findPlyMaster, findFoamMaster, getWoodMatchReason, getPlyMatchReason, getFoamMatchReason
} from "@/lib/utils/calculations";
import { getWoodMasters, getPlyMasters, getFoamMasters, getFabricMasters, getMarkupSettings, updateQuotation, getQuotation } from "@/lib/firebase/services";
import { useRouter } from "next/navigation";
import { generateRefCode } from "@/lib/utils/formatters";
import { compressImage } from "@/lib/utils/image_compression";

const CUSTOMER_TYPES: CustomerType[] = [
  "Architect", "Interior Designer", "House Owner", "Showroom", "Third-party Supplier",
  "Furniture Manufacturer", "Real Estate Developer", "Hospitality Group", "Retail Client", "Other"
];

// ===================================================================
// Debug panel component  —  collapsible row-level calculation view
// ===================================================================
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

// ===================================================================
// Missing-rate warning badge
// ===================================================================
function MissingRateBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold uppercase animate-pulse">
      <AlertTriangle className="w-3 h-3" /> No master rate
    </span>
  );
}

export default function EditQuotePage({ params }: { params: { id: string } }) {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'wood' | 'ply' | 'foam' | 'fabric'>('wood');
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [fabricMasters, setFabricMasters] = useState<FabricMaster[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Quotation>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      woodBreakdown: [],
      plyBreakdown: [],
      foamBreakdown: [],
      fabricBreakdown: [],
      status: 'Draft',
      gstPercent: 18,
      factoryExpensePercent: 30,
      markupPercent: 20,
      labour: { carpenter: 0, polish: 0, foam: 0, total: 0 },
      miscellaneous: { amount: 0, total: 0 }
    }
  });

  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({ control, name: "woodBreakdown" });
  const { fields: plyFields, append: appendPly, remove: removePly } = useFieldArray({ control, name: "plyBreakdown" });
  const { fields: foamFields, append: appendFoam, remove: removeFoam } = useFieldArray({ control, name: "foamBreakdown" });
  const { fields: fabricFields, append: appendFabric, remove: removeFabric } = useFieldArray({ control, name: "fabricBreakdown" });

  const watchedValues = watch();
  const watchedWood = useWatch({ control, name: "woodBreakdown" });
  const watchedPly = useWatch({ control, name: "plyBreakdown" });
  const watchedFoam = useWatch({ control, name: "foamBreakdown" });
  const watchedFabric = useWatch({ control, name: "fabricBreakdown" });
  const watchedGST = watch("gstPercent");
  const watchedMarkup = watch("markupPercent");
  const watchedFactory = watch("factoryExpensePercent");

  // Load masters + existing quotation
  useEffect(() => {
    const init = async () => {
      const [w, p, f, fab, data] = await Promise.all([
        getWoodMasters(), getPlyMasters(), getFoamMasters(), getFabricMasters(), getQuotation(params.id)
      ]);
      setWoodMasters(w);
      setPlyMasters(p);
      setFoamMasters(f);
      setFabricMasters(fab);
      setMastersLoaded(true);
      if (data) reset(data);
    };
    init();
  }, [params.id, reset]);

  // Derived material options
  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  // Rate lookups
  useEffect(() => {
    watchedWood?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findWoodMaster(row.woodType, row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters);
      if (match) setValue(`woodBreakdown.${index}.rate_per_gf`, match.rate_per_gf);
    });
  }, [watchedWood, woodMasters, setValue]);

  useEffect(() => {
    watchedPly?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findPlyMaster(row.plyCategory, row.thickness_mm || 0, plyMasters);
      if (match) setValue(`plyBreakdown.${index}.rate_per_sqft`, match.rate_per_sqft);
    });
  }, [watchedPly, plyMasters, setValue]);

  useEffect(() => {
    watchedFoam?.forEach((row, index) => {
      if (row.isRateOverridden) return;
      const match = findFoamMaster(row.foamType, row.specification, foamMasters);
      if (match) setValue(`foamBreakdown.${index}.master_rate`, match.base_rate);
    });
  }, [watchedFoam, foamMasters, setValue]);

  // Main calculation summary
  const summary = useMemo(() => {
    const woodRows = watchedWood?.map(r => calculateGunFoot(r.length_ft, r.width_in, r.thickness_in, r.quantity) * (r.rate_per_gf || 0)) || [];
    const plyRows = watchedPly?.map(r => calculatePlyRow(r as any)) || [];
    const foamRows = watchedFoam?.map(r => calculateFoamRow(r as any)) || [];
    const fabricRows = watchedFabric?.map(r => calculateFabricRow(r as any)) || [];

    return calculateFinalQuotation(
      watchedWood?.map(r => ({ ...r, total_cost: calculateGunFoot(r.length_ft, r.width_in, r.thickness_in, r.quantity) * (r.rate_per_gf || 0) })) as any,
      plyRows as any,
      foamRows as any,
      fabricRows as any,
      watchedValues.labour || { carpenter: 0, polish: 0, foam: 0, total: 0 },
      watchedValues.miscellaneous || { amount: 0, total: 0 },
      watchedFactory || 0,
      watchedMarkup || 0,
      watchedGST || 18
    );
  }, [watchedWood, watchedPly, watchedFoam, watchedFabric, watchedValues.labour, watchedValues.miscellaneous, watchedFactory, watchedMarkup, watchedGST]);

  const missingRates = useMemo(() => {
    const issues: string[] = [];
    watchedWood?.forEach((r, i) => { if (!r.isRateOverridden && r.rate_per_gf === 0 && r.woodType) issues.push(`Wood #${i+1}: No rate for ${r.woodType}`); });
    watchedPly?.forEach((r, i) => { if (!r.isRateOverridden && r.rate_per_sqft === 0 && r.plyCategory) issues.push(`Ply #${i+1}: No rate for ${r.plyCategory}`); });
    watchedFoam?.forEach((r, i) => { if (!r.isRateOverridden && r.master_rate === 0 && r.foamType) issues.push(`Foam #${i+1}: No rate for ${r.foamType}`); });
    return issues;
  }, [watchedWood, watchedPly, watchedFoam]);

  const onSubmit = async (data: Quotation) => {
    if (missingRates.length > 0) return alert("Please fix missing rates before saving.");
    try {
      const finalData = { ...data, summary, updatedAt: new Date() };
      await updateQuotation(params.id, finalData as any);
      router.push(`/quote/view/${params.id}?download=true`);
    } catch (err) {
      alert("Error updating quotation: " + (err as Error).message);
    }
  };

  const copyRefCode = () => {
    if (watchedValues.refCode) {
      navigator.clipboard.writeText(watchedValues.refCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Editing Quotation</div>
             {watchedValues.refCode && (
               <button onClick={copyRefCode} className="text-[10px] font-bold text-gray-400 hover:text-amber-600 flex items-center gap-1 transition-colors">
                 {watchedValues.refCode} {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
               </button>
             )}
          </div>
          <h1 className="text-3xl font-bold text-[#2d221c] tracking-tight">{watchedValues.customerName || "Untitled Quotation"}</h1>
          <p className="text-gray-500">{watchedValues.productName || watchedValues.productCategory || "Product details"}</p>
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
                <Input label="Customer Name" {...register("customerName", { required: "Customer name is required" })} error={errors.customerName?.message} />
                <Select label="Customer Type" options={CUSTOMER_TYPES.map(t => ({ label: t, value: t }))} {...register("customerType")} />
                <Input label="Product Category" placeholder="e.g. Sofa, Dining Chair" {...register("productCategory", { required: "Category is required" })} error={errors.productCategory?.message} />
                <Input label="Ref Code" {...register("refCode")} readOnly className="bg-gray-50 opacity-60" />
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
                      type="file" accept="image/*" id="image-upload" className="hidden" 
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
                              setValue("productImage", originalDataUrl);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="image-upload" className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50">Upload Image</label>
                    {watch("productImage") && <button type="button" onClick={() => setValue("productImage", undefined)} className="text-[10px] text-red-500 font-bold uppercase underline">Remove</button>}
                  </div>
                </div>
                <Input label="Date" type="date" {...register("date")} />
                <Select label="Status" options={['Draft', 'Sent', 'Approved', 'Rejected'].map(s => ({ label: s, value: s }))} {...register("status")} />
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
            </div>

            {/* Tab Selector */}
            <div className="flex p-1 bg-gray-100 rounded-xl overflow-x-auto no-scrollbar gap-1">
              {[
                { id: 'wood', label: 'Wood', count: woodFields.length, Icon: Trees },
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
                    <div>L (ft)</div><div>W (in)</div><div>T (in)</div><div className="text-center">Qty</div>
                    <div className="col-span-2">Rate/GF</div><div className="col-span-2 text-right pr-4 text-amber-900">Total</div>
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
                          <Select label="Wood Type" options={woodTypes.map(t => ({ label: t, value: t }))} {...register(`woodBreakdown.${index}.woodType`)} />
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
                          <DebugView label="Diagnostics" warnings={warnings} data={{"GF": gf, "Rate": rate, "Total": wCost, "Master": matchedMaster ? "Found" : "None"}} />
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
                     <div className="col-span-2">Component</div><div>Category</div><div>T (mm)</div>
                     <div>CutL</div><div>CutW</div><div>Qty</div><div>Rate/SqFt</div><div>Wastage%</div><div>SqFt</div><div className="col-span-2 text-right pr-4 text-blue-900">Total</div>
                  </div>
                  {plyFields.map((field, index) => {
                    const row = watchedPly?.[index] as PlyRow | undefined;
                    const calc = row ? calculatePlyRow(row) : null;
                    const hasRate = row?.isRateOverridden || (row?.rate_per_sqft && row.rate_per_sqft > 0);
                    const matchedMaster = row && !row.isRateOverridden ? findPlyMaster(row.plyCategory || '', row.thickness_mm || 0, plyMasters) : null;
                    const warnings: string[] = [];
                    if (!hasRate && row?.plyCategory && row.plyCategory.trim()) warnings.push(getPlyMatchReason(row, plyMasters));

                    return (
                      <div key={field.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${!hasRate && row?.plyCategory ? 'bg-red-50/30 border-red-200' : row?.isRateOverridden ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                        <div className="col-span-2"><Input label="Component" placeholder="Seat Base" {...register(`plyBreakdown.${index}.componentName`)} /></div>
                        <div><Select label="Category" options={plyCategories.map(c => ({ label: c, value: c }))} {...register(`plyBreakdown.${index}.plyCategory`)} /></div>
                        <div><Input label="T (mm)" type="number" {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                        <div><Input label="L (in)" type="number" step="0.01" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                        <div><Input label="W (in)" type="number" step="0.01" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                        <div><Input label="Qty" type="number" {...register(`plyBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                        <div className="relative">
                           <Input label="Rate/SqFt" type="number" step="0.01" readOnly={!row?.isRateOverridden} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />
                           <button type="button" onClick={() => setValue(`plyBreakdown.${index}.isRateOverridden`, !watch(`plyBreakdown.${index}.isRateOverridden`))} className={`absolute right-1 top-11 p-0.5 rounded ${watch(`plyBreakdown.${index}.isRateOverridden`) ? "text-amber-600" : "text-gray-300"}`} title="Toggle override">
                              <AlertCircle className="w-3 h-3" />
                           </button>
                        </div>
                        <div><Input label="Wastage%" type="number" step="0.1" {...register(`plyBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                        <div className="flex flex-col items-center justify-center pt-2 lg:pt-0">
                           <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block lg:hidden">SqFt Area</span>
                           <span className="text-xs font-mono text-gray-600">{calc?.sqft?.toFixed(2) || '0'}</span>
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                           {!hasRate && row?.plyCategory && row.plyCategory.trim() && <MissingRateBadge />}
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
                     <div className="col-span-2">Component</div><div>Type</div><div>Spec</div><div>T (in)</div><div>CutL</div><div>CutW</div><div>Qty</div><div>BaseRate</div><div>Wastage%</div><div className="col-span-2 text-right pr-4 text-orange-900">Total</div>
                  </div>
                  {foamFields.map((field, index) => {
                    const row = watchedFoam?.[index] as FoamRow | undefined;
                    const calc = row ? calculateFoamRow(row) : null;
                    const hasRate = row?.isRateOverridden || (row?.master_rate && row.master_rate > 0);
                    const derivedPerSqft = (row?.master_rate || 0) * (row?.thickness_in || 0) / 18;
                    const warnings: string[] = [];
                    if (!hasRate && row?.foamType && row.foamType.trim()) warnings.push(getFoamMatchReason(row, foamMasters));

                    return (
                      <div key={field.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border transition-all hover:shadow-md ${!hasRate && row?.foamType ? 'bg-red-50/30 border-red-200' : row?.isRateOverridden ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                        <div className="col-span-2"><Input label="Component" placeholder="Seat Cushion" {...register(`foamBreakdown.${index}.componentName`)} /></div>
                        <div><Select label="Foam Type" options={foamTypes.map(t => ({ label: t, value: t }))} {...register(`foamBreakdown.${index}.foamType`)} /></div>
                        <div><Select label="Spec" options={getFoamSpecs(row?.foamType || '').map(s => ({ label: s, value: s }))} {...register(`foamBreakdown.${index}.specification`)} /></div>
                        <div><Input label="T (in)" type="number" step="0.5" {...register(`foamBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                        <div><Input label="L (in)" type="number" step="0.01" {...register(`foamBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                        <div><Input label="W (in)" type="number" step="0.01" {...register(`foamBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                        <div><Input label="Qty" type="number" {...register(`foamBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                        <div className="relative">
                           <Input label="Base Rate" type="number" step="0.01" readOnly={!row?.isRateOverridden} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />
                           <button type="button" onClick={() => setValue(`foamBreakdown.${index}.isRateOverridden`, !watch(`foamBreakdown.${index}.isRateOverridden`))} className={`absolute right-1 top-11 p-0.5 rounded ${watch(`foamBreakdown.${index}.isRateOverridden`) ? "text-amber-600" : "text-gray-300"}`} title="Toggle override">
                              <AlertCircle className="w-3 h-3" />
                           </button>
                        </div>
                        <div><Input label="Wastage%" type="number" step="0.1" {...register(`foamBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                        <div className="col-span-2 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                           {!hasRate && row?.foamType && row.foamType.trim() && <MissingRateBadge />}
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
                    <div className="col-span-3">Component</div><div className="col-span-3">Fabric Type</div><div>Meters</div><div>Rate/M</div><div>Wastage%</div><div className="col-span-3 text-right pr-4 text-purple-900">Total</div>
                  </div>
                  {fabricFields.map((field, index) => {
                    const row = watchedFabric?.[index];
                    const calc = row ? calculateFabricRow(row as any) : null;
                    return (
                      <div key={field.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl border bg-purple-50/10 border-purple-100 hover:shadow-md transition-all">
                        <div className="col-span-3"><Input label="Component" {...register(`fabricBreakdown.${index}.componentName`)} /></div>
                        <div className="col-span-3"><Input label="Fabric Type" {...register(`fabricBreakdown.${index}.fabricType`)} /></div>
                        <div><Input label="Meters" type="number" step="0.01" {...register(`fabricBreakdown.${index}.metersRequired`, { valueAsNumber: true })} /></div>
                        <div><Input label="Rate" type="number" {...register(`fabricBreakdown.${index}.ratePerMeter`, { valueAsNumber: true })} /></div>
                        <div><Input label="Wastage%" type="number" {...register(`fabricBreakdown.${index}.wastagePercent`, { valueAsNumber: true })} /></div>
                        <div className="col-span-3 text-right flex items-center justify-end gap-3 pt-6 lg:pt-0">
                           <p className="text-sm font-bold text-purple-900">₹{calc?.totalCost?.toFixed(2) || '0'}</p>
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
              <Button variant="ghost" type="button" onClick={() => setStep(1)} className="flex-1 lg:flex-none h-[64px] border-gray-200"><ArrowLeft className="w-5 h-5 mr-3" /> Back</Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1 lg:flex-none h-[64px] bg-amber-600 hover:bg-amber-700 text-white shadow-lg text-lg font-bold">Review Changes <ArrowRight className="w-5 h-5 ml-3" /></Button>
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
                      <Select label="Factory Expense %" options={[{label:'30%', value:30}, {label:'35%', value:35}, {label:'40%', value:40}]} {...register("factoryExpensePercent", { valueAsNumber: true })} />
                      <Input label="Profit Markup (%)" type="number" {...register("markupPercent", { valueAsNumber: true })} />
                      <Input label="GST (%)" type="number" {...register("gstPercent", { valueAsNumber: true })} />
                   </div>
                </Card>

                <div className="bg-white/50 p-6 rounded-2xl border border-blue-100">
                   <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2"><Beaker className="w-4 h-4" /> Efficiency Metrics</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-xl border border-blue-50">
                         <p className="text-[10px] text-gray-400 font-bold uppercase">Estimated Wastage</p>
                         <p className="text-lg font-black text-red-600">₹{summary.totalWastageAmount.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-blue-50">
                         <p className="text-[10px] text-gray-400 font-bold uppercase">Material to Labour</p>
                         <p className="text-lg font-black text-blue-600">{(summary.totalMaterials / Math.max(summary.totalLabour, 1)).toFixed(1)}x</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="relative lg:sticky lg:top-24 bg-[#2d221c] text-white p-6 md:p-8 rounded-3xl shadow-2xl shadow-amber-900/20 ring-1 ring-white/10">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><Calculator className="w-6 h-6 text-amber-500" /> Quotation Summary</h3>
                <div className="space-y-3 mb-8">
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Wood Cost</span><span className="text-white font-mono">₹{summary.totalWood.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Plywood Cost</span><span className="text-white font-mono">₹{summary.totalPly.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Foam Cost</span><span className="text-white font-mono">₹{summary.totalFoam.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm"><span>Fabric Cost</span><span className="text-white font-mono">₹{summary.totalFabric.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm font-bold pt-2 border-t border-white/5"><span>Internal Cost</span><span className="text-amber-200">₹{summary.totalInternalCost.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/60 text-sm pt-4 border-t border-white/10"><span>Base Selling</span><span className="text-white font-mono">₹{summary.baseAmount.toFixed(2)}</span></div>
                   <div className="flex justify-between text-amber-100/40 text-xs"><span>GST ({watchedGST}%)</span><span className="text-white/40">₹{summary.gstAmount.toFixed(2)}</span></div>
                </div>
                <div className="p-4 bg-amber-600/10 rounded-2xl border border-amber-600/20 mb-8">
                   <p className="text-[10px] text-amber-500 uppercase font-bold tracking-[0.2em] mb-1">Final Grand Total</p>
                   <p className="text-4xl font-black text-white">₹{summary.grandTotal.toFixed(2)}</p>
                </div>
                <Button className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-lg border-none shadow-xl" type="submit"><Save className="w-5 h-5 mr-2" /> Update & Download</Button>
                <Button variant="ghost" onClick={() => setStep(2)} className="w-full mt-2 text-white/40 hover:text-white" type="button"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
             </div>
          </div>
        )}
      </form>
      
      {/* Mobile Sticky Summary Footer */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[#2d221c] text-white p-4 z-40 border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest opacity-70 font-black">Total Quote</p>
            <p className="text-xl font-black text-amber-50">₹{(summary.grandTotal || 0).toLocaleString(undefined, {maximumFractionDigits:0})}</p>
          </div>
          <div className="text-right flex items-center gap-3">
             <div className="pr-2 border-r border-white/10">
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest opacity-70">Profit</p>
                <p className="text-sm font-bold text-green-400">{summary.profitPercent || 0}%</p>
             </div>
             {step < 3 ? (
               <Button type="button" size="sm" onClick={() => setStep(step + 1)} className="bg-amber-600 h-10 px-4">Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
             ) : (
               <Button type="button" size="sm" onClick={() => handleSubmit(onSubmit)()} className="bg-amber-600 h-10 px-4 font-bold">Update</Button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
