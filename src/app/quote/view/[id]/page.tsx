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
      
      {/* Top Premium Hub Bar (Hidden in Print) */}
      <div className="bg-[#2d221c] border-b border-white/5 sticky top-0 z-50 print:hidden shadow-2xl">
        <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
             <div className="bg-amber-500/10 p-2 rounded-xl border border-white/10">
               <ShieldCheck className="w-6 h-6 text-amber-500" />
             </div>
             <div>
               <span className="block font-serif text-white text-lg tracking-tight">Factory Valuation Hub</span>
               <span className="block text-[9px] font-black text-amber-500/50 uppercase tracking-[0.3em]">Code: #{quote.refCode || 'DFT-99'}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={copyUrl}
              className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-200 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 opacity-50" />}
              {copied ? "Link Copied" : "Share Audit"}
            </button>
            <button 
              onClick={downloadPdf}
              disabled={isExporting}
              className={`flex items-center gap-3 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-all shadow-xl hover:shadow-amber-500/20 active:scale-95 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? "Architecting PDF..." : "Generate Export"}
            </button>
            <button 
              onClick={() => window.print()}
              className="p-3 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div ref={reportRef} id="pdf-content" className="max-w-5xl mx-auto bg-white shadow-2xl print:shadow-none my-14 print:my-0 rounded-[3rem] overflow-hidden">
        
        {/* =================================================================== */}
        {/* PAGE 1: CLIENT QUOTATION SUMMARY                                  */}
        {/* =================================================================== */}
        <div className="p-16 md:p-24 min-h-[1100px] flex flex-col page-break-after-always relative bg-white">
          <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
          
          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-900/5 rounded-bl-[10rem] pointer-events-none"></div>

          {/* Page 1 Header */}
          <div className="flex justify-between items-start mb-24 relative z-10">
            <div>
               <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#2d221c] rounded-2xl flex items-center justify-center shadow-2xl shadow-black/10">
                  <Calculator className="w-8 h-8 text-amber-500" />
                </div>
                <span className="text-3xl font-serif tracking-tight text-[#2d221c]">Woodflex</span>
              </div>
              <h1 className="text-6xl font-serif text-[#2d221c] tracking-tight leading-none">Quotation</h1>
              <p className="text-amber-900/30 font-black tracking-[0.4em] text-[10px] uppercase mt-4">Industry-Aligned Bespoke Furniture</p>
            </div>
            
            <div className="text-right space-y-2 pt-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-amber-900/40 uppercase tracking-widest">Quote Reference</p>
                <p className="text-2xl font-serif text-[#2d221c]">#{quote.refCode || 'DFT-99'}</p>
              </div>
              <div className="pt-6 space-y-1">
                <p className="text-[9px] font-black text-amber-900/40 uppercase tracking-widest">Issue Date</p>
                <p className="text-sm font-bold text-gray-700">{new Date(quote.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-20 flex-1 relative z-10">
            {/* Left Col: Details */}
            <div className="space-y-14">
               <div className="space-y-8">
                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">Client Entity</h3>
                     <p className="text-3xl font-serif text-gray-900 tracking-tight">{quote.customerName}</p>
                     <p className="text-xs text-amber-900/50 font-black uppercase tracking-widest">{quote.customerType}</p>
                  </div>

                  <div className="pt-8 border-t border-amber-900/10 space-y-2">
                     <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">Project Component</h3>
                     <p className="text-3xl font-serif text-gray-900 tracking-tight uppercase leading-tight">{quote.productName || 'Custom Furniture Piece'}</p>
                     <p className="text-xs text-amber-900/50 font-black uppercase tracking-widest italic">{quote.productCategory}</p>
                  </div>
               </div>

               {quote.notes && (
                 <div className="p-8 bg-amber-50/50 rounded-[2rem] border border-amber-900/5 space-y-4">
                    <h3 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.3em]">Design Specifications</h3>
                    <p className="text-[13px] text-gray-700 leading-relaxed font-medium italic">
                       "{quote.notes}"
                    </p>
                 </div>
               )}

               <div className="pt-10">
                  <div className="p-10 bg-[#2d221c] text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
                    <div className="relative z-10">
                       <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-4">Investment Strategy (Base)</p>
                       <h2 className="text-6xl font-serif tracking-tight text-white mb-2">
                         {formatCurrency(quote.summary?.baseAmount || 0)}
                       </h2>
                       <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-relaxed">
                          *Excluded: GST {quote.gstPercent || 18}% + Logistics.<br/>
                          Factory-Direct Bespoke Pricing.
                       </p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Right Col: Product Photo */}
            <div className="flex flex-col">
               {quote.productImage ? (
                  <div className="aspect-[3/4] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(45,34,28,0.2)] border-8 border-white bg-gray-50 transform hover:scale-[1.02] transition-transform duration-700">
                     <img 
                        src={quote.productImage} 
                        alt={quote.productName} 
                        className="w-full h-full object-cover" 
                     />
                  </div>
               ) : (
                  <div className="aspect-[3/4] rounded-[3rem] bg-amber-50/30 border-4 border-dashed border-amber-900/10 flex flex-col items-center justify-center text-amber-900/10 group">
                     <ImageIcon className="w-20 h-20 mb-6 group-hover:scale-110 transition-transform" />
                     <p className="text-[10px] font-black uppercase tracking-[0.4em]">Visual Reference Missing</p>
                  </div>
               )}
               
               <div className="mt-12 p-8 border border-amber-900/5 rounded-[2rem] flex items-center gap-6">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                     <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="text-[11px] font-black uppercase tracking-widest text-[#2d221c]">Woodflex Quality Guarantee</p>
                     <p className="text-[10px] text-gray-500">Industry-leading structural and finish standards apply.</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="mt-auto pt-16 border-t border-amber-900/10 grid grid-cols-2 gap-10 opacity-70">
             <div className="space-y-4">
                <h4 className="text-[10px] font-black text-[#2d221c] uppercase tracking-[0.3em]">Commercial Footnote</h4>
                <div className="text-[11px] text-gray-500 space-y-1.5 font-medium leading-relaxed">
                   <p>• Validity: 15 Working Days from the issue date marked above.</p>
                   <p>• Payment: 50% Advance with Purchase Order, 50% Post Dispatch.</p>
                   <p>• GST {quote.gstPercent || 18}% extra as per current government mandates.</p>
                </div>
             </div>
             <div className="text-right space-y-6">
                <div className="space-y-2">
                   <h4 className="text-[10px] font-black text-[#2d221c] uppercase tracking-[0.3em]">Woodflex Private Limited</h4>
                   <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                     Modern Craftsmanship for Premium Residential <br/> & High-Output Retail Environments.
                   </p>
                </div>
                <div className="flex justify-end gap-3 text-[10px] font-black text-amber-800">
                   <span className="px-4 py-2 bg-amber-50 rounded-lg">CALCULATED AT FACTORY</span>
                   <span className="px-4 py-2 bg-[#2d221c] text-white rounded-lg uppercase tracking-widest">woodflex.in</span>
                </div>
             </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PAGE 2: TECHNICAL COSTING BREAKDOWN                               */}
        {/* =================================================================== */}
        <div className="p-16 md:p-24 bg-[#fafaf9] border-t-8 border-white min-h-[1100px] flex flex-col">
          <div className="bg-grain absolute inset-0 opacity-[0.02] pointer-events-none"></div>

          <div className="flex justify-between items-end mb-20 border-b-2 border-amber-900/10 pb-10">
            <div>
               <p className="text-[9px] font-black text-amber-700 uppercase tracking-[0.5em] mb-3">Costing Intelligence</p>
               <h2 className="text-4xl font-serif text-[#2d221c] tracking-tight">Audit Breakdown</h2>
               <p className="text-xs text-amber-900/40 font-bold uppercase tracking-[0.2em] mt-2 italic">Strictly for Internal Analysis — #{quote.refCode}</p>
            </div>
            <div className="text-right space-y-1">
              <Printer className="w-5 h-5 text-amber-900/10 ml-auto mb-2" />
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Page 02 of 02</p>
            </div>
          </div>

          <div className="space-y-16 flex-1">
            {/* 1. WOOD BREAKDOWN */}
            <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-amber-900/5">
              <h3 className="text-[11px] font-black text-[#2d221c] uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                <TreesIcon className="w-4 h-4 text-amber-600" /> Structural: Solid Wood
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-amber-900/5">
                      <th className="py-4 pl-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Component / Material</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Band (LxWxT)</th>
                      <th className="py-2 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-center">Qty</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-right">Gun Foot</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-900/[0.03]">
                    {quote.woodBreakdown.map((row) => (
                      <tr key={row.id} className="group">
                        <td className="py-5 pl-4">
                           <p className="text-xs font-bold text-gray-900">{row.componentName}</p>
                           <p className="text-[10px] text-amber-700 font-medium uppercase tracking-tight">{row.woodType}</p>
                        </td>
                        <td className="py-5 text-xs text-gray-500 font-medium">
                           {row.length_ft}' × {row.width_in}" × {row.thickness_in}"
                        </td>
                        <td className="py-5 text-center px-4">
                           <span className="text-xs font-black bg-amber-50 text-amber-900 px-3 py-1 rounded-lg border border-amber-900/5">{row.quantity}</span>
                        </td>
                        <td className="py-5 text-right font-mono text-[11px] text-gray-400 italic">{row.gun_foot}gf</td>
                        <td className="py-5 text-right pr-4">
                           <p className="text-xs font-black text-gray-900">{formatCurrency(row.total_cost)}</p>
                           <p className="text-[9px] font-bold text-amber-900/20 uppercase">@{row.rate_per_gf}/gf</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-900/[0.02]">
                       <td colSpan={4} className="py-5 pl-6 text-[10px] font-black text-[#2d221c] uppercase tracking-widest">Total Solid Wood Investment</td>
                       <td className="py-5 text-right pr-6 font-black text-[#2d221c] text-sm">{formatCurrency(quote.summary?.totalWood || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* 2. PLYWOOD & BOARDS */}
            <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-amber-900/5">
              <h3 className="text-[11px] font-black text-[#2d221c] uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                <Layers className="w-4 h-4 text-blue-600" /> Structural: Engineering Board
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-amber-900/5">
                      <th className="py-4 pl-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Component / Category</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Specification</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-center">Net SF</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-right">Rate + Wastage</th>
                      <th className="py-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-900/[0.03]">
                    {quote.plyBreakdown.map((row) => (
                      <tr key={row.id}>
                        <td className="py-5 pl-4">
                           <p className="text-xs font-bold text-gray-900">{row.componentName}</p>
                           <p className="text-[10px] text-blue-700 font-medium uppercase tracking-tight">{row.plyCategory}</p>
                        </td>
                        <td className="py-5 text-xs text-gray-500 font-medium">{row.thickness_mm}MM · {row.cut_length_in}×{row.cut_width_in}in</td>
                        <td className="py-5 text-center"><span className="text-xs font-bold text-gray-900">{row.sqft}</span></td>
                        <td className="py-5 text-right"><span className="text-[11px] text-gray-400 font-medium">₹{row.rate_per_sqft} + {row.wastage_percent}%</span></td>
                        <td className="py-5 text-right pr-4 font-black text-gray-900 text-xs">{formatCurrency(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-900/[0.02]">
                       <td colSpan={4} className="py-5 pl-6 text-[10px] font-black text-blue-900 uppercase tracking-widest">Total Plywood Component Investment</td>
                       <td className="py-5 text-right pr-6 font-black text-blue-900 text-sm">{formatCurrency(quote.summary?.totalPly || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* 3. SOFT MATERIALS & FOAM */}
            <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-amber-900/5">
              <h3 className="text-[11px] font-black text-[#2d221c] uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                <Wind className="w-4 h-4 text-orange-600" /> Comfort: Foam & Padding
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-amber-900/5">
                      <th className="py-4 pl-4 text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Part / Specs</th>
                      <th className="py-4 text-[10px] text-center px-4">Qty</th>
                      <th className="py-4 text-right text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Area SF</th>
                      <th className="py-4 text-right text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Unit Price</th>
                      <th className="py-4 text-right text-[9px] font-black text-amber-900/30 uppercase tracking-widest">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-900/[0.03]">
                    {quote.foamBreakdown?.map((row) => (
                      <tr key={row.id}>
                        <td className="py-5 pl-4">
                           <p className="text-xs font-bold text-gray-900">{row.componentName}</p>
                           <p className="text-[9px] text-orange-700 font-black uppercase tracking-widest opacity-60">{row.foamType} | {row.specification} | {row.thickness_in}"</p>
                        </td>
                        <td className="py-5 text-center px-4"><span className="text-xs font-black text-gray-900">{row.quantity}</span></td>
                        <td className="py-5 text-right font-mono text-[11px] text-gray-400">{row.sqft}</td>
                        <td className="py-5 text-right text-[11px] font-medium text-gray-400">₹{row.rate_per_sqft}/sf</td>
                        <td className="py-5 text-right pr-4 font-black text-gray-900 text-xs">{formatCurrency(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orange-900/[0.02]">
                       <td colSpan={4} className="py-5 pl-6 text-[10px] font-black text-orange-900 uppercase tracking-widest">Total Padding & Comfort Investment</td>
                       <td className="py-5 text-right pr-6 font-black text-orange-900 text-sm">{formatCurrency(quote.summary?.totalFoam || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* 4. LABOUR & FACTORY AUDIT */}
            <div className="grid md:grid-cols-2 gap-10">
               <div className="bg-white p-10 rounded-[2.5rem] border border-amber-900/5 shadow-sm space-y-8">
                  <h3 className="text-[10px] font-black text-[#2d221c] uppercase tracking-[0.4em] flex items-center gap-3">
                     <Activity className="w-4 h-4 text-emerald-500" /> Craftsmanship Allocation
                  </h3>
                  <div className="space-y-4">
                     {[
                       { label: 'Carpenter Guild', val: quote.labour?.carpenter },
                       { label: 'Surface / Polish', val: quote.labour?.polish },
                       { label: 'Upholstery Labor', val: quote.labour?.foam },
                       { label: 'Fittings & Misc', val: quote.miscellaneous?.amount }
                     ].map((l, i) => (
                       <div key={i} className="flex justify-between items-center group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-amber-900 transition-colors uppercase tracking-widest text-[9px]">{l.label}</span>
                          <span className="text-sm font-black text-[#2d221c] tabular-nums">{formatCurrency(l.val || 0)}</span>
                       </div>
                     ))}
                     <div className="pt-6 border-t border-amber-900/5 flex justify-between items-end">
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Audit Total Services</span>
                        <span className="text-xl font-serif text-[#2d221c] underline decoration-amber-500/30 decoration-4 underline-offset-8">
                           {formatCurrency((quote.summary?.totalLabour || 0) + (quote.summary?.totalMisc || 0))}
                        </span>
                     </div>
                  </div>
               </div>

               <div className="bg-[#2d221c] p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white flex flex-col justify-between">
                  <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-10">Internal Cost Audit</h3>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between text-xs text-white/40 uppercase tracking-widest font-black text-[9px]">
                          <span>Net Materials</span>
                          <span>{formatCurrency(quote.summary?.totalMaterials)}</span>
                       </div>
                       <div className="flex justify-between text-xs text-white/40 uppercase tracking-widest font-black text-[9px]">
                          <span>Net Services</span>
                          <span>{formatCurrency((quote.summary?.totalLabour || 0) + (quote.summary?.totalMisc || 0))}</span>
                       </div>
                       <div className="flex justify-between text-xs text-amber-500 font-bold uppercase tracking-widest text-[9px]">
                          <span>Factory O/H ({quote.factoryExpensePercent}%)</span>
                          <span>{formatCurrency(quote.summary?.factoryExpenseAmount)}</span>
                       </div>
                    </div>
                  </div>

                  <div className="relative z-10 pt-10 border-t border-white/5 space-y-2 mt-auto">
                     <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Total Production Cost</p>
                     <p className="text-4xl font-serif tracking-tight text-white mb-6 underline decoration-amber-500 decoration-1 underline-offset-[10px]">
                        {formatCurrency(quote.summary?.totalInternalCost)}
                     </p>
                     <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30 tracking-widest">
                        <span>Factory Wastage Impact:</span>
                        <span className="text-amber-200">₹{quote.summary?.totalWastageAmount?.toLocaleString()} INCLD</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Signature Block */}
            <div className="pt-24 mt-auto">
               <div className="grid grid-cols-2 gap-32">
                  <div className="space-y-6">
                     <div className="h-0.5 bg-amber-900/10 w-full relative">
                        <div className="absolute top-0 left-0 w-8 h-0.5 bg-amber-500"></div>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-[#2d221c] uppercase tracking-[0.3em]">Lead Architect Audit</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Industrial Valuation Unit</p>
                     </div>
                  </div>
                  <div className="space-y-6 text-right">
                     <div className="h-0.5 bg-amber-900/10 w-full relative">
                        <div className="absolute top-0 right-0 w-8 h-0.5 bg-amber-500"></div>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-[#2d221c] uppercase tracking-[0.3em]">Managing Director Approval</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Woodflex Bespoke Private Limited</p>
                     </div>
                  </div>
               </div>
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
          /* Ensure rounded corners and shadows dont break on some browsers */
          #pdf-content {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        .font-serif {
           font-family: var(--font-instrument-serif), Georgia, serif;
        }
        .bg-grain {
          background-image: url("https://www.transparenttextures.com/patterns/p6.png");
        }
      `}</style>
    </div>
  );
}
