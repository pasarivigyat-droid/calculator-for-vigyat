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
  Download
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
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const handleDuplicate = async (id: string) => {
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
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2d221c]">Quotation Library</h1>
          <p className="text-gray-500 mt-1">Stored product drawings and past quotations</p>
        </div>
        <Link href="/quote/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Quotation
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 max-w-lg w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by product, customer or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Card key={i} className="h-64 animate-pulse bg-gray-50 border-none" />)}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card className="py-20 text-center space-y-4">
            <Search className="w-12 h-12 mx-auto text-gray-200" />
            <p className="text-gray-500 italic">No quotations found matching your search.</p>
        </Card>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredQuotes.map((quote) => (
            viewMode === 'grid' ? (
              <Card key={quote.id} className="p-0 overflow-hidden group hover:ring-2 hover:ring-amber-500 transition-all">
                <div className="bg-gray-100 aspect-[4/3] relative">
                  {quote.productImage ? (
                    <img src={quote.productImage} alt={quote.productName || 'Product'} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Database className="w-12 h-12 text-gray-200" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded w-fit">
                      {quote.productCategory}
                    </div>
                    <div className={`text-[10px] font-black px-2 py-1 rounded w-fit shadow-lg ${
                      quote.status === 'Approved' ? 'bg-green-500 text-white' :
                      quote.status === 'Rejected' ? 'bg-red-500 text-white' :
                      quote.status === 'Sent' ? 'bg-blue-500 text-white' :
                      quote.status === 'Closed' ? 'bg-gray-500 text-white' :
                      'bg-amber-500 text-white'
                    }`}>
                      {quote.status || 'Draft'}
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900 group-hover:text-amber-700 transition-colors uppercase tracking-tight">{quote.productName || 'Unnamed Product'}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" /> {quote.customerName}
                      </p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-gray-900 leading-none">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                       <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1 rounded mt-1 inline-block">{quote.summary?.profitPercent || 0}% Margin</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400 uppercase font-mono">{new Date(quote.date).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                       <Button variant="ghost" size="icon" onClick={() => handleDuplicate(quote.id!)}>
                          <Copy className="w-4 h-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => window.open(`/quote/view/${quote.id}?download=true`, '_blank')} title="Download PDF Report">
                          <Printer className="w-4 h-4 text-amber-600" />
                       </Button>
                       <Link href={`/quote/edit/${quote.id}`}>
                          <Button variant="ghost" size="icon" title="Edit Quotation">
                             <ExternalLink className="w-4 h-4" />
                          </Button>
                       </Link>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card key={quote.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                      {quote.productImage ? <img src={quote.productImage} className="w-full h-full object-cover" /> : <Database className="w-4 h-4 text-gray-300" />}
                   </div>
                   <div>
                      <h4 className="font-bold text-gray-900">{quote.productName || 'Unnamed Product'}</h4>
                      <div className="flex items-center gap-3 mt-1">
                         <span className="text-xs text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> {quote.customerName}</span>
                         <span className="text-gray-300">•</span>
                         <span className="text-xs text-gray-500">{quote.productCategory}</span>
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                           quote.status === 'Approved' ? 'bg-green-100 text-green-700' :
                           quote.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                           quote.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                           quote.status === 'Closed' ? 'bg-gray-100 text-gray-700' :
                           'bg-amber-100 text-amber-700'
                         }`}>
                           {quote.status || 'Draft'}
                         </span>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-10">
                   <div className="text-right">
                      <p className="font-mono font-bold">₹{(quote.summary?.grandTotal || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-green-600 font-bold tracking-widest">{quote.summary?.profitPercent || 0}% PROFIT</p>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => handleDuplicate(quote.id!)}>
                      <Copy className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" onClick={() => window.open(`/quote/view/${quote.id}?download=true`, '_blank')} title="Download PDF Report">
                      <Printer className="w-4 h-4 text-amber-600" />
                   </Button>
                   <Link href={`/quote/edit/${quote.id}`}>
                      <ChevronRight className="w-6 h-6 text-gray-300 hover:text-amber-600 transition-colors" />
                   </Link>
                </div>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );
}
