"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  User, 
  ChevronRight,
  Calculator as CalcIcon,
  DollarSign,
  AlertTriangle,
  FileText
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
      } catch (err) {
        console.error(err);
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
    const lowMargin = recentQuotes.filter(q => (q.summary?.profitPercent || 0) < 20).length;

    return { count, avgMargin, totalValue, lowMargin };
  }, [recentQuotes]);

  return (
    <div className="space-y-8 pb-10">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
             type="text" 
             placeholder="Search by product or customer..." 
             className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
          />
        </div>
        <Link href="/quote/new">
          <Button className="h-12 px-8 rounded-2xl shadow-lg shadow-amber-900/10">
            <Plus className="w-5 h-5 mr-2" />
            Create Quotation
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Total Quotes</p>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold">{stats.count}</h3>
            <CalcIcon className="w-8 h-8 opacity-20" />
          </div>
        </Card>
        
        <Card className="border-none shadow-sm bg-green-600 text-white">
          <p className="text-green-100 text-xs font-bold uppercase tracking-widest mb-1">Avg Margin</p>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold">{stats.avgMargin.toFixed(1)}%</h3>
            <TrendingUp className="w-8 h-8 opacity-20" />
          </div>
        </Card>
        
        <Card className="border-none shadow-sm bg-white border border-gray-100">
           <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Quoted Value</p>
           <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-[#2d221c]">₹{(stats.totalValue / 1000).toFixed(1)}K</h3>
            <DollarSign className="w-8 h-8 text-amber-500 opacity-20" />
          </div>
        </Card>

        <Card className={`border-none shadow-sm ${stats.lowMargin > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
           <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Low Margin Alerts</p>
           <div className="flex items-end justify-between">
             <h3 className={`text-4xl font-bold ${stats.lowMargin > 0 ? 'text-red-600' : 'text-gray-300'}`}>{stats.lowMargin}</h3>
             <AlertTriangle className={`w-8 h-8 ${stats.lowMargin > 0 ? 'text-red-500 animate-pulse' : 'text-gray-100'}`} />
           </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-0" title="Recent Activity" subtitle="Latest 10 valuations across the workshop">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 italic">
                   <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                   <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pricing</th>
                   <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Margin</th>
                   <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i} className="h-16 animate-pulse bg-gray-50/20" />)
                ) : recentQuotes.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">No quotes created yet.</td></tr>
                ) : (
                  recentQuotes.map((quote: Quotation) => (
                    <tr key={quote.id} className="hover:bg-amber-50/30 transition-colors group text-sm">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#2d221c] group-hover:text-amber-700 transition-colors uppercase tracking-tight">{quote.productName}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{quote.productCategory}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-700">{quote.customerName}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight">{quote.customerType}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900 leading-none">
                        ₹{(quote.summary?.grandTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className={`inline-flex items-center justify-center gap-1 font-bold rounded-lg py-1 px-2 text-xs ${(quote.summary?.profitPercent || 0) < 20 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                            {quote.summary?.profitPercent || 0}%
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <Link href={`/quote/edit/${quote.id}`}>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-600 transition-all" />
                         </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
             {loading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-4 h-24 animate-pulse bg-gray-50/50" />)
             ) : recentQuotes.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No quotes found.</div>
             ) : (
                recentQuotes.map(quote => (
                  <Link key={quote.id} href={`/quote/edit/${quote.id}`} className="block p-4 active:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-black text-gray-900 uppercase text-xs tracking-tight">{quote.productName || 'Unnamed'}</h4>
                        <p className="text-[10px] text-gray-400 font-medium">{quote.customerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-700">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                        <p className={`text-[9px] font-bold ${(quote.summary?.profitPercent || 0) < 20 ? 'text-red-500' : 'text-green-500'}`}>{quote.summary?.profitPercent || 0}% Margin</p>
                      </div>
                    </div>
                  </Link>
                ))
             )}
          </div>
        </Card>

        <div className="space-y-6">
           <Card title="Shortcuts" className="bg-[#2d221c] border-none text-white overflow-hidden relative">
              <CalcIcon className="absolute -right-10 -bottom-10 w-40 h-40 text-white/5" />
              <div className="space-y-3 relative z-10">
                 <Link href="/masters">
                    <Button variant="ghost" className="w-full justify-between text-white border-white/10 hover:bg-white/5">
                        Update Wood Rates
                        <ChevronRight className="w-4 h-4 opacity-40" />
                    </Button>
                 </Link>
                 <Link href="/quotes">
                    <Button variant="ghost" className="w-full justify-between text-white border-white/10 hover:bg-white/5">
                        Search Old Quotes
                        <ChevronRight className="w-4 h-4 opacity-40" />
                    </Button>
                 </Link>
                 <Link href="/references">
                    <Button variant="ghost" className="w-full justify-between text-white border-white/10 hover:bg-white/5">
                        Technical Drawings
                        <ChevronRight className="w-4 h-4 opacity-40" />
                    </Button>
                 </Link>
              </div>
           </Card>

           <Card title="Quick Action" subtitle="Generate a fast rough estimate">
              <p className="text-xs text-gray-500 mb-4 italic">Rough estimate does not store a permanent record.</p>
              <Button variant="outline" className="w-full border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100">
                 <CalcIcon className="w-4 h-4 mr-2" />
                 Launch Estimator
              </Button>
           </Card>

            <Card className="bg-amber-50/50 border-amber-100" title="Valuation Insights" subtitle="Material distribution & trends">
              <div className="space-y-4">
                 {[
                   { label: 'Woodwork Focus', val: recentQuotes.filter(q => q.productCategory.toLowerCase().includes('chair')).length / (recentQuotes.length || 1) * 100 },
                   { label: 'Upholstery Depth', val: recentQuotes.filter(q => (q.fabricBreakdown?.length || 0) > 0).length / (recentQuotes.length || 1) * 100 },
                   { label: 'Architect Project Mix', val: recentQuotes.filter(q => q.customerType === 'Architect').length / (recentQuotes.length || 1) * 100 }
                 ].map((item, i) => (
                   <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-amber-800">
                         <span>{item.label}</span>
                         <span>{item.val.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
                         <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.val}%` }}></div>
                      </div>
                   </div>
                 ))}
              </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
