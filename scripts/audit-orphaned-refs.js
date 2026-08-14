import { initializeApp as initClientApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  arrayRemove 
} from "firebase/firestore";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Load Firebase configuration
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let config = {
  projectId: "gen-lang-client-0597692683",
  apiKey: "AIzaSyCWJt933MlHtXerkiNU5M6zENPWyrhWcsU",
  authDomain: "gen-lang-client-0597692683.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34"
};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.warn("Could not parse firebase-applet-config.json, using fallback configuration.");
  }
}

// 1. Initialize Client Firestore
const clientApp = initClientApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
}, "audit-orphans-client");
const db = getFirestore(clientApp, config.firestoreDatabaseId || "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34");

// 2. Initialize Firebase Admin SDK
if (!getAdminApps().length) {
  initAdminApp({
    projectId: config.projectId
  });
}
const adminAuth = getAdminAuth();

/**
 * Scans the database and Firebase Auth for orphaned references and stale records.
 * Returns an object containing the known-good UIDs and arrays of flagged items.
 */
export async function auditOrphanedRefs() {
  console.log("================================================================================");
  console.log("             PAMNIM INTERIORS - ORPHANED REFERENCES & TRACES AUDIT             ");
  console.log("================================================================================");
  console.log(`Firestore Database ID: ${config.firestoreDatabaseId}`);
  console.log(`Firebase Project ID:   ${config.projectId}`);
  console.log("Scanning profiles, auth users, projects, and pending signups...\n");

  const knownGoodUids = new Set();
  const authUids = new Set();
  const activeProfileUids = new Set();

  // 1. Get valid UIDs from Firebase Auth directly via admin.auth().listUsers()
  try {
    const listUsersResult = await adminAuth.listUsers(1000);
    if (listUsersResult && listUsersResult.users) {
      listUsersResult.users.forEach(u => {
        if (u.uid) {
          authUids.add(u.uid);
          knownGoodUids.add(u.uid);
        }
      });
      console.log(`[AUTH] Successfully retrieved ${authUids.size} user(s) from Firebase Auth.`);
    }
  } catch (err) {
    console.log(`[AUTH Note] admin.auth().listUsers(): ${err.message || 'Identity Toolkit API unavailable in current environment'}. Using active Firestore profiles as primary UID registry.`);
  }

  // 2. Get valid UIDs from 'profiles' collection
  const profilesSnap = await getDocs(collection(db, "profiles"));
  profilesSnap.forEach(docSnap => {
    const data = docSnap.data();
    // A profile is valid if it has an id and valid role/status
    const uid = data.uid || docSnap.id;
    if (uid) {
      activeProfileUids.add(uid);
      knownGoodUids.add(uid);
    }
  });

  console.log(`[PROFILES] Loaded ${profilesSnap.docs.length} profile document(s) from Firestore.`);
  console.log(`[KNOWN-GOOD] Built set of ${knownGoodUids.size} known-good UID(s):`);
  Array.from(knownGoodUids).forEach(u => console.log(`   • ${u}`));
  console.log("");

  // 3. Scan 'profiles' itself:
  //    - flag any document whose uid field doesn't match its own document ID
  //    - flag any document whose uid no longer exists in Firebase Auth (if Auth list was available)
  const flaggedProfiles = [];
  profilesSnap.forEach(docSnap => {
    const data = docSnap.data();
    
    // Check mismatch between data.uid and document id
    if (data.uid && data.uid !== docSnap.id) {
      flaggedProfiles.push({
        docId: docSnap.id,
        field: "uid",
        staleValue: data.uid,
        reason: `Profile field data.uid ("${data.uid}") does not match its document id ("${docSnap.id}")`
      });
    }

    // Check if doc exists in Firestore but was deleted from Firebase Auth
    if (authUids.size > 0 && !authUids.has(docSnap.id)) {
      flaggedProfiles.push({
        docId: docSnap.id,
        field: "id/uid",
        staleValue: docSnap.id,
        reason: `Profile document exists in Firestore but Auth user was deleted from Firebase Auth`
      });
    }
  });

  // 4. Scan 'projects' collection:
  //    - clientId doesn't match a known-good uid
  //    - any entry in employeeIds doesn't match a known-good uid
  const flaggedProjects = [];
  try {
    const projectsSnap = await getDocs(collection(db, "projects"));
    console.log(`[PROJECTS] Scanning ${projectsSnap.docs.length} project document(s)...`);
    
    projectsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const projName = data.name || data.title || "Untitled Project";

      // Scan clientId
      if (data.clientId) {
        if (!knownGoodUids.has(data.clientId)) {
          flaggedProjects.push({
            docId: docSnap.id,
            projectName: projName,
            field: "clientId",
            staleValue: data.clientId,
            reason: `clientId "${data.clientId}" is not in known-good UIDs (client user was deleted or never existed)`,
            action: "set_client_null"
          });
        }
      }

      // Scan employeeIds array
      if (Array.isArray(data.employeeIds)) {
        data.employeeIds.forEach((empId, idx) => {
          if (empId && !knownGoodUids.has(empId)) {
            flaggedProjects.push({
              docId: docSnap.id,
              projectName: projName,
              field: `employeeIds[${idx}]`,
              staleValue: empId,
              reason: `employeeId "${empId}" in employeeIds is not in known-good UIDs (staff user was deleted or removed)`,
              action: "remove_employee_id"
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn(`[PROJECTS Warning] Could not scan projects collection:`, err.message || err);
  }

  // 5. Scan 'pending_signups' collection:
  //    - flag any document whose id/uid isn't in the known-good set or was leftover after approval
  const flaggedPendingSignups = [];
  try {
    const pendingSnap = await getDocs(collection(db, "pending_signups"));
    console.log(`[PENDING SIGNUPS] Scanning ${pendingSnap.docs.length} pending signup document(s)...`);
    
    pendingSnap.forEach(docSnap => {
      const data = docSnap.data();
      const targetUid = data.uid || docSnap.id;

      if (targetUid && !knownGoodUids.has(targetUid)) {
        // Orphaned signup (User was deleted or never completed authentication)
        flaggedPendingSignups.push({
          docId: docSnap.id,
          name: data.name || "(Unknown)",
          email: data.email || "(No email)",
          field: "id/uid",
          staleValue: targetUid,
          reason: `Pending signup document exists for UID "${targetUid}" which is not in known-good UIDs (orphaned signup)`
        });
      } else if (targetUid && activeProfileUids.has(targetUid)) {
        // Leftover signup trace: user has already been approved and exists as active in profiles
        flaggedPendingSignups.push({
          docId: docSnap.id,
          name: data.name || "(Unknown)",
          email: data.email || "(No email)",
          field: "id/uid",
          staleValue: targetUid,
          reason: `Pending signup document for "${data.name || targetUid}" was already approved into profiles and should have been cleaned up`
        });
      }
    });
  } catch (err) {
    console.warn(`[PENDING Warning] Could not scan pending_signups collection:`, err.message || err);
  }

  // 6. Print Report of everything flagged
  console.log("\n================================================================================");
  console.log("                             AUDIT REPORT FINDINGS                              ");
  console.log("================================================================================");

  const totalFlagged = flaggedProfiles.length + flaggedProjects.length + flaggedPendingSignups.length;
  console.log(`Total Flagged Orphaned Traces: ${totalFlagged}\n`);

  if (flaggedProfiles.length > 0) {
    console.log(`--- [PROFILES] (${flaggedProfiles.length} issue(s) detected) ---`);
    flaggedProfiles.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Collection: profiles | Doc ID: ${item.docId}`);
      console.log(`      Field:       ${item.field}`);
      console.log(`      Stale Value: ${item.staleValue}`);
      console.log(`      Reason:      ${item.reason}`);
    });
    console.log("");
  } else {
    console.log("✅ [PROFILES] All profile documents match their document IDs and valid records.");
  }

  if (flaggedProjects.length > 0) {
    console.log(`--- [PROJECTS] (${flaggedProjects.length} issue(s) detected) ---`);
    flaggedProjects.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Collection: projects | Project: "${item.projectName}" (Doc ID: ${item.docId})`);
      console.log(`      Field:       ${item.field}`);
      console.log(`      Stale Value: ${item.staleValue}`);
      console.log(`      Reason:      ${item.reason}`);
      console.log(`      Fix Action:  ${item.action === 'set_client_null' ? 'Set clientId to null' : 'Remove stale employeeId from array'}`);
    });
    console.log("");
  } else {
    console.log("✅ [PROJECTS] All projects reference only valid, known-good client & employee UIDs.");
  }

  if (flaggedPendingSignups.length > 0) {
    console.log(`--- [PENDING SIGNUPS] (${flaggedPendingSignups.length} leftover/stale issue(s) detected) ---`);
    flaggedPendingSignups.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Collection: pending_signups | Doc ID: ${item.docId}`);
      console.log(`      User Info:   ${item.name} <${item.email}>`);
      console.log(`      Field:       ${item.field}`);
      console.log(`      Stale Value: ${item.staleValue}`);
      console.log(`      Reason:      ${item.reason}`);
    });
    console.log("");
  } else {
    console.log("✅ [PENDING SIGNUPS] No leftover or stale pending signups found.");
  }

  console.log("================================================================================\n");

  return {
    knownGoodUids,
    authUids,
    activeProfileUids,
    flaggedProjects,
    flaggedPendingSignups,
    flaggedProfiles
  };
}

/**
 * Cleans up flagged orphaned references.
 * When dryRun = true (default), only logs the planned mutations without modifying the database.
 * When dryRun = false, applies safe updates and deletions.
 */
export async function cleanOrphanedRefs(dryRun = true) {
  console.log(`\n>>> STARTING CLEANUP (Mode: ${dryRun ? 'DRY RUN - Previewing changes only' : 'LIVE EXECUTION - Modifying database'}) <<<\n`);
  
  const report = await auditOrphanedRefs();
  const { flaggedProjects, flaggedPendingSignups, flaggedProfiles } = report;
  const totalIssues = flaggedProjects.length + flaggedPendingSignups.length + flaggedProfiles.length;

  if (totalIssues === 0) {
    console.log("🎉 Database is completely clean! No orphaned references or leftover traces to repair.\n");
    return;
  }

  let repairedCount = 0;

  // 1. Process Projects
  for (const item of flaggedProjects) {
    const projectRef = doc(db, "projects", item.docId);

    if (item.action === 'set_client_null') {
      if (dryRun) {
        console.log(`[DRY-RUN] Would update 'projects/${item.docId}': set clientId = null (stale value was "${item.staleValue}").`);
      } else {
        try {
          await updateDoc(projectRef, {
            clientId: null,
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ [APPLIED] Updated 'projects/${item.docId}': cleared stale clientId.`);
          repairedCount++;
        } catch (err) {
          console.error(`❌ [ERROR] Failed to update project ${item.docId}:`, err.message || err);
        }
      }
    } else if (item.action === 'remove_employee_id') {
      if (dryRun) {
        console.log(`[DRY-RUN] Would update 'projects/${item.docId}': remove stale employeeId "${item.staleValue}" from employeeIds array.`);
      } else {
        try {
          await updateDoc(projectRef, {
            employeeIds: arrayRemove(item.staleValue),
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ [APPLIED] Updated 'projects/${item.docId}': removed stale employeeId "${item.staleValue}".`);
          repairedCount++;
        } catch (err) {
          console.error(`❌ [ERROR] Failed to update employeeIds in project ${item.docId}:`, err.message || err);
        }
      }
    }
  }

  // 2. Process Pending Signups
  for (const item of flaggedPendingSignups) {
    const pendingRef = doc(db, "pending_signups", item.docId);
    if (dryRun) {
      console.log(`[DRY-RUN] Would delete leftover/stale 'pending_signups/${item.docId}' (${item.name} <${item.email}>).`);
    } else {
      try {
        await deleteDoc(pendingRef);
        console.log(`✅ [APPLIED] Deleted leftover pending signup 'pending_signups/${item.docId}'.`);
        repairedCount++;
      } catch (err) {
        console.error(`❌ [ERROR] Failed to delete pending signup ${item.docId}:`, err.message || err);
      }
    }
  }

  // 3. Process Profiles
  for (const item of flaggedProfiles) {
    const profileRef = doc(db, "profiles", item.docId);
    if (dryRun) {
      console.log(`[DRY-RUN] Would delete orphaned profile document 'profiles/${item.docId}'.`);
    } else {
      try {
        await deleteDoc(profileRef);
        console.log(`✅ [APPLIED] Deleted orphaned profile document 'profiles/${item.docId}'.`);
        repairedCount++;
      } catch (err) {
        console.error(`❌ [ERROR] Failed to delete profile document ${item.docId}:`, err.message || err);
      }
    }
  }

  console.log("\n================================================================================");
  if (dryRun) {
    console.log(`DRY RUN COMPLETE: ${totalIssues} item(s) flagged for cleanup.`);
    console.log(`To execute and apply these changes, run:`);
    console.log(`  node scripts/audit-orphaned-refs.js --apply`);
  } else {
    console.log(`CLEANUP COMPLETE: Successfully applied ${repairedCount} of ${totalIssues} remediation(s).`);
  }
  console.log("================================================================================\n");
}

// Check CLI flags
const args = process.argv.slice(2);
const shouldApply = args.includes("--apply") || args.includes("--execute") || args.includes("--no-dry-run");

// Run script (default dryRun = true unless --apply or --execute flag passed)
if (shouldApply) {
  cleanOrphanedRefs(false).then(() => process.exit(0)).catch(err => {
    console.error("Fatal error during cleanup execution:", err);
    process.exit(1);
  });
} else {
  cleanOrphanedRefs(true).then(() => process.exit(0)).catch(err => {
    console.error("Fatal error during audit:", err);
    process.exit(1);
  });
}
