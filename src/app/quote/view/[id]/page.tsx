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
  Download
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function InternalReviewPage() {
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
    
    // Give state a moment to update DOM
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // You can modify the cloned document if needed
          const el = clonedDoc.getElementById('pdf-content');
          if (el) el.style.padding = '40px';
        }
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${quote.customerName}_Woodflex_Technical_Report.pdf`);
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
      // Trigger download automatically if requested
      const timer = setTimeout(() => {
        downloadPdf();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, quote, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Quotation Not Found</h1>
          <p className="text-gray-500">The requested internal review link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0">
      <title>{quote.customerName} - Technical Costing Review</title>
      
      {/* Top Action Bar (Hidden in Print) */}
      <div className="bg-white border-b sticky top-0 z-10 print:hidden shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 p-1.5 rounded-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Woodflex Internal Review</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={copyUrl}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link Copied!" : "Copy Link"}
            </button>
            <button 
              onClick={downloadPdf}
              disabled={isExporting}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-all shadow-lg hover:shadow-xl active:scale-95 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? "Generating PDF..." : "Download PDF"}
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      <div ref={reportRef} id="pdf-content" className={`max-w-6xl mx-auto bg-white ${isExporting ? 'p-12' : 'p-4 pt-10'}`}>
        {/* Professional Letterhead Header */}
        <div className="border-b-4 border-amber-900/10 pb-8 mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20">
                <Calculator className="w-7 h-7 text-white" />
              </div>
              <div>
                <span className="text-3xl font-black tracking-tighter uppercase text-[#2d221c]">Woodflex</span>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.3em] leading-none">Bespoke Furniture Solutions</p>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Technical Costing & Audit Report</h1>
            <p className="text-xs text-gray-400 font-medium">Internal review document for production and pricing approval.</p>
          </div>
          <div className="text-right space-y-1">
            <div className="inline-block px-3 py-1 bg-gray-900 text-white rounded-lg text-[10px] font-black tracking-widest uppercase mb-2">
              ID: {quote.refCode || 'DFT-001'}
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Date Generated</p>
            <p className="text-sm font-black text-gray-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="pt-4">
        {/* Header Hero & Executive Summary */}
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm ${
                  quote.status === 'Approved' ? 'bg-green-600 text-white' :
                  quote.status === 'Rejected' ? 'bg-red-600 text-white' :
                  quote.status === 'Sent' ? 'bg-blue-600 text-white' :
                  'bg-amber-600 text-white'
                }`}>
                  {quote.status || 'Draft'}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client Name</span>
              </div>
              <h2 className="text-4xl font-black text-[#2d221c] tracking-tight leading-tight uppercase">{quote.customerName}</h2>
              <p className="text-lg text-amber-700/80 font-bold uppercase tracking-wider">{quote.productCategory}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Wood Value</p>
                 <p className="text-lg font-black text-gray-900">{formatCurrency(quote.summary?.totalWood || 0)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ply Value</p>
                 <p className="text-lg font-black text-gray-900">{formatCurrency(quote.summary?.totalPly || 0)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Foam Value</p>
                 <p className="text-lg font-black text-gray-900">{formatCurrency(quote.summary?.totalFoam || 0)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Material</p>
                 <p className="text-lg font-black text-amber-700">{formatCurrency(quote.summary?.totalMaterials || 0)}</p>
               </div>
            </div>
          </div>
          
          <div className="relative group aspect-square md:aspect-auto">
            {quote.productImage ? (
              <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 flex items-center justify-center p-2">
                <img 
                  src={quote.productImage} 
                  alt="Product Reference" 
                  className="max-w-full max-h-full object-contain" 
                />
              </div>
            ) : (
              <div className="w-full h-full rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                <ImageIcon className="w-12 h-12 mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-widest">No Reference</span>
              </div>
            )}
          </div>
        </div>

        {/* Technical Breakdown Sections */}
        <div className="grid lg:grid-cols-3 gap-8 print:block">
          {/* Main Breakdown Area */}
          <div className="lg:col-span-2 space-y-8 print:space-y-4">
            
            {/* Wood Breakdown */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:p-0 print:border-none print:shadow-none print:break-inside-avoid">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3 print:mb-3 print:text-lg">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center print:hidden">
                  <FileText className="w-4 h-4 text-amber-700" />
                </div>
                Wood Specifications (Raw Materials)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100 pb-4 print:border-gray-900">
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-2 print:text-gray-900">Component</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Type</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Size (L x W x T)</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Qty</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right pr-2 print:text-gray-900">Total GF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                    {quote.woodBreakdown.map((row) => (
                      <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="py-4 pl-2 font-semibold text-gray-900 print:py-2">{row.componentName}</td>
                        <td className="py-4 text-gray-600 print:py-2">{row.woodType}</td>
                        <td className="py-4 text-gray-500 print:py-2">{row.length_ft}' x {row.width_in}" x {row.thickness_in}"</td>
                        <td className="py-4 text-gray-900 font-medium print:py-2">{row.quantity}</td>
                        <td className="py-4 text-right pr-2 font-bold text-amber-700 print:py-2">{row.gun_foot} GF</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-100 print:border-gray-900">
                    <tr className="bg-gray-50/50 font-bold">
                      <td colSpan={3} className="py-4 pl-2 text-gray-400 uppercase text-[10px] tracking-widest">Total Wood Volume</td>
                      <td className="py-4 text-gray-900">{quote.woodBreakdown.reduce((sum, r) => sum + r.quantity, 0)} Units</td>
                      <td className="py-4 text-right pr-2 text-amber-900">{quote.woodBreakdown.reduce((sum, r) => sum + r.gun_foot, 0).toFixed(2)} GF</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Plywood Breakdown */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:p-0 print:border-none print:shadow-none print:break-inside-avoid print:mt-10">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3 print:mb-3 print:text-lg">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center print:hidden">
                  <Layers className="w-4 h-4 text-blue-700" />
                </div>
                Plywood Requirements
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100 pb-4 print:border-gray-900">
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-2 print:text-gray-900">Component</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Category</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Thickness</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest px-4 print:text-gray-900">Size (in)</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right pr-2 print:text-gray-900">Sq.Ft</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                    {quote.plyBreakdown.map((row) => (
                      <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="py-4 pl-2 font-semibold text-gray-900 print:py-2">{row.componentName}</td>
                        <td className="py-4 text-gray-600 print:py-2">{row.plyCategory}</td>
                        <td className="py-4 text-gray-500 font-medium print:py-2">{row.thickness_mm} MM</td>
                        <td className="py-4 px-4 text-gray-400 print:py-2">{row.cut_length_in}" x {row.cut_width_in}"</td>
                        <td className="py-4 text-right pr-2 font-bold text-blue-700 print:py-2">{row.sqft} FT²</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-100 print:border-gray-900">
                    <tr className="bg-gray-100/30 font-bold">
                      <td colSpan={4} className="py-4 pl-2 text-gray-400 uppercase text-[10px] tracking-widest">Total Surface Area</td>
                      <td className="py-4 text-right pr-2 text-blue-900">{quote.plyBreakdown.reduce((sum, r) => sum + r.sqft, 0).toFixed(2)} FT²</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Foam Specs */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:p-0 print:border-none print:shadow-none print:break-inside-avoid print:mt-10">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3 print:mb-3 print:text-lg">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center print:hidden">
                   <ImageIcon className="w-4 h-4 text-orange-700" />
                </div>
                Internal Foam Requirements
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100 pb-4 print:border-gray-900">
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-2 print:text-gray-900">Component</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Type</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Thickness</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest px-4 print:text-gray-900">Size (in)</th>
                      <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right pr-2 print:text-gray-900">Sq.Ft</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                    {quote.foamBreakdown?.map((row) => (
                      <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="py-4 pl-2 font-semibold text-gray-900 print:py-2">{row.componentName}</td>
                        <td className="py-4 text-gray-600 print:py-2">{row.foamType}</td>
                        <td className="py-4 text-gray-500 font-medium print:py-2">{row.thickness_in}"</td>
                        <td className="py-4 px-4 text-gray-400 print:py-2">{row.cut_length_in}" x {row.cut_width_in}"</td>
                        <td className="py-4 text-right pr-2 font-bold text-orange-700 print:py-2">{row.sqft} FT²</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-100 print:border-gray-900">
                    <tr className="bg-orange-50/30 font-bold">
                      <td colSpan={4} className="py-4 pl-2 text-gray-400 uppercase text-[10px] tracking-widest">Total Foam Area</td>
                      <td className="py-4 text-right pr-2 text-orange-900">{quote.foamBreakdown?.reduce((sum, r) => sum + r.sqft, 0).toFixed(2)} FT²</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Fabric Breakdown (Conditional) */}
            {quote.fabricBreakdown && quote.fabricBreakdown.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:p-0 print:border-none print:shadow-none print:break-inside-avoid print:mt-10">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3 print:mb-3 print:text-lg">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center print:hidden">
                    <Package className="w-4 h-4 text-purple-700" />
                  </div>
                  Upholstery & Fabric Details
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-100 pb-4 print:border-gray-900">
                        <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-2 print:text-gray-900">Component</th>
                        <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Fabric Type</th>
                        <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest print:text-gray-900">Usage</th>
                        <th className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right pr-2 print:text-gray-900">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                      {quote.fabricBreakdown.map((row) => (
                        <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                          <td className="py-4 pl-2 font-semibold text-gray-900 print:py-2">{row.componentName}</td>
                          <td className="py-4 text-gray-600 print:py-2">{row.fabricType}</td>
                          <td className="py-4 text-gray-500 print:py-2">{row.metersRequired}M (+{row.wastagePercent}%)</td>
                          <td className="py-4 text-right pr-2 font-bold text-purple-700 print:py-2">{formatCurrency(row.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar / Cost Summary Area */}
          <div className="space-y-8 print:mt-12 print:space-y-6">
            
            {/* Financial Internal Review */}
            <div className="bg-white rounded-3xl shadow-sm border-2 border-amber-900/10 p-8 print:p-6 print:rounded-2xl print:break-inside-avoid">
              <h3 className="text-sm font-black text-amber-900/40 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Pricing Summary
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-bold uppercase tracking-widest">Base Material Value</span>
                  <span className="font-bold text-gray-900">{formatCurrency(quote.summary?.baseAmount || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-bold uppercase tracking-widest">GST ({quote.gstPercent || 18}%)</span>
                  <span className="font-medium text-gray-600">{formatCurrency(quote.summary?.gstAmount || 0)}</span>
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[#2d221c] text-xs font-black uppercase tracking-[0.2em]">Final Quotation</span>
                    <span className="text-4xl font-black text-amber-700 leading-none print:text-3xl">{formatCurrency(quote.summary?.grandTotal || 0)}</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-50 space-y-3">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Internal Cost</span>
                     <span className="text-xs font-black text-gray-900">{formatCurrency(quote.summary?.totalInternalCost || 0)}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estimated Profit</span>
                     <span className="text-xs font-black text-green-600">+{formatCurrency(quote.summary?.grandTotal - quote.summary?.totalInternalCost)} ({quote.summary?.profitPercent}%)</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Production Efficiency */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:p-6 print:border-2 print:border-red-200 print:break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2 print:mb-3">
                <Trash2 className="w-5 h-5 text-red-500" /> Efficiency Audit
              </h3>
              <div className="space-y-6 print:space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 print:hidden">
                    <TrendingUp className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest print:text-gray-500">Estimated Wastage</p>
                    <p className="text-xl font-black text-gray-900">{formatCurrency(quote.summary?.totalWastageAmount || 0)}</p>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl print:p-0 print:bg-white">
                  <p className="text-xs font-medium text-gray-500 leading-relaxed italic print:not-italic">
                    "This represents lost value across raw materials. Target reduction via nesting optimization."
                  </p>
                </div>
              </div>
            </div>

            {/* Approval Section (Only visible in Print) */}
            <div className="hidden print:block border-t-2 border-gray-200 pt-12 mt-12 break-inside-avoid">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-8 text-center text-gray-400">Formal Approval</h3>
              <div className="grid grid-cols-2 gap-12">
                <div className="text-center">
                  <div className="h-px bg-gray-300 mb-2"></div>
                  <p className="text-xs font-bold text-gray-900 uppercase">Founder / Proprietor</p>
                  <p className="text-[10px] text-gray-400 lowercase mt-1">sign & date</p>
                </div>
                <div className="text-center">
                  <div className="h-px bg-gray-300 mb-2"></div>
                  <p className="text-xs font-bold text-gray-900 uppercase">Production Head</p>
                  <p className="text-[10px] text-gray-400 lowercase mt-1">sign & date</p>
                </div>
              </div>
              <div className="mt-12 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-300 uppercase tracking-widest">Woodflex Costing Engine v1.2 - Internal Use Only</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
