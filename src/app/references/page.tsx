"use client";

import React, { useState } from "react";
import { 
  Library, 
  Search, 
  Grid, 
  List as ListIcon, 
  Filter, 
  FileText, 
  Image as ImageIcon 
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ReferenceLibraryPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const mockCategories = ["Chairs", "Sofas", "Dining", "Office", "Beds"];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2d221c]">Reference Library</h1>
          <p className="text-gray-500 mt-1">Stored product drawings, photos, and past quotes for reference</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <ImageIcon className="w-4 h-4 mr-2" />
            Upload Reference
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <ListIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {mockCategories.map(cat => (
            <span key={cat} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-amber-400 cursor-pointer transition-colors">
              {cat}
            </span>
          ))}
          <Button variant="ghost" size="sm" className="text-gray-400">
            <Filter className="w-4 h-4 mr-1" />
            More Filters
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="group cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all overflow-hidden p-0">
              <div className="aspect-square bg-gray-100 relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold rounded uppercase">
                  Technical
                </div>
              </div>
              <div className="p-3">
                <h4 className="font-semibold text-sm text-[#2d221c] truncate">Product Drawing {i}</h4>
                <p className="text-[10px] text-gray-500 mt-1 uppercase">Updated 2 days ago</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-amber-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Reference_Spec_Chairs_v{i}.pdf</h4>
                    <p className="text-xs text-gray-500 tracking-wide uppercase">PDF Document | 2.4 MB</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-amber-600">View</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
