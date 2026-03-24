"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Search, Edit2, Upload, Download, Database, Save, 
  CheckCircle, AlertTriangle, ArrowUpDown, ArrowDown, ArrowUp, Filter,
  Trees, Layers, Wind, ShieldCheck, Activity, Trash2, Hammer, TrendingUp, ChevronRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { WoodMaster, PlyMaster, FoamMaster, FabricMaster, CustomerMarkupSetting } from "@/types";
import { 
  getWoodMasters, getPlyMasters, getFoamMasters, getFabricMasters,
  saveWoodMaster, savePlyMaster, saveFoamMaster, saveFabricMaster,
  getMarkupSettings, saveMarkupSetting, bulkImportMasters
} from "@/lib/firebase/services";
import { 
  parseCSV, generateCSV, downloadCSV, validateMasterRow, getDuplicateKey, 
  ValidationError, EXPORT_HEADERS, INTERNAL_EXPORT_HEADERS, normalizePlyCategory,
  parseWoodMatrix, parsePlywoodReport, parseFoamReport
} from "@/lib/utils/csv_handler";

type MasterCategory = 'wood' | 'ply' | 'foam' | 'fabric' | 'markups';
type SortField = 'effective_date' | 'type' | 'rate';
type SortDir = 'asc' | 'desc';

// CSV TEMPLATES
const TEMPLATES: Record<string, string> = {
  wood: "wood_type,length_from_ft,length_to_ft,width_in,thickness_in,rate_per_gf\nSagawood,1.5,2.25,1.5,1,851",
  ply:  "ply_category,thickness_mm,rate_per_sqft\nplywood,18,50.07\nplywood,12,37.98",
  foam: "foam_type,specification,base_rate\nPU,Standard,1200",
  fabric: "fabric_type,brand,base_rate_per_meter\nVelvet,DDecor,1200\nLeather,Genuine,4500"
};

