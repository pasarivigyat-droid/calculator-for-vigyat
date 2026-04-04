"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { 
  Plus, Trash2, Calculator, Save, ArrowRight, ArrowLeft,
  AlertCircle, ChevronUp, AlertTriangle, 
  Trees, Layers, Wind, User, Activity, Percent, Image as ImageIcon, Calendar, X, Camera
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Quotation, CustomerType, WoodMaster, PlyMaster, FoamMaster } from "@/types";
import { 
  calculateGunFoot, calculateWoodRow, calculatePlyRow, calculateFoamRow, calculateFabricRow,
  calculateFinalQuotation, findWoodMaster, findPlyMaster, findFoamMaster 
} from "@/lib/utils/calculations";
import { getWoodMasters, getPlyMasters, getFoamMasters, updateQuotation, getQuotation } from "@/lib/firebase/services";
import { useParams, useRouter } from "next/navigation";
import { compressImage } from "@/lib/utils/image_compression";

const PRODUCT_CATEGORIES = [
  "Chair", "Sofa", "Bed Frame", "Jhula", "Planter Stand", "Lounge Chair", "Dining Table", "Centre Table", "Side Table"
];

const CLIENT_TYPES: CustomerType[] = [
  'Architect', 'Interior Designer', 'House Owner', 'Distributor', 'Third-party Seller', 'Furniture Showroom', 'Other'
];

export const dynamic = 'force-dynamic';

