"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Grid, 
  List as ListIcon, 
  Filter, 
  ChevronRight,
  Clock,
  User,
  MoreVertical,
  Copy,
  Trash2,
  ExternalLink,
  Plus,
  Database,
  FileText,
  Printer,
  Download,
  Package,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Quotation } from "@/types";
import { getRecentQuotations, duplicateQuotation } from "@/lib/firebase/services";

export default function QuotesLibraryPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await getRecentQuotations(50);
      setQuotes(data);
    } catch (err: any) {
      console.error("[Library] Load Error:", err);
    }
    setLoading(false);
  }

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Duplicate this quotation?")) {
      try {
        const newId = await duplicateQuotation(id);
        router.push(`/quote/edit/${newId}`);
      } catch (err) {
        alert("Failed to duplicate");
      }
    }
  };

  const filteredQuotes = quotes.filter(q => 
    (q.productName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.tags?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-grain fixed inset-0 opacity-[0.015] pointer-events-none"></div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-amber-900/10 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-amber-900/40 translate-y-2">
             <div className="w-8 h-px bg-amber-900/20"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Valuation Archive</p>
          </div>
          <h1 className="text-5xl font-serif text-[#2d221c] tracking-tight">Intelligence Library</h1>
          <p className="text-amber-800/60 font-medium text-sm flex items-center gap-2">
             <Database className="w-4 h-4" /> MANAGING {quotes.length} STORED PRODUCT DRAWINGS & COST AUDITS
          </p>
        </div>
        <Link href="/quote/new">
          <Button className="h-14 px-8 rounded-2xl bg-[#2d221c] hover:bg-black text-white shadow-2xl shadow-amber-900/10 border-t border-white/5 flex items-center gap-3 group transition-all text-sm font-serif">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
            New Quotation
          </Button>
        </Link>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood relative overflow-hidden group">
        <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
        <div className="relative z-10 flex-1 max-w-2xl w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-900/20 group-focus-within:text-amber-600 transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by product, customer or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500/10 transition-all font-medium placeholder:text-amber-900/20"
          />
        </div>

        <div className="relative z-10 flex gap-4">
          <div className="flex bg-amber-50/50 p-1.5 rounded-2xl border border-amber-900/5 shadow-inner">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#2d221c] text-white shadow-xl translate-y-[-2px]' : 'text-amber-900/30 hover:bg-amber-100/50'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[#2d221c] text-white shadow-xl translate-y-[-2px]' : 'text-amber-900/30 hover:bg-amber-100/50'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>
          <Button variant="outline" className="h-14 w-14 rounded-2xl border-amber-900/5 bg-amber-50/50 text-amber-700 hover:bg-white shadow-inner">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-80 animate-pulse bg-white border border-amber-900/5 rounded-[2.5rem]" />)}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="py-32 text-center space-y-6 bg-white rounded-[3rem] border border-dashed border-amber-900/10 relative overflow-hidden">
            <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
            <Search className="w-20 h-20 mx-auto text-amber-900/5" />
            <p className="text-2xl font-serif text-amber-900/20 italic">No valuations found in the current parameters.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-6"}>
          {filteredQuotes.map((quote) => (
            viewMode === 'grid' ? (
              <div 
                key={quote.id} 
                onClick={() => window.location.href=`/quote/view/${quote.id}`}
                className="bg-white rounded-[2.5rem] overflow-hidden group border border-amber-900/5 shadow-wood hover:shadow-2xl hover:translate-y-[-8px] transition-all duration-700 cursor-pointer relative"
              >
                <div className="bg-amber-100 aspect-[4/3] relative overflow-hidden">
                  <div className="bg-grain absolute inset-0 opacity-20 pointer-events-none"></div>
                  {quote.productImage ? (
                    <img src={quote.productImage} alt={quote.productName} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-amber-900/10">
                      <Package className="w-20 h-20" />
                    </div>
                  )}
                  
                  {/* Floating Badges */}
                  <div className="absolute top-5 left-5 flex flex-col gap-2 relative z-10">
                    <span className="bg-black/40 backdrop-blur-xl text-white text-[8px] font-black px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">
                      {quote.productCategory}
                    </span>
                    <span className={`text-[8px] font-black px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest backdrop-blur-xl ${
                      quote.status === 'Approved' ? 'bg-emerald-500/60 text-white' :
                      quote.status === 'Rejected' ? 'bg-rose-500/60 text-white' :
                      'bg-amber-500/60 text-white'
                    }`}>
                      {quote.status || 'Draft Audit'}
                    </span>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                     <Button className="w-full bg-white text-[#2d221c] rounded-xl font-serif text-lg">
                        View Technical Audit
                     </Button>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-2xl font-serif text-[#2d221c] leading-tight group-hover:text-amber-800 transition-colors uppercase tracking-tight">{quote.productName || 'Unnamed Unit'}</h4>
                      <p className="text-[10px] text-amber-900/40 font-black uppercase tracking-widest flex items-center gap-2">
                        <User className="w-3 h-3" /> {quote.customerName}
                      </p>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-bold text-[#2d221c] leading-none mb-1 tracking-tight">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                       <div className={`px-2 py-0.5 rounded text-[9px] font-black inline-block tracking-tighter shadow-sm ${
                          (quote.summary?.profitPercent || 0) < 22 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                       }`}>
                          {quote.summary?.profitPercent || 0}% MARGIN
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-amber-900/5">
                    <span className="text-[9px] text-amber-900/20 uppercase font-black tracking-widest flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> {new Date(quote.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex gap-2">
                       <button 
                         onClick={(e) => handleDuplicate(e, quote.id!)}
                         className="p-2.5 rounded-xl text-amber-900/20 hover:text-amber-700 hover:bg-amber-50 transition-all"
                         title="Duplicate Unit"
                       >
                          <Copy className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); window.open(`/quote/view/${quote.id}?download=true`, '_blank'); }}
                         className="p-2.5 rounded-xl text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all" 
                         title="Export PDF"
                       >
                          <Printer className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                key={quote.id} 
                onClick={() => window.location.href=`/quote/view/${quote.id}`}
                className="bg-white p-6 rounded-[2rem] border border-amber-900/5 shadow-wood flex items-center justify-between hover:bg-amber-50/30 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-8">
                   <div className="w-20 h-14 rounded-2xl bg-amber-50 overflow-hidden border border-amber-900/10 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                      {quote.productImage ? <img src={quote.productImage} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-amber-900/5" />}
                   </div>
                   <div>
                      <h4 className="text-xl font-serif text-[#2d221c] tracking-tight uppercase">{quote.productName || 'Unnamed Unit'}</h4>
                      <div className="flex items-center gap-4 mt-1.5">
                         <span className="text-[9px] font-black text-amber-900/40 uppercase tracking-widest flex items-center gap-1.5"><User className="w-3 h-3 opacity-50" /> {quote.customerName}</span>
                         <span className="w-1 h-1 rounded-full bg-amber-900/20"></span>
                         <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">{quote.productCategory}</span>
                         <span className={`text-[8px] font-black px-2.5 py-1 rounded-full border ${
                           quote.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                           quote.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                           'bg-amber-50 text-amber-700 border-amber-100'
                         }`}>
                           {quote.status || 'Draft'}
                         </span>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-12">
                   <div className="text-right">
                      <p className="text-xl font-bold text-[#2d221c] tracking-tighter">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                      <p className={`text-[9px] font-black tracking-widest uppercase ${
                         (quote.summary?.profitPercent || 0) < 22 ? 'text-rose-500' : 'text-emerald-600'
                      }`}>{quote.summary?.profitPercent || 0}% YIELD</p>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={(e) => handleDuplicate(e, quote.id!)} className="p-3 rounded-xl text-amber-900/20 hover:text-amber-700 hover:bg-white transition-all"><Copy className="w-5 h-5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); window.open(`/quote/view/${quote.id}?download=true`, '_blank'); }} className="p-3 rounded-xl text-amber-600 hover:text-amber-700 hover:bg-white transition-all"><Printer className="w-5 h-5"/></button>
                      <ChevronRight className="w-8 h-8 text-amber-900/10 group-hover:text-amber-600 group-hover:translate-x-2 transition-all duration-500" />
                   </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
