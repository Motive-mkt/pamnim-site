import { initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

async function run() {
  try {
    const app = initializeApp({
      projectId: "gen-lang-client-0597692683"
    });
    
    console.log("Fetching security rules from Firebase admin...");
    const rules = getSecurityRules(app);
    
    // Get the active ruleset for our custom database
    const ruleset = await rules.getFirestoreRuleset("ai-studio-396542db-a5b7-4b73-a209-846a866b09ab");
    console.log("\n=============================================");
    console.log("LIVE FIRESTORE RULES FOR DATABASE ID:");
    console.log("ai-studio-396542db-a5b7-4b73-a209-846a866b09ab");
    console.log("=============================================");
    if (ruleset && ruleset.files && ruleset.files.length > 0) {
      console.log(ruleset.files[0].content);
    } else {
      console.log("No rules found or files structure empty.");
    }
    console.log("=============================================\n");
  } catch (err: any) {
    console.error("Failed to query active rules:", err.message || err);
  }
}

run();
