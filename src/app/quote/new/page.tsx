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
  Trees,
  Layers,
  Wind,
  User,
  ClipboardCheck,
  Percent,
  ChevronUp,
  Image as ImageIcon,
  Calendar,
  X,
  Camera,
  Activity,
  BookOpen,
  Tag as TagIcon,
  Archive,
  CheckCircle2,
  Factory
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { 
  getWoodMasters, 
  getPlyMasters, 
  getFoamMasters, 
  createQuotation,
  createProductLibraryItem,
  checkSkuExists,
  getProductCountByCategory,
  getMarkupSettings
} from "@/lib/firebase/services";
import { Quotation, WoodMaster, PlyMaster, FoamMaster, WoodRow, PlyRow, FoamRow, CustomerType, FabricRow, FabricMaster, CustomerMarkupSetting } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { generateRefCode } from "@/lib/utils/formatters";
import { compressImage } from "@/lib/utils/image_compression";
import { 
  calculateGunFoot, 
  calculateWoodRow, 
  calculatePlyRow, 
  calculateFoamRow, 
  calculateFabricRow,
  calculateFinalQuotation,
  findWoodMaster,
  findPlyMaster,
  findFoamMaster,
  getWoodMatchReason
} from "@/lib/utils/calculations";

export const dynamic = 'force-dynamic';

const PRODUCT_CATEGORIES = [
  "Chair", "Sofa", "Bed Frame", "Jhula", "Planter Stand", "Lounge Chair", "Dining Table", "Centre Table", "Side Table"
];

const STEPS = [
  { id: 1, title: "Identity", subtitle: "Project Base", icon: User },
  { id: 2, title: "Structure", subtitle: "Wood & Boards", icon: Trees },
  { id: 3, title: "Comfort", subtitle: "Foam & Cushion", icon: Wind },
  { id: 4, title: "Services", subtitle: "Labour & Expense", icon: Activity }
];

