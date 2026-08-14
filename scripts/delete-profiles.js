import { initializeApp as initClientApp } from "firebase/app";
import { getFirestore, doc, getDoc, deleteDoc } from "firebase/firestore";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Load configuration
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let config = {
  projectId: "gen-lang-client-0597692683",
  apiKey: "AIzaSyCWJt933MlHtXerkiNU5M6zENPWyrhWcsU",
  authDomain: "gen-lang-client-0597692683.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34"
};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// -----------------------------------------------------------------------------
// LIST OF UIDs TO DELETE
// You can either:
//   1. Paste confirmed robot UIDs directly into this array:
//      const UIDS_TO_DELETE = ["uid1", "uid2"];
//   2. Or pass them as CLI arguments:
//      node scripts/delete-profiles.js uid1 uid2 uid3
// -----------------------------------------------------------------------------
const CLI_ARGS = process.argv.slice(2);
const UIDS_TO_DELETE = CLI_ARGS.length > 0 ? CLI_ARGS : [
  // Paste UIDs to delete here, e.g.:
  // "3ePqpo4f74VkHyJFyjKEyOE2v1L2",
];

// Initialize client Firestore
const clientApp = initClientApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
}, "delete-script-client");
const db = getFirestore(clientApp, config.firestoreDatabaseId || "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34");

// Initialize Firebase Admin for Auth user deletion
if (!getAdminApps().length) {
  initAdminApp({
    projectId: config.projectId
  });
}
const adminAuth = getAdminAuth();

async function deleteProfiles() {
  console.log("================================================================================");
  console.log("                 PAMNIM INTERIORS - SECURE PROFILE DELETION                     ");
  console.log("================================================================================");

  if (UIDS_TO_DELETE.length === 0) {
    console.log("No UIDs specified for deletion.");
    console.log("To delete profiles, either:");
    console.log("  1. Add UIDs into the UIDS_TO_DELETE array inside scripts/delete-profiles.js");
    console.log("  2. Pass them as arguments: node scripts/delete-profiles.js <uid1> <uid2> ...\n");
    process.exit(0);
  }

  console.log(`Starting deletion process for ${UIDS_TO_DELETE.length} account(s)...\n`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const uid of UIDS_TO_DELETE) {
    const trimmedUid = uid.trim();
    if (!trimmedUid) continue;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Processing UID: ${trimmedUid}`);

    try {
      // 1. Fetch profile to verify data and check safety guard
      const profileRef = doc(db, "profiles", trimmedUid);
      const snap = await getDoc(profileRef);
      
      let profileData = null;
      if (snap.exists()) {
        profileData = snap.data();
        console.log(`  -> Found Profile: Name="${profileData.name || 'N/A'}", Email="${profileData.email || 'N/A'}", Role="${profileData.role || 'N/A'}"`);
      } else {
        console.log(`  -> Note: No document found in 'profiles' collection for this UID.`);
      }

      // Safety guard: NEVER delete an account with role === 'owner'
      if (profileData && profileData.role === 'owner') {
        console.warn(`  ⚠️  [SAFETY GUARD TRIGGERED] Skipping UID ${trimmedUid}: This account has role 'owner'!`);
        skippedCount++;
        continue;
      }

      // 2. Delete from profiles collection
      if (snap.exists()) {
        await deleteDoc(profileRef);
        console.log(`  -> [FIRESTORE] Deleted document from 'profiles/${trimmedUid}'.`);
      }

      // 3. Delete from pending_signups collection if it exists
      try {
        const pendingRef = doc(db, "pending_signups", trimmedUid);
        const pendingSnap = await getDoc(pendingRef);
        if (pendingSnap.exists()) {
          await deleteDoc(pendingRef);
          console.log(`  -> [FIRESTORE] Deleted document from 'pending_signups/${trimmedUid}'.`);
        }
      } catch (e) {
        // Non-fatal
      }

      // 4. Delete Firebase Auth user record
      try {
        await adminAuth.deleteUser(trimmedUid);
        console.log(`  -> [AUTH] Deleted Firebase Auth user record for UID ${trimmedUid}.`);
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          console.log(`  -> [AUTH] User does not exist in Firebase Auth (already removed).`);
        } else {
          console.warn(`  -> [AUTH Warning] Could not delete Auth record (${authErr.message || authErr}). Firestore profile deleted.`);
        }
      }

      console.log(`  ✅ Successfully deleted account ${trimmedUid}.`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to delete account ${trimmedUid}:`, err.message || err);
      errorCount++;
    }
  }

  console.log(`\n================================================================================`);
  console.log(`DELETION SUMMARY:`);
  console.log(`  Successfully deleted: ${successCount}`);
  console.log(`  Skipped (Safety):     ${skippedCount}`);
  console.log(`  Errors encountered:   ${errorCount}`);
  console.log(`================================================================================\n`);

  process.exit(0);
}

deleteProfiles();
