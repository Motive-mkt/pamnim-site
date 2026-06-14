import { Firestore } from "@google-cloud/firestore";
import fs from "fs";

async function adminDelete() {
  console.log("Initializing Admin Firestore client...");
  
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const databaseId = config.firestoreDatabaseId || "ai-studio-cedab439-d6a5-4268-aead-234f724a6f34";

  // Automatically uses Application Default Credentials (ADC) or environmental project config
  const firestore = new Firestore({
    projectId: "gen-lang-client-0597692683",
    databaseId: databaseId
  });

  const uid = "3ePqpo4f74VkHyJFyjKEyOE2v1L2";
  console.log(`Deleting profile document for UID: ${uid} via privileged Admin SDK...`);

  try {
    const docRef = firestore.collection("profiles").doc(uid);
    await docRef.delete();
    console.log("-> SUCCESS! Profile document deleted successfully bypassing all client security rules!");
  } catch (err: any) {
    console.error("-> FAILED:", err.message || err);
  }
}

adminDelete();