export default function NewQuotePage() {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [libraryData, setLibraryData] = useState({
    sku: '',
    name: '',
    category: '',
    description: '',
    tags: ''
  });
  const [isLibrarySaving, setIsLibrarySaving] = useState(false);
  const router = useRouter();

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Quotation>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      productCategory: PRODUCT_CATEGORIES[0],
      customerType: 'Architect',
      productName: '', 
      woodBreakdown: [],
      plyBreakdown: [],
      foamBreakdown: [],
      fabricBreakdown: [],
      status: 'Draft',
      gstPercent: 18,
      includeGST: true,
      factoryExpensePercent: 30,
      markupPercent: 0,
      labour: { carpenter: 0, polish: 0, foam: 0, total: 0 },
      miscellaneous: { amount: 0, total: 0 },
      isArchived: false
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
    if (watchedCategory) setValue("productName", watchedCategory);
  }, [watchedCategory, setValue]);

  useEffect(() => {
    const loadMasters = async () => {
      const [w, p, f] = await Promise.all([
        getWoodMasters(), 
        getPlyMasters(), 
        getFoamMasters()
      ]);
      setWoodMasters(w); 
      setPlyMasters(p); 
      setFoamMasters(f);
    };
    loadMasters();
  }, []);

  // AUTO-RATE LOGIC (Aggressive Sync)
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

  const woodTypes = useMemo(() => Array.from(new Set(woodMasters.map(m => m.wood_type))).sort(), [woodMasters]);
  const plyCategories = useMemo(() => Array.from(new Set(plyMasters.map(m => m.ply_category))).sort(), [plyMasters]);
  const foamTypes = useMemo(() => Array.from(new Set(foamMasters.map(m => m.foam_type))).sort(), [foamMasters]);
  const getFoamSpecs = (type: string) => foamMasters.filter(m => m.foam_type === type).map(m => m.specification).sort();

  // Save as quotation (legacy flow for backward compatibility)
  const onSubmit = async (data: Quotation) => {
    setIsSubmitting(true);
    try {
      const summary = calculateFinalQuotation(
        data.woodBreakdown.map((r: WoodRow) => calculateWoodRow(r)),
        data.plyBreakdown.map((r: PlyRow) => calculatePlyRow(r as any)),
        data.foamBreakdown.map((r: FoamRow) => calculateFoamRow(r as any)),
        data.fabricBreakdown.map((r: FabricRow) => calculateFabricRow(r as any)),
        data.labour, { amount: data.miscellaneous.amount },
        data.factoryExpensePercent, 0, data.gstPercent,
        data.includeGST === undefined ? true : data.includeGST
      );
      const { id, createdAt, updatedAt, ...quoteData } = data;
      await createQuotation({ ...quoteData, refCode: generateRefCode(), summary, status: data.status || 'Draft', createdBy: 'admin' });
      router.push('/quotes');
    } catch (err) { alert("Error saving valuation."); } finally { setIsSubmitting(false); }
  };

  const openLibraryModal = async () => {
    const currentName = watch("productName") || watch("productCategory");
    const currentCategory = watch("productCategory");
    
    const count = await getProductCountByCategory(currentCategory);
    const suggestedSku = `${currentCategory.substring(0, 3).toUpperCase()}-${(count + 1).toString().padStart(3, '0')}`;
    
    setLibraryData({
      sku: suggestedSku,
      name: currentName,
      category: currentCategory,
      description: '',
      tags: ''
    });
    setIsLibraryModalOpen(true);
  };

  const onSaveToLibrary = async () => {
    if (!libraryData.sku || !libraryData.name) {
      alert("SKU and Name are required");
      return;
    }

    setIsLibrarySaving(true);
    try {
      const exists = await checkSkuExists(libraryData.sku);
      if (exists) {
        if (!confirm("SKU already exists. Do you want to continue with a duplicate SKU? (Not recommended)")) {
          setIsLibrarySaving(false);
          return;
        }
      }

      const data = watch();
      const summary = calculateFinalQuotation(
        data.woodBreakdown.map(r => calculateWoodRow(r)),
        data.plyBreakdown.map(r => calculatePlyRow(r as any)),
        data.foamBreakdown.map(r => calculateFoamRow(r as any)),
        data.fabricBreakdown.map(r => calculateFabricRow(r as any)),
        data.labour, { amount: data.miscellaneous.amount },
        data.factoryExpensePercent, 0, 0, false
      );

      await createProductLibraryItem({
        sku: libraryData.sku,
        name: libraryData.name,
        category: libraryData.category,
        image: data.productImage,
        description: libraryData.description,
        tags: libraryData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        woodBreakdown: data.woodBreakdown.map((r: WoodRow) => calculateWoodRow(r)),
        plyBreakdown: data.plyBreakdown.map((r: PlyRow) => calculatePlyRow(r as any)),
        foamBreakdown: data.foamBreakdown.map((r: FoamRow) => calculateFoamRow(r as any)),
        fabricBreakdown: data.fabricBreakdown.map((r: FabricRow) => calculateFabricRow(r as any)),
        labour: data.labour,
        miscellaneous: { amount: data.miscellaneous.amount, total: (Number(data.miscellaneous.amount) || 0) },
        factoryExpensePercent: data.factoryExpensePercent,
        totalInternalCost: summary.totalInternalCost,
        totalMaterials: summary.totalMaterials,
        totalLabour: summary.totalLabour,
        totalWastageAmount: summary.totalWastageAmount,
        createdBy: 'admin'
      });

      setSaveSuccess(true);
      setIsLibraryModalOpen(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Error saving to library: " + err.message);
    } finally {
      setIsLibrarySaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent pb-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* Module Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2d221c] tracking-tight">Product Costing</h1>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Module A — Internal Cost Calculator</p>
          </div>
        </div>

        {/* Success Banner */}
        {saveSuccess && (
          <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-3 duration-500">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-emerald-800">Product saved to library!</p>
              <p className="text-emerald-600 text-sm">You can now price it for any customer from the Library.</p>
            </div>
            <Button 
              type="button"
              onClick={() => router.push('/library')} 
              className="bg-emerald-600 text-white rounded-xl px-6 h-10 text-sm font-bold shrink-0"
            >
              Open Library →
            </Button>
          </div>
        )}

        {/* Step Nav */}
        <div className="mb-10 flex gap-3 overflow-x-auto no-scrollbar py-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setStep(s.id)} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all shrink-0 border ${step === s.id ? 'bg-[#2d221c] text-white shadow-lg border-transparent' : 'bg-white text-gray-400 hover:bg-amber-50 border-gray-100'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${step === s.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="text-left">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${step === s.id ? 'text-amber-400' : ''}`}>{s.title}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${step === s.id ? 'text-white/50' : 'text-gray-300'}`}>{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500">
               <div className="bg-white p-8 md:p-14 rounded-[30px] border border-amber-900/5 shadow-wood relative">
                  <div className="flex items-center gap-4 mb-10"><User className="text-amber-700 w-6 h-6" /><h2 className="text-2xl font-serif text-[#2d221c]">Product Identity</h2></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Select label="Product Category" options={PRODUCT_CATEGORIES.map(c => ({ label: c, value: c }))} {...register("productCategory")} />
                        <Input label="Product Name" placeholder="e.g. Royal Wingback Chair" {...register("productName")} />
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-900/5">
                        <Calendar className="w-5 h-5 text-amber-700 opacity-50" /><Input label="Date" type="date" {...register("date")} className="bg-transparent border-none p-0 h-auto w-full" />
                      </div>
                    </div>
                    <div className="space-y-4">
                       <label className="text-xs font-bold uppercase tracking-widest block ml-1">Product Image</label>
                       <div className="relative aspect-video rounded-[30px] border-2 border-dashed border-amber-900/10 bg-amber-50/20 flex flex-col items-center justify-center overflow-hidden group hover:border-amber-500/50 transition-all">
                          {preview ? (<><img src={preview} className="w-full h-full object-cover" /><button type="button" onClick={() => setPreview(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button></>) : (
                            <label className="cursor-pointer flex flex-col items-center gap-3"><div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700"><Camera className="w-8 h-8" /></div><p className="text-[10px] font-black uppercase text-amber-900/40">Tap to Upload</p><input type="file" accept="image/*" onChange={onImageChange} className="hidden" /></label>
                          )}
                       </div>
                    </div>
                  </div>
               </div>
               <div className="flex justify-end"><Button type="button" onClick={() => setStep(2)} className="h-20 px-16 rounded-3xl bg-[#2d221c] text-white text-xl font-serif">Define Structure <ArrowRight className="ml-4" /></Button></div>
            </div>
          )}

          {/* STEP 2: STRUCTURE */}
          {step === 2 && (
            <div className="space-y-10 animate-in fade-in duration-500">
               <div className="bg-white p-6 md:p-10 rounded-[30px] shadow-wood border border-amber-900/5">
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Trees className="text-amber-700" /> Wood Breakdown</h2><Button type="button" onClick={() => appendWood({ id: Date.now().toString(), componentName: '', woodType: (woodTypes[0] || ''), length_ft: 0, width_in: 0, thickness_in: 0, quantity: 1, wastage_percent: 3, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false })} variant="outline" className="text-[10px] font-black uppercase">+ Add Row</Button></div>
                  <div className="space-y-4">
                    {woodFields.map((field, index) => {
                      const row = watchedWood?.[index] as any;
                      const hasRateMatch = !!findWoodMaster(row?.woodType, row?.length_ft, row?.width_in, row?.thickness_in, woodMasters);
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
               
               {/* Plywood */}
               <div className="bg-white p-6 md:p-10 rounded-[30px] shadow-wood border border-amber-900/5">
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Layers className="text-blue-700" /> Engineering Board (Ply)</h2><Button type="button" onClick={() => appendPly({ id: Date.now().toString(), componentName: '', plyCategory: (plyCategories[0] || 'plywood'), thickness_mm: 18, sheet_length_ft: 8, sheet_width_ft: 4, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, wastage_percent: 5, wastage_amount: 0, rate_per_sqft: 0, isRateOverridden: false, total_cost: 0 })} variant="outline" className="text-[10px] font-black uppercase">+ Add Ply</Button></div>
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
                              <Input label="Rate/SqFt" readOnly={hasRateMatch} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} />
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

               <div className="flex justify-between items-center"><Button type="button" onClick={() => setStep(1)} variant="ghost" className="h-16 px-10">Back</Button><Button type="button" onClick={() => setStep(3)} className="h-16 px-16 bg-[#2d221c] text-white rounded-2xl">Comfort Layer <ArrowRight className="ml-4" /></Button></div>
            </div>
          )}

          {/* STEP 3: COMFORT */}
          {step === 3 && (
            <div className="space-y-10 animate-in fade-in duration-500">
               <div className="bg-white p-6 md:p-10 rounded-[30px] shadow-wood border border-amber-900/5">
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Wind className="text-orange-700" /> Foam & Cushioning</h2><Button type="button" onClick={() => appendFoam({ id: Date.now().toString(), componentName: '', foamType: (foamTypes[0] || 'PU'), specification: '32D', thickness_mm: 0, cut_length_in: 0, cut_width_in: 0, quantity: 1, sqft: 0, master_rate: 0, rate_per_sqft: 0, wastage_percent: 5, wastage_amount: 0, isRateOverridden: false, total_cost: 0 })} variant="outline" className="text-[10px] font-black uppercase">+ Add Layer</Button></div>
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
                              <Input label="Base Master Rate" readOnly={hasRateMatch} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} />
                              {hasRateMatch ? (
                                <p className="absolute left-1 -bottom-4 text-[8px] font-black text-orange-600/40 uppercase tracking-tighter italic">Auto-Locked</p>
                              ) : (
                                row?.cut_length_in > 0 && <p className="absolute left-1 -bottom-4 text-[8px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">Enter Custom Price</p>
                              )}
                           </div>
                           <div className="col-span-1 flex justify-center"><button type="button" onClick={() => removeFoam(index)}><Trash2 className="w-5 h-5 text-rose-500" /></button></div>
                        </div></div>
                      );
                    })}
                  </div>
               </div>
               <div className="flex justify-between items-center"><Button type="button" onClick={() => setStep(2)} variant="ghost" className="h-16 px-10">Back</Button><Button type="button" onClick={() => setStep(4)} className="h-16 px-16 bg-[#2d221c] text-white rounded-2xl">Services & Expense <ArrowRight className="ml-4" /></Button></div>
            </div>
          )}

          {/* STEP 4: SERVICES — LABOUR + FACTORY EXPENSE (NO MARKUP) */}
          {step === 4 && (
            <div className="space-y-10 animate-in fade-in duration-500">
               <div className="bg-white p-10 rounded-[30px] border border-amber-900/5 shadow-wood">
                  <div className="flex items-center gap-4 mb-10"><Activity className="text-amber-700" /><h2 className="text-2xl font-serif">Labour & Factory Expense</h2></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Labour Costs</p>
                       <Input label="Carpenter Labour" type="number" {...register("labour.carpenter", { valueAsNumber: true })} />
                       <Input label="Foam / Upholstery Labour" type="number" {...register("labour.foam", { valueAsNumber: true })} />
                       <Input label="Polish / Painting Labour" type="number" {...register("labour.polish", { valueAsNumber: true })} />
                    </div>
                     <div className="space-y-6">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Miscellaneous & Factory</p>
                       <Input label="Miscellaneous Fittings / Hardware" type="number" {...register("miscellaneous.amount", { valueAsNumber: true })} />
                       <Select label="Factory Expense %" options={[{label:'30% (Standard)', value:30}, {label:'35% (Complex)', value:35}, {label:'40% (Premium)', value:40}]} {...register("factoryExpensePercent", { valueAsNumber: true })} />
                       <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 mt-4">
                          <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">About Factory Expense</p>
                          <p className="text-xs text-stone-500 leading-relaxed">Factory expense covers overhead costs like electricity, rent, equipment, supervision. It is applied as a percentage on top of (Materials + Labour + Misc) to determine the base internal cost.</p>
                       </div>
                    </div>
                  </div>
               </div>

               {/* Info Box — No Markup Here */}
               <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                  <Factory className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 text-sm">Markup & Pricing comes later</p>
                    <p className="text-amber-700 text-xs mt-1 leading-relaxed">Save this product costing first. You can then open it from the <strong>Product Library</strong> to apply customer-specific markup and generate final selling prices for different customer types — without recalculating materials every time.</p>
                  </div>
               </div>

               <div className="flex justify-between items-center">
                   <Button type="button" onClick={() => setStep(3)} variant="ghost" className="h-16 px-10">Back</Button>
                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      onClick={openLibraryModal} 
                      className="h-20 px-12 rounded-3xl bg-[#2d221c] text-white text-lg font-serif shadow-2xl hover:scale-[1.02] transition-all"
                    >
                      <Archive className="w-5 h-5 mr-3" />
                      Save Product Costing
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      variant="outline" 
                      className="h-20 px-8 rounded-3xl border-2 border-stone-200 text-stone-500 text-sm font-serif"
                    >
                      {isSubmitting ? 'Saving...' : 'Also Save as Quote'}
                    </Button>
                  </div>
               </div>
            </div>
          )}
        </form>

        <Modal
          isOpen={isLibraryModalOpen}
          onClose={() => setIsLibraryModalOpen(false)}
          title="Save Product Costing"
          footer={
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsLibraryModalOpen(false)}>Cancel</Button>
              <Button className="bg-[#2d221c] text-white" onClick={onSaveToLibrary} disabled={isLibrarySaving}>
                {isLibrarySaving ? 'Saving...' : 'Save to Library'}
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 leading-relaxed">
              This will save the complete material breakdown & internal cost as a reusable product template. You can price it later for any customer type.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="SKU Code" 
                placeholder="e.g. CH-001" 
                value={libraryData.sku} 
                onChange={e => setLibraryData({...libraryData, sku: e.target.value.toUpperCase()})}
              />
              <Input 
                label="Product Name" 
                placeholder="e.g. Wingback Chair" 
                value={libraryData.name} 
                onChange={e => setLibraryData({...libraryData, name: e.target.value})}
              />
            </div>
            <Select 
              label="Library Category" 
              options={PRODUCT_CATEGORIES.map(c => ({ label: c, value: c }))}
              value={libraryData.category}
              onChange={e => setLibraryData({...libraryData, category: e.target.value})}
            />
            <Input 
              label="Internal Tags (comma separated)" 
              placeholder="e.g. Premium, Leather, Office" 
              value={libraryData.tags} 
              onChange={e => setLibraryData({...libraryData, tags: e.target.value})}
            />
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest block ml-1">Internal Notes</label>
              <textarea 
                className="w-full min-h-[80px] p-4 rounded-2xl border border-amber-900/10 bg-amber-50/20 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm"
                placeholder="Add internal notes about this product..."
                value={libraryData.description}
                onChange={e => setLibraryData({...libraryData, description: e.target.value})}
              />
            </div>
          </div>
        </Modal>

        <LiveCostingBar control={control} />
      </div>
    </div>
  );
}

