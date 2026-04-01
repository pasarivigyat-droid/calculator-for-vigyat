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
  DollarSign,
  Users,
  Percent,
  ArrowUpRight,
  Printer
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

const ALL_CUSTOMER_TYPES: CustomerType[] = [
  'Architect', 'Interior Designer', 'House Owner', 'Showroom', 'Third Party', 'Direct Customer', 'Marketing'
];

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
  const [gstPercent, setGstPercent] = useState(18);
  const [customerName, setCustomerName] = useState('');
  const [quoteSaved, setQuoteSaved] = useState(false);
  
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
    if (selectedCustomerType) {
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
    const gstAmount = includeGST ? (baseAmount * gstPercent) / 100 : 0;
    const finalPrice = baseAmount + gstAmount;
    const profitMargin = baseAmount > 0 ? (markupAmount / baseAmount) * 100 : 0;
    
    return {
      internalCost,
      markupAmount,
      baseAmount,
      gstAmount,
      finalPrice,
      profitMargin
    };
  }, [product, markupPercent, includeGST, gstPercent]);

  const onCreateQuote = async () => {
    if (!product) return;
    
    setLoading(true);
    try {
      const quoteData = {
        productName: product.name,
        productCategory: product.category,
        productImage: product.image,
        customerName: customerName || undefined,
        customerType: selectedCustomerType,
        date: new Date().toISOString().split('T')[0],
        notes: `Created from Product Library SKU: ${product.sku}`,
        tags: product.tags?.join(', '),
        woodBreakdown: product.woodBreakdown,
        plyBreakdown: product.plyBreakdown,
        foamBreakdown: product.foamBreakdown,
        fabricBreakdown: product.fabricBreakdown,
        status: 'Draft' as const,
        gstPercent: gstPercent,
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
      
      await createQuotation(quoteData as any);
      setQuoteSaved(true);
      setTimeout(() => {
        router.push('/quotes');
      }, 1500);
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

      const updatedFabric = product.fabricBreakdown;

      const summary = calculateFinalQuotation(
        updatedWood,
        updatedPly as any,
        updatedFoam as any,
        updatedFabric as any,
        product.labour,
        { amount: product.miscellaneous.amount },
        product.factoryExpensePercent,
        0, 0, false
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

  if (loading) return <div className="p-20 text-center animate-pulse text-gray-400">Loading Product...</div>;
  if (!product) return <div className="p-20 text-center text-rose-500">Product Not Found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-40 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-5 z-10">
          <button 
            onClick={() => router.push('/library')}
            className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all border border-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{product.category}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-md">{product.sku}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#2d221c]">{product.name}</h1>
          </div>
        </div>

        <div className="flex gap-3 z-10 shrink-0">
          <Button variant="outline" className="h-12 rounded-xl border-gray-200 text-sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-rose-500 mr-2" /> Delete
          </Button>
          <Button 
            variant="outline"
            className="h-12 rounded-xl border-gray-200 text-sm"
            onClick={onUpdateSnapshotCheck}
            disabled={isUpdating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} /> Refresh Rates
          </Button>
        </div>
      </div>

      {/* Saved Success Banner */}
      {quoteSaved && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 animate-in fade-in duration-500">
          <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          <p className="font-bold text-emerald-800">Quote created successfully! Redirecting...</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Product Info & Costing */}
        <div className="lg:col-span-7 space-y-6">
          {/* Product Image + Info */}
          {(product.image || product.description) && (
            <Card className="rounded-[2rem] p-0 overflow-hidden border border-gray-100 shadow-sm bg-white">
              <div className="grid grid-cols-1 md:grid-cols-5 h-full">
                 <div className="md:col-span-2 aspect-[4/3] relative bg-gray-100">
                    {product.image ? (
                      <img src={product.image} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                    )}
                 </div>
                 <div className="md:col-span-3 p-8 flex flex-col justify-center">
                    {product.description && (
                      <p className="text-sm text-stone-500 leading-relaxed mb-4">
                        {product.description}
                      </p>
                    )}
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {product.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-stone-100 text-stone-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            </Card>
          )}

          {/* Costing Snapshot */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold text-[#2d221c] flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-600" />
                Costing Snapshot
              </h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                {product.updatedAt?.toDate ? product.updatedAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Just Now'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Wood & Ply Section */}
               <Card className="rounded-[2rem] border border-gray-100 p-6 space-y-4 bg-white shadow-sm">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><Trees className="w-4 h-4" /></div>
                        <h4 className="font-bold text-[#2d221c] text-sm">Structure</h4>
                     </div>
                     <p className="font-bold text-[#2d221c] text-sm">₹{Math.round(product.woodBreakdown.reduce((s, r) => s + r.total_cost, 0) + product.plyBreakdown.reduce((s, r) => s + r.total_cost, 0)).toLocaleString()}</p>
                   </div>
                   <div className="space-y-2">
                     {product.woodBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate text-xs">{row.componentName || 'Wood Part'}</p>
                            <span className="text-[8px] text-gray-400 uppercase">{row.woodType} | {row.length_ft}' x {row.width_in}" x {row.thickness_in}"</span>
                         </div>
                         <p className="font-medium text-amber-800 text-xs">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.plyBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate text-xs">{row.componentName || 'Ply Part'}</p>
                            <span className="text-[8px] text-gray-400 uppercase">{row.plyCategory} | {row.thickness_mm}mm</span>
                         </div>
                         <p className="font-medium text-blue-800 text-xs">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.woodBreakdown.length === 0 && product.plyBreakdown.length === 0 && (
                       <p className="text-[10px] text-center py-6 text-gray-300 font-bold uppercase tracking-widest italic">No structure data</p>
                     )}
                   </div>
               </Card>

               {/* Comfort Section */}
               <Card className="rounded-[2rem] border border-gray-100 p-6 space-y-4 bg-white shadow-sm">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600"><Wind className="w-4 h-4" /></div>
                        <h4 className="font-bold text-[#2d221c] text-sm">Comfort</h4>
                     </div>
                     <p className="font-bold text-[#2d221c] text-sm">₹{Math.round(product.foamBreakdown.reduce((s, r) => s + r.total_cost, 0) + product.fabricBreakdown.reduce((s, r) => s + r.totalCost, 0)).toLocaleString()}</p>
                   </div>
                   <div className="space-y-2">
                     {product.foamBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate text-xs">{row.componentName || 'Foam Part'}</p>
                            <span className="text-[8px] text-gray-400 uppercase">{row.foamType} {row.specification} | {row.thickness_mm}mm</span>
                         </div>
                         <p className="font-medium text-orange-800 text-xs">₹{Math.round(row.total_cost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.fabricBreakdown.map((row, i) => (
                       <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                         <div className="max-w-[70%]">
                            <p className="font-bold text-[#2d221c] truncate text-xs">Fabric</p>
                            <span className="text-[8px] text-gray-400 uppercase">{row.fabricType} | {row.metersRequired}m</span>
                         </div>
                         <p className="font-medium text-emerald-800 text-xs">₹{Math.round(row.totalCost).toLocaleString()}</p>
                       </div>
                     ))}
                     {product.foamBreakdown.length === 0 && product.fabricBreakdown.length === 0 && (
                       <p className="text-[10px] text-center py-6 text-gray-300 font-bold uppercase tracking-widest italic">No comfort data</p>
                     )}
                   </div>
               </Card>

               {/* Operations Summary */}
               <Card className="rounded-[2rem] border border-gray-100 p-6 space-y-4 bg-white shadow-sm md:col-span-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Carpenter</p>
                        <p className="text-lg font-bold text-[#2d221c]">₹{product.labour.carpenter.toLocaleString()}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Polish</p>
                        <p className="text-lg font-bold text-[#2d221c]">₹{product.labour.polish.toLocaleString()}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Foam Labour</p>
                        <p className="text-lg font-bold text-[#2d221c]">₹{product.labour.foam.toLocaleString()}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Miscellaneous</p>
                        <p className="text-lg font-bold text-[#2d221c]">₹{product.miscellaneous.amount.toLocaleString()}</p>
                     </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Factory Expense ({product.factoryExpensePercent}%)</p>
                      <p className="text-sm font-bold text-stone-600">₹{Math.round((product.totalMaterials + product.totalLabour + product.miscellaneous.amount) * product.factoryExpensePercent / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-[#2d221c] px-6 py-4 rounded-2xl text-white flex items-center gap-4">
                       <div>
                         <p className="text-[8px] font-black uppercase tracking-widest text-amber-500">Internal Cost</p>
                         <p className="text-2xl font-bold">₹{Math.round(product.totalInternalCost).toLocaleString()}</p>
                       </div>
                    </div>
                  </div>
               </Card>
            </div>
          </div>
        </div>

        {/* Right Column: PRICING PANEL — MODULE B Core */}
        <aside className="lg:col-span-5 space-y-6 sticky top-24">
          <Card className="rounded-[2.5rem] p-0 border-none shadow-lg bg-white relative overflow-hidden">
             {/* Header Bar */}
             <div className="bg-[#2d221c] p-6 flex items-center gap-3">
               <DollarSign className="text-amber-500 w-5 h-5" />
               <div>
                 <h3 className="text-lg font-bold text-white">Customer Pricing</h3>
                 <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-[0.2em]">Module B — Final Price Calculator</p>
               </div>
             </div>

             <div className="p-8 space-y-6">
                {/* Customer Type Selection — Large Buttons */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Customer Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_CUSTOMER_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedCustomerType(type)}
                        className={`px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          selectedCustomerType === type
                            ? 'bg-[#2d221c] text-white border-transparent shadow-lg'
                            : 'bg-white text-stone-500 border-stone-200 hover:border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Name (Optional) */}
                <Input 
                  label="Customer Name (Optional)" 
                  placeholder="e.g. Sharma Residence"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />

                {/* Markup Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Markup %</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="w-full h-14 px-4 pr-10 rounded-xl border-2 border-stone-200 focus:border-amber-500 focus:outline-none bg-white text-2xl font-bold text-[#2d221c] text-center transition-colors"
                        value={markupPercent}
                        onChange={(e) => setMarkupPercent(Number(e.target.value))}
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    </div>
                    {markupSettings.find(m => m.customer_type === selectedCustomerType) && (
                      <p className="text-[8px] text-amber-600 font-bold uppercase text-center mt-1">Default for {selectedCustomerType}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">GST</label>
                    <button 
                      onClick={() => setIncludeGST(!includeGST)}
                      className={`w-full h-14 rounded-xl border-2 transition-all flex items-center justify-center gap-2 text-sm font-bold ${includeGST ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                    >
                      {includeGST ? <ShieldCheck className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      {includeGST ? `${gstPercent}% ON` : 'Add GST'}
                    </button>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="bg-stone-50 rounded-2xl p-5 space-y-3 border border-stone-200">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Base Internal Cost</span>
                     <span className="text-sm font-bold text-stone-600">₹{Math.round(pricingSummary?.internalCost || 0).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">+ Markup ({markupPercent}%)</span>
                     <span className="text-sm font-bold text-amber-700">₹{Math.round(pricingSummary?.markupAmount || 0).toLocaleString()}</span>
                   </div>
                   {includeGST && (
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">+ GST ({gstPercent}%)</span>
                       <span className="text-sm font-bold text-stone-500">₹{Math.round(pricingSummary?.gstAmount || 0).toLocaleString()}</span>
                     </div>
                   )}
                </div>

                {/* FINAL SELLING PRICE — Big Display */}
                <div className="bg-gradient-to-br from-[#2d221c] to-[#1a1510] p-8 rounded-[2rem] text-center relative overflow-hidden">
                   <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-2">Final Selling Price</p>
                   <h2 className="text-5xl font-bold text-white tracking-tight">₹{Math.round(pricingSummary?.finalPrice || 0).toLocaleString()}</h2>
                   <div className="flex items-center justify-center gap-4 mt-4">
                     <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full">
                       {pricingSummary?.profitMargin?.toFixed(1)}% Margin
                     </span>
                     <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-wider">
                       Profit ₹{Math.round(pricingSummary?.markupAmount || 0).toLocaleString()}
                     </span>
                   </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                   <Button 
                    className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-bold uppercase tracking-[0.1em] shadow-lg transition-all"
                    onClick={onCreateQuote}
                    disabled={quoteSaved}
                   >
                     <ClipboardCheck className="w-5 h-5 mr-3" />
                     {quoteSaved ? 'Quote Created!' : 'Create Quote from This'}
                   </Button>
                   <p className="text-[9px] text-gray-400 text-center font-bold px-6 leading-relaxed">
                     Generates a quotation with the selected pricing. The base product costing stays untouched in the library.
                   </p>
                </div>
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
            <Button className="bg-[#2d221c] text-white" onClick={saveUpdatedSnapshot}>Update & Save</Button>
          </div>
        }
      >
        <div className="space-y-6 text-center">
           <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
             <RefreshCw className="w-8 h-8" />
           </div>
           
           <h3 className="text-lg font-bold text-[#2d221c]">New Material Rates Available</h3>
           <p className="text-stone-500 max-w-sm mx-auto text-sm leading-relaxed">
             Current master rates differ from the saved snapshot.
           </p>

           <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200">
             <div className="grid grid-cols-2 gap-6 relative">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-2 bg-white rounded-full border border-stone-200 shadow-sm z-10">
                 <ArrowUpRight className="w-4 h-4" />
               </div>
               
               <div className="space-y-1">
                 <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Old Internal</p>
                 <p className="text-xl font-bold text-stone-400">₹{Math.round(updateComparison?.old || 0).toLocaleString()}</p>
               </div>
               
               <div className="space-y-1 border-l border-stone-200 pl-4">
                 <p className="text-[9px] font-black uppercase text-[#2d221c] tracking-widest">New Internal</p>
                 <p className="text-xl font-bold text-[#2d221c]">₹{Math.round(updateComparison?.new || 0).toLocaleString()}</p>
               </div>
             </div>
             
             <div className="mt-6 pt-4 border-t border-stone-200">
               <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-stone-200 shadow-sm">
                 <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Δ</span>
                 <span className={`text-sm font-bold ${((updateComparison?.new || 0) - (updateComparison?.old || 0)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                   {((updateComparison?.new || 0) - (updateComparison?.old || 0)) > 0 ? '+' : ''}
                   ₹{Math.round((updateComparison?.new || 0) - (updateComparison?.old || 0)).toLocaleString()}
                 </span>
               </div>
             </div>
           </div>
        </div>
      </Modal>
    </div>
  );
}
