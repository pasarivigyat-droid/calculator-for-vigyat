"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Package, 
  Settings, 
  Calculator, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  AlertTriangle,
  Layers,
  Trees,
  Wind,
  ShieldCheck,
  Zap,
  Tag as TagIcon,
  Image as ImageIcon,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ProductLibraryItem, CustomerMarkupSetting, CustomerType, WoodMaster, PlyMaster, FoamMaster } from "@/types";
import { 
  getProductLibraryItem, 
  getMarkupSettings, 
  createQuotation, 
  deleteProductLibraryItem,
  getWoodMasters,
  getPlyMasters,
  getFoamMasters,
  updateProductLibraryItem
} from "@/lib/firebase/services";
import { generateRefCode } from "@/lib/utils/formatters";
import { 
  calculateFinalQuotation, 
  calculateWoodRow, 
  calculatePlyRow, 
  calculateFoamRow, 
  calculateFabricRow,
  findWoodMaster,
  findPlyMaster,
  findFoamMaster
} from "@/lib/utils/calculations";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [product, setProduct] = useState<ProductLibraryItem | null>(null);
  const [markupSettings, setMarkupSettings] = useState<CustomerMarkupSetting[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pricing Panel State
  const [selectedCustomerType, setSelectedCustomerType] = useState<CustomerType>('Architect');
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [includeGST, setIncludeGST] = useState(true);
  
  // Update Snapshot Modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateComparison, setUpdateComparison] = useState<{old: number, new: number} | null>(null);
  const [newSnapshot, setNewSnapshot] = useState<ProductLibraryItem | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [prod, markups] = await Promise.all([
          getProductLibraryItem(id as string),
          getMarkupSettings()
        ]);
        
        if (prod) {
          setProduct(prod);
          // Set initial markup based on first customer type
          const defaultMarkup = markups.find(m => m.customer_type === 'Architect')?.default_markup_percent || 20;
          setMarkupPercent(defaultMarkup);
        }
        setMarkupSettings(markups);
      } catch (err) {
        console.error("Failed to load product details:", err);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (markupSettings.length > 0 && selectedCustomerType) {
      const setting = markupSettings.find(m => m.customer_type === selectedCustomerType);
      if (setting) {
        setMarkupPercent(setting.default_markup_percent);
      }
    }
  }, [selectedCustomerType, markupSettings]);

  const pricingSummary = useMemo(() => {
    if (!product) return null;
    
    const internalCost = product.totalInternalCost;
    const markupAmount = (internalCost * markupPercent) / 100;
    const baseAmount = internalCost + markupAmount;
    const gstAmount = includeGST ? (baseAmount * 18) / 100 : 0;
    const finalPrice = baseAmount + gstAmount;
    
    return {
      internalCost,
      markupAmount,
      baseAmount,
      gstAmount,
      finalPrice
    };
  }, [product, markupPercent, includeGST]);

  const onCreateQuote = async () => {
    if (!product) return;
    
    setLoading(true);
    try {
      const quoteData = {
        productName: product.name,
        productCategory: product.category,
        productImage: product.image,
        customerType: selectedCustomerType,
        date: new Date().toISOString().split('T')[0],
        notes: `Created from Product Library SKU: ${product.sku}`,
        tags: product.tags?.join(', '),
        woodBreakdown: product.woodBreakdown,
        plyBreakdown: product.plyBreakdown,
        foamBreakdown: product.foamBreakdown,
        fabricBreakdown: product.fabricBreakdown,
        status: 'Draft' as const,
        gstPercent: 18,
        includeGST: includeGST,
        factoryExpensePercent: product.factoryExpensePercent,
        markupPercent: markupPercent,
        isArchived: false,
        labour: product.labour,
        miscellaneous: product.miscellaneous,
        summary: {
           totalWood: product.woodBreakdown.reduce((s, r) => s + r.total_cost, 0),
           totalPly: product.plyBreakdown.reduce((s, r) => s + r.total_cost, 0),
           totalFoam: product.foamBreakdown.reduce((s, r) => s + r.total_cost, 0),
           totalFabric: product.fabricBreakdown.reduce((s, r) => s + r.totalCost, 0),
           totalMaterials: product.totalMaterials,
           totalLabour: product.totalLabour,
           totalMisc: product.miscellaneous.total,
           totalInternalCost: product.totalInternalCost,
           totalWastageAmount: product.totalWastageAmount,
           factoryExpensePercent: product.factoryExpensePercent,
           factoryExpenseAmount: (product.totalMaterials + product.totalLabour + product.miscellaneous.total) * product.factoryExpensePercent / 100,
           markupPercent: markupPercent,
           finalSellingPrice: pricingSummary!.baseAmount,
           grossProfitAmount: pricingSummary!.markupAmount,
           profitPercent: Number(((pricingSummary!.markupAmount / pricingSummary!.baseAmount) * 100).toFixed(2)),
           baseAmount: pricingSummary!.baseAmount,
           gstAmount: pricingSummary!.gstAmount,
           includeGST: includeGST,
           grandTotal: pricingSummary!.finalPrice
        },
        refCode: generateRefCode(),
        createdBy: 'admin'
      };
      
      // We need to use type assertion here because the summary object is large
      await createQuotation(quoteData as any);
      router.push('/quotes');
    } catch (err) {
      console.error("Failed to create quote:", err);
      alert("Error creating quote");
      setLoading(false);
    }
  };

  const onUpdateSnapshotCheck = async () => {
    if (!product) return;
    setIsUpdating(true);
    
    try {
      const [wMasters, pMasters, fMasters] = await Promise.all([
        getWoodMasters(),
        getPlyMasters(),
        getFoamMasters()
      ]);

      // Recalculate rows with current master rates
      const updatedWood = product.woodBreakdown.map(row => {
        if (row.isRateOverridden) return row;
        const match = findWoodMaster(row.woodType, row.length_ft, row.width_in, row.thickness_in, wMasters);
        return match ? calculateWoodRow({ ...row, rate_per_gf: match.rate_per_gf }) : row;
      });

      const updatedPly = product.plyBreakdown.map(row => {
        if (row.isRateOverridden) return row;
        const match = findPlyMaster(row.plyCategory, row.thickness_mm, pMasters);
        return match ? calculatePlyRow({ ...row, rate_per_sqft: match.rate_per_sqft }) : row;
      });

      const updatedFoam = product.foamBreakdown.map(row => {
        if (row.isRateOverridden) return row;
        const match = findFoamMaster(row.foamType, row.specification, fMasters);
        return match ? calculateFoamRow({ ...row, master_rate: match.base_rate }) : row;
      });

      const updatedFabric = product.fabricBreakdown; // Usually no auto-update for fabric yet

      const summary = calculateFinalQuotation(
        updatedWood,
        updatedPly as any,
        updatedFoam as any,
        updatedFabric as any,
        product.labour,
        { amount: product.miscellaneous.amount },
        product.factoryExpensePercent,
        markupPercent,
        18,
        includeGST
      );

      setNewSnapshot({
        ...product,
        woodBreakdown: updatedWood,
        plyBreakdown: updatedPly,
        foamBreakdown: updatedFoam,
        fabricBreakdown: updatedFabric,
        totalInternalCost: summary.totalInternalCost,
        totalMaterials: summary.totalMaterials,
        totalLabour: summary.totalLabour,
        totalWastageAmount: summary.totalWastageAmount,
      });

      setUpdateComparison({
        old: product.totalInternalCost,
        new: summary.totalInternalCost
      });
      setIsUpdateModalOpen(true);
    } catch (err) {
      console.error("Update snapshot failed:", err);
      alert("Could not update rates. Try again later.");
    } finally {
      setIsUpdating(false);
    }
  };

  const saveUpdatedSnapshot = async () => {
    if (!newSnapshot || !id) return;
    setIsUpdating(true);
    try {
      const { id: _, createdAt: __, updatedAt: ___, ...data } = newSnapshot;
      await updateProductLibraryItem(id as string, data);
      setProduct(newSnapshot);
      setIsUpdateModalOpen(false);
      alert("Costing snapshot updated successfully!");
    } catch (err) {
      alert("Error saving snapshot.");
    } finally {
      setIsUpdating(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Are you sure you want to delete this product template? This cannot be undone.")) return;
    try {
      await deleteProductLibraryItem(id as string);
      router.push('/library');
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-gray-400">Loading Intelligence...</div>;
  if (!product) return <div className="p-20 text-center text-rose-500">Product Snapshot Not Found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-40 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-6 z-10">
          <button 
            onClick={() => router.back()}
            className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all border border-gray-100"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{product.category}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none bg-gray-50 px-2 py-0.5 rounded-md">{product.sku}</span>
            </div>
            <h1 className="text-3xl font-bold text-[#2d221c]">{product.name}</h1>
          </div>
        </div>

        <div className="flex gap-4 z-10 shrink-0">
          <Button variant="outline" className="h-14 rounded-2xl border-gray-200" onClick={onDelete}>
            <Trash2 className="w-5 h-5 text-rose-500" />
          </Button>
          <Button 
            className="h-14 px-8 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/10"
            onClick={onCreateQuote}
          >
            <ClipboardCheck className="w-5 h-5 mr-3" />
            Create Quote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Product Info & Costing */}
        <div className="lg:col-span-8 space-y-8">
          {/* Main Info Card */}
          <Card className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-premium bg-white">
            <div className="grid grid-cols-1 md:grid-cols-5 h-full">
               <div className="md:col-span-2 aspect-square relative bg-gray-100">
                  {product.image ? (
                    <img src={product.image} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                      <ImageIcon className="w-12 h-12" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Image</span>
                    </div>
                  )}
               </div>
               <div className="md:col-span-3 p-10 flex flex-col justify-center">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" /> Internal Description
                  </h3>
                  <p className="text-lg text-stone-600 leading-relaxed italic font-serif">
                    {product.description || "No internal description provided for this SKU."}
                  </p>
                  
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-8">
                      {product.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-stone-100 text-stone-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
               </div>
            </div>
          </Card>

          {/* Costing Snapshot */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-xl font-bold text-[#2d221c] flex items-center gap-3">
                <Calculator className="w-5 h-5 text-amber-600" />
                Costing Snapshot
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                Saved {product.updatedAt?.toDate ? product.updatedAt.toDate().toLocaleDateString() : 'Just Now'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Wood & Ply Section */}
               <Card className="rounded-[2.5rem] border border-gray-100 p-8 space-y-6 bg-white shadow-sm transition-all hover:shadow-md">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600"><Trees className="w-5 h-5" /></div>
                        <h4 className="font-bold text-[#2d221c]">Structure</h4>
                     </div>
                     <p className="font-bold text-[#2d221c]">₹{Math.round(product.woodBreakdown.reduce((s, r) => s + r.total_cost, 0) + product.plyBreakdown.reduce((s, r) => s + r.total_cost, 0)).toLocaleString()}</p>
                   </div>
                   <div className="space-y-3">
                     {product.woodBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate">{row.componentName}</p>
                            <span className="text-[9px] text-gray-400 uppercase">{row.woodType} | {row.length_ft}' x {row.width_in}" x {row.thickness_in}"</span>
                         </div>
                         <p className="font-medium text-amber-800">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.plyBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate">{row.componentName} (Ply)</p>
                            <span className="text-[9px] text-gray-400 uppercase">{row.plyCategory} | {row.thickness_mm}mm</span>
                         </div>
                         <p className="font-medium text-blue-800">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                   </div>
               </Card>

               {/* Comfort & Finish Section */}
               <Card className="rounded-[2.5rem] border border-gray-100 p-8 space-y-6 bg-white shadow-sm transition-all hover:shadow-md">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600"><Wind className="w-5 h-5" /></div>
                        <h4 className="font-bold text-[#2d221c]">Comfort & Finish</h4>
                     </div>
                     <p className="font-bold text-[#2d221c]">₹{Math.round(product.foamBreakdown.reduce((s, r) => s + r.total_cost, 0) + product.fabricBreakdown.reduce((s, r) => s + r.totalCost, 0)).toLocaleString()}</p>
                   </div>
                   <div className="space-y-3">
                     {product.foamBreakdown.length === 0 && product.fabricBreakdown.length === 0 && (
                       <p className="text-xs text-center py-10 text-gray-300 font-bold uppercase tracking-widest italic">No padding info</p>
                     )}
                     {product.foamBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate">{row.componentName}</p>
                            <span className="text-[9px] text-gray-400 uppercase">{row.foamType} {row.specification} | {row.thickness_in}"</span>
                         </div>
                         <p className="font-medium text-orange-800">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.fabricBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate">Fabric</p>
                            <span className="text-[9px] text-gray-400 uppercase">{row.fabricType} | {row.metersRequired}m</span>
                         </div>
                         <p className="font-medium text-emerald-800">₹{Math.round(row.totalCost).toLocaleString()}</p>
                       </div>
                     ))}
                   </div>
               </Card>

               {/* Operations Section */}
               <Card className="rounded-[2.5rem] border border-gray-100 p-8 space-y-6 bg-white shadow-sm md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Labour & Skills</p>
                        <div className="flex justify-between items-center text-sm font-bold text-[#2d221c]">
                          <span>Total Workshop</span>
                          <span>₹{product.labour.total.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-1 opacity-50 text-[10px] font-bold uppercase tracking-tighter">
                          <div className="flex justify-between"><span>Carpentry</span><span>₹{product.labour.carpenter}</span></div>
                          <div className="flex justify-between"><span>Finish/Polish</span><span>₹{product.labour.polish}</span></div>
                          <div className="flex justify-between"><span>Upholstery</span><span>₹{product.labour.foam}</span></div>
                        </div>
                     </div>
                     <div className="space-y-2 border-l border-gray-50 pl-8">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Factory Allocation</p>
                        <div className="flex justify-between items-center text-sm font-bold text-[#2d221c]">
                          <span>Expense ({product.factoryExpensePercent}%)</span>
                          <span>₹{Math.round((product.totalMaterials + product.totalLabour + product.miscellaneous.amount) * product.factoryExpensePercent / 100).toLocaleString()}</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold leading-tight mt-2">Allocated overheads based on material and labour volume.</p>
                     </div>
                     <div className="bg-[#2d221c] p-6 rounded-3xl flex flex-col justify-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10"><Calculator className="w-12 h-12" /></div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">Total Internal Cost</p>
                        <p className="text-3xl font-bold">₹{Math.round(product.totalInternalCost).toLocaleString()}</p>
                     </div>
                  </div>
               </Card>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Pricing Panel */}
        <aside className="lg:col-span-4 space-y-6 sticky top-24">
          <Card className="rounded-[3rem] p-10 border-none shadow-premium bg-white relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600" />
             
             <div className="flex items-center gap-3 mb-8">
               <TrendingUp className="text-amber-600 w-5 h-5" />
               <h3 className="text-xl font-bold text-[#2d221c]">Instant Pricing</h3>
             </div>

             <div className="space-y-6">
                <div>
                  <Select 
                    label="Select Customer Type" 
                    options={markupSettings.map(s => ({ label: s.customer_type, value: s.customer_type }))}
                    value={selectedCustomerType}
                    onChange={(e) => setSelectedCustomerType(e.target.value as CustomerType)}
                  />
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-2 text-right">Pre-fills Global Default</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest block ml-1">Profit %</label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="pr-8 h-12 rounded-xl"
                        value={markupPercent}
                        onChange={(e) => setMarkupPercent(Number(e.target.value))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button 
                      onClick={() => setIncludeGST(!includeGST)}
                      className={`h-12 w-full rounded-xl border-2 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${includeGST ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm shadow-emerald-700/10' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                    >
                      {includeGST ? <ShieldCheck className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      GST {includeGST ? 'Applied' : 'Include?'}
                    </button>
                  </div>
                </div>

                <div className="py-8 border-t border-b border-dashed border-gray-100 space-y-4">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Internal Cost (Frozen)</span>
                     <span className="text-[#2d221c] font-bold">₹{Math.round(pricingSummary?.internalCost || 0).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Markup Amount</span>
                     <span className="text-amber-700 font-bold">+ ₹{Math.round(pricingSummary?.markupAmount || 0).toLocaleString()}</span>
                   </div>
                   {includeGST && (
                     <div className="flex justify-between text-sm">
                       <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Tax Component (18%)</span>
                       <span className="text-stone-400 font-bold">+ ₹{Math.round(pricingSummary?.gstAmount || 0).toLocaleString()}</span>
                     </div>
                   )}
                </div>

                <div className="flex flex-col items-center">
                   <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mb-3">Final Selling Price</p>
                   <h2 className="text-5xl font-bold text-[#2d221c] tracking-tighter">₹{Math.round(pricingSummary?.finalPrice || 0).toLocaleString()}</h2>
                   <div className="h-1.5 w-12 bg-amber-500 rounded-full mt-6" />
                </div>
                
                <div className="pt-6 space-y-4">
                   <Button 
                    className="w-full h-16 bg-[#2d221c] text-white rounded-[1.8rem] text-sm font-bold uppercase tracking-[0.1em] shadow-2xl hover:scale-[1.02] transition-all"
                    onClick={onCreateQuote}
                   >
                     Create Quote
                   </Button>
                   <p className="text-[9px] text-gray-400 text-center font-bold px-6 leading-relaxed">
                     This will generate a new quotation using the library data without modifying current master rates.
                   </p>
                </div>
             </div>
          </Card>

          <Card className="rounded-[2rem] p-6 border border-gray-100 bg-amber-50/20 shadow-none space-y-4">
             <h4 className="text-xs font-black text-amber-900/60 uppercase tracking-widest flex items-center gap-2">
               <Zap className="w-3.5 h-3.5" /> Maintenance Tools
             </h4>
             <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="ghost" 
                  className="justify-start h-12 rounded-xl text-stone-600 hover:text-amber-600 hover:bg-white border border-transparent hover:border-amber-100"
                  onClick={onUpdateSnapshotCheck}
                  disabled={isUpdating}
                >
                  <RefreshCw className={`w-4 h-4 mr-3 ${isUpdating ? 'animate-spin' : ''}`} />
                  Update Snapshot
                </Button>
                <Button 
                  variant="ghost" 
                  className="justify-start h-12 rounded-xl text-stone-600 hover:bg-white border border-transparent hover:border-blue-100"
                  onClick={() => alert("Feature coming soon: Manual override of snapshot data")}
                >
                  <Calculator className="w-4 h-4 mr-3" />
                  Edit Product Costing
                </Button>
             </div>
          </Card>
        </aside>
      </div>

      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Costing Snapshot"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setIsUpdateModalOpen(false)}>Ignore</Button>
            <Button className="bg-[#2d221c] text-white" onClick={saveUpdatedSnapshot}>Update & Save SKU</Button>
          </div>
        }
      >
        <div className="space-y-6 text-center">
           <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
             <RefreshCw className="w-10 h-10" />
           </div>
           
           <h3 className="text-xl font-bold text-[#2d221c]">New Material Rates Available</h3>
           <p className="text-stone-500 max-w-sm mx-auto leading-relaxed">
             We scanned current master rates for all materials in this product. There is a price fluctuation found.
           </p>

           <div className="bg-stone-50 rounded-[2rem] p-8 border border-stone-200">
             <div className="grid grid-cols-2 gap-8 relative">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-2 bg-white rounded-full border border-stone-200 shadow-sm z-10">
                 <ArrowLeft className="w-4 h-4 rotate-180" />
               </div>
               
               <div className="space-y-1">
                 <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Old Internal</p>
                 <p className="text-2xl font-bold text-stone-400">₹{Math.round(updateComparison?.old || 0).toLocaleString()}</p>
               </div>
               
               <div className="space-y-1 border-l border-stone-200">
                 <p className="text-[9px] font-black uppercase text-[#2d221c] tracking-widest">New Internal</p>
                 <p className="text-2xl font-bold text-[#2d221c]">₹{Math.round(updateComparison?.new || 0).toLocaleString()}</p>
               </div>
             </div>
             
             <div className="mt-8 pt-6 border-t border-stone-200">
               <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm">
                 <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Difference:</span>
                 <span className={`text-sm font-bold ${((updateComparison?.new || 0) - (updateComparison?.old || 0)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                   {((updateComparison?.new || 0) - (updateComparison?.old || 0)) > 0 ? '+' : ''}
                   ₹{Math.round((updateComparison?.new || 0) - (updateComparison?.old || 0)).toLocaleString()}
                 </span>
               </div>
             </div>
           </div>

           <p className="text-xs text-stone-400 font-medium px-8 leading-relaxed italic">
             Applying this update will permanently overwrite the saved snapshot with today's master rates. Re-pricing will be instant.
           </p>
        </div>
      </Modal>
    </div>
  );
}