function LiveCostingBar({ control }: { control: any }) {
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
    0, 0, false
  ), [deferredValues]);

  return (
    <div className={`fixed left-0 right-0 z-[100] transition-all duration-500 bg-white border-t border-amber-900/10 ${isExpanded ? 'bottom-0 h-[380px]' : 'bottom-0 h-24'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex flex-col">
        <div className="h-24 flex items-center justify-between">
          <div className="flex gap-10 items-center">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-amber-600">Base Internal Cost</p>
              <p className="text-3xl font-serif font-medium text-[#2d221c]">₹{(summary?.totalInternalCost || 0).toLocaleString()}</p>
            </div>
            <div className="hidden md:block h-10 w-px bg-stone-200" />
            <div className="hidden md:flex gap-6">
              <div>
                <p className="text-[9px] uppercase opacity-40 font-black tracking-widest">Materials</p>
                <p className="text-lg font-medium text-stone-600">₹{(summary?.totalMaterials || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase opacity-40 font-black tracking-widest">Labour</p>
                <p className="text-lg font-medium text-stone-600">₹{(summary?.totalLabour || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase opacity-40 font-black tracking-widest">Factory</p>
                <p className="text-lg font-medium text-stone-600">₹{(summary?.factoryExpenseAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="px-6 py-3 bg-amber-100/50 rounded-xl text-xs font-black uppercase text-amber-900 flex items-center gap-2">Cost Breakdown <ChevronUp className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>
        </div>
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 py-10 border-t border-amber-900/5 animate-in slide-in-from-bottom-5">
             <div className="space-y-4"><p className="text-[10px] font-black opacity-30 uppercase border-b pb-2 tracking-widest">Material Pool</p><div className="flex justify-between font-serif text-xl font-light"><span>Total Materials</span><span>₹{(summary?.totalMaterials || 0).toLocaleString()}</span></div><div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Wood</span><span>₹{(summary?.totalWood || 0).toLocaleString()}</span></div><div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Plywood</span><span>₹{(summary?.totalPly || 0).toLocaleString()}</span></div><div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Foam</span><span>₹{(summary?.totalFoam || 0).toLocaleString()}</span></div></div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black opacity-30 uppercase border-b pb-2 tracking-widest">Services & Overhead</p>
                 <div className="flex justify-between font-serif text-xl font-light"><span>Labour</span><span>₹{(summary?.totalLabour || 0).toLocaleString()}</span></div>
                 <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Miscellaneous</span><span>₹{(summary?.totalMisc || 0).toLocaleString()}</span></div>
                 <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Factory Expense</span><span>₹{(summary?.factoryExpenseAmount || 0).toLocaleString()}</span></div>
              </div>
             <div className="bg-[#2d221c] p-10 rounded-[30px] text-white flex flex-col justify-center shadow-2xl relative overflow-hidden">
               <p className="text-[10px] font-black text-amber-500 uppercase mb-3 tracking-[0.3em]">Base Internal Cost</p>
               <p className="text-5xl font-serif">₹{(summary?.totalInternalCost || 0).toLocaleString()}</p>
               <p className="text-[9px] text-amber-500/60 uppercase mt-4 font-bold tracking-wider">After Factory Expense — Before Markup</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
