"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getQuotation } from "@/lib/firebase/services";
import { Quotation } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { 
  Calculator, 
  Layers, 
  Trash2, 
  TrendingUp, 
  FileText, 
  Printer, 
  Copy, 
  ChevronRight,
  Package,
  CheckCircle2,
  Image as ImageIcon,
  Download,
  Trees,
  Wind,
  ShieldCheck,
  Activity,
  Trees as TreesIcon
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function QuotationTemplatePage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (id) {
        const data = await getQuotation(id as string);
        setQuote(data);
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id]);

  const copyUrl = () => {
    const url = window.location.href.split('?')[0];
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPdf = async () => {
    if (!reportRef.current || !quote) return;
    
    setIsExporting(true);
    window.scrollTo(0, 0);
    
    // Give content and styles more time to settle
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Fix for "unsupported color function oklab/oklch"
          // Tailwind v4 uses modern color spaces that html2canvas cannot parse.
          // We override them with HEX fallbacks for the PDF clone.
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              --color-amber-50: #fffbeb !important;
              --color-amber-100: #fef3c7 !important;
              --color-amber-500: #f59e0b !important;
              --color-amber-600: #d97706 !important;
              --color-amber-700: #b45309 !important;
              --color-amber-800: #92400e !important;
              --color-amber-900: #78350f !important;
              --color-gray-50: #f9fafb !important;
              --color-gray-300: #d1d5db !important;
              --color-gray-400: #9ca3af !important;
              --color-gray-500: #6b7280 !important;
              --color-gray-700: #374151 !important;
              --color-gray-900: #111827 !important;
              --color-blue-50: #eff6ff !important;
              --color-blue-700: #1d4ed8 !important;
              --color-blue-900: #1e3a8a !important;
              --color-orange-50: #fff7ed !important;
              --color-orange-600: #ea580c !important;
              --color-orange-700: #c2410c !important;
              --color-orange-900: #7c2d12 !important;
              --color-emerald-50: #ecfdf5 !important;
              --color-emerald-500: #10b981 !important;
              --color-emerald-600: #059669 !important;
              --color-rose-500: #f43f5e !important;
              color-scheme: light !important;
            }
            .bg-grain { 
              background-image: none !important; 
              display: none !important; 
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // First Page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Subsequent Pages
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${quote.customerName}_Technical_Costing_${quote.refCode || 'Report'}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Falling back to print dialog.");
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!loading && quote && searchParams.get('download') === 'true') {
      const timer = setTimeout(() => {
        downloadPdf();
      }, 1500); 
      return () => clearTimeout(timer);
    }
  }, [loading, quote, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="flex flex-col items-center gap-4">
           <div className="w-16 h-16 border-4 border-amber-900/5 border-t-amber-700 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-900/40">Architecting Preview...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 font-serif">Valuation Not Found</h1>
          <p className="text-sm text-gray-500">The requested internal review link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] pb-20 print:bg-white print:pb-0 font-sans selection:bg-amber-100 selection:text-amber-900">
      <title>{quote.customerName} | Woodflex Bespoke Valuation</title>
      
      {/* Top Internal Hub Bar (Hidden in Print) */}
      <div className="bg-[#1c1917] border-b border-white/5 sticky top-0 z-50 print:hidden shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-10 font-sans">
          <div className="flex items-center gap-4">
             <div className="bg-amber-500/10 p-2 rounded-xl border border-white/10 uppercase font-black text-[10px] text-amber-500 tracking-widest">
               Internal Decision Hub
             </div>
             <div>
               <span className="block font-serif text-white text-lg tracking-tight">Founder Approval Sheet</span>
               <span className="block text-[9px] font-black text-amber-500/50 uppercase tracking-[0.3em]">REF: {quote.refCode || 'DFT-99'}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-200 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 opacity-50" />
              Print Record
            </button>
            <button 
              onClick={downloadPdf}
              disabled={isExporting}
              className={`flex items-center gap-3 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-all shadow-xl hover:shadow-amber-500/20 active:scale-95 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? "Exporting Audit..." : "Download Approval PDF"}
            </button>
          </div>
        </div>
      </div>

      <div ref={reportRef} id="pdf-content" className="max-w-5xl mx-auto bg-white shadow-2xl print:shadow-none my-14 print:my-0">
        
        {/* =================================================================== */}
        {/* PAGE 1: INTERNAL EXECUTIVE SUMMARY (FOUNDER ONLY)                 */}
        {/* =================================================================== */}
        <div className="p-16 md:p-20 min-h-[1100px] flex flex-col page-break-after-always relative bg-white">
          
          <div className="flex justify-between items-start mb-16 pb-8 border-b-8 border-black">
            <div className="space-y-1">
              <h1 className="text-5xl font-serif text-black uppercase font-black tracking-tighter">WOODFLEX</h1>
              <p className="text-[10px] font-black text-gray-400 tracking-[0.5em] uppercase">INTERNAL DECISION RECORD — CONFIDENTIAL</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">ID: {quote.refCode || 'N/A'}</p>
              <p className="text-lg font-black text-black uppercase">{new Date(quote.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-12 flex-1">
            {/* Left Col: Photo & Founder Authorization */}
            <div className="col-span-5 flex flex-col space-y-12">
               {quote.productImage && (
                 <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden border-4 border-gray-100 shadow-xl bg-gray-50">
                    <img src={quote.productImage} className="w-full h-full object-cover" />
                 </div>
               )}

               <div className="p-10 bg-gray-50 rounded-[3rem] border-2 border-gray-100 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-[11px] font-black text-amber-700 uppercase tracking-[0.4em] mb-10 border-b-2 border-amber-100 pb-2">FOUNDER AUTHORIZATION</h3>
                    <div className="space-y-10">
                       <div className="flex items-center gap-5">
                          <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center">
                            <div className="w-4 h-4 bg-black rounded-sm"></div>
                          </div>
                          <span className="text-base font-black text-black">APPROVE — Release to Workshop</span>
                       </div>
                       <div className="flex items-center gap-5">
                          <div className="w-8 h-8 rounded-lg border-2 border-gray-200"></div>
                          <span className="text-base font-black text-gray-400">REWORK — Re-calculate Specs</span>
                       </div>
                       <div className="flex items-center gap-5">
                          <div className="w-8 h-8 rounded-lg border-2 border-gray-200"></div>
                          <span className="text-base font-black text-gray-400">REJECT — Cancel Order</span>
                       </div>
                    </div>
                  </div>

                  <div className="pt-10 border-t-2 border-gray-200 mt-10 space-y-8">
                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Decision Notes:</p>
                        <div className="h-20 border-b border-dashed border-gray-300"></div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-8 pt-4">
                        <div className="space-y-1 border-t-4 border-black pt-3">
                           <p className="text-3xl font-serif italic text-black leading-none mb-1">Amit Bhayani</p>
                           <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Founder Signature</p>
                        </div>
                        <div className="space-y-1 border-t-4 border-black pt-3">
                           <div className="h-8"></div>
                           <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Authorized Signature</p>
                        </div>
                     </div>

                     <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">Decision Date</p>
                        <p className="text-sm font-bold text-black">{new Date(quote.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                     </div>
                  </div>
               </div>
               
               {/* Metadata Credit */}
               <div className="mt-8 text-[9px] font-black text-gray-300 uppercase tracking-[0.4em] flex justify-between items-center px-4">
                  <span>Architecture by Woodflex Team</span>
                  <span className="text-gray-400">Made by Vigyat Pansari</span>
               </div>
            </div>

            {/* Right Col: The BIG Metrics & Cost Snapshot */}
            <div className="col-span-7 flex flex-col">
               <div className="space-y-2 mb-12">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Client Engagement</p>
                  <h2 className="text-5xl font-serif text-black tracking-tighter leading-none">{quote.customerName}</h2>
                  <p className="text-sm font-black text-amber-700 uppercase tracking-[0.2em]">{quote.customerType} — {quote.productCategory}</p>
               </div>

               <div className="p-8 bg-black rounded-[2rem] mb-10 text-white flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Project Label</p>
                    <p className="text-3xl font-serif italic text-white tracking-tight leading-none">{quote.productName || 'Bespoke Item'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Internal Reference</p>
                    <p className="text-xl font-mono text-gray-400 tracking-tighter uppercase">{quote.refCode}</p>
                  </div>
               </div>

               {/* CORE PERFORMANCE METRICS */}
               <div className="grid grid-cols-2 gap-px bg-gray-200 border-4 border-black rounded-[3rem] overflow-hidden shadow-2xl">
                  {/* Selling Price */}
                  <div className="bg-white p-10 space-y-2 border-r border-b border-gray-100">
                     <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Selling Price (Ex. GST)</p>
                     <p className="text-6xl font-serif text-black tracking-tighter">{formatCurrency(quote.summary?.baseAmount || 0)}</p>
                  </div>
                  {/* Internal Cost */}
                  <div className="bg-gray-50/50 p-10 space-y-2 border-b border-gray-100">
                     <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Internal Cost</p>
                     <p className="text-5xl font-serif text-gray-400 tracking-tighter">{formatCurrency(quote.summary?.totalInternalCost || 0)}</p>
                  </div>
                  {/* Gross Profit */}
                  <div className="bg-emerald-50 p-10 space-y-2 border-r border-gray-100">
                     <p className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">Net Profit Realization</p>
                     <p className="text-5xl font-black text-emerald-600 tracking-tighter">
                        {formatCurrency((quote.summary?.baseAmount || 0) - (quote.summary?.totalInternalCost || 0))}
                     </p>
                  </div>
                  {/* Margin % */}
                  <div className="bg-emerald-950 p-10 space-y-2 text-emerald-50">
                     <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Margin %</p>
                     <p className="text-7xl font-serif text-emerald-300 tracking-tighter">
                        {(((quote.summary?.baseAmount || 0) - (quote.summary?.totalInternalCost || 0)) / (quote.summary?.baseAmount || 1) * 100).toFixed(1)}<span className="text-3xl ml-1 opacity-40">%</span>
                     </p>
                  </div>
               </div>

               {/* Rapid Cost Snapshot */}
               <div className="mt-12 p-12 bg-gray-50/50 rounded-[2.5rem] border border-gray-100">
                  <h4 className="text-[11px] font-black text-black uppercase tracking-widest mb-8 border-b border-black pb-2">Cost Audit Summary</h4>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                     {quote.summary?.totalWood > 0 && <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Wood Materials</span><span className="font-black">{formatCurrency(quote.summary.totalWood)}</span></div>}
                     {quote.summary?.totalPly > 0 && <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Engineering Boards</span><span className="font-black">{formatCurrency(quote.summary.totalPly)}</span></div>}
                     {quote.summary?.totalFoam > 0 && <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Comfort Layers</span><span className="font-black">{formatCurrency(quote.summary.totalFoam)}</span></div>}
                     <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Workshop Labour</span><span className="font-black">{formatCurrency(quote.summary?.totalLabour || 0)}</span></div>
                     <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Factory Expenses</span><span className="font-black">{formatCurrency(quote.summary?.factoryExpenseAmount || 0)}</span></div>
                     <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2"><span>Other Audit Misc</span><span className="font-black">{formatCurrency(quote.summary?.totalMisc || 0)}</span></div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAGE 2: WORKSHOP TECHNICAL AUDIT                                  */}
        {/* =================================================================== */}
        <div className="p-16 md:p-20 bg-white min-h-[1100px] flex flex-col font-sans">
          <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-6">
            <h2 className="text-3xl font-black text-black uppercase tracking-widest">TECHNICAL AUDIT RECORD</h2>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400">Internal Trace: {quote.refCode}</p>
              <p className="text-[10px] font-black text-gray-400">Project: {quote.productName}</p>
            </div>
          </div>

          <div className="space-y-12 flex-1">
            {/* WOOD SECTION */}
            {quote.woodBreakdown?.length > 0 && (
              <div className="space-y-4">
                 <h3 className="text-[11px] font-black bg-black text-white px-6 py-2 inline-block uppercase tracking-widest">WOOD BREAKDOWN AUDIT</h3>
                 <table className="w-full text-xs border-collapse border border-gray-100">
                    <thead className="bg-gray-100 uppercase text-[9px] font-black text-gray-600 border-b border-gray-200">
                       <tr>
                          <th className="p-4 text-left border border-gray-100">Component Part</th>
                          <th className="p-4 text-left border border-gray-100">Specifications (L×W×T)</th>
                          <th className="p-4 text-center border border-gray-100">Qty</th>
                          <th className="p-4 text-right border border-gray-100">Audit GF</th>
                          <th className="p-4 text-right border border-gray-100">Unit Rate</th>
                          <th className="p-4 text-right border border-gray-100 bg-gray-50">Line Total</th>
                       </tr>
                    </thead>
                    <tbody>
                       {quote.woodBreakdown.map((row) => (
                          <tr key={row.id}>
                             <td className="p-4 border border-gray-100 font-bold uppercase">{row.componentName}</td>
                             <td className="p-4 border border-gray-100 text-[10px] uppercase">{row.woodType} · {row.length_ft}'×{row.width_in}"×{row.thickness_in}"</td>
                             <td className="p-4 border border-gray-100 text-center font-bold">{row.quantity}</td>
                             <td className="p-4 border border-gray-100 text-right italic font-mono">{row.gun_foot}gf</td>
                             <td className="p-4 border border-gray-100 text-right">₹{row.rate_per_gf}</td>
                             <td className="p-4 border border-gray-100 text-right font-black bg-gray-50/50">{formatCurrency(row.total_cost)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )}

            {/* PLYWOOD SECTION */}
            {quote.plyBreakdown?.length > 0 && (
              <div className="space-y-4">
                 <h3 className="text-[11px] font-black bg-black text-white px-6 py-2 inline-block uppercase tracking-widest">BOARD BREAKDOWN AUDIT</h3>
                 <table className="w-full text-xs border-collapse border border-gray-100">
                    <thead className="bg-gray-100 uppercase text-[9px] font-black text-gray-600 border-b border-gray-200">
                       <tr>
                          <th className="p-4 text-left border border-gray-100">Component Part</th>
                          <th className="p-4 text-left border border-gray-100">Board Type / Thickness</th>
                          <th className="p-4 text-center border border-gray-100">Qty</th>
                          <th className="p-4 text-right border border-gray-100">Audit SF</th>
                          <th className="p-4 text-right border border-gray-100">Rate (Inc. Wast)</th>
                          <th className="p-4 text-right border border-gray-100 bg-gray-50">Line Total</th>
                       </tr>
                    </thead>
                    <tbody>
                       {quote.plyBreakdown.map((row) => (
                          <tr key={row.id}>
                             <td className="p-4 border border-gray-100 font-bold uppercase">{row.componentName}</td>
                             <td className="p-4 border border-gray-100 text-[10px] uppercase">{row.plyCategory} · {row.thickness_mm}MM</td>
                             <td className="p-4 border border-gray-100 text-center font-bold">{row.quantity}</td>
                             <td className="p-4 border border-gray-100 text-right italic font-mono">{row.sqft}sf</td>
                             <td className="p-4 border border-gray-100 text-right text-[10px]">₹{row.rate_per_sqft} / {row.wastage_percent}%</td>
                             <td className="p-4 border border-gray-100 text-right font-black bg-gray-50/50">{formatCurrency(row.total_cost)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )}

            {/* FOAM SECTION */}
            {quote.foamBreakdown?.length > 0 && (
              <div className="space-y-4">
                 <h3 className="text-[11px] font-black bg-black text-white px-6 py-2 inline-block uppercase tracking-widest">COMFORT LAYER AUDIT</h3>
                 <table className="w-full text-xs border-collapse border border-gray-100">
                    <thead className="bg-gray-100 uppercase text-[9px] font-black text-gray-600 border-b border-gray-200">
                       <tr>
                          <th className="p-4 text-left border border-gray-100">Audit Area</th>
                          <th className="p-4 text-left border border-gray-100">Specs / Density</th>
                          <th className="p-4 text-center border border-gray-100">Qty</th>
                          <th className="p-4 text-right border border-gray-100">Full Area (SF)</th>
                          <th className="p-4 text-right border border-gray-100">Unit Pricing</th>
                          <th className="p-4 text-right border border-gray-100 bg-gray-50">Line Total</th>
                       </tr>
                    </thead>
                    <tbody>
                       {quote.foamBreakdown.map((row) => (
                          <tr key={row.id}>
                             <td className="p-4 border border-gray-100 font-bold uppercase">{row.componentName}</td>
                             <td className="p-4 border border-gray-100 text-[10px] uppercase whitespace-nowrap">{row.foamType} · {row.specification} · {row.thickness_in}"</td>
                             <td className="p-4 border border-gray-100 text-center font-bold">{row.quantity}</td>
                             <td className="p-4 border border-gray-100 text-right italic font-mono">{row.sqft}sf</td>
                             <td className="p-4 border border-gray-100 text-right text-[10px]">₹{row.master_rate} / ₹{row.rate_per_sqft}</td>
                             <td className="p-4 border border-gray-100 text-right font-black bg-gray-50/50">{formatCurrency(row.total_cost)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )}

            {/* LABOUR & COST AGGREGATION */}
            <div className="grid grid-cols-2 gap-12 mt-auto border-t-8 border-black pt-12">
               <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase text-gray-500 underline decoration-amber-500 decoration-2 underline-offset-4">Internal Service Audit</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-xs">
                     <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span>CARPENTRY LABOUR</span><span className="font-black">{formatCurrency(quote.labour?.carpenter || 0)}</span></div>
                     <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span>SURFACE & POLISH</span><span className="font-black">{formatCurrency(quote.labour?.polish || 0)}</span></div>
                     <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span>UPHOLSTERY SKILLS</span><span className="font-black">{formatCurrency(quote.labour?.foam || 0)}</span></div>
                     <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span>FACTORY OVERHEADS</span><span className="font-black">{formatCurrency(quote.summary?.factoryExpenseAmount || 0)}</span></div>
                     <div className="flex justify-between items-center border-b border-gray-100 pb-2 col-span-2"><span>PROJECT MISC AUDIT</span><span className="font-black">{formatCurrency(quote.miscellaneous?.amount || 0)}</span></div>
                  </div>
               </div>
               
               <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 space-y-4">
                  <div className="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2"><span>Gross Material Cost</span><span>{formatCurrency(quote.summary?.totalMaterials)}</span></div>
                  <div className="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2"><span>Total Service Input</span><span>{formatCurrency((quote.summary?.totalLabour || 0) + (quote.summary?.totalMisc || 0))}</span></div>
                  <div className="flex justify-between text-[13px] font-black text-amber-900 pt-2 pb-4"><span>INTERNAL PRODUCTION LANDED COST</span><span className="text-xl">{formatCurrency(quote.summary?.totalInternalCost)}</span></div>
                  
                  <div className="flex justify-between text-[11px] font-black text-emerald-700 uppercase pt-4 border-t border-gray-200"><span>Target Decision Profit</span><span>{formatCurrency((quote.summary?.baseAmount || 0) - (quote.summary?.totalInternalCost || 0))}</span></div>
                  <div className="flex justify-between text-4xl font-serif text-black pt-6 border-t-4 border-black font-black"><span>FINAL DECISION PRICE</span><span>{formatCurrency(quote.summary?.baseAmount)}</span></div>
               </div>
            </div>

            {/* Footer Audit Signatures (Page 2) */}
            <div className="mt-12 grid grid-cols-2 gap-12 pt-10 border-t-2 border-gray-100 italic">
               <div className="space-y-1">
                  <p className="text-xl font-serif italic text-black leading-none mb-1">Amit Bhayani</p>
                  <p className="text-[9px] font-black uppercase text-gray-400">Founder Authorization Audit</p>
               </div>
               <div className="space-y-1 text-right">
                  <div className="h-8"></div>
                  <p className="text-[9px] font-black uppercase text-gray-400">Authorized Master Audit Signature</p>
               </div>
            </div>

            {/* Final Document Credit */}
            <div className="mt-8 flex justify-between items-center border-t border-gray-100 pt-6 px-4">
               <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Calculated by Woodflex Intelligence v4.0</p>
               <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">Made by Vigyat Pansari</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .page-break-after-always {
            page-break-after: always;
          }
          body {
            background: white !important;
          }
          #pdf-content {
            box-shadow: none !important;
          }
        }
        .font-serif {
           font-family: var(--font-instrument-serif), Georgia, serif;
        }
      `}</style>
    </div>
  );
}
