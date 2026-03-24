import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  limit,
  writeBatch
} from "firebase/firestore";
import { db } from "./config";
import { 
  Quotation, 
  WoodMaster, 
  PlyMaster, 
  FoamMaster, 
  FabricMaster,
  CustomerMarkupSetting,
  CustomerType
} from "@/types";

// --- QUOTATIONS ---

export const createQuotation = async (quotation: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, "quotations"), {
    ...quotation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateQuotation = async (id: string, quotation: Partial<Quotation>) => {
  const docRef = doc(db, "quotations", id);
  await updateDoc(docRef, {
    ...quotation,
    updatedAt: serverTimestamp(),
  });
};

export const getQuotation = async (id: string): Promise<Quotation | null> => {
  const docRef = doc(db, "quotations", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Quotation;
  }
  return null;
};

export const getRecentQuotations = async (limitNum: number = 20): Promise<Quotation[]> => {
  const q = query(
    collection(db, "quotations"), 
    orderBy("updatedAt", "desc"), 
    limit(limitNum)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
};

export const duplicateQuotation = async (id: string) => {
  const existing = await getQuotation(id);
  if (!existing) throw new Error("Quotation not found");
  
  const { id: _, createdAt: __, updatedAt: ___, ...data } = existing;
  return await createQuotation({
    ...data,
    productName: `${data.productName} (Copy)`,
    date: new Date().toISOString().split('T')[0]
  });
};

export const deleteQuotation = async (id: string) => {
  const docRef = doc(db, "quotations", id);
  await deleteDoc(docRef);
};

export const deleteAllQuotations = async () => {
  const q = query(collection(db, "quotations"));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// --- MASTERS CRUD ---

// ── COLLECTION PATHS ──
const COLLECTIONS = {
  wood: "masters/wood/items",
  ply: "masters/ply/items",
  foam: "masters/foam/items",
  fabric: "masters/fabric/items",
  markups: "masters/markups/items"
};

export const getWoodMasters = async (includeInactive = false): Promise<WoodMaster[]> => {
  const q = query(collection(db, COLLECTIONS.wood));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WoodMaster));
};

export const saveWoodMaster = async (item: WoodMaster) => {
  if (item.id) {
    const docRef = doc(db, COLLECTIONS.wood, item.id);
    await updateDoc(docRef, { ...item });
  } else {
    await addDoc(collection(db, COLLECTIONS.wood), { ...item });
  }
};

export const getPlyMasters = async (includeInactive = false): Promise<PlyMaster[]> => {
  const q = includeInactive
    ? query(collection(db, COLLECTIONS.ply))
    : query(collection(db, COLLECTIONS.ply), where("is_active", "==", true));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlyMaster));
};

export const savePlyMaster = async (item: PlyMaster) => {
  if (item.id) {
    const docRef = doc(db, COLLECTIONS.ply, item.id);
    await updateDoc(docRef, { ...item });
  } else {
    await addDoc(collection(db, COLLECTIONS.ply), { ...item });
  }
};

export const getFoamMasters = async (): Promise<FoamMaster[]> => {
  const q = query(collection(db, COLLECTIONS.foam));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoamMaster));
};

export const saveFoamMaster = async (item: FoamMaster) => {
  if (item.id) {
    const docRef = doc(db, COLLECTIONS.foam, item.id);
    await updateDoc(docRef, { ...item });
  } else {
    await addDoc(collection(db, COLLECTIONS.foam), { ...item });
  }
};

export const getFabricMasters = async (): Promise<FabricMaster[]> => {
  const q = query(collection(db, COLLECTIONS.fabric));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FabricMaster));
};

export const saveFabricMaster = async (item: FabricMaster) => {
  if (item.id) {
    const docRef = doc(db, COLLECTIONS.fabric, item.id);
    await updateDoc(docRef, { ...item });
  } else {
    await addDoc(collection(db, COLLECTIONS.fabric), { ...item });
  }
};

// --- BULK OPERATIONS ---

const BATCH_LIMIT = 450; 

/**
 * Delete all docs in a collection (handles large collections with chunked batches).
 */
const deleteCollection = async (path: string) => {
  const q = query(collection(db, path));
  const snap = await getDocs(q);
  const refs = snap.docs.map(d => d.ref);
  
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
  }
};

/**
 * Bulk import master records with chunked writes and failure protection.
 * - uses normalized nested collection paths (/masters/{category}/items)
 */
export const bulkImportMasters = async (
  categoryName: "woodMasters" | "plyMasters" | "foamMasters" | "fabricMasters", 
  items: any[], 
  mode: 'append' | 'replace',
  onStatus?: (stage: string, done: number, total: number) => void
) => {
  // Resolve the actual Firestore path based on category name
  const collectionPath = categoryName === 'woodMasters' ? COLLECTIONS.wood 
                      : categoryName === 'plyMasters' ? COLLECTIONS.ply 
                      : categoryName === 'foamMasters' ? COLLECTIONS.foam : COLLECTIONS.fabric;

  const CHUNK_SIZE = 50; 
  const TIMEOUT_MS = 30000; 
  const isWood = categoryName === 'woodMasters';
  
  console.log(`[Import] Starting: ${items.length} rows to Path: ${collectionPath} in ${mode} mode.`);

  if (mode === 'replace') {
    if (onStatus) onStatus('Deactivating old records...', 0, 1);
    await deleteCollection(collectionPath);
    console.log(`[Import] Wipe & Replace: Old collection path ${collectionPath} cleared.`);
  }

  let successCount = 0;
  
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
    
    console.log(`[Import] Processing chunk ${chunkNum}/${totalChunks} (${chunk.length} rows)...`);
    if (onStatus) onStatus('writing', i, items.length);

    const batch = writeBatch(db);
    
    chunk.forEach((item) => {
      const docRef = doc(collection(db, collectionPath));
      const docData: any = { 
        ...item,
        createdAt: new Date().toISOString()
      };
      
      if (categoryName === 'plyMasters' && docData.is_active === undefined) {
        docData.is_active = true;
      }

      batch.set(docRef, docData);
    });

    try {
      const commitPromise = batch.commit();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Chunk ${chunkNum} timed out after ${TIMEOUT_MS/1000}s`)), TIMEOUT_MS)
      );

      await Promise.race([commitPromise, timeoutPromise]);
      successCount += chunk.length;
      console.log(`[Import] Success: Chunk ${chunkNum}/${totalChunks} committed.`);
    } catch (err: any) {
      const errorMsg = `Import failed at Chunk ${chunkNum}. Success: ${successCount} rows. Error: ${err.message || err}`;
      console.error(`[Import] FATAL ERROR: ${errorMsg}`, err);
      throw err;
    }
  }

  console.log(`[Import] Finished: Successfully imported ${successCount} documents.`);
  if (onStatus) onStatus('finished', successCount, items.length);
  return successCount;
};

export const getMarkupSettings = async (): Promise<CustomerMarkupSetting[]> => {
  const q = query(collection(db, COLLECTIONS.markups));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as CustomerMarkupSetting);
};

export const saveMarkupSetting = async (setting: CustomerMarkupSetting) => {
  const q = query(collection(db, COLLECTIONS.markups), where("customer_type", "==", setting.customer_type));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(doc(db, COLLECTIONS.markups, snap.docs[0].id), { ...setting });
  } else {
    await addDoc(collection(db, COLLECTIONS.markups), setting);
  }
};
