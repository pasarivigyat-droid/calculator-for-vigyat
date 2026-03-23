"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Search, Edit2, Upload, Download, Database, Save, 
  CheckCircle, AlertTriangle, ArrowUpDown, ArrowDown, ArrowUp, Filter
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

// =======================================================
// CSV TEMPLATES — match exactly the import schema
// =======================================================
const TEMPLATES: Record<string, string> = {
  wood: "wood_type,length_from_ft,length_to_ft,width_in,thickness_in,rate_per_gf\nSagawood,1.5,2.25,1.5,1,851",
  ply:  "ply_category,thickness_mm,rate_per_sqft\nplywood,18,50.07\nplywood,12,37.98",
  foam: "foam_type,specification,base_rate\nPU,Standard,1200",
  fabric: "fabric_type,brand,base_rate_per_meter\nVelvet,DDecor,1200\nLeather,Genuine,4500"
};

// Numeric fields to auto-convert during CSV parsing
const NUMERIC_FIELDS: Record<string, string[]> = {
  wood: ['length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'rate_per_gf'],
  ply:  ['thickness_mm', 'rate_per_sqft'],
  foam: ['base_rate'],
  fabric: ['base_rate_per_meter']
};

// =======================================================
// VERIFICATION STATS HELPER
// =======================================================
function computeVerificationStats(data: any[], tab: MasterCategory) {
  // Only Plywood has is_active status
  const active = tab === 'ply' ? data.filter(d => d.is_active).length : data.length;
  const inactive = tab === 'ply' ? data.filter(d => !d.is_active).length : 0;
  const dates = data.map(d => d.effective_date).filter(Boolean).sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : '—';
  const earliestDate = dates.length > 0 ? dates[0] : '—';

  // Group by primary key
  let groups: Record<string, number> = {};
  if (tab === 'wood') {
    data.forEach(d => { groups[d.wood_type] = (groups[d.wood_type] || 0) + 1; });
  } else if (tab === 'ply') {
    data.forEach(d => { groups[d.ply_category] = (groups[d.ply_category] || 0) + 1; });
  } else if (tab === 'foam') {
    data.forEach(d => { groups[`${d.foam_type} / ${d.specification}`] = (groups[`${d.foam_type} / ${d.specification}`] || 0) + 1; });
  } else if (tab === 'fabric') {
    data.forEach(d => { groups[d.fabric_type] = (groups[d.fabric_type] || 0) + 1; });
  }

  // Check for numeric integrity
  let numericIssues = 0;
  if (tab === 'wood') {
    data.forEach(d => { if (typeof d.rate_per_gf !== 'number') numericIssues++; });
  } else if (tab === 'ply') {
    data.forEach(d => { if (typeof d.rate_per_sqft !== 'number') numericIssues++; });
  } else if (tab === 'foam') {
    data.forEach(d => { if (typeof d.base_rate !== 'number') numericIssues++; });
  }

  return { total: data.length, active, inactive, latestDate, earliestDate, groups, numericIssues };
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
  
  // Import State
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

  // Global defaults for imports
  const [globalImportDate, setGlobalImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalImportActive, setGlobalImportActive] = useState(true);

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const { auth } = require("@/lib/firebase/config");
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      console.log("[Auth] State Change:", user ? `Logged in as ${user.email}` : "Logged out");
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, currentUser]);

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

  // ── EXPORT using canonical headers ──
  const handleExport = (mode: 'simple' | 'internal' = 'simple') => {
    if (data.length === 0) return alert("No data to export");
    const headers = mode === 'internal' 
      ? (INTERNAL_EXPORT_HEADERS[activeTab as keyof typeof INTERNAL_EXPORT_HEADERS] || EXPORT_HEADERS[activeTab])
      : EXPORT_HEADERS[activeTab];
      
    if (!headers) return alert("Export not available for this tab");
    const csv = generateCSV(headers, data);
    downloadCSV(`${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  // ── FILE UPLOAD & VALIDATION ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportStage('parsing/validating');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportStage('parsing/validating');
      
      let parsedData: any[] = [];
      
      if (useSpecialParser) {
        if (activeTab === 'wood') parsedData = parseWoodMatrix(text);
        else if (activeTab === 'ply') parsedData = parsePlywoodReport(text);
        else if (activeTab === 'foam') parsedData = parseFoamReport(text);
      } else {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setImportStage('error');
          return alert("Invalid CSV file — missing headers or data.");
        }
        
        const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        const rawData = rows.slice(1);
        const numFields = NUMERIC_FIELDS[activeTab] || [];

        rawData.forEach((row, idx) => {
          if (!row || row.length === 0 || row.every(c => !c.trim())) return; 
          const item: any = {};
          headers.forEach((h, i) => {
            let val: any = (row[i] || "").trim();
            if (numFields.includes(h)) val = Number(val);
            else if (h === 'is_active' && activeTab !== 'wood') {
              val = val.toLowerCase() === 'true' || val === '1';
            }
            if (activeTab === 'ply' && h === 'ply_category') val = normalizePlyCategory(val);
            item[h] = val;
          });
          parsedData.push(item);
        });
      }

      if (parsedData.length === 0) {
        setImportStage('error');
        return alert("No valid data found in this CSV.");
      }

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
        } else if (key) {
          seenKeys.add(key);
        }

        if (rowErrors.length > 0) errors.push(...rowErrors);
        else validCount++;
      });

      setImportData(parsedData);
      setImportErrors(errors);
      setImportStats({
        total: parsedData.length,
        valid: validCount,
        invalid: parsedData.length - validCount,
        duplicates: duplicateCount
      });
      setImportStage('ready');
    };
    reader.readAsText(file);
  };

  const downloadInvalidRows = () => {
    if (importErrors.length === 0) return;
    const invalidRowIndices = new Set(importErrors.map(e => e.row - 1));
    const invalidData = importData.filter((_, idx) => invalidRowIndices.has(idx));
    if (invalidData.length === 0) return;
    const headers = EXPORT_HEADERS[activeTab] || Object.keys(importData[0]);
    const csv = generateCSV(headers, invalidData);
    downloadCSV(`${activeTab}_invalid_rows.csv`, csv);
  };

  // ── IMPORT EXECUTION ──
  const executeImport = async () => {
    // if (importStats.invalid > 0) return alert("Please fix validation errors first.");
    setIsImporting(true);
    setImportStage('preparing');
    setImportProgress({ done: 0, total: importStats.valid });
    
    try {
      const collectionNameMap: Record<string, "woodMasters" | "plyMasters" | "foamMasters" | "fabricMasters"> = {
        wood: 'woodMasters',
        ply: 'plyMasters',
        foam: 'foamMasters',
        fabric: 'fabricMasters'
      };
      const collectionName = (collectionNameMap[activeTab] || 'woodMasters') as "woodMasters" | "plyMasters" | "foamMasters" | "fabricMasters";
      console.log(`[UI] Executing ${importMode} import for ${activeTab}...`);

      // Filter to only valid rows
      const invalidRowIndices = new Set(importErrors.map(e => e.row - 1));
      let validRows = importData.filter((_, idx) => !invalidRowIndices.has(idx));
      
      console.log(`[UI] Found ${validRows.length} valid rows out of ${importData.length} total.`);

      if (validRows.length === 0) {
        setIsImporting(false);
        setImportStage('error');
        return alert("No valid rows to import. Please check the validation issues below.");
      }

      // Apply plywood global defaults (if fields missing from CSV)
      if (activeTab === 'ply') {
        validRows = validRows.map(row => ({
          ...row,
          effective_date: row.effective_date || globalImportDate,
          is_active: row.is_active !== undefined ? row.is_active : globalImportActive,
          notes: row.notes || ""
        }));
      }

      console.log(`[UI] Found ${validRows.length} valid rows to write.`);

      const count = await bulkImportMasters(
        collectionName, 
        validRows, 
        importMode, 
        (stage, done, total) => {
          setImportStage(stage === 'writing' ? `Writing Chunks...` : stage);
          setImportProgress({ done, total });
        }
      );
      
      setImportStage('finished');
      setImportResult({ success: true, count: count || validRows.length, mode: importMode });
      setImportData([]);
      setImportErrors([]);
      setImportStats({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
      setImportProgress(null);
      loadData();
      setShowVerification(true);
      console.log(`[UI] Import Complete. ${count} rows written.`);
    } catch (err) {
      setIsImporting(false);
      setImportStage('error');
      setImportResult({ success: false, count: 0, mode: importMode });
      setImportProgress(null);
      alert("FATAL IMPORT ERROR: " + (err as Error).message);
    }
    setIsImporting(false);
  };

  // ── TOGGLE ACTIVE (only for ply/foam — wood has no is_active) ──
  const handleToggleActive = async (item: any) => {
    if (activeTab === 'wood') return; // wood has no is_active
    const updated = { ...item, is_active: !item.is_active };
    if (activeTab === 'ply') await savePlyMaster(updated);
    else if (activeTab === 'foam') await saveFoamMaster(updated);
    loadData();
  };

  // ── DIAGNOSTIC TEST ──
  const runDiagnosticTest = async () => {
    console.log("Starting Firestore Diagnostic Test...");
    const testId = "test_" + Date.now();
    const testData = { 
      ply_category: "DEBUG_TEST", 
      thickness_mm: 99, 
      rate_per_sqft: 99, 
      is_active: false, 
      is_debug: true,
      timestamp: new Date().toISOString()
    };

    try {
      console.log("1. Attempting Write to 'plyMasters'...", testData);
      const { 
        addDoc, collection, doc, deleteDoc, getDoc 
      } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/config");

      const docRef = await addDoc(collection(db, "masters/ply/items"), testData);
      console.log("✅ WRITE SUCCESS. Doc ID:", docRef.id);

      console.log("2. Attempting Read of the written doc...");
      const snap = await getDoc(doc(db, "masters/ply/items", docRef.id));
      if (snap.exists() && snap.data().ply_category === "DEBUG_TEST") {
        console.log("✅ READ SUCCESS. Data matches.");
      } else {
        console.error("❌ READ FAILED or data mismatch.", snap.data());
      }

      console.log("3. Attempting Cleanup (Delete doc)...");
      await deleteDoc(doc(db, "masters/ply/items", docRef.id));
      console.log("✅ DELETE SUCCESS. Cleanup complete.");
      
      alert("DIAGNOSTIC SUCCESS: Firestore Write/Read/Delete all worked fine.");
    } catch (err: any) {
      console.error("❌ DIAGNOSTIC FATAL ERROR:", err);
      alert(`DIAGNOSTIC FAILED!\n\nCode: ${err.code}\nMessage: ${err.message}\n\nCheck Console for full trace.`);
    }
  };

  // ── MANUAL SAVE ──
  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const item: any = Object.fromEntries(formData.entries());
    
    const allNumericFields = ['rate_per_gf', 'rate_per_sqft', 'base_rate', 'base_rate_per_meter', 'length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'thickness_mm', 'default_markup_percent'];
    allNumericFields.forEach(field => {
       if (item[field] !== undefined && item[field] !== '') item[field] = Number(item[field]);
    });

    console.log(`[ManualSave] Attempting save to ${activeTab}:`, item);

    try {
      if (activeTab === 'wood') await saveWoodMaster({ ...editingItem, ...item } as any);
      else if (activeTab === 'ply') await savePlyMaster({ ...editingItem, ...item, is_active: item.is_active ?? editingItem?.is_active ?? true } as any);
      else if (activeTab === 'foam') await saveFoamMaster({ ...editingItem, ...item, is_active: item.is_active ?? editingItem?.is_active ?? true } as any);
      else if (activeTab === 'fabric') await saveFabricMaster({ ...editingItem, ...item } as any);
      else if (activeTab === 'markups') await saveMarkupSetting({ ...editingItem, ...item } as any);
      
      console.log(`[ManualSave] ✅ SUCCESS`);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(`[ManualSave] ❌ FAILED:`, err);
      alert(`Save Failed!\n\nError Code: ${err.code || 'unknown'}\nMessage: ${err.message || 'Check console'}`);
    }
  };

  // ── SORTED + FILTERED DATA ──
  const processedData = useMemo(() => {
    let result = [...data];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => JSON.stringify(item).toLowerCase().includes(q));
    }

    // Sorting
    if (activeTab !== 'markups') {
      result.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortField === 'effective_date') {
          aVal = a.effective_date || '';
          bVal = b.effective_date || '';
        } else if (sortField === 'type') {
          aVal = a.wood_type || a.ply_category || a.foam_type || a.fabric_type || '';
          bVal = b.wood_type || b.ply_category || b.foam_type || b.fabric_type || '';
        } else if (sortField === 'rate') {
          aVal = a.rate_per_gf || a.rate_per_sqft || a.base_rate || a.base_rate_per_meter || 0;
          bVal = b.rate_per_gf || b.rate_per_sqft || b.base_rate || b.base_rate_per_meter || 0;
        }
        const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, searchQuery, sortField, sortDir, activeTab]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />;
  };

  // Verification stats
  const vStats = useMemo(() => {
    if (activeTab === 'markups') return null;
    return computeVerificationStats(data, activeTab);
  }, [data, activeTab]);

  // =======================================================
  // RENDER
  // =======================================================
  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2d221c]">Masters Management</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-500 font-medium">
             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> One row = One usable rate</span>
             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Effective dates override previous rates</span>
             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Only Active records used in calculators</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setIsImportModalOpen(true); setImportResult(null); }} className="flex-1 md:flex-none">
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>          {['wood', 'ply', 'foam', 'markups'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as MasterCategory)}
              className={`pb-4 px-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 uppercase tracking-widest ${
                activeTab === tab ? "border-amber-600 text-amber-600" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab === 'ply' ? 'Plywood' : tab === 'markups' ? 'Markups' : tab.toUpperCase()}
            </button>
          ))}
          {activeTab === 'ply' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('simple')} title="Simplified CSV for re-upload" className="flex-1 md:flex-none">
                <Download className="w-4 h-4 mr-2" /> Template
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleExport('simple')} className="flex-1 md:flex-none">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm w-full overflow-x-auto no-scrollbar">
        {(['wood', 'ply', 'foam', 'fabric', 'markups'] as MasterCategory[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchQuery(''); setShowVerification(false); }}
            className={`flex-1 min-w-[100px] px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#2d221c] text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            {tab === 'ply' ? 'Plywood' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ══════════ POST-IMPORT VERIFICATION PANEL ══════════ */}
      {!loading && activeTab !== 'markups' && vStats && (showVerification || data.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Database className="w-4 h-4 text-green-600" />
              {activeTab === 'ply' ? 'Plywood' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Verification
            </h3>
            <button type="button" onClick={() => setShowVerification(!showVerification)} className="text-[10px] font-bold text-blue-500 underline uppercase">
              {showVerification ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Quick stats bar */}
          <div className={`grid grid-cols-2 ${activeTab === 'ply' ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3`}>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Records</p>
              <p className="text-xl font-bold text-gray-800">{vStats.total}</p>
            </div>
            {(activeTab === 'ply' || activeTab === 'fabric') && (
              <>
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Active</p>
                  <p className="text-xl font-bold text-green-700">{vStats.active}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Inactive</p>
                  <p className="text-xl font-bold text-red-600">{vStats.inactive}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Latest Eff. Date</p>
                  <p className="text-lg font-bold text-blue-700 font-mono">{vStats.latestDate}</p>
                </div>
              </>
            )}
            <div className={`p-3 rounded-xl border ${vStats.numericIssues === 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Numeric Check</p>
              <p className={`text-lg font-bold ${vStats.numericIssues === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {vStats.numericIssues === 0 ? '✓ OK' : `⚠ ${vStats.numericIssues} issues`}
              </p>
            </div>
          </div>

          {/* Detailed breakdown */}
          {showVerification && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-gray-100 text-xs text-gray-500">
                <p>Date range: <span className="font-mono font-bold text-gray-700">{vStats.earliestDate}</span> → <span className="font-mono font-bold text-gray-700">{vStats.latestDate}</span></p>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ══════════ DATA TABLE ══════════ */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-2">
            <span className="text-[10px] text-gray-400 font-bold hidden sm:inline">{processedData.length} total</span>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={runDiagnosticTest} variant="outline" className="text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50 px-2 h-9">
                <Database className="w-3 h-3 mr-1" /> Diagnostic
              </Button>
              <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-amber-600 hover:bg-amber-700 shadow-md h-9 text-xs">
                <Plus className="w-4 h-4 mr-1 md:mr-2" /> Add Material
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 uppercase text-[10px] font-bold text-gray-500 tracking-widest">
              <tr>
                <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('type')}>
                  <span className="flex items-center gap-1">Item Details <SortIcon field="type" /></span>
                </th>
                <th className="px-5 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort('rate')}>
                  <span className="flex items-center gap-1 justify-end">Rate / Value <SortIcon field="rate" /></span>
                </th>
                {(activeTab === 'ply' || activeTab === 'fabric') && (
                  <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('effective_date')}>
                    <span className="flex items-center gap-1">Eff. Date <SortIcon field="effective_date" /></span>
                  </th>
                )}
                {(activeTab === 'ply' || activeTab === 'fabric') && (
                  <th className="px-5 py-3 text-center">Status</th>
                )}
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                 <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Fetching master data...</td></tr>
              ) : processedData.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No records found.</td></tr>
              ) : (
                processedData.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors text-sm">
                    <td className="px-5 py-3">
                      {activeTab === 'wood' && (
                        <div>
                          <p className="font-semibold text-gray-900">{item.wood_type}</p>
                          <p className="text-[11px] text-gray-400">{item.length_from_ft}–{item.length_to_ft}ft | W:{item.width_in}" T:{item.thickness_in}"</p>
                        </div>
                      )}
                      {activeTab === 'ply' && (
                        <div>
                          <p className="font-semibold text-gray-900">{item.ply_category}</p>
                          <p className="text-[11px] text-gray-400">{item.thickness_mm}mm</p>
                        </div>
                      )}
                      {activeTab === 'foam' && (
                        <div>
                          <p className="font-semibold text-gray-900">{item.foam_type}</p>
                          <p className="text-[11px] text-gray-400">Spec: {item.specification}</p>
                        </div>
                      )}
                      {activeTab === 'fabric' && (
                        <div>
                          <p className="font-semibold text-gray-900">{item.fabric_type}</p>
                          <p className="text-[11px] text-gray-400">Brand: {item.brand}</p>
                        </div>
                      )}
                      {activeTab === 'markups' && <p className="font-semibold text-gray-900">{item.customer_type}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-amber-700">
                      {activeTab === 'wood' && <>₹{item.rate_per_gf}<span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">/GF</span></>}
                      {activeTab === 'ply' && <>₹{item.rate_per_sqft}<span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">/sqft</span></>}
                      {activeTab === 'foam' && <>₹{item.base_rate}<span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">base</span></>}
                      {activeTab === 'fabric' && <>₹{item.base_rate_per_meter}<span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">/meter</span></>}
                      {activeTab === 'markups' && <>{item.default_markup_percent}%</>}
                    </td>
                    {(activeTab === 'ply' || activeTab === 'fabric') && (
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono">
                        {item.effective_date || '—'}
                      </td>
                    )}
                    {(activeTab === 'ply' || activeTab === 'fabric') && (
                      <td className="px-5 py-3 text-center">
                         <button 
                          onClick={() => handleToggleActive(item)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}
                         >
                            {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                         </button>
                      </td>
                    )}
                    <td className="px-5 py-3 text-right">
                       <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {loading ? (
             <div className="py-10 text-center text-gray-400 italic text-sm">Loading records...</div>
          ) : processedData.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">No records found.</div>
          ) : (
            processedData.map((item: any, idx: number) => (
              <div key={item.id || idx} className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 relative">
                <div className="flex justify-between items-start mb-2">
                   <div>
                      {activeTab === 'wood' && (
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">{item.wood_type}</p>
                          <p className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block uppercase tracking-wider font-bold">
                            {item.length_from_ft}–{item.length_to_ft}ft | {item.width_in}"x{item.thickness_in}"
                          </p>
                        </div>
                      )}
                      {activeTab === 'ply' && (
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">{item.ply_category}</p>
                          <p className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block uppercase tracking-wider font-bold">{item.thickness_mm}mm</p>
                        </div>
                      )}
                      {activeTab === 'foam' && (
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">{item.foam_type}</p>
                          <p className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block uppercase tracking-wider font-bold">{item.specification}</p>
                        </div>
                      )}
                      {activeTab === 'fabric' && (
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">{item.fabric_type}</p>
                          <p className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block uppercase tracking-wider font-bold">{item.brand}</p>
                        </div>
                      )}
                      {activeTab === 'markups' && <p className="font-bold text-gray-900">{item.customer_type}</p>}
                   </div>
                   <div className="flex gap-1">
                     <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="h-8 w-8 hover:bg-white border"><Edit2 className="w-3.5 h-3.5" /></Button>
                   </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                   <div className="flex items-center gap-2">
                      {(activeTab === 'ply' || activeTab === 'fabric') && (
                        <button 
                          onClick={() => handleToggleActive(item)}
                          className={`px-2 py-1 rounded text-[9px] font-black tracking-widest ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}
                        >
                          {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      )}
                      {(activeTab === 'ply' || activeTab === 'fabric') && item.effective_date && (
                        <span className="text-[10px] text-gray-400 font-mono">{item.effective_date}</span>
                      )}
                   </div>
                   <div className="text-right">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-[9px]">Rate</p>
                      <p className="font-black text-amber-700">
                        {activeTab === 'wood' && <>₹{item.rate_per_gf}<span className="text-[8px] ml-0.5 opacity-50 font-normal">/GF</span></>}
                        {activeTab === 'ply' && <>₹{item.rate_per_sqft}<span className="text-[8px] ml-0.5 opacity-50 font-normal">/sqft</span></>}
                        {activeTab === 'foam' && <>₹{item.base_rate}<span className="text-[8px] ml-0.5 opacity-50 font-normal">base</span></>}
                        {activeTab === 'fabric' && <>₹{item.base_rate_per_meter}<span className="text-[8px] ml-0.5 opacity-50 font-normal">/meter</span></>}
                        {activeTab === 'markups' && <>{item.default_markup_percent}%</>}
                      </p>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ══════════ MANUAL ADD/EDIT MODAL ══════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg" title={editingItem ? `Edit ${activeTab} Record` : `Add New ${activeTab} Record`}>
             <form onSubmit={handleManualSave} className="space-y-4">
                {activeTab === 'wood' && (
                   <>
                      <Input label="Wood Type" name="wood_type" defaultValue={editingItem?.wood_type} required />
                      <div className="grid grid-cols-2 gap-4">
                         <Input label="Length From (ft)" name="length_from_ft" type="number" step="0.01" defaultValue={editingItem?.length_from_ft} required />
                         <Input label="Length To (ft)" name="length_to_ft" type="number" step="0.01" defaultValue={editingItem?.length_to_ft} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <Input label="Width (in)" name="width_in" type="number" step="0.1" defaultValue={editingItem?.width_in} required />
                         <Input label="Thickness (in)" name="thickness_in" type="number" step="0.1" defaultValue={editingItem?.thickness_in} required />
                      </div>
                      <Input label="Rate / GF (₹)" name="rate_per_gf" type="number" step="0.01" defaultValue={editingItem?.rate_per_gf} required />
                   </>
                )}
                {activeTab === 'ply' && (
                   <>
                      <Input label="Ply Category" name="ply_category" defaultValue={editingItem?.ply_category} required />
                      <Input label="Thickness (mm)" name="thickness_mm" type="number" defaultValue={editingItem?.thickness_mm} required />
                      <Input label="Rate / SqFt (₹)" name="rate_per_sqft" type="number" step="0.01" defaultValue={editingItem?.rate_per_sqft} required />
                      <Input label="Effective Date" name="effective_date" type="date" defaultValue={editingItem?.effective_date} required />
                      <Input label="Notes" name="notes" defaultValue={editingItem?.notes} />
                   </>
                )}
                {activeTab === 'foam' && (
                   <>
                      <Input label="Foam Type" name="foam_type" defaultValue={editingItem?.foam_type} required />
                      <Input label="Specification" name="specification" defaultValue={editingItem?.specification} required />
                      <Input label="Base Rate (₹)" name="base_rate" type="number" step="0.01" defaultValue={editingItem?.base_rate} required />
                      <p className="text-[10px] text-gray-400 -mt-2">Base rate only. Thickness comes from the quote row, not from master.</p>
                   </>
                )}
                {activeTab === 'markups' && (
                  <>
                     <Select label="Customer Type" name="customer_type" defaultValue={editingItem?.customer_type} options={['Architect', 'Interior Designer', 'House Owner', 'Showroom', 'Third-party Supplier'].map(t => ({label:t, value:t}))} />
                     <Input label="Default Markup (%)" name="default_markup_percent" type="number" min="0" max="100" defaultValue={editingItem?.default_markup_percent} required />
                  </>
                )}
                <div className="flex justify-end gap-3 pt-6">
                   <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                   <Button type="submit"><Save className="w-4 h-4 mr-2" /> Save Record</Button>
                </div>
             </form>
          </Card>
        </div>
      )}

      {/* ══════════ CSV IMPORT MODAL ══════════ */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title={`Bulk Import: ${activeTab === 'ply' ? 'PLYWOOD' : activeTab.toUpperCase()}`}>
            <div className="space-y-5">
              
              {/* SUCCESS RESULT */}
              {importResult?.success && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 space-y-2">
                  <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Import Successful!
                  </p>
                  <p className="text-xs text-green-700">
                    {importResult.count} records {importResult.mode === 'replace' ? 'replaced' : 'appended'} into {activeTab} masters.
                    Data table has been refreshed. Use the verification panel to confirm results.
                  </p>
                  <Button variant="outline" size="sm" type="button" onClick={() => { setIsImportModalOpen(false); setShowVerification(true); }} className="mt-2 text-green-700 border-green-300">
                    Close & View Verification ↓
                  </Button>
                </div>
              )}

              {/* INSTRUCTIONS */}
              {!importResult?.success && (
                <>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-4">
                     <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                     <div>
                        <p className="text-sm font-bold text-amber-800 uppercase tracking-tight">Bulk Upload Wizard</p>
                        <p className="text-xs text-amber-700 mt-1">Upload your CSV. Rows will be validated against required fields, data types, and duplicate keys.</p>
                        <p className="text-[10px] text-amber-600 mt-1 font-mono">
                          Required headers: {(EXPORT_HEADERS[activeTab] || []).filter(h => h !== 'notes').join(', ')}
                        </p>                        <button 
                          type="button"
                          onClick={() => downloadCSV(`${activeTab}_template.csv`, TEMPLATES[activeTab])}
                          className="text-amber-800 font-bold text-xs underline mt-2 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download {activeTab} Template CSV
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div className="space-y-2 lg:col-span-1">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                          1. Upload File
                          <button 
                            type="button" 
                            onClick={() => { setUseSpecialParser(!useSpecialParser); setImportData([]); setImportErrors([]); }}
                            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors font-bold ${useSpecialParser ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}`}
                          >
                            {useSpecialParser ? 'SCAN MODE: ON' : 'SCAN MODE: OFF'}
                          </button>
                        </label>
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-800" />
                        {useSpecialParser && (
                          <p className="text-[9px] text-blue-600 font-bold animate-pulse mt-1">
                             ✨ Using smart parser for {activeTab} rate cards (matrix/grid format)
                          </p>
                        )}
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">2. Strategy</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                           <button type="button" onClick={() => setImportMode('append')} className={`flex-1 py-1.5 text-xs font-bold rounded ${importMode === 'append' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}>APPEND</button>
                           <button type="button" onClick={() => setImportMode('replace')} className={`flex-1 py-1.5 text-xs font-bold rounded ${importMode === 'replace' ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>WIPE & REPLACE</button>
                        </div>

                      {activeTab === 'ply' && (
                        <div className="space-y-2 border-l pl-4 border-amber-200 lg:col-span-1 bg-amber-50/30 p-2 rounded-lg">
                           <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                             <Filter className="w-3 h-3 text-amber-600" /> 3. Import Options (Global)
                           </label>
                           <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-bold">Apply Date:</span>
                                <input type="date" value={globalImportDate} onChange={(e) => setGlobalImportDate(e.target.value)} className="text-[10px] border p-1 rounded bg-white font-bold text-gray-700 h-6" />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-bold">Active Status:</span>
                                <button type="button" onClick={() => setGlobalImportActive(!globalImportActive)} className={`text-[10px] px-2 py-0.5 rounded-full font-bold h-6 ${globalImportActive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                  {globalImportActive ? 'YES (Active)' : 'NO (Disabled)'}
                                </button>
                              </div>
                           </div>
                        </div>
                      )}
                     </div>
                  </div>

                  {importData.length > 0 && (
                    <div className="space-y-5">
                       {/* IMPORT STATS */}
                       <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Rows</p>
                             <p className="text-xl font-bold text-gray-700">{importStats.total}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                             <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Valid</p>
                             <p className="text-xl font-bold text-green-700">{importStats.valid}</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                             <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Invalid</p>
                             <p className="text-xl font-bold text-red-700">{importStats.invalid}</p>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                             <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Duplicates</p>
                             <p className="text-xl font-bold text-amber-700">{importStats.duplicates}</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                             <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Will Insert</p>
                             <p className="text-xl font-bold text-blue-700">{importStats.valid}</p>
                             <p className="text-[9px] text-blue-400">{importStats.invalid > 0 ? `${importStats.invalid} skipped` : 'none skipped'}</p>
                          </div>
                       </div>

                       {/* DATA PREVIEW */}
                       <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Data Preview (first 5 valid rows)</p>
                          <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto max-h-48">
                             <table className="w-full text-left text-[10px]">
                                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                                   <tr>
                                      <th className="px-2 py-2 text-gray-400">#</th>
                                      {(EXPORT_HEADERS[activeTab] || Object.keys(importData[0] || {})).map(h => <th key={h} className="px-2 py-2 whitespace-nowrap">{h}</th>)}
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                   {importData.slice(0, 5).map((row, idx) => {
                                     const rowHasError = importErrors.some(e => e.row === idx + 1);
                                     return (
                                       <tr key={idx} className={rowHasError ? "bg-red-50/50 text-red-700" : "text-gray-700"}>
                                          <td className="px-2 py-2 text-gray-400 font-mono">{idx + 1}</td>
                                          {(EXPORT_HEADERS[activeTab] || Object.keys(row)).map((h, j) => (
                                            <td key={j} className="px-2 py-2 whitespace-nowrap font-mono">{String(row[h] ?? '')}</td>
                                          ))}
                                       </tr>
                                     );
                                   })}
                                </tbody>
                             </table>
                          </div>
                       </div>

                       {/* VALIDATION ERRORS */}
                       {importErrors.length > 0 && (
                         <div className="space-y-3">
                            <div className="flex items-center justify-between">
                               <p className="text-xs font-bold text-red-600 uppercase">Validation Issues ({importErrors.length})</p>
                               <button type="button" onClick={downloadInvalidRows} className="text-[10px] font-bold text-blue-600 underline uppercase flex items-center gap-1">
                                  <Download className="w-3 h-3" /> Download Invalid Rows
                               </button>
                            </div>
                            <div className="border border-red-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-red-50/20">
                               <table className="w-full text-left text-[10px]">
                                  <thead className="bg-red-50 text-red-800 sticky top-0">
                                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Column</th><th className="px-3 py-2">Message</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-red-100">
                                     {importErrors.map((err, i) => (
                                       <tr key={i} className="text-red-700">
                                         <td className="px-3 py-2 font-bold">#{err.row}</td>
                                         <td className="px-3 py-2 font-mono opacity-70">{err.column}</td>
                                         <td className="px-3 py-2">{err.message}</td>
                                       </tr>
                                     ))}
                                  </tbody>
                               </table>
                             </div>
                          </div>
                        )}

                        {/* WIPE WARNING */}
                        {importMode === 'replace' && (
                           <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                              <div>
                                 <p className="text-xs font-bold text-red-800 uppercase">Destructive Action</p>
                                 <p className="text-[10px] text-red-700 mt-0.5">
                                   This will permanently delete ALL existing {data.length} {activeTab} records and insert {importStats.valid} new ones.
                                 </p>
                              </div>
                           </div>
                        )}
                     </div>
                   )}

                   {/* PROGRESS & SUMMARY SECTION */}
                   {(isImporting || importStage !== 'idle') && (
                     <div className="pt-6 space-y-4 border-t">
                       <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${isImporting ? 'bg-amber-500 animate-pulse' : importStage === 'finished' ? 'bg-green-500' : 'bg-gray-300'}`} />
                         <p className="text-xs font-bold text-gray-700 uppercase tracking-tight">
                           Stage: <span className="text-amber-600 ml-1">{importStage.toUpperCase()}</span>
                         </p>
                       </div>

                       {importProgress && importStage !== 'finished' && (
                         <div className="space-y-2">
                           <div className="flex justify-between text-[10px] font-bold text-gray-400">
                             <span>Processing {importProgress.done} / {importProgress.total}</span>
                             <span>{Math.round((importProgress.done / (importProgress.total || 1)) * 100)}%</span>
                           </div>
                           <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                             <div 
                               className="bg-gradient-to-r from-amber-500 to-green-500 h-2 rounded-full transition-all duration-300"
                               style={{ width: `${(importProgress.done / (importProgress.total || 1)) * 100}%` }}
                             />
                           </div>
                         </div>
                       )}

                       {importStage === 'finished' && importResult && (
                         <div className="p-4 bg-green-50 border border-green-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                           <div className="flex items-center gap-3 mb-4">
                             <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                               <CheckCircle className="w-6 h-6 text-green-600" />
                             </div>
                             <div>
                               <h4 className="text-sm font-bold text-green-900 leading-none">Import Successful</h4>
                               <p className="text-[10px] text-green-700 mt-1">Database has been updated successfully.</p>
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white/50 p-2 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Total Imported</p>
                                <p className="text-lg font-bold text-green-700">{importResult.count}</p>
                              </div>
                              <div className="bg-white/50 p-2 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Import Mode</p>
                                <p className="text-xs font-bold text-amber-700 uppercase">{importResult.mode}</p>
                              </div>
                              <div className="bg-white/50 p-2 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Duplicates Skipped</p>
                                <p className="text-xs font-bold text-gray-700">{importStats.duplicates}</p>
                              </div>
                              <div className="bg-white/50 p-2 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Invalid Skipped</p>
                                <p className="text-xs font-bold text-gray-700">{importStats.invalid}</p>
                              </div>
                           </div>
                         </div>
                       )}
                     </div>
                   )}

                   <div className="flex justify-end gap-3 pt-4 border-t font-semibold">
                      <Button variant="ghost" type="button" onClick={() => { setIsImportModalOpen(false); setImportData([]); setImportErrors([]); setImportResult(null); setImportStage('idle'); }}>
                        {importStage === 'finished' ? 'Close Wizard' : 'Cancel'}
                      </Button>
                      {importStage !== 'finished' && (
                        <Button 
                          type="button"
                          onClick={() => {
                            if (importMode === 'replace' && !confirm(`DANGER: Wipe ALL existing ${activeTab} records (${data.length} rows) and replace with ${importStats.valid} new rows?`)) return;
                            executeImport();
                          }} 
                          isLoading={isImporting} 
                          disabled={importData.length === 0 || importStats.valid === 0 || isImporting}
                          className={`${importMode === 'replace' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'} shadow-lg`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> 
                          {importMode === 'replace' ? `Wipe & Replace (${importStats.valid} rows)` : `Append ${importStats.valid} rows`}
                        </Button>
                      )}
                   </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
