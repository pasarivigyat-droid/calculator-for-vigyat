const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Since we are running locally, we need service account credentials to wipe Firestore via script.
// If you don't have a service account JSON, we can't run this as a standalone admin script.
// However, I will provide the logic to do it via the browser console or a temporary maintenance page.

// MAINTENANCE SCRIPT: wipe_quotations.js
// Usage: node wipe_quotations.js <service-account-path>

async function wipeQuotations() {
  const db = getFirestore();
  const collectionRef = db.collection('quotations');
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log('No quotations found to delete.');
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Successfully deleted ${snapshot.size} quotations.`);
}

// NOTE: This script is for administrative use only.