export default function EditQuotePage() {
  const { id } = useParams() as { id: string };
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<Quotation>({
    defaultValues: {
      woodBreakdown: [],
      plyBreakdown: [],
      foamBreakdown: [],
      fabricBreakdown: [],
      gstPercent: 18,
      includeGST: true,
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

  const watchedWood = useWatch({ control, name: "woodBreakdown" });
  const watchedPly = useWatch({ control, name: "plyBreakdown" });
  const watchedFoam = useWatch({ control, name: "foamBreakdown" });
  const watchedCategory = watch("productCategory");

  useEffect(() => {
    const init = async () => {
      const [w, p, f, quoteData] = await Promise.all([
        getWoodMasters(), getPlyMasters(), getFoamMasters(), getQuotation(id)
      ]);
      setWoodMasters(w); setPlyMasters(p); setFoamMasters(f);
      if (quoteData) {
        reset(quoteData);
        if (quoteData.productImage) setPreview(quoteData.productImage);
      }
    };
    init();
  }, [id, reset]);

  // AUTO-RATE LOGIC (Consistent with New page)
  useEffect(() => {
    (watchedWood || []).forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findWoodMaster(row.woodType, row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters);
      if (match) {
        if (row.rate_per_gf !== match.rate_per_gf) {
          setValue(`woodBreakdown.${index}.rate_per_gf`, match.rate_per_gf);
        }
      } else if (row.rate_per_gf !== 0) {
        setValue(`woodBreakdown.${index}.rate_per_gf`, 0);
      }
    });
  }, [watchedWood, woodMasters, setValue]);

  useEffect(() => {
    (watchedPly || []).forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      
      const availableThicknesses = Array.from(new Set(plyMasters.filter(m => m.ply_category === row.plyCategory).map(m => Number(m.thickness_mm))));
      let currentThickness = Number(row.thickness_mm);
      
      if (availableThicknesses.length === 1 && currentThickness !== availableThicknesses[0]) {
        currentThickness = availableThicknesses[0];
        setValue(`plyBreakdown.${index}.thickness_mm`, currentThickness.toString());
      } else if (availableThicknesses.length > 0 && !availableThicknesses.includes(currentThickness) && currentThickness === 18) {
         // Default was 18, but 18 isn't available for this ply, pick the first
         currentThickness = availableThicknesses[0];
         setValue(`plyBreakdown.${index}.thickness_mm`, currentThickness.toString());
      }

      const match = findPlyMaster(row.plyCategory, currentThickness || 0, plyMasters);
      if (match) {
        if (row.rate_per_sqft !== match.rate_per_sqft) {
          setValue(`plyBreakdown.${index}.rate_per_sqft`, match.rate_per_sqft);
        }
      } else if (row.rate_per_sqft !== 0) {
        setValue(`plyBreakdown.${index}.rate_per_sqft`, 0);
      }
    });
  }, [watchedPly, plyMasters, setValue]);

  useEffect(() => {
    (watchedFoam || []).forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findFoamMaster(row.foamType, row.specification, foamMasters);
      if (match) {
        if (row.master_rate !== match.base_rate) {
          setValue(`foamBreakdown.${index}.master_rate`, match.base_rate);
        }
      } else if (row.master_rate !== 0) {
        setValue(`foamBreakdown.${index}.master_rate`, 0);
      }
    });
  }, [watchedFoam, foamMasters, setValue]);

  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setPreview(compressed);
        setValue("productImage", compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: Quotation) => {
    setIsSubmitting(true);
    try {
      const summary = calculateFinalQuotation(
        data.woodBreakdown.map(r => calculateWoodRow(r)),
        data.plyBreakdown.map(r => calculatePlyRow(r as any)),
        data.foamBreakdown.map(r => calculateFoamRow(r as any)),
        data.fabricBreakdown.map(r => calculateFabricRow(r as any)),
        data.labour, { amount: data.miscellaneous.amount },
        data.factoryExpensePercent, data.markupPercent, data.gstPercent,
        data.includeGST === undefined ? true : data.includeGST
      );
      await updateQuotation(id, { ...data, summary, updatedAt: new Date() });
      router.push('/quotes');
    } catch (err) { alert("Save Error"); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-transparent pb-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="mb-10 flex gap-4 overflow-x-auto no-scrollbar py-4 border-b border-amber-900/5">
           {['Identity', 'Structure', 'Formulation', 'Audit'].map((t, i) => (
             <button type="button" key={t} onClick={() => setStep(i+1)} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${step === i+1 ? 'bg-[#2d221c] text-white shadow-lg' : 'text-gray-400 hover:text-amber-900'}`}>{t}</button>
           ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          
          {step === 1 && (
             <div className="bg-white p-8 md:p-14 rounded-[30px] border border-amber-900/5 shadow-wood animate-in fade-in">
                <div className="flex items-center gap-4 mb-10"><User className="text-amber-700 w-6 h-6" /><h2 className="text-2xl font-serif text-[#2d221c]">Revision Identity</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-8">
                      <Input label="Customer Name" {...register("customerName", { required: true })} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Select label="Category" options={PRODUCT_CATEGORIES.map(c => ({ label: c, value: c }))} {...register("productCategory")} />
                        <Select label="Type of Client" options={CLIENT_TYPES.map(t => ({ label: t, value: t }))} {...register("customerType")} />
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-900/5">
                        <Calendar className="w-5 h-5 text-amber-700 opacity-50" /><Input label="Valuation Date" type="date" {...register("date")} className="bg-transparent border-none p-0 h-auto w-full" />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-widest block ml-1">Image Inserting</label>
                      <div className="relative aspect-video rounded-[30px] border-2 border-dashed border-amber-900/10 bg-amber-50/20 flex flex-col items-center justify-center overflow-hidden group hover:border-amber-500/50 transition-all">
                         {preview ? (<><img src={preview} className="w-full h-full object-cover" /><button type="button" onClick={() => setPreview(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button></>) : (
                           <label className="cursor-pointer flex flex-col items-center gap-3"><div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700"><Camera className="w-8 h-8" /></div><p className="text-[10px] font-black uppercase text-amber-900/40">Tap to Upload</p><input type="file" accept="image/*" onChange={onImageChange} className="hidden" /></label>
                         )}
                      </div>
                   </div>
                </div>
                <div className="flex justify-end pt-10"><Button type="button" onClick={() => setStep(2)} className="h-16 px-12 bg-[#2d221c] text-white rounded-2xl font-serif">Continue Revision <ArrowRight className="ml-3" /></Button></div>
             </div>
          )}

          {step === 2 && (
             <div className="space-y-10 animate-in fade-in duration-500">
                <div className="bg-white p-6 md:p-10 rounded-[30px] shadow-wood border border-amber-900/5">
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Trees className="text-amber-700" /> Solid Wood Breakdown</h2><Button type="button" variant="outline" size="sm" onClick={() => appendWood({ id: Date.now().toString(), componentName: '', woodType: (woodTypes[0] || ''), length_ft: 0, width_in:0, thickness_in:0, quantity: 1, wastage_percent: 3, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false })} className="text-[10px] font-black uppercase">+ Add Wood</Button></div>
                  <div className="space-y-4">
                    {woodFields.map((field, index) => {
                      const row = watchedWood?.[index] as any;
                      const hasRateMatch = !!findWoodMaster(row.woodType, row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters);
                      return (
                        <div key={field.id} className="p-4 rounded-[20px] bg-amber-50/10 border border-amber-900/5"><div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                           <div className="col-span-2 lg:col-span-3"><Select label="Wood Type" options={woodTypes.map(t => ({ label: t, value: t }))} {...register(`woodBreakdown.${index}.woodType`)} /></div>
                           <div className="col-span-1"><Input label="L (ft)" {...register(`woodBreakdown.${index}.length_ft`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="W (in)" {...register(`woodBreakdown.${index}.width_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="T (in)" {...register(`woodBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Wast %" {...register(`woodBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Qty" {...register(`woodBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                           <div className="col-span-2 lg:col-span-3 relative">
                              <Input label="Rate" readOnly={hasRateMatch} {...register(`woodBreakdown.${index}.rate_per_gf`, { valueAsNumber: true })} />
                              {hasRateMatch ? (
                                <p className="absolute left-1 -bottom-4 text-[8px] font-black text-amber-600/40 uppercase tracking-tighter italic">Auto-Locked</p>
                              ) : (
                                row?.length_ft > 0 && <p className="absolute left-1 -bottom-4 text-[8px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">Enter Custom Price</p>
                              )}
                           </div>
                           <div className="col-span-2 lg:col-span-1 flex justify-center"><button type="button" onClick={() => removeWood(index)}><Trash2 className="w-5 h-5 text-rose-500" /></button></div>
                        </div></div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white p-6 md:p-10 rounded-[30px] shadow-wood border border-amber-900/5">
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Layers className="text-blue-700" /> Engineering Board (Ply)</h2><Button type="button" variant="outline" size="sm" onClick={() => appendPly({ id: Date.now().toString(), componentName: '', plyCategory: (plyCategories[0] || ''), thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 })} className="text-[10px] font-black uppercase">+ Add Board</Button></div>
                  <div className="space-y-4">
                    {plyFields.map((field, index) => {
                      const row = watchedPly?.[index] as any;
                      const hasRateMatch = !!findPlyMaster(row?.plyCategory, row?.thickness_mm || 0, plyMasters);
                      return (
                        <div key={field.id} className="p-4 rounded-[20px] bg-blue-50/10 border border-blue-900/5"><div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                           <div className="col-span-2 lg:col-span-3"><Select label="Board Category" options={plyCategories.map(c => ({ label: c, value: c }))} {...register(`plyBreakdown.${index}.plyCategory`)} /></div>
                           <div className="col-span-1 lg:col-span-2 pb-2"><Select label="Thickness" options={Array.from(new Set(plyMasters.filter(m => m.ply_category === row?.plyCategory).map(m => m.thickness_mm))).map((v:any) => ({label: `${v}mm`, value: v}))} {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="L (in)" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="W (in)" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Qty" {...register(`plyBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                           <div className="col-span-2 lg:col-span-3 relative">
                              <Input label="Rate" readOnly={hasRateMatch} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} />
                              {hasRateMatch ? (
                                <p className="absolute left-1 -bottom-4 text-[8px] font-black text-blue-600/40 uppercase tracking-tighter italic">Auto-Locked</p>
                              ) : (
                                row?.cut_length_in > 0 && <p className="absolute left-1 -bottom-4 text-[8px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">Enter Custom Price</p>
                              )}
                           </div>
                           <div className="col-span-2 lg:col-span-1 flex justify-center"><button type="button" onClick={() => removePly(index)}><Trash2 className="w-5 h-5 text-rose-500" /></button></div>
                        </div></div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between items-center"><Button type="button" onClick={() => setStep(1)} variant="ghost" className="h-16 px-10">Back</Button><Button type="button" onClick={() => setStep(3)} className="h-16 px-16 bg-[#2d221c] text-white rounded-2xl">Confirm Comfort <ArrowRight className="ml-4" /></Button></div>
             </div>
          )}

          {step === 3 && (
             <div className="space-y-10 animate-in fade-in duration-500">
                <div className="bg-white p-6 md:p-10 rounded-[30px] border border-amber-900/5 shadow-wood">
                   <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Wind className="text-orange-700" /> Comfort Breakdown</h2><Button type="button" variant="outline" size="sm" onClick={() => appendFoam({ id: Date.now().toString(), foamType: (foamTypes[0] || ''), specification: '', thickness_mm: 0, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 })} className="text-[10px] font-black uppercase">+ Add Foam</Button></div>
                   <div className="space-y-4">
                     {foamFields.map((field, index) => {
                       const row = watchedFoam?.[index] as any;
                       const hasRateMatch = !!findFoamMaster(row?.foamType, row?.specification, foamMasters);
                       return (
                         <div key={field.id} className="p-4 rounded-[20px] bg-orange-50/10 border border-orange-900/5"><div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                            <div className="col-span-2 lg:col-span-2"><Select label="Foam Type" options={foamTypes.map(t => ({ label: t, value: t }))} {...register(`foamBreakdown.${index}.foamType`)} /></div>
                            <div className="col-span-2 lg:col-span-2 pb-2"><Select label="Specification" options={getFoamSpecs(row?.foamType || '').map(s => ({ label: s, value: s }))} {...register(`foamBreakdown.${index}.specification`)} /></div>
                            <div className="col-span-1"><Input label="Thickness (mm)" {...register(`foamBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                            <div className="col-span-1"><Input label="L (in)" {...register(`foamBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                            <div className="col-span-1"><Input label="W (in)" {...register(`foamBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                            <div className="col-span-1"><Input label="Qty" {...register(`foamBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                            <div className="col-span-2 lg:col-span-3 relative">
                               <Input label="Rate" readOnly={hasRateMatch} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} />
                               {hasRateMatch ? (
                                 <p className="absolute left-1 -bottom-4 text-[8px] font-black text-orange-600/40 uppercase tracking-tighter italic">Auto-Locked</p>
                               ) : (
                                 row?.foamType && <p className="absolute left-1 -bottom-4 text-[8px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">Enter Custom Price</p>
                               )}
                            </div>
                            <div className="col-span-2 lg:col-span-1 flex justify-center"><button type="button" onClick={() => removeFoam(index)}><Trash2 className="w-5 h-5 text-rose-500" /></button></div>
                         </div></div>
                       );
                     })}
                   </div>
                </div>
                <div className="flex justify-between items-center"><Button type="button" onClick={() => setStep(2)} variant="ghost" className="h-16 px-10">Back</Button><Button type="button" onClick={() => setStep(4)} className="h-16 px-16 bg-[#2d221c] text-white rounded-2xl">Final Audit <ArrowRight className="ml-4" /></Button></div>
             </div>
          )}

          {step === 4 && (
             <div className="space-y-10 animate-in fade-in duration-500">
                <div className="bg-white p-10 rounded-[30px] border border-amber-900/5 shadow-wood">
                   <div className="flex items-center gap-4 mb-10"><Activity className="text-amber-700" /><h2 className="text-2xl font-serif">Revision Audit</h2></div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <Input label="Carpenter Rev." type="number" {...register("labour.carpenter", { valueAsNumber: true })} />
                        <Input label="Polish Rev." type="number" {...register("labour.polish", { valueAsNumber: true })} />
                        <Input label="Upholstery Rev." type="number" {...register("labour.foam", { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-6 bg-amber-50/20 p-8 rounded-[30px] border border-amber-900/5">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-amber-900/5 shadow-sm">
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest text-[#2d221c]">Apply GST Tax</p>
                              <p className="text-[8px] text-amber-900/40 font-bold uppercase mt-1">Include 18% in final total?</p>
                           </div>
                           <input type="checkbox" {...register("includeGST")} className="w-6 h-6 rounded-lg accent-[#2d221c]" />
                        </div>
                        <Input label="Revised Markup %" type="number" {...register("markupPercent", { valueAsNumber: true })} />
                        <Input label="Revised GST %" type="number" {...register("gstPercent", { valueAsNumber: true })} />
                      </div>
                   </div>
                </div>
                <div className="flex justify-between">
                   <Button type="button" onClick={() => setStep(3)} variant="ghost" className="h-16 px-10">Back</Button>
                   <Button type="submit" disabled={isSubmitting} className="h-20 px-24 bg-black text-white rounded-3xl text-2xl font-serif hover:scale-105 transition-all">Confirm Revision</Button>
                </div>
             </div>
          )}
        </form>

        <LiveValuationBar control={control} />
      </div>
    </div>
  );
}

function LiveValuationBar({ control }: { control: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const watchedValues = useWatch({ control });
  const deferredValues = React.useDeferredValue(watchedValues);
  
  const summary = useMemo(() => calculateFinalQuotation(
    (deferredValues.woodBreakdown || []).map((r: any) => calculateWoodRow(r)),
    (deferredValues.plyBreakdown || []).map((r: any) => calculatePlyRow(r as any)),
    (deferredValues.foamBreakdown || []).map((r: any) => calculateFoamRow(r as any)),
    (deferredValues.fabricBreakdown || []).map((r: any) => calculateFabricRow(r as any)),
    deferredValues.labour || { carpenter: 0, polish: 0, foam: 0, total: 0 },
    deferredValues.miscellaneous || { amount: 0, total: 0 },
    deferredValues.factoryExpensePercent || 30,
    deferredValues.markupPercent || 20,
    deferredValues.gstPercent || 18,
    deferredValues.includeGST === undefined ? true : deferredValues.includeGST
  ), [deferredValues]);

  return (
    <div className={`fixed left-0 right-0 z-[100] transition-all duration-500 bg-white border-t border-amber-900/10 ${isExpanded ? 'bottom-0 h-[380px]' : 'bottom-0 h-24'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex flex-col">
        <div className="h-24 flex items-center justify-between">
          <div><p className="text-[10px] uppercase opacity-40 font-black tracking-widest">Revised Valuation</p><p className="text-3xl font-serif">₹{(summary?.grandTotal || 0).toLocaleString()}</p></div>
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="px-6 py-3 bg-amber-50 rounded-xl text-xs font-black uppercase text-amber-900 flex items-center gap-2">Deep Audit <ChevronUp className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
        </div>
         {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 py-10 border-t border-amber-900/5 animate-in slide-in-from-bottom-5">
             <div className="space-y-4">
                <p className="text-[10px] font-black opacity-30 uppercase border-b pb-2 tracking-widest">Base Pool</p>
                <div className="flex justify-between font-serif text-xl font-light"><span>Raw Base</span><span>₹{(summary?.totalInternalCost || 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Wood Pool</span><span>₹{(summary?.totalWood || 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Board Pool</span><span>₹{(summary?.totalPly || 0).toLocaleString()}</span></div>
             </div>
             <div className="space-y-4">
                <p className="text-[10px] opacity-30 font-black uppercase tracking-widest border-b pb-2">Tax Buffer</p>
                {deferredValues?.includeGST !== false && (
                  <div className="flex justify-between font-serif text-xl font-light"><span>GST (at {deferredValues?.gstPercent || 18}%)</span><span>₹{(summary?.gstAmount || 0).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Operational</span><span>₹{(summary?.factoryExpenseAmount || 0).toLocaleString()}</span></div>
             </div>
             <div className="bg-[#2d221c] p-10 rounded-[30px] text-white flex flex-col justify-center shadow-2xl relative overflow-hidden"><div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div><p className="text-[10px] font-black text-amber-500 uppercase mb-3 tracking-[0.3em]">Final Revised Amount</p><p className="text-5xl font-serif">₹{(summary?.grandTotal || 0).toLocaleString()}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
