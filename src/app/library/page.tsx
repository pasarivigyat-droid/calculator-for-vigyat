"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  Grid, 
  List as ListIcon, 
  Filter, 
  Package, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Clock,
  Tag as TagIcon,
  Image as ImageIcon
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProductLibraryItem } from "@/types";
import { getProductLibraryItems } from "@/lib/firebase/services";

export default function ProductLibraryPage() {
  const [items, setItems] = useState<ProductLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    async function load() {
      try {
        const data = await getProductLibraryItems();
        setItems(data);
      } catch (err) {
        console.error("Failed to load library items:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(item => item.category)));
    return ["All", ...cats.sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2d221c]">Product Library</h1>
          <p className="text-gray-500 mt-1">Manage reusable SKU templates and instant pricing snapshots.</p>
        </div>
        <Link href="/quote/new">
          <Button className="bg-[#2d221c] text-white rounded-2xl h-14 px-8 shadow-lg shadow-amber-900/10">
            <Plus className="w-5 h-5 mr-3" />
            Cost New Product
          </Button>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input 
            placeholder="Search by name, SKU, or tag..." 
            className="pl-12 h-12 rounded-2xl border-gray-100 bg-gray-50/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="h-8 w-px bg-gray-200 mx-2 hidden lg:block" />
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-[2.5rem]" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
            <Package className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-[#2d221c]">No products found</h3>
          <p className="text-gray-500 mt-2 max-w-xs mx-auto">Try adjusting your search or filters, or add your first product from the calculator.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <Link key={item.id} href={`/library/${item.id}`}>
              <Card className="group flex flex-col h-full border-none shadow-premium transition-all hover:-translate-y-2 hover:shadow-2xl rounded-[2.5rem] overflow-hidden p-0 bg-white">
                <div className="aspect-[4/3] relative bg-gray-100 overflow-hidden">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
                    {item.category}
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{item.sku}</p>
                    <h3 className="text-lg font-bold text-[#2d221c] leading-tight line-clamp-1">{item.name}</h3>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Internal Cost</p>
                      <p className="text-xl font-bold text-[#2d221c]">₹{Math.round(item.totalInternalCost).toLocaleString()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-amber-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Internal Cost</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Updated</th>
                <th className="px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/library/${item.id}`}
                >
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-[#2d221c] truncate max-w-[200px]">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 font-mono text-xs font-bold text-gray-500">{item.sku}</td>
                  <td className="px-8 py-4">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right font-bold text-[#2d221c]">₹{Math.round(item.totalInternalCost).toLocaleString()}</td>
                  <td className="px-8 py-4 text-right text-xs text-gray-400">
                    {item.updatedAt?.toDate ? item.updatedAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-8 py-4 text-right text-gray-300">
                    <ChevronRight className="w-5 h-5 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
