import { Firestore } from "@google-cloud/firestore";

async function adminDelete() {
  console.log("Initializing Admin Firestore client...");
  // Automatically uses Application Default Credentials (ADC) or environmental project config
  const firestore = new Firestore({
    projectId: "gen-lang-client-0597692683",
    databaseId: "ai-studio-396542db-a5b7-4b73-a209-846a866b09ab"
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
