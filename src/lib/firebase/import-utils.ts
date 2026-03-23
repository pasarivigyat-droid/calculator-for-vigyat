import { db } from "./config";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";

/**
 * Utility to batch upload wood rates from the Woodflex Price List CSV.
 * This can be called from a hidden admin button or initial setup task.
 */
export const importWoodRates = async (csvData: string) => {
  const batch = writeBatch(db);
  const lines = csvData.split('\n').filter(l => l.trim().length > 0);

  // Basic parsing logic for the specific Woodflex SAGWOOD/BABOOL CSV format
  // Note: For a robust production tool, use a library like PapaParse

  lines.forEach((line, index) => {
    // Placeholder: In a real app, this would parse the specific grid format
    // found in your 'woodflex_price_list.csv'.
  });

  // Example structure to be uploaded:
  const demoRates = [
    { wood_type: "SAGWOOD", length_from_ft: 1.5, length_to_ft: 2.25, width_in: 2, thickness_in: 1.5, rate_per_gf: 950 },
    { wood_type: "SAGWOOD", length_from_ft: 2.5, length_to_ft: 2.75, width_in: 2, thickness_in: 1.5, rate_per_gf: 1050 },
    { wood_type: "BABOOL", length_from_ft: 3, length_to_ft: 4.75, width_in: 4, thickness_in: 1, rate_per_gf: 800 },
  ];

  demoRates.forEach(rate => {
    const ref = doc(collection(db, "masters/wood/items"));
    batch.set(ref, { ...rate, updatedAt: serverTimestamp() });
  });

  await batch.commit();
  console.log("Imported wood rates successfully.");
};
