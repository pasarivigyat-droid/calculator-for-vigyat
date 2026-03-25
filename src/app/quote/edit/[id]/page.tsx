"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { 
  Plus, Trash2, Calculator, Save, ArrowRight, ArrowLeft,
  AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Beaker,
  Copy, CheckCircle2, Printer, ExternalLink, Package, Trees, Layers, Wind,
  User, Calendar, Tag, Image as ImageIcon, Sparkles, Hammer, Activity
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Quotation, CustomerType, WoodMaster, PlyMaster, FoamMaster, FabricMaster, WoodRow, PlyRow, FoamRow, FabricRow, QuoteStatus } from "@/types";
import { 
  calculateGunFoot, calculateWoodRow, calculatePlyRow, calculateFoamRow, calculateFabricRow,
  calculateFinalQuotation, findWoodMaster, findPlyMaster, findFoamMaster, getWoodMatchReason, getPlyMatchReason, getFoamMatchReason
} from "@/lib/utils/calculations";
import { getWoodMasters, getPlyMasters, getFoamMasters, getFabricMasters, getMarkupSettings, updateQuotation, getQuotation } from "@/lib/firebase/services";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/utils/image_compression";

const STEPS = [
  { id: 1, title: "Identity", subtitle: "Client & Project" },
  { id: 2, title: "Structure", subtitle: "Wood & Boards" },
  { id: 3, title: "Comfort", subtitle: "Foam & Fabric" },
  { id: 4, title: "Audit", subtitle: "Labour & Yield" }
];

