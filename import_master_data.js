const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } = require("firebase/firestore");
const fs = require('fs');

// Firebase Configuration (From project's config.ts)
const firebaseConfig = {
  apiKey: "AIzaSyBExn4ybqBzJ3WqqzY1fxQ0yMJNarTMnuY",
  authDomain: "gen-lang-client-0825859469.firebaseapp.com",
  projectId: "gen-lang-client-0825859469",
  storageBucket: "gen-lang-client-0825859469.firebasestorage.app",
  messagingSenderId: "133613288502",
  appId: "1:133613288502:web:b48a008398b50b65552c97"
};

// Initialize Firebase with the correct secondary database ID
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-d6a74ed0-4234-45c9-83e9-64ba6c0a1096");

const COLLECTIONS = {
  wood: "masters/wood/items",
  ply: "masters/ply/items"
};

/**
 * Parses a basic flat CSV string into objects
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
}

/**
 * Deletes all documents in the target collection path
 */
async function clearCollection(path) {
  console.log(`[Clear] Cleaning existing records in: ${path}`);
  const q = collection(db, path);
  const snap = await getDocs(q);
  console.log(`[Clear] Found ${snap.size} records to remove.`);
  
  // Use batches for deletion if large
  const batchLimit = 450;
  const docs = snap.docs;
  
  for (let i = 0; i < docs.length; i += batchLimit) {
    const chunk = docs.slice(i, i + batchLimit);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`[Clear] Deleted chunk ${i / batchLimit + 1}`);
  }
}

/**
 * Imports Wood Master data from CSV
 */
async function importWood() {
  console.log("[Import] Reading wood_masters_flat.csv...");
  const content = fs.readFileSync('wood_masters_flat.csv', 'utf8');
  const records = parseCSV(content);
  console.log(`[Import] Parsed ${records.length} records.`);

  const batch = writeBatch(db);
  let count = 0;
  
  for (const r of records) {
    const docRef = doc(collection(db, COLLECTIONS.wood));
    batch.set(docRef, {
      wood_type: r.wood_type,
      length_from_ft: parseFloat(r.length_from_ft) || 0,
      length_to_ft: parseFloat(r.length_to_ft) || 0,
      width_in: parseFloat(r.width_in) || 0,
      thickness_in: parseFloat(r.thickness_in) || 0,
      rate_per_gf: parseFloat(r.rate_per_gf) || 0,
      is_active: true,
      createdAt: new Date().toISOString()
    });
    count++;
  }
  
  await batch.commit();
  console.log(`[Import] Successfully uploaded ${count} wood records to Firestore.`);
}

/**
 * Imports Plywood Master data from CSV
 */
async function importPly() {
  console.log("[Import] Reading ply_masters_flat.csv...");
  const content = fs.readFileSync('ply_masters_flat.csv', 'utf8');
  const records = parseCSV(content);
  console.log(`[Import] Parsed ${records.length} records.`);

  const batch = writeBatch(db);
  let count = 0;
  
  for (const r of records) {
    const docRef = doc(collection(db, COLLECTIONS.ply));
    batch.set(docRef, {
      ply_category: r.ply_category,
      thickness_mm: parseInt(r.thickness_mm) || 0,
      rate_per_sqft: parseFloat(r.rate_per_sqft) || 0,
      is_active: true,
      effective_date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });
    count++;
  }
  
  await batch.commit();
  console.log(`[Import] Successfully uploaded ${count} plywood records to Firestore.`);
}

async function main() {
  try {
    console.log("--- STARTING FIRESTORE MASTER IMPORT ---");
    
    // 1. Wood
    await clearCollection(COLLECTIONS.wood);
    await importWood();
    
    // 2. Plywood
    await clearCollection(COLLECTIONS.ply);
    await importPly();
    
    console.log("--- IMPORT COMPLETE ---");
    console.log("The SAGWOOD 4x1.5 (2.5-2.75ft) record should now be correctly priced at ₹1175/GF.");
    process.exit(0);
  } catch (error) {
    console.error("--- IMPORT FAILED ---");
    console.error(error);
    process.exit(1);
  }
}

main();
