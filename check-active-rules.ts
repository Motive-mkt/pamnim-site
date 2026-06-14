import { initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import fs from "fs";

async function run() {
  try {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    const databaseId = config.firestoreDatabaseId || "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34";

    const app = initializeApp({
      projectId: "gen-lang-client-0597692683"
    });
    
    console.log("Fetching security rules from Firebase admin...");
    const rules = getSecurityRules(app);
    
    // Get the active ruleset for our custom database
    const ruleset = await (rules as any).getFirestoreRuleset(databaseId);
    console.log("\n=============================================");
    console.log("LIVE FIRESTORE RULES FOR DATABASE ID:");
    console.log(databaseId);
    console.log("=============================================");
    const sourceFiles = (ruleset as any)?.source?.files;
    if (sourceFiles && sourceFiles.length > 0) {
      console.log(sourceFiles[0].content);
    } else {
      console.log("No rules found or files structure empty.");
    }
    console.log("=============================================\n");
  } catch (err: any) {
    console.error("Failed to query active rules:", err.message || err);
  }
}

run();
