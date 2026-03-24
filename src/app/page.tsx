"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Clock, 
  User, 
  ChevronRight,
  Calculator as CalcIcon,
  DollarSign,
  AlertTriangle,
  LayoutGrid,
  Zap,
  Hammer,
  Activity,
  Trees,
  Layers,
  Wind,
  ShieldCheck,
  Package,
  Calendar,
  Tag,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Quotation } from "@/types";
import { getRecentQuotations } from "@/lib/firebase/services";

export default function DashboardPage() {
  const [recentQuotes, setRecentQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getRecentQuotations(10);
        setRecentQuotes(data);
      } catch (err: any) {
        console.error("[Dashboard] Load Error:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    if (recentQuotes.length === 0) return { count: 0, avgMargin: 0, totalValue: 0, lowMargin: 0 };
    
    const count = recentQuotes.length;
    const avgMargin = recentQuotes.reduce((sum, q) => sum + (q.summary?.profitPercent || 0), 0) / count;
    const totalValue = recentQuotes.reduce((sum, q) => sum + (q.summary?.grandTotal || 0), 0);
    const lowMargin = recentQuotes.filter(q => (q.summary?.profitPercent || 0) < 22).length;

    return { count, avgMargin, totalValue, lowMargin };
  }, [recentQuotes]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-grain fixed inset-0 opacity-[0.015] pointer-events-none"></div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 bg-[#2d221c] p-10 md:p-14 rounded-[3rem] shadow-2xl relative overflow-hidden text-white border-b-8 border-amber-600">
        <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-none">Workshop Intelligence</h1>
          <p className="text-amber-200/50 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-3">
            <Activity className="w-4 h-4" /> MONITORING CRAFTSMANSHIP & QUOTATION FLOW
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/quote/new">
            <Button className="h-16 px-10 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xl shadow-amber-900/40 border-t border-white/20 flex items-center gap-4 group transition-all hover:scale-[1.05] active:scale-[0.98] text-lg font-serif">
              <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              New Valuation
            </Button>
          </Link>
          <div className="flex gap-2">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-help" title="System Health: Optimal">
               <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Valuations', val: stats.count, sub: 'Synced Records', icon: <CalcIcon/>, color: 'border-amber-600', text: 'text-[#2d221c]' },
          { label: 'Average Profit', val: `${stats.avgMargin.toFixed(1)}%`, sub: 'Calculated Yield', icon: <TrendingUp/>, color: 'border-emerald-600', text: 'text-emerald-700' },
          { label: 'Pipeline Volume', val: `₹${(stats.totalValue / 1000).toFixed(1)}k`, sub: 'Projected Output', icon: <DollarSign/>, color: 'border-amber-900', text: 'text-[#2d221c]' },
          { label: 'Margin Alerts', val: stats.lowMargin, sub: stats.lowMargin > 0 ? 'Action Required' : 'Optimal Health', icon: <AlertTriangle/>, color: stats.lowMargin > 0 ? 'border-rose-500' : 'border-amber-200', text: stats.lowMargin > 0 ? 'text-rose-600' : 'text-amber-200' }
        ].map((s, i) => (
          <div key={i} className={`bg-white p-8 rounded-[2rem] shadow-wood border-l-4 ${s.color} relative overflow-hidden group hover:-translate-y-1 transition-all duration-500`}>
            <div className="absolute -right-4 -bottom-4 w-28 h-28 text-amber-900/[0.03] group-hover:scale-110 transition-transform duration-700">
               {s.icon}
            </div>
            <p className="text-amber-900/40 text-[9px] font-black uppercase tracking-[0.3em] mb-4">{s.label}</p>
            <h3 className={`text-5xl font-serif ${s.text} leading-none mb-2 tracking-tight`}>{s.val}</h3>
            <p className="text-amber-900/20 text-[10px] font-bold uppercase tracking-widest">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Feed: Recent Activity */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <Clock className="w-5 h-5" />
               </div>
               <h2 className="text-3xl font-serif text-[#2d221c]">Recent Valuations</h2>
            </div>
            <Link href="/quotes" className="text-amber-700 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-2">
               Archive Library <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="bg-white rounded-[2.5rem] shadow-wood overflow-hidden border border-amber-900/5 relative">
            <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-amber-50/10 border-b border-amber-900/5 uppercase">
                     <th className="px-10 py-6 text-[9px] font-black text-amber-900/30 tracking-[0.3em]">Component Details</th>
                     <th className="px-10 py-6 text-[9px] font-black text-amber-900/30 tracking-[0.3em]">Client Entity</th>
                     <th className="px-10 py-6 text-right text-[9px] font-black text-amber-900/30 tracking-[0.3em]">Net Investment</th>
                     <th className="px-10 py-6 text-center text-[9px] font-black text-amber-900/30 tracking-[0.3em]">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/5">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <tr key={i} className="h-28 animate-pulse bg-amber-50/5" />)
                  ) : recentQuotes.length === 0 ? (
                    <tr><td colSpan={4} className="p-24 text-center"><p className="font-serif text-3xl text-amber-900/10 italic">Intelligence feed empty.</p></td></tr>
                  ) : (
                    recentQuotes.map((quote: Quotation) => (
                      <tr key={quote.id} className="hover:bg-amber-50/30 transition-all duration-300 group cursor-pointer" onClick={() => window.location.href=`/quote/view/${quote.id}`}>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex-shrink-0 overflow-hidden border border-amber-900/10 shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                              {quote.productImage ? (
                                 <img src={quote.productImage} alt="Project" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-amber-900/10" /></div>
                              )}
                            </div>
                            <div>
                               <p className="font-serif text-2xl text-[#2d221c] leading-tight group-hover:text-amber-800 transition-colors tracking-tight uppercase">{quote.productName}</p>
                               <span className="text-[9px] font-black text-amber-900/40 uppercase tracking-widest mt-1 block">{quote.productCategory}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <p className="text-sm font-bold text-gray-700">{quote.customerName}</p>
                          <span className="text-[8px] font-black text-white bg-[#2d221c] px-2 py-0.5 rounded tracking-[0.2em] uppercase mt-2 inline-block shadow-lg shadow-black/10">{quote.customerType}</span>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <p className="font-serif text-3xl text-[#2d221c] leading-none mb-1 tracking-tight">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                          <p className="text-[9px] text-amber-900/30 font-black uppercase tracking-widest">Base Valuation</p>
                        </td>
                        <td className="px-10 py-8 text-center">
                           <div className={`w-14 h-14 mx-auto rounded-2xl flex flex-col items-center justify-center transition-all shadow-inner ${
                             (quote.summary?.profitPercent || 0) < 22 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                           }`}>
                              <span className="text-xl font-serif leading-none">{quote.summary?.profitPercent || 0}%</span>
                              <span className="text-[7px] font-black uppercase tracking-tighter opacity-60">Yield</span>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: Executive Shortcuts */}
        <div className="lg:col-span-4 space-y-10">
          <div className="space-y-6">
             <h2 className="text-2xl font-serif text-[#2d221c] pl-4">Digital Assets</h2>
             <div className="grid grid-cols-1 gap-5">
                {[
                  { title: 'Material Library', sub: 'Master Pricing Index', icon: <LayoutGrid/>, link: '/masters', theme: 'dark' },
                  { title: 'Valuation Archive', sub: 'Historical Audit Logs', icon: <Clock/>, link: '/quotes', theme: 'light' }
                ].map((item, i) => (
                  <Link key={i} href={item.link}>
                     <div className={`p-8 rounded-[2.5rem] transition-all group relative overflow-hidden shadow-2xl ${
                        item.theme === 'dark' ? 'bg-[#2d221c] text-white hover:bg-black' : 'bg-white text-[#2d221c] border border-amber-900/5 hover:border-amber-500/30'
                     }`}>
                        <div className="bg-grain absolute inset-0 opacity-10 pointer-events-none"></div>
                        <div className="relative z-10">
                           <div className="flex items-center justify-between mb-8">
                             <div className={`p-3 rounded-2xl ${item.theme === 'dark' ? 'bg-white/5' : 'bg-amber-50'} transition-colors`}>
                                {React.cloneElement(item.icon as React.ReactElement, { className: "w-6 h-6 text-amber-500" })}
                             </div>
                             <ChevronRight className="w-5 h-5 opacity-20 group-hover:translate-x-2 transition-all duration-500" />
                           </div>
                           <h4 className="font-serif text-2xl tracking-tight">{item.title}</h4>
                           <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${item.theme === 'dark' ? 'text-white/30' : 'text-amber-900/30'}`}>
                              {item.sub}
                           </p>
                        </div>
                     </div>
                  </Link>
                ))}
             </div>
          </div>

          {/* Efficiency Index */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-amber-900/5 shadow-wood relative overflow-hidden group">
             <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
             <h3 className="font-serif text-2xl text-[#2d221c] mb-8">Material Exposure</h3>
             <div className="space-y-8">
                {[
                  { label: 'Solid Wood Intensity', val: 74, color: 'bg-amber-600', icon: <Trees className="w-3.5 h-3.5"/> },
                  { label: 'Engineering Board Yield', val: 56, color: 'bg-blue-600', icon: <Layers className="w-3.5 h-3.5"/> },
                  { label: 'Upholstery Padding', val: 38, color: 'bg-orange-500', icon: <Wind className="w-3.5 h-3.5"/> }
                ].map((item, i) => (
                  <div key={i} className="space-y-3">
                     <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-amber-900/40">
                        <span className="flex items-center gap-2">{item.icon} {item.label}</span>
                        <span>{item.val}%</span>
                     </div>
                     <div className="h-2 w-full bg-amber-900/5 rounded-full overflow-hidden p-0.5">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-[1500ms] group-hover:opacity-80`} style={{ width: `${item.val}%` }}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
