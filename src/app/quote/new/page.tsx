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
  Tag as TagIcon
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

const CLIENT_TYPES: CustomerType[] = [
  'Architect', 'Interior Designer', 'House Owner', 'Showroom', 'Third Party'
];

const STEPS = [
  { id: 1, title: "Identity", subtitle: "Project Base" },
  { id: 2, title: "Structure", subtitle: "Wood & Boards" },
  { id: 3, title: "Comfort", subtitle: "Foam & Fabric" },
  { id: 4, title: "Finalize", subtitle: "Labour & Margin" }
];

export default function NewQuotePage() {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [woodMasters, setWoodMasters] = useState<WoodMaster[]>([]);
  const [plyMasters, setPlyMasters] = useState<PlyMaster[]>([]);
  const [foamMasters, setFoamMasters] = useState<FoamMaster[]>([]);
  const [markupSettings, setMarkupSettings] = useState<CustomerMarkupSetting[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
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
      customerType: CLIENT_TYPES[0],
      productName: '', 
      woodBreakdown: [],
      plyBreakdown: [],
      foamBreakdown: [],
      fabricBreakdown: [],
      status: 'Draft',
      gstPercent: 18,
      includeGST: true,
      factoryExpensePercent: 30,
      markupPercent: 20,
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
  const watchedCustomerType = watch("customerType");

  useEffect(() => {
    if (watchedCustomerType && markupSettings.length > 0) {
      const setting = markupSettings.find(m => m.customer_type === watchedCustomerType);
      if (setting) {
        setValue("markupPercent", setting.default_markup_percent);
      }
    }
  }, [watchedCustomerType, markupSettings, setValue]);

  useEffect(() => {
    if (watchedCategory) setValue("productName", watchedCategory);
  }, [watchedCategory, setValue]);

  useEffect(() => {
    const loadMasters = async () => {
      const [w, p, f, m] = await Promise.all([
        getWoodMasters(), 
        getPlyMasters(), 
        getFoamMasters(),
        getMarkupSettings()
      ]);
      setWoodMasters(w); 
      setPlyMasters(p); 
      setFoamMasters(f);
      setMarkupSettings(m);
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
        // If dimensions changed and no match found, reset rate to 0
        setValue(`woodBreakdown.${index}.rate_per_gf`, 0);
      }
    });
  }, [watchedWood, woodMasters, setValue]);

  useEffect(() => {
    (watchedPly || []).forEach((row: any, index: number) => {
      if (row?.isRateOverridden) return;
      const match = findPlyMaster(row.plyCategory, row.thickness_mm || 0, plyMasters);
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
  const onSubmit = async (data: Quotation) => {
    setIsSubmitting(true);
    try {
      const summary = calculateFinalQuotation(
        data.woodBreakdown.map((r: WoodRow) => calculateWoodRow(r)),
        data.plyBreakdown.map((r: PlyRow) => calculatePlyRow(r as any)),
        data.foamBreakdown.map((r: FoamRow) => calculateFoamRow(r as any)),
        data.fabricBreakdown.map((r: FabricRow) => calculateFabricRow(r as any)),
        data.labour, { amount: data.miscellaneous.amount },
        data.factoryExpensePercent, data.markupPercent, data.gstPercent,
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
    
    // Auto-suggest SKU
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
      // Calculate latest state for snapshot
      const summary = calculateFinalQuotation(
        data.woodBreakdown.map(r => calculateWoodRow(r)),
        data.plyBreakdown.map(r => calculatePlyRow(r as any)),
        data.foamBreakdown.map(r => calculateFoamRow(r as any)),
        data.fabricBreakdown.map(r => calculateFabricRow(r as any)),
        data.labour, { amount: data.miscellaneous.amount },
        data.factoryExpensePercent, data.markupPercent, data.gstPercent,
        data.includeGST === undefined ? true : data.includeGST
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

      alert("Product saved to library successfully!");
      setIsLibraryModalOpen(false);
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
        
        {/* Step Nav */}
        <div className="mb-10 flex gap-4 overflow-x-auto no-scrollbar py-4">
          {STEPS.map((s) => (
            <button key={s.id} onClick={() => setStep(s.id)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all shrink-0 ${step === s.id ? 'bg-[#2d221c] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-amber-50'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${step === s.id ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}>{s.id}</span>
              <p className="text-[10px] font-black uppercase tracking-widest">{s.title}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500">
               <div className="bg-white p-8 md:p-14 rounded-[30px] border border-amber-900/5 shadow-wood relative">
                  <div className="flex items-center gap-4 mb-10"><User className="text-amber-700 w-6 h-6" /><h2 className="text-2xl font-serif text-[#2d221c]">Project Identity</h2></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Select label="Category Type" options={PRODUCT_CATEGORIES.map(c => ({ label: c, value: c }))} {...register("productCategory")} />
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-900/5">
                        <Calendar className="w-5 h-5 text-amber-700 opacity-50" /><Input label="Valuation Date" type="date" {...register("date")} className="bg-transparent border-none p-0 h-auto w-full" />
                      </div>
                    </div>
                    <div className="space-y-4">
                       <label className="text-xs font-bold uppercase tracking-widest block ml-1">Image Inserting</label>
                       <div className="relative aspect-video rounded-[30px] border-2 border-dashed border-amber-900/10 bg-amber-50/20 flex flex-col items-center justify-center overflow-hidden group hover:border-amber-500/50 transition-all">
                          {preview ? (<><img src={preview} className="w-full h-full object-cover" /><button onClick={() => setPreview(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button></>) : (
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
                  <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-serif flex items-center gap-4"><Trees className="text-amber-700" /> Wood Breakdown</h2><Button type="button" onClick={() => appendWood({ id: Date.now().toString(), componentName: '', woodType: (woodTypes[0] || ''), length_ft: 0, width_in: 0, thickness_in: 0, quantity: 1, wastage_percent: 7.5, rate_per_gf: 0, gun_foot: 0, total_cost: 0, isRateOverridden: false })} variant="outline" className="text-[10px] font-black uppercase">+ Add Row</Button></div>
                  <div className="space-y-4">
                    {woodFields.map((field, index) => {
                      const row = watchedWood?.[index] as any;
                      const hasRateMatch = !!findWoodMaster(row?.woodType, row?.length_ft, row?.width_in, row?.thickness_in, woodMasters);
                      return (
                        <div key={field.id} className="p-4 rounded-[20px] bg-amber-50/10 border border-amber-900/5"><div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                           <div className="col-span-2 lg:col-span-3"><Input label="Part Name" {...register(`woodBreakdown.${index}.componentName`)} /></div>
                           <div className="col-span-2 lg:col-span-2"><Select options={woodTypes.map(t => ({ label: t, value: t }))} {...register(`woodBreakdown.${index}.woodType`)} /></div>
                           <div className="col-span-1"><Input label="L (ft)" {...register(`woodBreakdown.${index}.length_ft`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="W (in)" {...register(`woodBreakdown.${index}.width_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="T (in)" {...register(`woodBreakdown.${index}.thickness_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Wast %" {...register(`woodBreakdown.${index}.wastage_percent`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Qty" {...register(`woodBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                           <div className="col-span-2">
                             <label className="text-[8px] font-black uppercase tracking-tighter block mb-1 opacity-40">Sectional Foot (GF)</label>
                             <div className="h-12 flex items-center px-4 bg-amber-50/30 rounded-xl border border-amber-900/5 text-sm font-bold text-amber-900/60">
                               {row?.gun_foot || 0}
                             </div>
                           </div>
                           <div className="col-span-2 relative">
                              <Input label="Rate" readOnly={hasRateMatch} {...register(`woodBreakdown.${index}.rate_per_gf`, { valueAsNumber: true })} />
                              {hasRateMatch ? (
                                <p className="absolute left-1 -bottom-4 text-[8px] font-black text-amber-600/40 uppercase tracking-tighter italic">Auto-Locked from Master</p>
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
                           <div className="col-pan-2 lg:col-span-3"><Input label="Allocation" {...register(`plyBreakdown.${index}.componentName`)} /></div>
                           <div className="col-span-2 lg:col-span-2"><Select options={plyCategories.map(c => ({ label: c, value: c }))} {...register(`plyBreakdown.${index}.plyCategory`)} /></div>
                           <div className="col-span-1"><Input label="L (in)" {...register(`plyBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="W (in)" {...register(`plyBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Qty" {...register(`plyBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="MM" {...register(`plyBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                           <div className="col-span-2 relative">
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
                           <div className="col-span-2 lg:col-span-2"><Input label="Foam Area" {...register(`foamBreakdown.${index}.componentName`)} /></div>
                           <div className="col-span-2 lg:col-span-2"><Select options={foamTypes.map(t => ({ label: t, value: t }))} {...register(`foamBreakdown.${index}.foamType`)} /></div>
                           <div className="col-span-2 lg:col-span-2"><Select options={getFoamSpecs(row?.foamType || '').map(s => ({ label: s, value: s }))} {...register(`foamBreakdown.${index}.specification`)} /></div>
                           <div className="col-span-1"><Input label="MM" {...register(`foamBreakdown.${index}.thickness_mm`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="L" {...register(`foamBreakdown.${index}.cut_length_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="W" {...register(`foamBreakdown.${index}.cut_width_in`, { valueAsNumber: true })} /></div>
                           <div className="col-span-1"><Input label="Qty" {...register(`foamBreakdown.${index}.quantity`, { valueAsNumber: true })} /></div>
                           <div className="col-span-2 relative">
                              <Input label="Rate" readOnly={hasRateMatch} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} />
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
               <div className="flex justify-between items-center"><Button type="button" onClick={() => setStep(2)} variant="ghost" className="h-16 px-10">Back</Button><Button type="button" onClick={() => setStep(4)} className="h-16 px-16 bg-[#2d221c] text-white rounded-2xl">Final Audit <ArrowRight className="ml-4" /></Button></div>
            </div>
          )}

          {/* STEP 4: FINALIZE */}
          {step === 4 && (
            <div className="space-y-10 animate-in fade-in duration-500">
               <div className="bg-white p-10 rounded-[30px] border border-amber-900/5 shadow-wood">
                  <div className="flex items-center gap-4 mb-10"><Activity className="text-amber-700" /><h2 className="text-2xl font-serif">Labour & Margin Audit</h2></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <Input label="Carpenter Labour" type="number" {...register("labour.carpenter", { valueAsNumber: true })} />
                       <Input label="Polish/Painting" type="number" {...register("labour.polish", { valueAsNumber: true })} />
                       <Input label="Upholstery Labour" type="number" {...register("labour.foam", { valueAsNumber: true })} />
                       <Input label="Miscellaneous Fittings" type="number" {...register("miscellaneous.amount", { valueAsNumber: true })} />
                    </div>
                     <div className="space-y-6 bg-amber-50/20 p-8 rounded-3xl border border-amber-900/5">
                        <Select 
                          label="Type of Client" 
                          options={CLIENT_TYPES.map(t => ({ label: t, value: t }))} 
                          {...register("customerType")} 
                        />
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-amber-900/5 shadow-sm">
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest text-[#2d221c]">Apply GST Tax</p>
                              <p className="text-[8px] text-amber-900/40 font-bold uppercase mt-1">Include 18% in final total?</p>
                           </div>
                           <input type="checkbox" {...register("includeGST")} className="w-6 h-6 rounded-lg accent-[#2d221c]" />
                        </div>
                       <Input label="Profit Margin %" type="number" {...register("markupPercent", { valueAsNumber: true })} />
                       <Input label="Applied GST %" type="number" {...register("gstPercent", { valueAsNumber: true })} />
                       <Select label="Factory Expense %" options={[{label:'30% (Standard)', value:30}, {label:'35% (Complex)', value:35}, {label:'40% (Premium)', value:40}]} {...register("factoryExpensePercent", { valueAsNumber: true })} />
                    </div>
                  </div>
               </div>
               <div className="flex justify-between items-center">
                   <Button type="button" onClick={() => setStep(3)} variant="ghost" className="h-16 px-10">Back</Button>
                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      onClick={openLibraryModal} 
                      variant="outline"
                      className="h-20 px-10 rounded-3xl border-2 border-amber-900/10 text-[#2d221c] text-lg font-serif"
                    >
                      <BookOpen className="w-5 h-5 mr-3" />
                      Save to Library
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="h-20 px-16 bg-[#2d221c] text-white rounded-3xl text-xl font-serif shadow-2xl hover:scale-105 transition-all">
                      {isSubmitting ? 'Syncing...' : 'Finalize Valuation'}
                    </Button>
                  </div>
               </div>
            </div>
          )}
        </form>

        <Modal
          isOpen={isLibraryModalOpen}
          onClose={() => setIsLibraryModalOpen(false)}
          title="Save as Reusable Product"
          footer={
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsLibraryModalOpen(false)}>Cancel</Button>
              <Button onClick={onSaveToLibrary} disabled={isLibrarySaving}>
                {isLibrarySaving ? 'Saving...' : 'Add to SKUs'}
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
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
              <label className="text-xs font-bold uppercase tracking-widest block ml-1">Internal Description</label>
              <textarea 
                className="w-full min-h-[100px] p-4 rounded-2xl border border-amber-900/10 bg-amber-50/20 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm"
                placeholder="Add internal notes about this SKU..."
                value={libraryData.description}
                onChange={e => setLibraryData({...libraryData, description: e.target.value})}
              />
            </div>
          </div>
        </Modal>

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
          <div className="flex gap-10">
            <div><p className="text-[10px] uppercase opacity-40 font-black tracking-widest">Grand Total</p><p className="text-3xl font-serif font-medium">₹{(summary?.grandTotal || 0).toLocaleString()}</p></div>
            <div className="hidden md:block">
              <p className="text-[10px] uppercase opacity-40 font-black text-emerald-500 tracking-widest">Yield</p>
              <p className="text-2xl font-serif">{summary.profitPercent}%</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="px-6 py-3 bg-amber-100/50 rounded-xl text-xs font-black uppercase text-amber-900 flex items-center gap-2">Analysis Hub <ChevronUp className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>
        </div>
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 py-10 border-t border-amber-900/5 animate-in slide-in-from-bottom-5">
             <div className="space-y-4"><p className="text-[10px] font-black opacity-30 uppercase border-b pb-2 tracking-widest">Material Pool</p><div className="flex justify-between font-serif text-xl font-light"><span>Pool Value</span><span>₹{(summary?.totalMaterials || 0).toLocaleString()}</span></div><div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Wood Pool</span><span>₹{(summary?.totalWood || 0).toLocaleString()}</span></div><div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>Board Pool</span><span>₹{(summary?.totalPly || 0).toLocaleString()}</span></div></div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black opacity-30 uppercase border-b pb-2 tracking-widest">Operational Load</p>
                 <div className="flex justify-between font-serif text-xl font-light"><span>Total Ops</span><span>₹{((summary?.totalLabour || 0) + (summary?.factoryExpenseAmount || 0)).toLocaleString()}</span></div>
                 {(deferredValues?.includeGST !== false) && (
                   <div className="flex justify-between text-[10px] opacity-50 uppercase font-black"><span>GST Component</span><span>₹{(summary?.gstAmount || 0).toLocaleString()}</span></div>
                 )}
              </div>
             <div className="bg-[#2d221c] p-10 rounded-[30px] text-white flex flex-col justify-center shadow-2xl relative overflow-hidden"><div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div><p className="text-[10px] font-black text-amber-500 uppercase mb-3 tracking-[0.3em]">Factory Internal Cost</p><p className="text-5xl font-serif">₹{(summary?.totalInternalCost || 0).toLocaleString()}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