export default function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const [step, setStep] = useState(1);
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [fabricMasters, setFabricMasters] = useState<FabricMaster[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    const init = async () => {
      const [w, p, f, fab, quoteData] = await Promise.all([
        getWoodMasters(), getPlyMasters(), getFoamMasters(), getFabricMasters(), getQuotation(id)
      ]);
      setWoodMasters(w);
      setPlyMasters(p);
      setFoamMasters(f);
      setFabricMasters(fab);
      setMastersLoaded(true);
      if (quoteData) reset(quoteData);
    };
    init();
  }, [id, reset]);

  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  // ─── AUTO-RATE LOOKUP LOGIC ───
  useEffect(() => {
    (watchedWood || [])?.forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findWoodMaster(row?.woodType || '', row?.length_ft || 0, row?.width_in || 0, row?.thickness_in || 0, woodMasters);
      if (match) setValue(`woodBreakdown.${index}.rate_per_gf`, match.rate_per_gf);
    });
  }, [watchedWood, woodMasters, setValue]);

  useEffect(() => {
    (watchedPly || [])?.forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findPlyMaster(row?.plyCategory || '', row?.thickness_mm || 0, plyMasters);
      if (match) setValue(`plyBreakdown.${index}.rate_per_sqft`, match.rate_per_sqft);
    });
  }, [watchedPly, plyMasters, setValue]);

  useEffect(() => {
    (watchedFoam || [])?.forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findFoamMaster(row?.foamType || '', row?.specification || '', foamMasters);
      if (match) setValue(`foamBreakdown.${index}.master_rate`, match.base_rate);
    });
  }, [watchedFoam, foamMasters, setValue]);

  const missingRates = useMemo(() => {
    const issues: string[] = [];
    watchedWood?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.rate_per_gf || 0) === 0 && r.woodType) issues.push(`Wood #${i+1}: Missing rate for ${r.woodType}`);
    });
    watchedPly?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.rate_per_sqft || 0) === 0 && r.plyCategory) issues.push(`Ply #${i+1}: Missing rate for ${r.plyCategory}`);
    });
    watchedFoam?.forEach((r: any, i: number) => {
      if (!r.isRateOverridden && (r.master_rate || 0) === 0 && r.foamType) issues.push(`Foam #${i+1}: Missing rate for ${r.foamType}`);
    });
    return issues;
  }, [watchedWood, watchedPly, watchedFoam]);

  const onSubmit = async (data: Quotation) => {
    setIsSubmitting(true);
    try {
      const woodCalc = data.woodBreakdown.map(r => calculateWoodRow(r));
      const plyCalc = data.plyBreakdown.map(r => calculatePlyRow(r as any));
      const foamCalc = data.foamBreakdown.map(r => calculateFoamRow(r as any));
      const fabricCalc = data.fabricBreakdown.map(r => calculateFabricRow(r as any));

      const summary = calculateFinalQuotation(
        woodCalc, plyCalc, foamCalc, fabricCalc,
        data.labour || { carpenter: 0, polish: 0, foam: 0, total: 0 },
        data.miscellaneous || { amount: 0, total: 0 },
        data.factoryExpensePercent || 30,
        data.markupPercent || 20,
        data.gstPercent || 18
      );

      const finalData = { 
        ...data, 
        woodBreakdown: woodCalc,
        plyBreakdown: plyCalc,
        foamBreakdown: foamCalc,
        fabricBreakdown: fabricCalc,
        summary: summary,
        updatedAt: new Date()
      };

      await updateQuotation(id, finalData as any);
      router.push(`/quote/view/${id}`);
    } catch (err: any) {
      alert("Error updating quotation: " + err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-grain fixed inset-0 opacity-[0.015] pointer-events-none"></div>

      {/* Premium Stepper */}
      <div className="mb-12 pt-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-4xl font-serif text-[#2d221c] tracking-tight flex items-center gap-4 justify-center md:justify-start">
               Revision Protocol <span className="text-amber-900/20">/</span> {watchedValues.refCode}
            </h1>
            <p className="text-amber-900/40 text-[10px] font-black uppercase tracking-[0.4em]">{watchedValues.customerName || 'In Audit'}</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-3xl border border-amber-900/5 shadow-wood">
            {STEPS.map((s) => (
              <button 
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-500 ${
                  step === s.id ? 'bg-[#2d221c] text-white shadow-xl translate-y-[-2px]' : 
                  step > s.id ? 'text-emerald-600 bg-emerald-50' : 'text-amber-900/20 hover:bg-amber-50'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-widest">{s.id}. {s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
           
           {/* STEP 1: IDENTITY */}
           {step === 1 && (
             <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="bg-white p-10 rounded-[3rem] border border-amber-900/5 shadow-wood space-y-10 relative overflow-hidden">
                   <div className="bg-grain absolute inset-0 opacity-[0.02] pointer-events-none"></div>
                   <div className="flex items-center gap-4 text-amber-900/20">
                      <User className="w-5 h-5" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Client Identity</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Input label="Strategic Partner / Customer" {...register("customerName", { required: true })} className="font-serif text-xl h-16 border-amber-900/10" />
                      <Select label="Entity Type" options={['Architect', 'Interior Designer', 'House Owner', 'Showroom'].map(t => ({ label: t, value: t }))} {...register("customerType")} className="h-16" />
                      <Input label="Product Designation" placeholder="e.g. Bespoke Walnut Sofa" {...register("productName")} className="font-serif text-xl h-16" />
                      <Input label="Filing Date" type="date" {...register("date")} className="h-16" />
                   </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-amber-900/5 shadow-wood space-y-8 relative">
                   <div className="flex items-center gap-4 text-amber-900/20">
                      <ImageIcon className="w-5 h-5" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Visual Reference</h3>
                   </div>
                   <div className="flex flex-col md:flex-row gap-10 items-center">
                      <div className="w-48 h-48 rounded-[2rem] bg-amber-50 border border-amber-900/5 shadow-inner flex items-center justify-center overflow-hidden group relative">
                         {watch("productImage") ? (
                           <img src={watch("productImage")} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Reference" />
                         ) : (
                           <ImageIcon className="w-12 h-12 text-amber-900/10" />
                         )}
                         <input type="file" id="img" className="hidden" accept="image/*" onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             const reader = new FileReader();
                             reader.onload = async (rv) => {
                               const compressed = await compressImage(rv.target?.result as string, 800, 0.7);
                               setValue("productImage", compressed);
                             };
                             reader.readAsDataURL(file);
                           }
                         }} />
                         <label htmlFor="img" className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity font-serif text-sm backdrop-blur-sm">Replace Image</label>
                      </div>
                      <div className="flex-1 space-y-4">
                         <p className="text-amber-900/40 text-[11px] leading-relaxed italic">Upload high-fidelity reference photos or technical drawings for this unit. Images are compressed locally to maintain system performance.</p>
                         <Button type="button" variant="outline" className="rounded-xl border-amber-900/10" onClick={() => document.getElementById('img')?.click()}>
                            Select Document
                         </Button>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* STEP 2: STRUCTURE */}
           {step === 2 && (
             <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-700">
                {/* Wood Section */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-serif text-[#2d221c] tracking-tight flex items-center gap-3">
                         <Trees className="w-6 h-6 text-amber-600" /> Solid Wood Intelligence
                      </h3>
                   </div>
                   <div className="space-y-4">
                      {woodFields.map((field, index) => {
                        const row = watchedWood?.[index];
                        const gf = row ? calculateGunFoot(row.length_ft, row.width_in, row.thickness_in, row.quantity) : 0;
                        return (
                          <div key={field.id} className="bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood grid grid-cols-12 gap-6 relative group border-l-4 border-l-amber-600/20">
                             <div className="col-span-12 md:col-span-4">
                                <Input label="Component" {...register(`woodBreakdown.${index}.componentName`)} placeholder="e.g. Leg Structure" />
                             </div>
                             <div className="col-span-12 md:col-span-3">
                                <Select label="Species" options={woodTypes.map(t => ({ label: t, value: t }))} {...register(`woodBreakdown.${index}.woodType`)} />
                             </div>
                             <div className="col-span-4 md:col-span-1">
                                <Input label="L(ft)" type="number" step="0.01" {...register(`woodBreakdown.${index}.length_ft`, { valueAsNumber: true })} />
                             </div>
                             <div className="col-span-4 md:col-span-1">
                                <Input label="W(in)" type="number" step="0.5" {...register(`woodBreakdown.${index}.width_in`, { valueAsNumber: true })} />
                             </div>
                             <div className="col-span-4 md:col-span-1">
                                <Input label="T(in)" type="number" step="0.5" {...register(`woodBreakdown.${index}.thickness_in`, { valueAsNumber: true })} />
                             </div>
                             <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-6 pt-6 md:pt-0 border-t md:border-t-0 border-amber-900/5 mt-4 md:mt-0">
                                <div className="text-right">
                                   <p className="text-[10px] font-black text-amber-900/20 uppercase">{gf.toFixed(2)} GF</p>
                                   <p className="text-sm font-bold text-[#2d221c]">₹{((row?.rate_per_gf || 0) * gf).toFixed(0)}</p>
                                </div>
                                <button type="button" onClick={() => removeWood(index)} className="text-amber-900/10 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                             </div>
                          </div>
                        );
                      })}
                      <Button type="button" onClick={() => appendWood({ id: Date.now().toString(), componentName:'', woodType: woodTypes[0], length_ft:0, width_in:0, thickness_in:0, quantity:1, rate_per_gf:0, gun_foot:0, isRateOverridden:false, total_cost:0 })} className="w-full h-20 border-2 border-dashed border-amber-900/10 rounded-[2rem] bg-white text-amber-900/40 hover:bg-amber-50 hover:border-amber-900/20 transition-all font-serif text-lg">
                         <Plus className="w-5 h-5 mr-3 opacity-30" /> Add Structural Member
                      </Button>
                   </div>
                </div>

                {/* Ply Section */}
                <div className="space-y-6">
                   <h3 className="text-2xl font-serif text-[#2d221c] tracking-tight flex items-center gap-3">
                      <Layers className="w-6 h-6 text-amber-600" /> Engineered Board Audit
                   </h3>
                   <div className="space-y-4">
                      {plyFields.map((field, index) => {
                         const row = watchedPly?.[index];
                         const calc = row ? calculatePlyRow(row as any) : null;
                         return (
                           <div key={field.id} className="bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood grid grid-cols-12 gap-6 border-l-4 border-l-blue-600/20">
                              <div className="col-span-12 md:col-span-4">
                                 <Input label="Sub-assembly" {...register(`plyBreakdown.${index}.componentName`)} placeholder="e.g. Side Panels" />
                              </div>
                              <div className="col-span-12 md:col-span-2">
                                 <Select label="Board" options={plyCategories.map(c => ({ label: c, value: c }))} {...register(`plyBreakdown.${index}.plyCategory`)} />
                              </div>
                              <div className="col-span-4 md:col-span-1">
                                 <Input label="T(mm)" type="number" {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} />
                              </div>
                              <div className="col-span-4 md:col-span-1">
                                 <Input label="L(in)" type="number" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} />
                              </div>
                              <div className="col-span-4 md:col-span-1">
                                 <Input label="W(in)" type="number" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} />
                              </div>
                              <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-6 pt-6 md:pt-0">
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-amber-900/20 uppercase">{calc?.sqft?.toFixed(2)} SQFT</p>
                                    <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(0)}</p>
                                 </div>
                                 <button type="button" onClick={() => removePly(index)} className="text-amber-900/10 hover:text-rose-500"><Trash2 className="w-5 h-5"/></button>
                              </div>
                           </div>
                         );
                      })}
                      <Button type="button" onClick={() => appendPly({ id: Date.now().toString(), componentName:'', plyCategory: plyCategories[0], thickness_mm: 18, cut_length_in:0, cut_width_in:0, quantity:1, rate_per_sqft:0, wastage_percent:5, sheet_length_ft:8, sheet_width_ft:4, sqft:0, wastage_amount:0, isRateOverridden:false, total_cost:0 })} className="w-full h-20 border-2 border-dashed border-amber-900/10 rounded-[2rem] bg-white text-amber-900/40 hover:bg-amber-50 font-serif text-lg">
                         <Plus className="w-5 h-5 mr-3 opacity-30" /> Add Panel Protocol
                      </Button>
                   </div>
                </div>
             </div>
           )}

           {/* STEP 3: COMFORT */}
           {step === 3 && (
             <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="space-y-6">
                   <h3 className="text-2xl font-serif text-[#2d221c] tracking-tight flex items-center gap-3">
                      <Wind className="w-6 h-6 text-amber-600" /> Comfort Matrix (Foam)
                   </h3>
                   <div className="space-y-4">
                      {foamFields.map((field, index) => {
                        const row = watchedFoam?.[index];
                        const calc = row ? calculateFoamRow(row as any) : null;
                        return (
                          <div key={field.id} className="bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood grid grid-cols-12 gap-6 border-l-4 border-l-orange-600/20">
                             <div className="col-span-12 md:col-span-4"><Input label="Allocation" {...register(`foamBreakdown.${index}.componentName`)} /></div>
                             <div className="col-span-6 md:col-span-2">
                                <Select label="Type" options={foamTypes.map(t => ({ label: t, value: t }))} {...register(`foamBreakdown.${index}.foamType`)} />
                             </div>
                             <div className="col-span-6 md:col-span-2">
                                <Select label="Spec" options={getFoamSpecs(row?.foamType || '').map(s => ({ label: s, value: s }))} {...register(`foamBreakdown.${index}.specification`)} />
                             </div>
                             <div className="col-span-6 md:col-span-1"><Input label="T(in)" type="number" {...register(`foamBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                             <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-6">
                                <div className="text-right">
                                   <p className="text-[10px] font-black text-amber-900/20 uppercase">{calc?.sqft?.toFixed(2)} SQFT</p>
                                   <p className="text-sm font-bold text-[#2d221c]">₹{calc?.total_cost?.toFixed(0)}</p>
                                </div>
                                <button type="button" onClick={() => removeFoam(index)} className="text-amber-900/10 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                             </div>
                          </div>
                        );
                      })}
                      <Button type="button" onClick={() => appendFoam({ id: Date.now().toString(), componentName:'', foamType:'PU', specification:'32D', thickness_in:0, cut_length_in:0, cut_width_in:0, quantity:1, master_rate:0, wastage_percent:5, sqft:0, rate_per_sqft:0, wastage_amount:0, isRateOverridden:false, total_cost:0 })} className="w-full h-20 border-2 border-dashed border-amber-900/10 rounded-[2rem] bg-white text-amber-900/40 hover:bg-amber-50 font-serif text-lg">
                         <Plus className="w-5 h-5 mr-3 opacity-30" /> Define Cushioning
                      </Button>
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-2xl font-serif text-[#2d221c] tracking-tight flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-amber-600" /> Upholstery & Finish
                   </h3>
                   <div className="space-y-4">
                      {fabricFields.map((field, index) => {
                        const row = watchedFabric?.[index];
                        const calc = row ? calculateFabricRow(row as any) : null;
                        return (
                          <div key={field.id} className="bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood grid grid-cols-12 gap-6 border-l-4 border-l-purple-600/20">
                             <div className="col-span-12 md:col-span-4"><Input label="Surface" {...register(`fabricBreakdown.${index}.componentName`)} /></div>
                             <div className="col-span-12 md:col-span-3"><Input label="Material Ref" {...register(`fabricBreakdown.${index}.fabricType`)} /></div>
                             <div className="col-span-4 md:col-span-1"><Input label="Meters" type="number" {...register(`fabricBreakdown.${index}.metersRequired`, { valueAsNumber: true })} /></div>
                             <div className="col-span-4 md:col-span-1"><Input label="Rate" type="number" {...register(`fabricBreakdown.${index}.ratePerMeter`, { valueAsNumber: true })} /></div>
                             <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-6">
                                <div className="text-right">
                                   <p className="text-[10px] font-black text-amber-900/20 uppercase">Surface Cost</p>
                                   <p className="text-sm font-bold text-[#2d221c]">₹{calc?.totalCost?.toFixed(0)}</p>
                                </div>
                                <button type="button" onClick={() => removeFabric(index)} className="text-amber-900/10 hover:text-rose-500"><Trash2 className="w-5 h-5"/></button>
                             </div>
                          </div>
                        );
                      })}
                      <Button type="button" onClick={() => appendFabric({ id: Date.now().toString(), componentName:'', fabricType:'', metersRequired:0, ratePerMeter:0, wastagePercent:0, totalCost:0, isCustomRate:false })} className="w-full h-20 border-2 border-dashed border-amber-900/10 rounded-[2rem] bg-white text-amber-900/40 hover:bg-amber-50 font-serif text-lg">
                         <Plus className="w-5 h-5 mr-3 opacity-30" /> Add Upholstery Detail
                      </Button>
                   </div>
                </div>
             </div>
           )}

           {/* STEP 4: AUDIT */}
           {step === 4 && (
             <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="bg-white p-10 rounded-[3rem] border border-amber-900/5 shadow-wood space-y-10 relative">
                   <div className="flex items-center gap-4 text-amber-900/20">
                      <Hammer className="w-5 h-5" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Labour & Overheads</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <Input label="Carpenter Labour (₹)" type="number" {...register("labour.carpenter", { valueAsNumber: true })} className="h-16" />
                       <Input label="Polishing / Finish (₹)" type="number" {...register("labour.polish", { valueAsNumber: true })} className="h-16" />
                       <Input label="Foaming / Stitch (₹)" type="number" {...register("labour.foam", { valueAsNumber: true })} className="h-16" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <Input label="Factory Expenses %" type="number" {...register("factoryExpensePercent", { valueAsNumber: true })} className="h-16" />
                       <Input label="Profit Margin %" type="number" {...register("markupPercent", { valueAsNumber: true })} className="h-16" />
                   </div>
                </div>

                <div className="bg-[#2d221c] p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400">Final Verification</h3>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
                       <div className="bg-white/5 p-6 rounded-2xl">
                          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2 font-black">Audit Status</p>
                          <p className="text-xl font-serif">Awaiting Lock</p>
                       </div>
                       <div className="bg-white/5 p-6 rounded-2xl">
                          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2 font-black">Data Integrity</p>
                          <p className="text-xl font-serif">Verified</p>
                       </div>
                       <div className="bg-white/5 p-6 rounded-2xl text-right">
                          <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2 font-black">Production Valuation</p>
                          <p className="text-xl font-serif text-amber-400">View Hub</p>
                       </div>
                    </div>
                   <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row gap-6">
                      <Button type="submit" isLoading={isSubmitting} className="flex-1 h-16 bg-white text-[#2d221c] font-serif text-2xl hover:bg-amber-50 rounded-2xl shadow-xl">
                         Update Quotation Record
                      </Button>
                      <Button type="button" variant="outline" className="h-16 border-white/10 text-white hover:bg-white/5 px-8 flex items-center gap-3 font-serif text-lg" onClick={() => window.open(`/quote/view/${id}?download=true`, '_blank')}>
                         <Printer className="w-5 h-5" /> Generate PDF
                      </Button>
                   </div>
                </div>
             </div>
           )}

           {/* Navigation */}
           <div className="flex items-center gap-4 pt-4">
              {step > 1 && (
                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} className="h-16 px-10 text-amber-900/40 font-serif text-xl border border-amber-900/5 bg-white rounded-2xl shadow-wood">
                   <ArrowLeft className="w-5 h-5 mr-3" /> Back
                </Button>
              )}
              {step < 4 && (
                <Button type="button" onClick={() => setStep(step + 1)} className="flex-1 h-16 bg-[#2d221c] text-white font-serif text-2xl rounded-2xl shadow-xl shadow-amber-900/10">
                   Continue <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              )}
           </div>
      </form>

      {/* Intelligence Pop-up Button */}
      <IntelligenceHub control={control} missingRates={missingRates} customerName={watchedValues.customerName} />
    </div>
  );
}

function IntelligenceHub({ control, missingRates, customerName }: { control: any, missingRates: string[], customerName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const watchedValues = useWatch({ control });
  
  const summary = useMemo(() => {
    return calculateFinalQuotation(
      (watchedValues.woodBreakdown || []).map((r: any) => calculateWoodRow(r as any)),
      (watchedValues.plyBreakdown || []).map((r: any) => calculatePlyRow(r as any)),
      (watchedValues.foamBreakdown || []).map((r: any) => calculateFoamRow(r as any)),
      (watchedValues.fabricBreakdown || []).map((r: any) => calculateFabricRow(r as any)),
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

  return (
    <>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="fixed bottom-10 right-10 w-20 h-20 bg-[#2d221c] text-white rounded-[2rem] shadow-2xl z-[100] border-t border-white/20 flex flex-col items-center justify-center gap-1 group overflow-hidden">
        <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
        <Calculator className={`w-8 h-8 transition-transform duration-500 ${isOpen ? 'rotate-90 scale-75' : 'group-hover:scale-110'}`} />
        <span className="text-[8px] font-black uppercase tracking-widest">{isOpen ? 'Close' : 'View Hub'}</span>
        {missingRates.length > 0 && <div className="absolute top-4 right-4 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#2d221c] animate-pulse" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
          <div className="bg-[#2d221c] text-white w-full max-w-2xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/10 animate-in zoom-in-95 duration-500">
            <div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div>
            <div className="p-10 md:p-14 relative z-10 space-y-10">
               <div className="flex items-center justify-between border-b border-white/5 pb-8">
                  <div className="flex items-center gap-4 text-amber-500"><Activity className="w-6 h-6"/><h3 className="text-3xl font-serif text-white">Intelligence Revision</h3></div>
                  <div className="text-right font-serif opacity-50 px-4">Audit Active</div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest font-black text-[10px]">Material Hub</span><span className="font-serif text-2xl font-light">₹{summary.totalMaterials.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest font-black text-[10px]">Operational Total</span><span className="font-serif text-2xl font-light">₹{summary.totalInternalCost.toLocaleString()}</span></div>
                    <div className="pt-6 border-t border-white/5 flex justify-between items-end"><div className="space-y-1"><p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Internal Cost</p><p className="text-4xl font-serif font-light">₹{summary.totalInternalCost.toLocaleString()}</p></div></div>
                  </div>
                  <div className="bg-amber-500/10 p-10 rounded-[2.5rem] border border-amber-500/20 shadow-inner flex flex-col justify-center items-center text-center">
                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-4">Market Valuation</p>
                    <p className="text-6xl font-serif text-white tracking-tighter">₹{summary.grandTotal.toLocaleString()}</p>
                    <div className="mt-8 flex gap-6 text-[10px] font-black uppercase tracking-widest"><span className="text-emerald-400">Yield: {summary.profitPercent}%</span></div>
                  </div>
               </div>
               <Button onClick={() => setIsOpen(false)} className="w-full h-16 bg-white text-[#2d221c] rounded-2xl font-serif text-xl hover:bg-amber-50">Back to Refinement</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
