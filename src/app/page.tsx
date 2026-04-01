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
  ChevronUp,
  BookOpen
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
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4 md:px-8">
      {/* Rationalized Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-wood-walnut p-8 md:p-10 rounded-3xl shadow-lg relative overflow-hidden text-white">
        <div className="relative z-10 space-y-1">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Workshop Intelligence</h1>
          <p className="text-amber-500/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Costing & Pricing Engine
          </p>
        </div>
        
        <div className="relative z-10 flex items-center gap-4">
          <Link href="/library">
            <Button className="h-14 px-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-3 transition-fast text-base font-bold border border-white/20">
              <BookOpen className="w-5 h-5" />
              Price from Library
            </Button>
          </Link>
          <Link href="/quote/new">
            <Button className="h-14 px-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-3 transition-fast text-base font-bold">
              <Plus className="w-5 h-5" />
              New Product Costing
            </Button>
          </Link>
        </div>
      </div>

      {/* High-Performance Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Quotes', val: stats.count, sub: 'Synced', icon: <CalcIcon/>, color: 'text-stone-900' },
          { label: 'Avg Margin', val: `${stats.avgMargin.toFixed(1)}%`, sub: 'Calculated', icon: <TrendingUp/>, color: 'text-emerald-600' },
          { label: 'Pipeline', val: `₹${(stats.totalValue / 1000).toFixed(1)}k`, sub: 'Projected', icon: <DollarSign/>, color: 'text-stone-900' },
          { label: 'Alerts', val: stats.lowMargin, sub: 'Required', icon: <AlertTriangle/>, color: stats.lowMargin > 0 ? 'text-rose-600' : 'text-stone-400' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm transition-fast hover:border-amber-200">
            <p className="text-stone-400 text-[9px] font-bold uppercase tracking-widest mb-1">{s.label}</p>
            <h3 className={`text-3xl font-bold ${s.color} tracking-tight`}>{s.val}</h3>
            <p className="text-stone-300 text-[9px] uppercase mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-stone-900">Recent Valuations</h2>
            <Link href="/quotes" className="text-orange-600 text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center gap-1">
               View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                     <th className="px-6 py-4 text-[9px] font-bold text-stone-400 uppercase tracking-widest">Component</th>
                     <th className="px-6 py-4 text-[9px] font-bold text-stone-400 uppercase tracking-widest">Client</th>
                     <th className="px-6 py-4 text-right text-[9px] font-bold text-stone-400 uppercase tracking-widest">Amount</th>
                     <th className="px-6 py-4 text-center text-[9px] font-bold text-stone-400 uppercase tracking-widest">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <tr key={i} className="h-20 animate-pulse bg-stone-50/50" />)
                  ) : (
                    recentQuotes.map((quote: Quotation) => (
                      <tr key={quote.id} className="hover:bg-amber-50/50 transition-fast cursor-pointer" onClick={() => window.location.href=`/quote/view/${quote.id}`}>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                                <Package className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="font-bold text-stone-900 text-sm uppercase">{quote.productName}</p>
                                <span className="text-[9px] text-stone-400 font-bold uppercase">{quote.productCategory}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <span className="text-[10px] font-bold text-white bg-stone-800 px-2.5 py-1 rounded-lg uppercase tracking-wider">{quote.customerType}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-serif text-lg">
                          ₹{Math.round(quote.summary?.grandTotal || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-5 text-center">
                           <div className={`text-xs font-black ${(quote.summary?.profitPercent || 0) < 22 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {quote.summary?.profitPercent || 0}%
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-stone-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-6 h-32 animate-pulse bg-stone-50/50" />)
              ) : (
                recentQuotes.map((quote: Quotation) => (
                  <div key={quote.id} className="p-6 active:bg-amber-50 transition-colors" onClick={() => window.location.href=`/quote/view/${quote.id}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-amber-500 shadow-lg">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900 text-base uppercase leading-tight">{quote.productName}</h4>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{quote.productCategory}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-serif text-stone-900 tracking-tight">₹{Math.round(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${ (quote.summary?.profitPercent || 0) < 22 ? 'text-rose-600' : 'text-emerald-600' }`}>
                          {quote.summary?.profitPercent || 0}% Yield
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md uppercase tracking-wider border border-amber-900/5">{quote.customerType}</span>
                       <span className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-1 ml-auto">
                         Managed <ChevronRight className="w-3 h-3"/>
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="lg:col-span-4 space-y-6">
           <div className="grid grid-cols-1 gap-4">
              {[
                { title: 'New Product Costing', desc: 'Module A', icon: LayoutGrid, link: '/quote/new', accent: 'bg-amber-50 text-amber-600' },
                { title: 'Library & Pricing', desc: 'Module B', icon: BookOpen, link: '/library', accent: 'bg-orange-50 text-orange-600' },
                { title: 'Material Masters', desc: 'Rate Database', icon: LayoutGrid, link: '/masters', accent: 'bg-stone-100 text-stone-500' },
                { title: 'Quotation Archive', desc: 'Saved Quotes', icon: Clock, link: '/quotes', accent: 'bg-stone-100 text-stone-500' }
              ].map((item, i) => (
                <Link key={i} href={item.link}>
                   <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm hover:border-orange-500 transition-fast flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${item.accent} group-hover:scale-105 transition-transform`}>
                           <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm">{item.title}</h4>
                          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{item.desc}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-300" />
                   </div>
                </Link>
              ))}
           </div>

           <div className="bg-stone-900 rounded-2xl p-8 text-white space-y-6">
              <h3 className="text-xl font-bold">Material Indices</h3>
              <div className="space-y-6">
                 {[
                   { label: 'Wood Intensity', val: 74, color: 'bg-orange-500' },
                   { label: 'Engineering Board', val: 56, color: 'bg-blue-500' }
                 ].map((item, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-stone-400">
                         <span>{item.label}</span>
                         <span>{item.val}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                         <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.val}%` }}></div>
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
