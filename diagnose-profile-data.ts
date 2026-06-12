import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0597692683",
  appId: "1:696195171610:web:b01279ea874f6360a398a3",
  apiKey: "AIzaSyCWJt933MlHtXerkiNU5M6zENPWyrhWcsU",
  authDomain: "gen-lang-client-0597692683.firebaseapp.com",
};

async function diagnose() {
  console.log("Starting Owner Permission writes diagnostics...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-396542db-a5b7-4b73-a209-846a866b09ab");
  const auth = getAuth(app);

  const adminEmail = "your-admin-email@example.com";
  const testPassword = "Password123!";

  try {
    console.log(`Signing in as<sup>TM</sup> admin...`);
    const cred = await signInWithEmailAndPassword(auth, adminEmail, testPassword);
    const user = cred.user;
    console.log(`Logged in as Auth Admin: ${user.email} (${user.uid})`);

    // Let's test a write to gallery!
    console.log("Attempting write to 'gallery' collection...");
    const addedDocRef = await addDoc(collection(db, 'gallery'), {
      title: "Diagnostic Test Gallery Item",
      category: "Test Category",
      image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=600",
      createdAt: new Date().toISOString()
    });
    console.log(`SUCCESS! Document written to 'gallery' with ID: ${addedDocRef.id}`);

    // Clean up
    console.log("Cleaning up created test document...");
    await deleteDoc(doc(db, "gallery", addedDocRef.id));
    console.log("Clean up finished!");

  } catch (err: any) {
    console.error("DIAGNOSTIC BLOCK ERROR:", err.message || err);
  } finally {
    process.exit(0);
  }
}

diagnose();
