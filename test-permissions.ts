import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, collection, addDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0597692683",
  appId: "1:696195171610:web:b01279ea874f6360a398a3",
  apiKey: "AIzaSyCWJt933MlHtXerkiNU5M6zENPWyrhWcsU",
  authDomain: "gen-lang-client-0597692683.firebaseapp.com",
};

async function runTest() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-396542db-a5b7-4b73-a209-846a866b09ab");
  const auth = getAuth(app);

  const adminEmail = "your-admin-email@example.com";
  const testPassword = "Password123!";

  console.log(`Signing in as ${adminEmail}...`);
  const cred = await signInWithEmailAndPassword(auth, adminEmail, testPassword);
  console.log(`Signed in successfully! UID: ${cred.user.uid}`);

  const testProfileRef = doc(db, "profiles", cred.user.uid);
  const snap = await getDoc(testProfileRef);
  console.log("Current Profile Doc Exists?", snap.exists());
  if (snap.exists()) {
    console.log("Current Profile Doc Data:", JSON.stringify(snap.data(), null, 2));
  }

  try {
    console.log(`Trying to CREATE document at '${testProfileRef.path}'...`);
    await setDoc(testProfileRef, { name: "Test User", email: "test@example.com", role: "owner" });
    console.log("-> CREATE succeeded!");

    console.log(`Trying to UPDATE document at '${testProfileRef.path}'...`);
    await setDoc(testProfileRef, { name: "Updated Test User" }, { merge: true });
    console.log("-> UPDATE succeeded!");

    console.log(`Trying to DELETE document at '${testProfileRef.path}'...`);
    await deleteDoc(testProfileRef);
    console.log("-> DELETE succeeded!");
  } catch (err: any) {
    console.error("-> FAILED with error:", err.message);
  }

  process.exit(0);
}

runTest();