const NUMERIC_FIELDS: Record<string, string[]> = {
  wood: ['length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'rate_per_gf'],
  ply:  ['thickness_mm', 'rate_per_sqft'],
  foam: ['base_rate'],
  fabric: ['base_rate_per_meter']
};

function computeVerificationStats(data: any[], tab: MasterCategory) {
  const active = tab === 'ply' || tab === 'foam' || tab === 'fabric' ? data.filter(d => d.is_active).length : data.length;
  const inactive = tab === 'ply' || tab === 'foam' || tab === 'fabric' ? data.filter(d => !d.is_active).length : 0;
  const dates = data.map(d => d.effective_date).filter(Boolean).sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : '—';
  const earliestDate = dates.length > 0 ? dates[0] : '—';

  let numericIssues = 0;
  if (tab === 'wood') data.forEach(d => { if (typeof d.rate_per_gf !== 'number') numericIssues++; });
  else if (tab === 'ply') data.forEach(d => { if (typeof d.rate_per_sqft !== 'number') numericIssues++; });
  else if (tab === 'foam') data.forEach(d => { if (typeof d.base_rate !== 'number') numericIssues++; });

  return { total: data.length, active, inactive, latestDate, earliestDate, numericIssues };
}

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState<MasterCategory>('wood');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('type');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [useSpecialParser, setUseSpecialParser] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; mode: string } | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importStage, setImportStage] = useState<string>('idle');

  const [globalImportDate, setGlobalImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalImportActive, setGlobalImportActive] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'wood') setData(await getWoodMasters(true));
      else if (activeTab === 'ply') setData(await getPlyMasters(true));
      else if (activeTab === 'foam') setData(await getFoamMasters());
      else if (activeTab === 'fabric') setData(await getFabricMasters());
      else if (activeTab === 'markups') setData(await getMarkupSettings());
    } catch (err: any) {
      console.error("[LoadData] Error:", err);
    }
    setLoading(false);
  }

  const handleExport = (mode: 'simple' | 'internal' = 'simple') => {
    if (data.length === 0) return alert("No data to export");
    const headers = mode === 'internal' 
      ? (INTERNAL_EXPORT_HEADERS[activeTab as keyof typeof INTERNAL_EXPORT_HEADERS] || EXPORT_HEADERS[activeTab])
      : EXPORT_HEADERS[activeTab];
      
    if (!headers) return alert("Export not available for this tab");
    const csv = generateCSV(headers, data);
    downloadCSV(`${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportStage('parsing/validating');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      let parsedData: any[] = [];
      
      if (useSpecialParser) {
        if (activeTab === 'wood') parsedData = parseWoodMatrix(text);
        else if (activeTab === 'ply') parsedData = parsePlywoodReport(text);
        else if (activeTab === 'foam') parsedData = parseFoamReport(text);
      } else {
        const rows = parseCSV(text);
        if (rows.length < 2) return alert("Invalid CSV file — missing headers or data.");
        
        const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        const rawData = rows.slice(1);
        const numFields = NUMERIC_FIELDS[activeTab] || [];

        rawData.forEach((row, idx) => {
          if (!row || row.length === 0 || row.every(c => !c.trim())) return; 
          const item: any = {};
          headers.forEach((h, i) => {
            let val: any = (row[i] || "").trim();
            if (numFields.includes(h)) val = Number(val);
            else if (h === 'is_active') val = val.toLowerCase() === 'true' || val === '1';
            if (activeTab === 'ply' && h === 'ply_category') val = normalizePlyCategory(val);
            item[h] = val;
          });
          parsedData.push(item);
        });
      }

      if (parsedData.length === 0) return alert("No valid data found in this CSV.");

      const errors: ValidationError[] = [];
      const seenKeys = new Set<string>();
      let duplicateCount = 0;
      let validCount = 0;

      parsedData.forEach((item, idx) => {
        const rowErrors = validateMasterRow(activeTab as any, item, idx);
        const key = getDuplicateKey(activeTab as any, item);
        if (key && seenKeys.has(key)) {
          duplicateCount++;
          rowErrors.push({ row: idx + 1, column: 'DUPLICATE', message: 'Duplicate row within this file' });
        } else if (key) seenKeys.add(key);

        if (rowErrors.length > 0) errors.push(...rowErrors);
        else validCount++;
      });

      setImportData(parsedData);
      setImportErrors(errors);
      setImportStats({ total: parsedData.length, valid: validCount, invalid: parsedData.length - validCount, duplicates: duplicateCount });
      setImportStage('ready');
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    setIsImporting(true);
    setImportStage('preparing');
    try {
      const collectionNameMap: Record<string, "woodMasters" | "plyMasters" | "foamMasters" | "fabricMasters"> = {
        wood: 'woodMasters', ply: 'plyMasters', foam: 'foamMasters', fabric: 'fabricMasters'
      };
      const collectionName = collectionNameMap[activeTab] as any;
      const invalidRowIndices = new Set(importErrors.map(e => e.row - 1));
      let validRows = importData.filter((_, idx) => !invalidRowIndices.has(idx));
      
      if (activeTab === 'ply' || activeTab === 'foam' || activeTab === 'fabric') {
        validRows = validRows.map(row => ({
          ...row,
          effective_date: row.effective_date || globalImportDate,
          is_active: row.is_active !== undefined ? row.is_active : globalImportActive
        }));
      }

      const count = await bulkImportMasters(collectionName, validRows, importMode, (stage, done, total) => {
        setImportStage(stage === 'writing' ? `Writing Chunks...` : stage);
        setImportProgress({ done, total });
      });
      
      setImportStage('finished');
      setImportResult({ success: true, count: count || validRows.length, mode: importMode });
      setTimeout(() => loadData(), 500);
    } catch (err: any) {
      alert("Import Error: " + err.message);
      setImportStage('error');
    }
    setIsImporting(false);
  };

  const handleToggleActive = async (item: any) => {
    if (activeTab === 'wood' || activeTab === 'markups') return;
    const updated = { ...item, is_active: !item.is_active };
    if (activeTab === 'ply') await savePlyMaster(updated);
    else if (activeTab === 'foam') await saveFoamMaster(updated);
    else if (activeTab === 'fabric') await saveFabricMaster(updated);
    loadData();
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const item: any = Object.fromEntries(formData.entries());
    
    ['rate_per_gf', 'rate_per_sqft', 'base_rate', 'base_rate_per_meter', 'length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'thickness_mm', 'default_markup_percent'].forEach(f => {
       if (item[f] !== undefined && item[f] !== '') item[f] = Number(item[f]);
    });

    try {
      if (activeTab === 'wood') await saveWoodMaster({ ...editingItem, ...item });
      else if (activeTab === 'ply') await savePlyMaster({ ...editingItem, ...item });
      else if (activeTab === 'foam') await saveFoamMaster({ ...editingItem, ...item });
      else if (activeTab === 'fabric') await saveFabricMaster({ ...editingItem, ...item });
      else if (activeTab === 'markups') await saveMarkupSetting({ ...editingItem, ...item });
      
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Save Failed: ${err.message}`);
    }
  };

  const processedData = useMemo(() => {
    let result = [...data];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => JSON.stringify(item).toLowerCase().includes(q));
    }
    if (activeTab !== 'markups') {
      result.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortField === 'effective_date') { aVal = a.effective_date || ''; bVal = b.effective_date || ''; }
        else if (sortField === 'type') { 
          aVal = a.wood_type || a.ply_category || a.foam_type || a.fabric_type || ''; 
          bVal = b.wood_type || b.ply_category || b.foam_type || b.fabric_type || ''; 
        }
        else if (sortField === 'rate') { 
          aVal = a.rate_per_gf || a.rate_per_sqft || a.base_rate || a.base_rate_per_meter || 0; 
          bVal = b.rate_per_gf || b.rate_per_sqft || b.base_rate || b.base_rate_per_meter || 0; 
        }
        const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, searchQuery, sortField, sortDir, activeTab]);

  const vStats = useMemo(() => activeTab === 'markups' ? null : computeVerificationStats(data, activeTab), [data, activeTab]);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-grain fixed inset-0 opacity-[0.015] pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-amber-900/10 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-amber-900/40 translate-y-1">
             <div className="w-8 h-px bg-amber-900/20"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Master Pricing Index</p>
          </div>
          <h1 className="text-5xl font-serif text-[#2d221c] tracking-tight">Configuration Hub</h1>
          <div className="flex flex-wrap gap-4 text-[10px] text-amber-900/40 font-black uppercase tracking-widest mt-2">
             <span className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Singular Source of Truth</span>
             <span className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Real-time Calculation Sync</span>
          </div>
        </div>
        
        <div className="flex gap-3">
           <Button variant="outline" className="h-14 px-8 rounded-2xl border-amber-900/10 bg-white hover:bg-amber-50 text-amber-800 font-serif text-lg shadow-wood" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="w-5 h-5 mr-3 opacity-50" /> Bulk Import
           </Button>
           <Button className="h-14 px-8 rounded-2xl bg-[#2d221c] hover:bg-black text-white shadow-xl shadow-amber-900/10 border-t border-white/5 font-serif text-lg" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
              <Plus className="w-5 h-5 mr-3" /> New Record
           </Button>
        </div>
      </div>

      {/* Tab Select & Verification Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-2 rounded-[2rem] border border-amber-900/5 shadow-wood space-y-2">
              {(['wood', 'ply', 'foam', 'fabric', 'markups'] as MasterCategory[]).map(tab => (
                 <button 
                   key={tab} 
                   onClick={() => setActiveTab(tab)}
                   className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all font-serif text-xl ${
                     activeTab === tab ? 'bg-[#2d221c] text-white shadow-xl translate-x-2' : 'text-[#2d221c]/40 hover:bg-amber-50 hover:text-amber-900'
                   }`}
                 >
                    <span className="flex items-center gap-4">
                       {tab === 'wood' && <Trees className="w-5 h-5 opacity-40"/>}
                       {tab === 'ply' && <Layers className="w-5 h-5 opacity-40"/>}
                       {tab === 'foam' && <Wind className="w-5 h-5 opacity-40"/>}
                       {tab === 'fabric' && <Activity className="w-5 h-5 opacity-40"/>}
                       {tab === 'markups' && <TrendingUp className="w-5 h-5 opacity-40"/>}
                       {tab === 'ply' ? 'Plywood' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-500 ${activeTab === tab ? 'rotate-90 opacity-100' : 'opacity-0'}`} />
                 </button>
              ))}
           </div>

           {vStats && (
              <div className="bg-amber-900/[0.02] p-8 rounded-[2rem] border border-amber-900/5 space-y-8">
                 <h4 className="text-[10px] font-black text-amber-900/30 uppercase tracking-[0.4em]">Audit Status</h4>
                 <div className="grid grid-cols-1 gap-6">
                    <div>
                       <p className="text-[9px] font-bold text-amber-900/20 uppercase tracking-widest mb-1">Index Volume</p>
                       <p className="text-4xl font-serif text-[#2d221c]">{vStats.total} Rows</p>
                    </div>
                    {vStats.active !== vStats.total && (
                       <div>
                          <p className="text-[9px] font-bold text-amber-900/20 uppercase tracking-widest mb-1">Active Readiness</p>
                          <p className="text-2xl font-serif text-emerald-600">{vStats.active} Active</p>
                       </div>
                    )}
                    <div>
                       <p className="text-[9px] font-bold text-amber-900/20 uppercase tracking-widest mb-1">Latest Revision</p>
                       <p className="text-xl font-serif text-[#2d221c] font-mono">{vStats.latestDate}</p>
                    </div>
                    {vStats.numericIssues > 0 && (
                       <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-rose-500" />
                          <p className="text-[10px] font-black text-rose-600 uppercase">⚠ {vStats.numericIssues} Integrity Flag(s)</p>
                       </div>
                    )}
                 </div>
                 <Button variant="outline" className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-amber-900/10 text-amber-800" onClick={() => handleExport('simple')}>
                    <Download className="w-4 h-4 mr-2" /> Download Registry
                 </Button>
              </div>
           )}
        </div>

        {/* List & Search */}
        <div className="lg:col-span-9 space-y-8">
           <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-900/20 group-focus-within:text-amber-600 transition-colors w-6 h-6" />
              <input 
                type="text" 
                placeholder={`Search the ${activeTab} registry...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-16 pr-8 py-6 bg-white border border-amber-900/5 rounded-3xl shadow-wood focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all text-xl font-serif placeholder:text-amber-900/10"
              />
           </div>

           <div className="bg-white rounded-[2.5rem] border border-amber-900/5 shadow-wood overflow-hidden relative">
              <div className="bg-grain absolute inset-0 opacity-[0.02] pointer-events-none"></div>
              <div className="relative overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-amber-50/10 border-b border-amber-900/5">
                          <th className="px-10 py-6 text-[9px] font-black text-amber-900/30 uppercase tracking-[0.3em]">Material Classification</th>
                          <th className="px-10 py-6 text-[9px] font-black text-amber-900/30 uppercase tracking-[0.3em] text-right">Yield Valuation</th>
                          {(activeTab === 'ply' || activeTab === 'foam' || activeTab === 'fabric') && (
                             <th className="px-10 py-6 text-center text-[9px] font-black text-amber-900/30 uppercase tracking-[0.3em]">Status Audit</th>
                          )}
                          <th className="px-10 py-6"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-900/[0.03]">
                       {loading ? (
                          <tr><td colSpan={5} className="p-32 text-center text-amber-900/10 font-serif text-3xl italic">Syncing Index Hub...</td></tr>
                       ) : processedData.length === 0 ? (
                          <tr><td colSpan={5} className="p-32 text-center text-amber-900/10 font-serif text-3xl italic">Registry is silent.</td></tr>
                       ) : (
                          processedData.map((item, idx) => (
                             <tr key={item.id || idx} className="hover:bg-amber-50/40 transition-all group">
                                <td className="px-10 py-8">
                                   <div className="space-y-1">
                                      <h4 className="text-xl font-serif text-[#2d221c] tracking-tight truncate max-w-sm uppercase">
                                         {item.wood_type || item.ply_category || item.foam_type || item.fabric_type || item.customer_type}
                                      </h4>
                                      <p className="text-[10px] text-amber-900/40 font-black tracking-widest uppercase">
                                         {activeTab === 'wood' && `${item.length_from_ft}–${item.length_to_ft}ft | W:${item.width_in}" T:${item.thickness_in}"`}
                                         {activeTab === 'ply' && `${item.thickness_mm}mm Structural Layer`}
                                         {activeTab === 'foam' && `Spec: ${item.specification}`}
                                         {activeTab === 'fabric' && `Brand: ${item.brand}`}
                                         {activeTab === 'markups' && `Standard System Markup`}
                                      </p>
                                   </div>
                                </td>
                                <td className="px-10 py-8 text-right">
                                   <p className="text-2xl font-serif text-[#2d221c]">
                                      {activeTab === 'markups' ? `${item.default_markup_percent}%` : `₹${item.rate_per_gf || item.rate_per_sqft || item.base_rate || item.base_rate_per_meter}`}
                                   </p>
                                   <p className="text-[8px] font-black text-amber-900/30 uppercase tracking-widest">
                                      {activeTab === 'wood' ? '/ GUN FOOT' : activeTab === 'ply' ? '/ SQ FOOT' : activeTab === 'markups' ? 'ON INTERNAL COST' : '/ MASTER UNIT'}
                                   </p>
                                </td>
                                {(activeTab === 'ply' || activeTab === 'foam' || activeTab === 'fabric') && (
                                   <td className="px-10 py-8 text-center">
                                      <button 
                                        onClick={() => handleToggleActive(item)}
                                        className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest border transition-all ${
                                          item.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' : 'bg-rose-50 text-rose-400 border-rose-100 opacity-50'
                                        }`}
                                      >
                                         {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                                      </button>
                                   </td>
                                )}
                                <td className="px-10 py-8 text-right">
                                   <button 
                                     onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                                     className="p-3 rounded-xl text-amber-900/10 hover:text-[#2d221c] hover:bg-white border border-transparent hover:border-amber-900/10 transition-all opacity-0 group-hover:opacity-100"
                                   >
                                      <Edit2 className="w-5 h-5" />
                                   </button>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>

      {/* Manual Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[#2d221c]/80 backdrop-blur-md">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative overflow-hidden p-12 space-y-10">
              <div className="bg-grain absolute inset-0 opacity-[0.03] pointer-events-none"></div>
              <div className="relative z-10 flex justify-between items-center">
                 <h2 className="text-4xl font-serif text-[#2d221c] tracking-tight">{editingItem ? 'Edit Protocol' : 'New Material Definition'}</h2>
                 <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full border border-amber-900/10 flex items-center justify-center hover:bg-amber-50 transition-colors"><Plus className="w-6 h-6 rotate-45 text-amber-900/40"/></button>
              </div>
              
              <form onSubmit={handleManualSave} className="relative z-10 space-y-6">
                 {activeTab === 'wood' && (
                    <>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Wood Classification</label>
                          <input name="wood_type" defaultValue={editingItem?.wood_type} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-serif text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/10" required />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Length From (ft)</label>
                             <input name="length_from_ft" type="number" step="0.01" defaultValue={editingItem?.length_from_ft} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Length To (ft)</label>
                             <input name="length_to_ft" type="number" step="0.01" defaultValue={editingItem?.length_to_ft} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Width (in)</label>
                             <input name="width_in" type="number" step="1" defaultValue={editingItem?.width_in} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Thickness (in)</label>
                             <input name="thickness_in" type="number" step="0.1" defaultValue={editingItem?.thickness_in} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Rate per Gun Foot (₹)</label>
                          <input name="rate_per_gf" type="number" step="0.01" defaultValue={editingItem?.rate_per_gf} className="w-full px-6 py-4 bg-[#2d221c] border border-transparent rounded-2xl font-mono text-xl text-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/20" required />
                       </div>
                    </>
                 )}
                 {activeTab === 'ply' && (
                    <>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Board Category</label>
                          <input name="ply_category" defaultValue={editingItem?.ply_category} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-serif text-lg" required />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Thickness (mm)</label>
                             <input name="thickness_mm" type="number" defaultValue={editingItem?.thickness_mm} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Rate per SqFt (₹)</label>
                             <input name="rate_per_sqft" type="number" step="0.01" defaultValue={editingItem?.rate_per_sqft} className="w-full px-6 py-4 bg-[#2d221c] text-amber-400 rounded-2xl font-mono text-lg" required />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Effective From</label>
                          <input name="effective_date" type="date" defaultValue={editingItem?.effective_date} className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-mono text-sm" required />
                       </div>
                    </>
                 )}
                 {activeTab === 'markups' && (
                    <>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Client Classification</label>
                          <select name="customer_type" className="w-full px-6 py-4 bg-amber-50/30 border border-amber-900/5 rounded-2xl font-serif text-lg outline-none" defaultValue={editingItem?.customer_type}>
                             {['Architect', 'Interior Designer', 'House Owner', 'Showroom', 'Third-party Supplier'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">System Markup (%)</label>
                          <input name="default_markup_percent" type="number" min="0" max="100" defaultValue={editingItem?.default_markup_percent} className="w-full px-6 py-4 bg-[#2d221c] text-amber-400 rounded-2xl font-serif text-2xl" required />
                       </div>
                    </>
                 )}
                 
                 <div className="flex justify-end gap-3 pt-8">
                    <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="text-amber-900/40 px-10">Abort</Button>
                    <Button type="submit" className="bg-[#2d221c] text-white px-10 rounded-2xl shadow-xl border-t border-white/5 font-serif text-xl h-16">
                       Commit Record
                    </Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* CSV Import Wizard */}
      {isImportModalOpen && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-amber-950/40 backdrop-blur-xl">
            <div className="bg-white/90 backdrop-blur-md w-full max-w-3xl rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/20 p-12 max-h-[90vh] overflow-y-auto custom-scroll">
               <div className="bg-grain absolute inset-0 opacity-[0.05] pointer-events-none"></div>
               <div className="relative z-10 space-y-10">
                  <div className="flex justify-between items-start">
                     <div>
                        <h2 className="text-4xl font-serif text-[#2d221c] tracking-tight">Bulk Acquisition Wizard</h2>
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em] mt-2">Target Registry: {activeTab.toUpperCase()}</p>
                     </div>
                     <button onClick={() => {setIsImportModalOpen(false); setImportResult(null); setImportData([]);}} className="p-3 rounded-full hover:bg-amber-100/50 transition-all"><Plus className="w-6 h-6 rotate-45 text-amber-900/20"/></button>
                  </div>

                  {!importResult?.success ? (
                     <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-4">
                              <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Source Selection (.csv)</label>
                              <div className="relative group">
                                 <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                                 <div className="w-full px-6 py-5 bg-white border-2 border-dashed border-amber-900/10 rounded-2xl group-hover:border-amber-500 transition-all flex items-center justify-center gap-4 text-amber-900/30 font-medium italic">
                                    <Upload className="w-5 h-5"/> {importData.length > 0 ? `${importData.length} Rows Staged` : 'Click to Upload Manifest'}
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 ml-2">
                                 <input type="checkbox" id="scancat" checked={useSpecialParser} onChange={() => setUseSpecialParser(!useSpecialParser)} className="rounded border-amber-200 text-amber-600 focus:ring-amber-500" />
                                 <label htmlFor="scancat" className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 cursor-pointer">Enable Pattern Scanning (Special Matrix)</label>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="text-[9px] font-black uppercase tracking-widest text-amber-900/40 ml-4">Persistence Strategy</label>
                              <div className="flex bg-amber-50/50 p-1.5 rounded-2xl border border-amber-900/5">
                                 <button onClick={() => setImportMode('append')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'append' ? 'bg-[#2d221c] text-white shadow-lg' : 'text-amber-900/30'}`}>Append</button>
                                 <button onClick={() => setImportMode('replace')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${importMode === 'replace' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-amber-900/30'}`}>Destructive Wipe</button>
                              </div>
                              {importMode === 'replace' && (
                                 <p className="text-[9px] text-rose-500 font-bold ml-2 animate-pulse uppercase tracking-tighter italic">⚠ WARNING: This will erase all existing {activeTab} records.</p>
                              )}
                           </div>
                        </div>

                        {importData.length > 0 && (
                           <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                 {[
                                    { l: 'Total Manifesto', v: importStats.total, c: 'text-[#2d221c]' },
                                    { l: 'Validated Valid', v: importStats.valid, c: 'text-emerald-600' },
                                    { l: 'Validation Errors', v: importStats.invalid, c: 'text-rose-500' },
                                    { l: 'Collision Skip', v: importStats.duplicates, c: 'text-amber-500' }
                                 ].map((s, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl border border-amber-900/5 shadow-inner">
                                       <p className="text-[8px] font-black uppercase tracking-tighter text-amber-900/30 leading-none mb-2">{s.l}</p>
                                       <p className={`text-2xl font-serif ${s.c}`}>{s.v}</p>
                                    </div>
                                 ))}
                              </div>

                              {importErrors.length > 0 && (
                                 <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 max-h-40 overflow-y-auto text-[10px] font-medium text-rose-800 space-y-2">
                                    <p className="font-black uppercase tracking-widest mb-4 flex items-center gap-2 sticky top-0 bg-rose-50 pb-2 border-b border-rose-200">
                                       <AlertTriangle className="w-4 h-4"/> Integrity Logs
                                    </p>
                                    {importErrors.map((e, i) => <p key={i}>Row #{e.row}: {e.message} in column <span className="font-bold">[{e.column}]</span></p>)}
                                 </div>
                              )}

                              <div className="flex justify-end gap-3 pt-10 border-t border-amber-900/10">
                                 <Button variant="ghost" onClick={() => {setImportData([]); setImportErrors([]);}} className="text-amber-900/40">Reset manifest</Button>
                                 <Button 
                                    onClick={executeImport} 
                                    isLoading={isImporting} 
                                    disabled={importStats.valid === 0}
                                    className={`h-16 px-10 rounded-2xl shadow-xl transition-all font-serif text-xl ${importMode === 'replace' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#2d221c] hover:bg-black'} text-white`}
                                 >
                                    <ShieldCheck className="w-6 h-6 mr-3" /> Execute Integration
                                 </Button>
                              </div>
                           </div>
                        )}
                        
                        {!importData.length && (
                           <div className="pt-10 flex border-t border-amber-900/10 justify-between items-center text-amber-900/30">
                              <p className="text-[10px] font-bold uppercase tracking-widest italic">Ensure CSV headers match the registry schema.</p>
                              <button onClick={() => downloadCSV(`${activeTab}_template.csv`, TEMPLATES[activeTab])} className="text-[10px] font-black uppercase text-amber-700 underline flex items-center gap-2"><Download className="w-4 h-4"/> Fetch Schema Template</button>
                           </div>
                        )}
                     </div>
                  ) : (
                     <div className="py-20 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-700">
                        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-emerald-500/20 shadow-xl border-4 border-white mb-4">
                           <CheckCircle className="w-12 h-12" />
                        </div>
                        <h3 className="text-4xl font-serif text-[#2d221c]">Integration Complete</h3>
                        <p className="text-lg text-amber-900/40 max-w-sm">{importResult.count} records have been integrated into the {activeTab} registry successfully.</p>
                        <Button className="h-14 px-10 rounded-2xl bg-[#2d221c] text-white font-serif text-xl" onClick={() => {setIsImportModalOpen(false); setImportResult(null); setImportData([]);}}>
                           Return to Registry
                        </Button>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      <style jsx global>{`
        .font-serif { font-family: var(--font-instrument-serif), Georgia, serif; }
        .bg-grain { background-image: url("https://www.transparenttextures.com/patterns/p6.png"); }
        .shadow-wood { box-shadow: 0 10px 40px -10px rgba(45,34,28,0.08), 0 2px 4px -2px rgba(45,34,28,0.03); }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(45,34,28,0.05); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
