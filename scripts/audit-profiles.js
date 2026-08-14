import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
};

const app = initializeApp(firebaseConfig, "audit-app");
const db = getFirestore(app, config.firestoreDatabaseId || "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34");

function isSuspiciousEmail(email) {
  if (!email) return true;
  const lower = email.toLowerCase().trim();
  if (lower.includes("test") || lower.includes("fake") || lower.includes("robot") || lower.includes("example.com") || lower.includes("diag_")) {
    return true;
  }
  const parts = lower.split("@");
  if (parts.length !== 2) return true;
  const username = parts[0];
  if (/^[a-z0-9]{15,}$/.test(username)) return true;
  return false;
}

async function auditProfiles() {
  console.log("================================================================================");
  console.log("                      PAMNIM INTERIORS - PROFILES AUDIT                         ");
  console.log("================================================================================");
  console.log(`Database ID: ${config.firestoreDatabaseId}`);
  console.log(`Project ID:  ${config.projectId}`);
  console.log("Fetching profiles collection...\n");

  try {
    const snapshot = await getDocs(collection(db, "profiles"));
    if (snapshot.empty) {
      console.log("No profiles found in the database.");
      process.exit(0);
    }

    const profiles = [];
    snapshot.forEach(docSnap => {
      profiles.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    // Sort by createdAt
    profiles.sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tA - tB;
    });

    console.log(`Total profile records found: ${profiles.length}\n`);

    const suspicious = [];
    const likelyReal = [];

    // Analyze each profile
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      const reasons = [];

      // Reason 1: Placeholder name exactly "Owner", "Client", or "User"
      const name = (p.name || "").trim();
      if (name === "Owner" || name === "Client" || name === "User" || !name) {
        reasons.push(`Placeholder or missing name: "${name}"`);
      }

      // Reason 2: Missing whatsapp AND phone
      const hasPhone = Boolean(p.whatsapp || p.phone);
      if (!hasPhone) {
        reasons.push("Missing WhatsApp and phone contact");
      }

      // Reason 3: Suspicious email
      if (isSuspiciousEmail(p.email)) {
        reasons.push(`Suspicious/test email pattern: "${p.email}"`);
      }

      // Reason 4: Timestamp proximity with adjacent profiles (within 5 seconds)
      const currentCreated = new Date(p.createdAt || 0).getTime();
      const prevCreated = i > 0 ? new Date(profiles[i - 1].createdAt || 0).getTime() : 0;
      const nextCreated = i < profiles.length - 1 ? new Date(profiles[i + 1].createdAt || 0).getTime() : 0;
      if (currentCreated > 0 && ((prevCreated > 0 && Math.abs(currentCreated - prevCreated) < 5000) || (nextCreated > 0 && Math.abs(currentCreated - nextCreated) < 5000))) {
        reasons.push("Creation timestamp clustered within 5s of another account");
      }

      if (reasons.length > 0 && p.role !== "owner") {
        suspicious.push({ profile: p, reasons });
      } else {
        likelyReal.push({ profile: p, reasons });
      }
    }

    // Print Likely Real Users
    console.log("--------------------------------------------------------------------------------");
    console.log(`  LIKELY REAL USERS (${likelyReal.length})`);
    console.log("--------------------------------------------------------------------------------");
    likelyReal.forEach(({ profile: p, reasons }, idx) => {
      console.log(`[${idx + 1}] UID:       ${p.uid || p.id}`);
      console.log(`    Name:      ${p.name || "(none)"}`);
      console.log(`    Email:     ${p.email || "(none)"}`);
      console.log(`    Phone/WA:  ${p.whatsapp || p.phone || "(none)"}`);
      console.log(`    Role:      ${p.role || "unknown"} | Status: ${p.status || "unknown"}`);
      console.log(`    Created:   ${p.createdAt || "(unknown)"}`);
      if (reasons.length > 0) {
        console.log(`    Notes:     ${reasons.join("; ")} (retained due to owner role or verified attributes)`);
      }
      console.log("");
    });

    // Print Likely Robot / Auto-created Accounts
    console.log("--------------------------------------------------------------------------------");
    console.log(`  LIKELY ROBOT / AUTO-CREATED ACCOUNTS (${suspicious.length})`);
    console.log("--------------------------------------------------------------------------------");
    if (suspicious.length === 0) {
      console.log("No suspicious or robot profiles detected.\n");
    } else {
      suspicious.forEach(({ profile: p, reasons }, idx) => {
        console.log(`[${idx + 1}] UID:       ${p.uid || p.id}`);
        console.log(`    Name:      ${p.name || "(none)"}`);
        console.log(`    Email:     ${p.email || "(none)"}`);
        console.log(`    Phone/WA:  ${p.whatsapp || p.phone || "(none)"}`);
        console.log(`    Role:      ${p.role || "unknown"} | Status: ${p.status || "unknown"}`);
        console.log(`    Created:   ${p.createdAt || "(unknown)"}`);
        console.log(`    FLAGS:     * ${reasons.join("\n               * ")}`);
        console.log("");
      });

      console.log("================================================================================");
      console.log("UID LIST FOR DELETION (Copy and paste into scripts/delete-profiles.js):");
      console.log("--------------------------------------------------------------------------------");
      const uidList = suspicious.map(s => `  "${s.profile.uid || s.profile.id}"`).join(",\n");
      console.log(`const UIDS_TO_DELETE = [\n${uidList}\n];`);
      console.log("================================================================================\n");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error during audit:", err);
    process.exit(1);
  }
}

auditProfiles();
